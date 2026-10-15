import { KEYFRAME_STRIDE, scratchLocal, scratchQ, scratchQ2, scratchT } from './const.js'
import type {
  AnimationTrack,
  Bone,
  InstanceRecord,
  SkeletalGpuOptions,
  SkeletonRecord,
  TrackRecord,
} from './types/index.js'
import mat4Mul from './utils/mat4Mul.js'
import mat4FromQT from './utils/mat4FromQT.js'
import slerp from './utils/slerp.js'

/**
 * GPU-oriented skeletal animation core: skeletons and packed animation
 * tables are validated and copied CPU-side, blend trees sample with slerp,
 * and parent-first composition writes world matrices ready to upload as
 * Texture Data or Storage Buffers.
 *
 * @example
 * ```typescript
 * const anim = new SkeletalGpu({ backend: 'webgpu', maxInstances: 256 })
 * const skeleton = anim.registerSkeleton(bones, tracks)
 * const orc = anim.createInstance(skeleton)
 * anim.setBlend(orc, 'run', 1)
 * anim.update(dt)
 * device.queue.writeBuffer(instanceBuffer, 0, anim.getInstanceMatrices(orc))
 * ```
 */
export class SkeletalGpu {
  readonly backend: 'webgpu' | 'webgl2'
  readonly maxInstances: number

  private readonly skeletons: Array<SkeletonRecord> = []
  private readonly instances: Array<InstanceRecord> = []
  private readonly freeSlots: Int32Array
  private freeCount: number

  /**
   * Creates the animation core with a fixed instance pool.
   *
   * @param options Backend flag plus pool size; see {@link SkeletalGpuOptions}.
   * @throws {TypeError} On any backend other than `'webgpu'`/`'webgl2'`.
   * @throws {RangeError} On non-positive integer `maxInstances`.
   */
  constructor(options: SkeletalGpuOptions) {
    if (!options || (options.backend !== 'webgpu' && options.backend !== 'webgl2')) {
      throw new TypeError("SkeletalGpu backend must be 'webgpu' or 'webgl2'")
    }
    if (!Number.isInteger(options.maxInstances) || options.maxInstances <= 0) {
      throw new RangeError('maxInstances must be positive')
    }
    this.backend = options.backend
    this.maxInstances = options.maxInstances
    this.freeSlots = new Int32Array(options.maxInstances)
    for (let i = 0; i < options.maxInstances; i++) {
      this.freeSlots[i] = options.maxInstances - 1 - i
      this.instances.push({
        active: false,
        skeletonId: -1,
        weights: new Map(),
        time: 0,
        matrices: new Float32Array(0),
      })
    }
    this.freeCount = options.maxInstances
  }

  /**
   * Validates and deep-copies a skeleton plus its animation tables, so later
   * caller-side mutations cannot corrupt playback.
   *
   * @param bones Non-empty, parent-first ordered bones.
   * @param tracks Non-empty tracks with unique names, positive durations
   * and keyframe tables holding whole `bones × 7` frames.
   * @returns Skeleton id for `createInstance`.
   * @throws {TypeError} On empty/malformed bones or tracks.
   * @throws {RangeError} On unordered parents, non-positive durations or
   * partial keyframe tables.
   * @throws {Error} On duplicate track names.
   */
  registerSkeleton(bones: readonly Bone[], tracks: readonly AnimationTrack[]): number {
    if (!Array.isArray(bones) || bones.length === 0) {
      throw new TypeError('registerSkeleton expects a non-empty bones array')
    }
    if (!Array.isArray(tracks) || tracks.length === 0) {
      throw new TypeError('registerSkeleton expects a non-empty tracks array')
    }
    const boneCount = bones.length
    const copiedBones = bones.map((bone, index) => {
      if (!bone || typeof bone.name !== 'string' || bone.name.length === 0) {
        throw new TypeError(`bone ${index} must have a non-empty name`)
      }
      if (!Number.isInteger(bone.parent) || bone.parent < -1 || bone.parent >= index) {
        throw new RangeError(
          `bone "${bone.name}" parent must be -1 or an earlier bone index (parents must precede children)`,
        )
      }
      return { name: bone.name, parent: bone.parent }
    })
    const stored = new Map<string, TrackRecord>()
    for (const track of tracks) {
      if (!track || typeof track.name !== 'string' || track.name.length === 0) {
        throw new TypeError('every track must have a non-empty name')
      }
      if (stored.has(track.name)) {
        throw new Error(`duplicate track name "${track.name}"`)
      }
      if (!Number.isFinite(track.durationSeconds) || track.durationSeconds <= 0) {
        throw new RangeError(`track "${track.name}" durationSeconds must be positive`)
      }
      if (!(track.keyframes instanceof Float32Array)) {
        throw new TypeError(`track "${track.name}" keyframes must be a Float32Array`)
      }
      const perFrame = boneCount * KEYFRAME_STRIDE
      if (track.keyframes.length < perFrame || track.keyframes.length % perFrame !== 0) {
        throw new RangeError(
          `track "${track.name}" keyframes length must hold whole frames of ${perFrame} floats`,
        )
      }
      stored.set(track.name, {
        durationSeconds: track.durationSeconds,
        frames: track.keyframes.length / perFrame,
        data: track.keyframes.slice(),
      })
    }
    this.skeletons.push({ bones: copiedBones, tracks: stored })
    return this.skeletons.length - 1
  }

