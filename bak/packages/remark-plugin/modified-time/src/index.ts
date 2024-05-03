import { statSync } from 'node:fs';

export default function remarkModifiedTime() {
  return (_tree, file) => {
    const filepath = file.history[0];
    const result = statSync(filepath);
    file.data.astro.frontmatter.updated = result.mtime.toISOString();
  };
}
