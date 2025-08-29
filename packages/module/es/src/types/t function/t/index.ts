export type $<Params extends unknown[] = unknown[], Return extends unknown = unknown,> = (
  ...params: Params
) => Return;

export * as async from './restriction async/index.ts';
