import { writeFileSync } from 'node:fs';

const content = `# Zero-Config Logger Implementation Plan

## Key Points

1. Runtime feature detection - no build-time platform splitting
2. Each sink verifies itself with verify() function
3. Verification writes test data to ensure backend works
4. Eager initialization at module load
5. Error on no backends available
6. Individual sink imports supported
7. Fire-and-forget async sinks

## Directory Structure

\`\`\`
packages/module/es/src/types/t object/t logger/
├── index.ts                           # Re-exports: type, from, sink
├── t/index.ts                         # Logger type ($), Level, LogRecord, Sink, Verify
├── f/index.ts                         # Re-exports: never
├── f/t never/index.ts                 # Re-exports: sync
├── f/t never/r s/index.ts             # Re-exports: positional
├── f/t never/r s/p p/index.ts         # Multi-sink logger (unified)
├── t sink/index.ts                    # Re-exports all sinks
├── t sink/t console/index.ts          # Re-exports: sync
├── t sink/t console/r s/index.ts      # Re-exports: positional
├── t sink/t console/r s/p p/index.ts  # Console sink (sync)
├── t sink/t opfs/index.ts             # Re-exports: positional
├── t sink/t opfs/p p/index.ts         # OPFS sink (async)
├── t sink/t sessionStorage/index.ts   # Re-exports: sync
├── t sink/t sessionStorage/r s/index.ts # Re-exports: positional
├── t sink/t sessionStorage/r s/p p/index.ts # SessionStorage sink (sync)
├── t sink/t file/index.ts             # Re-exports: positional
├── t sink/t file/p p/index.ts         # File sink (async, dynamic import)
├── t sink/t noop/index.ts             # Re-exports: sync
├── t sink/t noop/r s/index.ts         # Re-exports: positional
└── t sink/t noop/r s/p p/index.ts     # Noop sink (sync)
\`\`\`

## API Usage

\`\`\`typescript
import { types } from '@monochromatic-dev/module-es';

// Main logger - logs to all available backends
const l = types.object.logger.from.never.sync.positional.$;
l.info('Application started');
l.error('Something went wrong');

// Noop logger for testing/disabling
const noopL = types.object.logger.sink.noop.sync.positional.$;
\`\`\`

## Type Definitions (t/index.ts)

\`\`\`typescript
export type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogRecord = {
  level: Level;
  message: string;
  timestamp: number;
};

export type Sink = (record: LogRecord) => void | Promise<void>;

export type Verify = () => boolean | Promise<boolean>;

export type $ = {
  trace: (message: string) => void;
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  fatal: (message: string) => void;
};
\`\`\`

## Console Sink (t sink/t console/r s/p p/index.ts)

\`\`\`typescript
import type { LogRecord, Sink, Verify } from '../../../../t/index.ts';

let verified = false;
let available = true;

const LEVEL_TO_CONSOLE: Record<string, ((...args: unknown[]) => void) | undefined> = {
  trace: console.trace,
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
  fatal: console.error,
};

export const verify: Verify = (): boolean => {
  if (verified) return available;
  verified = true;
  
  try {
    if (typeof console === 'undefined') {
      available = false;
      return available;
    }
    
    const testFn = console.debug;
    if (typeof testFn !== 'function') {
      available = false;
      return available;
    }
    
    testFn('monochromatic: console sink verification');
    available = true;
  } catch {
    available = false;
  }
  
  return available;
};

export const $: Sink = (record: LogRecord): void => {
  if (!available) return;
  
  try {
    const consoleFn = LEVEL_TO_CONSOLE[record.level];
    if (typeof consoleFn === 'function') {
      consoleFn(\`[\${new Date(record.timestamp).toISOString()}] \${record.message}\`);
    }
  } catch {
    // Silently fail
  }
};
\`\`\`

## SessionStorage Sink (t sink/t sessionStorage/r s/p p/index.ts)

\`\`\`typescript
import type { LogRecord, Sink, Verify } from '../../../../t/index.ts';

const STORAGE_KEY_PREFIX = 'monochromatic.log';
let lineCounter = 0;
let verified = false;
let available = true;

export const verify: Verify = (): boolean => {
  if (verified) return available;
  verified = true;
  
  try {
    const testKey = '__monochromatic_verify__';
    const testValue = \`test-\${Date.now()}\`;
    globalThis.sessionStorage.setItem(testKey, testValue);
    const readBack = globalThis.sessionStorage.getItem(testKey);
    globalThis.sessionStorage.removeItem(testKey);
    available = readBack === testValue;
  } catch {
    available = false;
  }
  return available;
};

export const $: Sink = (record: LogRecord): void => {
  if (!available) return;
  
  try {
    const key = \`\${STORAGE_KEY_PREFIX}.\${lineCounter++}\`;
    globalThis.sessionStorage.setItem(key, JSON.stringify(record));
  } catch {
    // Silently fail
  }
};
\`\`\`

## OPFS Sink (t sink/t opfs/p p/index.ts)

\`\`\`typescript
import type { LogRecord, Sink, Verify } from '../../../t/index.ts';

let writable: FileSystemWritableFileStream | null = null;
let verified = false;
let available = false;

export const verify: Verify = async (): Promise<boolean> => {
  if (verified) return available;
  verified = true;
  
  try {
    const opfsRoot = await navigator.storage.getDirectory();
    const timestamp = new Date().toISOString().replaceAll(':', '-');
    const fileHandle = await opfsRoot.getFileHandle(
      \`monochromatic-\${timestamp}.log.jsonl\`,
      { create: true }
    );
    writable = await fileHandle.createWritable({ keepExistingData: true });
    
    const testData = \`{"test":true,"timestamp":\${Date.now()}}\\n\`;
    await writable.write(testData);
    
    const file = await fileHandle.getFile();
    const content = await file.text();
    available = content.includes('"test":true');
  } catch {
    available = false;
  }
  
  return available;
};

export const $: Sink = async (record: LogRecord): Promise<void> => {
  if (!available || !writable) return;
  
  try {
    await writable.write(JSON.stringify(record) + '\\n');
  } catch {
    // Silently fail
  }
};
\`\`\`

## File Sink (t sink/t file/p p/index.ts)

\`\`\`typescript
import type { LogRecord, Sink, Verify } from '../../../t/index.ts';

let filePath: string | null = null;
let verified = false;
let available = false;

export const verify: Verify = async (): Promise<boolean> => {
  if (verified) return available;
  verified = true;
  
  try {
    const { appendFile, mkdir, readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    
    const LOG_DIR = join('node_modules', '.monochromatic');
    await mkdir(LOG_DIR, { recursive: true });
    
    const timestamp = new Date().toISOString().replaceAll(':', '-');
    filePath = join(LOG_DIR, \`\${timestamp}.log.jsonl\`);
    
    const testData = \`{"test":true,"timestamp":\${Date.now()}}\\n\`;
    await appendFile(filePath, testData);
    const content = await readFile(filePath, 'utf-8');
    available = content.includes('"test":true');
  } catch {
    available = false;
  }
  
  return available;
};

export const $: Sink = async (record: LogRecord): Promise<void> => {
  if (!available || !filePath) return;
  
  try {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(filePath, JSON.stringify(record) + '\\n');
  } catch {
    // Silently fail
  }
};
\`\`\`

## Noop Sink (t sink/t noop/r s/p p/index.ts)

\`\`\`typescript
import type { LogRecord, Sink, Verify } from '../../../../t/index.ts';

export const verify: Verify = (): boolean => true;

export const $: Sink = (_record: LogRecord): void => {
  // Intentionally empty
};
\`\`\`

## Multi-Sink Logger (f/t never/r s/p p/index.ts)

\`\`\`typescript
import type { Level, LogRecord, Sink, Verify } from '../../../../t/index.ts';
import type { $ as Logger } from '../../../../t/index.ts';
import { $ as consoleSink, verify as verifyConsole } from '../../../../t sink/t console/r s/p p/index.ts';
import { $ as opfsSink, verify as verifyOpfs } from '../../../../t sink/t opfs/p p/index.ts';
import { $ as sessionStorageSink, verify as verifySessionStorage } from '../../../../t sink/t sessionStorage/r s/p p/index.ts';
import { $ as fileSink, verify as verifyFile } from '../../../../t sink/t file/p p/index.ts';

type SinkEntry = {
  sink: Sink;
  verify: Verify;
  available: boolean | null;
};

const sinkEntries: SinkEntry[] = [
  { sink: consoleSink, verify: verifyConsole, available: null },
  { sink: opfsSink, verify: verifyOpfs, available: null },
  { sink: sessionStorageSink, verify: verifySessionStorage, available: null },
  { sink: fileSink, verify: verifyFile, available: null },
];

let initialized = false;
let hasAvailableSink = false;

async function initialize(): Promise<void> {
  if (initialized) return;
  
  for (const entry of sinkEntries) {
    try {
      const result = entry.verify();
      entry.available = result instanceof Promise ? await result : result;
      if (entry.available) {
        hasAvailableSink = true;
      }
    } catch {
      entry.available = false;
    }
  }
  
  initialized = true;
  
  if (!hasAvailableSink) {
    throw new Error('No logging backends available');
  }
}

const initPromise = initialize();

function createMethod(level: Level): (message: string) => void {
  return (message: string): void => {
    if (!hasAvailableSink && initialized) {
      throw new Error('No logging backends available');
    }
    
    const record: LogRecord = {
      level,
      message,
      timestamp: Date.now(),
    };
    
    for (const entry of sinkEntries) {
      if (entry.available !== true) continue;
      
      try {
        const result = entry.sink(record);
        if (result instanceof Promise) {
          result.catch(() => {
            entry.available = false;
            hasAvailableSink = sinkEntries.some(e => e.available === true);
          });
        }
      } catch {
        entry.available = false;
        hasAvailableSink = sinkEntries.some(e => e.available === true);
      }
    }
    
    if (!hasAvailableSink) {
      throw new Error('All logging backends have failed');
    }
  };
}

export const $: Logger = {
  trace: createMethod('trace'),
  debug: createMethod('debug'),
  info: createMethod('info'),
  warn: createMethod('warn'),
  error: createMethod('error'),
  fatal: createMethod('fatal'),
};

export { initPromise };
\`\`\`

## Update t object/index.ts

Add this line:
\`\`\`typescript
export * as logger from './t logger/index.ts';
\`\`\`
`;

