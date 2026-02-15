import type { ParsedPath, } from 'node:path';

export function pathParse(path: string,): ParsedPath {
  // Handle empty path
  if (!path)
    return { root: '', dir: '', base: '', ext: '', name: '', };

  // Determine root
  const isAbsolute = path.startsWith('/',);
  const root = isAbsolute ? '/' : '';

  // Split path into segments
  const parts = path.split('/',);
  const basePart = parts.pop() || '';

  // Handle trailing slash case
  const dir = parts.length === 0
    ? (isAbsolute ? '/' : '')
    : (isAbsolute ? '/' + parts.join('/',) : parts.join('/',));

  // Determine base, extension and name
  const lastDotIndex = basePart.lastIndexOf('.',);
  const hasExt = lastDotIndex > 0; // Ignore if dot is first character

  const base = basePart || '';
  const ext = hasExt ? basePart.slice(lastDotIndex,) : '';
  const name = hasExt ? basePart.slice(0, lastDotIndex,) : basePart;

  return { root, dir, base, ext, name, };
}
