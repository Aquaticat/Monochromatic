/**
 Independently authored consumer contracts for original native runner event delivery. @module
 */

/**
 Native calls retain argument identity throughout recorder and host callbacks.
 */
export type EventCall = {
  type: 'toolCall';
  id: string;
  name: string;
  arguments: object
};
/**
 Native completion content remains deliberately opaque until recorder text extraction.
 */
export type EventOutcome = {
  toolCall: EventCall;
  result: {
    content?: unknown;
    usage?: unknown
  };
  isError: boolean;
};
/**
 Consumer callback signatures come from the native dispatcher boundary.
 */
export type EventCallbacks = {
  onStart: (call: EventCall) => Promise<void>;
  onUpdate: (
    partial: unknown,
    call: EventCall
  ) => Promise<void>;
  onFinish: (outcome: EventOutcome) => Promise<void>;
};
/**
 Consumer input separates recording, event delivery, and result transport observations.
 */
export type EventInput = {
  runner: { host: { emit: (event: { type: string }) => unknown } };
  bound: {
    scope: { recorder: {
      start: (call: EventCall) => unknown;
      finish: (
        record: unknown,
        isError: boolean,
        text: string
      ) => unknown;
      addUsage: (usage: unknown) => unknown;
    } };
    ordinals: Map<string, number>;
    tickets: { resolve: (outcome: unknown) => unknown }[];
  };
  records: Map<string, unknown>;
  parentId: string;
};
/**
 Built helper must expose its native event factory.
 */
export type EventModule = { createProgramRunnerEvents: (input: EventInput) => EventCallbacks };
/**
 Fixture controls pause host delivery and preserve opaque failure values.
 */
export type EventControl = {
  failAt?: string;
  failure: unknown;
  waitAt?: string;
  barrier: PromiseWithResolvers<void>;
  onStep?: (point: string) => void;
  record: unknown;
};
/**
 Fixture exposes observations separately from original callback input ownership.
 */
export type EventFixture = {
  steps: string[];
  events: unknown[];
  recordings: unknown[][];
  resolutions: unknown[][];
  control: EventControl;
  calls: EventCall[];
  input: EventInput;
  callbacks: EventCallbacks;
};
