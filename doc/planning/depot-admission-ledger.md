# Depot admission and allocation ledger

Status:
implementation work item 3.
Machine-readable ledger:
[depot-admission-ledger.json](depot-admission-ledger.json).
The executable dispatch gate is part of work item 4,
the weekly native matrix.
This document and the ledger define the reservation,
fallback and accounting rules that gate
enforces.

## Active plan and allowance source

The active plan is the Startup trial for the pilot.
Phase 2 moves to Developer.
The exact subscription transition remains a user action and is not performed by the ledger.
The included allowances are recorded in the ledger for both plans.
The repository does not inspect account-wide usage and does not assume unused credits.

The USD 200 combined ceiling is a capacity ceiling.
Overage is disabled on every product.
A Depot reservation is admitted only when every requested meter fits the remaining allowance and
the reservation fits the ceiling.

## Caps and documented gaps

The user reports that product caps are configured.
The exact values are not recorded.
Current Depot documentation supports configurable caps for container build minutes and
GitHub Actions runner minutes only.
Native CI,
Tests and combined storage have no documented configurable hard cap.
These gaps are recorded in the ledger instead of inventing values.
The operator remains responsible for the configured settings and for the storage average.

## Fallback matrix

A Depot reservation that does not fit falls back to free public GitHub when a qualified equivalent
exists.
It is marked incomplete when no equivalent exists.

Public GitHub equivalents exist for:

- ordinary Linux,
  Windows and
  Mac validation;
- single-architecture Docker builds;
- cache and test reporting.

No public GitHub equivalent exists for:

- native paused-session SSH;
- KVM or nested VM work;
- custom sandbox images;
- SDK or VM profiles;
- Depot Registry;
- issuer-bound publishing,
  which must stay GitHub-hosted.

## Reservation and recovery

Every paid profile declares its provider,
resource shape,
execution bound,
retention exposure and conservative reservation before it starts.
The ledger records each attempt with:

- allocation identity,
  attempt identity,
  profile and provider;
- meter quantities and reserved dollars;
- status and actual dollars when known;
- recovery or retry relationship through the shared allocation identity.

Attempts sharing an allocation identity are counted once by taking the maximum meter and
reservation per identity.
Cancelled attempts do not consume an allowance.
One recovery attempt is reserved together with its original attempt,
not added as a second independent allocation.

## Admission scenarios

The gate must produce these decisions:

- admit a Depot reservation inside the active allowance;
- fall back to public GitHub when a meter is exhausted;
- mark incomplete when no public equivalent exists;
- fall back when the USD ceiling would be exceeded;
- fall back when storage would exceed the allowance;
- count overlapping recovery attempts once;
- use Developer allowances after the trial plan is selected;
- admit free public GitHub reservations;
- reject a negative allowance as invalid input.

The first weekly native matrix dispatch exercises the first admitted reservation.
The gate records the decision and the ledger attempt before the paid profile starts.

## Current state

The trial allowances are active.
No paid profile has been admitted yet.
The ledger attempts array is empty.
The first weekly native matrix dispatch must append its reservation and result.
