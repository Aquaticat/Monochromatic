import { randomUUID, } from 'node:crypto';

import { OpenSnitchConfigError, } from './errors.ts';

/**
 * OpenSnitch system-firewall schema version supported by this integration.
 */
const SUPPORTED_VERSION = 1;

/**
 * Stable prefix identifying rules owned by wg-quicker.
 */
const MANAGED_DESCRIPTION_PREFIX = 'wg-quicker managed endpoint';

/**
 * JSON object with unknown fields retained during round-trip.
 */
export type JsonRecord = Record<string, unknown>;

/**
 * Reconciled OpenSnitch document and whether disk write is necessary.
 */
export type OpenSnitchConfigMutation = {
  /**
   * Document preserving unknown and legacy fields.
   */
  readonly document: JsonRecord;

  /**
   * Whether managed rule set differs from requested ports.
   */
  readonly changed: boolean;

  /**
   * Sorted distinct destination ports represented by managed rules.
   */
  readonly managedPorts: readonly number[];
};

/**
 * Reports non-null JSON object.
 *
 * @param value - Unknown JSON value.
 *
 * @returns Whether value is object record.
 *
 * @example
 * ```ts
 * isRecord({ Version: 1 });
 * ```
 */
function isRecord(value: unknown,): value is JsonRecord {
  return ((typeof value) === 'object') && (value !== null) && (!Array.isArray(value,));
}

/**
 * Creates interface-specific managed-rule description prefix.
 *
 * @param interfaceName - WireGuard interface owning rules.
 *
 * @returns Prefix with unambiguous interface delimiter.
 *
 * @example
 * ```ts
 * managedPrefix({ interfaceName: 'wg0' });
 * ```
 */
function managedPrefix({ interfaceName, }: { readonly interfaceName: string; },): string {
  return `${MANAGED_DESCRIPTION_PREFIX} [${interfaceName}] UDP destination port `;
}

/**
 * Reports whether rule belongs to one interface's wg-quicker lifecycle.
 *
 * @param value - Unknown rule value.
 *
 * @param prefix - Exact interface-specific ownership prefix.
 *
 * @returns Whether description identifies managed rule.
 *
 * @example
 * ```ts
 * isManagedRule({ value: { Description: 'wg-quicker managed endpoint [wg0] UDP destination port 1' }, prefix });
 * ```
 */
function isManagedRule(
  {
    value,
    prefix,
  }: {
    readonly value: unknown;
    readonly prefix: string;
  },
): boolean {
  if (!isRecord(value,))
    return false;
  return ((typeof value.Description) === 'string') && value.Description.startsWith(prefix,);
}

/**
 * Creates one OpenSnitch nftables accept rule for endpoint UDP port.
 *
 * @param interfaceName - WireGuard interface owning rule.
 *
 * @param port - UDP destination port accepted before NFQUEUE.
 *
 * @returns OpenSnitch version 1 rule object.
 *
 * @example
 * ```ts
 * createManagedRule({ interfaceName: 'wg0', port: 51820 });
 * ```
 */
function createManagedRule(
  {
    interfaceName,
    port,
  }: {
    readonly interfaceName: string;
    readonly port: number;
  },
): JsonRecord {
  return {
    UUID: randomUUID(),
    Enabled: true,
    Position: '0',
    Description: `${managedPrefix({ interfaceName, },)}${String(port,)}`,
    Parameters: '',
    Expressions: [
      {
        Statement: {
          Op: '',
          Name: 'udp',
          Values: [
            {
              Key: 'dport',
              Value: String(port,),
            },
          ],
        },
      },
    ],
    Target: 'accept',
    TargetParameters: '',
  };
}

/**
 * Parses OpenSnitch system-firewall JSON without discarding unknown fields.
 *
 * @param text - Full JSON document.
 *
 * @param path - Source path used in diagnostics.
 *
 * @returns Parsed object document.
 *
 * @throws {@link OpenSnitchConfigError} when JSON or root shape is invalid.
 *
 * @example
 * ```ts
 * parseOpenSnitchConfig({ text: '{"Enabled":true}', path: '/etc/opensnitchd/system-fw.json' });
 * ```
 */
export function parseOpenSnitchConfig(
  {
    text,
    path,
  }: {
    readonly text: string;
    readonly path: string;
  },
): JsonRecord {
  /**
   * Untrusted parsed JSON root.
   */
  let parsed: unknown;
  try {
    parsed = JSON.parse(text,);
  }
  catch (error) {
    throw new OpenSnitchConfigError(
      `OpenSnitch system-firewall config is not valid JSON: ${path}`,
      { cause: error, },
    );
  }
  if (!isRecord(parsed,))
    throw new OpenSnitchConfigError(`OpenSnitch system-firewall config has invalid root: ${path}`,);
  return parsed;
}

/**
 * Finds exactly one nftables output-mangle chain in version 1 document.
 *
 * @param document - Parsed OpenSnitch system-firewall document.
 *
 * @param path - Source path used in diagnostics.
 *
 * @param requireEnabled - Whether disabled system firewall must reject installation.
 *
 * @returns Target chain object and its parent entry.
 *
 * @throws {@link OpenSnitchConfigError} when schema is unsupported or ambiguous.
 *
 * @example
 * ```ts
 * findTargetChain({ document, path: '/tmp/system-fw.json', requireEnabled: true });
 * ```
 */
