# Getting a Copilot review on a draft PR

Recorded dance (verified on ieviev/resharp#28,
 2026-06-11).
Agent-executable end to end;
 no manual user action needed.

## What this proves

GitHub Copilot code review does not kick in on a draft PR,
even when explicitly requested.
The review *request*,
 however,
 registers within about one second of the
draft-to-ready transition,
 and once requested,
the review completes and posts even after the PR goes back to draft.
So a PR can collect its Copilot review while staying effectively draft,
with only a seconds-long ready window.

## Steps

1. Open the PR as draft;
    push until CI is green.
2. Mark ready:
    `gh pr ready <n> --repo <owner>/<repo>`.
   Expected outcome:
    Copilot's review request registers immediately.
3. Convert straight back to draft:
    `gh pr ready <n> --repo <owner>/<repo> --undo`.
   Keep the ready window seconds long;
    there is no need to wait for the
   review itself while ready.
   Expected outcome:
    `gh pr view <n> --json isDraft` shows `"isDraft": true`.
4. Poll until the review posts (took ~2 minutes on the verified run):
   `gh api repos/<owner>/<repo>/pulls/<n>/reviews --jq 'length'` flips nonzero,
   or `.../pulls/<n>/comments --jq 'length'` for inline comments.
5. Address every comment:
    code change,
    or a reasoned reply via
   `gh api repos/<owner>/<repo>/pulls/<n>/comments/<comment-id>/replies -f body=...`.
6. Resolve each thread (GraphQL;
    thread ids from the PR's `reviewThreads`):
   `gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "<id>"}) { thread { isResolved } } }'`.
7. Mark ready for real when the user authorizes it.

## What to check

- `gh pr view <n> --json reviewRequests` immediately after step 2 may already
  show the request consumed;
   absence of a pending request does not mean the
  dance failed.
- The posted review author is `copilot-pull-request-reviewer[bot]` with state
  `COMMENTED`.
- After step 6,
   every node in `reviewThreads` reports `isResolved: true`.

## Restore

Nothing to restore;
 the only side effects are the PR's brief ready window
(subscribers may receive one ready-for-review notification) and the review
itself.
