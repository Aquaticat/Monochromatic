/**
 * TSDoc access modifier validation rule.
 *
 * @module
 */

import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { createTsdocVisitor, } from './tsdoc-visitors.ts';

/**
 * Validates access modifier tags in TSDoc comments.
 *
 * Reports conflicting access modifiers (e.g., public and internal together).
 */
export const checkAccess: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Validate TSDoc access modifier tags.',
      recommended: true,
    },
    messages: {
      conflict: 'Conflicting access modifiers: {{tags}}. Use only one.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /** Access-level tags that are mutually exclusive. */
    const accessTags = [
      '@public',
      '@internal',
      '@alpha',
      '@beta',
      '@experimental',
    ];

    return createTsdocVisitor(
      context,
      function checkAccessHandler(
        _node,
        comment,
      ): void {
        const found: string[] = [];
        const text = comment.value;
        accessTags.forEach(function findTag(tag,): void {
          // Match tag at word boundary to avoid false positives
          const escapedTag = tag.replace(
            '@',
            String.raw`\@`,
          );
          const pattern = new RegExp(
            String.raw`(?:^|\s)${escapedTag}(?:\s|$|\*)`,
          );
          if (pattern.test(text,))
            found.push(tag,);
        },);

        if (found.length > 1) {
          context.report({
            node: comment,
            messageId: 'conflict',
            data: { tags: found.join(', ',), },
          },);
        }
      },
    );
  },
};

export { checkTagNames, } from './tag-names.ts';

export {
  noTypes,
  validTypes,
} from './tag-types.ts';
