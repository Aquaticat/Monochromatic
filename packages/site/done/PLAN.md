# Done -- Implementation plan

This plan assumes one developer working 5 days over a week with AI assistance.
Available hours: Tue 4h, Wed 4h, Thu 4h, Fri 4h, Sat 0h, Sun 0h, Mon 4h -- 20h total.
Hour estimates are per-task. Items without a priority marker are implicitly highest priority.

## Day 1 (Tue): Scaffolding and data layer (~4h)

### 1.1 Project setup (~2h)

- (0.5h) Initialize SvelteKit project at `packages/site/done/`
- (0.5h) Configure adapter-bun for SSR (not static adapter)
- (0.25h) Add `package.json` with `workspace:*` references to monorepo packages
- (0.25h) Add `mise.toml` with `dev`, `build`, and `start` tasks
- (0.25h) Leave SvelteKit `base` path as default `/` -- the orchestrator strips `/u/<user-id>` on inbound and SvelteKit generates relative links, so browser-side URLs resolve correctly
- (0.25h) Set `ORIGIN` env var per user process (e.g., `ORIGIN=https://done.app`) so SvelteKit can construct absolute URLs when needed (e.g., redirects)

### 1.2 Database schema and migration (~3h)

- (0.5h) Install `@libsql/client`, create `src/lib/db.ts` with `createClient({ url: "file:/data/<user-id>/done.db" })` and migration runner
- (1.0h) Write core tables SQL (tasks, attachments, settings) and run migration on first startup
- (0.5h) Write FTS5 virtual table + sync triggers (insert/update/delete)
- (0.5h) Write indexes for common query patterns
- (0.5h) Verify migration runs cleanly on a fresh `.db` file, test FTS5 triggers manually

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

### 1.3 Database helper functions (~3h)

- (0.5h) Write `src/lib/db/tasks.ts`: CRUD functions (create, read, update, delete task)
- (0.5h) Write `src/lib/db/tasks.ts`: timer functions (startTimer, stopTimer, completeTask with blocker check)
- (0.5h) Write `src/lib/db/tasks.ts`: query functions (inbox unblocked, inbox blocked-by-parent, in-progress, search)
- (0.5h) Write `src/lib/db/attachments.ts`: create, list-by-task, get-by-id, delete
- (0.5h) Write `src/lib/db/settings.ts`: get, set, getAll
- (0.5h) Write `src/lib/db/reminders.ts`: getDueReminders, removeReminder

The SQL patterns below are reference material for implementing these helpers.

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
// libsql API: client.execute({ sql, args }) returns { rows, columns, rowsAffected }

// Reading: parse the JSON string from SQLite into a JS array
const result = await client.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [taskId] });
const task = result.rows[0];
const tags: string[] = JSON.parse(task.tags as string);       // '["shopping"]' -> ['shopping']
const locations: string[] = JSON.parse(task.locations as string);

// Writing: stringify the JS array back to JSON for SQLite
await client.execute({ sql: 'UPDATE tasks SET tags = ? WHERE id = ?', args: [JSON.stringify(['shopping', 'errands']), taskId] });

// Querying tasks that contain a specific tag (uses SQLite JSON functions):
// json_each() expands a JSON array into rows, so we can match individual elements.
const tagResult = await client.execute({
  sql: 'SELECT tasks.* FROM tasks, json_each(tasks.tags) AS tag WHERE tag.value = ?',
  args: ['shopping'],
});
const tasksWithTag = tagResult.rows;
```

### How timers work in SQL

```ts
// Start timer: record the current UTC timestamp
await client.execute({
  sql: `UPDATE tasks
        SET timer_started_at = datetime('now'),
            status = 'in_progress',
            updated_at = datetime('now')
        WHERE id = ?`,
  args: [taskId],
});

// Stop timer: calculate elapsed seconds, add to cumulative total, clear the timestamp
await client.execute({
  sql: `UPDATE tasks
        SET tracked_time = tracked_time + CAST(
              (julianday('now') - julianday(timer_started_at)) * 86400
            AS INTEGER),
            timer_started_at = NULL,
            status = 'inbox',
            updated_at = datetime('now')
        WHERE id = ?`,
  args: [taskId],
});

// Read current elapsed time for display (without stopping):
// In the load function, return both tracked_time and timer_started_at.
// The client computes: displaySeconds = trackedTime + (Date.now() - Date.parse(timerStartedAt)) / 1000
```

### How blocking validation works in SQL

```ts
// Before completing a task, check if all blockers are done.
// blocked_by is a JSON array of task IDs like '["01HX...","01HY..."]'.
// We expand it with json_each and check if any blocker still exists (not yet deleted/done).

