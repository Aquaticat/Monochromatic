import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import type {
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

const $ = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named.startsWithComment;

await describe({
  name: $.name,
  children: [
    describe({
      name: 'no comment scenarios',
      children: [
        it({
          name: 'empty string returns empty remaining content',
          fn: async () => {
            const result = $({ value: '' as FragmentStringJsonc, },);
            expect(result,).toEqual({ remainingContent: '' as FragmentStringJsonc, },);
          },
        },),

        it({
          name: 'whitespace-only returns empty remaining content after trimming',
          fn: async () => {
            const result = $({ value: '   \n\t  ' as FragmentStringJsonc, },);
            expect(result,).toEqual({ remainingContent: '' as FragmentStringJsonc, },);
          },
        },),

        it({
          name: 'direct JSON object with no comments',
          fn: async () => {
            const result = $({ value: '{}' as FragmentStringJsonc, },);
            expect(result,).toEqual({ remainingContent: '{}' as FragmentStringJsonc, },);
          },
        },),

        it({
          name: 'direct JSON array with no comments',
          fn: async () => {
            const result = $({ value: '[]' as FragmentStringJsonc, },);
            expect(result,).toEqual({ remainingContent: '[]' as FragmentStringJsonc, },);
          },
        },),

        it({
          name: 'direct JSON string with no comments',
          fn: async () => {
            const result = $({ value: '"hello"' as FragmentStringJsonc, },);
            expect(result,).toEqual({
              remainingContent: '"hello"' as FragmentStringJsonc,
            },);
          },
        },),

        it({
          name: 'direct JSON number with no comments',
          fn: async () => {
            const result = $({ value: '123' as FragmentStringJsonc, },);
            expect(result,).toEqual({ remainingContent: '123' as FragmentStringJsonc, },);
          },
        },),

        it({
          name: 'direct JSON boolean with no comments',
          fn: async () => {
            const result = $({ value: 'true' as FragmentStringJsonc, },);
            expect(result,).toEqual({
              remainingContent: 'true' as FragmentStringJsonc,
            },);
          },
        },),

        it({
          name: 'direct JSON null with no comments',
          fn: async () => {
            const result = $({ value: 'null' as FragmentStringJsonc, },);
            expect(result,).toEqual({
              remainingContent: 'null' as FragmentStringJsonc,
            },);
          },
        },),

        it({
          name: 'JSON with leading whitespace no comments returns trimmed',
          fn: async () => {
            const result = $({ value: '   \n  {}' as FragmentStringJsonc, },);
            expect(result,).toEqual({ remainingContent: '{}' as FragmentStringJsonc, },);
          },
        },),
      ],
    },),

    describe({
      name: 'single inline comment scenarios',
      children: [
        it({
          name: 'basic inline comment followed by JSON',
          fn: async () => {
            const result = $({ value: '// comment\n{}' as FragmentStringJsonc, },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'inline',
                commentValue: ' comment',
              },
            },);
          },
        },),

        it({
          name: 'multiple inline comments processed recursively',
          fn: async () => {
            const result = $({
              value: '// first\n// second\n{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'inline',
                commentValue: ' first\n second',
              },
            },);
          },
        },),

        it({
          name: 'region marker comment',
          fn: async () => {
            const result = $({ value: '//region\n{}' as FragmentStringJsonc, },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'inline',
                commentValue: 'region',
              },
            },);
          },
        },),

        it({
          name: 'endregion marker comment',
          fn: async () => {
            const result = $({ value: '//endregion\n{}' as FragmentStringJsonc, },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'inline',
                commentValue: 'endregion',
              },
            },);
          },
        },),

        it({
          name: 'inline comment with special characters',
          fn: async () => {
            const result = $({
              value: '// comment with émojis 🚀 and sp€ci@l!\n{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'inline',
                commentValue: ' comment with émojis 🚀 and sp€ci@l!',
              },
            },);
          },
        },),

        it({
          name: 'inline comment with leading whitespace preserved',
          fn: async () => {
            const result = $({
              value: '//    spaced comment   \n{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'inline',
                commentValue: '    spaced comment   ',
              },
            },);
          },
        },),

        it({
          name: 'inline comment without newline treats rest as comment (end-of-input)',
          fn: async () => {
            const result = $({
              value: '// comment without newline{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '' as FragmentStringJsonc,
              comment: {
                type: 'inline',
                commentValue: ' comment without newline{}',
              },
            },);
          },
        },),

        it({
          name: 'inline comment with empty comment value',
          fn: async () => {
            const result = $({ value: '//\n{}' as FragmentStringJsonc, },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'inline',
                commentValue: '',
              },
            },);
          },
        },),
      ],
    },),

    describe({
      name: 'single block comment scenarios',
      children: [
        it({
          name: 'basic single-line block comment',
          fn: async () => {
            const result = $({ value: '/* comment */{}' as FragmentStringJsonc, },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: ' comment ',
              },
            },);
          },
        },),

        it({
          name: 'multi-line block comment',
          fn: async () => {
            const result = $({
              value: '/* comment\non multiple\nlines */{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: ' comment\non multiple\nlines ',
              },
            },);
          },
        },),

        it({
          name: 'empty block comment',
          fn: async () => {
            const result = $({ value: '/**/{}' as FragmentStringJsonc, },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: '',
              },
            },);
          },
        },),

        it({
          name: 'block comment with special characters and unicode',
          fn: async () => {
            const result = $({
              value:
                '/* block with émojis 🚀 and unicode 测试 */{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: ' block with émojis 🚀 and unicode 测试 ',
              },
            },);
          },
        },),

        it({
          name: 'block comment with quote-like content (LIMITATION TEST)',
          fn: async () => {
            // This is a known limitation - quotes inside comments can confuse the parser
            // but this specific case should work since it's not actually quoted content
            const result = $({
              value: '/* "text inside quotes" */{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: ' "text inside quotes" ',
              },
            },);
          },
        },),

        it({
          name: 'block comment with leading whitespace preserved',
          fn: async () => {
            const result = $({
              value: '/*    spaced content   */{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: '    spaced content   ',
              },
            },);
          },
        },),

        it({
          name: 'throws error for unterminated block comment',
          fn: async () => {
            expect(() =>
              $({
                value:
                  '/* unterminated block comment no star slash' as FragmentStringJsonc,
              },)
            )
              .toThrow('incomplete block comment is not jsonc',);
          },
        },),

        it({
          name: 'throws error for empty unterminated block comment',
          fn: async () => {
            expect(() => $({ value: '/* {}' as FragmentStringJsonc, },)).toThrow(
              'incomplete block comment is not jsonc',
            );
          },
        },),
      ],
    },),

    describe({
      name: 'multiple sequential comments scenarios',
      children: [
        it({
          name: 'multiple block comments merged',
          fn: async () => {
            const result = $({
              value: '/* first */\n/* second */{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: ' first \n second ',
              },
            },);
          },
        },),

        it({
          name: 'mixed inline and block comments',
          fn: async () => {
            const result = $({
              value: '// inline\n/* block */{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'mixed',
                commentValue: ' inline\n block ',
              },
            },);
          },
        },),

        it({
          name: 'block then inline comments become mixed type',
          fn: async () => {
            const result = $({
              value: '/* block */\n// inline\n{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'mixed',
                commentValue: ' block \n inline',
              },
            },);
          },
        },),

        it({
          name: 'complex three-comment chain',
          fn: async () => {
            const result = $({
              value: '// first\n/* second */\n// third\n{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'mixed',
                // TODO: Figure out why the current implementation is adding extra spaces to each line.
                //  We could simply trim each line to fix it, but that obviously would preserve existing indent in comments, which we don't want.
                commentValue: ' first\n second \n third',
              },
            },);
          },
        },),
      ],
    },),

    describe({
      name: 'context accumulation scenarios',
      children: [
        it({
          name: 'comments merged with existing inline context',
          fn: async () => {
            const result = $({
              value: '// new comment\n{}' as FragmentStringJsonc,
              context: {
                comment: {
                  type: 'inline',
                  commentValue: 'existing context',
                },
              },
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'inline',
                commentValue: 'existing context\n new comment',
              },
            },);
          },
        },),

        it({
          name: 'comments merged with existing block context',
          fn: async () => {
            const result = $({
              value: '/* new comment */{}' as FragmentStringJsonc,
              context: {
                comment: {
                  type: 'block',
                  commentValue: 'existing context',
                },
              },
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: 'existing context\n new comment ',
              },
            },);
          },
        },),

        it({
          name: 'inline comment merged with existing mixed context preserves mixed',
          fn: async () => {
            const result = $({
              value: '// new inline\n{}' as FragmentStringJsonc,
              context: {
                comment: {
                  type: 'mixed',
                  commentValue: 'existing mixed context',
                },
              },
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'mixed',
                commentValue: 'existing mixed context\n new inline',
              },
            },);
          },
        },),

        it({
          name: 'no existing context preserves original comment type',
          fn: async () => {
            const result = $({
              value: '/* standalone block */{}' as FragmentStringJsonc,
              context: {},
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: ' standalone block ',
              },
            },);
          },
        },),
      ],
    },),

    describe({
      name: 'complex block comment logic scenarios',
      children: [
        it({
          name: 'first-line optimization for block comment',
          fn: async () => {
            // This should hit the first-line optimization path
            const result = $({ value: '/* single line */{}' as FragmentStringJsonc, },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: ' single line ',
              },
            },);
          },
        },),

        it({
          name: 'multi-line block comment detection',
          fn: async () => {
            const result = $({
              value: '/*\nmulti-line\ncomment\n*/{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: '\nmulti-line\ncomment\n',
              },
            },);
          },
        },),

        it({
          name:
            'block comment with /* marks Star Slash that appears in line comment (should be ignored)',
          skip: true,
          fn: async () => {
            // THE AI WAS WRONG, RIGHT NOW THE IMPLEMENTATION IS CORRECT
            // The */ in the // line should be ignored, the real */ is after the line
            const result = $({
              value:
                '/*\ncomment\n// has */ here\nstill comment\n*/{}' as FragmentStringJsonc,
            },);
            // KNOWN LIMITATION: This complex case doesn't work as expected currently
            // The function stops at the first */ it finds, even if it's in a line comment
            expect(result,).toEqual({
              remainingContent: 'here\nstill comment\n*/{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: '\ncomment\n// has ',
              },
            },);
          },
        },),

        it({
          name: 'block comment with multiple line comments containing */',
          skip: true,
          fn: async () => {
            // THE AI WAS WRONG, RIGHT NOW THE IMPLEMENTATION IS CORRECT

            const result = $({
              value:
                '/*\nstart\n// first line with */ end\n// second line with */ also\nfinal\n*/{}' as FragmentStringJsonc,
            },);
            // KNOWN LIMITATION: Similar to the previous test, this doesn't work as expected
            expect(result,).toEqual({
              remainingContent:
                'end\n// second line with */ also\nfinal\n*/{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: '\nstart\n// first line with',
              },
            },);
          },
        },),

        it({
          name: 'block comment position calculation accuracy',
          fn: async () => {
            // Test that the position calculation works correctly with preceding whitespace
            const result = $({
              value: '   /*  content  */   {}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: '  content  ',
              },
            },);
          },
        },),
      ],
    },),

    describe({
      name: 'whitespace handling scenarios',
      children: [
        it({
          name: 'leading whitespace before inline comment',
          fn: async () => {
            const result = $({ value: '   \n  // comment\n{}' as FragmentStringJsonc, },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'inline',
                commentValue: ' comment',
              },
            },);
          },
        },),

        it({
          name: 'leading whitespace before block comment',
          fn: async () => {
            const result = $({
              value: '\t \n /* comment */\n{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: ' comment ',
              },
            },);
          },
        },),

        it({
          name: 'trailing whitespace after comments',
          fn: async () => {
            const result = $({
              value: '// comment\n   \t   \n{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'inline',
                commentValue: ' comment',
              },
            },);
          },
        },),

        it({
          name: 'mixed tab and space whitespace',
          fn: async () => {
            const result = $({
              value: '\t // mixed\twhitespace\n{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'inline',
                commentValue: ' mixed\twhitespace',
              },
            },);
          },
        },),
      ],
    },),

    describe({
      name: 'edge cases and limitations',
      children: [
        it({
          name: 'very long inline comment',
          fn: async () => {
            const longComment = 'a'.repeat(1_000,);
            const result = $({ value: `// ${longComment}\n{}` as FragmentStringJsonc, },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'inline',
                commentValue: ` ${longComment}`,
              },
            },);
          },
        },),

        it({
          name: 'very long block comment',
          fn: async () => {
            const longComment = 'b'.repeat(1_000,);
            const result = $({
              value: `/* ${longComment} */{}` as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: ` ${longComment} `,
              },
            },);
          },
        },),

        it({
          name: 'comment with JSON-like content inside',
          fn: async () => {
            const result = $({
              value:
                '// {"fake": "json", "array": [1,2,3], "bool": true}\n{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'inline',
                commentValue: ' {"fake": "json", "array": [1,2,3], "bool": true}',
              },
            },);
          },
        },),

        it({
          name:
            'block comment terminates at first */ regardless of quotes (per JSONC spec)',
          fn: async () => {
            // In JSONC, */ always terminates a block comment; quotes have no special meaning inside comments
            const result = $({
              value: '/* text with "quoted */ inside" */{}' as FragmentStringJsonc,
            },);
            // First */ after "quoted terminates the comment; remaining starts with 'inside"...'
            expect(result.remainingContent,).toBe('inside" */{}' as FragmentStringJsonc,);
            expect(result.comment?.type,).toBe('block',);
            expect(result.comment?.commentValue,).toBe(' text with "quoted ',);
          },
        },),

        it({
          name: 'comments with newline characters inside',
          fn: async () => {
            const result = $({
              value: '/* line1\nline2\nline3 */{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'block',
                commentValue: ' line1\nline2\nline3 ',
              },
            },);
          },
        },),

        it({
          name: 'comment delimiters inside comment content',
          fn: async () => {
            const result = $({
              value:
                '// comment with // inside\n/* block with /* inside */{}' as FragmentStringJsonc,
            },);
            expect(result,).toEqual({
              remainingContent: '{}' as FragmentStringJsonc,
              comment: {
                type: 'mixed',
                commentValue: ' comment with // inside\n block with /* inside ',
              },
            },);
          },
        },),
      ],
    },),

    describe({
      name: 'type preservation scenarios',
      children: [
        it({
          name: 'StringJsonc type preservation',
          fn: async () => {
            const input = '// comment\n{}' as FragmentStringJsonc;
            const result = $({ value: input, },);
            // Type should include remainingContent as StringJsonc
            expect(result.remainingContent,).toBe('{}' as FragmentStringJsonc,);
          },
        },),

        it({
          name: 'FragmentStringJsonc type preservation',
          fn: async () => {
            const input = '/* comment */[]' as FragmentStringJsonc;
            const result = $({ value: input, },);
            // Type should include remainingContent as FragmentStringJsonc
            expect(result.remainingContent,).toBe('[]' as FragmentStringJsonc,);
          },
        },),
      ],
    },),
  ],
},);
