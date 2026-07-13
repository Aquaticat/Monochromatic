import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';
import { fileURLToPath, } from 'node:url';

import spawn from 'nano-spawn';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

/** Package root whose built publication artifact is staged. */
const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url,),);

/** Disposable external-consumer workspace. */
type ExternalConsumer = {
  readonly path: string;
  [Symbol.dispose]: () => void;
};

/**
 * Creates disposable workspace outside monorepo dependency ancestry.
 *
 * @returns disposable external-consumer workspace.
 */
function createExternalConsumer(): ExternalConsumer {
  /** Unique consumer directory under operating-system temporary root. */
  const path = mkdtempSync(join(tmpdir(), 'readonly-rule-consumer-',),);
  return {
    path,
    [Symbol.dispose]: function removeExternalConsumer(): void {
      rmSync(path, { recursive: true, force: true, },);
    },
  };
}

await describe({
  name: 'published no-restricted-syntax consumer',
  children: [
    it({
      name: 'loads packed rule and TypeScript 7 bridge outside monorepo',
      fn: async () => {
        using consumer = createExternalConsumer();
        /** Disposable publication workspace excluding development-only protocols. */
        const stagingRoot = join(consumer.path, 'staging',);
        /** Staged package directory. */
        const stagingPackage = join(stagingRoot, 'package',);
        mkdirSync(stagingPackage, { recursive: true, },);
        cpSync(
          join(PACKAGE_ROOT, 'dist',),
          join(stagingPackage, 'dist',),
          { recursive: true, },
        );
        /** Authored manifest narrowed to fields present for production consumers. */
        const sourceManifest = JSON.parse(readFileSync(
          join(PACKAGE_ROOT, 'package.json',),
          'utf8',
        ),) as Record<string, unknown>;
        writeFileSync(
          join(stagingPackage, 'package.json',),
          `${JSON.stringify({ ...sourceManifest, devDependencies: {}, }, null, 2,)}\n`,
        );
        writeFileSync(
          join(stagingRoot, 'pnpm-workspace.yaml',),
          "packages:\n  - 'package'\ncatalog:\n  '@oxlint/plugins': '>=1.73.0'\n  'typescript': '>=7.0.2'\n",
        );
        await spawn(
          'pnpm',
          ['pack', '--pack-destination', consumer.path,],
          { cwd: stagingPackage, },
        );
        /** Packed publication tarball produced by pnpm. */
        const tarballName = readdirSync(consumer.path,)
          .find(function packageTarball(fileName,): boolean {
            return fileName.includes('config-oxlint-no-restricted-syntax',)
              && fileName.endsWith('.tgz',);
          },);
        if (tarballName === undefined)
          throw new Error('Expected packed no-restricted-syntax tarball.',);
        /** Absolute tarball dependency path. */
        const tarballPath = join(consumer.path, tarballName,);
        writeFileSync(
          join(consumer.path, 'package.json',),
          `${JSON.stringify({
            name: 'readonly-rule-external-consumer',
            private: true,
            type: 'module',
            dependencies: {
              '@monochromatic-dev/config-oxlint-no-restricted-syntax': `file:${tarballPath}`,
            },
          }, null, 2,)}\n`,
        );
        await spawn(
          'pnpm',
          ['install', '--ignore-workspace',],
          { cwd: consumer.path, },
        );
        /** Consumer input loaded through local configured project. */
        const inputPath = resolve(consumer.path, 'input.ts',);
        /** Readonly source used to query packaged TypeScript bridge. */
        const inputSource = 'export function read(value: { readonly text: string; },): string { return value.text; }\n';
        writeFileSync(inputPath, inputSource,);
        writeFileSync(
          join(consumer.path, 'tsconfig.json',),
          '{"compilerOptions":{"strict":true},"include":["input.ts"]}\n',
        );
        /** Runtime probe imported only from installed publication artifact. */
        const probeSource = `import plugin, { closeSemanticBridge, openSemanticFile, } from '@monochromatic-dev/config-oxlint-no-restricted-syntax';\nimport { readFileSync, } from 'node:fs';\nimport { resolve, } from 'node:path';\nconst fileName = resolve('input.ts');\nconst sourceText = readFileSync(fileName, 'utf8');\nconst session = openSemanticFile({ fileName, sourceText, hasBOM: false });\nconst node = session.nodeAtOffset(sourceText.indexOf('value:'));\nconst type = session.checker.getTypeAtLocation(node);\nif (type === undefined) throw new Error('Expected external consumer type.');\nconsole.log(JSON.stringify({ hasRule: 'prefer-readonly-parameter-types' in plugin.rules, type: session.checker.typeToString(type) }));\ncloseSemanticBridge();\n`;
        const probePath = join(consumer.path, 'probe.mjs',);
        writeFileSync(probePath, probeSource,);
        const result = await spawn('node', [probePath,], { cwd: consumer.path, },);
        expect(result.stdout.trim(),).toBe(
          '{"hasRule":true,"type":"{ readonly text: string; }"}',
        );
        /** Installed package metadata proving runtime dependency availability. */
        const installedManifest = readFileSync(
          join(
            consumer.path,
            'node_modules/@monochromatic-dev/config-oxlint-no-restricted-syntax/package.json',
          ),
          'utf8',
        );
        expect(installedManifest.includes('"typescript"',),).toBe(true,);
      },
    },),
  ],
},);
