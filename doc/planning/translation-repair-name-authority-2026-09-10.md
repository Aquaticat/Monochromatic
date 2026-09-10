# Reference-name authority in full repair

Task 21 follows the completed temporal repair verification on `b9d3b2ea0`.
The [temporal record](translation-repair-temporal-context-2026-09-10.md)
contains the preceding packet,
merge and selection evidence.
Whole-page readiness remains false.

## Current observed defect

The completed compiled authority-path run preserves the correct friend-to-Mio disclosure,
but every editor changes `Harunome Hanbai`.
The selected chunk says `Harunome Studio`.

The name-related panel packet contains a Hanbai-addition claim,
name mistranslation claims,
a wrong-term claim,
and an administrator-role claim mixed with a name criticism.
The accepted name diagnoses survive the per-member authority fix:
this is not the rejected-claim promotion defect recurring.
The untranslated-role diagnosis is rejected and now excluded correctly.

`~/temp/agent/temporal-authority-path-replay-20260910.json`
records all 78 calls with zero cache misses and identical selected text.
`~/temp/agent/temporal-authority-slates-20260910.out`
contains every editor draft and selection ballot.
Several selector rationales retain only `Harunome`
and describe replacing the rest of the existing name as a literal translation correction.
No good full-name candidate reaches selection.

## Existing rules and hypothesis

`package/module/translation-repair/src/translate-wire.ts`
explicitly tells the initial writer to keep existing reference names
when they match the original neither phonetically nor semantically.
Declared naming evidence still takes precedence.

`package/module/translation-repair/src/name-form-policy.ts`
says an established translation-side name is not a generic term,
but its shared paragraph does not spell out that nonliteral whole-name convention.
It also leaves the phrase `declared authoritative name` open to being read as any source-language name in the body.
These are candidate ambiguities,
not demonstrated causes yet.

The treatment replaces that shared paragraph rather than appending a competing instruction.
It identifies the complete existing English reference name as the convention,
including semantically or phonetically nonliteral components.
It distinguishes raw source-language naming from an explicit identity declaration
or an explicitly supplied English name for the same entity.
Wrong-entity references remain defects.
Ordinary terminology and explicit definitions remain translatable.

This does not extend archive protection over work titles.
The [official-title and established-vocabulary decision](../decision/translation-repair-work-titles-established-vocabulary.md)
continues to govern those,
including its refusal to protect an archive title merely because it already exists.
No one-off glossary entry is proposed.

## Active bounded measurement

`proc_43b4` runs `translation-repair-reference-name-scope-probe-20260910`.

- Script: `~/temp/agent/probe-reference-name-scope-20260910.mjs`.
- Plan: `~/temp/agent/reference-name-scope-plan-20260910.out`.
- Log: `~/temp/agent/reference-name-scope-probe-20260910.log`.
- Report: `~/temp/agent/reference-name-scope-probe-20260910/report.json`.

The baseline reconstructs the actual critic output and name-touching cluster
through the compiled public APIs:
fifteen cached calls,
zero misses or client errors,
five members in the name cluster.
The per-exchange field is verified as 360000 ms.

The first control explicitly gives a studio's official English name as `Silver Willow Studio`
and has the translation call it `Cedar Grove Studio`.
That genuine name correction must remain accepted before any other arm is purchased.
Then the existing name cluster,
fresh anchored critic output,
and the fresh name-touching clusters reach the real panel and tally.

The limit is 48 live requests and 1200000 ms globally.
Roles,
source,
archive,
schemas,
category guidance,
thresholds and member-status partitioning are unchanged.
Only the shared name paragraph changes.
Prompt-window selection precedes this experimental interception,
so a successful result still needs compiled-window verification.

## Completion evidence required

Read every accepted claim,
not just group status or process success.
A mixed administrator/name complaint can still carry a false rename demand
if its true administrator complaint is accepted.
The new critic packet must not grant authority to those false name diagnoses,
and genuine administrator-role repair must remain possible.

If supported,
implement the measured generic rule after red guards,
run package checks,
verify prompt parity,
and test actual editor proposals and selected wording through the compiled repair path.
No prompt change,
claim filter or name list has been added to production for task 21.
The next full Mio pass remains blocked on this evidence.
