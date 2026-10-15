# AGENTS.md — engineweb

pnpm workspace monorepo (Node `>=20`, pnpm `12.11.2`, ESM-only `"type": "module"`).
9 independent publishable packages under `packages/*` (`@engineweb/*`); docs site in `docs/` (Astro Starlight, private).

## Layout

- `packages/<name>/`: each has root `index.ts` entrypoint (not `src/index.ts`), `src/` implementation, per-package `tsconfig.json` extending root.
- Packages have **no cross-dependencies** — treat each as standalone. Only `net-interpolator` and `effect-asset-pipeline` depend on `effect@^3.14.0`.
- Root `tsconfig.json` maps `@engineweb/*` → `./packages/*/src` (dev resolution only; published output is `dist/index.js` + `dist/index.d.ts`).
- TS is strict with `verbatimModuleSyntax` + `moduleResolution: bundler`, target ESNext, libs `DOM` + `WebWorker`. Use `import type` for types, `.js` extensions on relative imports.
- `docs/src/content/docs/packages/*.mdx` mirrors each package — update it when a public API changes.

## Commands (run from repo root)

```bash
pnpm install                                  # install workspace
pnpm build                                    # build all packages (tsdown per package)
pnpm test                                     # vitest run in every package
pnpm --filter @engineweb/<name> run build     # single package, e.g. @engineweb/signal-ecs
pnpm --filter @engineweb/<name> run test      # single package tests
pnpm lint                                     # eslint . (md/mdx ignored)
pnpm format                                   # prettier --write . — run before lint
pnpm format:check                             # verify formatting
pnpm docs:dev                                 # local docs site
```

- Per-package build is `tsdown index.ts --format esm --dts --clean` — always run from the package dir semantics above; never point tsdown at `src/`.
- Per-package test is `vitest run --passWithNoTests`. There are currently **no test files** in the repo, so an empty pass is expected, not a misconfiguration. Focused run: `pnpm --filter @engineweb/<name> exec vitest run <path>`.
- No `typecheck` script. Type errors surface via `pnpm build` (dts) — verify type changes by building the touched package.
- No CI workflows in repo; local `format → lint → build → test` is the verification chain.

## Conventions

- Prettier: no semicolons, single quotes, 2-space indent, LF, trailing commas `all`. ESLint additionally warns on non-generic `Array<T>` (`@typescript-eslint/array-type`: use `Array<T>`, not `T[]`, except `readonly` simple) and single-semicolon style.
- Design constraint across perf packages: zero-GC (TypedArrays, no per-frame allocation). Don't introduce heap allocations in hot paths (`TypedSpatialHash`, `signal-ecs` World, terrain noise, pathfinder).
- Commits must follow Conventional Commits (`commitlint`: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `perf:`, `test:`, …).
- Every PR change needs a changeset: `pnpm changeset`. Release flow is `pnpm version-packages` then `pnpm release` (changesets publish) — don't run these unless releasing.