writeFileSync('plans/logger-implementation.md', content);
console.log('Plan written successfully');

const content = `# Zero-Config Logger Implementation Plan

## Key Points

1. Runtime feature detection - no build-time platform splitting
2. Each sink verifies itself with verify() function
3. Verification writes test data to ensure backend works
4. Eager initialization at module load
5. Error on no backends available
6. Individual sink imports supported
7. Fire-and-forget async sinks

## Directory Structure

\`\`\`
packages/module/es/src/types/t object/t logger/
├── index.ts                           # Re-exports: type, from, sink
├── t/index.ts                         # Logger type ($), Level, LogRecord, Sink, Verify
├── f/index.ts                         # Re-exports: never
├── f/t never/index.ts                 # Re-exports: sync
├── f/t never/r s/index.ts             # Re-exports: positional
├── f/t never/r s/p p/index.ts         # Multi-sink logger (unified)
├── t sink/index.ts                    # Re-exports all sinks
├── t sink/t console/index.ts          # Re-exports: sync
├── t sink/t console/r s/index.ts      # Re-exports: positional
├── t sink/t console/r s/p p/index.ts  # Console sink (sync)
├── t sink/t opfs/index.ts             # Re-exports: positional
├── t sink/t opfs/p p/index.ts         # OPFS sink (async)
├── t sink/t sessionStorage/index.ts   # Re-exports: sync
├── t sink/t sessionStorage/r s/index.ts # Re-exports: positional
├── t sink/t sessionStorage/r s/p p/index.ts # SessionStorage sink (sync)
├── t sink/t file/index.ts             # Re-exports: positional
├── t sink/t file/p p/index.ts         # File sink (async, dynamic import)
├── t sink/t noop/index.ts             # Re-exports: sync
├── t sink/t noop/r s/index.ts         # Re-exports: positional
└── t sink/t noop/r s/p p/index.ts     # Noop sink (sync)
\`\`\`

## API Usage

\`\`\`typescript
import { types } from '@monochromatic-dev/module-es';

// Main logger - logs to all available backends
const l = types.object.logger.from.never.sync.positional.$;
l.info('Application started');
l.error('Something went wrong');

// Noop logger for testing/disabling
const noopL = types.object.logger.sink.noop.sync.positional.$;
\`\`\`

## Type Definitions (t/index.ts)

\`\`\`typescript
export type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogRecord = {
  level: Level;
  message: string;
  timestamp: number;
};

export type Sink = (record: LogRecord) => void | Promise<void>;

export type Verify = () => boolean | Promise<boolean>;

export type $ = {
  trace: (message: string) => void;
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  fatal: (message: string) => void;
};
\`\`\`

## Console Sink (t sink/t console/r s/p p/index.ts)

\`\`\`typescript
import type { LogRecord, Sink, Verify } from '../../../../t/index.ts';

let verified = false;
let available = true;

const LEVEL_TO_CONSOLE: Record<string, ((...args: unknown[]) => void) | undefined> = {
  trace: console.trace,
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
  fatal: console.error,
};

export const verify: Verify = (): boolean => {
  if (verified) return available;
  verified = true;
  
  try {
    if (typeof console === 'undefined') {
      available = false;
      return available;
    }
    
    const testFn = console.debug;
    if (typeof testFn !== 'function') {
      available = false;
      return available;
    }
    
    testFn('monochromatic: console sink verification');
    available = true;
  } catch {
    available = false;
  }
  
  return available;
};

export const $: Sink = (record: LogRecord): void => {
  if (!available) return;
  
  try {
    const consoleFn = LEVEL_TO_CONSOLE[record.level];
    if (typeof consoleFn === 'function') {
      consoleFn(\`[\${new Date(record.timestamp).toISOString()}] \${record.message}\`);
    }
  } catch {
    // Silently fail
  }
};
\`\`\`

## SessionStorage Sink (t sink/t sessionStorage/r s/p p/index.ts)

\`\`\`typescript
import type { LogRecord, Sink, Verify } from '../../../../t/index.ts';

const STORAGE_KEY_PREFIX = 'monochromatic.log';
let lineCounter = 0;
let verified = false;
let available = true;

export const verify: Verify = (): boolean => {
  if (verified) return available;
  verified = true;
  
  try {
    const testKey = '__monochromatic_verify__';
    const testValue = \`test-\${Date.now()}\`;
    globalThis.sessionStorage.setItem(testKey, testValue);
    const readBack = globalThis.sessionStorage.getItem(testKey);
    globalThis.sessionStorage.removeItem(testKey);
    available = readBack === testValue;
  } catch {
    available = false;
  }
  return available;
};

export const $: Sink = (record: LogRecord): void => {
  if (!available) return;
  
  try {
    const key = \`\${STORAGE_KEY_PREFIX}.\${lineCounter++}\`;
    globalThis.sessionStorage.setItem(key, JSON.stringify(record));
  } catch {
    // Silently fail
  }
};
\`\`\`

## OPFS Sink (t sink/t opfs/p p/index.ts)

\`\`\`typescript
import type { LogRecord, Sink, Verify } from '../../../t/index.ts';

let writable: FileSystemWritableFileStream | null = null;
let verified = false;
let available = false;

export const verify: Verify = async (): Promise<boolean> => {
  if (verified) return available;
  verified = true;
  
  try {
    const opfsRoot = await navigator.storage.getDirectory();
    const timestamp = new Date().toISOString().replaceAll(':', '-');
    const fileHandle = await opfsRoot.getFileHandle(
      \`monochromatic-\${timestamp}.log.jsonl\`,
      { create: true }
    );
    writable = await fileHandle.createWritable({ keepExistingData: true });
    
    const testData = \`{"test":true,"timestamp":\${Date.now()}}\\n\`;
    await writable.write(testData);
    
    const file = await fileHandle.getFile();
    const content = await file.text();
    available = content.includes('"test":true');
  } catch {
    available = false;
  }
  
  return available;
};

export const $: Sink = async (record: LogRecord): Promise<void> => {
  if (!available || !writable) return;
  
  try {
    await writable.write(JSON.stringify(record) + '\\n');
  } catch {
    // Silently fail
  }
};
\`\`\`

## File Sink (t sink/t file/p p/index.ts)

\`\`\`typescript
import type { LogRecord, Sink, Verify } from '../../../t/index.ts';

let filePath: string | null = null;
let verified = false;
let available = false;

export const verify: Verify = async (): Promise<boolean> => {
  if (verified) return available;
  verified = true;
  
  try {
    const { appendFile, mkdir, readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    
    const LOG_DIR = join('node_modules', '.monochromatic');
    await mkdir(LOG_DIR, { recursive: true });
    
    const timestamp = new Date().toISOString().replaceAll(':', '-');
    filePath = join(LOG_DIR, \`\${timestamp}.log.jsonl\`);
    
    const testData = \`{"test":true,"timestamp":\${Date.now()}}\\n\`;
    await appendFile(filePath, testData);
    const content = await readFile(filePath, 'utf-8');
    available = content.includes('"test":true');
  } catch {
    available = false;
  }
  
  return available;
};

export const $: Sink = async (record: LogRecord): Promise<void> => {
  if (!available || !filePath) return;
  
  try {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(filePath, JSON.stringify(record) + '\\n');
  } catch {
    // Silently fail
  }
};
\`\`\`

## Noop Sink (t sink/t noop/r s/p p/index.ts)

\`\`\`typescript
import type { LogRecord, Sink, Verify } from '../../../../t/index.ts';

export const verify: Verify = (): boolean => true;

export const $: Sink = (_record: LogRecord): void => {
  // Intentionally empty
};
\`\`\`

## Multi-Sink Logger (f/t never/r s/p p/index.ts)

\`\`\`typescript
import type { Level, LogRecord, Sink, Verify } from '../../../../t/index.ts';
import type { $ as Logger } from '../../../../t/index.ts';
import { $ as consoleSink, verify as verifyConsole } from '../../../../t sink/t console/r s/p p/index.ts';
import { $ as opfsSink, verify as verifyOpfs } from '../../../../t sink/t opfs/p p/index.ts';
import { $ as sessionStorageSink, verify as verifySessionStorage } from '../../../../t sink/t sessionStorage/r s/p p/index.ts';
import { $ as fileSink, verify as verifyFile } from '../../../../t sink/t file/p p/index.ts';

type SinkEntry = {
  sink: Sink;
  verify: Verify;
  available: boolean | null;
};

const sinkEntries: SinkEntry[] = [
  { sink: consoleSink, verify: verifyConsole, available: null },
  { sink: opfsSink, verify: verifyOpfs, available: null },
  { sink: sessionStorageSink, verify: verifySessionStorage, available: null },
  { sink: fileSink, verify: verifyFile, available: null },
];

let initialized = false;
let hasAvailableSink = false;

async function initialize(): Promise<void> {
  if (initialized) return;
  
  for (const entry of sinkEntries) {
    try {
      const result = entry.verify();
      entry.available = result instanceof Promise ? await result : result;
      if (entry.available) {
        hasAvailableSink = true;
      }
    } catch {
      entry.available = false;
    }
  }
  
  initialized = true;
  
  if (!hasAvailableSink) {
    throw new Error('No logging backends available');
  }
}

const initPromise = initialize();

function createMethod(level: Level): (message: string) => void {
  return (message: string): void => {
    if (!hasAvailableSink && initialized) {
      throw new Error('No logging backends available');
    }
    
    const record: LogRecord = {
      level,
      message,
      timestamp: Date.now(),
    };
    
    for (const entry of sinkEntries) {
      if (entry.available !== true) continue;
      
      try {
        const result = entry.sink(record);
        if (result instanceof Promise) {
          result.catch(() => {
            entry.available = false;
            hasAvailableSink = sinkEntries.some(e => e.available === true);
          });
        }
      } catch {
        entry.available = false;
        hasAvailableSink = sinkEntries.some(e => e.available === true);
      }
    }
    
    if (!hasAvailableSink) {
      throw new Error('All logging backends have failed');
    }
  };
}

export const $: Logger = {
  trace: createMethod('trace'),
  debug: createMethod('debug'),
  info: createMethod('info'),
  warn: createMethod('warn'),
  error: createMethod('error'),
  fatal: createMethod('fatal'),
};

export { initPromise };
\`\`\`

## Update t object/index.ts

Add this line:
\`\`\`typescript
export * as logger from './t logger/index.ts';
\`\`\`
`;

writeFileSync('plans/logger-implementation.md', content);
console.log('Plan written successfully');

