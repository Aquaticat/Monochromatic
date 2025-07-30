import { wait, } from '@monochromatic-dev/module-es';
import { MeiliSearch, } from 'meilisearch';
import {
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir, } from 'node:os';
import { join, } from 'node:path';
import { match, } from 'ts-pattern';

const client = new MeiliSearch({
  host: 'https://meilisearch.local.aquati.cat:3001',
  apiKey: process.env.MEILISEARCH_API_KEY || process.env.MEILI_MASTER_KEY || '',
},);

const index = client.index('claudeCodeUserMessages',);

/** Path to Claude configuration file */
const CLAUDE_CONFIG_PATH = join(homedir(), '.claude.json',);

/** Polling interval for Meilisearch task status in milliseconds */
const TASK_POLL_INTERVAL_MS = 100;

/** Maximum content preview length for search results */
const CONTENT_PREVIEW_LENGTH = 100;

/** Message structure for indexing */
type IndexedMessage = {
  messageId: string;
  content: string;
  conversationId: string;
  conversationTitle: string;
  timestamp: string;
  projectPath?: string;
};

/** Read and parse Claude configuration */
function readClaudeConfig(): any {
  try {
    const content = readFileSync(CLAUDE_CONFIG_PATH, 'utf8',);
    return JSON.parse(content,);
  }
  catch (error) {
    throw new Error(
      `Failed to read .claude.json: ${
        error instanceof Error
          ? error.message
          : String(error,)
      }`,
    );
  }
}

/** Extract messages from project history */
function extractMessages(config: any,): IndexedMessage[] {
  const messages: IndexedMessage[] = [];
  const timestamp = new Date().toISOString();

  // Process each project
  for (const [projectPath, project,] of Object.entries(config.projects || {},)) {
    const history = (project as any).history || [];

    history.forEach((entry: any, historyIndex: number,) => {
      if (entry.display) {
        // Generate unique ID - replace invalid characters with underscores
        const sanitizedPath = projectPath.replaceAll(/[^a-zA-Z0-9_-]/g, '_',);
        const messageId = `${sanitizedPath}_hist_${historyIndex}_${Date.now()}`;

        messages.push({
          messageId,
          content: entry.display,
          conversationId: projectPath,
          conversationTitle: projectPath.split('/',).pop() || 'Unknown Project',
          timestamp,
          projectPath,
        },);
      }
    },);
  }

  return messages;
}

/** Clear history from Claude configuration */
function clearHistory(config: any,): any {
  // Clear history for all projects
  for (const projectPath in config.projects || {}) {
    if (config.projects[projectPath].history)
      config.projects[projectPath].history = [];
  }
  return config;
}

/** Index messages to Meilisearch */
async function indexUserMessages(): Promise<void> {
  console.log('Reading Claude configuration...',);
  const config = readClaudeConfig();

  console.log('Extracting messages...',);
  const messages = extractMessages(config,);

  match(messages.length,)
    .with(0, () => {
      console.log('No messages found to index.',);
      return;
    },)
    .otherwise(() => {},);

  console.log(`Found ${messages.length} messages to index.`,);

  // Index in batches
  const BATCH_SIZE = 100;
  let allTasksSuccessful = true;

  // eslint-disable-next-line no-await-in-loop -- Batches must be processed sequentially
  for (let batchStart = 0; batchStart < messages.length; batchStart += BATCH_SIZE) {
    const batch = messages.slice(batchStart, batchStart + BATCH_SIZE,);
    // eslint-disable-next-line no-await-in-loop -- Tasks must be submitted one at a time
    const task = await index.addDocuments(batch,);
    console.log(
      `Indexed batch ${Math.floor(batchStart / BATCH_SIZE,) + 1}/${
        Math.ceil(messages.length / BATCH_SIZE,)
      }. Task: ${task.taskUid}`,
    );

    // Wait for task to complete
    // eslint-disable-next-line no-await-in-loop -- Need to wait for task completion
    let taskStatus = await client.tasks.getTask(task.taskUid,);
    while (taskStatus.status === 'enqueued' || taskStatus.status === 'processing') {
      // eslint-disable-next-line no-await-in-loop -- Polling for task status
      await wait(TASK_POLL_INTERVAL_MS,);
      // eslint-disable-next-line no-await-in-loop -- Checking task status
      taskStatus = await client.tasks.getTask(task.taskUid,);
    }

    match(taskStatus.status,)
      .with('succeeded', () => {},)
      .otherwise(() => {
        console.error(`Task ${task.taskUid} failed:`, taskStatus.error,);
        allTasksSuccessful = false;
      },);
  }

  match(allTasksSuccessful,)
    .with(true, () => {
      console.log('All indexing tasks completed successfully!',);

      // Clear history from config
      const clearedConfig = clearHistory(config,);

      // Write back the cleared config
      try {
        writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(clearedConfig, null, 2,),);
        console.log('✅ Cleared message history from ~/.claude.json for security',);
      }
      catch (error) {
        console.error('⚠️  Failed to clear history from config:', error,);
      }
    },)
    .with(false, () => {
      console.error('❌ Some indexing tasks failed. History not cleared for safety.',);
    },)
    .exhaustive();

  // Example search
  const searchResults = await index.search('meilisearch', {
    limit: 5,
    sort: ['timestamp:desc',],
  },);

  console.log('\nExample search for "meilisearch":',);
  searchResults.hits.forEach(hit => {
    console.log(`- ${hit.content.slice(0, CONTENT_PREVIEW_LENGTH,)}...`,);
  },);
}

// Run the indexing
await indexUserMessages();
