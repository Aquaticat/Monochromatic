import { Elysia } from 'elysia';
import { z } from 'zod/v4-mini';
import { swagger } from '@elysiajs/swagger'
import { openrouter } from '@openrouter/ai-sdk-provider';

const DEFAULT_AI_PROXY_PORT = 4111;
const AI_PROXY_PORT = z.coerce.number().parse(process.env.AI_PROXY_PORT ?? DEFAULT_AI_PROXY_PORT);

const app = new Elysia()
  .use(swagger())
  .get('/', () => 'Hello Elysia')
  .listen(AI_PROXY_PORT);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
