# Handover: AGENTS.md compaction (2026-05-23)

## Task

Compact AGENTS.md without losing information.
Hard target: under 50000 chars. User stretch goal: ~48000 chars.
Current: AGENTS.md is 49690 chars (under 50k, NOT yet at 48k). Work remains.

## Approach (agreed with user)

- AGENTS.md holds terse enforceable rules only: what/when, the cue, and the tokens/paths/commands needed to act.
- PHILOSOPHY.AGENTS.md is a "dump doc": the why/rationale/mechanism/examples behind each rule. Dump generously.
- No information loss is defined as: every original AGENTS.md backtick token, rule, and example appears in AGENTS.md union PHILOSOPHY.AGENTS.md, except four user-authorized drops (see below).

## Done (all committed; working tree clean)

Commits, newest first:

- 9bb073e6 philosophy changelog (Stats and decisions 2026-05-23)
- 964a38a9 semantic line breaks on AGENTS.md prose
- cf45db4b finish relocation; AGENTS.md under 50k
- 1530cc76 relocate rule rationale part 1
- 029ded56 apply philosophy-doc compression rubric (aggressive cuts)
- 7a75abf6 lossless pass; Critical hot paths index converted to cross-references

What changed:

- Index converted to pure cross-references; "Handing off manual actions" merged into "Before claiming inability" (pre-response checklist item 10 reference rewired).
- Relocated to PHILOSOPHY.AGENTS.md section "Relocated rule rationale (2026-05-23)": bun-test misreport mechanism, const-narrowing-in-declarations, cli-git tool-cache allowlist, bash-output-filter mechanism, resource-exhaustion example set, max-lines split-pattern examples, name-verification inline-citation examples, cite-source failure shape, AGENTS.md-growth discipline, proactivity guardrail quote, measure-vs-ask command recipes, search-result failure modes, third-party investigation and replacement-audit detail.
- Prose abbreviations applied in AGENTS.md text only (never in backtick tokens, filenames, code blocks, or the hedge section): config to conf, source to src, documentation to docs, directory to dir.
- Four user-authorized DROPS (cut, not relocated): the generic shell-utility example list (`jq`/`magick`/`pdftotext`; `ffmpeg`/`pandoc` survive incidentally in an older philosophy changelog line; `agent-browser` kept in AGENTS.md); the `gh api .../comments` commit-comment syntax; the "logical unit" definition; the push-authorization restatement (duplicates harness Git Safety Protocol).
- Semantic line breaks applied to AGENTS.md prose paragraphs at sentence/clause boundaries; numbered checklist items and rule bullets deliberately kept single-line.
- CLAUDE.md regenerated (gitignored; produced by `mise run file-enforcer`).

## Remaining work

1.  Cut roughly 1700+ more chars from AGENTS.md to reach ~48000, by relocating more why/detail to PHILOSOPHY.AGENTS.md (same split method). Candidate passages whose detail can still move while leaving a terse rule in AGENTS.md: the "Before claiming inability" GUI/auth/hardware bridge specifics (`xdotool`/`wtype`/`ydotool`/`expect`); follow-document-pointers example; verify-on-throwaway guard-blocking rationale (second paragraph); choosing-technology six vendor layers; the Linting block-level oxlint-disable ordering detail; the `const` over `let` lint-rule remediation sub-bullets.
2.  Keep verbatim in AGENTS.md: the "Hedge phrases that signal a skipped step" list (mirrors the hardcoded `ccsr` trigger set in `packages/claude-code-plugins/source/src/handlers/stop-reminders/uncertainty-phrases.ts`), all fenced code blocks, the 12 quoted `See "<section>"` cross-reference targets, and the moment-of-decision top-level section order.
3.  After reaching ~48k: regenerate CLAUDE.md, run markdownlint, commit, then a final advisor review.

## Verification (run before and after each batch)

Rebuild the original-token baseline (the /tmp copies will not survive compaction):

```bash
git show 7a75abf6^:AGENTS.md | rg -o '`+[^`]+`+' | sort -u > /tmp/agents-tokens-before.txt
```

Union token check (must list ONLY the four authorized drops: `jq`, `magick`, `pdftotext`, the `gh api` command):

```bash
cat <(rg -o '`+[^`]+`+' AGENTS.md) <(rg -o '`+[^`]+`+' PHILOSOPHY.AGENTS.md) | sort -u > /tmp/union.txt
comm -23 /tmp/agents-tokens-before.txt /tmp/union.txt
```

Other checks:

- Hedge intact: extract quoted strings from the `### Hedge phrases` ... `### Exhaust evidence` range of AGENTS.md and confirm none dropped.
- Code blocks intact: `awk '/^```/{f=!f;print;next} f' AGENTS.md` diff against the same on `7a75abf6^:AGENTS.md`.
- Cross-references valid: `rg -or '$1' '[Ss]ee "([^"]+)"' AGENTS.md` targets must be a subset of `rg -o '^#{2,4} .+' AGENTS.md | sed 's/^#* //'` headings.
- markdownlint: `mise run lint:markdownlint -- AGENTS.md PHILOSOPHY.AGENTS.md` (expect 0 errors).
- Size: `wc -c < AGENTS.md` (target ~48000, hard ceiling 50000).

## Conventions and gotchas

- Commit with an explicit pathspec; the cli-git guard rejects commit-only without one: `git commit -F - AGENTS.md PHILOSOPHY.AGENTS.md`.
- CLAUDE.md is gitignored (`.gitignore:331`); never hand-edit it. It is `mise run file-enforcer` output that prepends a spawn-sessions preamble and cats AGENTS.md.
- AGENTS.md prose now uses semantic line breaks, so Edit old_strings target single short lines (one sentence/clause), which is reliable. A content-preserving reformatter for new prose is at `/tmp/reformat-semantic.ts` (only swaps the space after ". "/"; " for a newline; gate aborts if non-whitespace content changes).
- Do not relocate the hedge list, code blocks, or cross-ref target headings out of AGENTS.md.
