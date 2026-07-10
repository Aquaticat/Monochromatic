/** Patch destination-grammar boundary tests. @module */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type { PolicyPatch, } from '../api/policy-types.ts';
import { validatePolicyPatch, } from './commit-transaction-patch.ts';

/** Text encoder shared by immutable fixtures. */
const ENCODER = new TextEncoder();

/**
 * Creates fixture policy patch.
 *
 * @param path - declared target path
 *
 * @param text - exact patch grammar
 *
 * @returns policy patch fixture
 */
function createPatch({ path = 'file.txt', text, }: Readonly<{
  path?: string;
  text: string;
}>,): PolicyPatch {
  return {
    kind: 'git-unified',
    targetId: 'target',
    path,
    bytes: ENCODER.encode(text,),
  };
}

/** Valid single-path text patch. */
const VALID_PATCH = `diff --git a/file.txt b/file.txt
index 1111111..2222222 100644
--- a/file.txt
+++ b/file.txt
@@ -1 +1 @@
-old
+new
`;

await describe({
  name: validatePolicyPatch.name,
  children: [
    it({
      name: 'accepts one declared ordinary text target',
      fn: async function testValidPatch(): Promise<void> {
        expect(function validate(): void {
          validatePolicyPatch({
            patch: createPatch({ text: VALID_PATCH, }),
            expectedRevision: '1111111',
          },);
        },).not.toThrow();
      },
    },),
    ...[
      {
        name: 'second target delimiter',
        text: `${VALID_PATCH}diff --git a/other.txt b/other.txt
--- a/other.txt
+++ b/other.txt
`,
      },
      {
        name: 'stale index base',
        text: VALID_PATCH.replace('index 1111111..', 'index aaaaaaa..',),
      },
      {
        name: 'mismatched old path',
        text: VALID_PATCH.replace('--- a/file.txt', '--- a/other.txt',),
      },
      {
        name: 'rename directive',
        text: VALID_PATCH.replace('index 1111111..2222222 100644', 'rename from file.txt\nrename to other.txt',),
      },
      {
        name: 'binary directive',
        text: VALID_PATCH.replace('@@ -1 +1 @@', 'GIT binary patch',),
      },
      {
        name: 'mode directive',
        text: VALID_PATCH.replace('index 1111111..2222222 100644', 'old mode 100644\nnew mode 100755',),
      },
      {
        name: 'submodule mode',
        text: VALID_PATCH.replace('100644', '160000',),
      },
    ].map(function invalidCase(fixture,) {
      return it({
        name: `rejects ${fixture.name}`,
        fn: async function testInvalidPatch(): Promise<void> {
          expect(function validate(): void {
            validatePolicyPatch({
              patch: createPatch({ text: fixture.text, }),
              expectedRevision: '1111111',
            },);
          },).toThrow();
        },
      },);
    },),
    it({
      name: 'rejects traversal in declared path',
      fn: async function testPathTraversal(): Promise<void> {
        expect(function validate(): void {
          validatePolicyPatch({
            patch: createPatch({
              path: '../outside.txt',
              text: VALID_PATCH
                .replaceAll('file.txt', '../outside.txt',),
            },),
            expectedRevision: '1111111',
          },);
        },).toThrow();
      },
    },),
    it({
      name: 'rejects line delimiter in declared path',
      fn: async function testPathDelimiter(): Promise<void> {
        expect(function validate(): void {
          validatePolicyPatch({
            patch: createPatch({ path: 'file.txt\nother.txt', text: VALID_PATCH, }),
            expectedRevision: '1111111',
          },);
        },).toThrow();
      },
    },),
  ],
},);
