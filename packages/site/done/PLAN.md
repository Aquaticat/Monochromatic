# Done -- Implementation plan

This plan assumes one developer working full-time for 7 days with AI assistance.
Days are rough guides, not hard boundaries.

## Day 1: Scaffolding and data layer

### Project setup

- Initialize SvelteKit project at `packages/site/done/`
- Configure adapter-bun for SSR (not static adapter)
- Configure as PWA (manifest.json, service worker for app shell caching)
- Add `package.json` with `workspace:*` references to monorepo packages
- Add `mise.toml` with `dev`, `build`, and `start` tasks
- SvelteKit `base` path set to `/u/<user-id>` (injected via env var at process spawn time)
- Caddy reverse-proxies `done.app/u/<user-id>/*` to the user's SvelteKit port, stripping the path prefix (no static file serving needed -- SvelteKit serves everything)

### Database schema (libsql)

libsql is SQLite-compatible, so all standard SQLite features work.
The schema below is the complete initial migration -- run it once on first startup.

```sql
-- ============================================================
-- Core tables
-- ============================================================

-- Every task lives here. JSON columns store arrays as text
-- (SQLite has no native array type). Parse them in application code
-- with JSON.parse().
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,              -- ULID (sortable unique ID, generated in app code)
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT NOT NULL DEFAULT '[]',  -- JSON array of strings, e.g. '["shopping","errands"]'
  locations TEXT NOT NULL DEFAULT '[]', -- JSON array of strings, e.g. '["Walmart","Loblaws"]'
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  due_date TEXT,                    -- ISO8601 string, e.g. '2026-02-14T00:00:00Z'
  complexity TEXT CHECK (complexity IN ('low', 'medium', 'high')),
  reminders TEXT NOT NULL DEFAULT '[]', -- JSON array of ISO8601 timestamps
  blocked_by TEXT NOT NULL DEFAULT '[]', -- JSON array of task ID strings
  tracked_time INTEGER NOT NULL DEFAULT 0, -- cumulative seconds spent on task
  timer_started_at TEXT,            -- ISO8601 timestamp when timer was last started; NULL = not running
  status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'in_progress', 'done')),
  source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'github', 'linear', 'calendar', 'codebase')),
  source_id TEXT,                   -- external identifier for sync (e.g. github issue URL, file:line for TODOs)
  source_meta TEXT,                 -- full JSON from external source, preserved for lossless round-trip sync
  created_at TEXT NOT NULL,         -- ISO8601, set once on creation
  updated_at TEXT NOT NULL          -- ISO8601, updated on every modification
);

-- File and photo attachments. Stored as BLOBs directly in the database
-- (acceptable for single-tenant with modest attachment sizes).
CREATE TABLE attachments (
  id TEXT PRIMARY KEY,              -- ULID
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,           -- original filename, e.g. 'receipt.jpg'
  mime_type TEXT NOT NULL,          -- e.g. 'image/jpeg'
  data BLOB NOT NULL,              -- raw file bytes
  created_at TEXT NOT NULL
);

-- Key-value store for instance configuration.
-- Avoids needing a config file; everything lives in the same DB that gets backed up.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Expected keys:
--   'llama_model'           -- preferred model name from the shared llama.cpp instance
--   'user_email'           -- for sending reminders and daily backups
--   'user_location'        -- current/default location name
--   'focus_directive'      -- free-text AI focus instruction
--   'github_token'         -- personal access token for GitHub sync
--   'github_repos'         -- JSON array of 'owner/repo' strings to sync
--   'codebase_paths'       -- JSON array of local directory paths to scan for TODOs

-- ============================================================
-- Full-text search (FTS5)
-- ============================================================

-- FTS5 is a SQLite extension for full-text search. It tokenizes text
-- and builds an inverted index so you can search by words/phrases
-- instead of exact string matching (LIKE '%...%' is slow and limited).
--
-- content=tasks means FTS5 doesn't store its own copy of the text --
-- it references the tasks table. This saves disk space but means
-- we must manually keep it in sync via triggers (below).

CREATE VIRTUAL TABLE tasks_fts USING fts5(
  title,                            -- searchable: task title
  description,                      -- searchable: task description
  tags,                             -- searchable: tags as JSON string (matches individual tag names)
  content=tasks,                    -- "contentless" mode: reads from tasks table, doesn't duplicate data
  content_rowid=rowid               -- links FTS rows to tasks via SQLite's implicit rowid
);

-- Triggers keep FTS5 in sync with the tasks table.
-- Without these, search results would go stale after inserts/updates/deletes.

-- On INSERT: add the new task's searchable fields to the FTS index.
CREATE TRIGGER tasks_fts_insert AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(rowid, title, description, tags)
  VALUES (new.rowid, new.title, new.description, new.tags);
END;

-- On UPDATE: remove the old entry, add the new one.
-- FTS5 doesn't support UPDATE in-place for content= tables,
-- so we delete-then-insert.
CREATE TRIGGER tasks_fts_update AFTER UPDATE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, title, description, tags)
  VALUES ('delete', old.rowid, old.title, old.description, old.tags);
  INSERT INTO tasks_fts(rowid, title, description, tags)
  VALUES (new.rowid, new.title, new.description, new.tags);
END;

-- On DELETE: remove the entry from the FTS index.
CREATE TRIGGER tasks_fts_delete AFTER DELETE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, title, description, tags)
  VALUES ('delete', old.rowid, old.title, old.description, old.tags);
END;

-- ============================================================
-- Indexes
-- ============================================================

-- Speed up the most common queries:

-- Inbox screen: WHERE status = 'inbox' (most tasks live here)
-- In Progress screen: WHERE status = 'in_progress'
CREATE INDEX idx_tasks_status ON tasks(status);

-- Suggestion engine filters by status + source
CREATE INDEX idx_tasks_status_source ON tasks(status, source);

-- Reminder email job: find tasks with upcoming reminders
-- (scans reminders JSON, but index on status narrows the scan)
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;

-- Sync: find tasks by external source for conflict detection
CREATE INDEX idx_tasks_source_id ON tasks(source, source_id) WHERE source_id IS NOT NULL;

-- Attachments: look up all attachments for a task
CREATE INDEX idx_attachments_task_id ON attachments(task_id);
```

