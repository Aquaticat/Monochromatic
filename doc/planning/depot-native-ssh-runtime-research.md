# Native SSH runtime research

## Scope

This is a successor to the immutable
[source and admission proposal](../audit/depot-native-ssh-acceptance-2026-10-18.evidence.json).
It records the real execution and remaining read-only checks separately.
The proposal and its admitted controller inputs remain unchanged.

## Active control

The admitted native run is `sqrz4sml30`,
job `q74vcmxkk1`,
attempt `fhxx4s51rf`,
sandbox `g64shw2rl3jzrxsmq92x`.
Its harness is `b6a60493c16087043a7043f50cd31d8aebf4bdee`,
preserving application `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
The requested shape is `2` CPU and `8` GiB,
with a `3` minute server job limit and cancellation requested after `150` seconds.
The maximum nominal reservation across a reviewed correction is `USD 0.036`.

At this checkpoint,
direct OpenSSH and the native CLI transport emitted the VM proof marker.
Their observed client exits are `255` and `0`,
respectively.
Those exits and terminal output alone do not qualify the workflow file consumer or paused resume.
Terminal run status,
all transport results and cleanup remain to be collected.

## Queued read-only forge check

After the SSH run is terminal and local clients are reaped,
inspect both GitHub check-runs and commit statuses for its exact owned harness SHA.
Use GitHub Actions run `39140975786`,
source `234ccc92dabb81e998e0a0bb5e838713924dd83f`,
as a known nonempty check-run positive control.
Keep original API actor and output bodies private.
Publish selected source,
run,
status and app fields with original body hashes.

The purpose is to measure the GitHub consumer boundary of this native manual execution.
An absent result will not establish intended behavior or an app/settings cause.
No app or account settings will be inspected or changed.
This check allocates no compute.

## Next work

- Await the existing bounded controller's terminal result and verify exact-owned cleanup.
- Publish a successor runtime receipt without editing the bound proposal.
- Execute the queued exact-SHA GitHub check-runs and commit-status controls.
- Complete the independent report sufficiency review after the parent factual queues close.
