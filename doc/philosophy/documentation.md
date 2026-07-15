# Documentation organization

The repo documents itself in hub-and-spoke families:
 a `README.md` hub per family
indexes spoke files in the same directory.
This document explains the choices behind where the families live,
 how they are named,
and when a doc is removed,
 at the points where the decision could have gone another way.
The terse rules live in AGENTS.
md under "Doc placement";
 this holds the reasoning.

## Families live under doc/, not at the root

Every dotted-prefix family lives in `doc/<family>/`.
The repository root keeps only the files tools and newcomers expect there:
`README.md`,
 `SECURITY.md`,
 `AGENTS.md`,
 `CLAUDE.md`,
 and `LICENSES/`.

One directory is exempt.
`.out-of-scope/` stays at the root because it is already a tidy subdirectory,
not a flat dotted-prefix family,
 so it was never part of the sprawl this move targets;
relocating it under `doc/` would be churn for no decluttering payoff.

The rejected alternative was a hybrid:
 move the bulk families (troubleshooting,
 audit,
 handover)
into `doc/` but keep the constitution (`AGENTS.md`,
 `CLAUDE.md`,
 the philosophy family)
and the family hubs at the root,
 where they are opened constantly.
The hybrid buys most of the decluttering for less cross-reference churn,
and it keeps the philosophy docs adjacent to the `AGENTS.md` they elaborate.

Fully nested won anyway because a single uniform rule beats a documented exception.
"Everything lives under `doc/` except the handful of files tools require at the root"
is a line nobody has to re-learn;
"the bulk families nest,
 but the constitution and hubs stay at root,
 and package docs stay flat"
is an exception every future contributor must look up.
The cost,
 the philosophy family sitting one directory away from `AGENTS.md`,
 is a navigation
nicety,
 not a correctness problem,
 and `rg doc/philosophy` reaches it as fast as a root listing did.

Staying flat (fix the hubs and naming,
 move nothing) was rejected outright:
it leaves roughly a hundred files at the root and answers "make the index accurate,
"
not the actual complaint,
 "the root is messy.
"

## Stripping the prefix and nesting one level

A `PREFIX.rest.md` file becomes `doc/<prefix-lowercased>/<rest-lowercased>.md`.
The directory names the family,
 so the `PREFIX.` that used to act as a virtual directory
is redundant and is dropped.

A second dotted segment stays flat in the filename:
`TODO.performance.build.md` becomes `doc/todo/performance.build.md`,
not `doc/todo/performance/build.md`.
Deeper nesting was rejected because the segments after the family are ad-hoc topic tags,
not a stable taxonomy.
Promoting them to directories invents a hierarchy the content does not have,
and a directory holding one file is worse than a descriptive filename.
The family is the only division that earns a directory.

## Hubs keep their curated prose

A bare `PREFIX.md` index becomes `doc/<family>/README.md`,
 carrying its hand-written
descriptions and ordering intact.

Auto-generating the hubs from the spoke list,
 the way `CLAUDE.md` is built from `AGENTS.md`,
was considered and rejected.
A generated hub can list files;
 it cannot reproduce the curated "here is what matters and why"
that makes a hub worth reading.
The staleness an auto-generator would prevent (a spoke added without a hub edit) is cheaper
to accept and correct by hand than the curation it would flatten.

## Bug reports fold in; other orphans keep a directory

A bug report folds into the most relevant `doc/troubleshooting/<topic>.md` as a section.
Other single-file prefixes (limitations,
 miscellany) each get their own directory.

The asymmetry is deliberate.
A bug report is the same symptom-plus-root-cause shape the `troubleshooting-doc` skill already
defines;
 it is a troubleshooting doc under another name,
 so it merges without distortion.
The remaining one-offs name a genuinely different kind of content,
so folding them would wedge an unrelated section into a doc that does not want it.

## Patches live beside their doc

A troubleshooting patch is `doc/troubleshooting/<topic>.patch`,
 a sibling of `<topic>.md`.

Keeping patches as root-level attachments was the first instinct and was rejected.
A patch is an appendix to one investigation,
 not a repository-level artifact,
so "sibling of the doc" is the relationship a reader expects,
and it survives the doc moving directories.
The shell-command examples that reference a patch by name move with it,
so the bare filename keeps resolving.

## Finished docs are deleted, not archived

A doc whose work has landed is read once more to confirm it is finished,
 then deleted.

A `doc/archive/<family>/` tree was the proposed alternative and was rejected.
Git history already is the archive.
A finished doc left in the working tree is a second copy that every reader must triage,
"is this still current?
",
 and that triage cost is exactly the clutter the reorganization removes.
Deletion is reversible through `git restore`,
 so nothing of value is lost.

## Source references use repo-relative paths

Code and config that cite a doc use a repo-relative path.

Pinning a GitHub blob URL "so the reference survives a move" was rejected:
a commit-pinned blob URL 404s on the next edit to the doc,
and a branch URL 404s on the very move it was meant to survive.
A repo-relative path travels with the tree and is checkable offline.

## The rule is the enforcement

The AGENTS.
md "Doc placement" rule is the safeguard against the root re-cluttering;
no hook enforces it.

A `file-enforcer` check that fails when a family doc reappears at the root was considered.
It was deferred,
 not adopted:
 `file-enforcer` generates files,
 it does not lint placement,
so this would bolt a linter onto a generator.
A warn-only `PreToolUse` hook is the right shape if regression actually recurs,
but the rule plus code review is the cheaper first line of defense.
Build the hook when the rule is shown to be insufficient,
 not on the chance that it might be.