### How to query full-text search

```sql
-- Search for tasks matching a query string (e.g. user types "milk walmart")
-- FTS5 tokenizes the query and matches against title, description, tags.
-- Results are ranked by relevance (BM25 algorithm, built into FTS5).
SELECT tasks.*
FROM tasks_fts
JOIN tasks ON tasks.rowid = tasks_fts.rowid
WHERE tasks_fts MATCH ?   -- ? = the search query, e.g. 'milk walmart'
ORDER BY rank;             -- rank is a hidden column FTS5 provides (lower = more relevant)

-- Prefix search (as-you-type): append * to the query
-- e.g. 'wal*' matches 'walmart', 'wallet', etc.
SELECT tasks.*
FROM tasks_fts
JOIN tasks ON tasks.rowid = tasks_fts.rowid
WHERE tasks_fts MATCH 'wal*'
ORDER BY rank;
```

### How to read/write JSON array columns

```ts
// Reading: parse the JSON string from SQLite into a JS array
const task = db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
const tags: string[] = JSON.parse(task.tags);       // '["shopping"]' -> ['shopping']
const locations: string[] = JSON.parse(task.locations);

// Writing: stringify the JS array back to JSON for SQLite
db.run('UPDATE tasks SET tags = ? WHERE id = ?', [JSON.stringify(['shopping', 'errands']), taskId]);

// Querying tasks that contain a specific tag (uses SQLite JSON functions):
// json_each() expands a JSON array into rows, so we can match individual elements.
const tasksWithTag = db.all(`
  SELECT tasks.* FROM tasks, json_each(tasks.tags) AS tag
  WHERE tag.value = ?
`, ['shopping']);
```

### How timers work in SQL

```ts
// Start timer: record the current UTC timestamp
db.run(`
  UPDATE tasks
  SET timer_started_at = datetime('now'),
      status = 'in_progress',
      updated_at = datetime('now')
  WHERE id = ?
`, [taskId]);

// Stop timer: calculate elapsed seconds, add to cumulative total, clear the timestamp
db.run(`
  UPDATE tasks
  SET tracked_time = tracked_time + CAST(
        (julianday('now') - julianday(timer_started_at)) * 86400  -- julianday diff in days * seconds-per-day
      AS INTEGER),
      timer_started_at = NULL,
      status = 'inbox',
      updated_at = datetime('now')
  WHERE id = ?
