import { AssetPipeline } from '@engineweb/effect-asset-pipeline'
import { NetInterpolator } from '@engineweb/net-interpolator'
import { World } from '@engineweb/signal-ecs'
import type { ComponentType, Entity } from '@engineweb/signal-ecs'
import { TypedSpatialHash } from '@engineweb/typed-spatial-hash'
import { findPath } from '@engineweb/async-pathfinder'
import type { Vec2 } from '@engineweb/async-pathfinder'
import { SynthEngine } from '@engineweb/audio-synthesis'
import { WasmPhysicsBinding } from '@engineweb/wasm-physics-binding'
import { createHeightmapChunk } from '@engineweb/worker-terrain'

const CELL = 32
const PLAYER_SPEED = 170
const ENEMY_SPEEDS = { easy: 70, normal: 95, hard: 130 } as const
const PICKUP_RADIUS = 15
const HIT_RADIUS = 13
const IFRAMES_SECONDS = 1.5
const MAX_ENTITIES = 32
const SETTINGS_KEY = 'engineweb-arena-settings'

type Difficulty = keyof typeof ENEMY_SPEEDS

interface Settings {
  volume: number
  muted: boolean
  difficulty: Difficulty
  ghost: boolean
  meteors: boolean
  seed: number
}

const DEFAULT_SETTINGS: Settings = {
  volume: 0.8,
  muted: false,
  difficulty: 'normal',
  ghost: true,
  meteors: true,
  seed: 7,
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      volume:
        typeof parsed.volume === 'number' ?
          Math.min(1, Math.max(0, parsed.volume))
        : DEFAULT_SETTINGS.volume,
      muted: parsed.muted === true,
      difficulty:
        parsed.difficulty === 'easy' || parsed.difficulty === 'hard' ? parsed.difficulty : 'normal',
      ghost: parsed.ghost !== false,
      meteors: parsed.meteors !== false,
      seed: Number.isInteger(parsed.seed) ? (parsed.seed as number) : DEFAULT_SETTINGS.seed,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Private mode or blocked storage: play on with defaults.
  }
}

function inputElement(id: string): HTMLInputElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLInputElement)) throw new Error(`#${id} input missing`)
  return element
}

function selectElement(id: string): HTMLSelectElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLSelectElement)) throw new Error(`#${id} select missing`)
  return element
}

interface LevelData {
  width: number
  height: number
  walls: Array<string>
  playerSpawn: Vec2
  enemySpawns: Array<Vec2>
  orbs: Array<Vec2>
}

interface XY {
  x: number
  y: number
}

interface Enemy {
  entity: Entity
  waypoints: Array<Vec2>
  search: AsyncGenerator<number, Array<Vec2>> | undefined
  busy: boolean
  repathIn: number
}

interface Orb {
  entity: Entity
  taken: boolean
}

function canvas2d(id: string): { ctx: CanvasRenderingContext2D } {
  const canvas = document.getElementById(id)
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error(`#${id} canvas missing`)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D context unavailable')
  return { ctx }
}

function text(id: string): HTMLElement {
  const element = document.getElementById(id)
  if (!element) throw new Error(`#${id} element missing`)
  return element
}

// --- signal-ecs stores: Position (x, y) and Score live in flat SoA buffers ---
const posStore = new Float32Array(MAX_ENTITIES * 2)
const Position: ComponentType<XY> = {
  name: 'position',
  arity: 2,
  read(entity: Entity, out: Float32Array): XY {
    out[0] = posStore[entity * 2]
    out[1] = posStore[entity * 2 + 1]
    return { x: out[0], y: out[1] }
  },
  write(entity: Entity, value: XY): void {
    posStore[entity * 2] = value.x
    posStore[entity * 2 + 1] = value.y
  },
}

const scoreStore = new Float32Array(MAX_ENTITIES)
const Score: ComponentType<number> = {
  name: 'score',
  arity: 1,
  read(entity: Entity, out: Float32Array): number {
    out[0] = scoreStore[entity]
    return out[0]
  },
  write(entity: Entity, value: number): void {
    scoreStore[entity] = value
  },
}

function positionOf(entity: Entity): XY {
  return { x: posStore[entity * 2], y: posStore[entity * 2 + 1] }
}

