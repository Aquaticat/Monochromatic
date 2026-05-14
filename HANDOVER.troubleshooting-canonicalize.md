# Handover: canonicalize all TROUBLESHOOTING docs to TROUBLESHOOTING.resharp.md depth

Status: IN PROGRESS. 7 of ~44 candidate docs done.

## What this task is

User asked to "enhance all existing troubleshooting docs" via the
`troubleshooting-doc` skill, then later clarified: **match every doc to
the same depth** as the canonical example
`TROUBLESHOOTING.resharp.md`.

Canonical structure (from the skill at
`.claude/skills/troubleshooting-doc/SKILL.md`):

1. **Title (`#`)** — tool + version + surface trigger + failure mode in
   one line.
2. **Symptom** — verbatim error strings, list of surface patterns.
3. **Root cause** — call chain step by step; every source claim cites
   `path/to/file.ext:LINE` and quotes the relevant code excerpt.
4. **Verification** — version under test (with crates.io checksum,
   commit hash, or release tag), runnable harness, catalogues of
   passing and failing patterns.
5. **Verified workarounds** — each with named tradeoffs.
6. **What does not work** — rejected approaches with reasons.
7. **Draft upstream issue** — gated by the 5-constraint check below,
   wrapped in `~~~md` fence, marked "do not file as-is" unless all
   five constraints hold.

The 5-constraint upstream-filing audit:

1. Is it really upstream's fault?
2. Can upstream fix it?
3. Are they supporting this use case?
4. Will they likely fix it?
5. Have we prototyped a minimal fix compatible with their architecture?

Default policy: do not file. Walk every constraint explicitly even when
the answer is "yes" — the audit trail is the point.

## Critical guardrail (from advisor)

**Do not fabricate citations.** If a doc lacks file:line cites and you
cannot clone/verify the source, leave the section without the
citation rather than inventing one. The skill says "match its shape
unless the topic genuinely lacks a section." That permits omitting
sections; it does not permit fabricating them.

Where existing docs already have file:line citations from prior
sessions, preserve them. Where there is no real upstream (shell
semantics, internal config, etc.), include the 5-constraint section
anyway and walk through it; the audit trail justifies "decision: no
upstream report."

## Approach already taken

Working file-by-file, **one commit per doc**. Each commit titled
`docs(troubleshooting/<name>): <verb> ...`.

## Done (7 docs)

1. `TROUBLESHOOTING.stylelint.md` — commit `48b0c4df`
2. `TROUBLESHOOTING.jsr.md` — commit `cc094103`
3. `TROUBLESHOOTING.rg.md` — commit `5db9201f`
4. `TROUBLESHOOTING.bash.md` — commit `23e35989`
5. `TROUBLESHOOTING.cli-bin.md` — commit `e09664fb`
6. `TROUBLESHOOTING.dprint.md` — commit `dffa2c1b`
7. `TROUBLESHOOTING.podman-in-docker.md` — commit `bee34c7b`

## Files to skip

Pure indexes (leave as-is, they point at sibling docs):

- `TROUBLESHOOTING.md`
- `TROUBLESHOOTING.performance.md`

Canonical itself (skip):

- `TROUBLESHOOTING.resharp.md` — this IS the gold standard.

Configuration snippets (not a real troubleshooting doc, may want a
separate restructure or merge later; treat as low priority for this
task):

- `TROUBLESHOOTING.configuration.md`

## Remaining (~37 docs)

Already strong, **minor tweaks** to slot into the canonical headings.
Most already have several sections; you mainly need to:

- Rewrite the H1 title to tool+version+trigger+failure mode shape
  (the resharp shape).
- Ensure a "Verification" subsection names version under test.
- Add tradeoff lines to each workaround.
- Add or formalise "What does not work" if implicit prose exists.
- Add the 5-constraint "Why we do not file this upstream" subsection
  (these are often missing; many docs were written before this rule).
- Add the draft upstream issue wrapped in a `~~~md` fence even if you
  decide not to file (it stays as a reference).

Candidates (in rough order of size; tackle small-to-medium first):

