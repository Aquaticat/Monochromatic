# Backtick bare filenames split by semantic line breaks

## Problem

The `semantic-line-breaks` rule in `package/cli/markdown-lint` breaks prose after each break-point character (`,` `.` `;` `:` `?` `!`).
Filenames written bare in prose contain a period,
 so the autofix splits them mid-token:
 `AGENTS.md` becomes `AGENTS.` at end of line with `md` starting the next.
The rule is working as intended;
 the source defect is the missing backticks,
 because inline code spans are skipped by the rule.

`AGENTS.md` itself was fixed in commit `0b1e8d91a`,
 but the same artifact remains across other Markdown files.

## Detection

```bash
rg --line-number --glob '*.md' --glob '!node_modules' --glob '!CLAUDE.md' '(AGENTS|CLAUDE|README|SKILL)\.$' .
```

62 files matched on 2026-07-10;
 rerun the command,
 the count drifts.
That pattern only covers the most common filenames.
Other split tokens can be found by pairing lines ending in `[A-Za-z]\.` with continuation lines starting with an extension-like fragment:

```bash
rg --line-number --glob '*.md' --glob '!node_modules' --glob '!CLAUDE.md' '^ ?(md|ts|json|toml|txt|yaml|lock)\b' .
```

Inspect matches manually;
 short words like `log` and `ts` also start legitimate prose lines.

## Fix recipe

1.  Join the split token onto one line and wrap it in backticks in the source file.
2.  Run `mise run format:markdown <file>` and confirm the reflow is stable,
     then `mise run lint:markdown <file>`.
3.  When the file feeds a generated output (for example `AGENTS.md` feeds `CLAUDE.md`),
     run `mise run sync:files` and commit both.

## Done when

The detection commands return no filename-shaped fragments across tracked Markdown files.
