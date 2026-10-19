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

/** Hot request every case below repeats. */
const LOCATION_REQUEST = 'getTypeAtLocation';

/** Configured one-file project served by a memoized native API, closed and removed on scope exit. */
type MemoizedProject = {
  readonly api: API;
  readonly configPath: string;
  readonly sourcePath: string;
  readonly sent: readonly string[];
  [Symbol.dispose]: () => void;
};

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
  if (((typeof client) !== 'object') || (client === null))
    throw new Error('Expected the API to expose its client.',);
  /** RPC channel the client sends through. */
  const channel: unknown = Reflect.get(client, 'channel',);
  if (((typeof channel) !== 'object') || (channel === null))
    throw new Error('Expected the API client to expose its channel.',);
  /** Original send, called with its receiver. */
  const send: unknown = Reflect.get(channel, 'requestSync',);
  if ((typeof send) !== 'function')
    throw new Error('Expected the channel to expose requestSync.',);
  Reflect.set(channel, 'requestSync', function recordedRequestSync(method: string, payload: string,): unknown {
    sent.push(method,);
    /** Answer the native server gave. */
    const answer: unknown = Reflect.apply(send, channel, [method, payload,],);
    return answer;
  },);
  return sent;
}

/**
 Starts a native API with the request memo installed over a configured one-file project on disk.

 @returns the project, with the API closed and the directory removed when the scope ends.
 */
function openMemoizedProject(): MemoizedProject {
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
  /** Native API whose client the memo wraps. */
  const api = new API({ cwd: path, },);
  memoizeApiSnapshotRequests({ api, },);
  return {
    api,
    configPath: join(path, 'tsconfig.json',),
    sourcePath: join(path, 'input.ts',),
    sent: recordServerRequests(api,),
    [Symbol.dispose]: function closeMemoizedProject(): void {
      api.close();
      rmSync(path, { recursive: true, force: true, },);
    },
  };
}

/**
 Counts the checker queries that reached the native server.

 @param sent - Method names sent to the native server.

 @returns how many were the repeated query.
 */
function locationQueryCount(sent: readonly string[],): number {
  return sent.filter(function isQuery(method,): boolean {
    return method === LOCATION_REQUEST;
  },).length;
}

await describe({
  name: memoizeApiSnapshotRequests.name,
  concurrency: 1,
  children: [
    it({
      name: 'sends a repeated checker query to the native server once',
      fn: async () => {
        using opened = openMemoizedProject();
        const snapshot = opened.api.updateSnapshot({ openProjects: [opened.configPath,], },);
        const project = snapshot.getProject(opened.configPath,);
        const sourceFile = project?.program.getSourceFile(opened.sourcePath,);
        if ((project === undefined) || (sourceFile === undefined))
          throw new Error('Expected the disposable project and its source.',);
        const node = findNodeAtOffset({
          sourceFile,
          offset: PROJECT_SOURCE.indexOf('value',),
        },);
        const first = project.checker.getTypeAtLocation(node,);
        const second = project.checker.getTypeAtLocation(node,);

        expect(locationQueryCount(opened.sent,),).toBe(1,);
        expect(second,).toBe(first,);
        if (first === undefined)
          throw new Error('Expected a type for the parameter.',);
        expect(project.checker.typeToString(first,),).toBe('number',);
      },
    },),
    it({
      name: 'sends the same checker query on a new snapshot to the native server again',
      fn: async () => {
        using opened = openMemoizedProject();
        const first = opened.api.updateSnapshot({ openProjects: [opened.configPath,], },);
        const firstProject = first.getProject(opened.configPath,);
        const firstFile = firstProject?.program.getSourceFile(opened.sourcePath,);
        if ((firstProject === undefined) || (firstFile === undefined))
          throw new Error('Expected the first snapshot to hold the source.',);
        firstProject.checker.getTypeAtLocation(findNodeAtOffset({
          sourceFile: firstFile,
          offset: PROJECT_SOURCE.indexOf('value',),
        },),);

        /** Same parameter, retyped, so the second snapshot differs from the first. */
        const changedSource = PROJECT_SOURCE.replace('number,): number', 'string,): string',);
        writeFileSync(opened.sourcePath, changedSource,);
        const second = opened.api.updateSnapshot({ fileChanges: { changed: [opened.sourcePath,], }, },);
        const secondProject = second.getProject(opened.configPath,);
        const secondFile = secondProject?.program.getSourceFile(opened.sourcePath,);
        if ((secondProject === undefined) || (secondFile === undefined))
          throw new Error('Expected the second snapshot to hold the source.',);
        const secondType = secondProject.checker.getTypeAtLocation(findNodeAtOffset({
          sourceFile: secondFile,
          offset: changedSource.indexOf('value',),
        },),);

        expect(second.id,).not.toBe(first.id,);
        expect(locationQueryCount(opened.sent,),).toBe(2,);
        if (secondType === undefined)
          throw new Error('Expected a type for the changed parameter.',);
        expect(secondProject.checker.typeToString(secondType,),).toBe('string',);
      },
    },),
    it({
      name: 'stops answering a released snapshot from memory',
      fn: async () => {
        using opened = openMemoizedProject();
        const snapshot = opened.api.updateSnapshot({ openProjects: [opened.configPath,], },);
        const project = snapshot.getProject(opened.configPath,);
        const sourceFile = project?.program.getSourceFile(opened.sourcePath,);
        if ((project === undefined) || (sourceFile === undefined))
          throw new Error('Expected the disposable project and its source.',);
        const node = findNodeAtOffset({
          sourceFile,
          offset: PROJECT_SOURCE.indexOf('value',),
        },);
        project.checker.getTypeAtLocation(node,);
        snapshot.dispose();

        // The native server no longer holds the snapshot, so only a stale memo could still answer.
        expect(() => project.checker.getTypeAtLocation(node,),).toThrow();
      },
    },),
  ],
},);
