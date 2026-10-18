/**
 Original parser nodes and borrowed ownership define the call inspection boundary. @module
 */
import type { Node } from 'yuku-parser';

/**
 Source inspection borrows the original pattern owner and diagnostic constructor.
 */
export type ProfileCallInput = Readonly<{
  call?: Node;
  group: number;
  ordinal: number;
  bindingName?: string;
  allowed: ReadonlySet<string>;
  source: string;
  prefix: string;
  readPattern: (input: Readonly<{
    node: unknown;
    bindingName: ProfileCallInput['bindingName']
  }>) => object;
  ResultProgramProfileError: new (message: string) => Error;
}>;
