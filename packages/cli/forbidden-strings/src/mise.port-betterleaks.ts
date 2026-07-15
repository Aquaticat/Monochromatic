// What:     Port the betterleaks default ruleset to the forbidden-strings
//           built-in baseline. Input is the upstream betterleaks
//           configuration TOML stored verbatim under `data/`; output is
//           written to `<package>/data/builtin-rules.txt` at run time,
//           where `lib.rs` embeds it into the binary via `include_str!`
//           (see doc/decision/gitignore-negations.md).
// Why:      Forbidden-strings is rules-out-of-band by design, but most
//           teams want a sane starting deny-list of common credential
//           shapes. Rather than maintain that list ourselves, we port
//           betterleaks' default config and document every conversion
//           and intentional omission. Re-port by replacing
//           `data/betterleaks-default-config.toml` with a fresh upstream
//           dump and re-running this script.
//
// Source TOML attribution:
//   Repo:    https://github.com/betterleaks/betterleaks
//   File:    config/betterleaks.toml
//   Commit:  007410ecca31fcbaff3a3de027cf6eeca59310f1 (2026-04-29)
//   License: MIT
//
// Conversions performed during port:
//   - `(?P<name>...)`         -> `(?:...)`            (resharp parses
//                                                      named groups but
//                                                      has no captures)
//   - lazy quantifiers        -> greedy form          (resharp errors on
//     `*?` `+?` `??` `{n,m}?`                          lazy quantifiers)
//   - `path = '''...'''`      -> dropped (with note)  (forbidden-strings
//                                                      has no per-rule
//                                                      path scoping; the
//                                                      rule fires on
//                                                      every scanned file)
//   - `keywords = [...]`      -> dropped              (resharp engine
//                                                      builds its own
//                                                      Aho-Corasick gate
//                                                      from the regex
//                                                      literal prefix)
//   - `filter = '''...'''`    -> dropped (with note)  (entropy / string
//                                                      allowlists have
//                                                      no equivalent)
//   - `validate = '''...'''`  -> dropped              (CEL validation has
//                                                      no equivalent)
//   - `[[rules.allowlists]]`  -> dropped              (allowlist-by-regex
//                                                      no equivalent)
//   - `[[rules.required]]`    -> kept regex, lost     (cannot enforce
//                                composite intent     "must be near rule
//                                                      X" in this engine)
//   - `secretGroup = N`       -> note emitted; the    (engine reports
//                                redacted match span  the whole match
//                                widens to the full   span; secretGroup
//                                regex                narrowing lost)
//
// Rules dropped wholesale (not portable; see comments inline):
//   - `generic-api-key`              relies on a ~1000-entry word
//                                    allowlist + entropy <= 3.5; firing
//                                    without them produces near-100%
//                                    false positives.
//   - rules with `skipReport = true` upstream marks them as
//                                    composite-helpers only (e.g.
//                                    `aws-secret-access-key`,
//                                    `ovh-application-key`,
//                                    `polymarket-api-secret`): they
//                                    have no useful standalone signal.
//   - `pkcs12-file`                  path-only rule (no regex field);
//                                    forbidden-strings has no path-only
//                                    mode.

import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import { fileURLToPath, } from 'node:url';

import { RELAXATIONS, } from './port-betterleaks-relaxations.ts';

/**
 * One rule extracted from the upstream TOML, before conversion.
 */
type RawRule = {
  readonly id: string;
  readonly description: string;
  readonly regex: string;
  readonly pathScope: string | undefined;
  readonly secretGroup: number | undefined;
  readonly skipReport: boolean;
  readonly hasRequired: boolean;
};

