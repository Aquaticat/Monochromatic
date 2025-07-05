import { Agent } from '@mastra/core/agent';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { notNullishOrThrow } from '@monochromatic-dev/module-es';
const openrouter = createOpenRouter({
  apiKey: notNullishOrThrow( process.env.OPENROUTER_API_KEY,)
});

export const assistant: Agent = new Agent({
  model: openrouter('anthropic/claude-4-sonnet'),
  name: 'Assistant',
  instructions: 'You are a helpful assistant with expertise in technology and science.',
});
