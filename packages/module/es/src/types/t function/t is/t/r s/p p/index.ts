/**
 * Sync type guard predicate function type.
 */
export type $<Input = unknown, Type extends Input = Input,> = (
  input: Input,
) => input is Type;