/** Escape resharp-only meta characters that PCRE treats as literal: `~`,
 *  `_`, `&`. `~` is the resharp complement operator, `_` is the universal
 *  wildcard, `&` is intersection. Outside a character class these need
 *  backslash escapes; inside `[...]` they're already literal (resharp's
 *  class-level operators are doubled, e.g. `[A&&B]`).
 *
 *  The walker tracks whether the cursor is inside `[...]`, skips `\X`
 *  escape sequences verbatim (so existing escapes are preserved), and
 *  treats `]` as a class terminator unless it appears in the
 *  literal-`]` position immediately after `[` or `[^`.
 */
function escapeResharpOnlyMeta({ pattern, }: { readonly pattern: string; },): string {
  /**
   * Accumulator for the rewritten pattern, built char-by-char.
   */
  let out = '';
  /**
   * Cursor into `pattern`; advanced by one or two chars per iteration.
   */
  let i = 0;
  /**
   * Tracks whether the cursor currently sits inside a `[...]` character class.
   */
  let inClass = false;
  /**
   * Index where the current class body begins (right after `[` or `[^`).
   *
   * Used to recognise the literal-`]` position: a `]` at `classBodyStart` is
   * a literal character, not the class terminator.
   */
  let classBodyStart = -1;
  /**
   * Resharp-only meta characters that need backslash-escaping outside `[...]`.
   */
  const META: ReadonlySet<string> = new Set([
    '~',
    '_',
    '&',
  ],);
  while (i < pattern
    .length) {
    /**
     * Current character under the cursor; shorthand to avoid repeating `pattern[i]!`.
     */
    const c = pattern[i]!;
    // Pass an escape sequence through unmodified (consumes two chars).
    if ((c === '\\') && ((i + 1) < pattern
      .length)) {
      out += pattern.slice(
        i,
        i + 2,
      );
      i += 2;
      continue;
    }
    if (!inClass) {
      if (c === '[') {
        inClass = true;
        out += c;
        i += 1;
        // After `[`, an optional `^` belongs to the class header.
        if (pattern[i]
          === '^') {
          out += pattern[i];
          i += 1;
        }
        classBodyStart = i;
        continue;
      }
      if (META.has(c,)) {
        out += `\\${c}`;
        i += 1;
        continue;
      }
      out += c;
      i += 1;
      continue;
    }
    // Inside class.
    if ((c === ']') && (i !== classBodyStart)) {
      inClass = false;
      out += c;
      i += 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/**
 * Convert a betterleaks-style PCRE regex to resharp-compatible form, finishing
 * with {@link escapeResharpOnlyMeta} for the resharp-only meta characters.
 */
function pcreToResharp({ pattern, }: { readonly pattern: string; },): string {
  /**
   * Working copy threaded through the three rewrite passes below.
   */
  let out = pattern;
  // Drop named-capture syntax: `(?P<name>...)` -> `(?:...)`. Resharp
  // parses the named form but has no captures; making them non-capturing
  // is the cleanest signal of intent.
  out = out.replaceAll(
    /\(\?P<[A-Za-z_][A-Za-z0-9_]*>/g,
    '(?:',
  );
  // Strip the trailing `?` in lazy quantifier suffixes: `*?` `+?` `??`
  // and `}?` (the latter closes `{n}?`/`{n,m}?`/`{n,}?`). Resharp uses
  // leftmost-longest semantics and errors on explicit lazy markers; the
  // greedy form is the closest available behavior.
  // Group-prefix forms `(?:`, `(?=`, `(?!`, `(?<=`, `(?<!` do not
  // match this pattern: the `?` there sits directly after `(`, never
  // after `* + ? }`.
  out = out.replaceAll(
    /([*+?}])\?/g,
    '$1',
  );
  // Escape resharp-only meta characters (`~`, `_`, `&`) that PCRE treats
  // as literal.
  out = escapeResharpOnlyMeta({ pattern: out, },);
  return out;
}

/**
 * Parse the betterleaks TOML and yield the subset of fields we care about,
 * one {@link RawRule} per parsed entry.
 */
function parseRules({ toml, }: { readonly toml: string; },): readonly RawRule[] {
  /**
   * Line-split TOML so the parser can step line-by-line via index `i`.
   */
  const lines = toml.split('\n',);
  /**
   * Accumulator that collects every successfully parsed rule.
   */
  const out: RawRule[] = [];
  /**
   * Cursor into `lines`; mutated by the nested helpers as well.
   */
  let i = 0;

  /** Read a triple-quoted string starting at `lines[i]` after the `=`.
   *  Advances `i` past the closing `'''` line. */
  function readTripleQuoted({ initial, }: { readonly initial: string; },): string {
    // initial is the substring after `'''` on the opening line.
    if (initial.includes("'''",)) {
      /**
       * Position of the closing `'''` on the same line as the opener.
       */
      const end = initial.indexOf("'''",);
      i += 1;
      return initial.slice(
        0,
        end,
      );
    }
    /**
     * Accumulator for the multi-line body; first slot holds the opening-line remainder.
     */
    const parts: string[] = [initial,];
    i += 1;
    while ((i < lines
      .length) && (!lines[i]!
        .includes("'''",))) {
      parts.push(lines[i]!,);
      i += 1;
    }
    if (i < lines
      .length) {
      /**
       * Closing line containing the terminating `'''`.
       */
      const close = lines[i]!;
      /**
       * Position of `'''` inside `close`, used to trim the trailing content.
       */
      const end = close.indexOf("'''",);
      parts.push(close.slice(
        0,
        end,
      ),);
      i += 1;
    }
    return parts.join('\n',);
  }

  while (i < lines
    .length) {
    /**
     * Current TOML line at the cursor, tested for table headers.
     */
    const line = lines[i]!;
    // Look for top-level rule opener `[[rules]]` (not `[[rules.something]]`).
    if (/^\[\[rules]]\s*$/.test(line,)) {
      i += 1;
      /**
       * Required `id = "..."` of the current rule; rule is dropped if missing.
       */
      let id: string | undefined;
      /**
       * Required `description = "..."` of the current rule.
       */
      let description: string | undefined;
      /**
       * Required `regex = '''...'''` body; dropped if missing.
       */
      let regex: string | undefined;
      /**
       * Optional upstream `path = '''...'''` scope; preserved as a note in the output.
       */
      let pathScope: string | undefined;
      /**
       * Optional `secretGroup = N` redaction span; preserved as a note in the output.
       */
      let secretGroup: number | undefined;
      /**
       * Upstream `skipReport = true` marker; suppresses this rule from emission.
       */
      let skipReport = false;
      /**
       * Set when the rule body contains `[[rules.required]]`; preserved as a note.
       */
      let hasRequired = false;
      // Scan rule body until the next top-level table marker.
      while (i < lines
        .length) {
        /**
         * Current line inside the rule body.
         */
        const rl = lines[i]!;
        // Sub-tables of the current rule: `[[rules.required]]` /
        // `[[rules.allowlists]]`. Mark `hasRequired` when applicable
        // and skip through their bodies.
        /**
         * Capture of any `[[rules.<name>]]` sub-table header at the cursor.
         */
        const subTableMatch = /^\[\[rules\.([\w]+)]]\s*$/.exec(rl,);
        if (subTableMatch !== null) {
          if (subTableMatch[1]
            === 'required')
            hasRequired = true;
          i += 1;
          while (
            (i < lines
              .length)
            && (!(lines[i]!).startsWith("[",))
          ) {
            i += 1;
          }
          continue;
        }
        // Top-level table marker (next `[[rules]]` or `[other]`): end of rule.
        if (rl.startsWith('[',))
          break;
        // Field extractors. Each consumes its own lines via `i`.
        /**
         * Match for the `id = "..."` field.
         */
        const idM = /^id\s*=\s*"([^"]*)"/.exec(rl,);
        if (idM !== null) {
          id = idM[1];
          i += 1;
          continue;
        }
        /**
         * Match for the `description = "..."` field; capture handles `\"` escapes.
         */
        const descM = /^description\s*=\s*"((?:[^"\\]|\\.)*)"/.exec(rl,);
        if (descM !== null) {
          description = descM[1]!
            .replaceAll(
            String.raw`\"`,
            '"',
          );
          i += 1;
          continue;
        }
        /**
         * Match for `regex = '''` opening the triple-quoted body.
         */
        const regexOpen = /^regex\s*=\s*'''/.exec(rl,);
        if (regexOpen !== null) {
          /**
           * Remainder of the opening line after `regex = '''`, passed to the body reader.
           */
          const initial = rl.slice(regexOpen[0]!
            .length,);
          regex = readTripleQuoted({ initial, },);
          continue;
        }
        /**
         * Match for `path = '''` opening a triple-quoted path scope.
         */
        const pathOpen = /^path\s*=\s*'''/.exec(rl,);
        if (pathOpen !== null) {
          /**
           * Remainder of the opening line after `path = '''`, passed to the body reader.
           */
          const initial = rl.slice(pathOpen[0]!
            .length,);
          pathScope = readTripleQuoted({ initial, },);
          continue;
        }
        /**
         * Match for the optional `secretGroup = N` capture-group selector.
         */
        const sgM = /^secretGroup\s*=\s*(\d+)/.exec(rl,);
        if (sgM !== null) {
          secretGroup = Number.parseInt(
            sgM[1]!,
            10,
          );
          i += 1;
          continue;
        }
        if (/^skipReport\s*=\s*true/.test(rl,)) {
          skipReport = true;
          i += 1;
          continue;
        }
        i += 1;
      }
      if (
        (id !== undefined)
        && (description !== undefined)
          && (regex !== undefined)
      ) {
        out.push({
          id,
          description,
          regex,
          pathScope,
          secretGroup,
          skipReport,
          hasRequired,
        },);
      }
      continue;
    }
    i += 1;
  }
  return out;
}

