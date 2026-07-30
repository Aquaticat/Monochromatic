import { readFile, } from 'node:fs/promises';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { expandAllowedFromFiles, } from './config-expand.ts';
import {
  parseAllowedFromFiles,
  parsePositiveInt,
} from './config-parse-values.ts';
import { ConfigError, } from './errors.ts';
import { trimLinear, } from './text.ts';

/**
 * Module logger for config parsing.
 */
const l = tagged({ tag: 'config', },);

/**
 * Extension stripped from a config file basename to derive an interface name.
 */
const CONF_EXTENSION = '.conf';

/**
 * Directory wg-quick resolves bare interface names against.
 */
const CONFIG_DIR = '/etc/wireguard';

/**
 * Paths to the allowed and disallowed address-set files driving an expansion.
 */
export type AllowedFromFiles = {
  /**
   * File of allowed prefixes, domains, or ASNs.
   */
  readonly allowed: string;

  /**
   * File of disallowed prefixes, domains, or ASNs subtracted from the allowed set.
   */
  readonly disallowed: string;
};

/**
 * Parsed view of one WireGuard config file, mirroring the subset of `wg-quick`
 * behavior needed to bring an interface up without ever running bash pattern
 * matching against a large `AllowedIPs` value.
 */
export type WireguardConfig = {
  /**
   * Interface name derived from the config file name.
   */
  readonly interfaceName: string;

  /**
   * `Address` values from `[Interface]`, split on commas.
   */
  readonly addresses: readonly string[];

  /**
   * `DNS` values that are IP addresses, split on commas.
   */
  readonly dns: readonly string[];

  /**
   * `DNS` values that are search domains rather than IP addresses.
   */
  readonly dnsSearch: readonly string[];

  /**
   * Explicit `MTU`, when present.
   */
  readonly mtu?: number;

  /**
   * `Table` value: `off`, a numeric table, or absent (wg-quick `auto`).
   */
  readonly table?: string;

  /**
   * `ExemptMark` value: socket mark whose traffic bypasses the tunnel, when present.
   */
  readonly exemptMark?: number;

  /**
   * Allowed-ips source files expanded into an `AllowedIPs` line, when present.
   */
  readonly allowedFromFiles?: AllowedFromFiles;

  /**
   * `PreUp` hook commands in declaration order.
   */
  readonly preUp: readonly string[];

  /**
   * `PostUp` hook commands in declaration order.
   */
  readonly postUp: readonly string[];

  /**
   * `PreDown` hook commands in declaration order.
   */
  readonly preDown: readonly string[];

  /**
   * `PostDown` hook commands in declaration order.
   */
  readonly postDown: readonly string[];

  /**
   * Reconstructed config passed verbatim to `wg addconf`, including the
   * `[Interface]` header and `PrivateKey` plus every `[Peer]` line.
   */
  readonly wgConfig: string;
};

/**
 * Strips an inline `#` comment and trims, without regex, so a giant value stays cheap.
 *
 * @param line - Raw config line.
 *
 * @returns Content before the first `#`, whitespace-trimmed.
 *
 * @example
 * ```ts
 * stripComment({ line: 'Address = 10.0.0.1/32 # tunnel' });
 * ```
 */
function stripComment({ line, }: { readonly line: string; },): string {
  /**
   * Index of the first comment introducer, or end-of-line when absent.
   */
  const hash = line.indexOf('#',);
  return trimLinear({ value: hash === (-1) ? line : line.slice(
    0,
    hash,
  ), },);
}

/**
 * Splits one `key = value` line at its first `=`, trimming both sides linearly.
 *
 * @param stripped - Comment-stripped config line.
 *
 * @returns Trimmed key and trimmed value.
 *
 * @example
 * ```ts
 * splitKeyValue({ stripped: 'Address = 10.0.0.1/32' });
 * ```
 */
function splitKeyValue(
  { stripped, }: { readonly stripped: string; },
): {
  readonly key: string;
  readonly value: string
} {
  /**
   * Index of the first key/value separator.
   */
  const equals = stripped.indexOf('=',);
  if (equals === (-1)) {
    return {
      key: stripped,
      value: '',
    };
  }
  return {
    key: trimLinear({ value: stripped.slice(
      0,
      equals,
    ), },),
    value: trimLinear({ value: stripped.slice(equals + 1,), },),
  };
}

/**
 * Reports the lowercased section name when a trimmed line is a section header.
 *
 * @param stripped - Comment-stripped, whitespace-trimmed config line.
 *
 * @returns Lowercased section name, or an empty string when not a header.
 *
 * @example
 * ```ts
 * sectionName({ stripped: '[Interface]' });
 * ```
 */
function sectionName({ stripped, }: { readonly stripped: string; },): string {
  if ((!stripped.startsWith('[',)) || (!stripped.endsWith(']',)))
    return '';
  return trimLinear({ value: stripped.slice(
    1,
    -1,
  ), },)
    .toLowerCase();
}

/**
 * Reports whether a DNS token is an IP literal rather than a search domain.
 *
 * @param token - One comma-separated DNS token.
 *
 * @returns True when token is all digits/dots (v4) or contains a colon (v6).
 *
 * @example
 * ```ts
 * isIpLiteral({ token: '198.245.51.147' });
 * ```
 */
