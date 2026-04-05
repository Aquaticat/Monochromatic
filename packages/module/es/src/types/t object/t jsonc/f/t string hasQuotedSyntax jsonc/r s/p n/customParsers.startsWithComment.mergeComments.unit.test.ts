import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

const $ = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named.mergeComments;

await describe({
  name: $.name,
  children: [
    it({
      name: 'both undefined returns undefined',
      fn: async () => {
        expect($({},),).toBeUndefined();
      },
    }),

    it({
      name: 'only first comment defined returns first comment',
      fn: async () => {
        const comment = { type: 'inline' as const, commentValue: 'First comment', };
        const result = $({ value: comment, },);
        expect(result,).toEqual(comment,);
      },
    }),

    it({
      name: 'only second comment defined returns second comment',
      fn: async () => {
        const comment = { type: 'block' as const, commentValue: 'Second comment', };
        const result = $({ value2: comment, },);
        expect(result,).toEqual(comment,);
      },
    }),

    it({
      name: 'both inline comments merge to inline type',
      fn: async () => {
        const first = { type: 'inline' as const, commentValue: 'First inline', };
        const second = { type: 'inline' as const, commentValue: 'Second inline', };
        const result = $({ value: first, value2: second, },);

        expect(result,).toEqual({
          type: 'inline',
          commentValue: 'First inline\nSecond inline',
        },);
      },
    }),

    it({
      name: 'both block comments merge to block type',
      fn: async () => {
        const first = { type: 'block' as const, commentValue: 'First block', };
        const second = { type: 'block' as const, commentValue: 'Second block', };
        const result = $({ value: first, value2: second, },);

        expect(result,).toEqual({
          type: 'block',
          commentValue: 'First block\nSecond block',
        },);
      },
    }),

    it({
      name: 'inline + block comments merge to mixed type',
      fn: async () => {
        const first = { type: 'inline' as const, commentValue: 'Inline comment', };
        const second = { type: 'block' as const, commentValue: 'Block comment', };
        const result = $({ value: first, value2: second, },);

        expect(result,).toEqual({
          type: 'mixed',
          commentValue: 'Inline comment\nBlock comment',
        },);
      },
    }),

    it({
      name: 'block + inline comments merge to mixed type',
      fn: async () => {
        const first = { type: 'block' as const, commentValue: 'Block comment', };
        const second = { type: 'inline' as const, commentValue: 'Inline comment', };
        const result = $({ value: first, value2: second, },);

        expect(result,).toEqual({
          type: 'mixed',
          commentValue: 'Block comment\nInline comment',
        },);
      },
    }),

    it({
      name: 'preserves whitespace in comment values',
      fn: async () => {
        const first = { type: 'inline' as const,
          commentValue: '  Comment with leading space  ', };
        const second = { type: 'inline' as const,
          commentValue: '  Comment with Trailing space  ', };
        const result = $({ value: first, value2: second, },);

        expect(result,).toEqual({
          type: 'inline',
          commentValue: '  Comment with leading space  \n  Comment with Trailing space  ',
        },);
      },
    }),

    it({
      name: 'handles empty comment values',
      fn: async () => {
        const first = { type: 'inline' as const, commentValue: '', };
        const second = { type: 'inline' as const, commentValue: 'Non-empty comment', };
        const result = $({ value: first, value2: second, },);

        expect(result,).toEqual({
          type: 'inline',
          commentValue: '\nNon-empty comment',
        },);
      },
    }),

    it({
      name: 'handles multiline comments',
      fn: async () => {
        const first = { type: 'block' as const, commentValue: 'Line 1\nLine 2', };
        const second = { type: 'block' as const, commentValue: 'Line 3\nLine 4', };
        const result = $({ value: first, value2: second, },);

        expect(result,).toEqual({
          type: 'block',
          commentValue: 'Line 1\nLine 2\nLine 3\nLine 4',
        },);
      },
    }),

    it({
      name: 'preserves comment-like delimiters in values',
      fn: async () => {
        const first = { type: 'inline' as const, commentValue: '// This is region marker', };
        const second = { type: 'block' as const,
          commentValue: '/* This has block markers */', };
        const result = $({ value: first, value2: second, },);

        expect(result,).toEqual({
          type: 'mixed',
          commentValue: '// This is region marker\n/* This has block markers */',
        },);
      },
    }),

    it({
      name: 'handles special characters and unicode',
      fn: async () => {
        const first = { type: 'inline' as const,
          commentValue: 'Comment with émojis 🚀 and sp€ci@l chars', };
        const second = { type: 'inline' as const, commentValue: '另一个评论', };
        const result = $({ value: first, value2: second, },);

        expect(result,).toEqual({
          type: 'inline',
          commentValue: 'Comment with émojis 🚀 and sp€ci@l chars\n另一个评论',
        },);
      },
    }),

    it({
      name: 'handles very long comment values',
      fn: async () => {
        const longComment = 'A'.repeat(1_000,);
        const first = { type: 'inline' as const, commentValue: longComment, };
        const second = { type: 'inline' as const, commentValue: 'B'.repeat(1_000,), };
        const result = $({ value: first, value2: second, },);

        expect(result,).toEqual({
          type: 'inline',
          commentValue: `${longComment}\n${'B'.repeat(1_000,)}`,
        },);
      },
    }),

    it({
      name: 'when first is undefined, returns second comment unchanged',
      fn: async () => {
        const second = { type: 'inline' as const, commentValue: 'Only second comment', };
        const result = $({ value: undefined, value2: second, },);

        expect(result,).toEqual(second,);
      },
    }),

    it({
      name: 'when second is undefined, returns first comment unchanged',
      fn: async () => {
        const first = { type: 'block' as const, commentValue: 'Only first comment', };
        const result = $({ value: first, value2: undefined, },);

        expect(result,).toEqual(first,);
      },
    }),

    it({
      name: 'mixed type comment (already mixed) preserves type when merging with inline',
      fn: async () => {
        const first = { type: 'mixed' as const, commentValue: 'Already mixed', };
        const second = { type: 'inline' as const, commentValue: 'Adding inline', };
        const result = $({ value: first, value2: second, },);

        expect(result,).toEqual({
          type: 'mixed',
          commentValue: 'Already mixed\nAdding inline',
        },);
      },
    }),

    it({
      name: 'mixed type comment (already mixed) preserves type when merging with block',
      fn: async () => {
        const first = { type: 'mixed' as const, commentValue: 'Already mixed', };
        const second = { type: 'block' as const, commentValue: 'Adding block', };
        const result = $({ value: first, value2: second, },);

        expect(result,).toEqual({
          type: 'mixed',
          commentValue: 'Already mixed\nAdding block',
        },);
      },
    }),

    it({
      name: 'handles comments with existing newlines properly',
      fn: async () => {
        const first = { type: 'inline' as const,
          commentValue: 'First\nwith\nexisting\nnewlines', };
        const second = { type: 'inline' as const,
          commentValue: 'Second\nalso\nhas\nnewlines', };
        const result = $({ value: first, value2: second, },);

        expect(result,).toEqual({
          type: 'inline',
          commentValue: 'First\nwith\nexisting\nnewlines\nSecond\nalso\nhas\nnewlines',
        },);
      },
    }),
  ],
},);
