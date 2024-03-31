import { readFileSync } from 'node:fs';
import { convert } from 'html-to-text';

export default function rehypeContent() {
  return (tree, file) => {
    const filepath = file.history[0];
    const result = readFileSync(filepath, { encoding: 'utf8' });
    file.data.astro.frontmatter.summary = convert(result, {
      limits: { maxBaseElements: 256, maxChildNodes: 256, maxDepth: 256, ellipsis: '' },
      wordwrap: false,
    }).replace(/---(?:.|\n)+?---/m, '');
  };
}