const result = await client.execute({
  sql: `SELECT blocker.value AS blocker_id, tasks.title AS blocker_title
        FROM json_each(
          (SELECT blocked_by FROM tasks WHERE id = ?)
        ) AS blocker
        JOIN tasks ON tasks.id = blocker.value
        WHERE tasks.status != 'done'`,
  args: [taskId],
});

if (result.rows.length > 0) {
  // Return form action failure with the list of blocking tasks
  return fail(409, { error: 'Task is blocked', blockedBy: result.rows });
}

// If no active blockers, proceed with completion
await client.execute({ sql: 'DELETE FROM tasks WHERE id = ?', args: [taskId] });
```

### How to query tasks with nested blocked children

```ts
// Fetch top-level (unblocked) inbox tasks for "All" section
const topLevel = await client.execute({
  sql: `SELECT * FROM tasks WHERE status = 'inbox' AND blocked_by = '[]' ORDER BY created_at DESC`,
  args: [],
});

// Batched: fetch ALL blocked inbox tasks and their blocker IDs in one query
// Group by blocker on the client side (avoids N+1)
const blocked = await client.execute({
  sql: `SELECT tasks.*, blocker.value AS blocker_id
        FROM tasks, json_each(tasks.blocked_by) AS blocker
        WHERE tasks.status = 'inbox' AND tasks.blocked_by != '[]'`,
  args: [],
});

// Search always includes blocked tasks (with a badge)
const searchResults = await client.execute({
  sql: `SELECT tasks.*,
          CASE WHEN blocked_by != '[]' THEN 1 ELSE 0 END AS is_blocked
        FROM tasks_fts
        JOIN tasks ON tasks.rowid = tasks_fts.rowid
        WHERE tasks_fts MATCH ?
        ORDER BY rank`,
  args: [query],
});
```

### How reminder scheduling works

```ts
// Reminders are stored as a JSON array of ISO8601 timestamps:
// '["2026-02-14T09:00:00Z","2026-02-14T17:00:00Z"]'
//
// A background loop runs every 60 seconds, finds due reminders,
// sends emails, then removes the fired reminder from the array.

const dueResult = await client.execute({
  sql: `SELECT tasks.id, tasks.title, tasks.description, reminder.value AS reminder_time
        FROM tasks, json_each(tasks.reminders) AS reminder
        WHERE reminder.value <= datetime('now')
          AND tasks.status != 'done'`,
  args: [],
});

for (const row of dueResult.rows) {
  await sendReminderEmail(row);

  // Remove the fired reminder from the JSON array
  await client.execute({
    sql: `UPDATE tasks
          SET reminders = (
            SELECT json_group_array(r.value)
            FROM json_each(tasks.reminders) AS r
            WHERE r.value != ?
          ),
          updated_at = datetime('now')
          WHERE id = ?`,
    args: [row.reminder_time, row.id],
  });
}
```

### How daily backup works

```ts
// Export task data as JSON for the daily email attachment.
// This runs once per day on a schedule (e.g., setTimeout loop or Bun cron).
// BLOBs (attachments.data) and the raw .db file are EXCLUDED to stay within SMTP size limits.

import { SmtpTransport } from '@upyo/smtp';
import { createMessage } from '@upyo/core';

// @upyo/smtp actual API: host/port/secure/auth (not hostname/username/password)
const transport = new SmtpTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: true,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

const tasks = await client.execute({ sql: 'SELECT * FROM tasks', args: [] });
const attachments = await client.execute({
  sql: 'SELECT id, task_id, filename, mime_type, created_at FROM attachments',
  args: [],
});
const settings = await client.execute({ sql: 'SELECT * FROM settings', args: [] });

const jsonBackup = JSON.stringify({
  tasks: tasks.rows, attachments: attachments.rows, settings: settings.rows,
}, null, 2);

// @upyo/core actual API: content.text (not bare text), returns receipt with .successful
const message = createMessage({
  from: SMTP_FROM,
  to: userEmail,
  subject: `Done - Daily Backup - ${new Date().toISOString().slice(0, 10)}`,
  content: { text: 'Your daily Done database backup is attached.' },
  attachments: [{ filename: 'done-backup.json', content: new TextEncoder().encode(jsonBackup) }],
});

