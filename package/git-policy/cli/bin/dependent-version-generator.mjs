/**
 Seeded generator of workspaces for the dependent-version differential harness.

 A generated workspace has random dependency edges of every field kind (so cycles, self edges and edges to names
 without a manifest occur), workspace protocol variants, unpublished packages, source files with every specifier form
 and decoys, unusual manifest formatting, new and renamed manifests, raised, removed and already bumped versions,
 every lifecycle point, and at most one malformed manifest.
 Probes apply exactly one feature whose result is meant to differ, so the main class must show no difference at all.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { toHex } from './dependent-version-incumbent.mjs';

/**
 Mulberry32: a small seeded generator of numbers in [0, 1).

 @param {number} seed - 32-bit seed
 @returns {() => number} generator
 */
export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D_2B_79_F5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Dependency fields with their weight. */
const fields = ['dependencies', 'dependencies', 'dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies', 'devDependencies', 'devDependencies'];
/** Specifier values, including every workspace protocol form. */
const protocols = ['workspace:*', 'workspace:^', 'workspace:~', 'workspace:^1.2.3', '^1.0.0', '1.0.0', 'npm:@g/alias@1', 'link:../x', 'file:../x', '*'];
/** Names outside the workspace, including ones that look like workspace packages without a manifest. */
const externals = ['react', 'left-pad', '@types/node', '@g/missing', '@g/missing/ts'];
/** Source file names: every extension, tests, declarations and files that are not source. */
const sourceNames = ['index.ts', 'lib/a.tsx', 'b.mts', 'c.cts', 'd.js', 'e.jsx', 'f.mjs', 'g.cjs', 'types.d.ts', 'x.unit.test.ts', 'h.test.helper.ts', 'readme.md', 'data.json', 'deep/more/i.ts'];

/**
 Serialize entries as JSON in a given style, keeping duplicate keys and their order.

 @param {any} value - `{ entries: [key, value][] }`, an array, or a scalar
 @param {{ indent: string, colon: string, newline: string }} style - formatting
 @param {string} [depth] - current indentation
 @returns {string} JSON text
 */
function serialize(value, style, depth = '') {
  const inner = `${depth}${style.indent}`;
  const breakLine = style.indent === '' ? '' : style.newline;
  if (Array.isArray(value)) {
    if (value.length === 0)
      return '[]';
    return `[${breakLine}${value.map(item => `${inner}${serialize(item, style, inner)}`).join(`,${breakLine}`)}${breakLine}${depth}]`;
  }
  if ((value !== null) && (typeof value === 'object') && ('entries' in value)) {
    if (value.entries.length === 0)
      return '{}';
    const members = value.entries.map((/** @type {[string, any]} */ [key, member]) => `${inner}${JSON.stringify(key)}${style.colon}${serialize(member, style, inner)}`);
    return `{${breakLine}${members.join(`,${breakLine}`)}${breakLine}${depth}}`;
  }
  return JSON.stringify(value);
}

/**
 Helpers bound to one generator.

 @param {() => number} random - generator
 */
