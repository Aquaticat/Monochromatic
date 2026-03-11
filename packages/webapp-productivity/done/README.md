# Done

AI-powered task aggregator that surfaces what to do next based on location and focus context.

## How it runs

Done has no build step.
Running the server **is** the build: `bun src/server.ts` compiles CSS, bundles client scripts, and starts the HTTP server in a single process.
There is no `build` command to run first, no `dist/` to check in, and no way to separate compilation from serving.

This is a deliberate architectural choice, not a missing feature.
The build pipeline (build-css, `Bun.build()`) executes at startup every time, so the running server always reflects the current source.
In development, `mise run dev:site` uses `mise watch` to restart the process on any source change, which re-runs the full pipeline automatically.

```
bun src/server.ts    # production
mise run dev:site    # development (auto-restart on src/ change via mise watch)
```

The `--build-only` flag exists for CI type-checking; it runs the pipeline then exits without starting the server.

## Architecture overview

Single `Bun.serve()` process handling both page routes (HTML) and API routes (JSON).

1. **CSS** -- `@monochromatic-dev/build-css` resolves `@import` and expands `@mixin`/`@apply` into plain CSS
2. **Client JS** -- `Bun.build()` bundles one entry per page (inbox, in-progress, task-details, search, settings)
3. **Server** -- `Bun.serve()` with declarative `routes` for pages and REST API; fallback handler serves static assets from `dist/client/`
4. **Database** -- SQLite (@tursodatabase/database) with FTS5 full-text search, initialized via side-effect import at startup
5. **Client** -- Vanilla TypeScript with custom elements; reads server-embedded JSON from `<script id="page-data">`, builds DOM imperatively

## Monorepo dependencies

- `@monochromatic-dev/build-css` -- CSS mixin/apply expansion pipeline
- `@monochromatic-dev/module-es` -- Functional utilities

This package runs only within the Monochromatic monorepo.

## Decision: no ORM

Drizzle ORM was evaluated as the strongest TypeScript ORM candidate for this project.
It was rejected because the database layer relies heavily on SQLite-specific features that Drizzle cannot model natively:

- **FTS5 virtual tables** for full-text search
- **Triggers** that keep the FTS index in sync with the tasks table
- **`json_each()`** table-valued function for querying JSON arrays stored in columns
- **Partial indexes** (`WHERE due_date IS NOT NULL`, etc.)

Adopting Drizzle would mean writing some queries with the query builder and others as raw `sql` template escape hatches — two query styles in one codebase.
That is worse than consistently using raw `@tursodatabase/database` everywhere.

The current approach uses named SQL constants extracted to the top of each file, which keeps query text readable and scannable without introducing a second abstraction layer.

## Further reading

- `PLAN.md` -- Implementation plan with DB schema, AI prompts, and deployment details
- `SPEC.md` -- Product specification (task model, screens, sync targets)
- `FRAMEWORK_EVALUATION.md` -- Why vanilla TS + Bun over SvelteKit, Vue Vapor, or WC frameworks
