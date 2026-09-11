# V4.1 writer calibration preflight

Task 35 is paused behind task 37's preparation diagnosis.
No writer generation or image-reading calibration has run.
Judge admission is verified independently and remains seated.

## Intended measurement

Use the existing `producer-calibrate 40 --candidates deepseek-v4.1-flash` instrument
and pooled-null writer rule,
with the current measured roster,
preserved self-vote/contributor handling and no extra generation rounds.
The checked post-judge-admission runtime is frozen at `45e64e411`.
The source corpus stays at `a41fc607ea5a70d8a7625cc67d5ed8c444f53379` and is not edited.

`bench-sample.ts` reads all pinned entries before selecting the deterministic source-size spread.
Its `Promise.all` launches entry reads concurrently.
Preparation is therefore being exercised in a resource-limited container,
not by an uncapped host probe.

## Container probe facts

The attempted envelope is:

- 2 GiB memory.
- 2 CPUs.
- PID limit 512.
- No network during preflight.
- Read-only corpus and source mounts.
- Only the owned writer workspace writable.

Owned workspace:
`~/temp/agent/v41-writer-20260911.sEDtepyo`.

The available Node 22 Bookworm image has Git 2.39.5.
The local terminal image has Git 2.52.0,
and its actual invocation accepts `--no-lazy-fetch`.
It has no `node` executable on its default PATH.
Binding the installed Node 26.7.0 runtime required its `libatomic.so.1` dependency;
with that read-only library mount,
`node --version` succeeds.
A prior bind-mount execution was denied before the dynamic-loader probe.
SELinux labeling and library availability remain distinct boundaries,
not interchangeable explanations.

The container disables SELinux process labeling instead of relabeling shared source trees.
Its user namespace,
read-only mounts and resource limits remain active.
This is a tradeoff to document with the completed source trace,
not a claim of full confidential isolation.
No provider keys were supplied to the preflight.

## Failure under investigation

`proc_248e` ran the original sample preflight and exited 139 after twelve seconds.
`v41-writer-container-preflight-20260911.out` records:

```text
logger internal error: file sink verification failed: EROFS: read-only file system
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
```

The full file-sink diagnostic names the read-only source worktree's
`node_modules/.monochromatic` output path.
V8's trace reports heap collection around 1023.5 MiB and includes `StringDecoder::DecodeData`.
These are separate symptoms until a probe establishes a relationship.
An exit-code label alone is not the diagnosis;
the observed fatal diagnostic is heap exhaustion.

Task 37 is minimizing through import,
entry listing,
one pinned file read and full sampling checkpoints.
`minimize.mts` and `run-minimize.mts` retain the same bounded container envelope.
No larger host run or production source change has been used to evade this failure.
A completed troubleshooting record is required once the cause or workaround is verified.
