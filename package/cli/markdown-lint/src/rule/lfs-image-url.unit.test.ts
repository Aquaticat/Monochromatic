import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  applyFixes,
  type Diagnostic,
  type LfsImageContext,
  type LfsImageTarget,
  rulesById,
  runRules,
} from '@monochromatic-dev/cli-markdown-lint';

/**
 Rule under test, looked up through the built registry.
 */
const lfsImageUrl = nonNullishOrThrow(rulesById.get('lfs-image-url',),);

/**
 Object base the fake repository declares.
 */
const BASE = 'https://lfs.example';

/**
 Repository root of the fake repository.
 */
const ROOT = '/repo';

/**
 File under lint, two directories below the root.
 */
const FILE = `${ROOT}/package/player/README.md`;

/**
 Current oid of the tracked gallery image.
 */
const CURRENT_OID = 'a'.repeat(64,);

/**
 An oid that no longer matches the gallery image.
 */
const STALE_OID = 'b'.repeat(64,);

/**
 Repo-relative path of the tracked gallery image.
 */
const GALLERY = 'package/player/asset/readme/shot.png';

/**
 Repo-relative path of an ordinary (non-LFS) image.
 */
const PLAIN = 'package/player/asset/readme/plain.svg';

/**
 Fake resolver: one tracked image, one plain image, everything else missing.

 @param repoRelativePath - path queried by the rule

 @returns target kind for the fixture
 */
function resolveTarget(repoRelativePath: string,): LfsImageTarget {
  if (repoRelativePath === GALLERY) {
    return {
      kind: 'lfs',
      oid: CURRENT_OID,
    };
  }
  if (repoRelativePath === PLAIN) {
    return { kind: 'plain', };
  }
  return { kind: 'missing', };
}

/**
 Per-file context for the fixture repository.
 */
const lfs: LfsImageContext = {
  filePath: FILE,
  repoRoot: ROOT,
  objectBase: BASE,
  resolveTarget,
};

/**
 Object URL the rule should produce for the gallery image.
 */
const GALLERY_URL = `${BASE}/${CURRENT_OID}/${GALLERY}`;

/**
 Run only the rule over Markdown source with the fixture context.

 @param source - Markdown source

 @param mdx - whether to parse as MDX

 @returns diagnostics from the rule
 */
function lint(
  source: string,
  mdx = false,
): readonly Diagnostic[] {
  return runRules({
    rules: [lfsImageUrl,],
    source,
    mdx,
    lfs,
  },);
}

/**
 Run the rule and apply its fixes once.

 @param source - Markdown source

 @returns fixed source
 */
function fix(source: string,): string {
  return applyFixes({
    source,
    diagnostics: lint(source,),
  },);
}

