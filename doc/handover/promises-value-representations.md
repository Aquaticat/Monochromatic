# Promise lesson value representations

## Current request and constraints

The user identified missed opportunities to show `JSON.stringify` representations of objects and Promises.
They then requested `util.inspect` where JSON is insufficient,
and added `showify` to the workspace catalog.
`pnpm-workspace.yaml:131` currently declares `showify: '>=0.2.8'`.

The current lesson remains unchanged at SHA-256
`319ffcb20481d468beb6353d6bbe94b682e55cb682c3542dffefc983f6e82eb7`.
The previous completed repairs are recorded in [the correction handover](promises-review-corrections.md).

Preserve:

- The learner profile and Promise-focused destination.
- Independent sending, no click races, and truthful fixture policies.
- Native code editing, opaque iframe isolation, and self-contained offline HTML.
- Complete print/export counterparts and achromatic long-form reading surfaces.
- The settled learner-observation veto.
- The withdrawal of mandatory visible-window presentation; headless verification is valid.

No final teaching-skill confirmation or implementation is authorized.

## Work in progress

Task 29 completed the representation audit and bounded consumer probe of the user-supplied formatter.
Task 30 implements contextual views.
Task 31 verifies the integration and records the resulting teaching-discovery evidence.

Research workspace: `/var/home/user/temp/agent/promises-value-inspection`.
Lesson authoring workspace: `/var/home/user/temp/agent/promises-revision`.
No new inspector dependency has been installed or bundled into the lesson yet.
The next implementation step is to consume the catalog's published Showify package as lesson infrastructure.

## Existing omissions

`promises-revision/labs.mjs`, `installMonitor`, currently:

- Replaces a Promise with the prose `Promise object; no public state field`.
- Replaces an Error with its name and message.
- Formats arrays itself to preserve empty slots.
- Uses JSON for other values without naming that representation.

The data example constructs a reply object but reports only its text list, count, and comparison.
The Promise collection does not show its input Promise array or returned collection Promise.
The adoption example does not show either actual Promise object.
The resolver bundle, error metadata, and cancellation objects offer additional useful inspection points.

## Measured native output

`mise run probe` in the research workspace passed as `proc_4981`.
`probe-values.mjs` writes `native-inspection-probe.json` using Node `v26.8.1`.
It explicitly sets `Error.stackTraceLimit = 0` for its authored examples,
so error output focuses on name/message and fixture metadata rather than host stack paths.

Observed examples:

- Pending, fulfilled, rejected, and adopting Promise objects all stringify as `{}`.
- Native `util.inspect` distinguishes pending, fulfilled contents, and rejection.
- A resolver bundle stringifies as `{"promise":{}}`; inspect also shows its resolving functions.
- Sparse reply slots become JSON `null` entries; inspect identifies empty items.
- A callback array stringifies as `[null]`; inspect identifies the stored function.
- Top-level `undefined` produces no JSON text, not the JSON string `"undefined"`.
- JSON of the fixture Error includes added enumerable metadata but omits its ordinary message.
- Native inspection exposes controller/signal state; explicit public-property snapshots also expose `aborted` and `reason`.
- Circular objects and BigInt throw during JSON serialization but have inspector representations.

Node source is pinned at tag `v26.8.1`, commit `7be6d3af31a65adea57c94c41e50c2b071ed0b3a`.
The treeless, no-checkout clone is `promises-value-inspection/node-v26.8.1`.
Extracted source files are `native-inspect-source.js`, `native-util-source.cc`, and `native-util-doc.md`.
`src/node_util.cc:102` defines `GetPromiseDetails`; it uses native Promise state/result access.
This is not an ordinary browser-page JavaScript property.

## User-supplied showify

Read-only clone: `promises-value-inspection/showify`.
Commit and release tag `0.2.8` both identify `9a455119e0735ec2fc2a2de8ea14bb925fd52c38`.
The complete `src/index.ts`, package manifest, Promise tests, CI workflow,
MPL-2.0 license, and commercial-license explanation have been read.

Relevant source:

- `src/index.ts:1268` emits `<state unknown>` for a Promise.
- `test/promise.spec.ts` expects that spelling and tests added properties and a custom tag.
- Options include depth, indentation, length bounds, getter control, and custom-hook controls.
- Default custom inspection hooks can execute supplied functions;
  the teaching viewer should configure those deliberately rather than claiming arbitrary inspection is passive.
- The source has no runtime imports or network/filesystem entry points.
- The upstream `prepare` script copies Git hooks. Do not execute it for this task.