function isIpLiteral({ token, }: { readonly token: string; },): boolean {
  if (token.includes(':',))
    return true;
  // oxlint-disable-next-line no-restricted-syntax/no-regex -- Anchored v4-literal test on one short comma-separated DNS token; no repetition over the 91KB AllowedIPs value, no backtracking.
  return /^[0-9.]+$/u.test(token,);
}

/**
 * Mutable state gathered while walking config lines.
 */
type ParseAcc = {
  /**
   * Accumulated `Address` values.
   */
  addresses: string[];

  /**
   * Accumulated DNS server literals.
   */
  dns: string[];

  /**
   * Accumulated DNS search domains.
   */
  dnsSearch: string[];

  /**
   * Accumulated explicit MTU.
   */
  mtu?: number;

  /**
   * Accumulated `Table` value.
   */
  table?: string;

  /**
   * Accumulated `ExemptMark` value.
   */
  exemptMark?: number;

  /**
   * Accumulated `AllowedIPsFromFiles` value.
   */
  allowedFromFiles?: AllowedFromFiles;

  /**
   * Accumulated `PreUp` hooks.
   */
  preUp: string[];

  /**
   * Accumulated `PostUp` hooks.
   */
  postUp: string[];

  /**
   * Accumulated `PreDown` hooks.
   */
  preDown: string[];

  /**
   * Accumulated `PostDown` hooks.
   */
  postDown: string[];

  /**
   * Raw lines forwarded to `wg addconf`.
   */
  wgLines: string[];

  /**
   * Whether the cursor is inside the `[Interface]` section.
   */
  inInterface: boolean;
};

/**
 * Routes one `[Interface]` key/value pair into the accumulator.
 *
 * @param acc - Accumulator being built.
 *
 * @param key - Trimmed lowercased key.
 *
 * @param value - Trimmed value.
 *
 * @param unstripped - Value before comment-stripping, used by hooks.
 *
 * @returns True when the key was consumed as an interface setting.
 *
 * @example
 * ```ts
 * consumeInterfaceKey({ acc, key: 'dns', value: '1.1.1.1', unstripped: '1.1.1.1' });
 * ```
 */
function consumeInterfaceKey(
  {
    acc,
    key,
    value,
    unstripped,
  }: {
    readonly acc: ParseAcc;
    readonly key: string;
    readonly value: string;
    readonly unstripped: string;
  },
): boolean {
  if (key === 'address') {
    for (const part of value.split(',',)) {
      /**
       * One whitespace-trimmed comma-separated address token.
       */
      const token = trimLinear({ value: part, },);
      if (token !== '')
        acc.addresses
          .push(token,);
    }
    return true;
  }
  if (key === 'dns') {
    for (const part of value.split(',',)) {
      /**
       * One whitespace-trimmed comma-separated DNS token.
       */
      const token = trimLinear({ value: part, },);
      if (token === '')
        continue;
      if (isIpLiteral({ token, },))
        acc.dns
          .push(token,);
      else
        acc.dnsSearch
          .push(token,);
    }
    return true;
  }
  if (key === 'table') {
    acc.table = value;
    return true;
  }
  if (key === 'exemptmark') {
    acc.exemptMark = parsePositiveInt({
      key,
      value,
    },);
    return true;
  }
  if (key === 'allowedipsfromfiles') {
    acc.allowedFromFiles = parseAllowedFromFiles({ value, },);
    return true;
  }
  if (key === 'preup') {
    acc.preUp
      .push(unstripped,);
    return true;
  }
  if (key === 'postup') {
    acc.postUp
      .push(unstripped,);
    return true;
  }
  if (key === 'predown') {
    acc.preDown
      .push(unstripped,);
    return true;
  }
  if (key === 'postdown') {
    acc.postDown
      .push(unstripped,);
    return true;
  }
  return false;
}

/**
 * Processes a single raw config line into the accumulator.
 *
 * @param acc - Accumulator being built.
 *
 * @param rawLine - One unmodified config line.
 *
 * @example
 * ```ts
 * processLine({ acc, rawLine: 'Address = 10.0.0.1/32' });
 * ```
 */
function processLine(
  {
    acc,
    rawLine,
  }: {
    readonly acc: ParseAcc;
    readonly rawLine: string;
  },
): void {
  /**
   * Comment-stripped, whitespace-trimmed view of the line.
   */
  const stripped = stripComment({ line: rawLine, },);
  /**
   * Lowercased section name when the line opens a section.
   */
  const section = sectionName({ stripped, },);
  if (section !== '') {
    acc.inInterface = section === 'interface';
    // The [Interface] header must reach wg addconf so PrivateKey stays valid.
    acc.wgLines
      .push(rawLine,);
    return;
  }
  if (stripped === '') {
    acc.wgLines
      .push(rawLine,);
    return;
  }
  /**
   * Trimmed key and value split from the comment-stripped line.
   */
  const {
    key,
    value,
  } = splitKeyValue({ stripped, },);
  if (acc.inInterface) {
    /**
     * Index of the first key/value separator in the raw line.
     */
    const equals = rawLine.indexOf('=',);
    /**
     * Value text before comment-stripping, preserving hook commands.
     */
    const unstripped = trimLinear({ value: rawLine.slice(equals + 1,), },);
    /**
     * Lowercased key for case-insensitive matching.
     */
    const lower = key.toLowerCase();
    if (lower === 'mtu') {
      // MTU is consumed for `ip link set` and not forwarded to wg, which rejects it.
      acc.mtu = parsePositiveInt({
        key,
        value,
      },);
      return;
    }
    if (consumeInterfaceKey({
      acc,
      key: lower,
      value,
      unstripped,
    },))
      return;
  }
  acc.wgLines
    .push(rawLine,);
}


