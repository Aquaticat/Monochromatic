# Vmsync test implementation handover

## What's done

### Unit tests (45 tests, all passing)

- `src/config.unit.test.ts` -- `validateName`, `stripJsoncComments`, `vmDir`, `vmConfigPath`, `detectHypervisor`
- `src/boot.unit.test.ts` -- `parseMemoryToBytes` (exported for testing)
- `src/import.unit.test.ts` -- `nameFromPath` (exported for testing)

Run: `bun test ./packages/cli/vmsync/src/*.unit.test.ts`

### Linux lifecycle e2e test (passing)

`src/lifecycle.unit.test.ts` -- single sequential test with 24 assertions.
Named `.unit.test.ts` because `.e2e.test.ts` is reserved for Playwright in this monorepo.
Uses a single `test()` block because `bunfig.toml` sets `concurrentTestGlob = "**/*.test.ts"`.

Flow: creates Ubuntu VM via mvm, pushes tsdown bundle via virtiofs,
installs mise+bun inside guest, runs all vmsync subcommands.

Run: `mise run //packages/cli/vmsync:test:e2e`

### Windows lifecycle e2e test (written but not yet passing)

The Windows `describe` block is written in `lifecycle.unit.test.ts` but needs:

1. **mise in the Windows template** -- the current approach embeds `mise.exe` in the autounattend ISO,
   but the ISO9660 generator may not handle the ~15 MB binary well, and the guest agent timeout
   suggests the Windows installation itself may be affected.

2. **Simpler alternative: install mise at test runtime** -- since we're dropping winget,
   the Windows beforeAll should:
   - Create the VM (`mvm create vmsync-e2e-win --image windows`)
   - Push the vmsync bundle via virtiofs
   - Download and extract mise inside the guest via `mvm exec`:
     ```
     $ProgressPreference = 'SilentlyContinue'
     Invoke-WebRequest -Uri 'https://github.com/jdx/mise/releases/latest/download/mise-v<VERSION>-windows-x64.zip' -OutFile C:\mise.zip
     Expand-Archive C:\mise.zip -DestinationPath C:\mise -Force
     Copy-Item C:\mise\mise\bin\mise.exe C:\Users\Administrator\.local\bin\mise.exe
     ```
   - Use mise to install bun: `& C:\Users\Administrator\.local\bin\mise.exe use -g bun@latest`

   The version URL needs resolution (no `latest` shortcut; use GitHub API redirect).
   Or just use `gh release download` pattern.

3. **VirtioFsSvc drive mapping** -- the Windows test assumes virtiofs maps to `Z:\`.
   VirtioFsSvc maps virtiofs tags to drive letters. The tag is `mvm-shared`.
   Need to verify the actual drive letter after the template is rebuilt with the viofs driver.
   The viofs driver was added to `VIRTIO_DRIVER_DIRS` in `autounattend-virtio.ts`
   and VirtioFsSvc auto-start added as FirstLogonCommand Order 3.

## What changed in mvm

### virtiofs shared directory

- `domain-xml.ts`: added `sharedDir` param, `<filesystem>` + `<memoryBacking>` elements
- `cloud-init.ts`: auto-mounts `mvm-shared` at `/mnt/shared` via cloud-init `mounts` directive
- `create.ts` + `clone.ts`: create `shared/` directory per VM, pass to `domainXml`
- `config.ts`: added `SHARED_DIR_NAME`, `GUEST_MOUNT_POINT`, `WINDOWS_GUEST_MOUNT_POINT` constants

### push/pull CLI commands

- `file-transfer.ts`: `pushFile` (host copy to shared dir), `pullFile` (read from shared dir)
- `index-parsers-cmds.ts` + `index-parsers.ts`: added `pushCmd`, `pullCmd` parsers + union members
- `index.ts`: dispatch handlers for push/pull
- `package.json`: added `./file-transfer` export

Performance: 95 MB in ~90 ms via virtiofs (vs minutes via guest agent protocol).

### Windows template changes

- `autounattend-virtio.ts`: added `viofs` to `VIRTIO_DRIVER_DIRS`
- `autounattend.ts`: added VirtioFsSvc auto-start (Order 3), mise.exe copy from ISO (Order 5)
- `autounattend.ts`: `createAutounattendIso` accepts optional `miseBin` param
- `template-windows.ts`: downloads mise via `ensureMiseWindows`, passes to ISO creation
- `image.ts`: added `ensureMiseWindows` (downloads zip from GitHub, extracts via `unzip`)

**Status**: the mise-in-ISO approach caused a 40-minute guest agent timeout.
The ISO9660 generator may not handle the ~15 MB mise.exe.
**Recommended fix**: revert the mise-in-ISO changes and install mise at test runtime instead.

### What to revert for runtime-install approach

1. `autounattend.ts`: remove Order 5 (mise copy from ISO), remove `miseBin` param from `createAutounattendIso`
2. `template-windows.ts`: remove `ensureMiseWindows` call, `readFile`, `miseBin` plumbing
3. `image.ts`: can keep `ensureMiseWindows` (useful later) or remove if not needed
4. Keep: viofs driver addition, VirtioFsSvc auto-start -- these are independently correct

## Bug fix found

`import.ts` was missing `mkdir` for the VM directory before calling `qemu-img convert`.
Added `import { mkdir } from 'node:fs/promises'` and `await mkdir(dir, { recursive: true })`
before `convertSourceImage`. This is a real bug, not test-specific.

## Build setup

- `tsdown.node.config.ts`: bundles `@monochromatic-dev/*`, `@optique/*`, `nano-spawn`
- `mise.toml`: `build:js:node` task, `test:e2e` depends on it
- `package.json`: added `@monochromatic-dev/config-tsdown`, `find-up` as devDependencies

## Key files

| File | Purpose |
|------|---------|
| `packages/cli/vmsync/src/config.unit.test.ts` | Pure function unit tests |
| `packages/cli/vmsync/src/boot.unit.test.ts` | parseMemoryToBytes tests |
| `packages/cli/vmsync/src/import.unit.test.ts` | nameFromPath tests |
| `packages/cli/vmsync/src/lifecycle.unit.test.ts` | Linux + Windows e2e lifecycle |
| `packages/cli/vmsync/tsdown.node.config.ts` | Bundle config |
| `packages/cli/vmsync/mise.toml` | Task definitions |
| `packages/cli/mvm/src/file-transfer.ts` | virtiofs push/pull |
| `packages/cli/mvm/src/domain-xml.ts` | virtiofs XML generation |
| `packages/cli/mvm/src/autounattend-virtio.ts` | viofs driver addition |