`, [taskId]);

// Read current elapsed time for display (without stopping):
// In the API response, return both tracked_time and timer_started_at.
// The client computes: displaySeconds = trackedTime + (Date.now() - Date.parse(timerStartedAt)) / 1000
```

### How blocking validation works in SQL

```ts
// Before completing a task, check if all blockers are done.
// blocked_by is a JSON array of task IDs like '["01HX...","01HY..."]'.
// We expand it with json_each and check if any blocker still exists (not yet deleted/done).

const unblockers = db.all(`
  SELECT blocker.value AS blocker_id, tasks.title AS blocker_title
  FROM json_each(
    (SELECT blocked_by FROM tasks WHERE id = ?)
  ) AS blocker
  JOIN tasks ON tasks.id = blocker.value
  WHERE tasks.status != 'done'
`, [taskId]);

if (unblockers.length > 0) {
  // Return 409 Conflict with the list of blocking tasks
  return new Response(JSON.stringify({
    error: 'Task is blocked',
    blockedBy: unblockers
  }), { status: 409 });
}

// If no active blockers, proceed with completion
db.run(`DELETE FROM tasks WHERE id = ?`, [taskId]);
```

### How to query tasks with nested blocked children

```ts
// Fetch top-level (unblocked) inbox tasks for "All" section
const topLevelTasks = db.all(`
  SELECT * FROM tasks
  WHERE status = 'inbox' AND blocked_by = '[]'
  ORDER BY created_at DESC
`);

// For each visible task, fetch its blocked dependents (tasks where this task is in their blocked_by)
// These render nested/indented under the parent task.
const dependents = db.all(`
  SELECT * FROM tasks
  WHERE status = 'inbox'
    AND blocked_by != '[]'
    AND EXISTS (
      SELECT 1 FROM json_each(blocked_by) WHERE value = ?
    )
`, [parentTaskId]);

// Search always includes blocked tasks (with a badge)
const searchResults = db.all(`
  SELECT tasks.*, 
    CASE WHEN blocked_by != '[]' THEN 1 ELSE 0 END AS is_blocked
  FROM tasks_fts
  JOIN tasks ON tasks.rowid = tasks_fts.rowid
  WHERE tasks_fts MATCH ?
  ORDER BY rank
`, [query]);
```

### How reminder scheduling works

```ts
// Reminders are stored as a JSON array of ISO8601 timestamps:
// '["2026-02-14T09:00:00Z","2026-02-14T17:00:00Z"]'
//
// A background loop runs every 60 seconds, finds due reminders,
// sends emails via Resend, then removes the fired reminder from the array.

const dueReminders = db.all(`
  SELECT tasks.id, tasks.title, tasks.description, reminder.value AS reminder_time
  FROM tasks, json_each(tasks.reminders) AS reminder
  WHERE reminder.value <= datetime('now')
    AND tasks.status != 'done'
`);

for (const row of dueReminders) {
  await sendReminderEmail(row);

  // Remove the fired reminder from the JSON array
  db.run(`
    UPDATE tasks
    SET reminders = (
      SELECT json_group_array(r.value)
      FROM json_each(tasks.reminders) AS r
      WHERE r.value != ?
    ),
    updated_at = datetime('now')
    WHERE id = ?
  `, [row.reminder_time, row.id]);
}
```

### How daily backup works

```ts
// Export task data as JSON for the daily email attachment.
// This runs once per day on a schedule (e.g., setTimeout loop or Bun cron).
// BLOBs (attachments.data) and the raw .db file are EXCLUDED to stay within SMTP size limits.

import { SmtpTransport } from '@upyo/smtp';
import { createMessage } from '@upyo/core';

const allTasks = db.all('SELECT * FROM tasks');
const allAttachments = db.all('SELECT id, task_id, filename, mime_type, created_at FROM attachments');
const allSettings = db.all('SELECT * FROM settings');

const jsonBackup = JSON.stringify({ tasks: allTasks, attachments: allAttachments, settings: allSettings }, null, 2);

const transport = new SmtpTransport({ hostname: SMTP_HOST, port: SMTP_PORT, username: SMTP_USER, password: SMTP_PASS });
const message = createMessage({
  from: { email: SMTP_FROM },
  to: [{ email: userEmail }],
  subject: `Done - Daily Backup - ${new Date().toISOString().slice(0, 10)}`,
  text: 'Your daily Done database backup is attached.',
  attachments: [{ filename: 'done-backup.json', content: new TextEncoder().encode(jsonBackup) }],
});
// Fire and forget -- if SMTP fails, that's the provider's problem
await transport.send(message).catch(console.error);
await transport.close();
```

