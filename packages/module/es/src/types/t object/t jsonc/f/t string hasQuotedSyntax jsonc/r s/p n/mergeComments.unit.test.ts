import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

const $ = types.object.jsonc.from.stringHasQuotedSyntaxJsonc.sync.named.mergeComments;

describe($, () => {
  test('both undefined returns undefined', ({ expect, },) => {
    expect($({},),).toBeUndefined();
  });

  test('only first comment defined returns first comment', ({ expect, },) => {
    const comment = { type: 'inline' as const, commentValue: 'First comment' };
    const result = $({ value: comment, },);
    expect(result,).toEqual(comment);
  });

  test('only second comment defined returns second comment', ({ expect, },) => {
    const comment = { type: 'block' as const, commentValue: 'Second comment' };
    const result = $({ value2: comment, },);
    expect(result,).toEqual(comment);
  });

  test('both inline comments merge to inline type', ({ expect, },) => {
    const first = { type: 'inline' as const, commentValue: 'First inline' };
    const second = { type: 'inline' as const, commentValue: 'Second inline' };
    const result = $({ value: first, value2: second, },);

    expect(result,).toEqual({
      type: 'inline',
      commentValue: 'First inline\nSecond inline',
    });
  });

  test('both block comments merge to block type', ({ expect, },) => {
    const first = { type: 'block' as const, commentValue: 'First block' };
    const second = { type: 'block' as const, commentValue: 'Second block' };
    const result = $({ value: first, value2: second, },);

    expect(result,).toEqual({
      type: 'block',
      commentValue: 'First block\nSecond block',
    });
  });

  test('inline + block comments merge to mixed type', ({ expect, },) => {
    const first = { type: 'inline' as const, commentValue: 'Inline comment' };
    const second = { type: 'block' as const, commentValue: 'Block comment' };
    const result = $({ value: first, value2: second, },);

    expect(result,).toEqual({
      type: 'mixed',
      commentValue: 'Inline comment\nBlock comment',
    });
  });

  test('block + inline comments merge to mixed type', ({ expect, },) => {
    const first = { type: 'block' as const, commentValue: 'Block comment' };
    const second = { type: 'inline' as const, commentValue: 'Inline comment' };
    const result = $({ value: first, value2: second, },);

    expect(result,).toEqual({
      type: 'mixed',
      commentValue: 'Block comment\nInline comment',
    });
  });

  test('preserves whitespace in comment values', ({ expect, },) => {
    const first = { type: 'inline' as const, commentValue: '  Comment with leading space  ' };
    const second = { type: 'inline' as const, commentValue: '  Comment with Trailing space  ' };
    const result = $({ value: first, value2: second, },);

    expect(result,).toEqual({
      type: 'inline',
      commentValue: '  Comment with leading space  \n  Comment with Trailing space  ',
    });
  });

  test('handles empty comment values', ({ expect, },) => {
    const first = { type: 'inline' as const, commentValue: '' };
    const second = { type: 'inline' as const, commentValue: 'Non-empty comment' };
    const result = $({ value: first, value2: second, },);

    expect(result,).toEqual({
      type: 'inline',
      commentValue: '\nNon-empty comment',
    });
  });

  test('handles multiline comments', ({ expect, },) => {
    const first = { type: 'block' as const, commentValue: 'Line 1\nLine 2' };
    const second = { type: 'block' as const, commentValue: 'Line 3\nLine 4' };
    const result = $({ value: first, value2: second, },);

    expect(result,).toEqual({
      type: 'block',
      commentValue: 'Line 1\nLine 2\nLine 3\nLine 4',
    });
  });

  test('preserves comment-like delimiters in values', ({ expect, },) => {
    const first = { type: 'inline' as const, commentValue: '// This is region marker' };
    const second = { type: 'block' as const, commentValue: '/* This has block markers */' };
    const result = $({ value: first, value2: second, },);

    expect(result,).toEqual({
      type: 'mixed',
      commentValue: '// This is region marker\n/* This has block markers */',
    });
  });

  test('handles special characters and unicode', ({ expect, },) => {
    const first = { type: 'inline' as const, commentValue: 'Comment with émojis 🚀 and sp€ci@l chars' };
    const second = { type: 'inline' as const, commentValue: '另一个评论' };
    const result = $({ value: first, value2: second, },);

    expect(result,).toEqual({
      type: 'inline',
      commentValue: 'Comment with émojis 🚀 and sp€ci@l chars\n另一个评论',
    });
  });

  test('handles very long comment values', ({ expect, },) => {
    const longComment = 'A'.repeat(1000);
    const first = { type: 'inline' as const, commentValue: longComment };
    const second = { type: 'inline' as const, commentValue: 'B'.repeat(1000) };
    const result = $({ value: first, value2: second, },);

    expect(result,).toEqual({
      type: 'inline',
      commentValue: `${longComment}\n${'B'.repeat(1000)}`,
    });
  });

  test('when first is undefined, returns second comment unchanged', ({ expect, },) => {
    const second = { type: 'inline' as const, commentValue: 'Only second comment' };
    const result = $({ value: undefined, value2: second, },);

    expect(result,).toEqual(second);
  });

  test('when second is undefined, returns first comment unchanged', ({ expect, },) => {
    const first = { type: 'block' as const, commentValue: 'Only first comment' };
    const result = $({ value: first, value2: undefined, },);

    expect(result,).toEqual(first);
  });

  test('mixed type comment (already mixed) preserves type when merging with inline', ({ expect, },) => {
    const first = { type: 'mixed' as const, commentValue: 'Already mixed' };
    const second = { type: 'inline' as const, commentValue: 'Adding inline' };
    const result = $({ value: first, value2: second, },);

    expect(result,).toEqual({
      type: 'mixed',
      commentValue: 'Already mixed\nAdding inline',
    });
  });

  test('mixed type comment (already mixed) preserves type when merging with block', ({ expect, },) => {
    const first = { type: 'mixed' as const, commentValue: 'Already mixed' };
    const second = { type: 'block' as const, commentValue: 'Adding block' };
    const result = $({ value: first, value2: second, },);

    expect(result,).toEqual({
      type: 'mixed',
      commentValue: 'Already mixed\nAdding block',
    });
  });

  test('handles comments with existing newlines properly', ({ expect, },) => {
    const first = { type: 'inline' as const, commentValue: 'First\nwith\nexisting\nnewlines' };
    const second = { type: 'inline' as const, commentValue: 'Second\nalso\nhas\nnewlines' };
    const result = $({ value: first, value2: second, },);

    expect(result,).toEqual({
      type: 'inline',
      commentValue: 'First\nwith\nexisting\nnewlines\nSecond\nalso\nhas\nnewlines',
    });
  });
},);
