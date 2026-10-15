## Summary

<!-- What does this PR change, and why? Link related issues with `Fixes #NNN`. -->

## Type

<!-- Mark the Conventional Commits type matching your commit messages. -->

- [ ] `feat` — new feature or public API
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `refactor` — code change without behavior change
- [ ] `perf` — performance improvement
- [ ] `test` — tests only
- [ ] `chore` — tooling, config, dependencies

## Checklist

- [ ] Title follows [Conventional Commits](https://www.conventionalcommits.org/) (`commitlint` enforced).
- [ ] Changeset added via `pnpm changeset` (skip only for docs/tooling-only changes with no published effect).
- [ ] Tests added or updated (`pnpm --filter @engineweb/<name> run test`).
- [ ] JSDoc updated on new/changed public symbols.
- [ ] If a public API changed: `docs/src/content/docs/packages/*.mdx` updated in **both** English and Spanish (see `pnpm docs:build` + parity check).
- [ ] Verification chain is green: `pnpm format && pnpm lint && pnpm build && pnpm test`.

## Verification

<!-- Paste the relevant command outputs, e.g. test counts, build status. -->
