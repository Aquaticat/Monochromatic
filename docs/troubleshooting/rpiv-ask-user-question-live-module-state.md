# `rpiv-ask-user-question` lazy session export becomes non-constructable

## Symptom

`@juicesharp/rpiv-ask-user-question` `1.20.0` accepted a valid tool call but returned:

```text
QuestionnaireSession is not a constructor
```

The session recorded an error `ask_user_question` tool result before any questionnaire rendered.

## Trigger

The failure occurred in a long-running Pi `0.80.6` process after a workspace
`pnpm install --force --filter ...` replaced Pi's pnpm store entry.
The first call could not resolve the old Pi package path from
`view/dialog-builder.ts`.
A temporary compatibility symlink restored that path,
but the next call resolved `QuestionnaireSession` to a value that was not constructable.

The compatibility symlink was removed after evidence capture.
No extension or Pi source patch was applied for this failure.

## Source trace

`ask-user-question.ts:106` in the published package lazily loads the TUI runtime:

```ts
const { QuestionnaireSession } = await import("./state/questionnaire-session.js");
```

Its custom UI callback then invokes:

```ts
const session = new QuestionnaireSession({
  tui,
  theme,
  params: typed,
  itemsByTab,
  done,
});
```

`state/questionnaire-session.ts:55` exports `QuestionnaireSession` as a class.
Pi loads TypeScript extensions with Jiti `2.7.0`,
with `moduleCache: false` in
`@earendil-works/pi-coding-agent/dist/core/extensions/loader.js:308-315`.

A fresh standalone Jiti import using Pi's package aliases returned:

```text
[ 'QuestionnaireSession' ] function QuestionnaireSession
```

The published class is therefore present and constructable in a fresh loader.
The evidence supports stale live-process loader or module namespace state after dependency replacement.
It does not distinguish an extension lazy-import defect from a Pi Jiti lifecycle defect.

## Workaround

Restart Pi after a package-manager operation replaces dependencies used by the active process.
Do not repair old pnpm store paths with compatibility symlinks;
that can mix module identities in one loader lifetime.

## Upstream report

No matching issue was found for the exact constructor error.
Closed issue `juicesharp/rpiv-mono#43` concerns tool activation instead.
The preserved report is [juicesharp/rpiv-mono#107][issue-107].

[issue-107]: https://github.com/juicesharp/rpiv-mono/issues/107
