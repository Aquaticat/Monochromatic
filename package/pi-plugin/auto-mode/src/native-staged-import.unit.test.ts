/**
 Built native staging erases types and replaces only verified original import declarations.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { parse } from 'yuku-parser';
import { nativeReturnFailure } from './native-return-test-fixture.ts';
import { stagedImport, stagedImportFixture } from './native-staged-import-fixture.ts';

//region Staging preserves original source roles and filesystem identity

await describe({
  name: '',
  children: [
    it({
      name: 'erases TypeScript annotations before rebasing executable imports',
      fn: async function typedSource() {
        /** Type-only imports disappear before executable dependency selection. */
        const source = [
          'import type { Missing } from "./types-that-do-not-exist.ts";',
          'import { run } from "./dependency.mjs";',
          'const text: string = "import { run } from \\\"./decoy.mjs\\\";";',
          'export function value(input: Missing): string { return text + String(run()); }',
        ].join('\n');
        /** Only executable dependencies need real filesystem entries. */
        const fixture = await stagedImportFixture({ source, extension: '.ts' });
        /** The output must be ordinary JavaScript before generated consumption. */
        const output = await stagedImport.readStagedInput(fixture.sourceUrl);
        expect(parse(output, { sourceType: 'module' }).diagnostics).toEqual([]);
        expect(output).not.toContain('types-that-do-not-exist');
        expect(output).toContain(fixture.dependencyUrl.href);
        expect(output).toContain('./decoy.mjs');
        expect(output).not.toContain('input: Missing');
        /** Parsed replacement accepts formatted imports without changing unrelated source. */
        const replaced = await stagedImport.replaceStagedImport({ source: output, binding: 'run', expected: fixture.dependencyUrl, replacement: 'file:///generated/dependency.mjs' });
        expect(replaced).toBe(output.replace(JSON.stringify(fixture.dependencyUrl.href), '"file:///generated/dependency.mjs"'));
      },
    }),
    it({
      name: 'preserves JavaScript bytes except original relative static module literals',
      fn: async function javascriptSource() {
        /** Dynamic relative expressions retain the original established staging behavior. */
        const source = 'import {run} from "./dependency.mjs";\nexport const later = () => import("./dynamic.mjs");\n';
        /** Real source files provide the original relative base. */
        const fixture = await stagedImportFixture({ source });
        expect(await stagedImport.readStagedInput(fixture.sourceUrl)).toBe(source.replace('"./dependency.mjs"', JSON.stringify(fixture.dependencyUrl.href)));
      },
    }),
    ...['formatted', 'escaped', 'symlink'].map(function supportedImport(kind) {
      return it({
        name: `replaces the original ${kind} import while preserving comment and string decoys`,
        fn: async function parsedImport() {
          /** Each case resolves against actual disposable file identities. */
          const fixture = await stagedImportFixture({ source: 'export {};' });
          /** The parser owns identifier decoding and whitespace recognition. */
          const declaration = kind === 'escaped' ? String.raw`import { r\u0075n } from ` : 'import {\n run,\n} from ';
          /** Symlinks are accepted only when realpath reaches the expected original file. */
          const original = kind === 'symlink' ? fixture.aliasUrl : fixture.dependencyUrl;
          /** Comment and string lookalikes are never import candidates. */
          const source = `// import {run} from "file:///decoy.mjs";\nconst text = 'import {run} from "file:///decoy.mjs";';\n${declaration}${JSON.stringify(original.href)};\n`;
          /** Quotes, escapes, and separators must remain one module literal. */
          const replacement = 'file:///generated/quote"\\line\n;globalThis.injected=true;//';
          /** The original parsed named import and original file are both required. */
          const output = await stagedImport.replaceStagedImport({ source, binding: 'run', expected: fixture.dependencyUrl, replacement });
          expect(output).toBe(source.replace(JSON.stringify(original.href), JSON.stringify(replacement)));
          /** Reparsing proves the replacement cannot create executable statements. */
          const parsed = parse(output, { sourceType: 'module' });
          expect(parsed.diagnostics).toEqual([]);
          expect(parsed.program.body.length).toBe(2);
          expect(parsed.program.body[1]).toHaveProperty('source.value', replacement);
        },
      });
    }),
    ...['foreign-file', 'query', 'fragment', 'alias-binding', 'different-import', 'side-effect', 'multiple-bindings', 'duplicate', 'invalid'].map(function rejectedImport(kind) {
      return it({
        name: `rejects ${kind} before selecting a generated dependency`,
        fn: async function unownedImport() {
          /** Equal foreign bytes and separate URL identities remain rejected. */
          const fixture = await stagedImportFixture({ source: 'export {};' });
          /** Sources isolate one rejected import property at a time. */
          const sources: Readonly<Record<string, string>> = {
            'foreign-file': `import {run} from ${JSON.stringify(fixture.foreignUrl.href)};`,
            query: `import {run} from ${JSON.stringify(`${fixture.dependencyUrl.href}?other`)};`,
            fragment: `import {run} from ${JSON.stringify(`${fixture.dependencyUrl.href}#other`)};`,
            'alias-binding': `import {run as other} from ${JSON.stringify(fixture.dependencyUrl.href)};`,
            'different-import': `import {other as run} from ${JSON.stringify(fixture.dependencyUrl.href)};`,
            'side-effect': `import ${JSON.stringify(fixture.dependencyUrl.href)};`,
            'multiple-bindings': `import {run, other} from ${JSON.stringify(fixture.dependencyUrl.href)};`,
            duplicate: `import {run} from ${JSON.stringify(fixture.dependencyUrl.href)};\nimport {run} from ${JSON.stringify(fixture.dependencyUrl.href)};`,
            invalid: 'import {',
          };
          /** A missing fixture key must not masquerade as the intended rejection. */
          const source = sources[kind];
          if (source === undefined) throw new Error('Missing staged-import rejection input');
          expect(await nativeReturnFailure(function replace() {
            return stagedImport.replaceStagedImport({ source, binding: 'run', expected: fixture.dependencyUrl, replacement: 'file:///generated/dependency.mjs' });
          })).toBeInstanceOf(stagedImport.StagedImportError);
        },
      });
    }),
  ],
});

//endregion Staging preserves original source roles and filesystem identity
