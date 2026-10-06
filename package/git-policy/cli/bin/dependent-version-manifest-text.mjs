/**
 Manifest texts for the dependent-version differential generator: entries in a random order and style, versions at
 both states, and one malformed variant.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />

/** @typedef {import('./dependent-version-random.mjs').Tool} Tool */
/** @typedef {{ field: string, name: string, protocol: string }} Edge */
/**
 One generated package.

 @typedef {{
   name: string,
   directory: string,
   version: string | undefined,
   edges: Edge[],
   deep: boolean,
   sources: { path: string, bytes: Buffer }[],
 }} GeneratedPackage
 */
/** @typedef {string | boolean | number | null | { raw: string } | { entries: [string, Value][] } | Value[]} Value */
/** @typedef {{ indent: string, colon: string, newline: string, final: string }} Style */

/** Bounds of generated release versions; patches include ones whose increment carries. */
const releaseShape = {
  majors: 4,
  minors: 21,
  patches: [
    '0',
    '1',
    '9',
    '19',
    '99',
    '199',
    '909',
    '1234',
  ],
};

/** Components of a release version. */
const releaseParts = 3;

/** Containers in a deeply nested value. */
const deepNesting = 600;

/** Probabilities of the optional manifest members. */
const odds = {
  description: 0.3,
  publishConfig: 0.2,
  private: 0.2,
  tail: 0.15,
  nameFirst: 0.5,
  crlf: 0.15,
  finalNewline: 0.8,
};

/**
 Serialize a value as JSON in a style, keeping duplicate keys, their order and raw fragments.

 @param {{ value: Value, style: Style, depth: string }} request - value, style and current indentation
 @returns {string} JSON text
 */
export function serialize({
  value,
  style,
  depth
}) {
  const inner = `${depth}${style.indent}`;
  const breakLine = style.indent === '' ? '' : style.newline;
  if (Array.isArray(value)) {
    if (value.length === 0)
      return '[]';
    const items = value.map(function item(element) {
      return `${inner}${serialize({
        value: element,
        style,
        depth: inner
      })}`;
    });
    return `[${breakLine}${items.join(`,${breakLine}`)}${breakLine}${depth}]`;
  }
  if ((value !== null) && ((typeof value) === 'object')
    && ('raw' in value))
    return value.raw;
  if ((value !== null) && ((typeof value) === 'object')) {
    if (value.entries
      .length
      === 0)
      return '{}';
    const members = value.entries
      .map(function member([key, element]) {
      return `${inner}${JSON.stringify(key)}${style.colon}${serialize({
        value: element,
        style,
        depth: inner
      })}`;
    });
    return `{${breakLine}${members.join(`,${breakLine}`)}${breakLine}${depth}}`;
  }
  return JSON.stringify(value);
}

/**
 A random plain release version.

 @param {Tool} tool - generator choices
 @returns {string} version
 */
export function release(tool) {
  return `${String(tool.below(releaseShape.majors))}.${String(tool.below(releaseShape.minors))}.${tool.pick(releaseShape.patches)}`;
}

/**
 A manifest's entries for a package at one state.

 @param {{ tool: Tool, pkg: GeneratedPackage, version: string | undefined }} request - choices, package and version
 @returns {{ entries: [string, Value][] }} manifest object
 */
function manifestEntries({
  tool,
  pkg,
  version
}) {
  /** @type {Map<string, [string, Value][]>} */
  const byField = new Map();
  for (const edge of pkg.edges) {
    byField.set(
      edge.field,
      [
        ...byField.get(edge.field) ?? [],
        [
          edge.name,
          edge.protocol
        ],
      ],
    );
  }
  /** @type {[string, Value][]} */
  const entries = [[
    'name',
    pkg.name
  ]];
  if (version !== undefined)
    entries.push([
      'version',
      version
    ]);
  for (const [field, members] of byField)
    entries.push([
      field,
      { entries: members }
    ]);
  if (tool.chance(odds.description))
    entries.push([
      'description',
      tool.pick([
        'version "x"',
        'a, b }',
        'see /docs',
        '\u{E9}\u{1F600}'
      ])
    ]);
  if (tool.chance(odds.publishConfig))
    entries.push([
      'publishConfig',
      { entries: [
        [
          'version',
          '9.9.9'
        ],
        [
          'access',
          'public'
        ]
      ] }
    ]);
  if (tool.chance(odds.private))
    entries.push([
      'private',
      true
    ]);
  if (tool.chance(odds.tail))
    entries.push([
      'tail',
      [
        'version',
        { entries: [[
          'version',
          '0.0.0'
        ]] }
      ]
    ]);
  if (pkg.deep)
    entries.push([
      'deep',
      { raw: `${'['.repeat(deepNesting)}${']'.repeat(deepNesting)}` }
    ]);
  const [first, ...rest] = entries;
  if ((first === undefined) || (!tool.chance(odds.nameFirst)))
    return { entries: tool.shuffled(entries) };
  return {
    entries: [
      first,
      ...tool.shuffled(rest),
    ],
  };
}

