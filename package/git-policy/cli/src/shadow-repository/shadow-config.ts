/**
 The shadow repository's `config` file, written by cli-git itself.

 `core.repositoryformatversion` and every `extensions.*` key are copied explicitly,
 because Git does not apply them from an included file.
 `core.hooksPath` precedes the include,
 so a real `core.hooksPath` still overrides it;
 `core.worktree`,
 `gc.auto`,
 and `maintenance.auto` follow it,
 so the real config cannot redirect the worktree or start automatic maintenance in the shadow.

 @module
 */
import { runTransactionGit, } from '../policy-engine/commit-transaction-git.ts';

/**
 Strict Git output decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Repository format facts the shadow copies from the real common config.
 */
export type RepositoryFormat = Readonly<{
  /**
   `core.repositoryformatversion`, `0` when unset.
   */
  version: string;
  /**
   Every `extensions.*` key with its value, in file order.
   */
  extensions: readonly (readonly [
    name: string,
    value: string
  ])[];
}>;

/**
 Quotes one value under git-config value syntax.

 The value is always double-quoted,
 so `;`,
 `#`,
 and surrounding whitespace stay literal;
 backslash,
 double quote,
 newline,
 and tab use Git's escapes.

 @param value - raw value

 @returns quoted value text

 @example
 ```ts
 quoteGitConfigValue('/a "b"'); // '"/a \\"b\\""'
 ```
 */
export function quoteGitConfigValue(value: string,): string {
  /**
   Escaped characters.
   */
  const body = Array.from(value,)
    .map(function escapeCharacter(character,): string {
      if (character === '\\')
        return String.raw`\\`;
      if (character === '"')
        return String.raw`\"`;
      if (character === '\n')
        return String.raw`\n`;
      if (character === '\t')
        return String.raw`\t`;
      return character;
    },)
    .join('',);
  return `"${body}"`;
}

/**
 Reads the repository format facts from the real common config file.

 @param gitPath - real Git executable

 @param commonDir - absolute common Git directory

 @returns repository format facts

 @example
 ```ts
 await readRepositoryFormat({ gitPath: '/usr/bin/git', commonDir: '/repo/.git' });
 ```
 */
export async function readRepositoryFormat({
  gitPath,
  commonDir,
}: Readonly<{
  gitPath: string;
  commonDir: string;
}>,): Promise<RepositoryFormat> {
  /**
   NUL-terminated `key\nvalue` entries of the repository config file alone.
   */
  const listing = await runTransactionGit({
    gitPath,
    cwd: commonDir,
    args: [
      'config',
      '--file',
      'config',
      '--null',
      '--list',
    ],
  },);
  /**
   Parsed key and value pairs; a key without a value line is a valueless boolean.
   */
  const entries = DECODER.decode(listing.stdout,)
    .split('\0',)
    .filter(function nonempty(entry,): boolean {
      return entry.length > 0;
    },)
    .map(function splitEntry(entry,): readonly [
      string,
      string
    ] {
      /**
       Key and value separator.
       */
      const newline = entry.indexOf('\n',);
      return newline === (-1)
        ? [
          entry,
          'true',
        ]
        : [
          entry.slice(
            0,
            newline,
          ),
          entry.slice(newline + 1,),
        ];
    },);
  /**
   Last `core.repositoryformatversion` value.
   */
  const version = entries.findLast(function isVersion([key,],): boolean {
    return key.toLowerCase() === 'core.repositoryformatversion';
  },);
  return {
    version: version === undefined ? '0' : version[1],
    extensions: entries
      .filter(function isExtension([key,],): boolean {
        return key.toLowerCase()
          .startsWith('extensions.',);
      },)
      .map(function extensionName([key, value,],): readonly [
        string,
        string
      ] {
        return [
          key.slice('extensions.'.length,),
          value,
        ];
      },),
  };
}

/**
 Formats the shadow `config` file.

 @param format - copied repository format facts

 @param commonDir - absolute real common Git directory

 @param worktreeRoot - absolute worktree root

 @returns config file text

 @example
 ```ts
 formatShadowConfig({ format: { version: '0', extensions: [] }, commonDir: '/repo/.git', worktreeRoot: '/repo' });
 ```
 */
export function formatShadowConfig({
  format,
  commonDir,
  worktreeRoot,
}: Readonly<{
  format: RepositoryFormat;
  commonDir: string;
  worktreeRoot: string;
}>,): string {
  return [
    '[core]',
    `\trepositoryformatversion = ${quoteGitConfigValue(format.version,)}`,
    `\thooksPath = ${quoteGitConfigValue(`${commonDir}/hooks`,)}`,
    ...(format.extensions
      .length
      === 0
      ? []
      : [
        '[extensions]',
        ...format.extensions
          .map(function extensionLine([name, value,],): string {
          return `\t${name} = ${quoteGitConfigValue(value,)}`;
        },),
      ]),
    '[include]',
    `\tpath = ${quoteGitConfigValue(`${commonDir}/config`,)}`,
    '[core]',
    `\tworktree = ${quoteGitConfigValue(worktreeRoot,)}`,
    '[gc]',
    '\tauto = 0',
    '[maintenance]',
    '\tauto = false',
    '',
  ].join('\n',);
}
