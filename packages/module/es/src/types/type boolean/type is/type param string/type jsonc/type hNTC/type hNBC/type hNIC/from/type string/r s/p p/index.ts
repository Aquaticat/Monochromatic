import type { $ as hasNoTrailingCommas} from '@_/types/type string/type jsonc/type hasNoTrailingCommas/type/index.ts';
import type { $ as hasNoBlockComments} from '@_/types/type string/type jsonc/type hasNoBlockComments/type/index.ts';
import type { $ as hasNoInlineComments} from '@_/types/type string/type jsonc/type hasNoInlineComments/type/index.ts';

export function $(value: string): value is hasNoTrailingCommas & hasNoBlockComments & hasNoInlineComments {
  try {
    JSON.parse(value, function alwaysNull() {return null;})
    return true;
  } catch {
    return false;
  }
}
