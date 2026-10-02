//region Cap argument refusal
// THE REFUSAL SENTENCE A `--cap` FLAG DRAWS WHEN WHAT WAS TYPED IS NO WHOLE
// NUMBER WRITTEN IN DIGITS, shared by every command line reader that takes a
// `--cap` flag.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. The coverage-probe-args,
// judge-fidelity-args and rendering-audit-settled-args tests kept their own
// copy of this message; all now import it from here.

/**
 Refusal a cap draws when it is no whole number written in digits.

 @param cap - cap as typed

 @returns The refusal's sentence

 @example
 ```ts
 const said = capNotDigits({ cap: 'fourty', },);
 ```
 */
export function capNotDigits({ cap, }: { readonly cap: string; },): string {
  return `--cap needs a whole number written in digits, at most ${String(Number.MAX_SAFE_INTEGER,)}, `
    + `and ${JSON.stringify(cap,)} is not one`;
}

//endregion Cap argument refusal
