import Anthropic from '@anthropic-ai/sdk';
import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { z } from 'zod/v4-mini';

const anthropic = new Anthropic({
  maxRetries: 0,
  logLevel: 'info',

  defaultHeaders: {
    'anthropic-beta': [
      'extended-cache-ttl-2025-04-11',
      'interleaved-thinking-2025-05-14',
      'files-api-2025-04-14',
      'search-results-2025-06-09',
      'code-execution-2025-05-22',
      'mcp-client-2025-04-04',
    ]
      .join(','),
  },
});

const stream = await anthropic
  .messages
  .create({
    stream: true,
    model: 'claude-sonnet-4-0',
    // Set to a low number during dev.
    max_tokens: 512,
    thinking: {
      type: 'enabled',
      budget_tokens: 32_000,
    },
    tool_choice: {
      type: 'auto',
    },
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
      },
      {
        // @ts-expect-error -- Actually exists
        'type': 'code_execution_20250522',
        'name': 'code_execution',
      },
    ],
    messages: [{ role: 'user', content: 'How to change background color in VS Code?' }],
    mcp_servers: [
      {
        type: 'url',
        url: 'https://learn.microsoft.com/api/mcp',
        name: 'MicrosoftDocs',
      },
    ],
  });

for await (const messageStreamEvent of stream) {
  console.log(messageStreamEvent);
}

const DEFAULT_PORT = 4111;
const PORT = z.coerce.number().parse(process.env.AI_TREE_PORT ?? DEFAULT_PORT);

const app = new Elysia()
  .use(swagger())
  .get('/', () => 'Hello Elysia')
  .listen(PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