function findTargetChain(
  {
    document,
    path,
    requireEnabled,
  }: {
    readonly document: Readonly<JsonRecord>;
    readonly path: string;
    readonly requireEnabled: boolean;
  },
): {
  readonly chain: JsonRecord;
  readonly parent: JsonRecord;
} {
  if (document.Version !== SUPPORTED_VERSION) {
    throw new OpenSnitchConfigError(
      `OpenSnitch system-firewall config version is unsupported at ${path}; expected 1.`,
    );
  }
  if (requireEnabled && (document.Enabled !== true)) {
    throw new OpenSnitchConfigError(
      `OpenSnitch system firewall is disabled at ${path}; enable it before bringing tunnel up.`,
    );
  }
  if (!Array.isArray(document.SystemRules,))
    throw new OpenSnitchConfigError(`OpenSnitch SystemRules is missing at ${path}.`,);
  /**
   * Matching chain-parent pairs across system-rule entries.
   */
  const matches = document.SystemRules.flatMap(function matchingChains(entry,): readonly {
    readonly chain: JsonRecord;
    readonly parent: JsonRecord;
  }[] {
    if ((!isRecord(entry,)) || (!Array.isArray(entry.Chains,)))
      return [];
    return entry.Chains
      .filter(function isTarget(chain,): chain is JsonRecord {
        return isRecord(chain,)
          && (chain.Name === 'mangle_output')
          && (chain.Table === 'opensnitch')
          && (chain.Family === 'inet');
      },)
      .map(function pair(chain,) {
        return {
          chain,
          parent: entry,
        };
      },);
  },);
  if (matches.length !== 1) {
    throw new OpenSnitchConfigError(
      `OpenSnitch config at ${path} must contain exactly one inet opensnitch mangle_output chain.`,
    );
  }
  const [match,] = matches;
  if (match === undefined)
    throw new OpenSnitchConfigError(`OpenSnitch mangle_output chain is missing at ${path}.`,);
  if (!Array.isArray(match.chain.Rules,))
    throw new OpenSnitchConfigError(`OpenSnitch mangle_output Rules is invalid at ${path}.`,);
  return match;
}

/**
 * Reconciles interface-owned endpoint allowances in OpenSnitch version 1 tree.
 *
 * Empty `endpointPorts` removes every managed rule for interface.
 * Unknown fields and unrelated rules retain identity and content.
 *
 * @param document - Parsed OpenSnitch system-firewall document.
 *
 * @param interfaceName - WireGuard interface owning managed rules.
 *
 * @param endpointPorts - Desired endpoint UDP ports.
 *
 * @param path - Source path used in diagnostics.
 *
 * @param requireEnabled - Whether disabled firewall rejects operation.
 *
 * @returns Reconciled document and change metadata.
 *
 * @throws {@link OpenSnitchConfigError} when schema cannot be changed safely.
 *
 * @example
 * ```ts
 * reconcileOpenSnitchConfig({
 *   document,
 *   interfaceName: 'wg0',
 *   endpointPorts: [51820],
 *   path: '/etc/opensnitchd/system-fw.json',
 *   requireEnabled: true,
 * });
 * ```
 */
export function reconcileOpenSnitchConfig(
  {
    document,
    interfaceName,
    endpointPorts,
    path,
    requireEnabled,
  }: {
    readonly document: JsonRecord;
    readonly interfaceName: string;
    readonly endpointPorts: readonly number[];
    readonly path: string;
    readonly requireEnabled: boolean;
  },
): OpenSnitchConfigMutation {
  const {
    chain: targetChain,
    parent: targetParent,
  } = findTargetChain({
    document,
    path,
    requireEnabled,
  },);
  /**
   * Desired sorted unique ports for deterministic config rendering.
   */
  const managedPorts = [...new Set(endpointPorts,),].toSorted(function ascending(a, b,): number {
    return a - b;
  },);
  /**
   * Existing target rules narrowed by target-chain validation.
   */
  const existingRules = targetChain.Rules as readonly unknown[];
  /**
   * Interface-owned rules removed before current desired set is appended.
   */
  const prefix = managedPrefix({ interfaceName, },);
  const retainedRules = existingRules.filter(function retainRule(rule,): boolean {
    return !isManagedRule({
      value: rule,
      prefix,
    },);
  },);
  /**
   * Fresh managed rules matching current endpoint ports.
   */
  const managedRules = managedPorts.map(function toRule(port,): JsonRecord {
    return createManagedRule({
      interfaceName,
      port,
    },);
  },);
  /**
   * Existing managed descriptions used to avoid unnecessary write when removing none.
   */
  const existingManagedCount = existingRules.length - retainedRules.length;
  if ((existingManagedCount === 0) && (managedRules.length === 0)) {
    return {
      document,
      changed: false,
      managedPorts,
    };
  }
  /**
   * Replacement target chain preserving unknown chain fields.
   */
  const replacementChain: JsonRecord = {
    ...targetChain,
    Rules: [
      ...retainedRules,
      ...managedRules,
    ],
  };
  /**
   * Replacement parent retaining every non-target chain.
   */
  const replacementParent: JsonRecord = {
    ...targetParent,
    Chains: (targetParent.Chains as readonly unknown[]).map(function replaceChain(chain,): unknown {
      return chain === targetChain ? replacementChain : chain;
    },),
  };
  return {
    document: {
      ...document,
      SystemRules: (document.SystemRules as readonly unknown[]).map(function replaceParent(entry,): unknown {
        return entry === targetParent ? replacementParent : entry;
      },),
    },
    changed: true,
    managedPorts,
  };
}

/**
 * Renders validated OpenSnitch document with stable trailing newline.
 *
 * @param document - Reconciled JSON object.
 *
 * @returns Pretty-printed JSON suitable for OpenSnitch file watcher.
 *
 * @example
 * ```ts
 * renderOpenSnitchConfig({ document });
 * ```
 */
export function renderOpenSnitchConfig(
  { document, }: { readonly document: Readonly<JsonRecord>; },
): string {
  return `${JSON.stringify(document, null, 2,)}\n`;
}
