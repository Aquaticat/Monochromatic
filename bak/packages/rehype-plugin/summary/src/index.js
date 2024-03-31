import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';

const document = new Window().document;

export default function rehypeSummary() {
  return (tree, file) => {
    const filepath = file.history[0];
    document.documentElement.innerHTML = readFileSync(filepath, { encoding: 'utf8' });
    file.data.astro.frontmatter.summary = document
      .querySelector('.Article')
      .textContent.replaceAll('\n', ' ')
      .replace(/--- .+? ---/, '')
      .slice(0, 512);
  };
}
