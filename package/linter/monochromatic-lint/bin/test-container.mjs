// Run the full suite by default, or one explicitly named slice in the same isolated source snapshot.
import { mkdir, mkdtemp, cp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
const [filter, ...extra] = process.argv.slice(2)
if (extra.length !== 0) throw new Error('Expected at most one Cargo test-name filter')
const context = await mkdtemp(join(tmpdir(), 'monochromatic-lint-test-'))
const source = process.cwd()
try {
  for (const name of ['Cargo.toml', 'Cargo.lock', 'src', 'fixtures']) {
    await cp(join(source, name), join(context, 'monochromatic-lint', name), { recursive: true })
    await cp(resolve(source, '../../rust-module/jsonc-edit', name), join(context, 'jsonc-edit', name), { recursive: true })
  }
  const vendorPath = join(context, 'vendor')
  const vendor = spawnSync('cargo', ['vendor', '--locked', '--offline', '--versioned-dirs', vendorPath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
  if (vendor.error) throw vendor.error
  if (vendor.status !== 0) throw new Error(`Cargo vendor failed: ${vendor.stderr}`)
  const config = vendor.stdout.replaceAll(JSON.stringify(vendorPath), '\"/work/vendor\"')
  if (!config.includes('directory = \"/work/vendor\"')) throw new Error('Cargo vendor did not emit the expected source mapping')
  await mkdir(join(context, 'cargo-config'), { recursive: true })
  await writeFile(join(context, 'cargo-config/config.toml'), config)
  await cp(join(source, 'test.Containerfile'), join(context, 'Containerfile'))
  const build = spawnSync('podman', ['build', '--network=none', '--http-proxy=false', '--pull=never', '--memory=2g', '--cpu-period=100000', '--cpu-quota=200000', '--tag', 'localhost/monochromatic-lint-test:development', context], { stdio: 'inherit' })
  if (build.error) throw build.error
  if (build.status !== 0) throw new Error(`Container build failed: ${build.status}`)
  const arguments_ = ['run', '--rm', '--init', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=128', 'localhost/monochromatic-lint-test:development']
  if (filter !== undefined) arguments_.push('cargo', 'test', '--offline', '--locked', '--all-targets', filter)
  const run = spawnSync('podman', arguments_, { stdio: 'inherit' })
  if (run.error) throw run.error
  if (run.status !== 0) throw new Error(`Container test failed: ${run.status}`)
} finally {
  await rm(context, { recursive: true, force: true })
}