/**
 A random manifest style.

 @param {Tool} tool - generator choices
 @returns {Style} style
 */
function manifestStyle(tool) {
  const newline = tool.chance(odds.crlf) ? '\r\n' : '\n';
  return {
    indent: tool.pick([
      '  ',
      '  ',
      '  ',
      '    ',
      '\t',
      ''
    ]),
    colon: tool.pick([
      ': ',
      ': ',
      ':',
      ' : ',
      ' :  '
    ]),
    newline,
    final: tool.chance(odds.finalNewline) ? newline : '',
  };
}

/**
 Manifest text of entries in a style.

 @param {{ manifest: { entries: [string, Value][] }, style: Style }} request - manifest object and style
 @returns {string} text
 */
function manifestText({
  manifest,
  style
}) {
  return `${serialize({
    value: manifest,
    style,
    depth: ''
  })}${style.final}`;
}

/**
 Whether a version is a plain `major.minor.patch` of ASCII digits.

 @param {string} version - version
 @returns {boolean} whether it is
 */
function isRelease(version) {
  const parts = version.split('.');
  return (parts.length === releaseParts) && parts.every(function digits(part) {
    return (part !== '')
      && part.split('')
      .every(function isDigit(character) {
      return (character >= '0') && (character <= '9');
    });
  });
}

/**
 A patch bump by simple increment, for dependents that were already bumped by hand.

 @param {string} version - plain release
 @returns {string} bumped release
 */
function bumped(version) {
  const [major, minor, patch] = version.split('.');
  return `${major ?? ''}.${minor ?? ''}.${String(Number(patch) + 1)}`;
}

/** How a package's manifest differs between the base and the candidate state. */
const unraisedKinds = [
  'same',
  'same',
  'same',
  'same',
  'same',
  'same',
  'same',
  'same',
  'new',
  'versionless-base',
  'bumped',
  'reformatted',
  'renamed'
];

/** How a raised package's version changed. */
const raisedKinds = [
  'raise',
  'raise',
  'raise',
  'remove'
];

/**
 The version at the candidate state.

 @param {{ tool: Tool, kind: string, pkg: GeneratedPackage, baseVersion: string | undefined }} request - choices,
   kind of change, package and base version
 @returns {string | undefined} current version
 */
function currentVersion({
  tool,
  kind,
  pkg,
  baseVersion
}) {
  if (kind === 'raise')
    return tool.pick([
      release(tool),
      `${String(baseVersion)}-next`,
      '9.9.9'
    ]);
  if (kind === 'remove')
    return undefined;
  if ((kind === 'bumped') && isRelease(pkg.version ?? ''))
    return bumped(pkg.version ?? '');
  if (kind === 'versionless-base')
    return pkg.version ?? '1.0.0';
  return baseVersion;
}

/**
 Current and base texts of one package's manifest.

 @param {{ tool: Tool, pkg: GeneratedPackage, raised: boolean }} request - choices, package and whether it is raised
 @returns {{ current: string, base: string | undefined }} texts
 */
export function manifestStates({
  tool,
  pkg,
  raised
}) {
  const style = manifestStyle(tool);
  const kind = tool.pick(raised ? raisedKinds : unraisedKinds);
  const baseVersion = kind === 'versionless-base' ? undefined : (pkg.version ?? (raised ? '1.0.0' : undefined));
  const current = manifestEntries({
    tool,
    pkg,
    version: currentVersion({
      tool,
      kind,
      pkg,
      baseVersion,
    }),
  });
  /** @type {[string, Value][]} */
  const baseEntries = current.entries
    .filter(function withoutVersion([key]) {
      return key !== 'version';
    })
    .map(function renamed([key, value]) {
      return /** @type {[string, Value]} */ ((key === 'name') && (kind === 'renamed') ? [
        key,
        (typeof value) === 'string' ? `${value}-old` : value
      ] : [
        key,
        value
      ]);
    });
  if (baseVersion !== undefined)
    baseEntries.splice(
      1,
      0,
      [
        'version',
        baseVersion
      ]
    );
  const currentText = manifestText({
    manifest: current,
    style,
  });
  if (kind === 'same')
    return {
      current: currentText,
      base: currentText,
    };
  return {
    current: currentText,
    base: kind === 'new'
      ? undefined
      : manifestText({
        manifest: { entries: baseEntries },
        style: kind === 'reformatted' ? manifestStyle(tool) : style,
      }),
  };
}