// --- worker-terrain backdrop: heightfield tinted once onto an offscreen canvas ---
function paintBackdrop(
  target: CanvasRenderingContext2D,
  level: LevelData,
  walls: ReadonlySet<string>,
  seed: number,
): void {
  const chunk = createHeightmapChunk({ size: level.width, lod: 3, seed })
  const side = Math.sqrt(chunk.positions.length / 3)
  const heights = new Float32Array(level.width * level.height)
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  const sample = (gx: number, gy: number): number => {
    const x0 = Math.floor(gx)
    const y0 = Math.floor(gy)
    const x1 = Math.min(side - 1, x0 + 1)
    const y1 = Math.min(side - 1, y0 + 1)
    const fx = gx - x0
    const fy = gy - y0
    const h = (ix: number, iy: number): number => chunk.positions[(iy * side + ix) * 3 + 1]
    return (
      h(x0, y0) * (1 - fx) * (1 - fy) +
      h(x1, y0) * fx * (1 - fy) +
      h(x0, y1) * (1 - fx) * fy +
      h(x1, y1) * fx * fy
    )
  }
  for (let cy = 0; cy < level.height; cy++) {
    for (let cx = 0; cx < level.width; cx++) {
      const h = sample(
        (cx / (level.width - 1)) * (side - 1),
        (cy / (level.height - 1)) * (side - 1),
      )
      heights[cy * level.width + cx] = h
      if (h < min) min = h
      if (h > max) max = h
    }
  }
  const span = Math.max(1e-6, max - min)
  for (let cy = 0; cy < level.height; cy++) {
    for (let cx = 0; cx < level.width; cx++) {
      if (walls.has(`${cx},${cy}`)) {
        target.fillStyle = '#21262d'
      } else {
        const t = (heights[cy * level.width + cx] - min) / span
        const g = Math.round(22 + t * 34)
        target.fillStyle = `rgb(${g - 6},${g + 8},${g + 14})`
      }
      target.fillRect(cx * CELL, cy * CELL, CELL, CELL)
    }
  }
}

