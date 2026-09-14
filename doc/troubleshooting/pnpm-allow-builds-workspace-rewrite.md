# pnpm 11.21.0 aborts the install with ERR_PNPM_IGNORED_BUILDS and reformats `pnpm-workspace.yaml` when a dependency arrives carrying a build script

pnpm 11.21.0,
 workspace root with an `allowBuilds` map.
A dependency update pulls in a transitive package with a lifecycle script that has no `allowBuilds` entry.
pnpm writes a placeholder entry into the checked-in `pnpm-workspace.yaml`,
 reformats unrelated parts of that
file,
 and exits non-zero,
 so anything chained after the install (a commit alias,
 a CI step) never runs.

## Symptom

`pnpm update --no-save -r` ends with:

```text
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.28.1

Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

The working tree now shows `pnpm-workspace.yaml` modified,
 with three distinct kinds of change.

A placeholder entry naming the undecided package:

```yaml
allowBuilds:
  '@vscode/ripgrep': false
  core-js: false
  esbuild: set this to true or false
  protobufjs: false
  sharp: true
```

Block sequences reindented by two spaces,
 anywhere in the file,
 including keys nobody touched:

```diff
 packages:
-- 'package/*/*'
+  - 'package/*/*'
```

Empty mappings deleted:

```diff
-peerDependencyRules: {}
```

The exit status is `1`,
 so `pnpm install && <next command>` stops at the install.

## Root cause

Three separate pnpm behaviors compose into the observed outcome.
Source citations use the pnpm monorepo at commit `8adb97ed05fe0c1a3863c3ef26d2df42115bdbc0`,
 which carries
both the `v11.21.0` and `v12.0.0-rc.2` tags;
 the v11 tree lives under `pnpm11/` and the v12 Rust rewrite under
`pnpm/`.

### The placeholder write happens before,
 and independently of,
 the error

`pnpm11/installing/commands/src/handleIgnoredBuilds.ts:17`

```ts
export async function handleIgnoredBuilds (
  opts: HandleIgnoredBuildsOpts,
  ignoredBuilds: IgnoredBuilds | undefined
): Promise<void> {
  if (!ignoredBuilds?.size) return
  if (!opts.ignoreWorkspace) {
    await writeIgnoredBuildsToAllowBuilds(opts, ignoredBuilds)
  }
  if (opts.strictDepBuilds) {
    throw new IgnoredBuildsError(ignoredBuilds)
  }
}
```

The write is gated only on `ignoreWorkspace`.
`strictDepBuilds` gates the throw alone,
 so turning it off leaves the file mutation in place.

`pnpm11/installing/commands/src/handleIgnoredBuilds.ts:30`

```ts
  for (const name of packageNames) {
    if (opts.allowBuilds?.[name] == null) {
      newEntries[name] = 'set this to true or false'
    }
  }
```

### `strictDepBuilds` defaults to true in v11

`pnpm11/config/reader/src/index.ts:210`

```ts
    'strict-dep-builds': true,
```

pnpm's own source comment names this the version default,
 in the `dlx` path that has to opt back out of it:

`pnpm11/exec/commands/src/dlx.ts:176`

```ts
        // strictDepBuilds (the v11 default) turn that into a hard error.
        // Without this, `pnpm dlx <pkg>` cannot launch packages whose bin
        // depends on a postinstall step (e.g. native modules).
        strictDepBuilds: false,
