import type {
  $ as hasNoBlockComments,
} from '@/src/types/type string/type hasQuotedSyntax/type doubleQuote/type jsonc/type hNBC/type';
import type {
  $ as hasNoInlineComments,
} from '@/src/types/type string/type hasQuotedSyntax/type doubleQuote/type jsonc/type hNIC/type';
import type {
  $ as hasNoTrailingCommas,
} from '@/src/types/type string/type hasQuotedSyntax/type doubleQuote/type jsonc/type hNTC/type';

export function $(
  value: string,
): value is hasNoTrailingCommas & hasNoBlockComments & hasNoInlineComments {
  try {
    JSON.parse(value, function alwaysNull() {
      return null;
    },);
    return true;
  }
  catch {
    return false;
  }
}
