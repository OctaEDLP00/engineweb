---
title: Getting Started
description: How to install and start using the EngineWeb packages.
---

EngineWeb is a collection of ultra-high-performance algorithms, data structures, and utilities engineered specifically for modern browser-based video games (TypeScript / ESM).

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10

## Installation

Clone the monorepo and install dependencies using **pnpm**:

```bash
git clone https://github.com/OctaEDLP00/engineweb.git
cd engineweb
pnpm install
```

### Workspace scripts

| Script              | Description                                       |
| ------------------- | ------------------------------------------------- |
| `pnpm build`        | Builds every `packages/*` package with tsdown.     |
| `pnpm test`         | Runs the test suite across all packages.          |
| `pnpm lint`         | Lints the whole workspace with ESLint.            |
| `pnpm format`       | Formats the workspace with Prettier.              |
| `pnpm changeset`    | Records a changeset for the next release.         |
| `pnpm docs:dev`     | Serves this documentation site locally.           |
| `pnpm release`      | Publishes the packages to npm via changesets.     |

## Using a package

Packages are published under the `@engineweb/*` scope. For example:

```bash
pnpm add @engineweb/net-interpolator
```

### Example (`@engineweb/net-interpolator` with Effect)

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

## Contributing

Please review the [contributing guidelines](https://github.com/OctaEDLP00/engineweb/blob/main/CONTRIBUTING.md) before submitting a pull request. All packages are versioned with [changesets](https://github.com/changesets/changesets) and commits follow the [Conventional Commits](https://www.conventionalcommits.org/) spec.