// Fire and forget -- if SMTP fails, that's the provider's problem
const receipt = await transport.send(message).catch(console.error);
await transport.close();
```

### SvelteKit route structure (reference for days 2-6)

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

### Error handling pattern

Happy-path only for competition. All errors echo to the user in a popup toast.

```svelte
<!-- In +layout.svelte: global error toast -->
<script>
  import { page } from '$app/stores';
  // SvelteKit form actions return { type: 'failure', data } on fail()
  // AI endpoints return { error: string } on failure
  // Both surface through the same toast mechanism
</script>

{#if $page.form?.error}
  <div class="toast toast-error" role="alert">{$page.form.error}</div>
{/if}
```

In form actions, use SvelteKit's `fail()` to return errors:
```ts
import { fail } from '@sveltejs/kit';
// On any error:
return fail(400, { error: 'Something went wrong: ' + errorMessage });
```

For AI fetch errors, catch and display inline:
```ts
const response = await fetch('/api/ai/autofill', { method: 'POST', body });
if (!response.ok) {
  errorMessage = 'AI unavailable, fill fields manually';
  return;
}
```

### Orchestrator database schema (orchestrator.db)

The orchestrator maintains its own SQLite database for user accounts, sessions, and process tracking.
This is separate from each user's `done.db`.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                -- ULID
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,        -- argon2id via Bun.password.hash()
  email_verified INTEGER NOT NULL DEFAULT 0,
  verification_token TEXT,            -- random token sent via email, nulled after verification
  created_at TEXT NOT NULL            -- ISO8601
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                -- random hex string (32 bytes)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,           -- ISO8601, e.g., 7 days from creation
  created_at TEXT NOT NULL
);

CREATE TABLE processes (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  port INTEGER NOT NULL UNIQUE,       -- allocated from PORT_RANGE_START..PORT_RANGE_END
  pid INTEGER,                        -- OS process ID, null if not running
  last_request_at TEXT                -- ISO8601, updated on each proxied request
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

### Session cookie format

The session cookie is a simple lookup token, not a signed JWT.
The `sessions` table is the source of truth -- no crypto to get wrong.

```
Cookie: session=<session-id>; Path=/u/<user-id>/; HttpOnly; Secure; SameSite=Strict
```

- `session-id`: 32-byte random hex string (via `crypto.randomUUID()` or `crypto.getRandomValues()`)
- On each request, orchestrator looks up `session-id` in the `sessions` table
- If found and not expired, extract `user_id` and compare against the path's `<user-id>`
- If expired, delete the row and redirect to login
- No HMAC signing needed -- the session ID itself is the secret (high entropy, stored server-side)

### Orchestrator request flow (pseudocode)

```ts
// Main request handler -- Bun.serve() in the orchestrator process
function handleRequest(req: Request): Response | Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // 1. Public routes (no auth required)
  if (path === '/register') return handleRegister(req);
  if (path === '/login') return handleLogin(req);
  if (path === '/verify') return handleEmailVerification(req);
  if (path === '/') return Response.redirect('/login');

  // 2. Extract user-id from path: /u/<user-id>/...
  const match = path.match(/^\/u\/([A-Z0-9]{26})\//);  // ULID is 26 chars
  if (!match) return new Response('Not found', { status: 404 });
  const pathUserId = match[1];

  // 3. Validate session cookie
  const sessionId = parseCookie(req.headers.get('cookie'), 'session');
  if (!sessionId) return Response.redirect('/login');

  const session = await lookupSession(sessionId);  // DB query
  if (!session || new Date(session.expires_at) < new Date()) {
    return Response.redirect('/login');
  }

  // 4. Path ACL: session user must match path user
  if (session.user_id !== pathUserId) {
    return new Response('Forbidden', { status: 403 });
  }

  // 5. Ensure user process is running
  const proc = await ensureProcessRunning(pathUserId);  // spawn if needed

  // 6. Update last-request timestamp (fire and forget)
  updateLastRequest(pathUserId);

  // 7. Proxy to user's SvelteKit process, stripping /u/<user-id> prefix
  const stripped = path.replace(`/u/${pathUserId}`, '') || '/';
  const proxyUrl = `http://localhost:${proc.port}${stripped}${url.search}`;
  return fetch(proxyUrl, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  });
}
```

### Registration and login page sketches

The orchestrator serves plain HTML pages (no SvelteKit) for auth flows.
Minimal styling -- these are functional forms, not the app itself.

**Registration (`/register`):**
```html
<form method="POST" action="/register">
  <h1>Create your Done account</h1>
  <label>Email <input type="email" name="email" required></label>
  <label>Password <input type="password" name="password" required minlength="8"></label>
  <button type="submit">Register</button>
  <!-- On error, re-render page with error message in a <p class="error"> -->
  <!-- On success, show "Check your email for verification link" -->