### SvelteKit route structure

No separate API server. SvelteKit handles everything via `+page.server.ts` (load + form actions) and `+server.ts` (JSON endpoints for AI/async operations).

```
src/routes/
  +layout.server.ts             -- shared load: user settings from DB
  +layout.svelte                -- drawer navigation shell
  (app)/
    +page.server.ts             -- load: inbox tasks (suggested + all, unblocked + nested blocked)
                                -- actions: create, delete
    +page.svelte                -- inbox screen
    [id]/
      +page.server.ts           -- load: single task + attachments
                                -- actions: update, start, stop, complete, attach
      +page.svelte              -- task details overlay
    in-progress/
      +page.server.ts           -- load: in_progress tasks with nested blocked
      +page.svelte              -- in progress screen
    search/
      +page.server.ts           -- load: FTS5 search results (query param)
      +page.svelte              -- search overlay
    settings/
      +page.server.ts           -- load: all settings
                                -- actions: update settings
      +page.svelte              -- settings screen
  api/
    ai/suggest/+server.ts       -- POST: AI suggestion ranking (returns JSON)
    ai/autofill/+server.ts      -- POST: AI metadata inference (returns JSON)
    attachments/[id]/+server.ts -- GET: download attachment BLOB
    sync/+server.ts             -- GET: sync status, POST: trigger sync
```

Form actions handle all mutations (create/update/delete/start/stop/complete).
SvelteKit's `use:enhance` progressively enhances forms with client-side submissions and automatic page data invalidation -- no manual fetch() or state management for CRUD.
The `api/` routes are only for things that genuinely need raw JSON responses (AI streaming, binary downloads, webhook callbacks).

## Day 2: Core CRUD UI

### Svelte components

- **Layout**: Drawer navigation (Inbox, In Progress, Settings)
- **TaskCard**: Displays title, tags, tracked time, location; tappable to open details
- **TaskDetails**: Overlay with editable title, description, metadata chips, save/close
- **ChipEditor**: Reusable component for tappable metadata chips (opens inline editor on tap)
- **TaskList**: Scrollable list of TaskCard components
- **FAB**: Floating action button (+) to create new task
- **SearchOverlay**: Full-text search with results

### Wiring

- Data arrives server-rendered via `+page.server.ts` load functions -- no client-side fetch on mount
- Mutations use `<form method="POST">` with SvelteKit form actions
- `use:enhance` on forms for client-side progressive enhancement (no full page reload, automatic data re-validation)
- No optimistic UI needed for MVP -- SvelteKit re-runs load functions after form actions, so the page updates with real server state

## Day 3: Timers and In Progress screen

### Server-side timer logic

- Form action `start` (on `[id]/+page.server.ts`) sets `timer_started_at = NOW()`, changes status to `in_progress`
- Form action `stop` calculates delta, adds to `tracked_time`, nulls `timer_started_at`, changes status to `inbox`
- Form action `complete` validates no unresolved blockers, calculates final time, sets status to `done`, then deletes

### In Progress screen

- List all tasks where `status = 'in_progress'`
- **One global tick, not per-task**: a single Svelte store (`nowMs`) updated by one `setInterval(1000)` drives all timer displays. Each task card derives its display from `trackedTime + (nowMs - Date.parse(timerStartedAt)) / 1000`. This scales to 100+ in-progress tasks without spawning 100 intervals.
- Server only contacted on start/stop/complete actions; no polling or SSE for timer display
- Blocked tasks are **not shown** in this list (they appear nested under their blockers)

### Blocking UI

- Blocked tasks are hidden from Suggestions, All, and In Progress top-level lists
- They appear **only nested/indented under the task blocking them** wherever that blocker is visible
- Search always returns blocked tasks with a "blocked" badge -- nothing is truly invisible
- Circular dependencies are harmless: cycled tasks disappear from top-level lists; user finds and fixes via search
- In TaskDetails, `blockedBy` chip opens a task picker (list of other tasks)
- Complete button disabled with explanation when blockers exist

## Days 4-5: AI integration (2 days, not 1)