await describe({
  name: 'lfs-image-url',
  children: [
    it({
      name: 'is inert without a per-file context',
      fn: async function inert() {
        expect(runRules({
          rules: [lfsImageUrl,],
          source: '![shot](asset/readme/shot.png)\n',
          mdx: false,
        },).length,).toBe(0,);
      },
    },),
    it({
      name: 'rewrites a relative image whose target is LFS-tracked',
      fn: async function rewrite() {
        expect(fix('![Wide desktop](asset/readme/shot.png)\n',),).toBe(`![Wide desktop](${GALLERY_URL})\n`,);
      },
    },),
    it({
      name: 'keeps the title when rewriting',
      fn: async function title() {
        expect(fix('![shot](asset/readme/shot.png "Desktop")\n',),).toBe(`![shot](${GALLERY_URL} "Desktop")\n`,);
      },
    },),
    it({
      name: 'rewrites an angle-bracketed destination',
      fn: async function angle() {
        expect(fix('![shot](<asset/readme/shot.png>)\n',),).toBe(`![shot](<${GALLERY_URL}>)\n`,);
      },
    },),
    it({
      name: 'resolves dot segments and drops query and fragment before resolving',
      fn: async function dots() {
        expect(fix('![shot](./asset/../asset/readme/shot.png?v=2#top)\n',),).toBe(`![shot](${GALLERY_URL})\n`,);
      },
    },),
    it({
      name: 'leaves a relative image whose target is not LFS-tracked',
      fn: async function plain() {
        expect(lint('![plain](asset/readme/plain.svg)\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'leaves a relative image whose target is missing',
      fn: async function missing() {
        expect(lint('![gone](asset/readme/gone.png)\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'leaves external, site-absolute, and fragment destinations',
      fn: async function external() {
        expect(lint('![a](https://example.com/a.png)\n![b](/a.png)\n![c](#a)\n![d](data:image/png;base64,AA==)\n',).length,)
          .toBe(0,);
      },
    },),
    it({
      name: 'leaves a relative image that escapes the repository root',
      fn: async function escapes() {
        expect(lint('![up](../../../outside/shot.png)\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'accepts an object URL whose oid matches',
      fn: async function current() {
        expect(lint(`![shot](${GALLERY_URL})\n`,).length,).toBe(0,);
      },
    },),
    it({
      name: 'refreshes a stale oid in an object URL',
      fn: async function stale() {
        expect(fix(`![shot](${BASE}/${STALE_OID}/${GALLERY})\n`,),).toBe(`![shot](${GALLERY_URL})\n`,);
      },
    },),
    it({
      name: 'reports an object URL whose path no longer exists, without a fix',
      fn: async function gone() {
        /**
         Diagnostics for a vanished target.
         */
        const diagnostics = lint(`![shot](${BASE}/${CURRENT_OID}/package/player/asset/readme/gone.png)\n`,);
        expect(diagnostics.length,).toBe(1,);
        expect(diagnostics[0]?.fix,).toBeUndefined();
        expect(diagnostics[0]?.message,).toContain('no longer exists',);
      },
    },),
    it({
      name: 'turns an object URL back into a relative link when the target left LFS',
      fn: async function untracked() {
        expect(fix(`![plain](${BASE}/${CURRENT_OID}/${PLAIN})\n`,),).toBe('![plain](asset/readme/plain.svg)\n',);
      },
    },),
    it({
      name: 'ignores an object URL without a path segment',
      fn: async function bare() {
        expect(lint(`![shot](${BASE}/${CURRENT_OID})\n`,).length,).toBe(0,);
      },
    },),
    it({
      name: 'rewrites a reference definition that an image reference uses',
      fn: async function definition() {
        expect(fix('![shot][gallery]\n\n[gallery]: asset/readme/shot.png\n',),)
          .toBe(`![shot][gallery]\n\n[gallery]: ${GALLERY_URL}\n`,);
      },
    },),
    it({
      name: 'leaves a reference definition that only links use',
      fn: async function linkOnly() {
        expect(lint('[download][gallery]\n\n[gallery]: asset/readme/shot.png\n',).length,).toBe(0,);
      },
    },),
    it({
      name: 'rewrites inside MDX documents',
      fn: async function mdx() {
        /**
         Diagnostics for an MDX file with a relative LFS image.
         */
        const diagnostics = lint('import X from "./x";\n\n![shot](asset/readme/shot.png)\n', true,);
        expect(diagnostics.length,).toBe(1,);
        expect(diagnostics[0]?.fix?.insertText,).toBe(GALLERY_URL,);
      },
    },),
    it({
      name: 'anchors the diagnostic at the image',
      fn: async function anchor() {
        /**
         Diagnostics for an image on the third line.
         */
        const diagnostics = lint('# Title\n\nSee ![shot](asset/readme/shot.png) here.\n',);
        expect(diagnostics[0]?.line,).toBe(3,);
        expect(diagnostics[0]?.column,).toBe(5,);
        expect(diagnostics[0]?.ruleId,).toBe('lfs-image-url',);
      },
    },),
    it({
      name: 'is idempotent after one fix pass',
      fn: async function idempotent() {
        /**
         Source after the first pass.
         */
        const once = fix('![shot](asset/readme/shot.png)\n',);
        expect(fix(once,),).toBe(once,);
        expect(lint(once,).length,).toBe(0,);
      },
    },),
  ],
},);