</form>
```

**Login (`/login`):**
```html
<form method="POST" action="/login">
  <h1>Log in to Done</h1>
  <label>Email <input type="email" name="email" required></label>
  <label>Password <input type="password" name="password" required></label>
  <button type="submit">Log in</button>
  <!-- Same error for wrong email and wrong password: "Invalid email or password" -->
  <!-- On success, Set-Cookie + redirect to /u/<user-id>/ -->
</form>
```

**Email verification (`/verify?token=<token>`):**
- GET request with token query param
- Look up token in `users` table, set `email_verified = 1`, null the token
- On success: redirect to `/login` with "Email verified" message
- On failure: "Invalid or expired verification link"

### AI model recommendation

For CPU-only inference on a competition server, use the smallest model that reliably produces structured JSON.
Our prompts are simple (infer tags from a title, rank tasks by context) -- not hard reasoning problems.
Speed matters more than capability here because autofill runs on every keystroke (debounced).

**Primary choice: Qwen3-1.7B (Q4_K_M quantization)**
- ~1.2GB RAM, good structured JSON output (community-validated with Ollama JSON schema constraints)
- Use **non-thinking mode** (`/no_think` or temperature=0) for fast autofill without chain-of-thought overhead
- Official GGUF from Qwen team: `Qwen/Qwen3-1.7B-GGUF`
- llama.cpp auto-downloads: `--hf-repo Qwen/Qwen3-1.7B-GGUF --hf-file Qwen3-1.7B-Q4_K_M.gguf --ctx-size 4096`

**Fallback: LFM2.5-1.2B-Instruct (GGUF)**
- Under 1GB RAM, 239 tok/s on AMD CPU -- remarkably fast
- IFEval 86.23% (instruction following) is strong for its size
- Official GGUF: `llama-cli -hf LiquidAI/LFM2.5-1.2B-Instruct-GGUF`
- Use if Qwen3 is too slow on the competition server's CPU

Both support the OpenAI-compatible `/v1/chat/completions` endpoint in llama.cpp server mode.

### AI prompt templates (reference for day 4)

**Autofill prompt (4.2):**
```
System: You are a task metadata assistant. Given a task title, infer metadata.
Return ONLY valid JSON matching this schema, no other text:
{
  "tags": string[],          // e.g., ["shopping", "errands"]
  "locations": string[],     // e.g., ["Walmart"] -- places where this task can be done
  "priority": "low" | "medium" | "high" | null,
  "complexity": "low" | "medium" | "high" | null,
  "splitSuggestion": null | { "reason": string, "tasks": string[] }
}

For consistency, prefer these existing tags: <existing_tags>
For consistency, prefer these existing locations: <existing_locations>

If the task implies multiple locations with AND semantics (must visit A then B),
set splitSuggestion with the reason and proposed sub-task titles.

<user_task>
{title}
</user_task>
```

**Suggestion ranking prompt (5.1):**
```
System: You are a task prioritization assistant. Given a list of tasks and the user's
current context, return the task IDs ranked by what the user should do next.
Return ONLY a JSON array of task ID strings, most important first. No other text.

<user_context>
Location: {currentLocation}
Focus: {focusDirective}
Time: {currentTime}
</user_context>

