import {
  Mastra,
  type Metric,
} from '@mastra/core';

import type {
  Agent,
  ToolsInput,
} from '@mastra/core/agent';
import { assistant } from './agents/agent.ts';

export const mastra: Mastra = new Mastra({
  agents: { assistant },
});
