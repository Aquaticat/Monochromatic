import { expect, } from '@monochromatic-dev/module-test/ts';

//region Scan findings
// How a scan over the package's own files fails: with every finding it made,
// one per line. The assertion library's message cuts a list it cannot show in
// a few dozen characters down to its length (`expected [ …(31) ] to deeply
// equal []`), so a reader of a failing scan had to run the scan's walk again
// in a probe to learn what it found.

/**
 Asserts a scan over the package found nothing, failing with each finding on
 a line of its own.

 @param findings - what the scan found, each naming its own place, so the
 failure reads whole without the scan

 @throws Error listing every finding, when there is any

 @example
 ```ts
 expectNoFindings({ findings: ['cat.ts:4'], },);
 // throws: the scan found these, one per line:
 // cat.ts:4
 ```
 */
export function expectNoFindings({ findings, }: { readonly findings: readonly string[]; },): void {
  if (findings.length > 0)
    throw new Error([
      'the scan found these, one per line:',
      ...findings,
    ].join('\n',),);
  expect(findings,)
    .toEqual([],);
}

//endregion Scan findings
