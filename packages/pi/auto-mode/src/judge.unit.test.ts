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
import { toolChoiceForProvider, VERDICT_TOOL, } from "./judge-tool.ts";

await describe({
  name: "toolChoiceForProvider",
  children: [
    it({
      name: 'returns "required" for openai-completions',
      fn: async () => {
        expect(toolChoiceForProvider("openai-completions",)).toBe("required",);
      },
    },),

    it({
      name: 'returns "any" for anthropic-messages',
      fn: async () => {
        expect(toolChoiceForProvider("anthropic-messages",)).toBe("any",);
      },
    },),

    it({
      name: 'returns "any" for google-generative-ai',
      fn: async () => {
        expect(toolChoiceForProvider("google-generative-ai",)).toBe("any",);
      },
    },),

    it({
      name: 'returns "any" for google-vertex',
      fn: async () => {
        expect(toolChoiceForProvider("google-vertex",)).toBe("any",);
      },
    },),

    it({
      name: 'returns "any" for mistral-conversations',
      fn: async () => {
        expect(toolChoiceForProvider("mistral-conversations",)).toBe("any",);
      },
    },),

    it({
      name: 'returns "any" for bedrock-converse-stream',
      fn: async () => {
        expect(toolChoiceForProvider("bedrock-converse-stream",)).toBe("any",);
      },
    },),

    it({
      name: 'defaults to "any" for unknown providers',
      fn: async () => {
        expect(toolChoiceForProvider("custom-provider",)).toBe("any",);
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
