// deprecated: not using Claude Code anymore.

import { MeiliSearch, } from 'meilisearch';
import {
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { homedir, } from 'node:os';
import { join, } from 'node:path';
import {
  match,
  P,
} from 'ts-pattern';
import { notNullishOrThrow, } from './error.throw.ts';
import { pipedAsync, } from './function.pipe.ts';
import { wait, } from './promise.wait.ts';

/**
 * MeiliSearch Setup for Claude Code MCP Server Logs
 *
 * Index name: claudeCodeMcpServerLogs
 * Primary key: logId
 *
 * Index configuration:
 * - searchableAttributes: ['*'] - All fields are searchable
 * - filterableAttributes: Common fields like logId, server, timestamp, debug, etc.
 * - sortableAttributes: ['timestamp'] - Can sort by timestamp
 * - displayedAttributes: ['*'] - All fields are returned in search results
 *
 * Log structure:
 * - Metadata fields: logId, server, projectPath, timestamp, logFile, sessionId
 * - Content fields vary based on log type:
 *   - Tool call responses: debug field + all response fields spread at top level
 *   - Plain text logs: plainText
 *   - Other fields are hoisted from the original log entry
 * - All nested JSON fields are parsed and hoisted to top level
 */
const client = new MeiliSearch({
  host: 'https://meilisearch.local.aquati.cat:3001',
  apiKey: process.env.MEILISEARCH_API_KEY || process.env.MEILI_MASTER_KEY || '',
},);

const index = client.index('claudeCodeMcpServerLogs',);

/** Path to Claude cache directory */
const CLAUDE_CACHE_PATH = join(homedir(), '.cache/claude-cli-nodejs',);

/** Log entry structure for indexing */
type IndexedLog = {
  logId: string;
  server: string;
  projectPath: string;
  timestamp: string;
  logFile: string;
  sessionId?: string;
  debug?: string;
  response?: any;
  [key: string]: any; // Allow additional fields from log entries
};

/** Extract server name from directory name */
function extractServerName(dirName: string,): string {
  // mcp-logs-context7 -> context7
  // mcp-logs-microsoft.docs -> microsoft_docs
  return dirName.replace('mcp-logs-', '',).replaceAll(String.raw`\.`, '_',);
}

/** Track files to delete after successful indexing */
const filesToDelete: string[] = [];

/** Maximum time to wait for a Meilisearch task to complete */
const TASK_TIMEOUT_MS = 10_000; // 10 seconds

/** Interval between task status polls */
const TASK_POLL_INTERVAL_MS = 10; // 10ms

/** Check if a task is still pending */
function isTaskPending(status: string,): boolean {
  return match(status,)
    .with('enqueued', 'processing', () => true,)
    .otherwise(() => false);
}

/** Wait for a Meilisearch task to complete */
async function waitForTask(taskUid: number,
  startTime: number = Date.now(),): Promise<any>
{
  const taskStatus = await client.tasks.getTask(taskUid,);

  if (!isTaskPending(taskStatus.status,))
    return taskStatus;

  if (Date.now() - startTime > TASK_TIMEOUT_MS)
    throw new Error(`Task ${taskUid} timed out after ${TASK_TIMEOUT_MS}ms`,);

  await wait(TASK_POLL_INTERVAL_MS,);
  return waitForTask(taskUid, startTime,);
}

/** Limit all string fields in an object to 20,000 characters */
function limitStringFields(obj: any, maxLength: number = 20_000,): any {
  return match(obj,)
    .when(
      (o,): o is string => typeof o === 'string',
      str => str.length > maxLength ? str.slice(0, maxLength - 3,) + '...' : str,
    )
    .when(Array.isArray, arr => arr.map(item => limitStringFields(item, maxLength,)),)
    .when(
      (o,): o is object => o !== null && typeof o === 'object',
      o => {
        const limited: any = {};
        Object.entries(o,).forEach(([key, value,],) => {
          limited[key] = limitStringFields(value, maxLength,);
        },);
        return limited;
      },
    )
    .otherwise(o => o);
}

/** Parse log file and extract entries */
function parseLogFile(filePath: string, server: string,
  projectPath: string,): IndexedLog[]
{
  const logs: IndexedLog[] = [];

  try {
    const content = readFileSync(filePath, 'utf8',);
    const fileName = filePath.split('/',).pop() || '';

    // Track this file for deletion
    filesToDelete.push(filePath,);

    // Extract timestamp from filename (for example: 2025-06-18T20-40-33-318Z.txt)
    const timestampMatch = fileName.match(
      /(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/,
    );
    const fileTimestamp = timestampMatch && timestampMatch[1]
      ? timestampMatch[1].replaceAll('-', ':',).replace('T', 'T',).replace(
        /(\d{2}):(\d{2}):(\d{2}):(\d{3})Z/,
        '$1:$2:$3.$4Z',
      )
      : new Date().toISOString();

    try {
      // Try to parse as JSON array
      const jsonEntries = JSON.parse(content,);

      if (Array.isArray(jsonEntries,)) {
        for (const entry of jsonEntries) {
          const sanitizedPath = projectPath.replaceAll(/[^a-zA-Z0-9_-]/g, '_',).slice(0,
            400,);
          const logId = `${sanitizedPath}_${server}_${Date.now()}_${
            Math.random().toString(36,).slice(2, 11,)
          }`;

          // Create a clean copy of the entry without duplicated fields
          const cleanEntry = { ...entry, };

          // Remove fields that are stored separately in the index
          delete cleanEntry.timestamp;
          delete cleanEntry.sessionId;
          delete cleanEntry.cwd;
          if ('projectPath' in cleanEntry)
            delete cleanEntry.projectPath; // projectPath and cwd are duplicates

          // Create base log entry
          const logEntry: IndexedLog = {
            logId,
            server,
            projectPath,
            timestamp: entry.timestamp || fileTimestamp,
            logFile: fileName,
            sessionId: entry.sessionId,
          };

          // Try to clean up nested JSON in debug field
          if (cleanEntry.debug && cleanEntry.debug.includes('Tool call succeeded:',)) {
            try {
              // Extract the "Tool call succeeded: " prefix
              const prefix = 'Tool call succeeded: ';
              const jsonStart = cleanEntry.debug.indexOf(prefix,) + prefix.length;
              const jsonContent = cleanEntry.debug.slice(jsonStart,);

              // Parse the response
              let response = JSON.parse(jsonContent,);

              // Parse nested JSON level by level (up to 16 levels)
              function parseNestedJSON(obj: any, level: number = 1,
                path: string = 'root',): any
              {
                if (level > 16) {
                  console.log(`[Level ${level}] Max depth reached at ${path}`,);
                  return obj;
                }

                if (typeof obj === 'string') {
                  // Log what we're trying to parse
                  if (path.includes('text',) || path.includes('content',)) {
                    console.log(
                      `[Level ${level}] String at ${path} starts with: "${
                        obj.slice(0, 50,)
                      }..."`,
                    );
                  }

                  // Look for JSON with a prefix (like "Documents:\n{" or "Search results for 'test':\n{")
                  const prefixJsonMatch = obj.match(
                    /^(.*?)(\n|\r\n|\r)(\{[\s\S]*\}|\[[\s\S]*\])$/,
                  );
                  if (prefixJsonMatch) {
                    console.log(
                      `[Level ${level}] Found JSON with newline separator at ${path}`,
                    );
                    try {
                      const prefix = prefixJsonMatch[1];
                      const jsonPart = notNullishOrThrow(prefixJsonMatch[3],);
                      console.log(
                        `[Level ${level}] Prefix: "${prefix}", attempting to parse JSON...`,
                      );
                      const parsed = JSON.parse(jsonPart,);
                      console.log(
                        `[Level ${level}] Successfully parsed JSON with prefix`,
                      );
                      if (prefix && prefix.trim()) {
                        return {
                          message: prefix.trim(),
                          data: parseNestedJSON(parsed, level + 1, `${path}.data`,),
                        };
                      }
                      return parseNestedJSON(parsed, level + 1, path,);
                    }
                    catch (error) {
                      console.log(
                        `[Level ${level}] Failed to parse JSON with newline: ${
                          error instanceof Error ? error.message : String(error,)
                        }`,
                      );
                    }
                  }

                  // Check if entire string is JSON
                  const trimmed = obj.trim();
                  if (
                    (trimmed.startsWith('{',) && trimmed.endsWith('}',))
                    || (trimmed.startsWith('[',) && trimmed.endsWith(']',))
                  ) {
                    try {
                      const parsed = JSON.parse(obj,);
                      console.log(
                        `[Level ${level}] Successfully parsed complete JSON at ${path}`,
                      );
                      return parseNestedJSON(parsed, level + 1, path,);
                    }
                    catch (error) {
                      console.log(
                        `[Level ${level}] Failed to parse as complete JSON at ${path}: ${
                          error instanceof Error ? error.message : String(error,)
                        }`,
                      );
                    }
                  }

                  // Look for embedded JSON without newline
                  const embeddedMatch = obj.match(/^(.*?)(\{[\s\S]*\}|\[[\s\S]*\])$/,);
                  if (embeddedMatch) {
                    console.log(`[Level ${level}] Found embedded JSON at ${path}`,);
                    try {
                      const prefix = embeddedMatch[1];
                      const jsonPart = notNullishOrThrow(embeddedMatch[2],);
                      const parsed = JSON.parse(jsonPart,);
                      console.log(`[Level ${level}] Successfully parsed embedded JSON`,);
                      if (prefix && prefix.trim()) {
                        return {
                          message: prefix.trim(),
                          data: parseNestedJSON(parsed, level + 1, `${path}.data`,),
                        };
                      }
                      return parseNestedJSON(parsed, level + 1, path,);
                    }
                    catch (e2) {
                      console.log(
                        `[Level ${level}] Failed to parse embedded JSON: ${
                          e2 instanceof Error ? e2.message : String(e2,)
                        }`,
                      );
                    }
                  }

                  // No JSON found, return as-is
                  console.log(
                    `[Level ${level}] No JSON pattern found at ${path}, keeping as string`,
                  );
                  return obj;
                }
                if (Array.isArray(obj,)) {
                  console.log(
                    `[Level ${level}] Processing array at ${path} with ${obj.length} items`,
                  );
                  return obj.map((item, i,) =>
                    parseNestedJSON(item, level + 1, `${path}[${i}]`,)
                  );
                }
                if (obj && typeof obj === 'object') {
                  console.log(
                    `[Level ${level}] Processing object at ${path} with keys: ${
                      Object
                        .keys(obj,)
                        .join(', ',)
                    }`,
                  );
                  const result: any = {};
                  Object.entries(obj,).forEach(([key, value,],) => {
                    result[key] = parseNestedJSON(value, level + 1, `${path}.${key}`,);
                  },);
                  return result;
                }
                return obj;
              }

              // Parse all nested JSON
              console.log(
                'Starting nested JSON parsing for Tool call succeeded entry...',
              );
              response = parseNestedJSON(response,);

              // Store parsed fields directly on log entry
              logEntry.debug = prefix.trim();

              // If response is an object, spread its properties directly onto logEntry
              if (response && typeof response === 'object' && !Array.isArray(response,))
                Object.assign(logEntry, response,);
              else
                logEntry.response = response;
            }
            catch (error) {
              console.error('Failed to parse Tool call succeeded JSON:', error,);
              // If parsing fails, store all fields from cleanEntry
              Object.assign(logEntry, cleanEntry,);
            }
          }
          else {
            // For non-tool-call entries, store all fields from cleanEntry
            Object.assign(logEntry, cleanEntry,);
          }

          logs.push(logEntry,);
        }
      }
    }
    catch (parseError) {
      // Expected error: file content isn't valid JSON (plain text log)
      // But could also be: corrupted JSON, encoding issues, etc.
      console.log(`File ${fileName} is not JSON array, treating as plain text`,
        parseError,);
      // Not JSON, treat as plain text and create single entry
      const sanitizedPath = projectPath.replaceAll(/[^a-zA-Z0-9_-]/g, '_',).slice(0,
        400,);
      const logId = `${sanitizedPath}_${server}_${Date.now()}_${
        Math.random().toString(36,).slice(2, 11,)
      }`;

      // Limit content to 20,000 characters
      let limitedContent = content.trim();
      if (limitedContent.length > 20_000)
        limitedContent = limitedContent.slice(0, 19_997,) + '...';

      logs.push({
        logId,
        server,
        projectPath,
        timestamp: fileTimestamp,
        logFile: fileName,
        plainText: limitedContent,
      },);
    }
  }
  catch (error) {
    console.error(`Failed to parse log file ${filePath}:`, error,);
  }

  return logs;
}

/** Scan cache directory for MCP logs */
function scanForMcpLogs(): IndexedLog[] {
  const allLogs: IndexedLog[] = [];

  try {
    // List project directories
    const projectDirs = readdirSync(CLAUDE_CACHE_PATH,);

    for (const projectDir of projectDirs) {
      const projectPath = join(CLAUDE_CACHE_PATH, projectDir,);
      const stat = statSync(projectPath,);

      if (stat.isDirectory()) {
        // Original project path from directory name
        const originalProjectPath = projectDir.replace(/^-/, '/',).replaceAll('-', '/',);

        // List MCP log directories
        const contents = readdirSync(projectPath,);
        const mcpLogDirs = contents.filter(dir => dir.startsWith('mcp-logs-',));

        for (const mcpLogDir of mcpLogDirs) {
          const logDirPath = join(projectPath, mcpLogDir,);
          const serverName = extractServerName(mcpLogDir,);

          try {
            const logFiles = readdirSync(logDirPath,);

            for (const logFile of logFiles) {
              if (logFile.endsWith('.txt',)) {
                const logFilePath = join(logDirPath, logFile,);
                const logs = parseLogFile(logFilePath, serverName, originalProjectPath,);
                allLogs.push(...logs,);
              }
            }
          }
          catch (error) {
            console.error(`Failed to read MCP log directory ${logDirPath}:`, error,);
          }
        }
      }
    }
  }
  catch (error) {
    console.error('Failed to scan Claude cache directory:', error,);
  }

  return allLogs;
}

/** Create index if it doesn't exist */
async function ensureIndex(): Promise<void> {
  try {
    await index.getStats();
  }
  catch (error) {
    // Expected error: index doesn't exist yet (404)
    // But could also be: network error, auth failure, etc.
    console.log('Index does not exist, creating claudeCodeMcpServerLogs index...',
      error,);
    await client.createIndex('claudeCodeMcpServerLogs', { primaryKey: 'logId', },);

    // Configure search settings
    await index.updateSettings({
      searchableAttributes: ['*',], // Search all fields
      filterableAttributes: [
        'logId',
        'server',
        'projectPath',
        'timestamp',
        'logFile',
        'sessionId',
        'debug',
        'content',
        'isError',
        'type',
        'text',
        'message',
        'data',
        'hits',
        'query',
        'processingTimeMs',
        'limit',
        'offset',
        'estimatedTotalHits',
        'results',
        'total',
        'plainText',
      ], // Common fields that can be filtered
      sortableAttributes: ['timestamp',],
      displayedAttributes: ['*',], // Show all attributes
    },);
  }
}

/** Index MCP server logs to Meilisearch */
async function indexMcpLogs(): Promise<void> {
  console.log('Ensuring index exists...',);
  await ensureIndex();

  console.log('Scanning for MCP server logs...',);
  const logs = scanForMcpLogs();

  if (logs.length === 0) {
    console.log('No MCP logs found to index.',);
    return;
  }

  console.log(`Found ${logs.length} log entries to index.`,);

  // Index in batches
  const BATCH_SIZE = 100;
  let allTasksSuccessful = true;

  for (let i = 0; i < logs.length; i += BATCH_SIZE) {
    const batch = logs.slice(i, i + BATCH_SIZE,);
    // Apply field limits to all documents in the batch before indexing
    const task = await pipedAsync(batch, limitStringFields, index.addDocuments,);
    console.log(
      `Indexed batch ${Math.floor(i / BATCH_SIZE,) + 1}/${
        Math.ceil(logs.length / BATCH_SIZE,)
      }. Task: ${task.taskUid}`,
    );

    // Wait for task to complete
    try {
      const taskStatus = await waitForTask(task.taskUid,);
      match(taskStatus.status,)
        .with('succeeded', () => {},)
        .otherwise(() => {
          console.error(`Task ${task.taskUid} failed:`, taskStatus.error,);
          allTasksSuccessful = false;
        },);
    }
    catch (error) {
      console.error(error,);
      allTasksSuccessful = false;
    }
  }

  match(allTasksSuccessful,)
    .with(true, () => {
      console.log('All indexing tasks completed successfully!',);

      // Delete all log files
      let deletedCount = 0;
      let failedDeletes = 0;

      for (const filePath of filesToDelete) {
        try {
          unlinkSync(filePath,);
          deletedCount++;
        }
        catch (error) {
          console.error(`Failed to delete ${filePath}:`, error,);
          failedDeletes++;
        }
      }

      console.log(`✅ Deleted ${deletedCount} log files for security`,);
      match(failedDeletes,)
        .with(0, () => {},)
        .otherwise(count => console.log(`⚠️  Failed to delete ${count} files`,));
    },)
    .with(false, () => {
      console.error('❌ Some indexing tasks failed. Log files not deleted for safety.',);
    },)
    .exhaustive();

  // Example search
  const searchResults = await index.search('tool call', {
    limit: 3,
    sort: ['timestamp:desc',],
  },);

  console.log('\nExample search for "tool call":',);
  searchResults.hits.forEach(hit => {
    const preview = hit.debug || hit.plainText || JSON.stringify(hit.response || {},);
    console.log(`- [${hit.server}] ${hit.logFile}: ${preview.slice(0, 100,)}...`,);
  },);
}

// Run the indexing
await indexMcpLogs();
