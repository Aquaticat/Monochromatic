 # Zero-Config Logger Implementation Plan                                                                            │
   │                                                                                                                     │
   │ ## Overview                                                                                                         │
   │                                                                                                                     │
   │ Implement a zero-config logger in the `types` directory that logs to all available backends simultaneously:         │
   │ 1. Console                                                                                                          │
   │ 2. OPFS (Origin Private File System - browser)                                                                      │
   │ 3. SessionStorage (browser)                                                                                         │
   │ 4. File system (Node.js - `node_modules/.monochromatic/${timestamp}.log.jsonl`)                                     │
   │                                                                                                                     │
   │ The logger only errors when NO backends are available.                                                              │
   │                                                                                                                     │
   │ ## API Usage                                                                                                        │
   │                                                                                                                     │
   │ ```typescript                                                                                                       │
   │ import { types } from '@monochromatic-dev/module-es';                                                               │
   │                                                                                                                     │
   │ // Main logger - logs to all available backends                                                                     │
   │ const l = types.object.logger.from.never.sync.positional.$;                                                         │
   │ l.info('Application started');                                                                                      │
   │ l.error('Something went wrong');                                                                                    │
   │                                                                                                                     │
   │ // Noop logger for testing/disabling                                                                                │
   │ const noopL = types.object.logger.sink.noop.sync.positional.$;                                                      │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ## Directory Structure                                                                                              │
   │                                                                                                                     │
   │ ```                                                                                                                 │
   │ packages/module/es/src/types/t object/t logger/                                                                     │
   │ ├── index.ts                           # Re-exports: type, from, sink                                               │
   │ ├── t/                                 # Type definitions                                                           │
   │ │   └── index.ts                       # Logger type ($), Level, LogRecord, Sink, Verify                            │
   │ ├── f/                                 # from (factory)                                                             │
   │ │   ├── index.ts                       # Re-exports: never                                                          │
   │ │   └── t never/                       # No input required (zero-config)                                            │
   │ │       ├── index.ts                   # Re-exports: sync                                                           │
   │ │       └── r s/                       # restriction sync (API is sync, backends may be async)                      │
   │ │           ├── index.ts               # Re-exports: positional                                                     │
   │ │           └── p p/                   # params positional                                                          │
   │ │               ├── index.ts           # Multi-sink logger (unified, runtime detection)                             │
   │ │               └── index.unit.test.ts                                                                              │
   │ └── t sink/                            # Sink implementations                                                       │
   │     ├── index.ts                       # Re-exports: console, opfs, sessionStorage, file, noop                      │
   │     ├── t console/                                                                                                  │
   │     │   ├── index.ts                                                                                                │
   │     │   └── r s/                                                                                                    │
   │     │       └── p p/                                                                                                │
   │     │           └── index.ts           # Console sink (sync)                                                        │
   │     ├── t opfs/                                                                                                     │
   │     │   ├── index.ts                                                                                                │
   │     │   └── p p/                                                                                                    │
   │     │       └── index.ts               # OPFS sink (async, browser)                                                 │
   │     │       └── index.browser.test.ts                                                                               │
   │     ├── t sessionStorage/                                                                                           │
   │     │   ├── index.ts                                                                                                │
   │     │   └── r s/                                                                                                    │
   │     │       └── p p/                                                                                                │
   │     │           └── index.ts           # SessionStorage sink (sync, browser)                                        │
   │     │           └── index.browser.test.ts                                                                           │
   │     ├── t file/                                                                                                     │
   │     │   ├── index.ts                                                                                                │
   │     │   └── p p/                                                                                                    │
   │     │       └── index.ts               # File sink (async, dynamic import for node:fs)                              │
   │     │       └── index.unit.test.ts                                                                                  │
   │     └── t noop/                                                                                                     │
   │         ├── index.ts                                                                                                │
   │         └── r s/                                                                                                    │
   │             └── p p/                                                                                                │
   │                 └── index.ts           # Noop sink (sync)                                                           │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ## Type Definitions                                                                                                 │
   │                                                                                                                     │
   │ ### t object/t logger/t/index.ts                                                                                    │
   │                                                                                                                     │
   │ ```typescript                                                                                                       │
   │ /**                                                                                                                 │
   │  * Log severity levels ordered from least to most severe.                                                           │
   │  */                                                                                                                 │
   │ export type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';                                        │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * Structured log record written to sinks.                                                                          │
   │  */                                                                                                                 │
   │ export type LogRecord = {                                                                                           │
   │   level: Level;                                                                                                     │
   │   message: string;                                                                                                  │
   │   timestamp: number;                                                                                                │
   │ };                                                                                                                  │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * Sink function that receives log records.                                                                         │
   │  */                                                                                                                 │
   │ export type Sink = (record: LogRecord) => void | Promise<void>;                                                     │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * Verification function that checks if a sink backend is available.                                                │
   │  */                                                                                                                 │
   │ export type Verify = () => boolean | Promise<boolean>;                                                              │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * Logger interface with 6 log levels.                                                                              │
   │  */                                                                                                                 │
   │ export type $ = {                                                                                                   │
   │   trace: (message: string) => void;                                                                                 │
   │   debug: (message: string) => void;                                                                                 │
   │   info: (message: string) => void;                                                                                  │
   │   warn: (message: string) => void;                                                                                  │
   │   error: (message: string) => void;                                                                                 │
   │   fatal: (message: string) => void;                                                                                 │
   │ };                                                                                                                  │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ## Sink Implementations                                                                                             │
   │                                                                                                                     │
   │ ### Console Sink - t sink/t console/r s/p p/index.ts                                                                │
   │                                                                                                                     │
   │ ```typescript                                                                                                       │
   │ import type { LogRecord, Sink, Verify } from '../../../../t/index.ts';                                              │
   │                                                                                                                     │
   │ let verified = false;                                                                                               │
   │ let available = true;                                                                                               │
   │                                                                                                                     │
   │ const LEVEL_TO_CONSOLE: Record<string, ((...args: unknown[]) => void) | undefined> = {                              │
   │   trace: console.trace,                                                                                             │
   │   debug: console.debug,                                                                                             │
   │   info: console.info,                                                                                               │
   │   warn: console.warn,                                                                                               │
   │   error: console.error,                                                                                             │
   │   fatal: console.error,                                                                                             │
   │ };                                                                                                                  │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * Verifies console is available and methods don't throw.                                                           │
   │  */                                                                                                                 │
   │ export const verify: Verify = (): boolean => {                                                                      │
   │   if (verified) return available;                                                                                   │
   │   verified = true;                                                                                                  │
   │                                                                                                                     │
   │   try {                                                                                                             │
   │     if (typeof console === 'undefined') {                                                                           │
   │       available = false;                                                                                            │
   │       return available;                                                                                             │
   │     }                                                                                                               │
   │                                                                                                                     │
   │     const testFn = console.debug;                                                                                   │
   │     if (typeof testFn !== 'function') {                                                                             │
   │       available = false;                                                                                            │
   │       return available;                                                                                             │
   │     }                                                                                                               │
   │                                                                                                                     │
   │     // Actually call it to verify it doesn't throw                                                                  │
   │     testFn('monochromatic: console sink verification');                                                             │
   │     available = true;                                                                                               │
   │   } catch {                                                                                                         │
   │     available = false;                                                                                              │
   │   }                                                                                                                 │
   │                                                                                                                     │
   │   return available;                                                                                                 │
   │ };                                                                                                                  │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * Console sink that writes log records to console methods.                                                         │
   │  */                                                                                                                 │
   │ export const $: Sink = (record: LogRecord): void => {                                                               │
   │   if (!available) return;                                                                                           │
   │                                                                                                                     │
   │   try {                                                                                                             │
   │     const consoleFn = LEVEL_TO_CONSOLE[record.level];                                                               │
   │     if (typeof consoleFn === 'function') {                                                                          │
   │       consoleFn(`[${new Date(record.timestamp).toISOString()}] ${record.message}`);                                 │
   │     }                                                                                                               │
   │   } catch {                                                                                                         │
   │     // Silently fail if console throws                                                                              │
   │   }                                                                                                                 │
   │ };                                                                                                                  │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### SessionStorage Sink - t sink/t sessionStorage/r s/p p/index.ts                                                  │
   │                                                                                                                     │
   │ ```typescript                                                                                                       │
   │ import type { LogRecord, Sink, Verify } from '../../../../t/index.ts';                                              │
   │                                                                                                                     │
   │ const STORAGE_KEY_PREFIX = 'monochromatic.log';                                                                     │
   │ let lineCounter = 0;                                                                                                │
   │ let verified = false;                                                                                               │
   │ let available = true;                                                                                               │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * Verifies sessionStorage actually persists data.                                                                  │
   │  */                                                                                                                 │
   │ export const verify: Verify = (): boolean => {                                                                      │
   │   if (verified) return available;                                                                                   │
   │   verified = true;                                                                                                  │
   │                                                                                                                     │
   │   try {                                                                                                             │
   │     const testKey = '__monochromatic_verify__';                                                                     │
   │     const testValue = `test-${Date.now()}`;                                                                         │
   │     globalThis.sessionStorage.setItem(testKey, testValue);                                                          │
   │     const readBack = globalThis.sessionStorage.getItem(testKey);                                                    │
   │     globalThis.sessionStorage.removeItem(testKey);                                                                  │
   │     available = readBack === testValue;                                                                             │
   │   } catch {                                                                                                         │
   │     available = false;                                                                                              │
   │   }                                                                                                                 │
   │   return available;                                                                                                 │
   │ };                                                                                                                  │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * SessionStorage sink that writes log records to browser sessionStorage.                                           │
   │  */                                                                                                                 │
   │ export const $: Sink = (record: LogRecord): void => {                                                               │
   │   if (!available) return;                                                                                           │
   │                                                                                                                     │
   │   try {                                                                                                             │
   │     const key = `${STORAGE_KEY_PREFIX}.${lineCounter++}`;                                                           │
   │     globalThis.sessionStorage.setItem(key, JSON.stringify(record));                                                 │
   │   } catch {                                                                                                         │
   │     // Silently fail if storage is full or unavailable                                                              │
   │   }                                                                                                                 │
   │ };                                                                                                                  │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### OPFS Sink - t sink/t opfs/p p/index.ts                                                                          │
   │                                                                                                                     │
   │ ```typescript                                                                                                       │
   │ import type { LogRecord, Sink, Verify } from '../../../t/index.ts';                                                 │
   │                                                                                                                     │
   │ let writable: FileSystemWritableFileStream | null = null;                                                           │
   │ let verified = false;                                                                                               │
   │ let available = false;                                                                                              │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * Verifies OPFS is available and can write/read data.                                                              │
   │  */                                                                                                                 │
   │ export const verify: Verify = async (): Promise<boolean> => {                                                       │
   │   if (verified) return available;                                                                                   │
   │   verified = true;                                                                                                  │
   │                                                                                                                     │
   │   try {                                                                                                             │
   │     const opfsRoot = await navigator.storage.getDirectory();                                                        │
   │     const timestamp = new Date().toISOString().replaceAll(':', '-');                                                │
   │     const fileHandle = await opfsRoot.getFileHandle(                                                                │
   │       `monochromatic-${timestamp}.log.jsonl`,                                                                       │
   │       { create: true }                                                                                              │
   │     );                                                                                                              │
   │     writable = await fileHandle.createWritable({ keepExistingData: true });                                         │
   │                                                                                                                     │
   │     // Verify by writing and reading test data                                                                      │
   │     const testData = `{"test":true,"timestamp":${Date.now()}}\n`;                                                   │
   │     await writable.write(testData);                                                                                 │
   │                                                                                                                     │
   │     const file = await fileHandle.getFile();                                                                        │
   │     const content = await file.text();                                                                              │
   │     available = content.includes('"test":true');                                                                    │
   │   } catch {                                                                                                         │
   │     available = false;                                                                                              │
   │   }                                                                                                                 │
   │                                                                                                                     │
   │   return available;                                                                                                 │
   │ };                                                                                                                  │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * OPFS sink that writes log records to Origin Private File System.                                                 │
   │  */                                                                                                                 │
   │ export const $: Sink = async (record: LogRecord): Promise<void> => {                                                │
   │   if (!available || !writable) return;                                                                              │
   │                                                                                                                     │
   │   try {                                                                                                             │
   │     await writable.write(JSON.stringify(record) + '\n');                                                            │
   │   } catch {                                                                                                         │
   │     // Silently fail                                                                                                │
   │   }                                                                                                                 │
   │ };                                                                                                                  │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### File Sink - t sink/t file/p p/index.ts                                                                          │
   │                                                                                                                     │
   │ ```typescript                                                                                                       │
   │ import type { LogRecord, Sink, Verify } from '../../../t/index.ts';                                                 │
   │                                                                                                                     │
   │ let filePath: string | null = null;                                                                                 │
   │ let verified = false;                                                                                               │
   │ let available = false;                                                                                              │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * Verifies file system is available (Node.js) and can write/read data.                                             │
   │  */                                                                                                                 │
   │ export const verify: Verify = async (): Promise<boolean> => {                                                       │
   │   if (verified) return available;                                                                                   │
   │   verified = true;                                                                                                  │
   │                                                                                                                     │
   │   try {                                                                                                             │
   │     // Dynamic import for Node.js modules                                                                           │
   │     const { appendFile, mkdir, readFile } = await import('node:fs/promises');                                       │
   │     const { join } = await import('node:path');                                                                     │
   │                                                                                                                     │
   │     const LOG_DIR = join('node_modules', '.monochromatic');                                                         │
   │     await mkdir(LOG_DIR, { recursive: true });                                                                      │
   │                                                                                                                     │
   │     const timestamp = new Date().toISOString().replaceAll(':', '-');                                                │
   │     filePath = join(LOG_DIR, `${timestamp}.log.jsonl`);                                                             │
   │                                                                                                                     │
   │     // Verify by writing and reading test data                                                                      │
   │     const testData = `{"test":true,"timestamp":${Date.now()}}\n`;                                                   │
   │     await appendFile(filePath, testData);                                                                           │
   │     const content = await readFile(filePath, 'utf-8');                                                              │
   │     available = content.includes('"test":true');                                                                    │
   │   } catch {                                                                                                         │
   │     available = false;                                                                                              │
   │   }                                                                                                                 │
   │                                                                                                                     │
   │   return available;                                                                                                 │
   │ };                                                                                                                  │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * File sink that writes log records to node_modules/.monochromatic/.                                               │
   │  */                                                                                                                 │
   │ export const $: Sink = async (record: LogRecord): Promise<void> => {                                                │
   │   if (!available || !filePath) return;                                                                              │
   │                                                                                                                     │
   │   try {                                                                                                             │
   │     const { appendFile } = await import('node:fs/promises');                                                        │
   │     await appendFile(filePath, JSON.stringify(record) + '\n');                                                      │
   │   } catch {                                                                                                         │
   │     // Silently fail                                                                                                │
   │   }                                                                                                                 │
   │ };                                                                                                                  │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### Noop Sink - t sink/t noop/r s/p p/index.ts                                                                      │
   │                                                                                                                     │
   │ ```typescript                                                                                                       │
   │ import type { LogRecord, Sink, Verify } from '../../../../t/index.ts';                                              │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * Noop sink is always available.                                                                                   │
   │  */                                                                                                                 │
   │ export const verify: Verify = (): boolean => true;                                                                  │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * Noop sink that discards all log records.                                                                         │
   │  */                                                                                                                 │
   │ export const $: Sink = (_record: LogRecord): void => {                                                              │
   │   // Intentionally empty - discards all logs                                                                        │
   │ };                                                                                                                  │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ## Multi-Sink Logger - f/t never/r s/p p/index.ts                                                                   │
   │                                                                                                                     │
   │ ```typescript                                                                                                       │
   │ import type { Level, LogRecord, Sink, Verify } from '../../../../t/index.ts';                                       │
   │ import type { $ as Logger } from '../../../../t/index.ts';                                                          │
   │ import { $ as consoleSink, verify as verifyConsole } from '../../../../t sink/t console/r s/p p/index.ts';          │
   │ import { $ as opfsSink, verify as verifyOpfs } from '../../../../t sink/t opfs/p p/index.ts';                       │
   │ import { $ as sessionStorageSink, verify as verifySessionStorage } from '../../../../t sink/t sessionStorage/r s/p  │
   │ p/index.ts';                                                                                                        │
   │ import { $ as fileSink, verify as verifyFile } from '../../../../t sink/t file/p p/index.ts';                       │
   │                                                                                                                     │
   │ type SinkEntry = {                                                                                                  │
   │   sink: Sink;                                                                                                       │
   │   verify: Verify;                                                                                                   │
   │   available: boolean | null;                                                                                        │
   │ };                                                                                                                  │
   │                                                                                                                     │
   │ const sinkEntries: SinkEntry[] = [                                                                                  │
   │   { sink: consoleSink, verify: verifyConsole, available: null },                                                    │
   │   { sink: opfsSink, verify: verifyOpfs, available: null },                                                          │
   │   { sink: sessionStorageSink, verify: verifySessionStorage, available: null },                                      │
   │   { sink: fileSink, verify: verifyFile, available: null },                                                          │
   │ ];                                                                                                                  │
   │                                                                                                                     │
   │ let initialized = false;                                                                                            │
   │ let hasAvailableSink = false;                                                                                       │
   │                                                                                                                     │
   │ async function initialize(): Promise<void> {                                                                        │
   │   if (initialized) return;                                                                                          │
   │                                                                                                                     │
   │   for (const entry of sinkEntries) {                                                                                │
   │     try {                                                                                                           │
   │       const result = entry.verify();                                                                                │
   │       entry.available = result instanceof Promise ? await result : result;                                          │
   │       if (entry.available) {                                                                                        │
   │         hasAvailableSink = true;                                                                                    │
   │       }                                                                                                             │
   │     } catch {                                                                                                       │
   │       entry.available = false;                                                                                      │
   │     }                                                                                                               │
   │   }                                                                                                                 │
   │                                                                                                                     │
   │   initialized = true;                                                                                               │
   │                                                                                                                     │
   │   if (!hasAvailableSink) {                                                                                          │
   │     throw new Error('No logging backends available');                                                               │
   │   }                                                                                                                 │
   │ }                                                                                                                   │
   │                                                                                                                     │
   │ // Eager initialization - throws at module load if no backends available                                            │
   │ const initPromise = initialize();                                                                                   │
   │                                                                                                                     │
   │ function createMethod(level: Level): (message: string) => void {                                                    │
   │   return (message: string): void => {                                                                               │
   │     if (!hasAvailableSink && initialized) {                                                                         │
   │       throw new Error('No logging backends available');                                                             │
   │     }                                                                                                               │
   │                                                                                                                     │
   │     const record: LogRecord = {                                                                                     │
   │       level,                                                                                                        │
   │       message,                                                                                                      │
   │       timestamp: Date.now(),                                                                                        │
   │     };                                                                                                              │
   │                                                                                                                     │
   │     for (const entry of sinkEntries) {                                                                              │
   │       if (entry.available !== true) continue;                                                                       │
   │                                                                                                                     │
   │       try {                                                                                                         │
   │         const result = entry.sink(record);                                                                          │
   │         if (result instanceof Promise) {                                                                            │
   │           result.catch(() => {                                                                                      │
   │             entry.available = false;                                                                                │
   │             hasAvailableSink = sinkEntries.some(e => e.available === true);                                         │
   │           });                                                                                                       │
   │         }                                                                                                           │
   │       } catch {                                                                                                     │
   │         entry.available = false;                                                                                    │
   │         hasAvailableSink = sinkEntries.some(e => e.available === true);                                             │
   │       }                                                                                                             │
   │     }                                                                                                               │
   │                                                                                                                     │
   │     if (!hasAvailableSink) {                                                                                        │
   │       throw new Error('All logging backends have failed');                                                          │
   │     }                                                                                                               │
   │   };                                                                                                                │
   │ }                                                                                                                   │
   │                                                                                                                     │
   │ /**                                                                                                                 │
   │  * Multi-sink logger that writes to all available backends.                                                         │
   │  * Throws if no backends are available at initialization or if all fail.                                            │
   │  */                                                                                                                 │
   │ export const $: Logger = {                                                                                          │
   │   trace: createMethod('trace'),                                                                                     │
   │   debug: createMethod('debug'),                                                                                     │
   │   info: createMethod('info'),                                                                                       │
   │   warn: createMethod('warn'),                                                                                       │
   │   error: createMethod('error'),                                                                                     │
   │   fatal: createMethod('fatal'),                                                                                     │
   │ };                                                                                                                  │
   │                                                                                                                     │
   │ export { initPromise };                                                                                             │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ## Index Files                                                                                                      │
   │                                                                                                                     │
   │ ### t object/t logger/index.ts                                                                                      │
   │ ```typescript                                                                                                       │
   │ export * as type from './t/index.ts';                                                                               │
   │ export * as from from './f/index.ts';                                                                               │
   │ export * as sink from './t sink/index.ts';                                                                          │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### t object/t logger/f/index.ts                                                                                    │
   │ ```typescript                                                                                                       │
   │ export * as never from './t never/index.ts';                                                                        │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### t object/t logger/f/t never/index.ts                                                                            │
   │ ```typescript                                                                                                       │
   │ export * as sync from './r s/index.ts';                                                                             │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### t object/t logger/f/t never/r s/index.ts                                                                        │
   │ ```typescript                                                                                                       │
   │ export * as positional from './p p/index.ts';                                                                       │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### t object/t logger/t sink/index.ts                                                                               │
   │ ```typescript                                                                                                       │
   │ export * as console from './t console/index.ts';                                                                    │
   │ export * as opfs from './t opfs/index.ts';                                                                          │
   │ export * as sessionStorage from './t sessionStorage/index.ts';                                                      │
   │ export * as file from './t file/index.ts';                                                                          │
   │ export * as noop from './t noop/index.ts';                                                                          │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### t object/t logger/t sink/t console/index.ts                                                                     │
   │ ```typescript                                                                                                       │
   │ export * as sync from './r s/index.ts';                                                                             │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### t object/t logger/t sink/t console/r s/index.ts                                                                 │
   │ ```typescript                                                                                                       │
   │ export * as positional from './p p/index.ts';                                                                       │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### t object/t logger/t sink/t opfs/index.ts                                                                        │
   │ ```typescript                                                                                                       │
   │ export * as positional from './p p/index.ts';                                                                       │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### t object/t logger/t sink/t sessionStorage/index.ts                                                              │
   │ ```typescript                                                                                                       │
   │ export * as sync from './r s/index.ts';                                                                             │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### t object/t logger/t sink/t sessionStorage/r s/index.ts                                                          │
   │ ```typescript                                                                                                       │
   │ export * as positional from './p p/index.ts';                                                                       │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### t object/t logger/t sink/t file/index.ts                                                                        │
   │ ```typescript                                                                                                       │
   │ export * as positional from './p p/index.ts';                                                                       │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### t object/t logger/t sink/t noop/index.ts                                                                        │
   │ ```typescript                                                                                                       │
   │ export * as sync from './r s/index.ts';                                                                             │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ### t object/t logger/t sink/t noop/r s/index.ts                                                                    │
   │ ```typescript                                                                                                       │
   │ export * as positional from './p p/index.ts';                                                                       │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ## Update t object/index.ts                                                                                         │
   │                                                                                                                     │
   │ Add this line:                                                                                                      │
   │ ```typescript                                                                                                       │
   │ export * as logger from './t logger/index.ts';                                                                      │
   │ ```                                                                                                                 │
   │                                                                                                                     │
   │ ## Key Design Decisions                                                                                             │
   │                                                                                                                     │
   │ 1. **Runtime feature detection** - No build-time platform splitting. Works in Node.js, browsers, Bun, Deno, etc.    │
   │                                                                                                                     │
   │ 2. **Each sink verifies itself** - Each sink exports `verify()` that checks if the backend actually works (not just │
   │  exists).                                                                                                           │
   │                                                                                                                     │
   │ 3. **Verification writes test data** - Sinks verify by writing and reading back test data to ensure the backend     │
   │ isn't silently swallowing output.                                                                                   │
   │                                                                                                                     │
   │ 4. **Eager initialization** - The multi-sink logger verifies all backends at module load time.                      │
   │                                                                                                                     │
   │ 5. **Error on no backends** - Throws if no backends are available at init, or if all backends fail during logging.  │
   │                                                                                                                     │
   │ 6. **Individual sink imports** - Each sink is in its own file for individual imports.                               │
   │                                                                                                                     │
   │ 7. **Fire-and-forget async** - Async sinks use fire-and-forget pattern, marking themselves unavailable on failure.
