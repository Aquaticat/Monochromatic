import type {
  Comment,
  Doctype,
  Element,
  ElementContent,
  Root,
  Text,
} from 'hast';
import { select } from 'hast-util-select';
import { toString as hastToString } from 'hast-util-to-string';
import { mapParallelAsync } from 'rambdax';
import {
  type BundledTheme,
  codeToHast,
  type StringLiteralUnion,
  type ThemeRegistrationAny,
} from 'shiki';

/*
Doesn't mutate the original tree, returns a modified instance.
 */
export default async function hastShiki(tree: Root): Promise<Root> {
  const theme = {
    light: select(`meta[name='theme-shiki']`, tree)?.properties.content as string || 'github-light',
    dark: select(`meta[name='theme-shiki-dark']`, tree)?.properties.content as string || 'github-dark',
  } as ThemeRegistrationAny | StringLiteralUnion<BundledTheme, string>;

  return {
    ...tree,
    children: await mapParallelAsync(
      async function findHighlight(node: Comment | Doctype | Element | Text): Promise<ElementContent> {
        if (node.type === 'element' && node.tagName === 'pre') {
          const preNode = node as Element;
          const codeNode = preNode.children.find((potentialCode) =>
            potentialCode.type === 'element' && potentialCode.tagName === 'code'
          ) as Element | undefined;

          if (!codeNode) {
            return node;
          }

          const classList = codeNode.properties.className;

          const codeLang = Array.isArray(classList)
            ? ((classList.find((codeClass) => typeof codeClass === 'string' && codeClass.startsWith('language-')) as
              | 'string'
              | undefined) || 'language-ansi')
              .slice('language-'.length)
            : 'ansi';

          return {
            ...preNode,
            children: ((await codeToHast(hastToString(codeNode), {
              theme,
              lang: codeLang,
              transformers: [
                {
                  code(node) {
                    node.properties['data-code-lang'] = codeLang;
                  },
                },
              ],
            }))
              .children[0]! as Element)
              .children as ElementContent[],
          };
        }
        if (Object.hasOwn(node, 'children')) {
          const nonCommentNode = node as Element;
          return { ...nonCommentNode, children: await mapParallelAsync(findHighlight, nonCommentNode.children) };
        }
        return node as ElementContent;
      },
      tree.children,
    ),
  };
}