<user_tasks>
{tasks as JSON array of {id, title, tags, locations, priority, dueDate, complexity}}
</user_tasks>
```

**Task splitting prompt (4.3):**
Handled by the autofill prompt above via the `splitSuggestion` field.
When the autofill response includes a non-null `splitSuggestion`, the UI shows a confirmation dialog.

## Day 2 (Wed): Core CRUD UI (~4h)

### 2.1 Layout shell and navigation (~2h)

- (0.5h) Create `+layout.server.ts`: load user settings from DB
- (0.5h) Create `+layout.svelte`: drawer navigation shell (Inbox, In Progress, Settings), responsive sidebar
- (0.5h) Create FAB component: floating action button (+) for new task creation
- (0.5h) Set up global styles, CSS variables, font loading

### 2.2 Inbox screen (~2.5h)

- (0.5h) Create `(app)/+page.server.ts`: load function returning unblocked inbox tasks
- (0.5h) Create `(app)/+page.server.ts`: form actions for create and delete
- (0.5h) Create TaskCard component: displays title, tags, tracked time, location; tappable link to details
- (0.5h) Create TaskList component: scrollable list of TaskCard, with "Suggested" and "All" collapsible sections
- (0.5h) Create `(app)/+page.svelte`: wire TaskList with data from load, FAB with create action

### 2.3 Task details overlay (~2.5h)

- (0.5h) Create `(app)/[id]/+page.server.ts`: load single task + attachments; form actions for update, delete
- (0.5h) Create ChipEditor component: reusable tappable metadata chip (opens inline editor on tap)
- (0.5h) Create TaskDetails component: editable title, description textarea, metadata chips, save/close
- (0.5h) Wire all chips: tags, location, priority, due date, complexity, reminders, blockedBy
- (0.5h) Create `(app)/[id]/+page.svelte`: overlay presentation, `use:enhance` on all forms

### 2.4 Forms wiring (~1h)

- (0.5h) Add `use:enhance` to all forms for progressive enhancement (no full page reload)
- (0.5h) Verify round-trip: create task -> appears in inbox -> open details -> edit -> save -> inbox reflects changes

Data arrives server-rendered via `+page.server.ts` load functions -- no client-side fetch on mount.
Mutations use `<form method="POST">` with SvelteKit form actions.
No optimistic UI needed for MVP -- SvelteKit re-runs load functions after form actions, so the page updates with real server state.

## Day 3 (Thu): Overflow from days 1-2, then medium/low items (~4h)

### 3.1 Server-side timer logic (~2h) `priority:low`

- (0.5h) Add form action `start` on `[id]/+page.server.ts`: set `timer_started_at = NOW()`, change status to `in_progress`
- (0.5h) Add form action `stop`: calculate elapsed delta, add to `tracked_time`, null `timer_started_at`, change status to `inbox`
- (0.5h) Add form action `complete`: validate no unresolved blockers, calculate final time, set status to `done`, then delete
- (0.5h) Test all three actions manually: start -> stop -> verify cumulative time; start -> complete -> verify blocker rejection

### 3.2 In Progress screen (~2.5h) `priority:low`

- (0.5h) Create `in-progress/+page.server.ts`: load all tasks where `status = 'in_progress'` (unblocked only at top level)
- (0.5h) Create `in-progress/+page.svelte`: list of TaskCards with live timer display
- (0.5h) Implement global timer tick: single Svelte store (`nowMs`) updated by one `setInterval(1000)`, all task cards derive display from `trackedTime + (nowMs - Date.parse(timerStartedAt)) / 1000`
- (0.5h) Format timer display as `HH:MM:SS`, handle edge cases (no timerStartedAt, timer just started)
- (0.5h) Verify: start timer on task -> navigate to In Progress -> see ticking timer -> stop -> time persists

### 3.3 Blocking UI (~2h) `priority:medium`

- (0.5h) Update inbox load function: fetch blocked tasks per visible parent (batched query), return as nested structure
- (0.5h) Update TaskList component: render blocked tasks indented under their blockers with a "blocked" badge
- (0.5h) Add blocker picker to TaskDetails: `blockedBy` chip opens a searchable task list, saves selected IDs
- (0.5h) Disable complete button when blockers exist, show explanation with list of blocking tasks

### 3.4 Search overlay (~1.5h) `priority:low`

- (0.5h) Create `search/+page.server.ts`: load function runs FTS5 query from URL search param, returns results with `is_blocked` flag
- (0.5h) Create `search/+page.svelte`: search input, debounced query submission, result list with blocked badges
- (0.5h) Test: create tasks with various tags -> search by tag -> verify results include blocked tasks with badge

## Day 4 (Fri): AI integration -- autofill and suggestions (~4h)

AI is the core differentiator. Prompt engineering and structured output parsing are the focus.

### 4.1 llama.cpp client and rate limiting (~2h)

- (0.5h) Create `src/lib/ai/client.ts`: HTTP client wrapper for llama.cpp's OpenAI-compatible chat completions endpoint (reads `CHAT_COMPLETIONS_URL` env var, e.g., `http://llama-cpp:8080/v1/chat/completions`). Use `response_format: { type: "json_object" }` to force JSON output.
- (0.5h) Implement in-memory rate limiter: sliding window counter, max 30 requests/minute per process, returns 429 when exceeded
- (0.5h) Create `src/lib/ai/prompts.ts`: system prompt templates with clear separation of instructions vs user data (user content in `<user_tasks>` block)
- (0.5h) Test: verify client connects to llama.cpp, sends a simple prompt, parses response; verify rate limiter rejects burst requests

### 4.2 Autofill endpoint (~3h)