/**
 * Rules to drop unconditionally.
 */
const DROPPED_BY_ID: ReadonlyMap<string, string> = new Map([
  // Without the ~1000-entry word allowlist + entropy filter this rule
  // fires on practically anything labeled `key=` / `token=`.
  [
    'generic-api-key',
    'no-allowlist-no-entropy',
  ],
  // Pattern combines `(?s:.){0,N}` scope-flag dot, four nested
  // alternation arms, and shared inner structure. Resharp's algebra
  // pass refuses with `Algebra(UnsupportedPattern)`. Upstream gates
  // this rule with a `*.ya?ml$` path filter we already lose; without
  // path scoping the rule is also low signal.
  [
    'kubernetes-secret-yaml',
    'algebra-unsupported',
  ],
  // Multi-arm alternation with multiple `(?i)` toggles, single-quote
  // and double-quote variants, and four label sub-arms. Restructuring
  // into a resharp-acceptable form would lose more signal than it
  // preserves; the curl deny-list shape `curl ... -H "Authorization:
  // Bearer ..."` is also covered indirectly by the per-vendor token
  // rules (github-pat, openai-api-key, etc.) firing on the bearer
  // value itself.
  [
    'curl-auth-header',
    'multi-arm-(?i)-not-relaxable',
  ],
],);

