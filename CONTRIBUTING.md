# Contributing to EngineWeb

Thanks for your interest in contributing! This is a **pnpm workspace monorepo**.

## Getting started

```bash
git clone https://github.com/OctaEDLP00/engineweb.git
cd engineweb
pnpm install
```

## Project layout

- `packages/*` — the publishable `@engineweb/*` packages.
- `docs/` — the [Astro Starlight](https://starlight.astro.build/) documentation site.

## Workflow

1. Create a feature branch.
2. Make your changes inside the relevant `packages/*` folder.
3. Keep code formatted and lint-clean:

   ```bash
   pnpm format
   pnpm lint
   ```

4. Add a [changeset](https://github.com/changesets/changesets) describing the change:

   ```bash
   pnpm changeset
   ```

5. Commit using [Conventional Commits](https://www.conventionalcommits.org/) —
   commit messages are validated with `commitlint` (`feat:`, `fix:`, `docs:`,
   `chore:`, `refactor:`, `perf:`, `test:`, ...).
6. Open a pull request.

## Versioning & releases

- Versions are managed with `@changesets/cli`.
- `pnpm version-packages` applies the pending changesets and bumps versions.
- `pnpm release` builds and publishes the packages to npm.

## Documentation

Update or add pages under `docs/src/content/docs/packages/` whenever a public
API changes. Run the docs site locally with:

```bash
pnpm docs:dev
```

## License

By contributing you agree that your contributions are licensed under the MIT
License.