- (0.5h) Create `api/ai/autofill/+server.ts`: POST handler accepting `{ title: string }`
- (0.5h) Write autofill prompt: include title text, existing tags/locations from DB (for consistency), instructions to infer tags/location/priority/complexity
- (0.5h) Implement structured JSON output parsing: define expected schema, validate response, fallback to empty on parse failure
- (0.5h) Wire client-side: debounced fetch (500ms) on title input keyup, loading indicator, pre-fill chip values from response
- (0.5h) Handle edge cases: empty title, AI timeout, malformed response, all fields remain manually editable regardless
- (0.5h) Test end-to-end: type "Buy milk from Walmart" -> see `#shopping`, `where: Walmart`, `complexity: low` auto-filled

### 4.3 Task splitting (~1.5h)

- (0.5h) Extend autofill prompt: detect multi-location AND semantics, return `splitSuggestion` in response when applicable
- (0.5h) Create SplitPrompt component: "Split into X tasks?" confirmation UI, shows proposed task titles
- (0.5h) Wire confirm action: create N tasks with sequential `blockedBy` chains via form action

### 4.4 Prompt injection hardening (~1.5h)

- (0.5h) Review all prompts: verify system prompt separated from user data, user content always in delimited blocks
- (0.5h) Verify structured JSON output schema validation rejects unexpected fields
- (0.5h) Verify Svelte never renders AI output as `{@html}` (default text escaping is sufficient)

## Day 5 (Mon): Suggestions, orchestrator, and deployment (~4h)

Two-day gap (Sat-Sun) before this session. Budget time for context recovery.

### 5.1 Suggestion engine -- server side (~3h)

- (0.5h) Write suggestion prompt: include all unblocked inbox tasks (metadata only), user's current location, focus directive
- (0.5h) Implement structured output: AI returns ranked array of task IDs as JSON, validate against known task IDs
- (1.0h) Integrate into inbox `+page.server.ts` load function: fetch suggestions server-side, sort "Suggested" section by AI ranking
- (0.5h) Handle AI unavailable: if llama.cpp is down or rate-limited, fall back to simple heuristic (due date, priority)
- (0.5h) Test: create 10 tasks with varied locations/priorities, set location to "Walmart", verify shopping tasks surface first

### 5.2 Suggestion engine -- UI polish (~2.5h)

- (0.5h) Add loading state for suggestions section (skeleton cards while AI processes)
- (0.5h) Add "Suggested" section header with explanation tooltip ("Based on your location and focus")
- (0.5h) Handle empty suggestions gracefully: show "No suggestions right now" message
- (0.5h) Tune suggestion count: limit to top 5-8 tasks to avoid overwhelming the user
- (0.5h) Test suggestion refresh: change location in settings -> reload inbox -> verify new suggestions

### 5.3 AI model tuning and prompt iteration (~2.5h)

- (1.0h) Test autofill with diverse task titles, iterate on prompt wording for accuracy
- (1.0h) Test suggestion ranking with various location/focus combos, iterate on ranking prompt
- (0.5h) Document final prompt templates in `src/lib/ai/prompts.ts` with rationale comments

### 7.1 Orchestrator script (~4h)

The orchestrator is a standalone Bun/TypeScript process that manages the entire multi-tenant lifecycle.
It lives at `packages/site/done/orchestrator/` with its own entry point.
It handles auth, reverse proxy, and process management -- no Caddy or AuthCrunch needed.
Coolify's reverse proxy terminates HTTPS upstream; the orchestrator listens on HTTP (port 3000).

**7.1a Registration and login (~1.5h)**

- (0.5h) Create `orchestrator/src/auth.ts`: registration form (HTML page served by orchestrator), email verification via `@upyo/smtp`
- (0.5h) Implement login: verify password with `Bun.password.verify()`, create session row in `orchestrator.db` with random 32-byte hex ID, set cookie (`HttpOnly`, `SameSite=Strict`, `Secure`, `Path=/u/<user-id>/`), rate limit login attempts (10/min per IP)
- (0.5h) On verified registration: generate ULID user ID, hash password with `Bun.password.hash()` (argon2id), store in `orchestrator.db`, create `/data/<user-id>/` directory, initialize empty `done.db` with migration

**7.1b Process management (~1.5h)**

- (0.5h) Create `orchestrator/src/process-manager.ts`: spawn per-user SvelteKit process (`BASE_PATH=/u/<user-id> bun run build/index.js --port=XXXX --db=/data/<user-id>/done.db`)
- (0.5h) Implement port allocation: track PID + port + user-id mapping in `orchestrator.db`; allocate ports from a configurable range (e.g., 3100-3999)
- (0.5h) Implement process health check: periodic liveness probe, restart crashed processes, log failures

**7.1c Idle suspension and wake-on-request (~0.5h)** `priority:min`

- (0.25h) Monitor last-request timestamp per user (updated on each proxied request)
- (0.25h) Suspend idle processes after configurable timeout (kill + respawn on next request); orchestrator returns loading page briefly during cold start