The bounded consumer probe now passes for the published artifact.
`proc_506a` verified Chromium 153.0.8010.12 and Firefox 155.0, with no CSP violations or page errors.
The lesson's Firefox ESR 140 integration remains a later verification step.
The complete findings are in [the inspection boundary note](../troubleshooting/showify-promise-inspection.md).
The cached Playwright container matches installed `@playwright/test` 1.63.0.
Use 2 GiB memory, 2 CPUs, no network or ambient credentials,
read-only dependency/source mounts, and a private output directory.

### Consumer-probe execution manifest

`build:showify-probe` uses the repository's existing Rolldown build API to parse the pinned TypeScript source
and produce one IIFE with its MPL notice retained.
It executes no upstream npm, build, test, prepare, or hook script.
The source is one dependency-free production file and has been read completely.

`probe:showify-browser` runs the authored `probe-showify-browser.mjs` in cached image
`4b8805002ee369c81b7826b941afc52c0c9678a0d0e427a0fefd1684b78b5f94`.
That image contains Node `v24.20.0` and the Playwright browsers;
`playwright.Dockerfile` pins the base image and the installed test package is `1.63.0`.
The script imports that existing Playwright package and launches Chromium and Firefox sequentially.
It loads only the generated formatter and bounded authored values.
No upstream lifecycle commands or benchmark suites are invoked.

Bounds: 2 GiB RAM, 2 CPUs, 256 process/thread entries, read-only root filesystem,
512 MiB `/tmp`, 256 MiB shared memory, no network, and a 60-second controller watchdog.
Only the script/bundle and dependency directory are mounted read-only;
the private results directory is the sole persistent write mount.
No real home, repository source tree, or ambient credentials are mounted.
SELinux label enforcement is disabled for those isolated mounts without altering their host labels.

The initial source bundle failed in `proc_8dc2` before executing the formatter:
Rolldown 1.2.7 reported `[PARSE_ERROR] Identifier show has already been declared`
for the source's ambient function declaration and exported constant at lines 271 and 280.
The upstream publishing script erases these TypeScript declarations first.
The next probe uses the normal published JavaScript artifact rather than patching the third-party clone.
`fetch:showify` retrieves version 0.2.8 as data and verifies its registry SHA-512 integrity before extraction.

The probe checks Promise states as unknown, functions, sparse arrays, errors, circles, BigInt,
JSON contrasts, ordinary getters and configured hooks, special-tag getter reads,
CSP violations, and whether formatting changes unhandled-rejection behavior.
Successful completion writes `results/showify-browser-probe.json` and closes both browsers.

## Other factual lookups

No alternative package has been selected or installed.
These were capability checks, not completed technology recommendations:

- `util-inspect-isomorphic`, commit `5bf9910a371fc7c61045cacd00fc1e973cc40175`,
  emits `<uninspectable>` for Promise internals.
- `node-inspect-extracted`, commit `ebee2b2c2c19d1e8ba70a518e7dc5f918f4e8427`,
  has `src/util.js:52` return the pending marker for every Promise.
  Do not use that output as a truthful lifecycle display.

## Audited teaching locations

- Data: the reply object, its selected string property, and the growing array.
- Callback delivery: the supplied function value, the initiating call's return, and the actual reply object.
- Callback collection: partial arrays with empty slots, then the completed collection.
- Constructor: the returned Promise versus its observer's received value.
- Resolver bundle and manual settlement: Promise plus resolving functions, and observed outcomes.
- Promise collection: the array of Promise inputs, the collection Promise, and the resulting values.
- Adoption: distinct inner/outer Promise objects and the separately observed adopted result.
- Await: the input Promise, async invocation's returned Promise, and resumed value.
- Supplied API and rejection: request options, reply data, actual Error, and explicitly selected error fields.
- Cancellation and ownership: controller/signal objects, public aborted/reason fields, and controller collections.

Keep the final reference chat's functional code independent of the viewer.
The existing narrative monitor need not become a formatting dump;
add explicitly labelled inspection snapshots at the relevant boundaries.
For opaque previews, formatted strings can cross the existing source/run-validated ownership boundary;
parent-page cards avoid hiding the new content inside a fixed-height iframe.
Standalone exercise exports must render those same snapshots locally.

## Integration direction to verify

Use actual browser representations at the relevant source/observation boundaries,
not prose substitutes or a detached appendix of unrelated values.
Keep raw JSON, richer inspection text, and program-observed state visibly distinct.
An inspector's `<state unknown>` is not the pending state.
Any native Node inspector examples must be labeled as recorded Node output,
not presented as live inspection of an edited browser value.

The viewer is lesson infrastructure, not a new dependency required by the learner's chat.
License/source notices and all displayed representation content must survive export and printing.
