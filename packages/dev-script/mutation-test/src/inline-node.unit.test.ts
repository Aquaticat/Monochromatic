import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  INLINE_NODE_SCRIPT,
  buildNodeCommand,
  quotePosixShellToken,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'inline node command',
  children: [
    it({
      name: 'quotes embedded single quotes as one POSIX shell token',
      fn: async () => {
        expect(quotePosixShellToken("a'b",),).toBe(String.raw`'a'\''b'`,);
      },
    },),
    it({
      name: 'builds a node command without tsx or nushell',
      fn: async () => {
        const command = buildNodeCommand();

        expect(command,).toContain('node -e',);
        expect(command,).toContain('MUTATION_TEST_FILES_JSON',);
        expect(command,).not.toContain('tsx',);
        expect(command,).not.toContain('nu -c',);
      },
    },),
    it({
      name: 'sequences tests from environment JSON',
      fn: async () => {
        expect(INLINE_NODE_SCRIPT,).toContain('process.env.MUTATION_TEST_FILES_JSON',);
        expect(INLINE_NODE_SCRIPT,).toContain("execFileSync('node', [test]",);
        expect(INLINE_NODE_SCRIPT,).toContain('process.exit(',);
      },
    },),
  ],
},);
