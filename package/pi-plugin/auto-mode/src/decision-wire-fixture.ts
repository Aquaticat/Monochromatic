/**
 Independently authored wire fixtures preserve syntax boundaries and mixed question kinds.

 @module
 */

/**
 Literal data contains quotes, escapes, separators, and apparent source syntax.
 */
export const decisionFixtureText = 'read "../proof.txt"\n$' + '{value}; `code` \\ </data> /* literal */';

/**
 Original native input authored independently of the adapter.
 */
const originalRequest = {
    model: 'openai/gpt-6-luna-decisions',
    state: {
      fullPolicy: decisionFixtureText,
      originalRequestBody: JSON.stringify({ text: decisionFixtureText, },),
    },
    questions: {
      head_0: {
        type: 'choice',
        instructions: {
          predicate: 'Classify the exact selected clause.',
          selectedRule: { text: decisionFixtureText, },
        },
        criteria: {
          permission: 'Explicit permission for the complete operation.',
          none: null,
          unknown: 'Missing premises.',
        },
      },
      head_1: {
        type: 'noul',
        instructions: { predicate: 'Does the complete operation read a file?', },
        criteria: {
          true: 'Reads a file.',
          false: 'Does not read a file.',
        },
      },
    },
  } as const;

/**
 Actual Decisions response shape with confidence distinct from selected probability.
 */
const originalResponse = {
    model: 'openai/gpt-6-luna-decisions',
    answers: [
      {
        type: 'choice',
        name: 'head_0',
        choice: 'permission',
        confidence: 0.61,
        probabilities: [
          {
            value: 'permission',
            probability: 0.8,
          },
          {
            value: 'none',
            probability: 0.1,
          },
          {
            value: 'unknown',
            probability: 0.1,
          },
        ],
      },
      {
        type: 'predicate',
        name: 'head_1',
        probability: 0.9,
      },
    ],
    usage: {
      input_tokens: 123,
      output_tokens: 0,
      total_tokens: 123,
    },
  } as const;

/**
 Construct original native input independently of the adapter.

 @returns mixed predicate and categorical request

 @example
 ```ts
 const body = JSON.stringify(decisionFixtureRequest());
 ```
 */
export function decisionFixtureRequest(): typeof originalRequest {
  return originalRequest;
}

/**
 Construct an actual Decisions response shape with independent confidence.

 @returns provider response suitable for lossless conversion checks

 @example
 ```ts
 const raw = JSON.stringify(decisionFixtureResponse());
 ```
 */
export function decisionFixtureResponse(): typeof originalResponse {
  return originalResponse;
}
