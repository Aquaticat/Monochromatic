/**
 * CLI parsing for the container-side entrypoint.
 *
 * @example
 * ```ts
 * parseInContainerArgs(['--package', 'packages/dev-script/file-enforcer', '--mutate', 'src/a.ts', '--report', '/out/a.json']);
 * ```
 */

/**
 * CLI options accepted by the container entrypoint.
 */
export type InContainerOptions = {
  readonly packagePath: string;
  readonly mutateFile: string;
  readonly reportFile: string;
  readonly dryRunOnly: boolean;
  readonly fullSuite: boolean;
};

/**
 * Parses boolean strings emitted by the host container argv builder.
 *
 * @param value - Raw string value.
 *
 * @returns Parsed boolean.
 *
 * @example
 * ```ts
 * parseBoolean('true');
 * // true
 * ```
 */
export function parseBoolean(value: string,): boolean {
  if (value === 'true')
    return true;

  if (value === 'false')
    return false;

  throw new Error(`Expected boolean string, received ${value}`,);
}

/**
 * Converts argv pairs into a key-value record.
 *
 * @param argv - Arguments after executable and script path.
 *
 * @returns Parsed key-value record without leading `--`.
 *
 * @example
 * ```ts
 * argvToRecord(['--package', 'pkg']);
 * // { package: 'pkg' }
 * ```
 */
function argvToRecord(argv: readonly string[],): Readonly<Record<string, string>> {
  const values: Record<string, string> = {};
  let cursor = 0;

  while (cursor < argv.length) {
    const key = argv[cursor];
    const value = argv[cursor + 1];

    if (key === undefined)
      break;

    if (!key.startsWith('--',))
      throw new Error(`Unexpected positional argument ${key}`,);

    if (value === undefined)
      throw new Error(`Missing value for ${key}`,);

    values[key.slice('--'.length,)] = value;
    cursor += 2;
  }

  return values;
}

/**
 * Reads required string option from parsed args.
 *
 * @param options - Parsed record and option name.
 *
 * @returns Required option value.
 *
 * @example
 * ```ts
 * requiredOption({ values: { package: 'pkg' }, name: 'package' });
 * // 'pkg'
 * ```
 */
function requiredOption(options: {
  readonly values: Readonly<Record<string, string>>;
  readonly name: string;
},): string {
  const value = options.values[options.name];

  if (value === undefined)
    throw new Error(`Missing --${options.name}`,);

  return value;
}

/**
 * Parses entrypoint arguments.
 *
 * @param argv - Arguments after executable and script path.
 *
 * @returns Parsed container options.
 *
 * @example
 * ```ts
 * parseInContainerArgs(['--package', 'pkg', '--mutate', 'src/a.ts', '--report', '/out/a.json']);
 * ```
 */
export function parseInContainerArgs(argv: readonly string[],): InContainerOptions {
  const values = argvToRecord(argv,);

  return {
    packagePath: requiredOption({ values, name: 'package', },),
    mutateFile: requiredOption({ values, name: 'mutate', },),
    reportFile: requiredOption({ values, name: 'report', },),
    dryRunOnly: parseBoolean(values['dry-run-only'] ?? 'false',),
    fullSuite: parseBoolean(values['full-suite'] ?? 'false',),
  };
}
