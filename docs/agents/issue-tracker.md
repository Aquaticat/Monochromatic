# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues.
 Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**:
   `gh issue create --title "..." --body "..."`.
   Use a heredoc for multi-line bodies.
- **Read an issue**:
   `gh issue view <number> --comments`,
   filtering comments by `jq` and also fetching labels.
- **List issues**:
   `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**:
   `gh issue comment <number> --body "..."`
- **Apply / remove labels**:
   `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**:
   `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`;
 `gh` does this automatically when run inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Resolution workflow

When the user says "resolve issue N" (or links to a specific issue),
 the verb authorizes the full workflow:
 fix,
 commit,
 and close the issue explicitly via `gh issue close`.
Do not rely on `Closes #N` in the commit body;
 that only fires when the commit lands on the default branch via a PR merge or push event,
 neither of which is guaranteed at the moment you commit.
Close explicitly:

```sh
gh issue close <N> --comment "Resolved in <SHA> (<commit subject>). <one-line summary of what changed>"
```

Reference the commit SHA in the comment so a reader landing on the closed issue can find the change.
