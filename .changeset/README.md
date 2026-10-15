# Changesets

This folder holds the changeset files used by [@changesets/cli](https://github.com/changesets/changesets).

## Workflow

1. After making a change in one or more packages, run:

   ```bash
   pnpm changeset
   ```

2. Select the affected packages and the bump type (major / minor / patch).
3. Commit the generated markdown file together with your changes.
4. On release, `pnpm version-packages` bumps the package versions and updates
   the `CHANGELOG.md` files, then `pnpm release` publishes to npm.
