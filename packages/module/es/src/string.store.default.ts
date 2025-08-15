import { pathJoin, } from '@monochromatic-dev/module-es/fs.pathJoin.ts';
import {
  consoleLogger,
  type Logger,
} from './string.log.ts';
import * as shared from './string.store.shared.ts';

//region Minimal browser types -- Replace unsafe any with narrow structural types

type WebSessionStorage = {
  readonly length: number;
  getItem(key: string,): string | null;
  setItem(key: string, value: string,): void;
  removeItem(key: string,): void;
  key(index: number,): string | null;
};

type OpfsFileWritable = {
  write(data: string,): Promise<void>;
  close(): Promise<void>;
};

type OpfsFileHandle = {
  getFile(): Promise<{ text(): Promise<string>; }>;
  createWritable(): Promise<OpfsFileWritable>;
};

type OpfsDirectory = {
  getFileHandle(name: string, options?: { create?: boolean; },): Promise<OpfsFileHandle>;
  getDirectoryHandle(name: string,
    options?: { create?: boolean; },): Promise<OpfsDirectory>;
  removeEntry(name: string, options?: { recursive?: boolean; },): Promise<void>;
  entries?: () => AsyncIterable<[string, unknown,]>;
};

type NavigatorWithStorage = {
  storage?: {
    getDirectory(): Promise<OpfsDirectory>;
  };
};

//endregion Minimal browser types

export const localStorageStringStoreDefaultPriority: number =
  shared.persistentStringStoreDefaultPriority;

export const sessionStorageStringStoreDefaultPriority: number =
  shared.sessionStringStoreDefaultPriority;

export type WebStorageStringStoreArguments = shared.StringStoreArguments & {
  storage?: Storage;
};

/** Web Storage-backed storage, scoped by prefix. */
export class WebStorageStringStore implements shared.StringStore {
  public priority: number = 10;
  public readonly l: Logger = consoleLogger;
  private readonly id: string;

  private readonly storage: Storage = globalThis.localStorage;

  private constructor({ id, priority, l, storage }: WebStorageStringStoreArguments,) {
    this.id = id;
    priority && (this.priority = priority);
    l && (this.l = l);
    storage && (this.storage = storage);
  }

  public static create({id, priority, l, storage}): WebStorageStringStore {
    try {
      (storage ?? new WebStorageStringStore({id: ''}).storage)
    }
  }

  private k(key: string,): string {
    return `${this.id}/${key}`;
  }

  get(key: string,): string | undefined {
    this.l.trace(`get ${key}`,);
    try {
      const v = globalThis.sessionStorage.getItem(this.k(key,),);
      return v === null ? undefined : v;
    }
    catch (error) {
      this.l.error(`sessionStorage.get failed ${JSON.stringify(error,)}`,);
      return undefined;
    }
  }

  set(key: string, value: string,): this {
    this.l.trace(`sessionStorage.set ${key}`,);
    globalThis.sessionStorage.setItem(this.k(key,), value,);
    return this;
  }

  clear(): void {
    this.l.trace('sessionStorage.clear (scoped)',);
    const toDelete: string[] = [];
    for (let i = 0; i < globalThis.sessionStorage.length; i++) {
      const k = globalThis.sessionStorage.key(i,);
      if (k && k.startsWith(`${this.id}:`,))
        toDelete.push(k,);
    }
    toDelete.forEach(k => globalThis.sessionStorage.removeItem(k,));
  }

  delete(key: string,): boolean {
    this.l.trace(`sessionStorage.delete ${key}`,);
    const full = this.k(key,);
    const existed = globalThis.sessionStorage.getItem(full,) !== null;
    globalThis.sessionStorage.removeItem(full,);
    return existed;
  }
}

/** OPFS-backed storage (priority 2). */
export class OpfsStorage implements shared.StringStore {
  public priority: number = 20;
  public readonly l: Logger;
  private readonly dir: OpfsDirectory;

  constructor(args: { dir: OpfsDirectory; l?: Logger; priority?: number; },) {
    this.dir = args.dir;
    this.l = args.l ?? consoleLogger;
    if (args.priority)
      this.priority = args.priority;
  }

  async get(key: string,): Promise<string | undefined> {
    this.l.trace(`opfs.get ${key}`,);
    try {
      const fileHandle = await this.dir.getFileHandle(key, { create: false, },);
      const f = await fileHandle.getFile();
      return await f.text();
    }
    catch (_e) {
      return undefined;
    }
  }

  async set(key: string, value: string,): Promise<this> {
    this.l.trace(`opfs.set ${key}`,);
    const fileHandle = await this.dir.getFileHandle(key, { create: true, },);
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(value,);
    }
    finally {
      await writable.close();
    }
    return this;
  }

  async clear(): Promise<void> {
    this.l.trace('opfs.clear (scoped dir)',);
    const anyDir: { entries?: () => AsyncIterable<[string, unknown,]>; } = this.dir as {
      entries?: () => AsyncIterable<[string, unknown,]>;
    };
    if (typeof anyDir.entries !== 'function')
      return;
    for await (const [name,] of anyDir.entries!())
      await this.dir.removeEntry(name, { recursive: true, },);
  }

  async delete(key: string,): Promise<boolean> {
    this.l.trace(`opfs.delete ${key}`,);
    try {
      await this.dir.removeEntry(key,);
      return true;
    }
    catch (_e) {
      return false;
    }
  }
}

/**
 * Build default Browser storages (in ascending priority):
 * - Memory (0) - always present
 * - SessionStorage (1) - if available
 * - OPFS (2) - if available
 */
export async function buildDefaultStorages({
  storeId,
  l = consoleLogger,
}: {
  storeId: string;
  l?: Logger;
},): Promise<[shared.StringStore, ...shared.StringStore[],]> {
  const result: shared.StringStore[] = [];

  // Memory always available
  const memoryStorage = new shared.StringMemoryStore();
  memoryStorage.priority = 0;
  result.push(memoryStorage,);

  // sessionStorage probe
  let canSession = false;
  try {
    globalThis.sessionStorage.setItem('__probe__', '1',);
    globalThis.sessionStorage.removeItem('__probe__',);
    canSession = true;
  }
  catch (_e) {
    canSession = false;
  }
  if (canSession)
    result.push(new SessionStorageStringStore({ id: storeId, l, },),);

  // OPFS probe
  try {
    const nav = globalThis.navigator as unknown as NavigatorWithStorage;
    if (nav.storage?.getDirectory) {
      const root = await nav.storage.getDirectory();
      const dir = await root.getDirectoryHandle(storeId, { create: true, },);
      result.push(new OpfsStorage({ dir, l, priority: 20, },),);
    }
  }
  catch (_e) {
    // ignore and continue
  }

  // Ensure at least memory exists and coerce to non-empty tuple
  return [result[0], ...result.slice(1,),] as [shared.StringStore,
    ...shared.StringStore[],];
}
