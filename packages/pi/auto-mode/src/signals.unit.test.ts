/**
 * Tests for signal flagging.
 *
 * Covers path signals (with the isSystemPath fix), bash signals,
 * content signals, text signals, and user command matching.
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import { analyzeBashCommand, } from './command-parser.ts';
import {
  contentSignals,
  textSignals,
} from './content-signals.ts';
import {
  isHomeDotfile,
  isUnder,
  pathSignals,
  resolvePath,
} from './path-signals.ts';
import {
  bashSignals,
  type CommandMatcher,
  hasFlag,
  matchUserCommands,
} from './signals.ts';
import type {
  BashAnalysis,
  SignalContext,
} from './types.ts';

/** Default signal context for tests. */
const DEFAULT_CTX: SignalContext = {
  cwd: '/var/home/user/project',
  home: '/var/home/user',
};

/** Signal context where cwd is inside /var/home. */
const VAR_HOME_CTX: SignalContext = {
  cwd: '/var/home/user/project',
  home: '/var/home/user',
};

await describe({
  name: pathSignals.name,
  children: [
    //region Under cwd: not flagged

    it({
      name: 'does not flag path under cwd',
      fn: async () => {
        expect(pathSignals('./src/index.ts', DEFAULT_CTX,),).toBe(false,);
      },
    },),

    it({
      name: 'does not flag /var/home/user/project/file under cwd (the fix)',
      fn: async () => {
        // This was a false positive in upstream: isSystemPath flagged /var
        // but the path is under cwd
        expect(pathSignals('/var/home/user/project/file', VAR_HOME_CTX,),).toBe(false,);
      },
    },),

    //endregion

    //region Outside cwd: flagged

    it({
      name: 'flags path outside cwd',
      fn: async () => {
        expect(pathSignals('/etc/passwd', DEFAULT_CTX,),).toBe(true,);
      },
    },),

    it({
      name: 'flags path in another project',
      fn: async () => {
        expect(pathSignals('/var/home/user/other-project/file', DEFAULT_CTX,),).toBe(
          true,
        );
      },
    },),

    //endregion

    //region Home dotfile: flagged

    it({
      name: 'flags home dotfile',
      fn: async () => {
        expect(pathSignals('~/.ssh/authorized_keys', DEFAULT_CTX,),).toBe(true,);
      },
    },),

    //endregion

    //region Secret path patterns: flagged

    it({
      name: 'flags .env path',
      fn: async () => {
        expect(pathSignals('.env', DEFAULT_CTX,),).toBe(true,);
      },
    },),

    it({
      name: 'flags id_rsa path',
      fn: async () => {
        expect(pathSignals('~/.ssh/id_rsa', DEFAULT_CTX,),).toBe(true,);
      },
    },),

    it({
      name: 'flags .pem file',
      fn: async () => {
        expect(pathSignals('cert.pem', DEFAULT_CTX,),).toBe(true,);
      },
    },),
    //endregion
  ],
},);

