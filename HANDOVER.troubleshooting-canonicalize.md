# Handover: canonicalize all TROUBLESHOOTING docs to TROUBLESHOOTING.resharp.md depth

Status: COMPLETE. All 42 substantive docs canonicalized.

## What this task was

User asked to "enhance all existing troubleshooting docs" via the
`troubleshooting-doc` skill, then clarified: **match every doc to the
same depth** as the canonical example `TROUBLESHOOTING.resharp.md`.

Canonical structure (from `.claude/skills/troubleshooting-doc/SKILL.md`):

1. **Title (`#`)**: tool + version + surface trigger + failure mode in
   one line.
2. **Symptom**: verbatim error strings, list of surface patterns.
3. **Root cause**: call chain step by step; every source claim cites
   `path/to/file.ext:LINE` and quotes the relevant code excerpt.
4. **Verification**: version under test (with crates.io checksum,
   commit hash, or release tag), runnable harness, catalogues of
   passing and failing patterns.
5. **Verified workarounds**: each with named tradeoffs.
6. **What does not work**: rejected approaches with reasons.
7. **Draft upstream issue**: gated by the 5-constraint check below,
   wrapped in `~~~md` fence, marked "do not file as-is" unless all
   five constraints hold.

The 5-constraint upstream-filing audit:

1. Is it really upstream's fault?
2. Can upstream fix it?
3. Are they supporting this use case?
4. Will they likely fix it?
5. Have we prototyped a minimal fix compatible with their
   architecture?

Default policy: do not file. Walk every constraint explicitly even
when the answer is "yes"; the audit trail is the point.

## Critical guardrail (from advisor)

**Do not fabricate citations.** If a doc lacks file:line cites and
you cannot clone/verify the source, leave the section without the
citation rather than inventing one.

Where existing docs already have file:line citations from prior
sessions, preserve them. Where there is no real upstream (shell
semantics, internal config, etc.), include the 5-constraint section
anyway and walk through it; the audit trail justifies "decision: no
upstream report."

## Approach taken

Worked file-by-file, **one commit per doc**. Each commit titled
`docs(troubleshooting/<name>): <verb> ...`.

## Done (42 docs)

### From earlier session (7)

1. `TROUBLESHOOTING.stylelint.md`: `48b0c4df`
2. `TROUBLESHOOTING.jsr.md`: `cc094103`
3. `TROUBLESHOOTING.rg.md`: `5db9201f`
4. `TROUBLESHOOTING.bash.md`: `23e35989`
5. `TROUBLESHOOTING.cli-bin.md`: `e09664fb`
6. `TROUBLESHOOTING.dprint.md`: `dffa2c1b`
7. `TROUBLESHOOTING.podman-in-docker.md`: `bee34c7b`

### From the mid session (32)

8. `TROUBLESHOOTING.css-hidden-attribute-specificity.md`: `7bb2ff32`
9. `TROUBLESHOOTING.oxlint.md`: `c2a4e0ba`
10. `TROUBLESHOOTING.cLikeComments.md`: `52cc4bd2`
11. `TROUBLESHOOTING.vscode.md`: `6a752a71`
12. `TROUBLESHOOTING.editors.md`: `bc18f71b`
13. `TROUBLESHOOTING.ghostty-cursor.md`: `b5d93bf0`
14. `TROUBLESHOOTING.bundling.md`: `aa1d623d`
15. `TROUBLESHOOTING.testing.md`: `4bbbef6e`
16. `TROUBLESHOOTING.figma-browser-automation.md`: `f9659fa3`
17. `TROUBLESHOOTING.git-credentials.md`: `c8eab572`
18. `TROUBLESHOOTING.cloudflare-mirror-evaluation.md`: `9e35d9b0`
19. `TROUBLESHOOTING.bun-fs-glob-dotfiles.md`: `d228db7a`
20. `TROUBLESHOOTING.toml.md`: `c2e68175`
21. `TROUBLESHOOTING.hetzner-firewall.md`: `1329ed4f`
22. `TROUBLESHOOTING.bun-fetch-streaming.md`: `13c95e32`
23. `TROUBLESHOOTING.tsdown.md`: `34137e8b`
24. `TROUBLESHOOTING.vlt-jsr.md`: `c2aefda5`
25. `TROUBLESHOOTING.bun-test.md`: `75f8f281`
26. `TROUBLESHOOTING.ios-safari-touch.md`: `b3352b20`
27. `TROUBLESHOOTING.pnpmfile.md`: `7e3c59b7`
28. `TROUBLESHOOTING.performance.build.md` and
    `TROUBLESHOOTING.performance.logging.md`: `9f36ff6f`
