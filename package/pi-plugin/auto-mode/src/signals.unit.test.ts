/**
 * Tests for signal flagging.
 *
 * Covers path signals (with the isSystemPath fix), bash signals,
 * content signals, and text signals.
 */

import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import {
  homedir,
  tmpdir,
} from 'node:os';
import { join, } from 'node:path';

import type { ToolCallEvent, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
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
  hasFlag,
  shouldFlag,
} from './signals.ts';
import type { SignalContext, } from './types.ts';

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
        expect(await pathSignals({ filePath: './src/index.ts', ctx: DEFAULT_CTX, },),).toBe(
          false,
        );
      },
    },),

    it({
      name: 'does not flag /var/home/user/project/file under cwd (the fix)',
      fn: async () => {
        // This was a false positive in upstream: isSystemPath flagged /var
        // but the path is under cwd
        expect(
          await pathSignals({ filePath: '/var/home/user/project/file', ctx: VAR_HOME_CTX, },),
        )
          .toBe(false,);
      },
    },),

    //endregion

    //region Outside cwd: flagged

    it({
      name: 'flags path outside cwd',
      fn: async () => {
        expect(await pathSignals({ filePath: '/etc/passwd', ctx: DEFAULT_CTX, },),).toBe(true,);
      },
    },),

    it({
      name: 'flags path in another project',
      fn: async () => {
        expect(
          await pathSignals({ filePath: '/var/home/user/other-project/file',
            ctx: DEFAULT_CTX, },),
        )
          .toBe(
            true,
          );
      },
    },),

    //endregion

    //region Skill read allowlist

    it({
      name: 'does not flag allowlisted skill path outside cwd',
      fn: async () => {
        expect(
          await pathSignals({
            filePath: '/var/home/user/Monochromatic/.agents/skills/project-code-review/SKILL.md',
            ctx: DEFAULT_CTX,
            allowlistedDirs: ['/var/home/user/Monochromatic/.agents/skills/project-code-review',],
          },),
        )
          .toBe(false,);
      },
    },),

    it({
      name: 'does not flag existing allowlisted temp file outside cwd',
      fn: async function doesNotFlagExistingAllowlistedTempFile() {
        const root = await mkdtemp(join(
          tmpdir(),
          'auto-mode-path-',
        ),);
        const allowedDir = join(
          root,
          'allowed',
        );
        await mkdir(
          allowedDir,
          { recursive: true, },
        );
        const sourceFile = join(
          allowedDir,
          'source.ts',
        );
        await writeFile(
          sourceFile,
          'export const source = true;\n',
        );

        expect(
          await pathSignals({
            filePath: sourceFile,
            ctx: DEFAULT_CTX,
            allowlistedDirs: [allowedDir,],
          },),
        )
          .toBe(false,);
        await rm(
          root,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'flags allowlisted symlink that resolves outside allowlist',
      fn: async function flagsAllowlistedSymlinkEscape() {
        const root = await mkdtemp(join(
          tmpdir(),
          'auto-mode-path-',
        ),);
        const allowedDir = join(
          root,
          'allowed',
        );
        const outsideDir = join(
          root,
          'outside',
        );
        await mkdir(
          allowedDir,
          { recursive: true, },
        );
        await mkdir(
          outsideDir,
          { recursive: true, },
        );
        const outsideFile = join(
          outsideDir,
          'source.ts',
        );
        await writeFile(
          outsideFile,
          'export const outside = true;\n',
        );
        const linkPath = join(
          allowedDir,
          'source.ts',
        );
        await symlink(
          outsideFile,
          linkPath,
        );

        expect(
          await pathSignals({
            filePath: linkPath,
            ctx: DEFAULT_CTX,
            allowlistedDirs: [allowedDir,],
          },),
        )
          .toBe(true,);
        await rm(
          root,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'flags non-secret allowlisted symlink to secret-looking target',
      fn: async function flagsAllowlistedSecretSymlinkTarget() {
        const root = await mkdtemp(join(
          tmpdir(),
          'auto-mode-path-',
        ),);
        const allowedDir = join(
          root,
          'allowed',
        );
        await mkdir(
          allowedDir,
          { recursive: true, },
        );
        const secretFile = join(
          allowedDir,
          '.env',
        );
        await writeFile(
          secretFile,
          'VALUE=example\n',
        );
        const linkPath = join(
          allowedDir,
          'source.txt',
        );
        await symlink(
          secretFile,
          linkPath,
        );

        expect(
          await pathSignals({
            filePath: linkPath,
            ctx: DEFAULT_CTX,
            allowlistedDirs: [allowedDir,],
          },),
        )
          .toBe(true,);
        await rm(
          root,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'flags sibling skill path outside allowlist',
      fn: async () => {
        expect(
          await pathSignals({
            filePath: '/var/home/user/Monochromatic/.agents/skills/other/SKILL.md',
            ctx: DEFAULT_CTX,
            allowlistedDirs: ['/var/home/user/Monochromatic/.agents/skills/code-review',],
          },),
        )
          .toBe(true,);
      },
    },),

    it({
      name: 'flags secret-looking path inside skill allowlist',
      fn: async () => {
        expect(
          await pathSignals({
            filePath: '/var/home/user/Monochromatic/.agents/skills/code-review/.env',
            ctx: DEFAULT_CTX,
            allowlistedDirs: ['/var/home/user/Monochromatic/.agents/skills/code-review',],
          },),
        )
          .toBe(true,);
      },
    },),

    //endregion

    //region Home dotfile: flagged

    it({
      name: 'flags home dotfile',
      fn: async () => {
        expect(await pathSignals({ filePath: '~/.ssh/authorized_keys', ctx: DEFAULT_CTX, },),)
          .toBe(true,);
      },
    },),

    //endregion

    //region Secret path patterns: flagged

    it({
      name: 'flags .env path',
      fn: async () => {
        expect(await pathSignals({ filePath: '.env', ctx: DEFAULT_CTX, },),).toBe(true,);
      },
    },),

    it({
      name: 'flags id_rsa path',
      fn: async () => {
        expect(await pathSignals({ filePath: '~/.ssh/id_rsa', ctx: DEFAULT_CTX, },),).toBe(
          true,
        );
      },
    },),

    it({
      name: 'flags .pem file',
      fn: async () => {
        expect(await pathSignals({ filePath: 'cert.pem', ctx: DEFAULT_CTX, },),).toBe(true,);
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
        expect(isUnder({ resolved: '/home/user', dir: '/home/user', },),).toBe(true,);
      },
    },),

    it({
      name: 'returns true for child path',
      fn: async () => {
        expect(isUnder({ resolved: '/home/user/project', dir: '/home/user', },),).toBe(
          true,
        );
      },
    },),

    it({
      name: 'returns false for different path',
      fn: async () => {
        expect(isUnder({ resolved: '/home/other', dir: '/home/user', },),).toBe(false,);
      },
    },),

    it({
      name: 'returns false for partial prefix match',
      fn: async () => {
        expect(isUnder({ resolved: '/home/user2', dir: '/home/user', },),).toBe(false,);
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
        expect(
          isHomeDotfile({ resolved: '/var/home/user/.ssh/authorized_keys',
            home: '/var/home/user', },),
        )
          .toBe(true,);
      },
    },),

    it({
      name: 'does not flag non-dotfile in home',
      fn: async () => {
        expect(
          isHomeDotfile({ resolved: '/var/home/user/project/file',
            home: '/var/home/user', },),
        )
          .toBe(
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
        expect(hasFlag({ args: ['-rf',], flags: ['r', 'f',], },),).toBe(true,);
      },
    },),

    it({
      name: 'detects long flag --recursive',
      fn: async () => {
        expect(hasFlag({ args: ['--recursive',], flags: ['r',], },),).toBe(true,);
      },
    },),

    it({
      name: 'respects -- end-of-options separator',
      fn: async () => {
        // -f after; should NOT be treated as a flag
        expect(hasFlag({ args: ['--', '-f',], flags: ['f',], },),).toBe(false,);
      },
    },),

    it({
      name: 'detects flag before -- separator',
      fn: async () => {
        expect(hasFlag({ args: ['-f', '--', 'file',], flags: ['f',], },),).toBe(true,);
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
        expect(await bashSignals({ analysis, ctx: DEFAULT_CTX, },),).toBe(true,);
      },
    },),

    //endregion

    //region Scope

    it({
      name: 'flags rm -rf',
      fn: async () => {
        const analysis = analyzeBashCommand('rm -rf /tmp/dir',);
        expect(await bashSignals({ analysis, ctx: DEFAULT_CTX, },),).toBe(true,);
      },
    },),

    //endregion

    //region Dataflow

    it({
      name: 'flags env dump',
      fn: async () => {
        const analysis = analyzeBashCommand('printenv',);
        expect(await bashSignals({ analysis, ctx: DEFAULT_CTX, },),).toBe(true,);
      },
    },),

    it({
      name: 'flags curl with secret variable',
      fn: async () => {
        const analysis = analyzeBashCommand('curl $API_KEY https://example.com',);
        expect(await bashSignals({ analysis, ctx: DEFAULT_CTX, },),).toBe(true,);
      },
    },),

    it({
      name: 'allows project dotenv credential handoff to trusted temp helper',
      fn: async function allowsProjectDotenvCredentialHandoff() {
        const projectRoot = await mkdtemp(join(
          tmpdir(),
          'amode-project-'
        ),);
        const agentRoot = await mkdtemp(join(
          tmpdir(),
          'amode-agent-'
        ),);
        const envPath = join(
          projectRoot,
          '.env.local',
        );
        const scriptPath = join(
          agentRoot,
          'gemcheck.ts',
        );
        const imageGlob = join(
          agentRoot,
          'page-*.png',
        );
        await writeFile(
          envPath,
          'IMAGE_DIFF_GEMINI_API_KEY=test\n',
        );
        await writeFile(
          scriptPath,
          'export {};\n',
        );

        const analysis = analyzeBashCommand(
          `KEY=$(grep --max-count=1 IMAGE_DIFF_GEMINI_API_KEY ${envPath} | cut --delimiter='=' --fields=2- | tr --delete '"'); GEMINI_API_KEY="$KEY" node ${scriptPath} gemini-3.5-flash ${imageGlob}`,
        );
        const ctx: SignalContext = {
          cwd: projectRoot,
          home: '/var/home/user',
        };

        expect(await bashSignals({ analysis, ctx, },),).toBe(true,);
        expect(await bashSignals({
          analysis,
          ctx,
          trustedAgentTempDirs: [agentRoot,],
        },),).toBe(false,);

        await rm(
          projectRoot,
          {
            recursive: true,
            force: true,
          },
        );
        await rm(
          agentRoot,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'does not allow secret-looking trusted temp glob handoff',
      fn: async function rejectsTrustedTempSecretGlobHandoff() {
        const projectRoot = await mkdtemp(join(
          tmpdir(),
          'amode-project-'
        ),);
        const agentRoot = await mkdtemp(join(
          tmpdir(),
          'amode-agent-'
        ),);
        const scriptPath = join(
          agentRoot,
          'gemcheck.ts',
        );
        const secretGlob = join(
          agentRoot,
          '.env*',
        );
        const bracketSecretGlob = join(
          agentRoot,
          '[.]env*',
        );
        await writeFile(
          scriptPath,
          'export {};\n',
        );
        const ctx: SignalContext = {
          cwd: projectRoot,
          home: '/var/home/user',
        };

        expect(await bashSignals({
          analysis: analyzeBashCommand(
            `GEMINI_API_KEY=value node ${scriptPath} ${secretGlob}`,
          ),
          ctx,
          trustedAgentTempDirs: [agentRoot,],
        },),).toBe(true,);
        expect(await bashSignals({
          analysis: analyzeBashCommand(
            `GEMINI_API_KEY=value node ${scriptPath} ${bracketSecretGlob}`,
          ),
          ctx,
          trustedAgentTempDirs: [agentRoot,],
        },),).toBe(true,);

        await rm(
          projectRoot,
          {
            recursive: true,
            force: true,
          },
        );
        await rm(
          agentRoot,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'does not allow trusted temp glob through escaping symlink',
      fn: async function rejectsTrustedTempEscapingGlobHandoff() {
        const projectRoot = await mkdtemp(join(
          tmpdir(),
          'amode-project-'
        ),);
        const agentRoot = await mkdtemp(join(
          tmpdir(),
          'amode-agent-'
        ),);
        const outsideRoot = await mkdtemp(join(
          tmpdir(),
          'amode-outside-'
        ),);
        const scriptPath = join(
          agentRoot,
          'gemcheck.ts',
        );
        const linkRoot = join(
          agentRoot,
          'outside-link',
        );
        await symlink(
          outsideRoot,
          linkRoot,
          'dir',
        );
        await writeFile(
          scriptPath,
          'export {};\n',
        );
        const ctx: SignalContext = {
          cwd: projectRoot,
          home: '/var/home/user',
        };

        const linkedPageGlob = join(
          linkRoot,
          'page-*.png',
        );
        const command = `GEMINI_API_KEY=value node ${scriptPath} ${linkedPageGlob}`;

        expect(await bashSignals({
          analysis: analyzeBashCommand(command,),
          ctx,
          trustedAgentTempDirs: [agentRoot,],
        },),).toBe(true,);

        await rm(
          projectRoot,
          {
            recursive: true,
            force: true,
          },
        );
        await rm(
          agentRoot,
          {
            recursive: true,
            force: true,
          },
        );
        await rm(
          outsideRoot,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'does not allow non-dotenv secret file handoff to trusted temp helper',
      fn: async function rejectsNonDotenvSecretHandoff() {
        const projectRoot = await mkdtemp(join(
          tmpdir(),
          'amode-project-'
        ),);
        const agentRoot = await mkdtemp(join(
          tmpdir(),
          'amode-agent-'
        ),);
        const sshRoot = join(
          projectRoot,
          '.ssh',
        );
        await mkdir(
          sshRoot,
          { recursive: true, },
        );
        const secretPath = join(
          sshRoot,
          'id_rsa',
        );
        const scriptPath = join(
          agentRoot,
          'gemcheck.ts',
        );
        await writeFile(
          secretPath,
          'not-real\n',
        );
        await writeFile(
          scriptPath,
          'export {};\n',
        );

        const analysis = analyzeBashCommand(
          `KEY=$(grep VALUE ${secretPath}); GEMINI_API_KEY="$KEY" node ${scriptPath}`,
        );
        const ctx: SignalContext = {
          cwd: projectRoot,
          home: '/var/home/user',
        };

        expect(await bashSignals({
          analysis,
          ctx,
          trustedAgentTempDirs: [agentRoot,],
        },),).toBe(true,);

        await rm(
          projectRoot,
          {
            recursive: true,
            force: true,
          },
        );
        await rm(
          agentRoot,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'does not allow unrelated dotenv read beside trusted temp handoff',
      fn: async function rejectsUnrelatedDotenvRead() {
        const projectRoot = await mkdtemp(join(
          tmpdir(),
          'amode-project-'
        ),);
        const agentRoot = await mkdtemp(join(
          tmpdir(),
          'amode-agent-'
        ),);
        const envPath = join(
          projectRoot,
          '.env.local',
        );
        const scriptPath = join(
          agentRoot,
          'gemcheck.ts',
        );
        await writeFile(
          envPath,
          'IMAGE_DIFF_GEMINI_API_KEY=test\nOTHER_SECRET=blocked\n',
        );
        await writeFile(
          scriptPath,
          'export {};\n',
        );

        const analysis = analyzeBashCommand(
          `grep IMAGE_DIFF_GEMINI_API_KEY ${envPath}; GEMINI_API_KEY=value node ${scriptPath}; cat ${envPath}`,
        );
        const ctx: SignalContext = {
          cwd: projectRoot,
          home: '/var/home/user',
        };

        expect(await bashSignals({
          analysis,
          ctx,
          trustedAgentTempDirs: [agentRoot,],
        },),).toBe(true,);

        await rm(
          projectRoot,
          {
            recursive: true,
            force: true,
          },
        );
        await rm(
          agentRoot,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    //endregion

    //region Pipeline

    it({
      name: 'flags pipeline from .env to curl',
      fn: async () => {
        const analysis = analyzeBashCommand('cat .env | curl',);
        expect(await bashSignals({ analysis, ctx: DEFAULT_CTX, },),).toBe(true,);
      },
    },),

    it({
      name: 'flags env dump in pipeline',
      fn: async () => {
        const analysis = analyzeBashCommand('printenv | grep PATH',);
        expect(await bashSignals({ analysis, ctx: DEFAULT_CTX, },),).toBe(true,);
      },
    },),

    //endregion

    //region Unparseable

    it({
      name: 'flags unparseable commands',
      fn: async () => {
        const analysis = analyzeBashCommand('echo "$SECRET_VAR',);
        expect(await bashSignals({ analysis, ctx: DEFAULT_CTX, },),).toBe(true,);
      },
    },),

    //endregion

    //region Safe commands

    it({
      name: 'does not flag safe commands',
      fn: async () => {
        const analysis = analyzeBashCommand('ls -la src/',);
        expect(await bashSignals({ analysis, ctx: DEFAULT_CTX, },),).toBe(false,);
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
        expect(await bashSignals({ analysis, ctx: DEFAULT_CTX, },),).toBe(false,);
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
        expect(contentSignals('ghp_000000000000000000000000000000000000',),).toBe(true,);
      },
    },),

    it({
      name: 'detects AWS access key',
      fn: async () => {
        expect(contentSignals('AKIA2222222222222222',),).toBe(true,);
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
        expect(textSignals({ text: 'run sudo apt-get install', },),).toBe(true,);
      },
    },),

    it({
      name: 'does not flag text without matches',
      fn: async () => {
        expect(textSignals({ text: 'run apt-get install', },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: shouldFlag.name,
  children: [
    it({
      name: 'does not flag read tool call inside skill read allowlist',
      fn: async () => {
        const event: ToolCallEvent = {
          type: 'tool_call',
          toolName: 'read',
          toolCallId: 'read-skill',
          input: {
            path: '/var/home/user/Monochromatic/.agents/skills/testing-practices/SKILL.md',
          },
        };

        expect(await shouldFlag({
          event,
          ctx: DEFAULT_CTX,
          readAllowlistedDirs: ['/var/home/user/Monochromatic/.agents/skills/testing-practices',],
        },),)
          .toBe(false,);
      },
    },),

    it({
      name: 'flags write tool call inside skill read allowlist',
      fn: async () => {
        const event: ToolCallEvent = {
          type: 'tool_call',
          toolName: 'write',
          toolCallId: 'write-skill',
          input: {
            path: '/var/home/user/Monochromatic/.agents/skills/testing-practices/SKILL.md',
            content: 'changed',
          },
        };

        expect(await shouldFlag({
          event,
          ctx: DEFAULT_CTX,
          readAllowlistedDirs: ['/var/home/user/Monochromatic/.agents/skills/testing-practices',],
        },),)
          .toBe(true,);
      },
    },),

    it({
      name: 'flags secret-looking read path inside skill read allowlist',
      fn: async () => {
        const event: ToolCallEvent = {
          type: 'tool_call',
          toolName: 'read',
          toolCallId: 'read-skill-secret',
          input: {
            path: '/var/home/user/Monochromatic/.agents/skills/testing-practices/.env',
          },
        };

        expect(await shouldFlag({
          event,
          ctx: DEFAULT_CTX,
          readAllowlistedDirs: ['/var/home/user/Monochromatic/.agents/skills/testing-practices',],
        },),)
          .toBe(true,);
      },
    },),

    it({
      name: 'flags bash path inside skill read allowlist',
      fn: async () => {
        const event: ToolCallEvent = {
          type: 'tool_call',
          toolName: 'bash',
          toolCallId: 'bash-skill',
          input: {
            command:
              'cat /var/home/user/Monochromatic/.agents/skills/testing-practices/SKILL.md',
          },
        };

        expect(await shouldFlag({
          event,
          ctx: DEFAULT_CTX,
          readAllowlistedDirs: ['/var/home/user/Monochromatic/.agents/skills/testing-practices',],
        },),)
          .toBe(true,);
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
        const expectedHome = homedir();
        expect(resolvePath({ filePath: '~/.bashrc', cwd: '/project', },),).toBe(
          `${expectedHome}/.bashrc`,
        );
      },
    },),

    it({
      name: 'resolves relative path to cwd',
      fn: async () => {
        expect(resolvePath({ filePath: 'src/index.ts', cwd: '/project', },),).toBe(
          '/project/src/index.ts',
        );
      },
    },),

    it({
      name: 'preserves absolute paths',
      fn: async () => {
        expect(resolvePath({ filePath: '/etc/passwd', cwd: '/project', },),).toBe(
          '/etc/passwd',
        );
      },
    },),
  ],
},);
