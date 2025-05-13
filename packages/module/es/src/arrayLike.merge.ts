/**
 @deprecated Use jsr:@rebeccastevens/deepmerge instead. I can never match its quality.

 @remarks

 See https://stackoverflow.com/questions/171251/how-can-i-merge-properties-of-two-javascript-objects

 Because { ...obj1, ...obj2 } is not a deep merge.
 Because
 mergeConfig(
 createBaseConfig(configDir),
 vitestOnlyConfigWorkspace,
 );
 is elegant but
 const createBackendConfig = (configDir: string): UserConfig => {
 const base = createBaseConfig(configDir);
 return {
 ...base,
 esbuild: {
 ...base.esbuild,
 supported: {
 'dynamic-import': false,
 'object-rest-spread': false,
 'top-level-await': false,
 },
 },
 build: {
 ...base.build,
 target: 'es2019',
 outDir: 'dist/final/backend',
 lib: {
 entry: resolve(configDir, 'src/backend/index.ts'),
 name: 'index',
 fileName: 'index',
 formats: ['iife'],
 },
 rollupOptions: {
 output: {
 inlineDynamicImports: true,
 },
 },
 },
 };
 };
 is ugly.

 Because mergeConfig is imported from Vite and not a general purpose utility.

 Because mergeConfig only supports UnknownRecord and not Arrays or Maps or whatever arrayLikes.
 */

/*
export function mergeArrayLike<T_arrayLike extends Iterable<any>,>(
  ...arrayLikes: T_arrayLike[]
): T_arrayLike extends Iterable<infer T_element> ? T_element[] : never {
  const merged: unknown[] = [];
  for (const arrayLike of arrayLikes) {
    for (const element of arrayLike) {
      merged.push(element);
    }
  }
  return merged as T_arrayLike extends Iterable<infer T_element> ? T_element[]
    : never;
}
*/

export {};
