import { execFileSync, } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync, } from 'node:fs';
import { createRequire, } from 'node:module';
import { homedir, } from 'node:os';
import { basename, dirname, join, } from 'node:path';

//region Qualified upstream source is a build input, never an installed source edit.

/** Native source transformations are verified against this exact release commit. */
const qualifiedRelease = { version: '1.1.0', commit: 'abe508e1b89912adde45528136c3221eb69acdd7', } as const;

/** Reject source or dependency drift before generating a native host. */
export class NativeSourceBuildError extends Error {}

/** Read the declared version before admitting a source package. */
function packageVersion(directory: string): string {
  const metadata: unknown = JSON.parse(readFileSync(join(directory, 'package.json',), 'utf8',),);
  if (typeof metadata !== 'object' || metadata === null || !('version' in metadata)
    || typeof metadata.version !== 'string') {
    throw new NativeSourceBuildError(`Package version is unavailable: ${directory}`,);
  }
  return metadata.version;
}

/** Retain the source checkout as a read-only build input after validating its immutable revision. */
function sourceCheckout(packageRoot: string): string {
  const scratch = join(homedir(), 'temp/agent',);
  mkdirSync(scratch, { recursive: true, mode: 0o700, },);
  const sourceRoot = process.env.PI_AUTO_MODE_SOURCE ?? join(scratch, `auto-mode-pi-source-${qualifiedRelease.version}`,);
  if (!existsSync(sourceRoot,)) {
    execFileSync('gh', ['repo', 'clone', 'earendil-works/pi', sourceRoot, '--', '--depth', '1',
      '--branch', `v${qualifiedRelease.version}`,], { cwd: packageRoot, stdio: 'inherit', },);
  }
  const commit = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD',], { encoding: 'utf8', },).trim();
  if (commit !== qualifiedRelease.commit)
    throw new NativeSourceBuildError(`Pi source revision differs from the qualified release: ${commit}`,);
  return sourceRoot;
}

/** Copy non-TypeScript assets alongside emitted modules without replacing emitted JavaScript. */
function copyAssets({ source, target, }: { source: string; target: string; }): void {
  const pending = [{ source, target, },];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) throw new NativeSourceBuildError('Asset traversal lost its pending directory',);
    mkdirSync(current.target, { recursive: true, },);
    for (const item of readdirSync(current.source, { withFileTypes: true, },)) {
      const sourcePath = join(current.source, item.name,), targetPath = join(current.target, item.name,);
      if (item.isDirectory()) pending.push({ source: sourcePath, target: targetPath, },);
      else if (!item.name.endsWith('.ts',)) cpSync(sourcePath, targetPath,);
    }
  }
}

/** Emit the upstream module graph with the installed compiler and matching release dependencies. */
export function buildPiSource({ packageRoot, output, }: { packageRoot: string; output: string; }): void {
  const installedSdk = realpathSync(join(packageRoot, 'node_modules/@earendil-works/pi-coding-agent',),);
  if (packageVersion(installedSdk,) !== qualifiedRelease.version)
    throw new NativeSourceBuildError('Installed Pi differs from the qualified native source release',);
  const sourceRoot = sourceCheckout(packageRoot,);
  const require = createRequire(join(packageRoot, 'package.json',),);
  const compilerMetadata = require.resolve('typescript/package.json',);
  const compiler = join(dirname(compilerMetadata,), 'bin/tsc',);
  const specifications = [
    { folder: 'agent', name: '@earendil-works/pi-agent-core', },
    { folder: 'ai', name: '@earendil-works/pi-ai', },
    { folder: 'coding-agent', name: '@earendil-works/pi-coding-agent', },
  ];
  for (const specification of specifications) {
    const installed = realpathSync(join(dirname(installedSdk,), basename(specification.name,),),);
    const upstream = join(sourceRoot, 'packages', specification.folder,);
    if (packageVersion(upstream,) !== packageVersion(installed,))
      throw new NativeSourceBuildError(`Source and installed package versions differ: ${specification.name}`,);
    const target = join(output, 'pi', specification.folder,);
    mkdirSync(target, { recursive: true, },);
    cpSync(join(upstream, 'src',), join(target, 'src',), { recursive: true, },);
    cpSync(join(upstream, 'package.json',), join(target, 'package.json',),);
    const dependencyDirectory = join(target, 'node_modules',);
    if (!existsSync(dependencyDirectory,)) symlinkSync(dirname(dirname(installed,),), dependencyDirectory, 'dir',);
    const configuration = join(target, 'tsconfig.stage.json',);
    writeFileSync(configuration, JSON.stringify({
      compilerOptions: {
        target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', rootDir: 'src', outDir: 'dist',
        noCheck: true, noResolve: true, declaration: false, sourceMap: false, verbatimModuleSyntax: true,
        rewriteRelativeImportExtensions: true, resolveJsonModule: true, skipLibCheck: true, types: [],
      },
      include: ['src/**/*.ts',], exclude: ['src/experimental',],
    }, null, 2,),);
    execFileSync(process.execPath, [compiler, '--project', configuration,], { cwd: packageRoot, stdio: 'inherit', },);
    copyAssets({ source: join(target, 'src',), target: join(target, 'dist',), },);
    if (specification.folder === 'ai')
      cpSync(join(installed, 'dist/providers/data',), join(target, 'dist/providers/data',), { recursive: true, },);
    console.log(JSON.stringify({ emitted: specification.name, version: qualifiedRelease.version, },),);
  }
  cpSync(join(sourceRoot, 'LICENSE',), join(output, 'PI-LICENSE.txt',),);
  writeFileSync(join(output, 'source-manifest.json',), JSON.stringify({
    ...qualifiedRelease, compilerVersion: packageVersion(dirname(compilerMetadata,),),
  }, null, 2,),);
}

//endregion
