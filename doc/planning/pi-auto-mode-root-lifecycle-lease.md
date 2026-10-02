# Private root lifecycle lease proposal

## Purpose and status

Propose a private lifecycle-only lease path inside the existing native-manager ownership registry.
This is not production adoption,
SDK deployment,
provider selection,
or authorization to create human permission.
Implementation of this proposal awaits explicit acceptance.

The [instruction snapshot findings](../troubleshooting/pi-instruction-snapshots.md)
record the supporting controls:
`proc_70b6`,
`proc_1da7`,
`proc_7d74`,
and `proc_152e`.
The existing registry is the private
`contract/lifecycle/native-manager-dependency-controls/native-manager-adapter.mjs`.
Its historical fixed-session branch-snapshot interface stays intact.

## Proposed private scope

Bind a lease to exact `AgentSession` and `SessionManager` objects through their construction owner.
An ID,
role,
file path,
or copied record cannot mint one.
Keep lifecycle state distinct from request generation,
observed source freshness,
and prepared action data.

The lifecycle states are active,
suspended,
and retired.
A pending transition makes release temporarily unavailable.
A proven no-op or cancelled transition restores the same active lease without changing its epoch.
A committed transition or uncertain post-mutation failure retires the old lease permanently.
Returning to the same leaf does not revive it.
Ordinary assistant/tool-result appends do not themselves retire the lifecycle lease.

Examples the controls must distinguish:

-   An ordinary append keeps root lease A active.
-   A pending navigation suspends A;
    cancellation returns A to active only after proving no transition occurred.
-   A successful navigation retires A and issues B.
    Navigating back issues C,
    not A.
-   An in-memory fork issues another lease even when it reuses the manager object.
-   A replacement factory failure after disposal leaves A retired with the original exception retained.
-   A copied or foreign lease cannot release a prepared action.

The observer interface must distinguish temporary suspension from permanent staleness.
Its current irreversible stale latch must not silently convert a cancelled,
non-mutating operation into permanent retirement.

## What this does not solve

The lease is not a mutation detector.
A tested operation facade cannot claim exclusive custody of native state without separate evidence.
The native getter/append-argument probes exposed mutable message aliases;
cached and prototype method calls bypassed an instance hook.
Existing JSONL bytes remained unchanged while the active graph changed.

A private controlled-host profile must name its managed operations and uncovered writers.
Unclosed writer coverage remains a failed admission prerequisite for any production guard relying on the lease.
No blanket restriction on model-estimated semantic effects is introduced.

## Recommendation and alternative

Prototype the lifecycle-only contract in the existing registry first.
It reuses established ownership,
keeps ordinary appends separate from transitions,
and provides a consumer interface for testing suspension and retirement.
Its limitation is material:
it does not qualify production mutation custody.

The alternative is to defer the lease contract and investigate SDK-native state encapsulation first.
That targets the demonstrated alias and bypass surfaces directly,
but requires checking `SessionManager`,
projection consumers,
and extension access before changing their behavior.
The lease contract and SDK state work are complementary;
both can proceed in that order.

Ranking:
private lease contract followed by custody work > custody work before the lease contract,
because the first order makes the required lifecycle semantics explicit without claiming the writers are closed.
Neither order authorizes production cutover.

## Requested decision

Approve the private lifecycle-only lease prototype in the existing registry,
with writer custody,
instruction authority,
and human permission remaining separate unmet production gates,
or defer that prototype to resolve SDK state encapsulation first.