- `TROUBLESHOOTING.css-hidden-attribute-specificity.md` (2.5KB)
- `TROUBLESHOOTING.oxlint.md` (2.6KB)
- `TROUBLESHOOTING.cLikeComments.md` (3KB)
- `TROUBLESHOOTING.vscode.md` (3.3KB)
- `TROUBLESHOOTING.editors.md` (3.4KB)
- `TROUBLESHOOTING.ghostty-cursor.md` (3.5KB)
- `TROUBLESHOOTING.bundling.md` (3.8KB)
- `TROUBLESHOOTING.testing.md` (4KB)
- `TROUBLESHOOTING.figma-browser-automation.md` (4KB)
- `TROUBLESHOOTING.git-credentials.md` (4.2KB)
- `TROUBLESHOOTING.cloudflare-mirror-evaluation.md` (4.4KB)
- `TROUBLESHOOTING.bun-fs-glob-dotfiles.md` (4.5KB)
- `TROUBLESHOOTING.toml.md` (4.5KB)
- `TROUBLESHOOTING.hetzner-firewall.md` (4.9KB)
- `TROUBLESHOOTING.bun-fetch-streaming.md` (5.4KB)
- `TROUBLESHOOTING.tsdown.md` (5.7KB)
- `TROUBLESHOOTING.vlt-jsr.md` (6KB)
- `TROUBLESHOOTING.bun-test.md` (6KB)
- `TROUBLESHOOTING.ios-safari-touch.md` (6.3KB)
- `TROUBLESHOOTING.pnpmfile.md` (6.3KB)
- `TROUBLESHOOTING.tsgolint-no-unnecessary-type-assertion.md` (7.4KB)
- `TROUBLESHOOTING.pi-compaction-empty-summary.md` (7.6KB)
- `TROUBLESHOOTING.mdx.md` (7.6KB)
- `TROUBLESHOOTING.dprint-exec.md` (8.6KB)
- `TROUBLESHOOTING.rolldown.md` (9.9KB)
- `TROUBLESHOOTING.typeguards.md` (9.9KB) — currently in "WTF" format,
  needs more structure work than most.
- `TROUBLESHOOTING.css-tooling.md` (11.6KB) — history doc, partially
  canonical.
- `TROUBLESHOOTING.typesafe-i18n-regex-redos.md` (11.8KB) — already
  very close to canonical.
- `TROUBLESHOOTING.markdownlint-cli2.md` (12.2KB) — already fully
  canonical; check 5-constraint section is present (it is).
- `TROUBLESHOOTING.pi-safeguard.md` (13.4KB) — multi-bug, mostly there.
- `TROUBLESHOOTING.claude-code-edit-non-atomic-fallback.md` (15KB) —
  already very close to canonical.
- `TROUBLESHOOTING.mise-watch.md` (19.5KB) — already very canonical.
- `TROUBLESHOOTING.aws-cloudfront-mirror.md` (25KB) — fully canonical
  multi-issue; check 5-constraint and tradeoff coverage on workarounds.
- `TROUBLESHOOTING.dependencies.md` (30KB) — large multi-bug aggregator.
- `TROUBLESHOOTING.typescript.md` (31.3KB) — large multi-bug
  aggregator.

Small simple docs needing more work than the size suggests:

- `TROUBLESHOOTING.performance.build.md` (1.3KB)
- `TROUBLESHOOTING.performance.logging.md` (2.4KB)

## Tasks in TaskList

- #1 Survey all 47 troubleshooting docs — **completed**
- #2 Enhance barebones docs — **completed** (after pivot to "match
  every doc to canonical depth", all docs are in scope; this task is
  superseded by the larger batch).
- #3 Enhance multi-bug aggregators — **in_progress** (podman-in-docker
  done; remaining: editors, configuration, performance.*, typeguards)
- #4 Enhance medium-structure docs — **pending**

Recommend after compact: delete tasks #2-4 and create one
straightforward "enhance N remaining troubleshooting docs to canonical
depth" task plus per-doc subtasks as you start each.

## Notable patterns from the docs already done

- Multi-bug docs (dprint, podman-in-docker) work best when each bug
  becomes its own full section with all seven canonical subsections.
- The 5-constraint section is what's most often missing from existing
  good docs. Plan to add it everywhere even when "no upstream
  applicable" (shell semantics, internal config, etc.).
- For internal-only docs (vscode bind mounts, hetzner-firewall,
  performance.*) the 5-constraint walk concludes "no upstream
  report." That conclusion is still worth writing down so the audit
  trail exists.

## Operational notes

- Working directory: `/var/home/user/Monochromatic`
- Branch: `main`
- AGENTS.md: commit eagerly, one logical unit per commit. Do **not**
  batch.
- Co-author footer: `Co-Authored-By: Claude Opus 4.7 (1M context)
  <noreply@anthropic.com>`
- Commit message format: `docs(troubleshooting/<name>): <verb> ...`
  with HEREDOC body explaining what was added.

## Advisor pause moments

The advisor was consulted once at the start. Re-consult before:

- Committing to a substantial structural change that diverges from the
  per-doc shape used so far.
- Declaring the whole batch done.