**7.1d HTTP reverse proxy and path ACL (~0.5h)**

- (0.25h) Create `orchestrator/src/proxy.ts`: on each request to `/u/<user-id>/*`, validate session cookie, check session user-id matches path user-id, proxy to `localhost:$PORT` with prefix stripped
- (0.25h) Handle edge cases: unauthenticated -> redirect to login, wrong user -> 403, user process not running -> spawn and queue request

### 7.4 Docker Compose for Coolify (~1h)

The entire stack deploys as a single `docker-compose.yml` at `packages/site/done/docker-compose.yml`.
Coolify picks it up and manages the deployment.
Coolify's reverse proxy handles HTTPS termination -- the orchestrator only listens on HTTP.

**Services:**

| Service | Image | Purpose |
| --- | --- | --- |
| `orchestrator` | Custom (Bun + app build) | Auth, reverse proxy, process management |
| `llama-cpp` | `ghcr.io/ggml-org/llama.cpp:server` (CPU) | Shared AI inference, OpenAI-compatible API |

The orchestrator container spawns per-user Bun processes as child processes within itself (not separate containers).
User data lives on a named volume mounted at `/data/` inside the orchestrator container.
The orchestrator keeps all routing state in memory (rebuilt from `orchestrator.db` on startup) -- no external config files to manage.

**Atomic tasks:**

- (0.25h) Write `docker-compose.yml`: two services, inline Dockerfile for orchestrator (see sketch below), volumes (`done-data`)
- (0.25h) Configure environment variables: `SMTP_*`, `CHAT_COMPLETIONS_URL`, port range
- (0.25h) Test locally: `docker compose up`, register user, verify full flow (registration -> login -> process spawn -> proxy -> AI suggestion)

**Example `docker-compose.yml` with inline Dockerfile:**

adapter-bun expects its build output on disk, and child SvelteKit processes are spawned via `bun run build/index.js`, so Bun must be available at runtime (not just a SEA).
The orchestrator runs TS directly via Bun (no build step needed for it).
The llama-cpp container auto-downloads the model on first start via `--hf-repo` + `--hf-file` -- no volume needed.

```yaml
services:
  orchestrator:
    build:
      context: .
      dockerfile_inline: |
        FROM oven/bun:1 AS build
        WORKDIR /app
        COPY package.json bun.lock ./
        RUN bun install --frozen-lockfile
        COPY . .
        RUN bun run build

        FROM oven/bun:1-slim
        WORKDIR /app
        COPY --from=build /app/build ./build
        COPY --from=build /app/orchestrator ./orchestrator
        COPY --from=build /app/node_modules ./node_modules
        EXPOSE 3000
        CMD ["bun", "run", "orchestrator/src/index.ts"]
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - done-data:/data
    environment:
      - SMTP_HOST
      - SMTP_PORT
      - SMTP_USER
      - SMTP_PASS
      - SMTP_FROM
      - CHAT_COMPLETIONS_URL=http://llama-cpp:8080/v1/chat/completions
      - PORT_RANGE_START=3100
      - PORT_RANGE_END=3999
    depends_on:
      - llama-cpp

  llama-cpp:
    image: ghcr.io/ggml-org/llama.cpp:server
    command:
      - "--host"
      - "0.0.0.0"
      - "--port"
      - "8080"
      - "--hf-repo"
      - "Qwen/Qwen3-1.7B-GGUF"
      - "--hf-file"
      - "Qwen3-1.7B-Q4_K_M.gguf"
      - "--ctx-size"
      - "4096"
    volumes:
      - llama-models:/root/.cache/llama.cpp

volumes:
  done-data:
  llama-models:
```

### 7.5 Deployment verification (~0.5h)

- (0.25h) Verify full stack via `docker compose up`: registration -> email verification -> login -> process spawn -> proxy -> inbox loads -> AI works
- (0.25h) Verify auth enforcement: unauthenticated request redirects to login, wrong user path returns 403

### 7.6 Testing (~0h, stretch goal)

- Unit tests for critical database functions (vitest): CRUD, timer, blocking validation
- Basic Playwright smoke test: create task -> appears in inbox -> start timer -> appears in In Progress

### 7.7 Documentation (~0h, only if time permits)

- Brief README with: what it is, how to deploy with Coolify, env var reference

## Deferred items (build when time allows, ordered by priority)

### 6.1 PWA configuration (~1.5h) `priority:low`