  /**
   * Allocates a pooled instance with identity matrices and zeroed time.
   *
   * @param skeletonId Id from {@link registerSkeleton}.
   * @returns Instance id for `setBlend`/`update`/`getInstanceMatrices`.
   * @throws {RangeError} On unknown skeleton ids.
   * @throws {Error} When the instance pool is exhausted.
   */
  createInstance(skeletonId: number): number {
    if (!Number.isInteger(skeletonId) || skeletonId < 0 || skeletonId >= this.skeletons.length) {
      throw new RangeError('unknown skeleton id')
    }
    if (this.freeCount <= 0) {
      throw new Error('SkeletalGpu: instance capacity exhausted')
    }
    const id = this.freeSlots[--this.freeCount]
    const record = this.instances[id]
    const boneCount = this.skeletons[skeletonId].bones.length
    record.active = true
    record.skeletonId = skeletonId
    record.weights.clear()
    record.time = 0
    record.matrices = new Float32Array(boneCount * 16)
    for (let b = 0; b < boneCount; b++) {
      const o = b * 16
      record.matrices[o] = 1
      record.matrices[o + 5] = 1
      record.matrices[o + 10] = 1
      record.matrices[o + 15] = 1
    }
    return id
  }

  /**
   * Releases an instance id back to the pool for reuse.
   *
   * @param instanceId Allocated instance id.
   * @throws {RangeError} On out-of-range ids.
   * @throws {Error} When the instance is not allocated.
   */
  destroyInstance(instanceId: number): void {
    const record = this.assertInstance(instanceId)
    record.active = false
    record.skeletonId = -1
    record.weights.clear()
    record.time = 0
    this.freeSlots[this.freeCount++] = instanceId
  }

  private assertInstance(instanceId: number): InstanceRecord {
    if (!Number.isInteger(instanceId) || instanceId < 0 || instanceId >= this.maxInstances) {
      throw new RangeError('unknown instance id')
    }
    const record = this.instances[instanceId]
    if (!record.active) {
      throw new Error(`SkeletalGpu: instance ${instanceId} is not allocated`)
    }
    return record
  }

