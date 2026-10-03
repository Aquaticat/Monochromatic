# Node.js 26.10.0 ADB capture fails with `ENOBUFS` during `dumpsys input_method`

## Symptom

A private filename-control capture accepted its initial views,
then Node.js `execFileSync` failed while reading ADB's
`dumpsys input_method` output:

```text
// capture-search-filename-controls.ts diagnostic excerpt, SDK location redacted
Error: spawnSync <sdk>/platform-tools/adb ENOBUFS
```

This interrupted the capture harness.
It did not report a missing filename,
an open keyboard or an Android renderer failure.
The raw diagnostic includes input-method history and stays private.

## Root cause

Source was inspected at Node.js tag `v26.10.0`,
commit `151845ab90d3926ceb36eedf1eade09619c3adc9`.
The read-only clone is under the current user's private scratch directory.
No upstream file was modified.

`lib/child_process.js:96` defines the default output cap:

```javascript
// Node.js lib/child_process.js:96
const MAX_BUFFER = 1024 * 1024;
```

`lib/child_process.js:968` passes `execFileSync`'s options to `spawnSync`.
`lib/child_process.js:884` supplies that default before spreading explicit options:

```javascript
// Node.js lib/child_process.js:884
function spawnSync(file, args, options) {
  options = {
    __proto__: null,
    maxBuffer: MAX_BUFFER,
    ...normalizeSpawnArguments(file, args, options),
  };
```

`src/spawn_sync.cc:293` adds received output to the process buffer count.
`src/spawn_sync.cc:648` records the buffer-limit error and kills the child:

```cpp
// Node.js src/spawn_sync.cc:648
void SyncProcessRunner::IncrementBufferSizeAndCheckOverflow(ssize_t length) {
  buffered_output_size_ += length;

  if (max_buffer_ > 0 && buffered_output_size_ > max_buffer_) {
    SetError(UV_ENOBUFS);
    Kill();
  }
}
```

The capture helper had not supplied a larger cap.
The bounded synthetic control reproduces the same diagnostic with output
larger than its configured cap.
Explicitly extending the consumer-side cap let the complete native
control capture finish.
This is a capture-boundary configuration correction,
not evidence of an upstream defect or host-memory exhaustion.

## Verification

The affected runtime reported Node.js `v26.10.0`.
This standalone control needs no device,
user data or repository mutation:

```javascript
// Disposable output-buffer-control.mjs
import { execFileSync } from 'node:child_process';

const args = ['--input-type=module', '-e', 'process.stdout.write("x".repeat(4096))'];
let rejected = false;
try {
  execFileSync(process.execPath, args, { maxBuffer: 128 });
} catch (error) {
  if (error.code !== 'ENOBUFS') throw error;
  rejected = true;
}
if (!rejected) throw new Error('Small-buffer control unexpectedly passed.');
const bytes = execFileSync(process.execPath, args, { maxBuffer: 8192 });
if (bytes.length !== 4096) throw new Error('Allowed output was incomplete.');
console.log('OUTPUT_BUFFER_CONTROL_PASSED');
```

The tested failing catalog is the 4096-byte child output with a 128-byte cap.
The tested working catalog is the same output with an 8192-byte cap.
The actual ADB read with an 8388608-byte cap returned 1028292 bytes in a
later probe and verified the current closed-keyboard fields.
That later size is not a measurement of the interrupted dump.

The native rerun captured the complete 32-view filename-control matrix.
Its APK SHA-256 was
`9e1f40a131931f13b44e1a6e8200c30bce553c777cee6b5cc615631765698f9d`.
Capture success still required separate image inspection and publication checks.

## Verified workaround

Supply a finite cap at the ADB text-capture boundary:

```typescript
// Private capture helper's execFileSync options
{ encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024 }
```

The tradeoff is a larger permitted per-call output allocation.
Output exceeding this bound still fails;
do not replace it with an unlimited buffer.
Preserve the first settings snapshot across retries,
rather than recording already-modified settings as the original state.
Read current keyboard fields as exact values,
not arbitrary substring matches in historical output.
These changes do not alter the guest keyboard or authorize a new IME study.

## What does not work

- Leaving the default capture cap in place interrupted the control matrix.
- Treating `ENOBUFS` as a native filename or keyboard failure misidentifies
  the emitting operation.
- A later dump shorter than the default cap does not reconstruct the
  earlier failed output or make the interrupted run complete.
- Partial captures do not satisfy the complete matrix;
  the successful rerun supplied its own manifest.

## Upstream filing decision

- Upstream fault:
  not established.
  The consumer used the default cap for diagnostic output.
- Upstream remedy:
  the existing explicit `maxBuffer` option sufficed.
  No upstream change is proposed.
- Supported use:
  the inspected `execFileSync`/`spawnSync` source accepts
  the explicit cap.
- Contribution policy:
  not audited because no defect filing is justified.
  No claim about whether Node.js would accept a contribution is made.
- Likelihood of an upstream fix:
  not assessed;
  the remedy is at the consumer boundary.
- Upstream prototype:
  unnecessary after the upstream-fault gate failed.
  The consumer change and bounded failure/success control were exercised.

The repository's `.out-of-scope/` filenames were inspected;
none identifies this Node.js capture-boundary incident.
Issue and pull-request searches for `spawnSync ENOBUFS maxBuffer` in
`nodejs/node` returned no results.
Those narrow searches do not establish absence of related reports.
Nothing additive is being filed or drafted upstream.
