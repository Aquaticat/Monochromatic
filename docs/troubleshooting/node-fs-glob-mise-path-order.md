# `Node.js` v26.5.0 `fs.promises.glob()` preserves directory order, making generated mise PATH priority unstable

The root `mise.toml` materializes workspace `node_modules/.bin` directories with
`Node.js` v26.5.0 `fs.promises.glob()`.
The generator does not sort those matches before placing them in `_.path`.
The operating system chooses the directory-entry order,
 so a regenerated file can
change its text and `PATH` precedence even when the intended set of package bins
is unchanged.

## Symptom

`file-enforcer.config.ts` generates the root `mise.toml` `_.path` list from
workspace package bin directories.
A developer can see a diff that moves existing entries or resolves a duplicate
binary from a different workspace package after regeneration on another filesystem.

The current checkout does not show a run-to-run flake:
 twenty isolated
`mise env --json --locked --quiet` evaluations produced one distinct `PATH` value.
That is only a property of the current directory layout.
It does not establish a portable ordering contract.

## Root cause

### The repository serializes raw glob results

`file-enforcer.config.ts:616-621` collects `Node.js`'s async iterator,
 maps each match
straight to TOML,
 and joins the array without normalizing it:

```ts
// file-enforcer.config.ts
[
  'node_modules/.bin',
  ...(await Array.fromAsync(glob('packages/*/*/node_modules/.bin',),)),
]
  .map(function quote(dir,): string {
    return `  "${dir}"`;
  },)
  .join(',\n',)
```

The live configuration confirmed that relationship on 2026-07-11:
its forty-two configured paths were `node_modules/.bin` followed by the forty-one
raw glob matches in exactly the same order.
The raw list was not already in code-unit order.

### Node's glob implementation forwards directory entries without sorting

`nodejs/node@v26.5.0:lib/internal/fs/glob.js:210-217` fills its cache by calling
`readdir()` and retains that result as-is:

```js
// lib/internal/fs/glob.js
async readdir(path) {
  const cached = this.#readdirCache.get(path);
  if (cached) {
    return cached;
  }
  const promise = PromisePrototypeThen(readdir(path, { __proto__: null, withFileTypes: true }), null, () => []);
  this.#readdirCache.set(path, promise);
  return promise;
}
```

`nodejs/node@v26.5.0:lib/internal/fs/glob.js:779-783` obtains that array and
iterates it by index,
 with no intervening sort:

```js
// lib/internal/fs/glob.js
children = await this.#cache.readdir(fullpath);

for (let i = 0; i < children.length; i++) {
  const entry = children[i];
```

`Node.js` documentation says this source order is not stable:
`nodejs/node@v26.5.0:doc/api/fs.md:7225-7228` states:

```md
Directory entries returned by this function are in no particular order as
provided by the operating system's underlying directory mechanisms.
Entries added or removed while iterating over the directory might not be
included in the iteration results.
```

Mise preserves the TOML array's sequence when it constructs `PATH`.
In the isolated evaluation,
 its first package paths appeared in the same sequence
as `_.path`,
 after conversion to absolute paths.
Therefore the unsorted generator result reaches command resolution directly.

## Verification

Versions under test:

- `Node.js` `v26.5.0`
- mise `2026.7.0`,
   Linux x64
- `nodejs/node` tag `v26.5.0`,
   commit `bebd1b8d92bf4cc917844d6335ed1ecf9c2a75fb`

Use a disposable worktree,
 then create directories in a deliberately non-lexical
sequence and compare the raw result with a normalized copy:

```sh
# repository root
git worktree add --detach /var/home/user/temp/mise-path-order-check HEAD
cd /var/home/user/temp/mise-path-order-check
node --input-type=module-typescript -e 'import { glob, mkdir } from "node:fs/promises"; const base = ".mise-path-order-fixture"; const entries = ["zebra/second", "amber/third", "quartz/first", "birch/fourth"]; for (const entry of entries) await mkdir(`${base}/packages/${entry}/node_modules/.bin`, { recursive: true }); const raw = await Array.fromAsync(glob(`${base}/packages/*/*/node_modules/.bin`)); console.log(JSON.stringify({ raw, sorted: [...raw].sort() }));'
```

The checked result has these catalogs:

- Works cleanly:
   a literal `_.path` list stays in its declared order;
  `mise env --json` preserved that sequence in each isolated evaluation.
- Works cleanly:
   sorting a copy of the fixture output yields
  `amber`,
   `birch`,
   `quartz`,
   then `zebra`.
- Fails determinism:
   the raw fixture output was `zebra`,
   `quartz`,
   `birch`,
   then
  `amber`,
   which differs from the normalized order.
- Fails determinism:
   the production generator serializes raw results,
   so its
  result depends on the backing filesystem's directory enumeration.

Remove the disposable worktree after the check:

```sh
# repository root
git worktree remove /var/home/user/temp/mise-path-order-check
```

## Verified workaround

Sort the package paths before assembling the TOML array in
`file-enforcer.config.ts`:

```ts
const packageBinDirectories = (await Array.fromAsync(
  glob('packages/*/*/node_modules/.bin',),
)).sort();

const pathDirectories = [
  'node_modules/.bin',
  ...packageBinDirectories,
];
```

This makes the generated content and the derived `PATH` order reproducible for a
given set of package directories.
The semantic tradeoff is intentional:
 it changes precedence for two workspace
packages that expose the same executable,
 because command lookup uses the first
matching directory in `PATH`.
The current configuration is intentionally not changed by this diagnosis.

## What does not work

- Re-running the generator on one machine does not prove portability.
  The isolated mise evaluation was stable across twenty runs because its directory
  entries did not change,
   but `Node.js` explicitly leaves their order to the filesystem.
- Sorting only generated `mise.toml` is not durable.
  `file-enforcer.config.ts` owns the generated `_.path` section and overwrites it
  during the next synchronization.
- Filing this as a `Node.js` defect would misidentify the cause.
  `Node.js` preserves native directory enumeration;
   this repository decides to give
  those results semantic `PATH` priority without sorting them.

## Upstream filing decision

The `.out-of-scope/` search found no `Node.js` glob-order exemption.
A duplicate search on 2026-07-11 returned no issues or pull requests for either
`"fs.glob" order` or `glob deterministic` in `nodejs/node`.
There is nothing additive to post.

The filing gate is still not met:

1. Upstream fault:
   no. `Node.js` exposes underlying directory order;
   the repository omits the normalization required for a stable generated file.
2. Upstream fixability:
   technically yes,
   but a global sort would be a behavior change rather than a repair of a `Node.js` defect.
3. Supported use case:
   no documented `Node.js` guarantee covers deterministic glob ordering for generated configuration.
4. Contribution welcome:
   `nodejs/node@v26.5.0:CONTRIBUTING.md` welcomes contributions,
   but it requires explicit authorization before external automation interacts with the project.
   No such authorization exists for this diagnosis.
5. Likely upstream resolution:
   no basis exists to expect a change to documented native-order behavior.
6. Compatible upstream prototype:
   no. The first constraint fails,
   so the consumer-side sort is the appropriate and complete remedy.

No issue,
 comment,
 or pull request draft is retained.
Do not file an upstream report as-is.
