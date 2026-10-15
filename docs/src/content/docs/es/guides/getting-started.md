---
title: Primeros pasos
description: Cómo instalar y empezar a usar los paquetes de EngineWeb.
---

EngineWeb es una colección de algoritmos, estructuras de datos y utilidades de ultra alto rendimiento diseñada específicamente para videojuegos modernos basados en navegador (TypeScript / ESM).

## Requisitos previos

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10

## Instalación

Clona el monorepo e instala las dependencias con **pnpm**:

```bash
git clone https://github.com/OctaEDLP00/engineweb.git
cd engineweb
pnpm install
```

### Scripts del workspace

| Script           | Descripción                                              |
| ---------------- | -------------------------------------------------------- |
| `pnpm build`     | Compila cada paquete de `packages/*` con tsdown.          |
| `pnpm test`      | Ejecuta la suite de tests de todos los paquetes.         |
| `pnpm lint`      | Analiza todo el workspace con ESLint.                    |
| `pnpm format`    | Formatea el workspace con Prettier.                      |
| `pnpm changeset` | Registra un changeset para la próxima versión.           |
| `pnpm docs:dev`  | Sirve este sitio de documentación localmente.            |
| `pnpm release`   | Publica los paquetes en npm vía changesets.              |

## Usar un paquete

Los paquetes se publican bajo el ámbito `@engineweb/*`. Por ejemplo:

```bash
pnpm add @engineweb/net-interpolator
```

### Ejemplo (`@engineweb/net-interpolator` con Effect)

```typescript
import { Effect } from 'effect'
import { NetInterpolator } from '@engineweb/net-interpolator'

const interp = new NetInterpolator<{ x: number; y: number }>({ delayMs: 100 })

const program = Effect.sync(() => {
  interp.push({ state: { x: 100, y: 200 }, timestamp: Date.now() })
  return interp.sample(Date.now())
})

Effect.runPromise(program)
```

## Contribuir

Revisa las [guías de contribución](https://github.com/OctaEDLP00/engineweb/blob/main/CONTRIBUTING.md) antes de enviar un pull request. Todos los paquetes usan versiones con [changesets](https://github.com/changesets/changesets) y los commits siguen la especificación [Conventional Commits](https://www.conventionalcommits.org/).
