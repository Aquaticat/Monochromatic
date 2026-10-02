//region Structural ballot
// ONE JUDGE'S OR GATE VOICE'S SCHEMA-VALID REPLY BODY, naming only the
// choice: no finding supports or opposes it and nothing is dropped.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. Several consolidate and lane-contest
// tests kept their own copy of this builder; all now import it from here.

/**
 Builds one ballot body.

 @param choice - candidate this judge or gate voice names

 @returns Reply body a judge or gate voice would return

 @example
 ```ts
 const body = ballot({ choice: 'consolidated', },);
 ```
 */
export function ballot({ choice, }: { readonly choice: string; },): string {
  return JSON.stringify({
    choice,
    unsupported: [],
    dropped: [],
    reason: 'the original supports it',
  },);
}

//endregion Structural ballot
