import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { API, } from 'typescript/unstable/sync';

import {
  findNodeAtOffset,
  memoizeApiSnapshotRequests,
} from '../dist/final/node/index.mjs';

/** Source of the disposable project the native-server tests query. */
const PROJECT_SOURCE = 'export function twice(value: number,): number { return value * 2; }\n';

/** Disposable project directory removed on scope exit. */
type ProjectDirectory = {
  readonly path: string;
  [Symbol.dispose]: () => void;
};

/**
 Creates a configured one-file project on disk.

 @returns the directory, removed when the scope ends.
 */
function createProjectDirectory(): ProjectDirectory {
  /** Unique directory holding the project. */
  const path = mkdtempSync(join(tmpdir(), 'semantic-request-memo-',),);
  writeFileSync(
    join(path, 'tsconfig.json',),
    `${JSON.stringify({
      compilerOptions: { strict: true, },
      include: ['input.ts',],
    },)}\n`,
  );
  writeFileSync(join(path, 'input.ts',), PROJECT_SOURCE,);
  return {
    path,
    [Symbol.dispose]: function removeProjectDirectory(): void {
      rmSync(path, { recursive: true, force: true, },);
    },
  };
}

/**
 Records the method of every request the native server receives from an API.

 Wraps the pipe-level send that sits below the memo, so a memo hit never appears here.

 @param api - API whose channel is observed.

 @returns the live list of method names sent to the native server.
 */
function recordServerRequests(api: API,): readonly string[] {
  /** Method names in the order they were sent. */
  const sent: string[] = [];
  /** Sync client hidden behind the unstable API. */
  const client: unknown = Reflect.get(api, 'client',);
  /** RPC channel the client sends through. */
  const channel: unknown = (typeof client === 'object') && (client !== null)
    ? Reflect.get(client, 'channel',)
    : undefined;
  if ((typeof channel !== 'object') || (channel === null))
    throw new Error('Expected the API client to expose its channel.',);
  /** Original send, called with its receiver. */
  const send: unknown = Reflect.get(channel, 'requestSync',);
  if ((typeof send) !== 'function')
    throw new Error('Expected the channel to expose requestSync.',);
  Reflect.set(channel, 'requestSync', function recordedRequestSync(method: string, payload: string,): unknown {
    sent.push(method,);
    return Reflect.apply(send, channel, [method, payload,],);
  },);
  return sent;
}

/** Hot request every case below repeats. */
const LOCATION_REQUEST = 'getTypeAtLocation';

await describe({
  name: memoizeApiSnapshotRequests.name,
  concurrency: 1,
  children: [
    it({
      name: 'sends a repeated checker query to the native server once',
      fn: async () => {
        using directory = createProjectDirectory();
        const api = new API({ cwd: directory.path, },);
        try {
          memoizeApiSnapshotRequests({ api, },);
          const sent = recordServerRequests(api,);
          const configPath = join(directory.path, 'tsconfig.json',);
          const snapshot = api.updateSnapshot({ openProjects: [configPath,], },);
          const project = snapshot.getProject(configPath,);
          const sourceFile = project?.program.getSourceFile(join(directory.path, 'input.ts',),);
          if ((project === undefined) || (sourceFile === undefined))
            throw new Error('Expected the disposable project and its source.',);
          const node = findNodeAtOffset({ sourceFile, offset: PROJECT_SOURCE.indexOf('value',), },);
          const first = project.checker.getTypeAtLocation(node,);
          const second = project.checker.getTypeAtLocation(node,);

          expect(sent.filter(function isQuery(method,): boolean {
            return method === LOCATION_REQUEST;
          },).length,).toBe(1,);
          expect(second,).toBe(first,);
          if (first === undefined)
            throw new Error('Expected a type for the parameter.',);
          expect(project.checker.typeToString(first,),).toBe('number',);
        }
        finally {
          api.close();
        }
      },
    },),
    it({
      name: 'sends the same checker query on a new snapshot to the native server again',
      fn: async () => {
        using directory = createProjectDirectory();
        const api = new API({ cwd: directory.path, },);
        try {
          memoizeApiSnapshotRequests({ api, },);
          const sent = recordServerRequests(api,);
          const configPath = join(directory.path, 'tsconfig.json',);
          const sourcePath = join(directory.path, 'input.ts',);
          const first = api.updateSnapshot({ openProjects: [configPath,], },);
          const firstProject = first.getProject(configPath,);
          const firstFile = firstProject?.program.getSourceFile(sourcePath,);
          if ((firstProject === undefined) || (firstFile === undefined))
            throw new Error('Expected the first snapshot to hold the source.',);
          firstProject.checker.getTypeAtLocation(findNodeAtOffset({
            sourceFile: firstFile,
            offset: PROJECT_SOURCE.indexOf('value',),
          },),);

          const changedSource = PROJECT_SOURCE.replace('number,): number', 'string,): string',);
          writeFileSync(sourcePath, changedSource,);
          const second = api.updateSnapshot({ fileChanges: { changed: [sourcePath,], }, },);
          const secondProject = second.getProject(configPath,);
          const secondFile = secondProject?.program.getSourceFile(sourcePath,);
          if ((secondProject === undefined) || (secondFile === undefined))
            throw new Error('Expected the second snapshot to hold the source.',);
          const secondType = secondProject.checker.getTypeAtLocation(findNodeAtOffset({
            sourceFile: secondFile,
            offset: changedSource.indexOf('value',),
          },),);

          expect(second.id,).not.toBe(first.id,);
          expect(sent.filter(function isQuery(method,): boolean {
            return method === LOCATION_REQUEST;
          },).length,).toBe(2,);
          if (secondType === undefined)
            throw new Error('Expected a type for the changed parameter.',);
          expect(secondProject.checker.typeToString(secondType,),).toBe('string',);
        }
        finally {
          api.close();
        }
      },
    },),
    it({
      name: 'stops answering a released snapshot from memory',
      fn: async () => {
        using directory = createProjectDirectory();
        const api = new API({ cwd: directory.path, },);
        try {
          memoizeApiSnapshotRequests({ api, },);
          const configPath = join(directory.path, 'tsconfig.json',);
          const snapshot = api.updateSnapshot({ openProjects: [configPath,], },);
          const project = snapshot.getProject(configPath,);
          const sourceFile = project?.program.getSourceFile(join(directory.path, 'input.ts',),);
          if ((project === undefined) || (sourceFile === undefined))
            throw new Error('Expected the disposable project and its source.',);
          const node = findNodeAtOffset({ sourceFile, offset: PROJECT_SOURCE.indexOf('value',), },);
          project.checker.getTypeAtLocation(node,);
          snapshot.dispose();

          // The native server no longer holds the snapshot, so only a stale memo could still answer.
          expect(() => project.checker.getTypeAtLocation(node,),).toThrow();
        }
        finally {
          api.close();
        }
      },
    },),
  ],
},);
