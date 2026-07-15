import Anthropic from '@anthropic-ai/sdk';
import {
  defineHandler,
  H3,
  serve,
} from 'h3';
import * as v from 'valibot';

/**
 * Pre-configured Anthropic client with extended beta features enabled.
 */
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
      .join(',',),
  },
},);

/**
 * Streaming message response from the Claude API with tool use.
 */
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
        type: 'code_execution_20250522',
        name: 'code_execution',
      },
    ],
    messages: [{
      role: 'user',
      content: 'How to change background color in VS Code?',
    },],
    // @ts-expect-error; mcp_servers not yet in SDK types
    mcp_servers: [
      {
        type: 'url',
        url: 'https://learn.microsoft.com/api/mcp',
        name: 'MicrosoftDocs',
      },
    ],
  },);

for await (const messageStreamEvent of stream)
  console.log(messageStreamEvent,);

/**
 * Default port when AI_TREE_PORT environment variable is not set.
 */
const DEFAULT_PORT = 4_111;
/**
 * Parsed server port from the AI_TREE_PORT environment variable.
 */
const PORT = v.parse(
  v.pipe(
    v.unknown(),
    v.transform(Number,),
    v.number(),
  ),
  process.env
    .AI_TREE_PORT
    ?? DEFAULT_PORT,
);

/**
 * H3 application instance for the ai-tree server.
 */
const app = new H3();

app.get(
  '/',
  defineHandler(function handleRoot(): string {
    return 'Hello h3';
  },),
);

/**
 * Running HTTP server instance.
 */
const server = serve(
  app,
  { port: PORT, },
);

console.log(
  `Server is running at ${server.url}`,
);
