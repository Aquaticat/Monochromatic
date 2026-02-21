/**
 * AI autofill API handler.
 *
 * POST /api/ai/autofill
 * Accepts `{ title: string }` and returns inferred metadata (tags, locations,
 * priority, complexity) using the configured chat completions endpoint.
 *
 * Degrades gracefully: when the AI is unavailable or returns garbage,
 * the response carries empty/null fields so the client can still function.
 *
 * Exceeds 100 lines: borderline at ~105 lines, but `parseAutofillResponse`,
 * `listAllLocations`, and `handleAutofill` share the same types and validation
 * constants -- splitting would add a module for fewer than 40 lines of code.
 */
import { chatCompletion } from "../../lib/ai/client.ts";
import { buildAutofillMessages } from "../../lib/ai/prompts.ts";
import db from "../../lib/db.ts";
import { listAllTags } from "../../lib/db/tasks.ts";
import { TASK_COMPLEXITIES, TASK_PRIORITIES } from "../../lib/types.ts";
import type { TaskComplexity, TaskPriority } from "../../lib/types.ts";

//region Types

type AutofillResult = {
  tags: string[];
  locations: string[];
  priority: TaskPriority | null;
  complexity: TaskComplexity | null;
};

type RawAutofillResponse = {
  tags?: unknown;
  locations?: unknown;
  priority?: unknown;
  complexity?: unknown;
};

//endregion Types

//region Validation

const VALID_PRIORITIES = new Set<string>(TASK_PRIORITIES);
const VALID_COMPLEXITIES = new Set<string>(TASK_COMPLEXITIES);

/** Best-effort extraction of an autofill result from possibly malformed AI output. */
function parseAutofillResponse(raw: string): AutofillResult {
  const empty: AutofillResult = { tags: [], locations: [], priority: null, complexity: null };

  try {
    const parsed = JSON.parse(raw) as RawAutofillResponse;
    if (typeof parsed !== "object" || parsed === null) {
      return empty;
    }

    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((tag): tag is string => typeof tag === "string")
      : [];

    const locations = Array.isArray(parsed.locations)
      ? parsed.locations.filter((location): location is string => typeof location === "string")
      : [];

    const priority =
      typeof parsed.priority === "string" && VALID_PRIORITIES.has(parsed.priority)
        ? (parsed.priority as TaskPriority)
        : null;

    const complexity =
      typeof parsed.complexity === "string" && VALID_COMPLEXITIES.has(parsed.complexity)
        ? (parsed.complexity as TaskComplexity)
        : null;

    return { tags, locations, priority, complexity };
  } catch {
    return empty;
  }
}

//endregion Validation

//region Existing metadata for consistency hints

/** Collects unique locations across all tasks via a full scan. */
function listAllLocations(): string[] {
  const rows = db
    .query("SELECT DISTINCT loc.value AS loc FROM tasks, json_each(tasks.locations) AS loc ORDER BY loc.value ASC")
    .all() as { loc: string }[];
  return rows.map((row) => row.loc);
}

//endregion Existing metadata

//region Handler

export async function handleAutofill(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";

    if (title.length === 0) {
      return new Response(
        JSON.stringify({ tags: [], locations: [], priority: null, complexity: null }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const existingTags = listAllTags();
    const existingLocations = listAllLocations();
    const messages = buildAutofillMessages(title, existingTags, existingLocations);

    const result = await chatCompletion({
      messages,
      temperature: 0,
      jsonMode: true,
      maxTokens: 256,
    });

    if (!result.ok) {
      console.error("AI autofill failed:", result.error);
      return new Response(
        JSON.stringify({ tags: [], locations: [], priority: null, complexity: null }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const autofill = parseAutofillResponse(result.content);
    return new Response(JSON.stringify(autofill), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("AI autofill handler error:", error);
    return new Response(
      JSON.stringify({ tags: [], locations: [], priority: null, complexity: null }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}

//endregion Handler