```

An install that finds an undecided build script is therefore fatal by default,
 not a warning.
The same code path with `strictDepBuilds: false` prints a boxed warning instead:

`pnpm11/cli/default-reporter/src/reporterForClient/reportIgnoredBuilds.ts:21`

```ts
      if (ignoredScripts.packageNames && ignoredScripts.packageNames.length > 0 && !opts.pnpmConfig?.strictDepBuilds) {
```

### The settings write re-serializes the whole YAML document

`pnpm11/config/writer/src/index.ts:13` forwards to `updateWorkspaceManifest`,
 which ends at

`pnpm11/workspace/workspace-manifest-writer/src/index.ts:26`

```ts
async function writeManifestFile (dir: string, fileName: FileName, manifest: yaml.Document): Promise<void> {
  const manifestStr = manifest.toString({
    lineWidth: 0, // This is setting line width to never wrap
    singleQuote: true, // Prefer single quotes over double quotes
  })
```

Only `lineWidth` and `singleQuote` are overridden,
 so every other `yaml` stringifier default applies to the
entire document,
 including nodes the update never touched.
`indentSeq` is the one that reindents block sequences,
 demonstrated against the `yaml` 2.9.0 copy already in this
workspace's store:

```bash
node -e 'const yaml=require("/var/home/user/Monochromatic/node_modules/.pnpm/yaml@2.9.0/node_modules/yaml");
const d=yaml.parseDocument("packages:\n- a\n");
console.log(JSON.stringify(d.toString({lineWidth:0,singleQuote:true})));
console.log(JSON.stringify(d.toString({lineWidth:0,singleQuote:true,indentSeq:false})))'
# default         : "packages:\n  - a\n"
# indentSeq false : "packages:\n- a\n"
```

The empty-mapping deletion is deliberate in the patcher that runs just before that stringify:

`pnpm11/yaml/document-sync/src/patchDocument.ts:116`

```ts
  // Intentionally return null on empty maps as well. This recursively clears
  // empty maps in the final document.
  if (target == null || Object.keys(target).length === 0) {
    return null
  }
```

That is what removes `peerDependencyRules: {}`.

### pnpm 12 keeps the placeholder behavior and drops the reformatting

The v12 tree reimplements the writer in Rust and keeps the same placeholder string:

`pnpm/crates/workspace-manifest-writer/src/lib.rs:308`

```rust
pub const UNDECIDED_ALLOW_BUILD: &str = "set this to true or false";
```

Measured against 12.3.4,
 the placeholder write and the hard error both remain;
 only the collateral
reformatting disappears.
Upgrading is therefore not a way out of the `allowBuilds` decision,
 only out of the diff noise.

## Verification

Versions under test:
 pnpm 11.21.0 and pnpm 12.3.4,
 both as installed by mise
(`~/.local/share/mise/installs/pnpm/<version>/pnpm`);
 pnpm source at commit
`8adb97ed05fe0c1a3863c3ef26d2df42115bdbc0`;
 `yaml` 2.9.0 for the stringifier demonstration;
 `esbuild@0.28.1` as
the package carrying the build script.

The harness builds a throwaway fixture per case,
 so no repository state is touched.
Save as `pnpm-allowbuilds-harness.ts` and run with `node pnpm-allowbuilds-harness.ts`:

```ts
// pnpm-allowbuilds-harness.ts
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WORKSPACE_YAML = `packages:
- 'nothing/*'
peerDependencyRules: {}

allowBuilds:
  core-js: false
`;

function report({ label, pnpm, extraArgs }: {
  label: string;
  pnpm: string;
  extraArgs: readonly string[];
}): void {
  const dir = mkdtempSync(join(tmpdir(), 'pnpm-allowbuilds-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: 'allowbuilds-fixture',
    version: '0.0.0',
    private: true,
    dependencies: { esbuild: '0.28.1' },
  }, null, 2));
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), WORKSPACE_YAML);
  let status = 0;
  try {
    execFileSync(pnpm, ['install', ...extraArgs], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    status = (error as { status?: number }).status ?? -1;
  }
  console.log(`===== ${label} =====`);
  console.log(`exit status: ${status}`);
  console.log(readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8'));
}

const installs = '/home/user/.local/share/mise/installs/pnpm';
report({ label: 'pnpm 11.21.0 default', pnpm: `${installs}/11.21.0/pnpm`, extraArgs: [] });
report({
  label: 'pnpm 11.21.0 strict-dep-builds=false',
  pnpm: `${installs}/11.21.0/pnpm`,
  extraArgs: ['--config.strict-dep-builds=false'],
});
report({ label: 'pnpm 12.3.4 default', pnpm: `${installs}/12.3.4/pnpm`, extraArgs: [] });
```

Fails,
 exit status `1`,
 file rewritten (pnpm 11.21.0,
 default settings):

```yaml
packages:
  - 'nothing/*'

allowBuilds:
  core-js: false
  esbuild: set this to true or false
```

Both the reindentation of `- 'nothing/*'` and the loss of `peerDependencyRules: {}` reproduce.

Fails differently,
 exit status `0`,
 file still rewritten (pnpm 11.21.0,
 `--config.strict-dep-builds=false`):
identical file content,
 with a boxed warning in place of the error.
This is the case that shows the write is not gated on `strictDepBuilds`.

Fails,
 exit status `1`,
 file preserved (pnpm 12.3.4,
 default settings):

```yaml
packages:
- 'nothing/*'
peerDependencyRules: {}

allowBuilds:
  core-js: false
  esbuild: set this to true or false
```

Works cleanly:
 an install where every build-script package already has an `allowBuilds` entry writes nothing and
exits `0`.
That is the state this workspace returns to once the entry is decided.

A second fixture covers the flow-sequence variant of the same reformatting,
 with `packages: [.]` as the first
line:
 pnpm 11.21.0 rewrites it to `packages: [ . ]`,
 pnpm 12.3.4 leaves it byte-identical.

### Why `esbuild: false` is the correct entry for this workspace

`esbuild@0.28.1` arrives transitively:
 `esbuild <- @earendil-works/chord@0.85.1 <- @earendil-works/pi-agent-core
<- @earendil-works/pi-coding-agent`,
 a devDependency of the `@monochromatic-dev/pi-*` plugin packages.
Chord consumes the JavaScript API,
 not the CLI binary
(`node_modules/.pnpm/@earendil-works+chord@0.85.1/node_modules/@earendil-works/chord/dist/node/bundle.js:4`):

```js
import { build } from "esbuild";
```

esbuild's `install.js` exists to hardlink the platform binary over the JavaScript `bin/esbuild` shim
(`maybeOptimizePackage`) and to run a version check;
 it downloads only when the platform package is missing.
All four platform packages this workspace's `supportedArchitectures` requests are present in the store
(`@esbuild/linux-x64`,
 `@esbuild/linux-arm64`,
 `@esbuild/darwin-x64`,
 `@esbuild/darwin-arm64`,
 all at `0.28.1`),
so the JavaScript API resolves its binary without the script.
Verified by calling `build()` from chord's own directory with the script still unrun:

```bash
cd node_modules/.pnpm/@earendil-works+chord@0.85.1/node_modules/@earendil-works/chord
node -e 'const {build}=require("esbuild");
build({stdin:{contents:"export const a=1"},write:false,bundle:true,format:"esm"})
  .then(r=>console.log(r.outputFiles[0].text.trim()))'
# // <stdin>
# var a = 1;
# export { a };
```

## Verified workarounds

Decide the entry.
For a package whose script is unnecessary,
 replace the placeholder with `false`:

```yaml
allowBuilds:
  esbuild: false
```

Tradeoff:
 a later esbuild release that genuinely needs its install script (a new platform package layout,
 a
binary that must be fetched rather than resolved) fails silently at first use rather than at install time,
 and
nothing re-asks.
The entry is a standing decision,
 so it needs revisiting when the dependency's install script changes purpose.

Unblock an install without deciding,
 for a single run:

```bash
pnpm install --config.strict-dep-builds=false
```

Tradeoff:
 the placeholder is still written into `pnpm-workspace.yaml`,
 so the working tree is still dirty and the
decision is still pending;
 this only converts the hard error into a warning.

Avoid the collateral reformatting by moving to pnpm 12.
Tradeoff:
 a major version step onto the Rust rewrite,
 which is a much larger change than the diff noise it
removes,
 and this workspace pins pnpm through `mise.lock`
(`doc/troubleshooting/mise-lock-pins-repo-tool-version.md`).

## What does not work

- Setting `strictDepBuilds: false` in `pnpm-workspace.yaml` to keep the file clean.
   The write happens before
  the flag is consulted,
   as `pnpm11/installing/commands/src/handleIgnoredBuilds.ts:17` shows and the harness
  confirms:
   both v11 cases produce the same file.
- Deleting the placeholder line and rerunning.
   `writeIgnoredBuildsToAllowBuilds` re-adds any package whose
  `allowBuilds` value is `null`,
   so the line comes back on the next install.
- Reverting the reformatting by hand while leaving the entry undecided.
   The next install re-serializes the
  document again and reproduces both the reindentation and the empty-mapping deletion.
- Passing `--ignore-scripts=false` to pnpm 12.3.4 for a parity run.
   The v12 CLI rejects a value on that flag
  (`error: unexpected value 'false' for '--ignore-scripts' found`);
   scripts run by default,
   so the flag is
  unnecessary in both versions.

## Upstream filing decision

`.out-of-scope/` holds no exemption for pnpm:
 the closest entry,
 `.out-of-scope/low-impact-typescript-formatting.md`,
 scopes this project's own TypeScript formatter
work,
 not third-party YAML round-tripping.

Duplicate search over `pnpm/pnpm` (`gh search issues --repo pnpm/pnpm "allowBuilds"`,
 20 results read) found both
halves of this report already filed by an unrelated contributor:

- [pnpm/pnpm#11574](https://github.com/pnpm/pnpm/issues/11574),
   `allowBuilds` placeholders written to
  `pnpm-workspace.yaml` during non-interactive installs.
   The body already names
  `installing/commands/src/handleIgnoredBuilds.ts` and already states that `strictDepBuilds: false` does not
  suppress the write.
   Nothing here advances it.
- [pnpm/pnpm#11575](https://github.com/pnpm/pnpm/issues/11575),
   `pnpm install` reformats inline flow sequences
  in `pnpm-workspace.yaml`.
   The body names the same `manifest.toString({ lineWidth: 0, singleQuote: true })`
  call and the `flowCollectionPadding` default.
   It does not mention block-sequence reindentation,
   empty-mapping
  deletion,
   or that pnpm 12 fixes all three.

Walking the six constraints for the additive comment on `pnpm/pnpm#11575`:

1.  Really upstream's fault?
    Yes.
    An unmodified node round-tripping to different bytes is a formatting defect in
    pnpm's writer,
    not a YAML ambiguity:
    both spellings parse identically,
    and pnpm 12 preserves the input.
2.  Can upstream fix it?
    Yes,
    and already has.
    The v12 Rust writer preserves all three cases,
    measured at
    12.3.4.
3.  Are they supporting this use case?
    Yes.
    `pnpm-workspace.yaml` is a checked-in file pnpm asks users to
    edit,
    and the v12 rewrite states formatting preservation as the crate's purpose
    (`pnpm/crates/workspace-manifest-writer/src/lib.rs:1`,
    "Format-preserving writer for `pnpm-workspace.yaml`",
    naming comments,
    blank lines,
    key order,
    and quote style as what it keeps).
4.  Would the repo welcome our contribution?
    Yes,
    with disclosure.
    `CONTRIBUTING.md:268` ("AI-assisted
    contributions") welcomes agent-assisted work provided the contributor vetted it and the filing carries a
    footer naming the agent and model.
    The draft carries that footer.
5.  Will they likely fix it?
    Already fixed in v12;
    the open question the comment raises is only whether v11
    still warrants a backport.
    No maintainer has declined it.
6.  Prototyped a minimal fix?
    Not applicable to this artifact.
    The contribution is measurement,
    not a patch:
    the fix exists upstream in v12,
    so a v11 prototype would duplicate work already done rather than solve
    anything open.
    A v11 backport would be `indentSeq: false` plus `flowCollectionPadding: false` on the
    `toString` call in `pnpm11/workspace/workspace-manifest-writer/src/index.ts:27`,
    but that changes output
    for every workspace on the v11 line,
    which is a maintainer's call and not ours to pre-empt.

Decision:
 post nothing on `pnpm/pnpm#11574`,
 which already says everything this investigation found.
Keep the following comment for `pnpm/pnpm#11575`,
 which adds two unreported manifestations and the v12
measurement.
It is fileable as written.

~~~md
Two more manifestations of the same `toString` round-trip,
and a version datapoint.

Beyond flow-sequence padding, an unmodified `pnpm-workspace.yaml` also loses:

1. Block-sequence indentation. A sequence written at column 0 under a mapping key comes back indented by two,
   because `indentSeq` defaults to `true` and only `lineWidth` and `singleQuote` are overridden:

   ```diff
    packages:
   -- 'package/*/*'
   +  - 'package/*/*'
   ```

2. Empty mappings. `peerDependencyRules: {}` is deleted outright, by
   `yaml/document-sync/src/patchDocument.ts`:

   ```ts
   // Intentionally return null on empty maps as well. This recursively clears
   // empty maps in the final document.
   if (target == null || Object.keys(target).length === 0) {
     return null
   }
   ```

Both reproduce on 11.21.0 with the same trigger as the original report: an install that appends an
`allowBuilds` placeholder.

pnpm 12.3.4 does not reproduce any of the three, including the `packages: [.]` -> `packages: [ . ]` case in
the original report. Same fixture, same trigger, byte-identical file except for the appended placeholder
line. So this looks fixed by the Rust `workspace-manifest-writer`, and the only open question is whether the
v11 line warrants a backport.

Reproduction (throwaway fixture, no repo state touched): a directory with a `package.json` depending on
`esbuild@0.28.1` and a `pnpm-workspace.yaml` containing a column-0 sequence, an empty mapping, and an
`allowBuilds` map, then `pnpm install` under each version.

Written by an agent (Claude Code, claude-opus-5).
~~~
