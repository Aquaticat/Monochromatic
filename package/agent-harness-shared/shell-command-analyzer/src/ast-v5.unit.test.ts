/**
 Regression coverage for the installed unbash 5 syntax tree.

 @module
 */

import { analyzeShellCommand, } from '@monochromatic-dev/agent-harness-shared-shell-command-analyzer';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';

await describe({
  name: '',
  children: [
    describe({
      name: analyzeShellCommand.name,
      children: [
        ...[
          { source: 'time -p printf timed', name: 'printf', },
          { source: '! printf negated', name: 'printf', },
          { source: '{ printf grouped; } > output.txt', name: 'printf', },
          { source: 'coproc worker { printf child; } > output.txt', name: 'printf', },
          { source: 'for value; do printf "$value"; done', name: 'printf', },
          { source: 'select value; do printf "$value"; done', name: 'printf', },
        ].map(function wrappedCommand({ source, name, },) {
          return it({
            name: `retains commands in ${source}`,
            fn: async function testWrappedCommand() {
              const result = analyzeShellCommand(source,);
              expect(result.parsed,).toBe(true,);
              expect(result.commands.map(function commandName(command,) {
                return command.name;
              },),).toContain(name,);
              if (source.includes('> output.txt',))
                expect(result.commands.flatMap(function targets(command,) {
                  return command.redirectTargets;
                },),).toEqual(['output.txt',],);
            },
          },);
        },),
        it({
          name: 'keeps redirections separate from mixed command prefixes and suffixes',
          fn: async function testMixedCommandItems() {
            const result = analyzeShellCommand('> before.txt FIRST="one two" printf alpha 2> after.txt beta',);
            const command = result.commands[0];
            expect(result.parsed,).toBe(true,);
            expect(command?.name,).toBe('printf',);
            expect(command?.args,).toEqual(['alpha', 'beta',],);
            expect(command?.envAssignments,).toEqual([{ name: 'FIRST', value: 'one two', },],);
            expect(command?.redirectTargets,).toEqual(['before.txt', 'after.txt',],);
            expect(command?.redirects[1]?.fileDescriptor,).toBe(2,);
          },
        },),
        it({
          name: 'preserves numeric and variable redirect descriptors',
          fn: async function testRedirectDescriptors() {
            const result = analyzeShellCommand('exec {output}> out.txt 2>&1',);
            expect(result.parsed,).toBe(true,);
            expect(result.commands[0]?.redirects,).toEqual([
              { operator: '>', fileDescriptorVariable: 'output', target: 'out.txt', targetSourceText: 'out.txt', kind: 'file', writesFile: true, readsFile: false, },
              { operator: '>&', fileDescriptor: 2, target: '1', targetSourceText: '1', kind: 'fileDescriptor', writesFile: false, readsFile: false, },
            ],);
          },
        },),
        it({
          name: 'preserves declaration assignment values and source spelling',
          fn: async function testDeclarationAssignments() {
            const result = analyzeShellCommand('export VALUE="one two" > output.txt',);
            expect(result.parsed,).toBe(true,);
            expect(result.commands[0]?.args,).toEqual(['VALUE=one two',],);
            expect(result.commands[0]?.argSources,).toEqual([
              { value: 'VALUE=one two', sourceText: 'VALUE="one two"', },
            ],);
          },
        },),
        ...[
          'values=($(printf array_value))',
          'values[$(printf array_index)]=literal',
          'declare values=($(printf declaration_value))',
          `printf "\${values[$(printf parameter_index)]}"`,
          `printf "\${value:-$(printf default_value)}"`,
          `printf "\${value#$(printf removal_pattern)}"`,
          `printf "\${value/$(printf replace_pattern)/$(printf replacement)}"`,
          `printf "\${value:$(printf slice_offset):$(printf slice_length)}"`,
          'cat <<< "$(printf here_string)"',
          'cat <<EOF\n$(printf here_body)\nEOF',
        ].map(function nestedExpression(source,) {
          return it({
            name: `traverses nested commands in ${source}`,
            fn: async function testNestedExpression() {
              const result = analyzeShellCommand(source,);
              expect(result.parsed,).toBe(true,);
              expect(result.hasCommandSubstitution,).toBe(true,);
              expect(result.commands.some(function hasNestedCommand(command,) {
                return command.name === 'printf'
                  && command.args.some(function hasMarker(argument,) {
                    return argument.endsWith('_value',) || argument.endsWith('_index',)
                      || argument.endsWith('_pattern',) || argument === 'replacement'
                      || argument.startsWith('slice_',) || argument.startsWith('here_',);
                  },);
              },),).toBe(true,);
            },
          },);
        },),
        it({
          name: 'does not execute quoted heredoc content during analysis',
          fn: async function testQuotedHeredoc() {
            const result = analyzeShellCommand("cat <<'EOF'\n$(printf literal_body)\nEOF",);
            expect(result.parsed,).toBe(true,);
            expect(result.hasHeredoc,).toBe(true,);
            expect(result.hasCommandSubstitution,).toBe(false,);
            expect(result.commands.map(function commandName(command,) {
              return command.name;
            },),).toEqual(['cat',],);
          },
        },),
        it({
          name: 'keeps redirected function bodies in function-definition context',
          fn: async function testFunctionRedirect() {
            const result = analyzeShellCommand('saved() { printf body; } > output.txt',);
            expect(result.parsed,).toBe(true,);
            expect(result.commands.every(function belongsToFunction(command,) {
              return command.context.kind === 'functionDefinition';
            },),).toBe(true,);
            expect(result.commands.flatMap(function targets(command,) {
              return command.redirectTargets;
            },),).toEqual(['output.txt',],);
          },
        },),
      ],
    },),
  ],
},);