/**
 * Render one rule as a forbidden-strings entry (comments + regex line),
 * applying any {@link RELAXATIONS} entry before converting via {@link pcreToResharp}.
 */
function renderRule({ rule, }: { readonly rule: RawRule; },): string {
  /**
   * Accumulator for the output block; joined with newlines at the end.
   */
  const lines: string[] = [];
  lines.push(
    `# === ${rule.id} ===`,
    `# ${rule.description}`
  );
  if (rule.pathScope
    !== undefined) {
    lines.push(
      `# NOTE: upstream restricts this rule to files matching: ${rule.pathScope}`,
      '#       Forbidden-strings has no per-rule path scoping; the rule fires on every scanned file.'
    );
  }
  if (rule.secretGroup
    !== undefined) {
    lines.push(
      `# NOTE: upstream extracts capture group ${rule.secretGroup} as the secret for redaction.`,
      '#       Forbidden-strings reports the full match span; the narrowing is lost.'
    );
  }
  if (rule.hasRequired) {
    lines.push(
      "# NOTE: upstream requires another rule's match nearby ([[rules.required]]).",
      '#       Forbidden-strings cannot enforce composite proximity rules; the regex fires standalone.'
    );
  }
  /**
   * Optional relaxation for this rule id; rewrites the regex before conversion.
   */
  const relaxation = RELAXATIONS.get(rule.id,);
  /**
   * Working regex, starting from the upstream form and possibly relaxed below.
   */
  let pattern = rule.regex;
  if (relaxation?.transform
    !== undefined) {
    pattern = relaxation.transform(pattern,);
    lines.push(`# RELAXATION: ${relaxation.note}`,);
  }
  else if (relaxation !== undefined) {
    lines.push(`# RELAXATION: ${relaxation.note}`,);
  }
  /**
   * Resharp-compatible form of the pattern, ready for final relaxation.
   */
  const convertedBase = pcreToResharp({ pattern, },);
  /**
   * Final emitted resharp form, including engine-specific algebra relaxations.
   */
  const converted = relaxation?.convertedTransform?.(convertedBase,)
    ?? convertedBase;
  lines.push(
    `/${converted}/`,
    ''
  );
  return lines.join('\n',);
}