/**
 * Parses config text into the interface settings wg-quicker consumes and the raw
 * peer block passed to `wg addconf`.
 *
 * Only `[Interface]` routing/DNS/hook keys are interpreted; `PrivateKey`, the
 * `[Interface]` header, and every other line are forwarded verbatim, so a very
 * large `AllowedIPs` value is stored but never pattern-matched.
 *
 * @param interfaceName - Interface name used for logging context.
 *
 * @param text - Full config file text.
 *
 * @returns Parsed interface settings plus raw peer config.
 *
 * @example
 * ```ts
 * parseConfigText({ interfaceName: 'wg0', text: '[Interface]\nPrivateKey = k\nAddress = 10.0.0.1/32\n' });
 * ```
 */
export function parseConfigText(
  {
    interfaceName,
    text,
  }: {
    readonly interfaceName: string;
    readonly text: string;
  },
): WireguardConfig {
  /**
   * Function-scoped logger for the parse.
   */
  const fl = tagged({
    tag: parseConfigText.name,
    l,
  },);
  /**
   * Accumulator built by the line walk, contained so no root-level `let` leaks.
   */
  const acc: ParseAcc = {
    addresses: [],
    dns: [],
    dnsSearch: [],
    preUp: [],
    postUp: [],
    preDown: [],
    postDown: [],
    wgLines: [],
    inInterface: false,
  };
  for (const rawLine of text.split('\n',))
    processLine({
      acc,
      rawLine,
    },);
  fl.debug(
    `parsed ${String(acc.addresses
      .length,)} address(es), ${String(acc.dns
        .length,)} dns, `
      + `${String(acc.wgLines
        .length,)} forwarded line(s) for ${interfaceName}`,
  );
  return {
    interfaceName,
    addresses: acc.addresses,
    dns: acc.dns,
    dnsSearch: acc.dnsSearch,
    ...(acc.mtu === undefined ? {} : { mtu: acc.mtu, }),
    ...(acc.table === undefined ? {} : { table: acc.table, }),
    ...(acc.exemptMark === undefined ? {} : { exemptMark: acc.exemptMark, }),
    ...(acc.allowedFromFiles === undefined ? {} : { allowedFromFiles: acc.allowedFromFiles, }),
    preUp: acc.preUp,
    postUp: acc.postUp,
    preDown: acc.preDown,
    postDown: acc.postDown,
    wgConfig: `${acc.wgLines
      .join('\n',)}\n`,
  };
}

/**
 * Resolves a config argument (interface name or path) to a parsed config.
 *
 * Mirrors wg-quick: a bare name resolves under `/etc/wireguard/<name>.conf`.
 *
 * @param arg - Interface name or explicit config path.
 *
 * @returns Parsed config.
 *
 * @throws {@link ConfigError} when the resolved file does not exist or cannot be read.
 *
 * @example
 * ```ts
 * await loadConfig({ arg: 'mx-que-mx1' });
 * ```
 */
export async function loadConfig(
  { arg, }: { readonly arg: string; },
): Promise<WireguardConfig> {
  /**
   * Whether the argument already names a concrete file path.
   */
  const isPath = arg.endsWith(CONF_EXTENSION,) || arg.includes('/',);
  /**
   * Absolute config file path.
   */
  const path = isPath ? arg : `${CONFIG_DIR}/${arg}${CONF_EXTENSION}`;
  /**
   * File basename used to derive the interface name.
   */
  const base = path.slice(path.lastIndexOf('/',) + 1,);
  /**
   * Interface name taken from the basename without its `.conf` extension.
   */
  const interfaceName = base.endsWith(CONF_EXTENSION,)
    ? base.slice(
      0,
      -CONF_EXTENSION.length,
    )
    : base;
  /**
   * Raw config text read from disk, mapping read failure to ConfigError.
   */
  const text = await (async function readText(): Promise<string> {
    try {
      return await readFile(
        path,
        'utf8',
      );
    }
    catch (error: unknown) {
      throw new ConfigError(
        `Config file does not exist or is unreadable: ${path}`,
        { cause: error, },
      );
    }
  })();
  /**
   * Parsed config before any file-driven AllowedIPs expansion.
   */
  const parsed = parseConfigText({
    interfaceName,
    text,
  },);
  if (parsed.allowedFromFiles === undefined)
    return parsed;
  return expandAllowedFromFiles({ config: parsed, },);
}
