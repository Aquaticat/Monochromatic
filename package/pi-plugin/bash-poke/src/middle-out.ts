/**
 Middle-out assembly of captured command output.

 @module
 */

import { ELISION_ELLIPSIS, } from './constants.ts';

//region Marker

/**
 Builds the elision marker naming how much was dropped.
 
 @param elidedChars - characters removed from the middle
 
 @returns marker line placed between the kept head and tail
 
 @example
 ```ts
 elisionMarker({ elidedChars: 42, },);
 ```
 */
function elisionMarker({ elidedChars, }: { readonly elidedChars: number; }, ): string {
  return `${ELISION_ELLIPSIS}[${String(elidedChars)} characters elided]${ELISION_ELLIPSIS}`;
}

//endregion Marker

//region Assembly

/**
 Joins a kept head and tail around an elision marker.
 
 A run's setup lives at the start and its failure or final result at the end, so
 both are kept and the repetitive middle is dropped. Callers supply the parts
 because output is recorded through bounded buffers rather than held whole.
 
 @param head - kept prefix
 
 @param tail - kept suffix
 
 @param elidedChars - characters removed between them
 
 @returns assembled text with the loss stated in place
 
 @example
 ```ts
 middleOutFromParts({ head: 'ab', tail: 'ij', elidedChars: 6, },);
 ```
 */
function middleOutFromParts(
  {
    head,
    tail,
    elidedChars,
  }: {
    readonly head: string;
    readonly tail: string;
    readonly elidedChars: number;
  },
): string {
  /**
   Marker-free segments, so a zero-length budget leaves no blank line behind.
   */
  const segments: string[] = [
    head,
    elisionMarker({ elidedChars, }, ),
    tail,
  ]
    .filter(function isPresent(segment: string, ): boolean {
      return segment.length > 0;
    }, );
  return segments.join('\n', );
}

//endregion Assembly

export {
  elisionMarker,
  middleOutFromParts,
};