/**
 * Banner prepended to the generated built-in baseline file.
 *
 * Documents that the file is generated, names the source TOML and converter
 * script, and reminds readers of forbidden-strings' line-level grammar.
 */
const HEADER = `# forbidden-strings built-in baseline deny-list.
#
# THIS FILE IS GENERATED. Do not edit by hand. Source of truth is
# packages/cli/forbidden-strings/src/mise.port-betterleaks.ts
# plus the upstream TOML at
# packages/cli/forbidden-strings/data/betterleaks-default-config.toml.
# Re-generate via:
#   mise run //packages/cli/forbidden-strings:generate:rules
#
# Composition:
#   - This file ports the betterleaks default ruleset into
#     forbidden-strings format. It is a sane baseline of common
#     credential shapes (PEM, AWS, Slack, GitHub PAT, etc.) plus
#     resharp set-algebra demonstrations.
#   - The build embeds it into the forbidden-strings binary via
#     \`include_str!\`; the \`--builtin-rules\` flag appends it to
#     whatever rules file resolves at scan time (and scans with it
#     alone when the implicit default rules file is absent). Without
#     the flag the scanner never reads these rules.
#
# Attribution:
#   Rules are ported from betterleaks' default configuration
#   (https://github.com/betterleaks/betterleaks, MIT-licensed). The port
#   is mechanical and lossy -- entropy filters, CEL validate steps,
#   keyword prefilters, and allowlists are dropped because the
#   forbidden-strings engine has no equivalent. Expect more false
#   positives than betterleaks would produce; consult the converter
#   source for the full list of conversions and intentional omissions.
#
# Format reminder:
#   - Bare line                = case-sensitive literal substring
#   - /PATTERN/FLAGS           = regex (resharp; supports A&B, ~(A))
#   - Lines starting with \`#\`  = comment
#   - Empty lines              = ignored
#
# A literal that itself looks like /.../flags must be expressed as a regex
# (escape the slashes), e.g. ban literal \`/etc/passwd\` as \`/\\/etc\\/passwd/\`.

`;

/**
 * Trailer appended to the generated built-in baseline file.
 *
 * Includes two resharp-only set-algebra demonstrations (intersection and
 * complement) so consumers can see capabilities that pure-PCRE engines lack.
 */
