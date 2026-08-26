# Plan 012: Set Windows packager metadata to Tessel

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b558cb8..HEAD -- package.json`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `b558cb8`, 2026-08-26

## Why this matters

`package-win` sets `--win32metadata.CompanyName=CE` and `--win32metadata.FileDescription=CE` while `productName` / `--win32metadata.ProductName` are Tessel and `author` is James Sorbello. Windows Explorer, Task Manager, and file Properties show publisher **CE** on CI-produced `tessel-windows-x64` builds.

## Current state

`package.json` line 11 (single long script):

```
--win32metadata.CompanyName=CE --win32metadata.FileDescription=CE --win32metadata.ProductName="Tessel"
```

`"author": "James Sorbello"`, `"productName": "Tessel"`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| No CE publisher | `grep -n "CompanyName=CE\\|FileDescription=CE" package.json` | no matches |

## Scope

**In scope**: `package.json` `package-win` script only

**Out of scope**: Code signing, changing `author`, Linux/mac metadata, running `npm run package-win` unless you are on Windows and the operator asked

## Git workflow

- Branch: `advisor/012-windows-packager-metadata`
- Message: `Set Windows packager company metadata to Tessel.`
- Do not push unless asked.

## Steps

### Step 1: Replace CE

Set:

- `CompanyName=Tessel` or `CompanyName="James Sorbello"` (prefer **Tessel** to match ProductName)
- `FileDescription=Tessel` or `FileDescription="Desktop app for creating mosaic videos"` matching `package.json` `"description"`

Keep `ProductName="Tessel"` and the rest of the packager flags (`--overwrite --no-asar` etc.) unchanged (asar is plan 016).

**Verify**: `grep -n "win32metadata.CompanyName=CE" package.json` → no matches; `grep -n "win32metadata.CompanyName=" package.json` → Tessel or James Sorbello

## Test plan

- Script string grep only. Optional: `npm run package-win` on Windows and check Properties.

## Done criteria

- [ ] No `CompanyName=CE` or `FileDescription=CE`
- [ ] ProductName still Tessel
- [ ] `plans/README.md` 012 DONE

## STOP conditions

- Packager 20 renamed the flag — check `@electron/packager` docs; do not leave CE in place.

## Maintenance notes

- Next Windows CI artifact is the real check.
- Reviewer: quotes around values with spaces must match how `package-linux`/`package-mac` are written.
