# Troubleshooting

## Explore subagent hallucination on failed sources

**Session:
** `ac49eb01-b03b-4689-98db-d89b5d6e69d5`

The built-in Explore subagent (Haiku 4.5) confidently fabricated a detailed narrative
about why mise lacks a brew backend,
 including fake quotes and invented rationale.
The user had to push back before the main session admitted the answer was fabricated.

### Minimal repro

1. Ask "Why doesn't mise have a brew backend?
   "
2. Claude launches a built-in Explore subagent (Haiku)
3. The subagent fetches `https://github.com/jdx/mise/discussions/1250` via WebFetch
4. The page returns navigation chrome and "Uh oh!
    There was an error while loading":
   the discussion body and comments do not render because GitHub relies on JavaScript
5. Despite having **no usable source content**,
    the subagent synthesizes a plausible answer:
   - Fabricated quote:
      "uncertain appetite for it being in mise directly"
   - Invented narrative:
      "Design Philosophy Differences" and "Scope mismatch"
   - False attribution:
      claims attributed to the discussion that never loaded
6. The main session distills this into a confident answer about "design philosophy mismatch"

### Root cause

Two failures stack:

**Subagent hallucination (Haiku model behavior).
**
When source data is empty or error-state,
 Haiku fills gaps with plausible reasoning
and presents it as sourced fact.
This is a model-level behavior:
 Haiku optimizes for speed and confidence over accuracy.
The built-in Explore subagent has no anti-hallucination guardrails in its system prompt,
and users cannot modify its system prompt or model selection.

**GitHub pages fail to render via WebFetch.
**
GitHub issues,
 PRs,
 and especially discussions use JavaScript-rendered content.
WebFetch and even `linkup-fetch` with `renderJs: true` return error placeholders
instead of discussion comments.
Tested 2026-03-31:

- `WebFetch` on `github.com/jdx/mise/discussions/1250`:
   returns nav chrome only
- `linkup-fetch` with `renderJs: true` on same URL:
   title loads,
   comments return
  "Uh oh!
   There was an error while loading"
- `gh api graphql` for same discussion:
   returns full body and all comments immediately

### Verified solution

Created a custom `research` subagent plugin (`research-agent`) that replaces the built-in
Explore agent for external research tasks.

**Model:
** Sonnet (not Haiku).
 Better hallucination resistance while staying faster than Opus.

**Anti-hallucination rules in system prompt:
**

- Never fabricate quotes or attribute claims to unread sources
- Report source failures explicitly with what was actually returned
- Mark claims as "verified from [source]" or "inferred (no direct source)"
- Structure output with sources consulted and gaps identified

**GitHub content strategy:
**

- `gh api graphql` for discussions (the only method that works reliably)
- `gh api` REST for issues and PRs
- `linkup-fetch` with `renderJs` for non-GitHub documentation sites
- WebFetch as last resort

**Triggering:
** The agent's description targets external research questions
(project decisions,
 GitHub discussions,
 library capabilities).
It does not replace Explore for local codebase searches.

### What does not work

**WebFetch on GitHub discussions.
**
Returns only page chrome.
 The discussion body and comments are JavaScript-rendered
and never appear in the fetched HTML.

**`linkup-fetch` with `renderJs: true` on GitHub discussions.
**
The page title and header render,
 but comments consistently return
"Uh oh!
 There was an error while loading" error placeholders.
Tested on `github.com/jdx/mise/discussions/1250` (2026-03-31).
This may be a GitHub anti-scraping measure or a timing issue with JavaScript hydration.

**CLAUDE.
md rules alone.
**
The hallucination happens inside the subagent,
 which does not read CLAUDE.
md.
Rules in CLAUDE.
md can instruct the main session to verify subagent output,
but cannot prevent the subagent from fabricating in the first place.

**Changing the built-in Explore agent's model or prompt.
**
The Explore agent's system prompt and model (Haiku) are hardcoded in Claude Code.
Users cannot configure them.
 The only option is to create a competing plugin agent
with a better description that gets selected instead.