const FOOTER = `# === resharp set-algebra demonstrations (engine-specific) ===
#
# Resharp extends standard regex with two top-level set operators that
# pure-PCRE engines lack:
#   - A&B   intersection: matches strings matched by both A and B
#   - ~(A)  complement:   matches strings that do NOT match A
# Combined, these express "match X but not Y" without lookaround. PCRE
# engines (gitleaks, trufflehog, secretlint, plain RE2) cannot do this;
# the workaround is per-rule allowlists, which scale badly.

# Reads as: "match any 6-digit BUILD_ tag, EXCEPT the all-zeros placeholder."
/BUILD_[0-9]{6}&~(BUILD_000000)/

# Intersection composed with two complements: ban any 32-char hex hash
# under \`RELEASE_TAG_\`, except the documented placeholders.
# The complements inline their quantifier bodies: \`0{32}\` is a
# quantified literal (not a quantified group), and the deadbeef
# placeholder is written as 16 concatenated unquantified
# \`(de|ad|be|ef)\` groups (32 chars total). Either form avoids
# resharp Bug E (intersection co-occurring with a \`)\`-quantifier
# hangs \`calc_prefix_sets_inner\`; see doc/troubleshooting/resharp.md
# Bug E) and is enforced by the
# \`complement_intersection_quantified_group\` pre-validator.
/RELEASE_TAG_[a-f0-9]{32}&~(RELEASE_TAG_0{32})&~(RELEASE_TAG_${
  '(de|ad|be|ef)'.repeat(16,)
})/
`;

/**
 * Entry point. Reads the upstream TOML, extracts rules via {@link parseRules},
 * and writes each kept rule through {@link renderRule}.
 */
async function main(): Promise<void> {
  /**
   * Directory holding this script, used as the anchor for path resolution.
   */
  const here = import.meta.dirname;
  /**
   * Path to the verbatim upstream TOML; input to the port.
   */
  const tomlPath = join(
    here,
    '..',
    'data',
    'betterleaks-default-config.toml',
  );
  /**
   * Path to the generated baseline inside the package, embedded into the
   * binary by `lib.rs` via `include_str!` and activated by the
   * `--builtin-rules` flag.
   */
  const outPath = join(
    here,
    '..',
    'data',
    'builtin-rules.txt',
  );

  /**
   * Verbatim upstream TOML contents read from disk.
   */
  const toml = await readFile(
    tomlPath,
    'utf8',
  );
  /**
   * Every rule parsed from the TOML, pre-filter.
   */
  const all = parseRules({ toml, },);

  /**
   * Rules that survive the drop filter and will be rendered into the output.
   */
  const kept: RawRule[] = [];
  /**
   * Rules excluded from output, paired with the reason for the exclusion.
   */
  const dropped: {
    rule: RawRule;
    reason: string;
  }[] = [];
  for (const rule of all) {
    if (rule.skipReport) {
      dropped.push({
        rule,
        reason: 'skipReport',
      },);
      continue;
    }
    /**
     * Lookup of the rule id against {@link DROPPED_BY_ID}; non-undefined means dropped.
     */
    const dropReason = DROPPED_BY_ID.get(rule.id,);
    if (dropReason !== undefined) {
      dropped.push({
        rule,
        reason: dropReason,
      },);
      continue;
    }
    kept.push(rule,);
  }

  /**
   * Concatenated rule blocks rendered between the header and footer.
   */
  const body = kept
    .map(function rulePass(rule,): string {
      return renderRule({ rule, },);
    },)
    .join('',);

  /**
   * Full output file contents written to disk.
   */
  const content = `${HEADER}${body}${FOOTER}`;
  await writeFile(
    outPath,
    content,
    'utf8',
  );
  console.log(
    `wrote ${outPath} (${kept.length} rules kept, ${dropped.length} dropped)`,
  );
  if (dropped.length
    > 0) {
    console.log('  dropped:',);
    for (const {
      rule,
      reason,
    } of dropped) {
      console.log(`    ${rule.id} (${reason})`,);
    }
  }
}

await main();
