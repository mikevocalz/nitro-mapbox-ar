# Releasing

Publishing is public and irreversible after 72 hours, so a person runs it, not CI and not an agent. This page has the exact commands for `0.1.0-alpha.0`.

## State on 2026-10-08

- All six packages are at `0.1.0-alpha.0`. The two internal peers (`-navigation` and `-specs` on the core) are `^0.1.0-alpha.0`. A `>=0.0.1` range would not match a prerelease under npm's semver rules.
- Every package has `publishConfig: { "access": "public", "tag": "next" }`. Scoped packages default to restricted access, and the `next` tag keeps the alpha off `latest`.
- `npm view <name> version` returns `E404` for all six names, so this is a first publish. npm trusted publishing (OIDC) can only be linked to a package that already exists, so the first publish uses a token or an interactive login. Provenance needs OIDC in CI; a local publish has none.

## Tarballs

From `npm pack --dry-run --json --ignore-scripts` in each package directory, after `npm run build`, on 2026-10-08. Sizes move with every source edit; the file lists are what to review. `scripts/check-pack.mjs` runs the same dry run in `check:all` and fails on a missing entry point, README, LICENSE or `nitrogen/generated`, or on shipped tests, `.env` files or build caches.

| Package | Files | Packed | Unpacked | Contents |
| --- | --- | --- | --- | --- |
| `@mikevocalz/nitro-mapbox-ar` | 276 | 241.1 kB | 903.3 kB | `LICENSE`, `NitroMapboxAR.podspec`, `README.md`, `android/` (2), `android/src/` (4), `cpp/` (7), `dist/module/` (99), `dist/typescript/` (57), `docs/` (33), `ios/` (2), `nitro.json`, `nitrogen/generated/` (14), `package.json`, `react-native.config.js`, `scripts/` (2), `skills/`, `src/` (49) |
| `@mikevocalz/nitro-mapbox-ar-maps` | 268 | 94.8 kB | 661.6 kB | `LICENSE`, `NitroMapboxARNativeMap.podspec`, `README.md`, `android/` (2), `android/src/` (25), `ios/` (19), `nitro.json`, `nitrogen/generated/` (186), `package.json`, `react-native.config.js`, `src/` (30) |
| `@mikevocalz/nitro-mapbox-ar-navigation` | 157 | 54.4 kB | 341.0 kB | `LICENSE`, `NitroMapboxARNavigation.podspec`, `README.md`, `android/` (2), `android/src/` (19), `ios/` (16), `nitro.json`, `nitrogen/generated/` (96), `package.json`, `react-native.config.js`, `src/` (18) |
| `@mikevocalz/nitro-mapbox-ar-reactvision` | 29 | 34.7 kB | 116.8 kB | `LICENSE`, `README.md`, `package.json`, `src/` (26) |
| `@mikevocalz/nitro-mapbox-ar-specs` | 11 | 5.8 kB | 16.8 kB | `LICENSE`, `README.md`, `package.json`, `src/` (8) |
| `@mikevocalz/nitro-mapbox-ar-agent-mcp` | 4 | 1.9 kB | 4.0 kB | `LICENSE`, `README.md`, `package.json`, `src/` |

Two defects were fixed before this table was taken: `-maps` listed the whole `android/` folder, which pulled 13 files from a local, git-ignored `android/.gradle` cache into the tarball; and no workspace package shipped a LICENSE file.

## Publish

From a clean checkout of the commit you mean to release:

```sh
git status --short            # must print nothing
npm ci
npm run tooling:install
npm run check:all             # must exit 0

npm whoami --registry https://registry.npmjs.org   # the account that owns @mikevocalz
```

Publish the core first; the others name it as a peer.

```sh
npm publish                                   # @mikevocalz/nitro-mapbox-ar (prepack runs bob build)
npm publish --workspace packages/native-mapbox
npm publish --workspace packages/navigation
npm publish --workspace packages/reactvision
npm publish --workspace packages/specs
npm publish --workspace packages/agent-mcp
```

With 2FA on publish, add `--otp <code>` to each command. With a granular token instead of an interactive login, pass it on the command line (`--//registry.npmjs.org/:_authToken="$NPM_TOKEN"`); `NODE_AUTH_TOKEN` alone is ignored outside CI.

Check each one:

```sh
npm view @mikevocalz/nitro-mapbox-ar dist-tags     # { next: '0.1.0-alpha.0' }
npm view @mikevocalz/nitro-mapbox-ar@0.1.0-alpha.0 dist.tarball
```

## After the first publish

1. On npmjs.com, link each package to `mikevocalz/nitro-mapbox-ar` under Settings → Trusted publishing (GitHub Actions).
2. Move later publishes to a CI workflow with `id-token: write` and `npm publish --provenance`, then revoke any token used for the bootstrap.
3. Move `CHANGELOG.md`'s `[0.1.0] - unreleased` to the release date when `0.1.0` (without a prerelease suffix) ships, and tag it `latest` with `npm dist-tag add <name>@0.1.0 latest`.

## Undo

Within 72 hours: `npm unpublish <name>@0.1.0-alpha.0`. After that, `npm deprecate <name>@0.1.0-alpha.0 "<reason>"` and publish a fixed `0.1.0-alpha.1`.
