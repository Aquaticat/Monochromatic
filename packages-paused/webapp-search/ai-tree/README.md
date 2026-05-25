# webapp-search-ai-tree

AI-powered tree exploration web application using the Claude API.

## Stack

- **Server**: h3
- **AI**: Anthropic SDK with Claude Sonnet, extended thinking, web search,
  code execution, and remote MCP server integration
- **Validation**: Valibot for schema definitions

## Configuration

Set the `ANTHROPIC_API_KEY` environment variable. The server port defaults
to `4111` and is configurable via `AI_TREE_PORT`.

## Running

```sh
mise run //packages/webapp-search/ai-tree:build
bun packages/webapp-search/ai-tree/src/index.ts
```
