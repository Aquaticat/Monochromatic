# Done -- AI-powered task aggregator

## Elevator pitch

A todo app that knows what you should do right now based on where you are and what matters to you, powered by a self-hosted AI model.

## Core concept

Done is a single-tenant PWA for task management.
Each user runs their own instance, provisioned automatically on registration.

### Authentication and instance lifecycle

Authentication lives entirely outside the app, at the infrastructure layer:

1. User registers with email, verified via SMTP (through `@upyo/smtp`; Resend or any SMTP provider)
2. An **orchestrator script** spawns a new **Bun process** (`bun run server.ts --port=XXXX --db=/data/<user-id>/done.db`)
3. The orchestrator updates **Caddy's AuthCrunch** config to grant that user access to their instance's URL scope
4. Caddy reverse-proxies `<user>.done.app` -> `localhost:$PORT`
5. The app itself has no auth logic -- requests only reach it after Caddy has authenticated the user
6. The orchestrator **suspends idle instances** (`SIGSTOP` or kill + respawn on next request) and **wakes them on URL access** (cold-start pattern)

The Done app never sees unauthenticated requests.

The AI is self-hosted via llama.cpp, giving full control over the model and eliminating provider ban risk from user content.
It does not just organize tasks -- it actively surfaces the right task at the right time and place.

## Tech stack

- **Runtime**: Bun (server + bundler)
- **Backend**: `Bun.serve()` (plain request/response handling, no router or framework)
- **Database**: libsql (SQLite-compatible, single file, local)
- **Frontend**: SvelteKit (compiled to static PWA)
- **AI**: Self-hosted llama.cpp (OpenAI-compatible API, full model control, no provider ban risk)
- **Reverse proxy**: Caddy (HTTPS, access control)
- **Auth**: Caddy AuthCrunch (email-verified registration, managed by orchestrator)
- **Email**: `@upyo/smtp` (JSR) -- generic SMTP transport; works with Resend, Fastmail, or any SMTP provider. If the transport fails, that's the provider's problem, not ours.
- **Deployment**: Single host -- orchestrator spawns Bun processes per user (no Docker per user), Caddy in front, llama.cpp as a shared service

## Screens

### Inbox

Two collapsible sections:

**Suggested** (top):
AI-curated task recommendations filtered by two axes:

- **My location**: Autodetect or user-pinned places (e.g., "Walmart"). Tasks with matching `where` values surface here.
- **My focus**: Free-text directive to the AI (e.g., "Adulting tasks first"). Guides suggestion ranking.

**All** (bottom):
Full task list, unfiltered.

### In progress

Live dashboard of tasks the user has started tracking.
All active timers increment in real time on the client using `setInterval(1s)` math against the server-provided `timerStartedAt` timestamp -- no polling or SSE needed for display.
Tasks blocked by other tasks are **not shown in Suggestions or All** -- they appear only nested/indented under the tasks blocking them (in any view where the blocker is visible). This makes circular dependencies harmless by design: cycled tasks simply vanish from top-level lists. Search always returns blocked tasks (with a "blocked" badge) so nothing is truly lost.

### Task details (overlay)

Opened from any task card. Contains:

- **Title**: Editable text field
- **Description**: Multi-line text area
- **Attachments**: "Attach file" and "Take photo" buttons
- **Metadata chips** (all tappable to edit):
  - `#tag1,tag2` -- Comma-separated tags (OR semantics)
  - `tracked: Xs` -- Cumulative tracked time
  - `where: Place1,Place2` -- Comma-separated locations (OR semantics: task can be done at any listed place)
  - `priority: ?` -- User-set or AI-suggested
  - `due: ?` -- Due date
  - `complexity: low|medium|high` -- AI-suggested or user-set
  - `reminders: None|...` -- Reminder configuration
  - `blockedBy: none|Task(s)` -- Blocking dependencies; tappable to select blocker tasks
- **Save** button

### Search (overlay)

Full-text search across tasks.
Two states: initial (empty query, recent/popular) and filtered (results matching query).

### Settings

- **AI model selection** (from models available on the llama.cpp instance)
- **Connected apps**: System calendar, GitHub, Linear, codebase TODO scanner
- Each connector shows sync status and read/write capability

### Drawer

Navigation menu: Inbox, In Progress, Settings.

### Notification shade

System-level notification display (not implemented in app -- defers to OS/browser push notifications via PWA).

## Email notifications (via `@upyo/smtp`)

All email (verification, reminders, backups) goes through a generic SMTP transport configured by the operator.
If the SMTP provider has issues, that's the provider's problem -- the app fires and forgets.

### Reminder emails

When a task has reminders configured, the server sends an email at the scheduled time.
This is the primary notification mechanism -- more reliable than browser push since the app may be suspended.

### Daily database backup email

Once daily, the server exports the user's task data as JSON and emails it to them.
Attachment BLOBs (photos, files) are **excluded** from the backup email to stay within SMTP size limits.
The raw `.db` file is also excluded for the same reason -- only the JSON export (tasks, settings, attachment metadata) is sent.
This is a caution-first data safety measure -- if the instance dies, the user has a recent export.

## Task model

