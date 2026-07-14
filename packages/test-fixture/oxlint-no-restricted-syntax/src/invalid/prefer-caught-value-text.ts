// Fixture: package-local caught-value formatters duplicate shared behavior.

/** Duplicate conditional formatter. */
function conditionalFormatter(error: unknown,): string {
  return Error.isError(error,)
    ? error.message
    : String(error,);
}

/** Duplicate branching formatter. */
function branchingFormatter(error: unknown,): string {
  if (Error.isError(error,))
    return error.stack ?? error.message;
  return `non-Error ${typeof error}`;
}

conditionalFormatter('failure',);
branchingFormatter('failure',);