- (0.25h) Create `manifest.json`: app name, icons, theme color, `display: standalone`
- (0.5h) Create service worker: cache static assets (JS, CSS, icons) for faster repeat loads
- (0.25h) Add offline detection: show "offline" banner when connectivity is lost (no full offline mode -- all actions require server)
- (0.5h) Test: install as PWA on phone/desktop, verify cached shell loads fast, verify offline banner appears when disconnected

### 6.2 Geolocation (~1h) `priority:low`

- (0.25h) Add Browser Geolocation API call to detect current position
- (0.5h) Reverse geocode coordinates to place name (via llama.cpp or a free geocoding API)
- (0.25h) Store detected location in settings, send with suggestion requests

### 6.3 Camera and attachments (~1h) `priority:low`

- (0.25h) Add `<input type="file" accept="image/*" capture="environment">` to TaskDetails
- (0.5h) Wire form action `attach` on `[id]/+page.server.ts`: validate file type/size, store as BLOB in attachments table
- (0.25h) Create `api/attachments/[id]/+server.ts`: GET handler to download attachment by ID

### 6.4 Email -- reminder notifications (~2h) `priority:medium`

- (0.5h) Create `src/lib/email/transport.ts`: `@upyo/smtp` wrapper configured from SMTP env vars
- (0.5h) Create `src/lib/email/reminders.ts`: query due reminders, format email body (task title, description, link)
- (0.5h) Wire `setTimeout` loop in server startup: check every 60 seconds, send due reminders, remove fired reminders from JSON array
- (0.5h) Test: create task with reminder 1 minute from now -> verify email arrives -> verify reminder removed from task

### 6.5 Email -- daily database backup (~1h) `priority:medium`

- (0.25h) Create `src/lib/email/backup.ts`: export tasks + settings + attachment metadata as JSON (no BLOBs)
- (0.5h) Wire scheduled job: run once daily at 3am UTC, send JSON attachment via `@upyo/smtp`
- (0.25h) Test: trigger backup manually -> verify email arrives with valid JSON attachment

### 6.6 Settings screen (~1.5h) `priority:low`

- (0.5h) Create `settings/+page.server.ts`: load all settings; form actions for updating each setting
- (0.5h) Create `settings/+page.svelte`: AI model selection, email config, connected apps status, location
- (0.5h) Wire save actions with `use:enhance`, verify round-trip

### 7.2 GitHub integration (~1.5h) `priority:low`

- (0.25h) Create `src/lib/sync/github.ts`: GitHub API client using personal access token from settings
- (0.5h) Implement import: fetch issues from configured repos, map to tasks (title, body->description, labels->tags), store `source_meta` for lossless round-trip
- (0.25h) Implement issue dependency detection: parse "depends on #X" in issue body, map to `blockedBy`
- (0.25h) Implement write-back: completing a task closes the GitHub issue (PATCH issue status)
- (0.25h) Wire into settings: configure repos, trigger sync, show sync status

### 7.3 Codebase TODO sync (~0.5h) `priority:low`

Read-only inbound for MVP. Outbound writes deferred post-competition.

- (0.25h) Create `src/lib/sync/codebase.ts`: regex scanner for `TODO`, `FIXME`, `HACK` comments in configured directories; extract file path + line number + context; create tasks with `source: "codebase"`, `sourceId: "repo:file:line"`
- (0.25h) Wire into settings: configure repo paths, trigger scan, show scan results

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

### Orchestrator complexity underestimated
- Process management, auth, reverse proxy, and registration flow are non-trivial -- but simpler than configuring Caddy + AuthCrunch
- Cold-start wake-on-request adds latency; users may see a brief loading page
- Mitigation: keep the orchestrator minimal for MVP (no graceful suspension, just kill + respawn), test registration flow early on day 5

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

## Priority summary

Items without a marker are implicitly highest priority and form the 20h core plan.
Marked items are built if time allows, in descending priority order.

**Core (unmarked):** 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 7.1a, 7.1b, 7.1d, 7.4, 7.5
Note: 7.4 reduced from 1.5h to 1h (removed Caddy/AuthCrunch Dockerfile and config)

**`priority:medium`:** 3.3 (blocking UI), 6.4 (email reminders), 6.5 (daily backup)

**`priority:low`:** 3.1 (timer logic), 3.2 (in-progress screen), 3.4 (search), 6.1 (PWA), 6.2 (geolocation), 6.3 (camera), 6.6 (settings screen), 7.2 (GitHub sync), 7.3 (codebase TODO sync)

**`priority:min`:** 7.1c (idle suspension)

**Post-competition:** Codebase TODO outbound writes, Linear sync, Calendar sync, full offline mode, comprehensive test suite