AI is the core differentiator -- budget two full days for prompt engineering, structured output parsing, and UX polish.

### llama.cpp setup

- Shared llama.cpp instance running on the host with `--host 0.0.0.0 --port 8080`
- Exposes an OpenAI-compatible `/v1/chat/completions` endpoint
- All user Bun processes talk to `http://localhost:8080` -- no API keys, no provider bans
- Model choice is an operator decision (download and load whatever fits the hardware)

### Rate limiting

- Each Bun process enforces an in-memory counter: max 30 AI requests/minute
- Prevents a runaway client loop from starving other users on the shared llama.cpp instance
- Returns 429 Too Many Requests when exceeded

### Autofill

- Debounced call (500ms) as user types task title
- Client-side fetch to `api/ai/autofill/+server.ts` (one of the few raw JSON endpoints)
- Prompt includes: title text, existing tags/locations in DB (for consistency), instructions to infer tags/location/priority/complexity
- Request structured JSON output from the model
- Response pre-fills chip values in TaskDetails
- Loading indicator while waiting; all fields remain manually editable regardless

### Suggestion engine

- Inbox `+page.server.ts` load function fetches suggestions server-side (no client fetch)
- Server fetches all inbox tasks **where `blocked_by = '[]'`** (unblocked only), sends to AI with context:
  - User's current location
  - User's focus directive
  - Task metadata (tags, locations, priority, due dates, complexity)
- AI returns ranked list of task IDs as structured JSON
- The "All" section likewise filters out blocked tasks from top-level; blocked tasks only appear nested under their blockers

### Task splitting

- When AI detects multi-location AND semantics in autofill, it returns a suggestion to split
- UI shows a "Split into X tasks?" prompt
- On confirm, creates N tasks with sequential `blockedBy` chains

### Prompt structure (injection mitigation)

- System prompt with instructions is clearly separated from user data
- User task content goes in a delimited `<user_tasks>` block
- Always request JSON output with a strict schema -- limits what injection can produce
- Never render raw AI output as `{@html}` in Svelte (default escaping handles this)

## Day 6: PWA, email, and polish

### PWA configuration

- `manifest.json` with app name, icons, theme color, display: standalone
- Service worker caches static assets (JS, CSS, icons) for faster repeat loads
- **No full offline mode** -- show a clear "offline" banner when connectivity is lost; all pages and actions require the server (SSR means even page loads need connectivity)
- This avoids the complexity of a local write queue + sync-on-reconnect

### Geolocation

- Browser Geolocation API for autodetect
- Reverse geocode to place name (ask the llama.cpp model to interpret coordinates, or use a free API)
- Location stored in settings, sent with suggestion requests

### Camera

- `<input type="file" accept="image/*" capture="environment">` for photo attachments
- Upload via form action on `[id]/+page.server.ts` (attach action), link to task

### Email notifications (must-have, via `@upyo/smtp`)

All email goes through `@upyo/smtp` configured with operator-provided SMTP credentials.
If the SMTP provider has issues, the app logs the error and moves on -- not our problem.

**Reminder emails**:
- `setTimeout` loop checks tasks with upcoming reminders every 60 seconds
- Sends email via `@upyo/smtp` when reminder time is reached
- Email contains task title, description, metadata, and a direct link to the task in the app
- Fire-and-forget: `.catch(console.error)`

**Daily database backup email**:
- Scheduled job (e.g., 3am UTC)
- Export tasks + settings + attachment metadata as JSON (no BLOBs, no raw `.db` -- stays within SMTP size limits)
- Send via `@upyo/smtp` to the user's registered email
- Serves as data safety net if the instance is lost

## Day 7: Connected apps and deployment

### GitHub integration

