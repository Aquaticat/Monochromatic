# current-time-context implementation plan

## Goal

Add `@monochromatic-dev/pi-current-time-context`, a pi extension that injects
current local wall-clock time into every agent turn as hidden custom context:

```text
<time>HH:MM</time>
```

The package mirrors existing pi package conventions in `packages/pi/terminal-title`
and `packages/pi/morph-compact`.

## Verified API constraints

- Pi `before_agent_start` handlers return a custom message through
  `BeforeAgentStartEventResult.message`, not a Claude Code `additionalContext`
  payload. Verified in
  `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`.
- Pi stores extension messages in session JSONL as `custom_message` entries with
  `customType`, `content`, `display`, and optional `details`. Verified in
  `node_modules/@earendil-works/pi-coding-agent/docs/session-format.md`.
- Hidden context is represented by `display: false`. It still participates in
  LLM context because custom messages convert to user messages in
  `dist/core/messages.js`.
- Pi validates model and auth before emitting `before_agent_start`. Boundary
  verification must run in an environment with a configured model or use a Pi
  SDK level harness that bypasses provider calls only after proving equivalent
  session serialization.

## Package structure

```text
packages/pi/current-time-context/
  package.json
  README.md
  mise.toml
  tsconfig.json
  tsdown.node.config.ts
  src/index.ts
  src/format-time-context.ts
  src/index.unit.test.ts
  src/format-time-context.unit.test.ts
  src/mise.verify-extension.ts
```

## Implementation plan

1. Create package metadata following sibling pi packages.
   - Package name: `@monochromatic-dev/pi-current-time-context`.
   - `private: true`, `type: module`, `version: 0.0.1`.
   - `exports["."].types`: `./dist/final/node/index.d.mts`.
   - `exports["."].default`: `./dist/final/node/index.mjs`.
   - `exports["./ts"]`: `./src/index.ts`.
   - `pi.extensions`: `./dist/final/node/index.mjs`.
   - Peer dependency: `@earendil-works/pi-coding-agent`.
   - Dev dependencies: pi coding agent, config-tsdown, config-typescript,
     module-test, and `@types/bun`.

2. Share pure formatting behavior instead of copying it.
   - Move or re-export the pure date formatter through
     `src/format-time-context.ts`.
   - The formatter must preserve the Claude Code behavior from
     `packages/claude-code-plugins/source/src/handlers/prompt-time.ts`:
     local 24-hour clock, zero-padded hour, zero-padded minute, no seconds,
     no timezone, no date.
   - If direct import from the Claude package pulls hook runtime concerns into
     the pi package, extract the shared pure function to a small source module
     that both packages import.

3. Implement the pi extension entry point.
   - Subscribe to `before_agent_start`.
   - Return exactly one hidden custom message:

```ts
return {
  message: {
    customType: 'current-time-context',
    content: formatTimeContext(new Date(),),
    display: false,
  },
};
```

4. Add unit tests.
   - Pin dates with `new Date(year, monthIndex, day, hour, minute)` so expected
     local time does not depend on UTC conversion.
   - Assert exact formatter output for:
     - single-digit hour and minute: `<time>07:05</time>`
     - midnight: `<time>00:00</time>`
     - typical evening time: `<time>20:48</time>`
     - last minute of day: `<time>23:59</time>`
   - Test the extension registration with a fake pi API:
     - default export registers `before_agent_start`
     - invoking the captured handler returns `customType: 'current-time-context'`
     - returned `content` matches `<time>HH:MM</time>`
     - returned `display` is `false`

5. Add package README.
   - Document installation with `pi install ./packages/pi/current-time-context`.
   - Document quick test with `pi -e ./packages/pi/current-time-context/src/index.ts`.
   - Explain hidden context and why local time is used.
   - Mention that the package injects only hour and minute.

6. Add build and verification tasks.
   - Mirror sibling `mise.toml` task extensions: `build`, `build:js`,
     `build:js:node`, `watch:*`, `lint`, `lint:types`, `lint:oxlint`,
     and `test:unit`.
   - Add `verify:extension` only if the package has a built-extension smoke
     script like `packages/pi/advisor/src/mise.verify-extension.ts`.

## User-boundary verification

Run the package the way a user consumes it:

1. Build the package.

```sh
mise run //packages/pi/current-time-context:build
```

2. Run unit and lint checks.

```sh
mise run //packages/pi/current-time-context:test:unit
mise run //packages/pi/current-time-context:lint:types
mise run //packages/pi/current-time-context:lint:oxlint
```

3. Exercise Pi with an isolated session directory and the extension loaded.
   Use an environment that already has a configured model and auth.

```sh
session_dir="$(mktemp -d)"
pi --session-dir "$session_dir" \
  -e ./packages/pi/current-time-context/dist/final/node/index.mjs \
  --mode json \
  "Reply with ok."
```

4. Inspect the JSONL session file in that session directory. Confirm a
   `custom_message` entry exists on the submitted turn with:

```json
{
  "customType": "current-time-context",
  "content": "<time>HH:MM</time>",
  "display": false
}
```

5. Match `content` with the bounded shape `<time>\d\d:\d\d</time>` at the
   boundary. Exact minute equality is unit-tested with pinned dates; the
   user-boundary run uses wall-clock time.

## Completion criteria

- Package builds through its mise task.
- Unit tests cover the pure formatter and pi handler shape.
- Type lint and oxlint pass with zero warnings or errors.
- README exists and documents installation, quick test, behavior, and local-time
  rationale.
- Boundary verification proves the serialized pi session contains the hidden
  `custom_message` for the prompt turn.
