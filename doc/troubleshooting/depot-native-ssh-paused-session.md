# Depot native SSH paused-session qualification

## Observed boundary

The bounded campaign exercised native CI debug access against application source
`e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
Both attempts returned matching source-bound remote probe content.
The direct OpenSSH clients exited with `255`;
the native `depot ci ssh` PTY consumers exited with `0`.
Neither attempt produced the required paused-session connection target and final workflow readback.
The result qualifies the observed native PTY command consumer only.
Paused-action attachment and subsequent workflow resumption remain unqualified
([original runtime](../audit/depot-native-ssh-runtime-2026-10-18.evidence.json),
[final runtime](../audit/depot-native-ssh-correction-runtime-2026-10-18.evidence.json)).

A matching remote probe does not establish a successful direct-client lifecycle or paused-action attachment.
The bounded controllers cancelled both incomplete workflow attempts.

## Installer isolation

The original paused action last emitted an APT installation line.
That last log line does not establish the blocking call or an upstream defect.
The inspected `mxschmitt/action-tmate` implementation at
`35b54afac29c97fb54faba5b513f8fbd1882f113`
starts with the `tmate` executable name.
Its `install-dependencies` guard encloses both APT installation and static-binary download.
Setting that input to `false` therefore needs an independently available executable
([action entry point](https://github.com/mxschmitt/action-tmate/blob/35b54afac29c97fb54faba5b513f8fbd1882f113/src/index.js#L75)).

The admitted correction downloaded the exact action-selected `tmate` version `2.4.0`,
checked retained archive and executable identities,
and installed it into the job's selected `PATH`.
The archive SHA-256 is `6e503a1a3b0f9117bce6ff7cc30cf61bdc79e9b32d074cf96deb0264e067a60d`.
This is a captured content identity,
not verification of an upstream signed checksum.
Offline executable-consumer and wrong-digest,
truncation and bit-change controls passed before allocation
([correction admission](../audit/depot-native-ssh-correction-2026-10-18.evidence.json),
[parent source checks](../audit/depot-native-ssh-correction-parent-admission-2026-10-18.evidence.json)).

The final run `sn950h8xcj`,
job `lxkdfrx3dh`,
attempt `bv33fqpvnp`,
emitted the selected preinstall success marker.
It still produced no qualifying paused-session target or final readback before watchdog cancellation.
The correction verifies the installation prerequisite;
it does not diagnose the remaining paused-action boundary.
Both admitted attempts are consumed.

## Status and allocation evidence

The CLI's custom status JSON omits allocation timestamps.
The deciding source is `pkg/cmd/ci/status.go` at
`1f96d6d488f938de97ea640b115e9567ebfd6fbf`.
The scoped `CIService/GetWorkflow` response retains actual job-attempt timestamps.
The two exact owned workflow responses establish `136` and `138` seconds.
Their combined nominal two-CPU provider-window proxy is `USD 0.0274`,
distinct from the historical `USD 0.036` reservation
([terminal ledger](../audit/depot-owned-allocation-final-2026-10-18.evidence.json)).

Both attempts are terminal.
The correction receipt verifies owned client-process cleanup and askpass-socket absence.
Private connection material and raw authentication state are excluded from publication.
This investigation establishes no account-wide usage,
invoice,
network cause or general tmate-support conclusion.
