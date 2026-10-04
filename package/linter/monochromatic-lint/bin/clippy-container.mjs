// Check the already tested snapshot, with a read-only compiler and bounded container resources.
import { spawnSync } from 'node:child_process'
const toolchain = spawnSync('rustc', ['--print', 'sysroot'], { encoding: 'utf8' })
if (toolchain.error) throw toolchain.error
if (toolchain.status !== 0) throw new Error(toolchain.stderr)
const root = toolchain.stdout.trim()
const child = spawnSync('podman', [
  'run', '--rm', '--init', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=128',
  '--security-opt', 'label=disable', '--volume', `${root}:/toolchain:ro`,
  '--env', 'PATH=/toolchain/bin:/usr/local/cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  '--env', 'RUSTC=/toolchain/bin/rustc', '--env', 'RUSTDOC=/toolchain/bin/rustdoc',
  'localhost/monochromatic-lint-test:development',
  '/toolchain/bin/cargo', 'clippy', '--offline', '--locked', '--all-targets', '--', '-D', 'warnings',
], { stdio: 'inherit' })
if (child.error) throw child.error
if (child.status !== 0) throw new Error(`Container Clippy failed: ${child.status}`)
