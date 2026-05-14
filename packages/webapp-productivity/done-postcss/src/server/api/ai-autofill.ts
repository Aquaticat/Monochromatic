/**
 * AI autofill API handler.
 *
 * POST /api/ai/autofill
 * Accepts `\{ title: string \}` and returns inferred metadata (tags, locations,
 * priority, complexity) using the configured chat completions endpoint.
 *
 * Degrades gracefully: when the AI is unavailable or returns garbage,
 * the response carries empty/null fields so the client can still function.
 *
 * Exceeds 100 lines: borderline at ~105 lines, but `parseAutofillResponse`,
 * `listAllLocations`, and `handleAutofill` share the same types and validation
 * constants; splitting would add a module for fewer than 40 lines of code.
 */
import { chatCompletion, } from '../../lib/ai/client.ts';
import { buildAutofillMessages, } from '../../lib/ai/prompts.ts';
import db from '../../lib/db.ts';
import { listAllTags, } from '../../lib/db/tasks.ts';
import {
  TASK_COMPLEXITIES,
  TASK_PRIORITIES,
  type TaskComplexity,
  type TaskPriority,
} from '../../lib/types.ts';

//region Types

/** Result of AI-powered metadata inference for a task title. */
type AutofillResult = {
  /** Suggested tags. */
  tags: string[];
  /** Suggested locations. */
  locations: string[];
  /** Suggested priority level. */
  priority: TaskPriority | null;
  /** Suggested complexity level. */
  complexity: TaskComplexity | null;
};

/** Raw shape of the AI response before validation. */
type RawAutofillResponse = {
  /** Possibly-valid tags array. */
  tags?: unknown;
  /** Possibly-valid locations array. */
  locations?: unknown;
  /** Possibly-valid priority string. */
  priority?: unknown;
  /** Possibly-valid complexity string. */
  complexity?: unknown;
};

//endregion Types

//region Validation

/** Set of valid priority values for input validation. */
const VALID_PRIORITIES = new Set<string>(TASK_PRIORITIES,);

/** Set of valid complexity values for input validation. */
const VALID_COMPLEXITIES = new Set<string>(TASK_COMPLEXITIES,);

/** Maximum tokens for AI autofill response. */
const MAX_TOKENS = 256;

/**
 * Best-effort extraction of an autofill result from possibly malformed AI output.
 *
 * @param raw - Raw JSON string from the AI completion
 *
 * @returns Validated autofill result with safe defaults
 */
function parseAutofillResponse(raw: string,): AutofillResult {
  const empty: AutofillResult = {
    tags: [],
    locations: [],
    priority: null,
    complexity: null,
  };

  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse returns unknown; shape validated below
    const parsed = JSON.parse(raw,) as RawAutofillResponse;
    if (typeof parsed !== 'object')
      return empty;

    const tags = Array.isArray(parsed.tags,)
      ? parsed.tags.filter(function isString(tag,): tag is string {
        return typeof tag === 'string';
      },)
      : [];

    const locations = Array.isArray(parsed.locations,)
      ? parsed.locations.filter(function isString(location,): location is string {
        return typeof location === 'string';
      },)
      : [];

    const priority = typeof parsed
            .priority === 'string' && VALID_PRIORITIES.has(parsed.priority,)
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated by Set.has check
      ? (parsed.priority as TaskPriority)
      : null;

    const complexity = typeof parsed
            .complexity === 'string' && VALID_COMPLEXITIES.has(parsed.complexity,)
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- validated by Set.has check
      ? (parsed.complexity as TaskComplexity)
      : null;

    return {
      tags,
      locations,
      priority,
      complexity,
    };
  }
  catch {
    return empty;
  }
}

//endregion Validation

//region Existing metadata for consistency hints

/**
 * Collects unique locations across all tasks via a full scan.
 *
 * @returns Sorted array of unique location strings
 */
async function listAllLocations(): Promise<string[]> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- database query returns rows with loc column
  const rows = await db
    .prepare(
      'SELECT DISTINCT loc.value AS loc FROM tasks, json_each(tasks.locations) AS loc ORDER BY loc.value ASC',
    )
    .all() as { loc: string; }[];
  return rows.map(function extractLoc(row,) {
    return row.loc;
  },);
}

//endregion Existing metadata

//region Handler

/**
 * POST /api/ai/autofill; infers task metadata from a title using AI.
 *
 * @param req - Incoming request with JSON body containing `title`
 *
 * @returns JSON response with inferred tags, locations, priority, and complexity
 *
 * @example
 * ```ts
 * const response = await handleAutofill(event.req);
 * ```
 */
export async function handleAutofill(req: Request,): Promise<Response> {
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- request body is expected to be a JSON object
    const body = (await req.json()) as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';

    if (title.length === 0) {
      return Response.json({
        tags: [],
        locations: [],
        priority: null,
        complexity: null,
      },);
    }

    const existingTags = await listAllTags();
    const existingLocations = await listAllLocations();
    const messages = buildAutofillMessages(
      title,
      existingTags,
      existingLocations,
    );

    const result = await chatCompletion({
      messages,
      temperature: 0,
      jsonMode: true,
      maxTokens: MAX_TOKENS,
    },);

    if (!result.ok) {
      console.error(
        'AI autofill failed:',
        result.error,
      );
      return Response.json({
        tags: [],
        locations: [],
        priority: null,
        complexity: null,
      },);
    }

    const autofill = parseAutofillResponse(result.content,);
    return Response.json(autofill,);
  }
  catch (error) {
    console.error(
      'AI autofill handler error:',
      error,
    );
    return Response.json({
      tags: [],
      locations: [],
      priority: null,
      complexity: null,
    },);
  }
}

//endregion Handler