29. `TROUBLESHOOTING.tsgolint-no-unnecessary-type-assertion.md`:
    `598a5fb4`
30. `TROUBLESHOOTING.pi-compaction-empty-summary.md`: `765c92c0`
31. `TROUBLESHOOTING.mdx.md`: `8fec90b9`
32. `TROUBLESHOOTING.dprint-exec.md`: `ae5568cc`
33. `TROUBLESHOOTING.rolldown.md`: `de676462`
34. `TROUBLESHOOTING.typeguards.md`: `1dd2d0f1`
35. `TROUBLESHOOTING.css-tooling.md`: `3378bc5b`
36. `TROUBLESHOOTING.typesafe-i18n-regex-redos.md`: `d781de33`
37. `TROUBLESHOOTING.pi-safeguard.md`: `31ab3cf1`
38. `TROUBLESHOOTING.mise-watch.md`: `f7c3fcb9`
39. `TROUBLESHOOTING.claude-code-edit-non-atomic-fallback.md`:
    `fafd4894`

### From this session (3 docs plus style cleanup)

40. `TROUBLESHOOTING.aws-cloudfront-mirror.md`: `d9c3fe7f` (plus
    style cleanup at `b92199b6`)
41. `TROUBLESHOOTING.dependencies.md`: `91078240` (plus style
    cleanup at `b92199b6`)
42. `TROUBLESHOOTING.typescript.md`: `90809c7c`

Plus em-dash style cleanup at `b92199b6` (aws-cloudfront-mirror,
dependencies), H1 title tightening and Verification-section
additions at `f44e2e5a` (all three new docs), and MD040 bare-fence
language tagging at `9c584c70` (aws-cloudfront-mirror only;
dependencies and typescript lint clean as committed).

## Files skipped

Pure indexes (left as-is, they point at sibling docs):

- `TROUBLESHOOTING.md`
- `TROUBLESHOOTING.performance.md`

Canonical itself (skipped):

- `TROUBLESHOOTING.resharp.md`: this IS the gold standard.

Already verified canonical (no changes needed):

- `TROUBLESHOOTING.markdownlint-cli2.md`: verified during the
  mid-session by reading the first 50 lines; structure already
  matches Title / Symptom / Root cause with citations / Verification
  with version under test / Verified workarounds A/B/C with tradeoffs
  / What does not work / 5-constraint "Why we do not file this
  upstream" / Draft upstream issue. No edits required.

Configuration snippets (not real troubleshooting docs):

- `TROUBLESHOOTING.configuration.md`

## Notable patterns observed across the 42 done docs

- Per-bug canonical sections work well for multi-issue docs. The
  shape that consistently fits: ### Symptom / Root cause (with
  source citations) / Verification (with version under test) /
  Verified workaround (with named tradeoff) / What does not work /
  Why we [do not / would] file this upstream (5 constraints) [/
  Draft upstream issue in `~~~md` fence].
- The 5-constraint section is the most common gap from the
  pre-resharp era of docs. Many existing docs had every other
  section but no 5-constraint walk.
- For internal-only "bugs" (shell semantics, internal config,
  by-design firewall posture), the 5-constraint walk concludes "no
  upstream report" but is still worth writing; the audit trail
  justifies the decision.
- For genuinely upstream-fixable bugs with already-filed issues
  (bun-fs-glob-dotfiles #28021, bun-fetch-streaming #17048/#27232,
  rolldown #2758, oxc #10139), the 5-constraint section notes which
  constraints hold and cross-references the existing tracker entry.
- For category-aggregator docs (dependencies, typescript): a
  per-bug 5-constraint walk is the right pattern when each bug has
  a different upstream posture; a single category-level walk is
  acceptable when all entries share the same posture (the
  workspace dependency-substitution policy entries in
  dependencies.md follow this pattern).

## AGENTS.md style gotchas observed this session

- Em-dashes (and ASCII substitutes used as em-dashes) are banned in
  prose per AGENTS.md. Use paired commas or parentheses for asides,
  colon for elaboration, semicolon for linked clauses, period for
  abrupt breaks. The two newly-canonicalized docs
  (aws-cloudfront-mirror, dependencies) initially introduced
  em-dashes; cleanup commit `b92199b6` removed them. The typescript
  doc was cleaned up before initial commit.

## Operational notes

- Working directory: `/var/home/user/Monochromatic`
- Branch: `main`
- AGENTS.md: commit eagerly, one logical unit per commit.
- Co-author footer:
  `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Commit message format:
  `docs(troubleshooting/<name>): <verb> ...` with HEREDOC body
  explaining what was added.