async function boot(): Promise<void> {
  const { ctx } = canvas2d('game')
  const scoreEl = text('score')
  const livesEl = text('lives')
  const fpsEl = text('fps')
  const overlay = text('overlay')
  const overlayText = text('overlay-text')
  const overlayButton = text('overlay-button')
  const settings = loadSettings()

  // effect-asset-pipeline: level geometry arrives through the resilient loader
  const assets = new AssetPipeline({ concurrency: 2 })
  const level = JSON.parse(
    new TextDecoder().decode(await assets.load({ url: 'level.json', kind: 'binary' })),
  ) as LevelData
  const walls = new Set(level.walls)
  const passable = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < level.width && y < level.height && !walls.has(`${x},${y}`)
  const cellCenter = (cell: Vec2): XY => ({ x: (cell.x + 0.5) * CELL, y: (cell.y + 0.5) * CELL })
  const toCell = (p: XY): Vec2 => ({ x: Math.floor(p.x / CELL), y: Math.floor(p.y / CELL) })

  const backdrop = document.createElement('canvas')
  backdrop.width = level.width * CELL
  backdrop.height = level.height * CELL
  const backdropCtx = backdrop.getContext('2d')
  if (!backdropCtx) throw new Error('2D context unavailable')
  paintBackdrop(backdropCtx, level, walls, settings.seed)

  // signal-ecs world: player, chasers and orbs
  const world = new World(MAX_ENTITIES)
  world.registerComponent(Position)
  world.registerComponent(Score)
  const player = world.createEntity()
  const spawnPx = cellCenter(level.playerSpawn)
  Position.write(player, spawnPx)
  Score.write(player, 0)
  world.watch(Score, (_entity, value) => {
    scoreEl.textContent = String(value)
  })
  const enemies: Array<Enemy> = level.enemySpawns.map((spawnCell, i) => {
    const entity = world.createEntity()
    Position.write(entity, cellCenter(spawnCell))
    return { entity, waypoints: [], search: undefined, busy: false, repathIn: i * 0.25 }
  })
  const orbs: Array<Orb> = level.orbs.map(spawnCell => {
    const entity = world.createEntity()
    Position.write(entity, cellCenter(spawnCell))
    return { entity, taken: false }
  })
  const enemyIds = new Set(enemies.map(e => e.entity))
  const orbByEntity = new Map<Entity, Orb>(orbs.map(o => [o.entity, o]))

  // typed-spatial-hash: rebuilt every frame for pickups and hits
  const grid = new TypedSpatialHash({ cellSize: 24, capacity: MAX_ENTITIES })

  // net-interpolator: ghost trailing the player by 250 ms of recorded history
  const ghost = new NetInterpolator<XY>({ delayMs: 250, bufferSize: 90 })

  // wasm-physics-binding: no module ships with the demo, so the JS fallback
  // integrates ambient meteors over the same zero-copy memory contract
  const physics = new WasmPhysicsBinding({ moduleUrl: 'physics.wasm', maxBodies: 32 })
  await physics.init()
  // No module ships with the demo: expect the JS fallback (e.g. the dev
  // server answers /physics.wasm with HTML). The reason is always explicit.
  if (!physics.usingWasm) console.info('[arena] physics fallback:', physics.fallback)
  physics.gravity = 130
  for (let i = 0; i < 24; i++) {
    physics.addBody(
      [Math.random() * level.width * CELL, -Math.random() * 480, 0],
      [(Math.random() - 0.5) * 30, 30 + Math.random() * 50, 0],
    )
  }

  // audio-synthesis: created on click (browser gesture requirement)
  let synth: SynthEngine | undefined
  const applyAudio = (): void => {
    synth?.setMasterVolume(settings.muted ? 0 : settings.volume)
  }
  overlayButton.addEventListener('click', () => {
    void (async () => {
      synth = new SynthEngine(new AudioContext())
      await synth.init()
      applyAudio()
      overlay.hidden = true
    })()
  })

  // settings panel: persisted customization for sound and gameplay
  const settingsPanel = text('settings')
  const volumeInput = inputElement('volume')
  const volumeValue = text('volume-value')
  const muteInput = inputElement('mute')
  const difficultyInput = selectElement('difficulty')
  const ghostInput = inputElement('ghost')
  const meteorsInput = inputElement('meteors')
  const seedInput = inputElement('seed')
  volumeInput.value = String(Math.round(settings.volume * 100))
  volumeValue.textContent = volumeInput.value
  muteInput.checked = settings.muted
  difficultyInput.value = settings.difficulty
  ghostInput.checked = settings.ghost
  meteorsInput.checked = settings.meteors
  seedInput.value = String(settings.seed)
  text('settings-button').addEventListener('click', () => {
    settingsPanel.hidden = !settingsPanel.hidden
  })
  text('settings-close').addEventListener('click', () => {
    settingsPanel.hidden = true
  })
  volumeInput.addEventListener('input', () => {
    settings.volume = Number(volumeInput.value) / 100
    volumeValue.textContent = volumeInput.value
    applyAudio()
    saveSettings(settings)
  })
  muteInput.addEventListener('change', () => {
    settings.muted = muteInput.checked
    applyAudio()
    saveSettings(settings)
  })
  difficultyInput.addEventListener('change', () => {
    if (difficultyInput.value === 'easy' || difficultyInput.value === 'hard') {
      settings.difficulty = difficultyInput.value
    } else {
      settings.difficulty = 'normal'
    }
    saveSettings(settings)
  })
  ghostInput.addEventListener('change', () => {
    settings.ghost = ghostInput.checked
    saveSettings(settings)
  })
  meteorsInput.addEventListener('change', () => {
    settings.meteors = meteorsInput.checked
    saveSettings(settings)
  })
  text('seed-apply').addEventListener('click', () => {
    const seed = Math.floor(Number(seedInput.value))
    if (!Number.isInteger(seed)) return
    settings.seed = seed
    paintBackdrop(backdropCtx, level, walls, seed)
    saveSettings(settings)
  })

  const keys = new Set<string>()
  window.addEventListener('keydown', event => {
    keys.add(event.code)
  })
  window.addEventListener('keyup', event => {
    keys.delete(event.code)
  })

  const blip = (frequency: number): void => {
    synth?.playVoice({
      frequency,
      ratio: 2,
      index: 5,
      envelope: {
        attackSeconds: 0.005,
        decaySeconds: 0.09,
        sustainLevel: 0.5,
        releaseSeconds: 0.12,
      },
    })
  }

  let lives = 3
  let iframes = 0
  let over = false
  let fpsEma = 60
  let last = performance.now()

  const endGame = (message: string): void => {
    over = true
    overlayText.textContent = message
    overlayButton.textContent = 'Play again'
    overlay.hidden = false
    overlayButton.onclick = () => location.reload()
  }

  const advanceSearch = (enemy: Enemy): void => {
    if (enemy.busy || enemy.search === undefined) return
    enemy.busy = true
    void enemy.search.next().then(step => {
      enemy.busy = false
      if (step.done) {
        enemy.waypoints = step.value.slice(1)
        enemy.search = undefined
      }
    })
  }

  const frame = (now: number): void => {
    // Clamp both ends: tab-switch spikes can't eat the simulation and
    // same-millisecond frames must never feed `step` a zero delta.
    const dt = Math.min(0.05, Math.max(1 / 1000, (now - last) / 1000))
    last = now
    fpsEma += (1 / Math.max(dt, 1e-4) - fpsEma) * 0.05
    fpsEl.textContent = String(Math.round(fpsEma))

    if (!over) {
      // player movement with wall checks
      const pos = positionOf(player)
      let dx = 0
      let dy = 0
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1
      if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1
      if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1
      if (dx !== 0 || dy !== 0) {
        const length = Math.hypot(dx, dy)
        const next: XY = {
          x: pos.x + (dx / length) * PLAYER_SPEED * dt,
          y: pos.y + (dy / length) * PLAYER_SPEED * dt,
        }
        const cell = toCell(next)
        if (passable(cell.x, cell.y)) Position.write(player, next)
      }
      iframes = Math.max(0, iframes - dt)

      // async-pathfinder: one slice per chaser per frame, staggered repaths
      const goal = toCell(positionOf(player))
      for (const enemy of enemies) {
        enemy.repathIn -= dt
        if (enemy.repathIn <= 0 && enemy.search === undefined) {
          enemy.repathIn = 0.8
          const from = toCell(positionOf(enemy.entity))
          enemy.search = findPath(
            { start: from, goal, width: level.width, height: level.height, passable },
            { maxExpansionsPerSlice: 64 },
          )
        }
        advanceSearch(enemy)
        const target = enemy.waypoints[0]
        if (target !== undefined) {
          const center = cellCenter(target)
          const current = positionOf(enemy.entity)
          const vx = center.x - current.x
          const vy = center.y - current.y
          const dist = Math.hypot(vx, vy)
          if (dist < 4) {
            enemy.waypoints.shift()
          } else {
            const speed = ENEMY_SPEEDS[settings.difficulty]
            Position.write(enemy.entity, {
              x: current.x + (vx / dist) * speed * dt,
              y: current.y + (vy / dist) * speed * dt,
            })
          }
        }
      }

      // typed-spatial-hash: pickups and hits around the player
      grid.clear()
      for (const orb of orbs) {
        if (!orb.taken)
          grid.insert(orb.entity, posStore[orb.entity * 2], posStore[orb.entity * 2 + 1])
      }
      for (const enemy of enemies) {
        grid.insert(enemy.entity, posStore[enemy.entity * 2], posStore[enemy.entity * 2 + 1])
      }
      const here = positionOf(player)
      const pickupHits = grid.queryRadius(here.x, here.y, PICKUP_RADIUS)
      const pickupIds = Array.from(pickupHits.ids.slice(0, pickupHits.count))
      for (const id of pickupIds) {
        const orb = orbByEntity.get(id)
        if (orb !== undefined && !orb.taken) {
          orb.taken = true
          Score.write(player, scoreStore[player] + 1)
          blip(880)
          if (scoreStore[player] >= orbs.length) endGame('You collected every orb — you win!')
        }
      }
      const enemyHits = grid.queryRadius(here.x, here.y, HIT_RADIUS)
      for (let i = 0; i < enemyHits.count; i++) {
        const id = enemyHits.ids[i]
        if (enemyIds.has(id) && iframes <= 0) {
          lives -= 1
          livesEl.textContent = String(Math.max(0, lives))
          blip(140)
          if (lives <= 0) {
            endGame('Caught! Game over.')
            break
          }
          iframes = IFRAMES_SECONDS
          Position.write(player, spawnPx)
        }
      }

      if (settings.ghost) {
        ghost.push({ state: { x: here.x, y: here.y }, timestamp: now })
      }
      if (settings.meteors) {
        physics.step(dt)
      }
    }

    // --- render ---
    ctx.drawImage(backdrop, 0, 0)
    for (const orb of orbs) {
      if (orb.taken) continue
      const p = positionOf(orb.entity)
      ctx.fillStyle = '#e3b341'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
      ctx.fill()
    }
    if (settings.ghost) {
      const echo = ghost.sample(now)
      ctx.fillStyle = 'rgb(56 189 248 / 0.35)'
      ctx.beginPath()
      ctx.arc(echo.x, echo.y, 9, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#f85149'
    for (const enemy of enemies) {
      const p = positionOf(enemy.entity)
      ctx.fillRect(p.x - 8, p.y - 8, 16, 16)
    }
    if (iframes <= 0 || Math.floor(now / 120) % 2 === 0) {
      const p = positionOf(player)
      ctx.fillStyle = '#3fb950'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2)
      ctx.fill()
    }
    if (settings.meteors) {
      const view = physics.getTransformView()
      ctx.fillStyle = 'rgb(230 237 243 / 0.5)'
      for (let i = 0; i < view.bodyCount; i++) {
        const y = view.matrices[i * 16 + 13]
        if (y >= 0 && y <= level.height * CELL) {
          ctx.fillRect(view.matrices[i * 16 + 12], y, 2, 7)
        }
      }
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

void boot()
