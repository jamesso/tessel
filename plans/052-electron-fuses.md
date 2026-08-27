# Plan 052: Flip packaged Electron fuses off insecure defaults

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a7bd825..HEAD -- package.json main.js`
> Compare excerpts against live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (do not turn off `GrantFileProtocolExtraPrivileges` — see 057)
- **Category**: security
- **Planned at**: commit `a7bd825`, 2026-08-27

## Why this matters

Packaged Tessel is an unsigned asar app that spawns ffmpeg. `@electron/packager` scripts never flip [Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses). Defaults leave `RunAsNode` and `NODE_OPTIONS` **on**, and asar integrity validation **off**. That is not Gatekeeper (permanently deferred). It is defense-in-depth for someone who already has the tarball: `ELECTRON_RUN_AS_NODE=1` can run the Electron binary as Node; `NODE_OPTIONS` can inject inspect/preload. Fuses only apply to **packaged** binaries, not `npm start`.

## Current state

`package.json:11-13`:

```
"package-mac": "npx @electron/packager . --overwrite --asar.unpackDir=node_modules/ffmpeg-static --platform=darwin --arch=arm64 --icon=assets/icons/mac/icon.icns --prune=true --out=release-builds",
"package-win": "... --platform=win32 --arch=x64 ...",
"package-linux": "... --platform=linux --arch=x64 ..."
```

No `scripts/package.js`, no `@electron/fuses`, no `afterComplete` hook. `main.js` `webSecurity: true`, `loadFile(app/index.html)`. ffmpeg lives in `app.asar.unpacked` (030).

`@electron/packager` 20 JS API: `afterComplete` runs with the **final** output directory (`node_modules/@electron/packager/dist/types.d.ts`). CLI flags cannot pass a JS function; you need a small Node wrapper.

**Conventions**: keep the three packager targets (darwin-arm64, win32-x64, linux-x64). `npx @electron/packager` flags become options in the wrapper. Short imperative commits. No AI co-author trailers.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `npm test` | exit 0 |
| Package this OS | `npm run package-mac` **or** `package-linux` / `package-win` matching the executor OS | exit 0, app under `release-builds/` |
| Read fuses | `npx @electron/fuses read --app <path-to-Tessel.app-or-binary>` | `RunAsNode` is **off**; `EnableNodeOptionsEnvironmentVariable` is **off** |

## Scope

**In scope**:

- `package.json` scripts + `devDependencies` `@electron/fuses`
- New `scripts/package.js` (or similar) used by `package-mac` / `package-win` / `package-linux`
- Optional one-line README that fuses are flipped at pack time (not required)

**Out of scope**:

- Code signing / notarization (`plans/DEFERRED.md`)
- Electron Forge / electron-builder rewrite
- Changing `webSecurity`, CSP, or IPC
- Flipping `GrantFileProtocolExtraPrivileges` to **false** (cell previews are `file://` — plan 057)
- `EnableCookieEncryption` (no cookie jar product)
- `strictlyRequireAllFuses` (breaks when Electron adds a fuse)

## Git workflow

- Branch: `advisor/052-electron-fuses`
- Message: `Disable RunAsNode and NODE_OPTIONS on packaged Electron builds.`
- Do not push unless asked.

## Steps

### Step 1: Wrapper with `afterComplete`

Add `scripts/package.js` that `import { packager } from '@electron/packager'` (packager 20 is ESM — use `scripts/package.mjs` or dynamic import from CJS). Pass the same options as today’s CLI: `overwrite`, `asar: { unpackDir: 'node_modules/ffmpeg-static' }` (or current unpack dir if 051 landed), `platform`, `arch`, `icon`, `prune`, `out: 'release-builds'`, Windows `win32metadata` for `package-win`.

`afterComplete`: resolve the Electron **executable** inside the output (darwin: `Tessel.app/Contents/MacOS/Tessel`; linux: `Tessel`; win32: `Tessel.exe` — match what packager actually emits; today the folder is `Tessel-${platform}-${arch}` before the CI rename). Call:

```javascript
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');

await flipFuses(executablePath, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: platform === 'darwin',
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
});
```

Keep `GrantFileProtocolExtraPrivileges` **true**. Darwin arm64 unsigned: `resetAdHocDarwinSignature: true` is required or the binary may fail to launch.

Point `package.json` scripts at `node scripts/package.mjs darwin arm64` etc. Preserve icon paths and win32metadata.

**Verify**: `node -e "require('fs').accessSync('scripts/package.mjs')"` or `.js` — file exists; `grep -n "flipFuses" scripts/package.mjs` → match

### Step 2: Package this OS and read fuses

Run the matching `npm run package-*`. Then `npx @electron/fuses read --app <output>`.

Confirm:

- `RunAsNode` disabled
- `EnableNodeOptionsEnvironmentVariable` disabled
- `OnlyLoadAppFromAsar` enabled

Launch the packaged app once (unpackaged `npm start` will still have default fuses — that is expected). Convert still finds ffmpeg in `app.asar.unpacked` (030). If the window does not open, STOP.

**Verify**: fuses read output as above; packaged app starts

### Step 3: Tests

`npm test` unchanged. Do not add a unit test that calls `flipFuses` on the repo’s `electron` binary (that would mutate the dev Electron).

**Verify**: `npm test` → exit 0

## Test plan

- Manual: packaged launch + `fuses read`.
- Pattern: existing packager flags moved faithfully into JS.
- CI already packs on version bump; this OS smoke is enough for the plan.

Verification: `npm test` → exit 0; fuses read on local package.

## Done criteria

- [ ] `npm test` exits 0
- [ ] All three package scripts go through the wrapper
- [ ] Local packaged app: `RunAsNode` off, `NODE_OPTIONS` fuse off
- [ ] `GrantFileProtocolExtraPrivileges` remains on
- [ ] Packaged ffmpeg still runs (asar unpack)
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row for 052 set to DONE

## STOP conditions

- Excerpts drifted.
- Packaged app fails to start after `OnlyLoadAppFromAsar` — report; do not “fix” by unpacking the whole app.
- You would flip fuses on the **dev** `electron` binary in `node_modules`.
- You would disable `GrantFileProtocolExtraPrivileges` to “be safer” (breaks 043 previews; 057 owns that question).
- Signed/notarized macOS work.

## Maintenance notes

- Reviewer: CI Windows/Linux packages should pick up the same wrapper; if `afterComplete` paths are OS-specific, test path construction with a comment and a tiny helper you can unit-test **without** flipping fuses.
- Electron 45+ may add fuses; do not set `strictlyRequireAllFuses`.
- Plan 051 may change `unpackDir`; rebase the packager options.
