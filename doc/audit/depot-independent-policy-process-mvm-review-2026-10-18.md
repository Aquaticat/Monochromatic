# Independent Depot policy, process and MVM evidence review

## Review boundary

This review independently decodes the original archive bundles for
[`job-policy-history`](depot-job-policy-history-2026-10-18.evidence.json),
[`process-timeouts`](depot-process-timeouts-2026-10-18.evidence.json)
and [`mvm-kvm`](depot-mvm-kvm-2026-10-18.evidence.json).
It also checks the combined-product pricing arithmetic and the coordinator's
[`expanded CI report`](../planning/depot-expanded-ci-evaluation.md).
The review excludes this reviewer's own Rust execution claims.
No new cloud allocation is admitted.

All 19 encoded original ZIPs decoded with strict base64 validation,
matched their recorded byte lengths and SHA-256,
and passed Python's independent ZIP CRC checks.
The ZIPs contain 566 file members totaling 802,946 uncompressed bytes;
the original ZIP bytes total 263,197.
Every member was decoded and individually hashed.
All member bodies were UTF-8 text;
there were no media or undecodable binary members.
The private independent catalog and input snapshots are retained under
`temp/agent/depot-independent-review-20261018` in the executing user's home.

## Findings

### Warning: MVM file roundtrip does not independently exercise guest payload access

The coordinator report's MVM paragraph calls the transfer a 51-byte file roundtrip.
The stronger description of this as a guest payload roundtrip is not established.
All passing lifecycle receipts declare `consumer.meta.fileTransfer = "virtiofs"`.

At application source `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`,
`package/cli/mvm/src/file-transfer.ts:282` uses a host copy:

```ts
// package/cli/mvm/src/file-transfer.ts:282, abridged.
await copyFile(hostPath, sharedHostPath);
```

The matching shared-directory pull at `file-transfer.ts:409` reads that host file:

```ts
// package/cli/mvm/src/file-transfer.ts:409, abridged.
const content = await readFile(sharedHostPath);
return content;
```

Both paths select `basename(guestPath)`.
`package/cli/mvm/README.md:170` explicitly documents this shared-directory route
and distinguishes it from the guest-agent route.
This is not a newly inferred product defect.

The actual standard-GitHub consumer at harness
`64d6a666e63e4773ee56666148ae9c8ba371877a`,
`.depot/research/mvm/mise.toml:251` to `259`,
creates a guest directory,
then calls push and pull without a guest payload read or write:

```js
// .depot/research/mvm/mise.toml:256, abridged.
fs.writeFileSync(hostInput, payload);
requireSuccess(mvm('push', ['push', manifest.guest.name, hostInput, guestPath]));
requireSuccess(mvm('pull', ['pull', manifest.guest.name, guestPath, hostOutput]));
if (!payload.equals(fs.readFileSync(hostOutput))) {
  throw new LifecycleProbeFailure('Real guest file roundtrip bytes differ');
}
```

The retained commands and stdout agree with this source:
push reports `/mnt/shared/owned-<nonce>.bin`,
and pull reads the host `shared/` path.
The requested `/root/temp/agent/` directory does not strengthen the transfer assertion,
because the shared route uses only its basename.

Correct the report and transfer summary to:
“51-byte shared-directory CLI roundtrip;
guest payload visibility/write was not separately asserted.”
Keep the actual guest stdout,
exit status `2`,
QMP/KVM and private-domain/daemon cleanup credit.
A future separately admitted consumer can have the guest read and transform `/mnt/shared/` bytes
before pulling the changed result.
That consumer was not executed by this review.

## Verification still in progress

The exact policy statuses,
timeout timestamp joins,
pricing recomputation and final report wording review are being completed.
This checkpoint preserves the independently established transfer boundary before further work.