- Personal access token stored in settings
- Sync logic:
  - Fetch issues from configured repos
  - Map to tasks: title, body->description, labels->tags, assignees->ignore (single-tenant)
  - Detect issue dependencies (GitHub doesn't have native deps -- parse "depends on #X" in body)
  - Two-way: completing a task closes the issue, closing an issue completes the task
- Lossless: `source_meta` stores full GitHub issue JSON for round-trip

### Codebase TODO sync (read-only inbound for MVP)

Outbound writes (auto-editing source files) are deferred post-competition -- too risky for week 1.

**Inbound** (codebase -> Done):
- Configure repo path (local directory or git clone URL)
- Parse `TODO`, `FIXME`, `HACK` comments with regex, extract file path + line number + surrounding context
- Create tasks with `source: "codebase"`, `sourceId: "repo:file:line"`
- Re-scan periodically or on webhook to detect new/moved/removed TODOs

### Deployment

- **Path-based routing** (`done.app/u/<user-id>/`) instead of subdomains -- one domain, one DNS record, one cert, no registrar API calls on registration, no offensive subdomain risk
- **No Docker per user** -- each user gets a SvelteKit-on-Bun process (~10-20MB idle), not a container
- **llama.cpp** runs as a single shared process on the host
- **Orchestrator script** (Bun/TypeScript):
  - Handles email registration + verification via `@upyo/smtp`
  - Spawns per-user SvelteKit process: `BASE_PATH=/u/<user-id> bun run build/index.js --port=XXXX --db=/data/<user-id>/done.db`
  - Tracks PID + port + user mapping (in-memory map or a small SQLite DB)
  - Updates Caddy AuthCrunch config: sets `acl.paths` in the user's JWT to `/u/<user-id>/**`, authorization policy uses `validate path acl`
  - Caddy reverse-proxies `done.app/u/<user-id>/*` -> `localhost:$PORT` (with path prefix stripping via `handle_path`)
  - Monitors instance activity -- suspends idle processes (`SIGSTOP` / kill) and wakes on URL access (respawn on demand)
- Caddy config: HTTPS termination, AuthCrunch authentication with path ACL validation, path-based reverse proxy to per-user ports (no static file serving -- SvelteKit handles everything)
- Data directory: `/data/<user-id>/done.db` per user (libsql file, isolation boundary)
- User IDs are opaque ULIDs (not user-chosen names) to prevent abuse

### Testing (if time permits)

- Unit tests for database/business logic functions (vitest)
- Basic Playwright smoke tests for critical flows:
  - Create task -> appears in inbox
  - Start timer -> appears in In Progress with running timer
  - Set blocker -> complete button disabled
  - Search -> results appear

### Documentation

- Brief README with: what it is, how to deploy, registration flow

## Risk areas

### AI autofill latency (typing feels sluggish)
- Debounce 500ms, show loading indicator, make all fields manually editable
- llama.cpp latency depends on hardware -- test early, adjust model size if needed

### GitHub sync complexity (two-way is hard)
- Start with one-way import, add write-back as stretch

### Timer accuracy across timezones
- Store all timestamps as UTC, compute display client-side

### No full offline mode
- App requires connectivity for all actions; show "offline" banner when disconnected
- Avoids the massive complexity of local write queue + sync-on-reconnect

### llama.cpp resource contention
- Shared instance serving multiple users could bottleneck on concurrent requests
- Rate limiting per process helps; queue depth monitoring would be ideal
- For competition scale (few users), this is fine

### BLOB attachments bloat the database
- A few photos can make the `.db` file large
- Daily backup email excludes BLOBs intentionally
- For competition MVP this is acceptable; long-term, move attachments to filesystem

### Blocked-tasks N+1 query
- Fetching dependents per visible task is N+1; batch into one query:

```sql
-- Fetch ALL blocked inbox tasks and their blocker IDs in one query
-- Group by blocker on the client side
SELECT tasks.*, blocker.value AS blocker_id
FROM tasks, json_each(tasks.blocked_by) AS blocker
WHERE tasks.status = 'inbox'
  AND tasks.blocked_by != '[]'
```

## Competition scope (must/should/could)

**Must have** (days 1-6):

- Task CRUD with all metadata fields
- Inbox and In Progress screens with live timers
- Task blocking/dependencies (with nested display)
- AI autofill on task creation (via llama.cpp)
- AI-powered suggestion engine (location + focus)
- Basic PWA (installable, cached app shell, offline banner)
- Email reminder notifications (via `@upyo/smtp`)
- Daily database backup email (via `@upyo/smtp`)
- Settings screen with AI model configuration

**Should have** (days 6-7):

- Search overlay with FTS5
- Geolocation autodetect
- Camera attachments
- GitHub two-way sync
- Codebase TODO inbound scan (read-only)

**Could have** (post-competition):

- Codebase TODO outbound writes
- Linear sync
- Calendar sync
- Full offline mode with sync-on-reconnect
- Comprehensive test suite
