# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Policy: no cached context files

This repo intentionally does **not** maintain `CONTEXT.md`,
 `CONTEXT-MAP.md`,
 or `doc/adr/` directories.
 Cached summaries stale quickly and create false confidence.
 Instead:

- **Read the relevant source code directly** on every probe.
   Use codebase search,
   `rg`,
   and file reads to build understanding from scratch.
- **Do not create** `CONTEXT.md`,
   `CONTEXT-MAP.md`,
   or `doc/adr/` (even if a skill's default instructions suggest it).
- **Do not flag** their absence or suggest creating them.

## Vocabulary

When naming a domain concept in output (issue title,
 refactor proposal,
 hypothesis,
 test name),
 infer the project's terms from the code you just read,
 not from a glossary that doesn't exist.
 If you're unsure which term the project prefers,
 search the codebase for both candidates and use whichever appears more often.

## Architectural decisions

Past decisions are recorded only in git history and code structure.
 When you need to understand why something was done a certain way,
 trace the code;
 don't assume a summary file will tell you.
