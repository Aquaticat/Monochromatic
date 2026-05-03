// What:     Port the betterleaks default ruleset to a forbidden-strings
//           example file. Input is the upstream betterleaks
//           configuration TOML stored verbatim under `data/`; output is
//           written to `<repo>/forbidden-strings.local.example.txt` at
//           run time.
// Why:      Forbidden-strings is rules-out-of-band by design, but most
//           teams want a sane starting deny-list of common credential
//           shapes. Rather than maintain that list ourselves, we port
//           betterleaks' default config and document every conversion
//           and intentional omission. Re-port by replacing
//           `data/betterleaks-default-config.toml` with a fresh upstream
//           dump and re-running this script.
// TS map:   Plain Bun-runnable TS, no framework.
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
//                                    `polymarket-api-secret`) -- they
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

/** One rule extracted from the upstream TOML, before conversion. */
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
function escapeResharpOnlyMeta({ pattern, }: { pattern: string; },): string {
  let out = '';
  let i = 0;
  let inClass = false;
  let classBodyStart = -1;
  const META: ReadonlySet<string> = new Set(['~', '_', '&',],);
  while (i < pattern.length) {
    const c = pattern[i]!;
    // Pass an escape sequence through unmodified (consumes two chars).
    if (c === '\\' && i + 1 < pattern.length) {
      out += pattern.slice(i, i + 2,);
      i += 2;
      continue;
    }
    if (!inClass) {
      if (c === '[') {
        inClass = true;
        out += c;
        i += 1;
        // After `[`, an optional `^` belongs to the class header.
        if (pattern[i] === '^') {
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
    if (c === ']' && i !== classBodyStart) {
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

/** Convert a betterleaks-style PCRE regex to resharp-compatible form. */
function pcreToResharp({ pattern, }: { pattern: string; },): string {
  let out = pattern;
  // Drop named-capture syntax: `(?P<name>...)` -> `(?:...)`. Resharp
  // parses the named form but has no captures; making them non-capturing
  // is the cleanest signal of intent.
  out = out.replace(
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
  out = out.replace(/([*+?}])\?/g, '$1',);
  // Escape resharp-only meta characters (`~`, `_`, `&`) that PCRE treats
  // as literal.
  out = escapeResharpOnlyMeta({ pattern: out, },);
  return out;
}

/** Parse the betterleaks TOML and yield the subset of fields we care about. */
function parseRules({ toml, }: { toml: string; },): readonly RawRule[] {
  const lines = toml.split('\n',);
  const out: RawRule[] = [];
  let i = 0;

  /** Read a triple-quoted string starting at `lines[i]` after the `=`.
   *  Advances `i` past the closing `'''` line. */
  function readTripleQuoted({ initial, }: { initial: string; },): string {
    // initial is the substring after `'''` on the opening line.
    if (initial.includes('\'\'\'',)) {
      const end = initial.indexOf('\'\'\'',);
      i += 1;
      return initial.slice(0, end,);
    }
    const parts: string[] = [initial,];
    i += 1;
    while (i < lines.length && !lines[i]!.includes('\'\'\'',)) {
      parts.push(lines[i]!,);
      i += 1;
    }
    if (i < lines.length) {
      const close = lines[i]!;
      const end = close.indexOf('\'\'\'',);
      parts.push(close.slice(0, end,),);
      i += 1;
    }
    return parts.join('\n',);
  }

  while (i < lines.length) {
    const line = lines[i]!;
    // Look for top-level rule opener `[[rules]]` (not `[[rules.something]]`).
    if (/^\[\[rules]]\s*$/.test(line,)) {
      i += 1;
      let id: string | undefined;
      let description: string | undefined;
      let regex: string | undefined;
      let pathScope: string | undefined;
      let secretGroup: number | undefined;
      let skipReport = false;
      let hasRequired = false;
      // Scan rule body until the next top-level table marker.
      while (i < lines.length) {
        const rl = lines[i]!;
        // Sub-tables of the current rule: `[[rules.required]]` /
        // `[[rules.allowlists]]`. Mark `hasRequired` when applicable
        // and skip through their bodies.
        const subTableMatch = /^\[\[rules\.([\w]+)]]\s*$/.exec(rl,);
        if (subTableMatch !== null) {
          if (subTableMatch[1] === 'required') {
            hasRequired = true;
          }
          i += 1;
          while (
            i < lines.length
            && !/^\[/.test(lines[i]!,)
          ) {
            i += 1;
          }
          continue;
        }
        // Top-level table marker (next `[[rules]]` or `[other]`) -- end of rule.
        if (/^\[/.test(rl,)) {
          break;
        }
        // Field extractors. Each consumes its own lines via `i`.
        const idM = /^id\s*=\s*"([^"]*)"/.exec(rl,);
        if (idM !== null) {
          id = idM[1];
          i += 1;
          continue;
        }
        const descM = /^description\s*=\s*"((?:[^"\\]|\\.)*)"/.exec(rl,);
        if (descM !== null) {
          description = descM[1]!.replace(/\\"/g, '"',);
          i += 1;
          continue;
        }
        const regexOpen = /^regex\s*=\s*'''/.exec(rl,);
        if (regexOpen !== null) {
          const initial = rl.slice(regexOpen[0]!.length,);
          regex = readTripleQuoted({ initial, },);
          continue;
        }
        const pathOpen = /^path\s*=\s*'''/.exec(rl,);
        if (pathOpen !== null) {
          const initial = rl.slice(pathOpen[0]!.length,);
          pathScope = readTripleQuoted({ initial, },);
          continue;
        }
        const sgM = /^secretGroup\s*=\s*(\d+)/.exec(rl,);
        if (sgM !== null) {
          secretGroup = Number.parseInt(sgM[1]!, 10,);
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
        id !== undefined
        && description !== undefined
        && regex !== undefined
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

/** Rules to drop unconditionally. */
const DROPPED_BY_ID: ReadonlyMap<string, string> = new Map([
  // Without the ~1000-entry word allowlist + entropy filter this rule
  // fires on practically anything labeled `key=` / `token=`.
  ['generic-api-key', 'no-allowlist-no-entropy', ],
  // Pattern combines `(?s:.){0,N}` scope-flag dot, four nested
  // alternation arms, and shared inner structure. Resharp's algebra
  // pass refuses with `Algebra(UnsupportedPattern)`. Upstream gates
  // this rule with a `*.ya?ml$` path filter we already lose; without
  // path scoping the rule is also low signal.
  ['kubernetes-secret-yaml', 'algebra-unsupported', ],
  // Multi-arm alternation with multiple `(?i)` toggles, single-quote
  // and double-quote variants, and four label sub-arms. Restructuring
  // into a resharp-acceptable form would lose more signal than it
  // preserves; the curl deny-list shape `curl ... -H "Authorization:
  // Bearer ..."` is also covered indirectly by the per-vendor token
  // rules (github-pat, openai-api-key, etc.) firing on the bearer
  // value itself.
  ['curl-auth-header', 'multi-arm-(?i)-not-relaxable', ],
],);

/** Render one rule as a forbidden-strings entry (comments + regex line). */
function renderRule({ rule, }: { rule: RawRule; },): string {
  const lines: string[] = [];
  lines.push(`# === ${rule.id} ===`,);
  lines.push(`# ${rule.description}`,);
  if (rule.pathScope !== undefined) {
    lines.push(
      `# NOTE: upstream restricts this rule to files matching: ${rule.pathScope}`,
    );
    lines.push(
      '#       Forbidden-strings has no per-rule path scoping; the rule fires on every scanned file.',
    );
  }
  if (rule.secretGroup !== undefined) {
    lines.push(
      `# NOTE: upstream extracts capture group ${rule.secretGroup} as the secret for redaction.`,
    );
    lines.push(
      '#       Forbidden-strings reports the full match span; the narrowing is lost.',
    );
  }
  if (rule.hasRequired) {
    lines.push(
      '# NOTE: upstream requires another rule\'s match nearby ([[rules.required]]).',
    );
    lines.push(
      '#       Forbidden-strings cannot enforce composite proximity rules; the regex fires standalone.',
    );
  }
  const relaxation = RELAXATIONS.get(rule.id,);
  let pattern = rule.regex;
  if (relaxation !== undefined) {
    pattern = relaxation.transform(pattern,);
    lines.push(`# RELAXATION: ${relaxation.note}`,);
  }
  const converted = pcreToResharp({ pattern, },);
  lines.push(`/${converted}/`,);
  lines.push('',);
  return lines.join('\n',);
}

const HEADER = `# forbidden-strings deny-list (committed example).
#
# THIS FILE IS GENERATED. Do not edit by hand. Source of truth is
# packages/dev-script/forbidden-strings/src/mise.port-betterleaks.ts
# plus the upstream TOML at
# packages/dev-script/forbidden-strings/data/betterleaks-default-config.toml.
# Re-generate via:
#   bun packages/dev-script/forbidden-strings/src/mise.port-betterleaks.ts
#
# Composition:
#   - This file (the committed example) ports the betterleaks default
#     ruleset into forbidden-strings format. It is a sane baseline of
#     common credential shapes (PEM, AWS, Slack, GitHub PAT, etc.) plus
#     resharp set-algebra demonstrations.
#   - For per-repo additions (codenames, partner identifiers, etc.) write
#     them into a gitignored file \`forbidden-strings.append.local.txt\`.
#     File-enforcer concatenates this file plus the append file into
#     \`forbidden-strings.local.txt\` at \`mise run prepare\` time, and
#     the scanner reads that combined file at scan time.
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
/RELEASE_TAG_[a-f0-9]{32}&~(RELEASE_TAG_(00){16})&~(RELEASE_TAG_(de|ad|be|ef){8})/
`;

/** Entry point. */
async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url,),);
  // mise.port-betterleaks.ts lives in packages/dev-script/forbidden-strings/src/.
  // Walk up four levels to land at the repo root.
  const repoRoot = join(here, '..', '..', '..', '..',);
  const tomlPath = join(
    here,
    '..',
    'data',
    'betterleaks-default-config.toml',
  );
  const outPath = join(repoRoot, 'forbidden-strings.local.example.txt',);

  const toml = await readFile(tomlPath, 'utf-8',);
  const all = parseRules({ toml, },);

  const kept: RawRule[] = [];
  const dropped: { rule: RawRule; reason: string; }[] = [];
  for (const rule of all) {
    if (rule.skipReport) {
      dropped.push({ rule, reason: 'skipReport', },);
      continue;
    }
    const dropReason = DROPPED_BY_ID.get(rule.id,);
    if (dropReason !== undefined) {
      dropped.push({ rule, reason: dropReason, },);
      continue;
    }
    kept.push(rule,);
  }

  const body = kept.map(function rulePass(rule,): string {
    return renderRule({ rule, },);
  },).join('',);

  const content = `${HEADER}${body}${FOOTER}`;
  await writeFile(outPath, content, 'utf-8',);
  // eslint-disable-next-line no-console -- CLI script user-facing output
  console.log(
    `wrote ${outPath} (${kept.length} rules kept, ${dropped.length} dropped)`,
  );
  if (dropped.length > 0) {
    // eslint-disable-next-line no-console -- CLI script user-facing output
    console.log('  dropped:',);
    for (const { rule, reason, } of dropped) {
      // eslint-disable-next-line no-console -- CLI script user-facing output
      console.log(`    ${rule.id} (${reason})`,);
    }
  }
}

await main();
