/**
 * Tests for the judge module.
 *
 * Covers toolChoice mapping and verdict extraction logic.
 */

import {
  describe,
  expect,
  it,
} from "@monochromatic-dev/module-test";
import { callJudge, } from "./judge.ts";
import {
  toolChoiceForApi,
  VERDICT_TOOL,
} from "./judge-tool.ts";

await describe({
  name: "toolChoiceForApi",
  children: [
    it({
      name: 'returns forced tool object for anthropic-messages',
      fn: async () => {
        const result = toolChoiceForApi("anthropic-messages");
        expect(result,).toEqual({
          type: "tool",
          name: "render_verdict",
        },);
      },
    },),

    it({
      name: 'returns "required" for openai-completions',
      fn: async () => {
        expect(toolChoiceForApi("openai-completions"),).toBe("required",);
      },
    },),

    it({
      name: 'returns "required" for openai-responses',
      fn: async () => {
        expect(toolChoiceForApi("openai-responses"),).toBe("required",);
      },
    },),

    it({
      name: 'returns "required" for azure-openai-responses',
      fn: async () => {
        expect(toolChoiceForApi("azure-openai-responses"),).toBe("required",);
      },
    },),

    it({
      name: 'returns "required" for openai-codex-responses',
      fn: async () => {
        expect(toolChoiceForApi("openai-codex-responses"),).toBe("required",);
      },
    },),

    it({
      name: 'returns "any" for google-generative-ai',
      fn: async () => {
        expect(toolChoiceForApi("google-generative-ai"),).toBe("any",);
      },
    },),

    it({
      name: 'returns "any" for google-vertex',
      fn: async () => {
        expect(toolChoiceForApi("google-vertex"),).toBe("any",);
      },
    },),

    it({
      name: 'returns "any" for mistral-conversations',
      fn: async () => {
        expect(toolChoiceForApi("mistral-conversations"),).toBe("any",);
      },
    },),

    it({
      name: 'returns "any" for bedrock-converse-stream',
      fn: async () => {
        expect(toolChoiceForApi("bedrock-converse-stream"),).toBe("any",);
      },
    },),

    it({
      name: 'defaults to "any" for unknown APIs',
      fn: async () => {
        expect(toolChoiceForApi("custom-api"),).toBe("any",);
      },
    },),
  ],
},);

await describe({
  name: "VERDICT_TOOL",
  children: [
    it({
      name: "has name render_verdict",
      fn: async () => {
        expect(VERDICT_TOOL.name,).toBe("render_verdict",);
      },
    },),

    it({
      name: "has description",
      fn: async () => {
        expect(VERDICT_TOOL.description.length,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: "has parameters schema",
      fn: async () => {
        expect(VERDICT_TOOL.parameters,).toBeDefined();
      },
    },),
  ],
},);
