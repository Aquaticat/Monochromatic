/**
 Retain the original numeric and missing-value checks for already admitted JSON-like tool inputs. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { JudgmentConstructionError } from './judgment-error.ts';

/**
 Admission diagnostics omit original tool input content.
 */
const l = tagged({ tag: 'auto-mode-judgment-json-input' });

//region Native JSON traversal retains the original serializer callbacks and failure behavior.
/**
 Reject admitted JSON-like values whose missing or numeric meaning ordinary JSON would silently change.
 This boundary retains native serialization and does not replace earlier structural input admission.

 @param input - original native tool input already admitted by its structural owner

 @throws JudgmentConstructionError for undefined, nonfinite numeric, or negative-zero values reached by JSON traversal

 @throws TypeError when native JSON serialization rejects a cyclic or unsupported value

 @example requireJSONInput({ path: 'original.txt' });
 */
export function requireJSONInput(input: unknown): void {
  /**
   Every admission attempt retains a function-specific diagnostic scope.
   */
  const sl = tagged({ tag: requireJSONInput.name, l });
  sl.debug('checking original native JSON value preservation');
  JSON.stringify(input, function validateNativeJSONValue(_key: string, value: unknown): unknown {
    if ((value === undefined) || (((typeof value) === 'number')
      && ((!Number.isFinite(value)) || Object.is(value, -0)))) throw new JudgmentConstructionError('Native tool input contains a value not preserved by the declared JSON profile');
    return value;
  });
}
//endregion
