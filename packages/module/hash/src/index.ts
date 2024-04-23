import { build } from 'esbuild';
export default async function<T_a extends [string, ...string[]],>(input: T_a): Promise<T_a>;
export default async function(input: string, isStdin?: boolean): Promise<string>;
export default async function<T_a extends [string, ...string[]],>(
  input: T_a | string,
  isStdin = false,
): Promise<string | T_a> {
  if (isStdin) {
    if (typeof input !== 'string') {
      throw new TypeError('Only accepts string when reading from parameter verbatim.');
    }

    return (
      await build({
        stdin: {
          contents: input,
          loader: 'file',
        },
        write: false,
      })
    )
      .outputFiles
      .map((out) => out.hash) as T_a;
  }

  if (typeof input === 'string') {
    return (await build({ entryPoints: [input], write: false, loader: { '*': 'file' } })).outputFiles[0]!.hash;
  }
  return (await build({ entryPoints: input, write: false, loader: { '*': 'file' } })).outputFiles.map(
    (out) => out.hash,
  ) as T_a;
}
