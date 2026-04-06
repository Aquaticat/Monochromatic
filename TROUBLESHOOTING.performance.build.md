# Build Performance Troubleshooting

## Build system performance optimizations

### Prepare Optimization - 2025-06-16

#### Problem

`mise run prepare` taking 50+ seconds due to slow command executions in WSL.

#### Root Causes

1. WSL file system overhead when executing binaries from `/mnt/c/`
2. `pnpm exec` commands taking ~27s each in WSL
3. Unnecessary command executions when simple file checks would suffice

#### Solutions Implemented

##### 1. Created TypeScript scripts to replace shell commands

- File system checks instead of running binary commands
- Auto-decline pnpm reinstall prompt
- Check if packages exist before syncing
- Unified cross-platform installation scripts

##### 2. Key optimizations

- Use file system checks instead of executing binaries
- Use native OS commands (`which`, `where.exe`) for existence checks
- Add PATH updates to `~/.profile` for snap binaries

##### 3. Results

- **Before**: 50+ seconds
- **After**: 1.54 seconds (97% improvement)
- All bun TypeScript scripts consistently take ~80-100ms
- Actual work (file checks) takes <10ms per script

#### Key Takeaway

In WSL environments, avoid executing binaries when file system checks suffice. The overhead of process creation and file system translation can turn millisecond operations into 30-second waits.
