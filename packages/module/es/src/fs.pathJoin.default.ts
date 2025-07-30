import { trimPathTrailingSlash, } from './fs.pathJoin.shared.ts';
import { trimIterable, } from './iterable.trim.ts';

const DOT_DOT_PATTERN = /(?<=^|\/)(?!\.\.)[^\/\n]+?\/\.\.(?=$|\/)/vg;
const DUPLICATE_SLASH_PATTERN = /\/{2,}/vg;
const DOT_SLASH_PATTERN = /(?<=^|\/)\.\//vg;

const resolveParentReferences = (path: string, isAbsolute: boolean,): string => {
  let current = path;
  let previous: string | null = null;

  do {
    previous = current;
    current = current
      .replaceAll(DOT_DOT_PATTERN, '',)
      .replaceAll(DUPLICATE_SLASH_PATTERN, '/',);

    if (current === '')
      return '.';

    // Preserve original path style (absolute vs relative)
    if (current.startsWith('/',) && !isAbsolute)
      current = current.slice(1,);
  }
  while (current !== previous);

  return trimPathTrailingSlash(current,);
};

export function pathJoin(...segments: string[]): string {
  const trimmedSegments = trimIterable(segments,);
  if (trimmedSegments.length === 0)
    return '.';

  // Join segments and capture if original path was absolute
  const joinedPath = trimmedSegments.join('/',);
  const isAbsolute = joinedPath.startsWith('/',);

  // First normalization phase
  const normalized = joinedPath
    .replaceAll(DUPLICATE_SLASH_PATTERN, '/',)
    .replaceAll(DOT_SLASH_PATTERN, '',);

  /* v8 ignore next -- @preserve */
  if (normalized === '')
    return '.';

  // Resolve parent directory references
  return resolveParentReferences(normalized, isAbsolute,);
}