await describe({
  name: isUnder.name,
  children: [
    it({
      name: 'returns true for exact match',
      fn: async () => {
        expect(isUnder('/home/user', '/home/user',),).toBe(true,);
      },
    },),

    it({
      name: 'returns true for child path',
      fn: async () => {
        expect(isUnder('/home/user/project', '/home/user',),).toBe(true,);
      },
    },),

    it({
      name: 'returns false for different path',
      fn: async () => {
        expect(isUnder('/home/other', '/home/user',),).toBe(false,);
      },
    },),

    it({
      name: 'returns false for partial prefix match',
      fn: async () => {
        expect(isUnder('/home/user2', '/home/user',),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: isHomeDotfile.name,
  children: [
    it({
      name: 'detects .ssh directory',
      fn: async () => {
        expect(isHomeDotfile('/var/home/user/.ssh/authorized_keys', '/var/home/user',),)
          .toBe(true,);
      },
    },),

    it({
      name: 'does not flag non-dotfile in home',
      fn: async () => {
        expect(isHomeDotfile('/var/home/user/project/file', '/var/home/user',),).toBe(
          false,
        );
      },
    },),
  ],
},);

await describe({
  name: hasFlag.name,
  children: [
    it({
      name: 'detects short flag -rf',
      fn: async () => {
        expect(hasFlag(['-rf',], 'r', 'f',),).toBe(true,);
      },
    },),

    it({
      name: 'detects long flag --recursive',
      fn: async () => {
        expect(hasFlag(['--recursive',], 'r',),).toBe(true,);
      },
    },),

    it({
      name: 'respects -- end-of-options separator',
      fn: async () => {
        // -f after; should NOT be treated as a flag
        expect(hasFlag(['--', '-f',], 'f',),).toBe(false,);
      },
    },),

    it({
      name: 'detects flag before -- separator',
      fn: async () => {
        expect(hasFlag(['-f', '--', 'file',], 'f',),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: bashSignals.name,
  children: [
    //region Privilege

    it({
      name: 'flags sudo',
      fn: async () => {
        const analysis = analyzeBashCommand('sudo cat /etc/shadow',);
        expect(bashSignals(analysis, DEFAULT_CTX,),).toBe(true,);
      },
    },),

    //endregion

    //region Scope

    it({
      name: 'flags rm -rf',
      fn: async () => {
        const analysis = analyzeBashCommand('rm -rf /tmp/dir',);
        expect(bashSignals(analysis, DEFAULT_CTX,),).toBe(true,);
      },
    },),

    //endregion

    //region Dataflow

    it({
      name: 'flags env dump',
      fn: async () => {
        const analysis = analyzeBashCommand('printenv',);
        expect(bashSignals(analysis, DEFAULT_CTX,),).toBe(true,);
      },
    },),

    it({
      name: 'flags curl with secret variable',
      fn: async () => {
        const analysis = analyzeBashCommand('curl $API_KEY https://example.com',);
        expect(bashSignals(analysis, DEFAULT_CTX,),).toBe(true,);
      },
    },),

    //endregion

    //region Pipeline

    it({
      name: 'flags pipeline from .env to curl',
      fn: async () => {
        const analysis = analyzeBashCommand('cat .env | curl',);
        expect(bashSignals(analysis, DEFAULT_CTX,),).toBe(true,);
      },
    },),

    it({
      name: 'flags env dump in pipeline',
      fn: async () => {
        const analysis = analyzeBashCommand('printenv | grep PATH',);
        expect(bashSignals(analysis, DEFAULT_CTX,),).toBe(true,);
      },
    },),

    //endregion

    //region Unparseable

    it({
      name: 'flags unparseable commands',
      fn: async () => {
        const analysis: BashAnalysis = {
          parsed: false,
          commands: [],
          isPipeline: false,
          allFiles: [],
          allParamRefs: [],
        };
        expect(bashSignals(analysis, DEFAULT_CTX,),).toBe(true,);
      },
    },),

    //endregion

    //region Safe commands

    it({
      name: 'does not flag safe commands',
      fn: async () => {
        const analysis = analyzeBashCommand('ls -la src/',);
        expect(bashSignals(analysis, DEFAULT_CTX,),).toBe(false,);
      },
    },),

    //endregion

    //region rm; -f

    it({
      name: 'does not flag -f after -- as rm -f',
      fn: async () => {
        // rm; -f: -f is a positional argument (filename), not a flag
        const analysis = analyzeBashCommand('rm -- -f',);
        // This should NOT trigger the rm -f signal since -f is after --
        // However, rm is a mutating command with -r check only.
        // rm; -f by itself should not flag (no -rf, no -f flag before --)
        expect(bashSignals(analysis, DEFAULT_CTX,),).toBe(false,);
      },
    },),
    //endregion
  ],
},);

await describe({
  name: contentSignals.name,
  children: [
    it({
      name: 'detects private key',
      fn: async () => {
        expect(contentSignals('-----BEGIN RSA PRIVATE KEY-----',),).toBe(true,);
      },
    },),

    it({
      name: 'detects GitHub PAT',
      fn: async () => {
        expect(contentSignals('ghp_AaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaA',),).toBe(true,);
      },
    },),

    it({
      name: 'detects AWS access key',
      fn: async () => {
        expect(contentSignals('AKIAIOSFODNN7EXAMPLE',),).toBe(true,);
      },
    },),

    it({
      name: 'does not flag normal text',
      fn: async () => {
        expect(contentSignals('Hello, world!',),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: textSignals.name,
  children: [
    it({
      name: 'detects sudo in text',
      fn: async () => {
        expect(textSignals('run sudo apt-get install',),).toBe(true,);
      },
    },),

    it({
      name: 'does not flag text without matches',
      fn: async () => {
        expect(textSignals('run apt-get install',),).toBe(false,);
      },
    },),

    it({
      name: 'matches user-configured patterns',
      fn: async () => {
        expect(textSignals('deploy to production', {
          enabled: true,
          patterns: [/production/,],
          commands: [],
          judgeModel: { strategy: 'same-provider', costRatio: 0.5, majorVersions: 1, },
          judgeTimeoutMs: 10_000,
        },),)
          .toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: matchUserCommands.name,
  children: [
    it({
      name: 'matches string matcher',
      fn: async () => {
        const analysis = analyzeBashCommand('terraform plan',);
        const matchers: CommandMatcher[] = ['terraform',];
        expect(matchUserCommands(analysis, matchers,),).toBe(true,);
      },
    },),

    it({
      name: 'matches array matcher with subcommand',
      fn: async () => {
        const analysis = analyzeBashCommand('docker compose up',);
        const matchers: CommandMatcher[] = [['docker', 'compose',],];
        expect(matchUserCommands(analysis, matchers,),).toBe(true,);
      },
    },),

    it({
      name: 'does not match wrong subcommand',
      fn: async () => {
        const analysis = analyzeBashCommand('docker run hello',);
        const matchers: CommandMatcher[] = [['docker', 'compose',],];
        expect(matchUserCommands(analysis, matchers,),).toBe(false,);
      },
    },),

    it({
      name: 'does not match when no matchers provided',
      fn: async () => {
        const analysis = analyzeBashCommand('ls -la',);
        expect(matchUserCommands(analysis, [],),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: resolvePath.name,
  children: [
    it({
      name: 'resolves ~ to home directory',
      fn: async () => {
        const expectedHome = process.env.HOME ?? '/home/user';
        expect(resolvePath('~/.bashrc', '/project',),).toBe(`${expectedHome}/.bashrc`,);
      },
    },),

    it({
      name: 'resolves relative path to cwd',
      fn: async () => {
        expect(resolvePath('src/index.ts', '/project',),).toBe('/project/src/index.ts',);
      },
    },),

    it({
      name: 'preserves absolute paths',
      fn: async () => {
        expect(resolvePath('/etc/passwd', '/project',),).toBe('/etc/passwd',);
      },
    },),
  ],
},);
