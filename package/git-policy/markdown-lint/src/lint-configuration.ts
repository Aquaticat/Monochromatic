/**
 The one-off monochromatic-lint configuration the policy runs with, so the
 repository's own `monochromatic-lint.config.jsonc` never decides what a commit
 rewrites.

 @module
 */

/**
 Rule whose options carry the policy's `exclude` patterns.
 */
export const LFS_IMAGE_URL_RULE = 'markdown/lfs-image-url';

/**
 Parameters for {@link lintConfiguration}.
 */
export type LintConfigurationParams = Readonly<{
  /**
   Rule ids to enable at `error`.
   */
  rules: readonly string[];
  /**
   gitignore-syntax patterns the `markdown/lfs-image-url` rule must skip.
   */
  exclude: readonly string[];
}>;

/**
 Build the configuration the subprocess runs with: one block selecting every
 Markdown and MDX path, with each selected rule at `error` and the exclude
 patterns as the LFS rule's option. Serialized as JSON, which is valid JSONC,
 so no value is ever spliced into configuration syntax by hand.

 @param rules - rule ids to enable

 @param exclude - patterns the LFS rule skips, relative to the repository root

 @returns configuration file text

 @example
 ```ts
 lintConfiguration({ rules: ['markdown/lfs-image-url'], exclude: ['package/ssg/'] });
 ```
 */
export function lintConfiguration({
  rules,
  exclude,
}: LintConfigurationParams,): string {
  /**
   Rule settings keyed by rule id.
   */
  const settings = Object.fromEntries(rules.map(function ruleSetting(rule: string,): readonly [
    string,
    unknown,
  ] {
    return rule === LFS_IMAGE_URL_RULE
      ? [
        rule,
        {
          severity: 'error',
          exclude: [...exclude,],
        },
      ]
      : [
        rule,
        { severity: 'error', },
      ];
  },),);
  return `${JSON.stringify(
    [
      {
        name: 'cli-git-markdown-autofix',
        files: [
          '**/*.md',
          '**/*.mdx',
        ],
        rules: settings,
      },
    ],
    undefined,
    2,
  )}\n`;
}