  /**
   * Sets one blend-tree weight; `0` removes the entry. Weights normalize at
   * `update` time, so partial trees cross-fade naturally.
   *
   * @param instanceId Allocated instance id.
   * @param trackName Track registered on the instance's skeleton.
   * @param weight Blend weight in `[0, 1]`.
   * @throws {RangeError} On out-of-range instances or weights outside `[0, 1]`.
   * @throws {Error} On unallocated instances or unknown tracks.
   */
  setBlend(instanceId: number, trackName: string, weight: number): void {
    const record = this.assertInstance(instanceId)
    const skeleton = this.skeletons[record.skeletonId]
    if (!skeleton.tracks.has(trackName)) {
      throw new Error(`SkeletalGpu: unknown track "${trackName}"`)
    }
    if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
      throw new RangeError('blend weight must be within [0, 1]')
    }
    if (weight === 0) record.weights.delete(trackName)
    else record.weights.set(trackName, weight)
  }

  /**
   * Live world matrices for an instance (`boneCount * 16` column-major
   * floats), ready to upload as Texture Data or a Storage Buffer. The
   * returned array is owned by the instance — upload it, don't retain it
   * across `update` calls expecting a snapshot.
   *
   * @param instanceId Allocated instance id.
   * @throws {Error} On unallocated instances.
   */
  getInstanceMatrices(instanceId: number): Float32Array {
    return this.assertInstance(instanceId).matrices
  }

  /**
   * Advances every active instance: wraps time per track duration, samples
   * with slerp, blends rotations (hemisphere-safe) and translations by
   * normalized weight — falling back to the first track on zero total —
   * then composes parent-first world matrices into module scratch.
   *
   * @param deltaSeconds Non-negative time step; `0` is a no-op.
   * @throws {RangeError} On negative or non-finite steps.
   */
  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError('deltaSeconds must be >= 0')
    }
    if (deltaSeconds === 0) return
    for (const record of this.instances) {
      if (!record.active) continue
      const skeleton = this.skeletons[record.skeletonId]
      const boneCount = skeleton.bones.length
      record.time += deltaSeconds

      let entries = [...record.weights.entries()].filter(([, w]) => w > 0)
      if (entries.length === 0) {
        const first = skeleton.tracks.keys().next()
        if (first.done) continue
        entries = [[first.value, 1]]
      }
      let total = 0
      for (const [, w] of entries) total += w
      if (!(total > 0)) continue

      for (let bone = 0; bone < boneCount; bone++) {
        let qx = 0
        let qy = 0
        let qz = 0
        let qw = 0
        let tx = 0
        let ty = 0
        let tz = 0
        let blended = false
        for (const [name, weight] of entries) {
          const track = skeleton.tracks.get(name)
          if (!track) continue
          const t = (record.time % track.durationSeconds) / track.durationSeconds
          const position = t * track.frames
          const f0 = Math.floor(position) % track.frames
          const f1 = (f0 + 1) % track.frames
          const alpha = position - Math.floor(position)
          const base0 = (f0 * boneCount + bone) * KEYFRAME_STRIDE
          const base1 = (f1 * boneCount + bone) * KEYFRAME_STRIDE
          const d = track.data
          slerp(
            scratchQ,
            d[base0],
            d[base0 + 1],
            d[base0 + 2],
            d[base0 + 3],
            d[base1],
            d[base1 + 1],
            d[base1 + 2],
            d[base1 + 3],
            alpha,
          )
          scratchT[0] = d[base0 + 4] + (d[base1 + 4] - d[base0 + 4]) * alpha
          scratchT[1] = d[base0 + 5] + (d[base1 + 5] - d[base0 + 5]) * alpha
          scratchT[2] = d[base0 + 6] + (d[base1 + 6] - d[base0 + 6]) * alpha
          const w = weight / total
          if (!blended) {
            qx = scratchQ[0]
            qy = scratchQ[1]
            qz = scratchQ[2]
            qw = scratchQ[3]
            tx = scratchT[0] * w
            ty = scratchT[1] * w
            tz = scratchT[2] * w
            blended = true
          } else {
            if (qx * scratchQ[0] + qy * scratchQ[1] + qz * scratchQ[2] + qw * scratchQ[3] < 0) {
              scratchQ2[0] = -scratchQ[0]
              scratchQ2[1] = -scratchQ[1]
              scratchQ2[2] = -scratchQ[2]
              scratchQ2[3] = -scratchQ[3]
            } else {
              scratchQ2[0] = scratchQ[0]
              scratchQ2[1] = scratchQ[1]
              scratchQ2[2] = scratchQ[2]
              scratchQ2[3] = scratchQ[3]
            }
            // Spherical blend of the accumulated rotation toward the new sample.
            const dot = Math.max(
              -1,
              Math.min(
                1,
                qx * scratchQ2[0] + qy * scratchQ2[1] + qz * scratchQ2[2] + qw * scratchQ2[3],
              ),
            )
            if (dot > 0.9995) {
              qx += (scratchQ2[0] - qx) * w
              qy += (scratchQ2[1] - qy) * w
              qz += (scratchQ2[2] - qz) * w
              qw += (scratchQ2[3] - qw) * w
            } else {
              const theta = Math.acos(dot)
              const sinTheta = Math.sin(theta) || 1
              const wa = Math.sin((1 - w) * theta) / sinTheta
              const wb = Math.sin(w * theta) / sinTheta
              const nx = qx * wa + scratchQ2[0] * wb
              const ny = qy * wa + scratchQ2[1] * wb
              const nz = qz * wa + scratchQ2[2] * wb
              const nw = qw * wa + scratchQ2[3] * wb
              qx = nx
              qy = ny
              qz = nz
              qw = nw
            }
            tx += scratchT[0] * w
            ty += scratchT[1] * w
            tz += scratchT[2] * w
          }
        }
        const len = Math.hypot(qx, qy, qz, qw) || 1
        // Local matrix in scratch, then composed with the parent world matrix.
        mat4FromQT(scratchLocal, 0, qx / len, qy / len, qz / len, qw / len, tx, ty, tz)
        const parent = skeleton.bones[bone].parent
        const outOffset = bone * 16
        if (parent === -1) {
          record.matrices.set(scratchLocal.subarray(0, 16), outOffset)
        } else {
          mat4Mul(
            record.matrices,
            outOffset,
            record.matrices.subarray(parent * 16, parent * 16 + 16),
            scratchLocal,
          )
        }
      }
    }
  }
}
