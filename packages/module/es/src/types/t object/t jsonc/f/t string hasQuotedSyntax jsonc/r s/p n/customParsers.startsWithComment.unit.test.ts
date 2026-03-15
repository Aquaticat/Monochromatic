import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'bun:test';

import type {
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

const $ = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named.startsWithComment;

describe($, () => {
  describe('no comment scenarios', () => {
    test('empty string returns empty remaining content', () => {
      const result = $({ value: '' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: '' as FragmentStringJsonc, },);
    });

    test('whitespace-only returns empty remaining content after trimming', () => {
      const result = $({ value: '   \n\t  ' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: '' as FragmentStringJsonc, },);
    });

    test('direct JSON object with no comments', () => {
      const result = $({ value: '{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: '{}' as FragmentStringJsonc, },);
    });

    test('direct JSON array with no comments', () => {
      const result = $({ value: '[]' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: '[]' as FragmentStringJsonc, },);
    });

    test('direct JSON string with no comments', () => {
      const result = $({ value: '"hello"' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: '"hello"' as FragmentStringJsonc, },);
    });

    test('direct JSON number with no comments', () => {
      const result = $({ value: '123' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: '123' as FragmentStringJsonc, },);
    });

    test('direct JSON boolean with no comments', () => {
      const result = $({ value: 'true' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: 'true' as FragmentStringJsonc, },);
    });

    test('direct JSON null with no comments', () => {
      const result = $({ value: 'null' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: 'null' as FragmentStringJsonc, },);
    });

    test('JSON with leading whitespace no comments returns trimmed', () => {
      const result = $({ value: '   \n  {}' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: '{}' as FragmentStringJsonc, },);
    });
  });

  describe('single inline comment scenarios', () => {
    test('basic inline comment followed by JSON', () => {
      const result = $({ value: '// comment\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'inline',
          commentValue: ' comment',
        },
      },);
    });

    test('multiple inline comments processed recursively', () => {
      const result = $({ value: '// first\n// second\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'inline',
          commentValue: ' first\n second',
        },
      },);
    });

    test('region marker comment', () => {
      const result = $({ value: '//region\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'inline',
          commentValue: 'region',
        },
      },);
    });

    test('endregion marker comment', () => {
      const result = $({ value: '//endregion\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'inline',
          commentValue: 'endregion',
        },
      },);
    });

    test('inline comment with special characters', () => {
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
    });

    test('inline comment with leading whitespace preserved', () => {
      const result = $({ value: '//    spaced comment   \n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'inline',
          commentValue: '    spaced comment   ',
        },
      },);
    });

    test('inline comment without newline treats rest as comment (end-of-input)', () => {
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
    });

    test('inline comment with empty comment value', () => {
      const result = $({ value: '//\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'inline',
          commentValue: '',
        },
      },);
    });
  });

  describe('single block comment scenarios', () => {
    test('basic single-line block comment', () => {
      const result = $({ value: '/* comment */{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'block',
          commentValue: ' comment ',
        },
      },);
    });

    test('multi-line block comment', () => {
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
    });

    test('empty block comment', () => {
      const result = $({ value: '/**/{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'block',
          commentValue: '',
        },
      },);
    });

    test('block comment with special characters and unicode', () => {
      const result = $({
        value: '/* block with émojis 🚀 and unicode 测试 */{}' as FragmentStringJsonc,
      },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'block',
          commentValue: ' block with émojis 🚀 and unicode 测试 ',
        },
      },);
    });

    test('block comment with quote-like content (LIMITATION TEST)', () => {
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
    });

    test('block comment with leading whitespace preserved', () => {
      const result = $({ value: '/*    spaced content   */{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'block',
          commentValue: '    spaced content   ',
        },
      },);
    });

    test('throws error for unterminated block comment', () => {
      expect(() =>
        $({
          value: '/* unterminated block comment no star slash' as FragmentStringJsonc,
        },)
      )
        .toThrow(/incomplete block comment is not jsonc/,);
    });

    test('throws error for empty unterminated block comment', () => {
      expect(() => $({ value: '/* {}' as FragmentStringJsonc, },)).toThrow(
        /incomplete block comment is not jsonc/,
      );
    });
  });

  describe('multiple sequential comments scenarios', () => {
    test('multiple block comments merged', () => {
      const result = $({ value: '/* first */\n/* second */{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'block',
          commentValue: ' first \n second ',
        },
      },);
    });

    test('mixed inline and block comments', () => {
      const result = $({ value: '// inline\n/* block */{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'mixed',
          commentValue: ' inline\n block ',
        },
      },);
    });

    test('block then inline comments become mixed type', () => {
      const result = $({ value: '/* block */\n// inline\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'mixed',
          commentValue: ' block \n inline',
        },
      },);
    });

    test('complex three-comment chain', () => {
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
    });
  });

  describe('context accumulation scenarios', () => {
    test('comments merged with existing inline context', () => {
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
    });

    test('comments merged with existing block context', () => {
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
    });

    test('inline comment merged with existing mixed context preserves mixed', () => {
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
    });

    test('no existing context preserves original comment type', () => {
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
    });
  });

  describe('complex block comment logic scenarios', () => {
    test('first-line optimization for block comment', () => {
      // This should hit the first-line optimization path
      const result = $({ value: '/* single line */{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'block',
          commentValue: ' single line ',
        },
      },);
    });

    test('multi-line block comment detection', () => {
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
    });

    test.skip('block comment with /* marks Star Slash that appears in line comment (should be ignored)', () => {
      // THE AI WAS WRONG, RIGHT NOW THE IMPLEMENTATION IS CORRECT
      // The */ in the // line should be ignored, the real */ is after the line
      const result = $({
        value: '/*\ncomment\n// has */ here\nstill comment\n*/{}' as FragmentStringJsonc,
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
    });

    test.skip('block comment with multiple line comments containing */', () => {
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
    });

    test('block comment position calculation accuracy', () => {
      // Test that the position calculation works correctly with preceding whitespace
      const result = $({ value: '   /*  content  */   {}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'block',
          commentValue: '  content  ',
        },
      },);
    });
  });

  describe('whitespace handling scenarios', () => {
    test('leading whitespace before inline comment', () => {
      const result = $({ value: '   \n  // comment\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'inline',
          commentValue: ' comment',
        },
      },);
    });

    test('leading whitespace before block comment', () => {
      const result = $({ value: '\t \n /* comment */\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'block',
          commentValue: ' comment ',
        },
      },);
    });

    test('trailing whitespace after comments', () => {
      const result = $({ value: '// comment\n   \t   \n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'inline',
          commentValue: ' comment',
        },
      },);
    });

    test('mixed tab and space whitespace', () => {
      const result = $({ value: '\t // mixed\twhitespace\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'inline',
          commentValue: ' mixed\twhitespace',
        },
      },);
    });
  });

  describe('edge cases and limitations', () => {
    test('very long inline comment', () => {
      const longComment = 'a'.repeat(1_000,);
      const result = $({ value: `// ${longComment}\n{}` as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'inline',
          commentValue: ` ${longComment}`,
        },
      },);
    });

    test('very long block comment', () => {
      const longComment = 'b'.repeat(1_000,);
      const result = $({ value: `/* ${longComment} */{}` as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'block',
          commentValue: ` ${longComment} `,
        },
      },);
    });

    test('comment with JSON-like content inside', () => {
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
    });

    test('block comment terminates at first */ regardless of quotes (per JSONC spec)', () => {
      // In JSONC, */ always terminates a block comment — quotes have no special meaning inside comments
      const result = $({
        value: '/* text with "quoted */ inside" */{}' as FragmentStringJsonc,
      },);
      // First */ after "quoted terminates the comment; remaining starts with 'inside"...'
      expect(result.remainingContent,).toBe('inside" */{}' as FragmentStringJsonc,);
      expect(result.comment?.type,).toBe('block',);
      expect(result.comment?.commentValue,).toBe(' text with "quoted ',);
    });

    test('comments with newline characters inside', () => {
      const result = $({ value: '/* line1\nline2\nline3 */{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}' as FragmentStringJsonc,
        comment: {
          type: 'block',
          commentValue: ' line1\nline2\nline3 ',
        },
      },);
    });

    test('comment delimiters inside comment content', () => {
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
    });
  });

  describe('type preservation scenarios', () => {
    test('StringJsonc type preservation', () => {
      const input = '// comment\n{}' as FragmentStringJsonc;
      const result = $({ value: input, },);
      // Type should include remainingContent as StringJsonc
      expect(result.remainingContent,).toBe('{}' as FragmentStringJsonc,);
    });

    test('FragmentStringJsonc type preservation', () => {
      const input = '/* comment */[]' as FragmentStringJsonc;
      const result = $({ value: input, },);
      // Type should include remainingContent as FragmentStringJsonc
      expect(result.remainingContent,).toBe('[]' as FragmentStringJsonc,);
    });
  });
},);
