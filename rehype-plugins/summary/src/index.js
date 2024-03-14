import { readFileSync } from 'node:fs';
import { convert } from 'html-to-text';

export default function rehypeSummary() {
  return (tree, file) => {
    const filepath = file.history[0];
    const result = readFileSync(filepath, { encoding: 'utf8' });
    file.data.astro.frontmatter.summary = convert(result, {
      limits: { maxBaseElements: 16, maxChildNodes: 16, maxDepth: 16, ellipsis: '' },
      wordwrap: false,
    })
      .replaceAll('\n', ' ')
      .replace(/--- .+? ---/, '')
      .slice(0, 512);
  };
}
