import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({
  host: 'https://meilisearch.local.aquati.cat:3001',
  apiKey: process.env.MEILISEARCH_API_KEY || process.env.MEILI_MASTER_KEY || ''
});

const index = client.index('claudeCodeUserMessages');

/** Path to Claude configuration file */
const CLAUDE_CONFIG_PATH = join(homedir(), '.claude.json');

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
function readClaudeConfig() {
  try {
    const content = readFileSync(CLAUDE_CONFIG_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to read .claude.json:', error);
    process.exit(1);
  }
}

/** Extract messages from project history */
function extractMessages(config: any): IndexedMessage[] {
  const messages: IndexedMessage[] = [];
  const timestamp = new Date().toISOString();
  
  // Process each project
  for (const [projectPath, project] of Object.entries(config.projects || {})) {
    const history = (project as any).history || [];
    
    history.forEach((entry: any, historyIndex: number) => {
      if (entry.display) {
        // Generate unique ID - replace invalid characters with underscores
        const sanitizedPath = projectPath.replace(/[^a-zA-Z0-9_-]/g, '_');
        const messageId = `${sanitizedPath}_hist_${historyIndex}_${Date.now()}`;
        
        messages.push({
          messageId,
          content: entry.display,
          conversationId: projectPath,
          conversationTitle: projectPath.split('/').pop() || 'Unknown Project',
          timestamp,
          projectPath
        });
      }
    });
  }
  
  return messages;
}

/** Clear history from Claude configuration */
function clearHistory(config: any) {
  // Clear history for all projects
  for (const projectPath in config.projects || {}) {
    if (config.projects[projectPath].history) {
      config.projects[projectPath].history = [];
    }
  }
  return config;
}

/** Index messages to Meilisearch */
async function indexUserMessages() {
  console.log('Reading Claude configuration...');
  const config = readClaudeConfig();
  
  console.log('Extracting messages...');
  const messages = extractMessages(config);
  
  if (messages.length === 0) {
    console.log('No messages found to index.');
    return;
  }
  
  console.log(`Found ${messages.length} messages to index.`);
  
  // Index in batches
  const BATCH_SIZE = 100;
  let allTasksSuccessful = true;
  
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const task = await index.addDocuments(batch);
    console.log(`Indexed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(messages.length / BATCH_SIZE)}. Task: ${task.taskUid}`);
    
    // Wait for task to complete
    let taskStatus = await client.tasks.getTask(task.taskUid);
    while (taskStatus.status === 'enqueued' || taskStatus.status === 'processing') {
      await new Promise(resolve => setTimeout(resolve, 100));
      taskStatus = await client.tasks.getTask(task.taskUid);
    }
    
    if (taskStatus.status !== 'succeeded') {
      console.error(`Task ${task.taskUid} failed:`, taskStatus.error);
      allTasksSuccessful = false;
    }
  }
  
  if (allTasksSuccessful) {
    console.log('All indexing tasks completed successfully!');
    
    // Clear history from config
    const clearedConfig = clearHistory(config);
    
    // Write back the cleared config
    try {
      writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(clearedConfig, null, 2));
      console.log('✅ Cleared message history from ~/.claude.json for security');
    } catch (error) {
      console.error('⚠️  Failed to clear history from config:', error);
    }
  } else {
    console.error('❌ Some indexing tasks failed. History not cleared for safety.');
  }
  
  // Example search
  const searchResults = await index.search('meilisearch', {
    limit: 5,
    sort: ['timestamp:desc']
  });
  
  console.log('\nExample search for "meilisearch":');
  searchResults.hits.forEach(hit => {
    console.log(`- ${hit.content.substring(0, 100)}...`);
  });
}

// Run the indexing
await indexUserMessages();