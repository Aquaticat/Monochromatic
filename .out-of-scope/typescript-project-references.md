# TypeScript project references

This project does not adopt TypeScript project references across packages.

## Why this is out of scope

The performance hit project references are meant to fix doesn't bite here.
`tsgo` reads source directly (via the package `exports` map's `"types": "./src/...ts"` style),
not the emitted `.d.ts` artifacts,
 so cross-package type-checking already
short-circuits the cold-rebuild cost that project references solve in classic-tsc workflows.

Project references would buy us incremental graph rebuilds and explicit `references` arrays in every
`tsconfig.json`,
 at the cost of:

- maintaining the `references` array in lockstep with the workspace dependency graph
  (every workspace dep on `module/es` now also needs a `references` entry);
- declaring `composite: true` everywhere,
   which forces `declaration: true` and
  every package to emit `.d.ts` files even when `tsdown` already handles emit;
- handling TS6310 (`Referenced project may not disable emit`) by overriding `noEmit: false`
  in every consumer,
   which then leaves stray `.d.ts` files in source trees;
- per-project `.tsbuildinfo` files that need a place to live and a cache-busting strategy;
- documentation drift between the prescribed `tsc --build` workflow and the existing
  per-package mise tasks that invoke type-checking directly.

The maintenance cost of the references array alone is non-trivial in this monorepo
(~70 packages,
 dense workspace dep graph).
 The performance payoff is small because the
underlying problem is already mitigated by tsgo's source-import resolution.

## Prior issue

- #123 (closed 2026-05-14):
   proposed adopting project references;
   the user rejected the
  trade-off after weighing the maintenance burden against the marginal speed-up.

## What we use instead

- `tsgo` (a Go reimplementation of `tsc`) reads source via the package `exports` map's
  `./ts` style entries (`"./ts": "./src/index.ts"`),
   so cross-package type-checks are
  fast even without emitted `.d.ts` artifacts.
- Per-package `mise run //package/<path>:lint:types` invokes type-checking directly.
- `composite: true` is set in `package/config/typescript/tsconfig.options.json` (see
  `package/config/typescript/README.md`),
   but no package actually wires up references.

If the no-references performance ever degrades to the point where references look attractive
again,
 revisit by measuring the type-check time first,
 not by re-proposing the migration
based on best-practice reasoning.

## 2026-09-06: re-proposed during issue #486, rejected again

While grilling issue #486 (whether oxlint and tsc "handle" the workspace `/ts` source-import convention),
an agent proposed `references` plus `emitDeclarationOnly` as the remedy for the isolation costs of `/ts` imports:
a consumer's tsconfig type-checks sibling source,
so a sibling's type error surfaces in every consumer,
and every package must extend the `/dom` config
(see `doc/troubleshooting/typescript.md`).
The agent had not read this note first.
The user rejected project references again before any spike ran,
called them awkward,
and asked that no effort go into re-deriving why.

Treat this as settled:
project references are not the answer to `/ts` isolation costs either.
Any future proposal must start by measuring the cost it claims to fix and by reading this note,
not by reasoning from monorepo best practice.
