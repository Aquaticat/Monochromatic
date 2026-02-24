/**
 * Intentionally triggers a stack overflow by recursing with a non-tail-call
 * pattern (the `+ 1` forces the frame to stay on the stack), producing
 * `RangeError: Maximum call stack size exceeded`.
 */
function recurse(): number {
  // Non-tail-call: the addition runs after the recursive call returns,
  // which prevents any tail-call optimization from flattening the stack.
  return recurse() + 1;
}

recurse();
