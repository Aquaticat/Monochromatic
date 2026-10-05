/**
 The refusal the lookup cache and the reference cache raise over a cache path
 that is there and cannot be read, as `String` renders it.

 TEST SUPPORT, NOT PACKAGE SOURCE. Both caches read through one reader
 (`cacheFileText` in `lookup-cache.ts`), so both test files pin the same
 words, and two copies of one body fail `duplicate-bodies.unit.test.ts`.

 @module
 */

/**
 What `String` gives for the refusal of a cache path holding a directory,
 the one unreadable state a case can build without changing a file's owner.

 @param path - cache path the refusal names

 @returns Class name and whole message

 @example
 ```ts
 expect(String(refusal,),).toBe(directoryRefusalText({ path, },),);
 ```
 */
export function directoryRefusalText({ path, }: { readonly path: string; },): string {
  return `CacheFileUnreadableError: cache file is there and could not be read (EISDIR): ${path}`;
}