function tools(random) {
  const below = (/** @type {number} */ count) => Math.floor(random() * count);
  /** @type {<T>(list: readonly T[]) => T} */
  const pick = list => list[below(list.length)];
  const chance = (/** @type {number} */ probability) => random() < probability;
  /** @type {<T>(list: readonly T[]) => T[]} */
  const shuffled = list => {
    const copy = [...list];
    for (const index of copy.keys()) {
      const other = index + below(copy.length - index);
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  };
  return { below, pick, chance, shuffled };
}

/**
 A random plain release version.

 @param {ReturnType<typeof tools>} tool - generator helpers
 @returns {string} version
 */
function release(tool) {
  return `${tool.below(4)}.${tool.below(21)}.${tool.pick([0, 1, 9, 19, 99, 199, 909, 1234])}`;
}

/**
 One generated package: name, directory, manifest entries, and source files.

 @param {ReturnType<typeof tools>} tool - generator helpers
 @param {number} index - package index
 @returns {any} package
 */
function generatedPackage(tool, index) {
  const name = tool.pick([`@g/p${index}`, `@g/p${index}`, `@g/p${index}0`, `@g/\u{E9}${index}`, `@g/\u{1D538}${index}`, `@g/\u{E000}${index}`, `plain-${index}`]);
  const directory = `package/${tool.pick(['module', 'cli', 'app', 'lib'])}/d${index}${tool.pick(['', '-x', '.y'])}`;
  const version = tool.chance(0.08) ? tool.pick(['1.0.0-rc.1', '1.0', '01.0.0', '2.0.0+build']) : release(tool);
  return { name, directory, version: tool.chance(0.06) ? undefined : version, edges: [], sources: [] };
}

/**
 A manifest's entries for a package at one state.

 @param {ReturnType<typeof tools>} tool - generator helpers
 @param {any} pkg - package
 @param {string | undefined} version - version at this state
 @returns {{ entries: [string, any][] }} manifest object
 */
function manifestEntries(tool, pkg, version) {
  /** @type {Map<string, [string, string][]>} */
  const byField = new Map();
  for (const edge of pkg.edges)
    byField.set(edge.field, [...(byField.get(edge.field) ?? []), [edge.name, edge.protocol]]);
  /** @type {[string, any][]} */
  const entries = [['name', pkg.name], ...(version === undefined ? [] : [['version', version]])];
  for (const [field, members] of byField)
    entries.push([field, { entries: members }]);
  if (tool.chance(0.3))
    entries.push(['description', tool.pick(['version "x"', 'a, b }', 'see /docs', '\u{E9}\u{1F600}'])]);
  if (tool.chance(0.2))
    entries.push(['publishConfig', { entries: [['version', '9.9.9'], ['access', 'public']] }]);
  if (tool.chance(0.2))
    entries.push(['private', true]);
  if (tool.chance(0.15))
    entries.push(['tail', ['version', { entries: [['version', '0.0.0']] }]]);
  const nameFirst = entries.slice(0, 1);
  return { entries: tool.chance(0.5) ? [...nameFirst, ...tool.shuffled(entries.slice(1))] : tool.shuffled(entries) };
}

/**
 Manifest text in a random style.

 @param {ReturnType<typeof tools>} tool - generator helpers
 @param {{ entries: [string, any][] }} manifest - manifest object
 @param {any} style - fixed style for both states, so only versions differ
 @returns {string} text
 */
function manifestText(tool, manifest, style) {
  return `${serialize(manifest, style)}${style.final}`;
}

/**
 A random manifest style.

 @param {ReturnType<typeof tools>} tool - generator helpers
 @returns {any} style
 */
function manifestStyle(tool) {
  const indent = tool.pick(['  ', '  ', '  ', '    ', '\t', '']);
  const newline = tool.chance(0.15) ? '\r\n' : '\n';
  return { indent, colon: tool.pick([': ', ': ', ':', ' : ', ' :  ']), newline, final: tool.chance(0.8) ? newline : '' };
}

/**
 Source text that imports some names and mentions others without importing them.

 @param {ReturnType<typeof tools>} tool - generator helpers
 @param {string[]} names - names to use
 @returns {string} source
 */
function sourceText(tool, names) {
  const forms = [
    (/** @type {string} */ n) => `import { x } from '${n}';`, n => `import '${n}/ts';`, n => `export * from "${n}";`,
    n => `const m = await import(\`${n}\`);`, n => `const r = require ( '${n}' );`, n => `import type { T } from '${n}/sub';`,
    n => `import {\n  y,\n}\nfrom\n'${n}';`, n => `// ${n}`, n => `const s = '${n}';`, n => `const t = '${n}x';`,
    n => `reimport '${n}';`, n => `myrequire('${n}');`, n => `from '${n}-extra';`, n => `import '${n}`, n => `_import('${n}')`,
  ];
  return names.map(name => tool.pick(forms)(name)).join(tool.pick(['\n', '\r\n', ' ']));
}

/**
 One malformed variant of a manifest text, or the text unchanged.

 @param {ReturnType<typeof tools>} tool - generator helpers
 @param {string} text - manifest text
 @returns {string} text with one defect
 */
function malformed(tool, text) {
  const defect = tool.pick([
    () => text.replace(/\}\s*$/u, ',}'),
    () => `// comment\n${text}`,
    () => text.replace('"name"', "'name'"),
    () => text.replace(/,/u, ''),
    () => text.slice(0, Math.max(1, text.indexOf('"name"') + 4)),
    () => '"just a string"',
    () => `[${text}]`,
    () => text.replace(/"name"(\s*):(\s*)"[^"]*"/u, '"name"$1:$21'),
    () => text.replace(/"version"(\s*):(\s*)"[^"]*"/u, '"version"$1:$2[1]'),
    () => text.replace(/^\{/u, '{"version":"0.0.0-first",'),
  ]);
  return defect();
}

/**
 A patch bump by simple increment, for dependents that were already bumped by hand.

 @param {string} version - plain release
 @returns {string} bumped release
 */
function bumped(version) {
  const [major, minor, patch] = version.split('.');
  return `${major}.${minor}.${Number(patch) + 1}`;
}

/**
 Current and base texts of one package's manifest.

 @param {ReturnType<typeof tools>} tool - generator helpers
 @param {any} pkg - package
 @param {boolean} raised - whether this package's version is raised
 @returns {{ current: string, base: string | undefined }} texts
 */
function manifestStates(tool, pkg, raised) {
  const style = manifestStyle(tool);
  const isRelease = /^\d+\.\d+\.\d+$/u.test(pkg.version ?? '');
  const kind = raised ? tool.pick(['raise', 'raise', 'raise', 'remove']) : tool.pick(['same', 'same', 'same', 'same', 'same', 'same', 'same', 'same', 'new', 'versionless-base', 'bumped', 'reformatted', 'renamed']);
  const baseVersion = kind === 'versionless-base' ? undefined : (pkg.version ?? (raised ? '1.0.0' : undefined));
  const currentVersion = kind === 'raise' ? tool.pick([release(tool), `${baseVersion}-next`, '9.9.9'])
    : kind === 'remove' ? undefined
    : (kind === 'bumped' && isRelease) ? bumped(pkg.version)
    : (kind === 'versionless-base' ? (pkg.version ?? '1.0.0') : baseVersion);
  const current = manifestEntries(tool, pkg, currentVersion);
  const baseEntries = current.entries
    .filter(([key]) => key !== 'version')
    .map(([key, value]) => (key === 'name' && kind === 'renamed') ? [key, `${value}-old`] : [key, value]);
  if (baseVersion !== undefined)
    baseEntries.splice(1, 0, ['version', baseVersion]);
  const baseStyle = kind === 'reformatted' ? manifestStyle(tool) : style;
  const currentText = manifestText(tool, current, style);
  const baseText = (kind === 'same' || kind === 'bumped' || kind === 'reformatted' || kind === 'renamed' || kind === 'raise' || kind === 'remove' || kind === 'versionless-base')
    ? manifestText(tool, { entries: /** @type {[string, any][]} */ (baseEntries) }, baseStyle)
    : undefined;
  return { current: currentText, base: (kind === 'same') ? currentText : baseText };
}

/**
 The registry configuration listing the publishable names.

 @param {ReturnType<typeof tools>} tool - generator helpers
 @param {string[]} names - publishable names
 @returns {string} configuration text
 */
function configText(tool, names) {
  const items = names.map(name => `            - '${name}'`);
  if (tool.chance(0.05))
    items.splice(tool.below(items.length + 1), 0, "            - ''");
  const text = tool.chance(0.5)
    ? `storage: /s\nauth:\n  oidc:\n    - workloads:\n        - registry: r\n          packages:\n${items.join('\n')}\n\nweb:\n  enable: false\n`
    : `packages:\n${items.map(item => item.trim()).map(item => `  ${item}`).join('\n')}\nnext: 1\n`;
  return tool.chance(0.1) ? text.replaceAll('\n', '\r\n') : text;
}

/**
 One generated workspace as fixture files, candidates and lifecycle.

 @param {ReturnType<typeof tools>} tool - generator helpers
 @param {{ defect: boolean }} options - whether one manifest may be malformed
 @returns {{ files: any[], packages: any[], trigger: string, forwardsCommit: boolean, deleted: boolean }} workspace
 */
function generatedWorkspace(tool, { defect }) {
  const packages = Array.from({ length: 2 + tool.below(9) }, (_, index) => generatedPackage(tool, index));
  for (const pkg of packages) {
    for (const other of packages) {
      if (other === pkg ? tool.chance(0.04) : tool.chance(0.22))
        pkg.edges.push({ field: tool.pick(fields), name: other.name, protocol: tool.pick(protocols) });
    }
    if (tool.chance(0.3))
      pkg.edges.push({ field: tool.pick(fields), name: tool.pick(externals), protocol: tool.pick(protocols) });
    for (const fileName of tool.shuffled(sourceNames).slice(0, tool.below(4))) {
      const mentioned = tool.shuffled([...pkg.edges.map((/** @type {any} */ edge) => edge.name), ...packages.map(other => other.name)]).slice(0, 1 + tool.below(3));
      const text = Buffer.from(sourceText(tool, mentioned), 'utf8');
      pkg.sources.push({ path: `${pkg.directory}/src/${fileName}`, bytes: tool.chance(0.05) ? Buffer.concat([Buffer.from([0xFF, 0xFE, 0x20]), text]) : text });
    }
  }
  const raised = new Set(tool.shuffled(packages).slice(0, tool.pick([0, 1, 1, 1, 2, 3])));
  const files = [];
  if (tool.chance(0.92)) {
    const text = Buffer.from(configText(tool, [...packages.filter(() => tool.chance(0.75)).map(pkg => pkg.name), ...(tool.chance(0.2) ? ['@g/not-here'] : [])]), 'utf8');
    files.push({ path: 'package/config/pnpr/config.yaml', mode: 'regular', current: text, base: text });
  }
  const broken = defect && tool.chance(0.1) ? tool.pick(packages) : undefined;
  for (const pkg of packages) {
    const states = manifestStates(tool, pkg, raised.has(pkg));
    const breakBase = pkg === broken && states.base !== undefined && tool.chance(0.3);
    const current = pkg === broken && !breakBase ? malformed(tool, states.current) : states.current;
    const base = breakBase && states.base !== undefined ? malformed(tool, states.base) : states.base;
    const mode = tool.pick(['regular', 'regular', 'regular', 'regular', 'regular', 'regular', 'regular', 'regular', 'regular', 'regular', 'regular', 'regular', 'regular', 'regular', 'regular', 'regular', 'executable', 'symlink', 'submodule']);
    files.push({ path: `${pkg.directory}/package.json`, mode, current: Buffer.from(current, 'utf8'), base: base === undefined ? undefined : Buffer.from(base, 'utf8') });
    for (const source of pkg.sources)
      files.push({ path: source.path, mode: 'regular', current: source.bytes, base: source.bytes });
  }
  if (tool.chance(0.2))
    files.push({ path: 'package/module/ghost/src/index.ts', mode: 'regular', current: Buffer.from(sourceText(tool, packages.map(pkg => pkg.name))), base: undefined });
  const [trigger, forwardsCommit] = tool.pick([['pre-forward', true], ['pre-forward', true], ['pre-forward', true], ['pre-forward', true], ['pre-forward', true], ['pre-forward', true], ['pre-forward', true], ['pre-forward', false], ['direct-fix', false], ['direct-check', false]]);
  return { files: tool.shuffled(files), packages, trigger: /** @type {string} */ (trigger), forwardsCommit: /** @type {boolean} */ (forwardsCommit), deleted: tool.chance(0.1) };
}

/**
 A workspace as a differential case input.

 @param {{ files: any[], trigger: string, forwardsCommit: boolean, deleted: boolean }} generated - workspace
 @returns {object} input
 */
function caseInput(generated) {
  const changed = generated.files.filter(entry => entry.base === undefined || !entry.current.equals(entry.base));
  return {
    workspace: null,
    files: generated.files.map(entry => ({
      path: toHex(entry.path),
      mode: entry.mode,
      current: toHex(entry.current),
      base: entry.base === undefined ? null : (entry.base.equals(entry.current) ? true : toHex(entry.base)),
    })),
    trigger: generated.trigger,
    forwardsCommit: generated.forwardsCommit,
    candidates: [
      ...changed.map(entry => ({ path: toHex(entry.path), change: entry.base === undefined ? 'added' : 'modified' })),
      ...(generated.deleted ? [{ path: toHex('package/module/gone/package.json'), change: 'deleted' }] : []),
    ],
  };
}

/**
 The main generated class: workspaces whose results must be identical.

 @param {{ seed: number, count: number }} request - seed and number of workspaces
 @returns {{ name: string, kind: string, input: object, features: string[] }[]} cases
 */
export function generatedCases({ seed, count }) {
  const tool = tools(seeded(seed));
  return Array.from({ length: count }, (_, index) => ({
    name: `generated ${seed}/${index}`,
    kind: 'workspace',
    input: caseInput(generatedWorkspace(tool, { defect: true })),
    features: [],
  }));
}

/** Probe features, each a deliberate difference recorded in the handover. */
export const probeFeatures = ['bom', 'huge-patch', 'duplicate-name', 'unpaired-surrogate-name', 'deep-nesting', 'non-utf8-manifest', 'non-utf8-config'];

/**
 Apply one probe feature to a workspace's files.

 @param {ReturnType<typeof tools>} tool - generator helpers
 @param {string} feature - probe feature
 @param {any[]} files - workspace files, changed in place
 */
function applyFeature(tool, feature, files) {
  const manifests = files.filter(entry => entry.path.endsWith('/package.json'));
  const target = tool.pick(manifests);
  const edit = (/** @type {any} */ entry, /** @type {(text: Buffer) => Buffer} */ change) => {
    const same = entry.base !== undefined && entry.base.equals(entry.current);
    entry.current = change(entry.current);
    if (entry.base !== undefined)
      entry.base = same ? entry.current : change(entry.base);
  };
  const replaceText = (/** @type {string} */ from, /** @type {string} */ to) => (/** @type {Buffer} */ bytes) => Buffer.from(bytes.toString('utf8').replace(from, to), 'utf8');
  const nameOf = (/** @type {any} */ entry) => /"name"\s*:\s*("(?:[^"\\]|\\.)*")/u.exec(entry.current.toString('utf8'))?.[1] ?? '"none"';
  if (feature === 'bom')
    edit(target, bytes => Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), bytes]));
  if (feature === 'huge-patch') {
    const unchanged = manifests.filter(entry => entry.base !== undefined && entry.base.equals(entry.current));
    for (const entry of unchanged.length > 0 ? unchanged : manifests)
      edit(entry, bytes => Buffer.from(bytes.toString('utf8').replace(/("version"\s*:\s*)"[^"]*"/u, `$1"${tool.pick(['1.0.9007199254740993', '2.3.999999999999999999999', '0.1.9007199254740992'])}"`), 'utf8'));
  }
  if (feature === 'duplicate-name') {
    const other = tool.pick(manifests.filter(entry => entry !== target));
    edit(other, replaceText(nameOf(other), nameOf(target)));
  }
  if (feature === 'unpaired-surrogate-name')
    edit(target, replaceText(nameOf(target), `${nameOf(target).slice(0, -1)}\\ud800"`));
  if (feature === 'deep-nesting')
    edit(target, replaceText('{', `{"deep":${'['.repeat(600)}${']'.repeat(600)},`));
  if (feature === 'non-utf8-manifest')
    target.current = Buffer.from(Buffer.from(target.current.toString('utf8').replace('{', '{"bad":"\u0000",'), 'utf8').map(byte => byte === 0 ? 0xFF : byte));
  if (feature === 'non-utf8-config') {
    const config = files.find(entry => entry.path === 'package/config/pnpr/config.yaml');
    if (config !== undefined)
      config.current = Buffer.concat([Buffer.from('# \xFF\n', 'latin1'), config.current]);
  }
}

/**
 The probe class: one deliberate difference per workspace.

 @param {{ seed: number, perFeature: number }} request - seed and workspaces per feature
 @returns {{ name: string, kind: string, input: object, features: string[] }[]} cases
 */
export function probeCases({ seed, perFeature }) {
  const tool = tools(seeded(seed ^ 0x5F_37_59_DF));
  return probeFeatures.flatMap(feature => Array.from({ length: perFeature }, (_, index) => {
    const generated = generatedWorkspace(tool, { defect: false });
    applyFeature(tool, feature, generated.files);
    return { name: `probe ${feature} ${seed}/${index}`, kind: 'workspace', input: caseInput(generated), features: [feature] };
  }));
}
