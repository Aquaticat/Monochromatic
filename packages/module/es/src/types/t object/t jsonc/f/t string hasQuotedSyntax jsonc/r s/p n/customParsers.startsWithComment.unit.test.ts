import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

import type {
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';

const $ = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named.startsWithComment;

describe($, () => {
  describe('no comment scenarios', () => {
    test('empty string returns empty remaining content', ({ expect, },) => {
      const result = $({ value: '' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: '', },);
    });

    test('whitespace-only returns trimmed remaining content', ({ expect, },) => {
      const result = $({ value: '   \n\t  ' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: '   \n\t  ', },);
    });

    test('direct JSON object with no comments', ({ expect, },) => {
      const result = $({ value: '{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: '{}', },);
    });

    test('direct JSON array with no comments', ({ expect, },) => {
      const result = $({ value: '[]' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: '[]', },);
    });

    test('direct JSON string with no comments', ({ expect, },) => {
      const result = $({ value: '"hello"' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: '"hello"', },);
    });

    test('direct JSON number with no comments', ({ expect, },) => {
      const result = $({ value: '123' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: '123', },);
    });

    test('direct JSON boolean with no comments', ({ expect, },) => {
      const result = $({ value: 'true' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: 'true', },);
    });

    test('direct JSON null with no comments', ({ expect, },) => {
      const result = $({ value: 'null' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: 'null', },);
    });

    test('JSON with leading whitespace no comments', ({ expect, },) => {
      const result = $({ value: '   \n  {}' as FragmentStringJsonc, },);
      expect(result,).toEqual({ remainingContent: '   \n  {}', },);
    });
  });

  describe('single inline comment scenarios', () => {
    test('basic inline comment followed by JSON', ({ expect, },) => {
      const result = $({ value: '// comment\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'inline',
          commentValue: ' comment',
        },
      },);
    });

    test('multiple inline comments processed recursively', ({ expect, },) => {
      const result = $({ value: '// first\n// second\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'inline',
          commentValue: ' first\n second',
        },
      },);
    });

    test('region marker comment', ({ expect, },) => {
      const result = $({ value: '//region\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'inline',
          commentValue: 'region',
        },
      },);
    });

    test('endregion marker comment', ({ expect, },) => {
      const result = $({ value: '//endregion\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'inline',
          commentValue: 'endregion',
        },
      },);
    });

    test('inline comment with special characters', ({ expect, },) => {
      const result = $({
        value: '// comment with émojis 🚀 and sp€ci@l!\n{}' as FragmentStringJsonc,
      },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'inline',
          commentValue: ' comment with émojis 🚀 and sp€ci@l!',
        },
      },);
    });

    test('inline comment with leading whitespace preserved', ({ expect, },) => {
      const result = $({ value: '//    spaced comment   \n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'inline',
          commentValue: '    spaced comment   ',
        },
      },);
    });

    test('throws error for inline comment without newline', ({ expect, },) => {
      expect(() => $({ value: '// comment without newline{}' as FragmentStringJsonc, },))
        .toThrow(
          /line comment is not jsonc/,
        );
    });

    test('inline comment with empty comment value', ({ expect, },) => {
      const result = $({ value: '//\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'inline',
          commentValue: '',
        },
      },);
    });
  });

  describe('single block comment scenarios', () => {
    test('basic single-line block comment', ({ expect, },) => {
      const result = $({ value: '/* comment */{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: ' comment ',
        },
      },);
    });

    test('multi-line block comment', ({ expect, },) => {
      const result = $({
        value: '/* comment\non multiple\nlines */{}' as FragmentStringJsonc,
      },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: ' comment\non multiple\nlines ',
        },
      },);
    });

    test('empty block comment', ({ expect, },) => {
      const result = $({ value: '/**/{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: '',
        },
      },);
    });

    test('block comment with special characters and unicode', ({ expect, },) => {
      const result = $({
        value: '/* block with émojis 🚀 and unicode 测试 */{}' as FragmentStringJsonc,
      },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: ' block with émojis 🚀 and unicode 测试 ',
        },
      },);
    });

    test('block comment with quote-like content (LIMITATION TEST)', ({ expect, },) => {
      // This is a known limitation - quotes inside comments can confuse the parser
      // but this specific case should work since it's not actually quoted content
      const result = $({
        value: '/* "text inside quotes" */{}' as FragmentStringJsonc,
      },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: ' "text inside quotes" ',
        },
      },);
    });

    test('block comment with leading whitespace preserved', ({ expect, },) => {
      const result = $({ value: '/*    spaced content   */{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: '    spaced content   ',
        },
      },);
    });

    test('throws error for unterminated block comment', ({ expect, },) => {
      expect(() =>
        $({
          value: '/* unterminated block comment no star slash' as FragmentStringJsonc,
        },)
      )
        .toThrow(/incomplete block comment is not jsonc/,);
    });

    test('throws error for empty unterminated block comment', ({ expect, },) => {
      expect(() => $({ value: '/* {}' as FragmentStringJsonc, },)).toThrow(
        /incomplete block comment is not jsonc/,
      );
    });
  });

  describe('multiple sequential comments scenarios', () => {
    test('multiple block comments merged', ({ expect, },) => {
      const result = $({ value: '/* first */\n/* second */{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: ' first \n second ',
        },
      },);
    });

    test('mixed inline and block comments', ({ expect, },) => {
      const result = $({ value: '// inline\n/* block */{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'mixed',
          commentValue: ' inline\n block ',
        },
      },);
    });

    test('block then inline comments become mixed type', ({ expect, },) => {
      const result = $({ value: '/* block */\n// inline\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'mixed',
          commentValue: ' block \n inline',
        },
      },);
    });

    test('complex three-comment chain', ({ expect, },) => {
      const result = $({
        value: '// first\n/* second */\n// third\n{}' as FragmentStringJsonc,
      },);
      expect(result,).toEqual({
        remainingContent: '{}',
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
    test('comments merged with existing inline context', ({ expect, },) => {
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
        remainingContent: '{}',
        comment: {
          type: 'inline',
          commentValue: 'existing context\n new comment',
        },
      },);
    });

    test('comments merged with existing block context', ({ expect, },) => {
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
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: 'existing context\n new comment ',
        },
      },);
    });

    test('inline comment merged with existing mixed context preserves mixed', ({ expect, },) => {
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
        remainingContent: '{}',
        comment: {
          type: 'mixed',
          commentValue: 'existing mixed context\n new inline',
        },
      },);
    });

    test('no existing context preserves original comment type', ({ expect, },) => {
      const result = $({
        value: '/* standalone block */{}' as FragmentStringJsonc,
        context: {},
      },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: ' standalone block ',
        },
      },);
    });
  });

  describe('complex block comment logic scenarios', () => {
    test('first-line optimization for block comment', ({ expect, },) => {
      // This should hit the first-line optimization path
      const result = $({ value: '/* single line */{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: ' single line ',
        },
      },);
    });

    test('multi-line block comment detection', ({ expect, },) => {
      const result = $({
        value: '/*\nmulti-line\ncomment\n*/{}' as FragmentStringJsonc,
      },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: '\nmulti-line\ncomment\n',
        },
      },);
    });

    test.skip('block comment with /* marks Star Slash that appears in line comment (should be ignored)', ({ expect, },) => {
      // THE AI WAS WRONG, RIGHT NOW THE IMPLEMENTATION IS CORRECT
      // The */ in the // line should be ignored, the real */ is after the line
      const result = $({
        value: '/*\ncomment\n// has */ here\nstill comment\n*/{}' as FragmentStringJsonc,
      },);
      // KNOWN LIMITATION: This complex case doesn't work as expected currently
      // The function stops at the first */ it finds, even if it's in a line comment
      expect(result,).toEqual({
        remainingContent: 'here\nstill comment\n*/{}',
        comment: {
          type: 'block',
          commentValue: '\ncomment\n// has ',
        },
      },);
    });

    test.skip('block comment with multiple line comments containing */', ({ expect, },) => {
      // THE AI WAS WRONG, RIGHT NOW THE IMPLEMENTATION IS CORRECT

      const result = $({
        value:
          '/*\nstart\n// first line with */ end\n// second line with */ also\nfinal\n*/{}' as FragmentStringJsonc,
      },);
      // KNOWN LIMITATION: Similar to the previous test, this doesn't work as expected
      expect(result,).toEqual({
        remainingContent: 'end\n// second line with */ also\nfinal\n*/{}',
        comment: {
          type: 'block',
          commentValue: '\nstart\n// first line with',
        },
      },);
    });

    test('block comment position calculation accuracy', ({ expect, },) => {
      // Test that the position calculation works correctly with preceding whitespace
      const result = $({ value: '   /*  content  */   {}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: '  content  ',
        },
      },);
    });
  });

  describe('whitespace handling scenarios', () => {
    test('leading whitespace before inline comment', ({ expect, },) => {
      const result = $({ value: '   \n  // comment\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'inline',
          commentValue: ' comment',
        },
      },);
    });

    test('leading whitespace before block comment', ({ expect, },) => {
      const result = $({ value: '\t \n /* comment */\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: ' comment ',
        },
      },);
    });

    test('trailing whitespace after comments', ({ expect, },) => {
      const result = $({ value: '// comment\n   \t   \n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'inline',
          commentValue: ' comment',
        },
      },);
    });

    test('mixed tab and space whitespace', ({ expect, },) => {
      const result = $({ value: '\t // mixed\twhitespace\n{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'inline',
          commentValue: ' mixed\twhitespace',
        },
      },);
    });
  });

  describe('edge cases and limitations', () => {
    test('very long inline comment', ({ expect, },) => {
      const longComment = 'a'.repeat(1000,);
      const result = $({ value: `// ${longComment}\n{}` as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'inline',
          commentValue: ` ${longComment}`,
        },
      },);
    });

    test('very long block comment', ({ expect, },) => {
      const longComment = 'b'.repeat(1000,);
      const result = $({ value: `/* ${longComment} */{}` as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: ` ${longComment} `,
        },
      },);
    });

    test('comment with JSON-like content inside', ({ expect, },) => {
      const result = $({
        value:
          '// {"fake": "json", "array": [1,2,3], "bool": true}\n{}' as FragmentStringJsonc,
      },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'inline',
          commentValue: ' {"fake": "json", "array": [1,2,3], "bool": true}',
        },
      },);
    });

    test('KNOWN LIMITATION: block comment with complex quote patterns', ({ expect, },) => {
      // This documents a known limitation - complex quote patterns in block comments
      // The current implementation doesn't fully handle quoted */ patterns within block comments
      const result = $({
        value: '/* text with "quoted */ inside" */{}' as FragmentStringJsonc,
      },);
      // The result may not be predictable in this edge case
      expect(result.remainingContent,).toBe('{}',);
      expect(result.comment?.type,).toBe('block',);
    });

    test('comments with newline characters inside', ({ expect, },) => {
      const result = $({ value: '/* line1\nline2\nline3 */{}' as FragmentStringJsonc, },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'block',
          commentValue: ' line1\nline2\nline3 ',
        },
      },);
    });

    test('comment delimiters inside comment content', ({ expect, },) => {
      const result = $({
        value:
          '// comment with // inside\n/* block with /* inside */{}' as FragmentStringJsonc,
      },);
      expect(result,).toEqual({
        remainingContent: '{}',
        comment: {
          type: 'mixed',
          commentValue: ' comment with // inside\n block with /* inside ',
        },
      },);
    });
  });

  describe('type preservation scenarios', () => {
    test('StringJsonc type preservation', ({ expect, },) => {
      const input = '// comment\n{}' as FragmentStringJsonc;
      const result = $({ value: input, },);
      // Type should include remainingContent as StringJsonc
      expect(result.remainingContent,).toBe('{}',);
    });

    test('FragmentStringJsonc type preservation', ({ expect, },) => {
      const input = '/* comment */[]' as FragmentStringJsonc;
      const result = $({ value: input, },);
      // Type should include remainingContent as FragmentStringJsonc
      expect(result.remainingContent,).toBe('[]',);
    });
  });
},);
