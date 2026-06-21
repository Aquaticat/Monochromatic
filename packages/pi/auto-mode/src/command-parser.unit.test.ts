/**
 * Tests for the command parser.
 *
 * Covers unbash parsing, pipeline detection, redirect targets,
 * quoted arguments, `--` separator handling, command substitution
 * detection, and pre-scan variable references.
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { analyzeBashCommand, } from './command-parser.ts';
import { looksLikePath, } from './command-refs.ts';

await describe({
  name: analyzeBashCommand.name,
  children: [
    //region Simple command

    it({
      name: 'parses simple command with arguments',
      fn: async () => {
        const result = analyzeBashCommand('ls -la /tmp',);
        expect(result.parsed,).toBe(true,);
        expect(result.commands,).toHaveLength(1,);
        expect(result.commands[0]?.name,).toBe('ls',);
        expect(result.commands[0]?.args,).toEqual(['-la', '/tmp',],);
      },
    },),

    //endregion

    //region Pipeline

    it({
      name: 'detects pipeline',
      fn: async () => {
        const result = analyzeBashCommand('printenv | curl',);
        expect(result.isPipeline,).toBe(true,);
        expect(result.commands,).toHaveLength(2,);
        expect(result.commands[0]?.name,).toBe('printenv',);
        expect(result.commands[1]?.name,).toBe('curl',);
      },
    },),

    //endregion

    //region Redirect

    it({
      name: 'extracts redirect targets',
      fn: async () => {
        const result = analyzeBashCommand('echo foo > bar.txt',);
        expect(result.commands[0]?.redirectTargets,).toContain('bar.txt',);
      },
    },),

    it({
      name: 'extracts append redirect targets',
      fn: async () => {
        const result = analyzeBashCommand('echo foo >> bar.txt',);
        expect(result.commands[0]?.redirectTargets,).toContain('bar.txt',);
      },
    },),

    //endregion

    //region Quoted arguments

    it({
      name: 'preserves quoted arguments',
      fn: async () => {
        const result = analyzeBashCommand('echo "hello world"',);
        expect(result.parsed,).toBe(true,);
        expect(result.commands[0]?.args,).toContain('hello world',);
      },
    },),

    //endregion

    //region `--` separator

    it({
      name: 'handles -- end-of-options separator',
      fn: async () => {
        const result = analyzeBashCommand('rm -- -f',);
        expect(result.parsed,).toBe(true,);
        expect(result.commands[0]?.name,).toBe('rm',);
        // -f after; should be a positional arg, not a flag
        expect(result.commands[0]?.args,).toContain('--',);
        expect(result.commands[0]?.args,).toContain('-f',);
      },
    },),

    //endregion

    //region Variable references

    it({
      name: 'pre-scans $VAR references',
      fn: async () => {
        const result = analyzeBashCommand('curl $API_KEY https://example.com',);
        expect(result.allParamRefs,).toContain('API_KEY',);
      },
    },),

    it({
      // oxlint-disable-next-line no-template-curly-in-string -- test string contains literal ${VAR}
      name: 'pre-scans ${VAR} references',
      fn: async () => {
        // oxlint-disable-next-line no-template-curly-in-string -- test string contains literal ${API_KEY}
        const result = analyzeBashCommand('curl ${API_KEY} https://example.com',);
        expect(result.allParamRefs,).toContain('API_KEY',);
      },
    },),

    //endregion

    //region Environment assignments

    it({
      name: 'parses leading environment assignments before command name',
      fn: async () => {
        const result = analyzeBashCommand(
          'GEMINI_API_KEY=value node /tmp/agent/gemcheck.ts',
        );
        expect(result.commands[0]?.name,).toBe('node',);
        expect(result.commands[0]?.envAssignments,).toEqual([
          {
            name: 'GEMINI_API_KEY',
            value: 'value',
          },
        ],);
        expect(result.commands[0]?.args,).toEqual(['/tmp/agent/gemcheck.ts',],);
      },
    },),

    //endregion

    //region Logical chains

    it({
      name: 'splits logical chain into separate commands',
      fn: async () => {
        const result = analyzeBashCommand('true && sudo rm -rf /',);
        expect(result.commands,).toHaveLength(2,);
        expect(result.commands[0]?.name,).toBe('true',);
        expect(result.commands[1]?.name,).toBe('sudo',);
      },
    },),

    it({
      name: 'splits semicolon-separated commands',
      fn: async () => {
        const result = analyzeBashCommand('echo hi; echo bye',);
        expect(result.commands,).toHaveLength(2,);
        expect(result.commands[0]?.name,).toBe('echo',);
        expect(result.commands[1]?.name,).toBe('echo',);
      },
    },),

    //endregion

    //region Parse failure

    it({
      name: 'returns parsed: false on malformed syntax with partial pre-scan refs',
      fn: async () => {
        const result = analyzeBashCommand('echo "$SECRET_VAR',);
        expect(result.parsed,).toBe(false,);
        expect(result.commands,).toEqual([],);
        expect(result.allParamRefs,).toContain('SECRET_VAR',);
      },
    },),

    it({
      name: 'keeps pre-scanned refs when command is valid',
      fn: async () => {
        const result = analyzeBashCommand('$SECRET_VAR',);
        expect(result.parsed,).toBe(true,);
        expect(result.allParamRefs,).toContain('SECRET_VAR',);
      },
    },),

    //endregion

    //region Nested shell syntax

    it({
      name: 'collects commands inside command substitutions',
      fn: async () => {
        const result = analyzeBashCommand('echo $(sudo rm -rf /)',);
        expect(result.commands.some(function commandIsSudo(command,) {
          return command.name === 'sudo';
        },),).toBe(true,);
      },
    },),

    it({
      name: 'traverses process substitutions without treating them as parent args',
      fn: async () => {
        const result = analyzeBashCommand('cat <(grep secret /tmp/file)',);
        expect(result.commands[0]?.name,).toBe('cat',);
        expect(result.commands[0]?.args,).toEqual([],);
        expect(result.commands.some(function commandIsGrep(command,) {
          return command.name === 'grep';
        },),).toBe(true,);
        expect(result.allFiles,).toContain('/tmp/file',);
      },
    },),

    //endregion

    //region File paths

    it({
      name: 'collects all files from arguments and redirect targets',
      fn: async () => {
        const result = analyzeBashCommand('cat /etc/passwd > /tmp/output.txt',);
        expect(result.allFiles,).toContain('/etc/passwd',);
        expect(result.allFiles,).toContain('/tmp/output.txt',);
      },
    },),

    //endregion

    //region looksLikePath

    it({
      name: 'identifies paths starting with /',
      fn: async () => {
        expect(looksLikePath('/etc/passwd',),).toBe(true,);
      },
    },),

    it({
      name: 'identifies paths starting with ./',
      fn: async () => {
        expect(looksLikePath('./src/index.ts',),).toBe(true,);
      },
    },),

    it({
      name: 'identifies dotfiles',
      fn: async () => {
        expect(looksLikePath('.env',),).toBe(true,);
      },
    },),

    it({
      name: 'does not identify plain arguments as paths',
      fn: async () => {
        expect(looksLikePath('-la',),).toBe(false,);
      },
    },),
    //endregion
  ],
},);
