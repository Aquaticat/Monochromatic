import type {
  $ as hasNoBlockComments,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t hNBC/t/index.ts';
import type {
  $ as hasNoInlineComments,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t hNIC/t/index.ts';
import type {
  $ as hasNoTrailingCommas,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t hNTC/t/index.ts';

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
