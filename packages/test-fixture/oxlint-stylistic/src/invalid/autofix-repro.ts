// Repro 1: argument-per-line on call with bracket in callee
// Expected bug: findDelimiter('open') finds `[` instead of `(`
const lines = ['a', 'b', 'c'];
const result = lines[0]?.slice(0, 2);

// Repro 2: destructure-per-line with type annotation containing braces
// Expected bug: findDelimiter('close') finds type annotation's `}` instead of pattern's `}`
type ServerSlots = { oxlint: null; tsgo: null; dprint: null };
function relevantClients(
  { languageId, oxlint, tsgo, dprint, }: { languageId: string; } & ServerSlots,
): void {}

// Repro 3: destructure-per-line with generic type annotation
// Expected bug: findDelimiter('close') finds `>` instead of `}`
type HOptions<T extends string> = { tag: T; text: string; html: string; attrs: Record<string, string> };
function h<const TTag extends string>(
  { tag, text, html, attrs, }: HOptions<TTag>,
): void {}

// Repro 4: argument-per-line on splice with 3+ args
const arr = [1, 2, 3];
arr.splice(0, 1, 99);

export { result, arr };