```
Task {
  id: string (ULID)
  title: string
  description: string | null
  tags: string[]                    -- OR semantics
  locations: string[]               -- OR semantics; if AND is needed, AI suggests splitting into dependent tasks
  priority: "low" | "medium" | "high" | null
  dueDate: ISO8601 | null
  complexity: "low" | "medium" | "high" | null
  reminders: Reminder[]
  blockedBy: TaskId[]               -- task cannot be completed until all blockers are done
  trackedTime: number               -- cumulative seconds
  timerStartedAt: ISO8601 | null    -- non-null means timer is running (server-side)
  attachments: Attachment[]
  status: "inbox" | "in_progress" | "done"
  createdAt: ISO8601
  updatedAt: ISO8601
  source: "local" | "github" | "linear" | "calendar" | "codebase"
  sourceId: string | null           -- external ID for sync
  sourceMeta: JSON | null           -- lossless round-trip metadata from external source
}
```

### State transitions

- `inbox` -> `in_progress` (user starts tracking)
- `in_progress` -> `inbox` (user stops tracking, pauses timer)
- `in_progress` -> `done` (user completes task; only if `blockedBy` is empty or all blockers are done)
- `done` -> permanently removed (no archive in MVP)

### Blocking rules

- A task with unresolved blockers cannot transition to `done`.
- Blocked tasks are **hidden from Suggestions and All** -- they only appear nested under their blockers.
- Search always returns blocked tasks (with a "blocked" badge) so nothing is permanently invisible.
- The task details overlay shows a summary of all blocking tasks when `blockedBy` is non-empty.
- Completing a blocker task automatically unblocks dependents (they reappear in Suggestions/All).
- Circular dependencies are harmless: cycled tasks hide from top-level lists; the user discovers and fixes them via search.

## AI behavior

### Task creation auto-fill

As the user types a task title, the AI infers and pre-fills metadata:

- "Buy milk from Walmart" -> `#shopping`, `where: Walmart`, `complexity: low`
- "Review PR #42 on the auth service" -> `#code-review`, `complexity: medium`

### Suggestion engine

The `/suggested` section in Inbox uses the AI to rank tasks based on:

1. **Location context**: User's current or pinned location vs task `where` values
2. **Focus directive**: User's free-text instruction (e.g., "Adulting tasks first")
3. **Task metadata**: Priority, due date, complexity, blocking status

Blocked tasks are excluded from suggestions (they only appear nested under their blockers).

### Task splitting

When a task has multiple locations with AND semantics (needs to visit place A then place B), the AI suggests breaking it into sequential dependent tasks where each later task is blocked by the previous one.

## Connected apps (sync)

Lossless two-way auto-sync with external sources.
External metadata is preserved in `sourceMeta` for round-trip fidelity.

### MVP sync target: GitHub

- Issues map to tasks
- Labels map to tags
- Issue status maps to task status
- Issue dependencies (if present) map to `blockedBy`
- Closing a task can close the GitHub issue (and vice versa)

### Codebase TODO sync (read-only inbound for MVP)

Scan TODO/FIXME/HACK comments from configured repos and import them as tasks.
Outbound writes (modifying source files) are deferred post-competition -- too risky to auto-edit a user's codebase in week 1.

- **Inbound**: Parse `TODO`, `FIXME`, `HACK` comments from configured repos/directories. Create tasks with file path, line number, and surrounding context in description. `source: "codebase"`, `sourceId` encodes `repo:file:line`.
- **Re-scan**: Periodic or webhook-triggered re-scan detects new TODOs, resolved TODOs (comment removed externally -> task marked done), and moved TODOs (file/line changed -> `sourceId` updated).
- **Outbound (post-competition)**: When a task sourced from a TODO is completed, the sync engine removes or updates the comment in the codebase. Deferred because auto-modifying source files is high-risk.

### Planned sync targets

- **Linear**: Issues, status, dependencies
- **System calendar**: Events become time-bound tasks

## Timer architecture

The server is the authority for start/stop events; the client handles smooth display:

- Starting a timer: server sets `timerStartedAt` to current UTC timestamp, returns it to client
- Stopping a timer: server computes elapsed delta, adds to `trackedTime`, nulls `timerStartedAt`
- **Client-side display**: `setInterval(1000)` computes `trackedTime + (Date.now() - Date.parse(timerStartedAt)) / 1000` -- purely local math, no network per tick
- Cross-device consistency: any device that opens In Progress gets the authoritative `timerStartedAt` from the server and ticks locally from there
- No SSE or polling needed for timer display; server is only contacted on user actions (start/stop/complete)

## PWA requirements

- Installable (manifest.json with icons)
- Service worker caches app shell (static assets only -- not a full offline mode)
- When offline, show a clear "offline" banner; actions require connectivity since the API is server-side
- Camera access for "Take photo" attachment
- Geolocation API for location autodetect

## Architecture notes

### SvelteKit static build + Bun.serve() API

SvelteKit compiles to static HTML/JS/CSS via the static adapter.
Caddy serves the static files directly and reverse-proxies `/api/*` to the user's Bun process.
No CORS needed -- same origin, Caddy handles both.

### AI rate limiting

Each Bun process enforces a simple in-memory rate limit on AI proxy calls (e.g., 30 requests/minute) to prevent runaway loops from overwhelming the shared llama.cpp instance.

### FTS5 rowid note

libsql uses TEXT primary keys (ULIDs), so `rowid` is SQLite's implicit auto-assigned integer, not the ULID.
FTS5 search queries JOIN on `tasks.rowid`, not `tasks.id`. This is correct but easy to confuse -- be careful in implementation.
