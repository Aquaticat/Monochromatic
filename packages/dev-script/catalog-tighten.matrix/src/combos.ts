/**
 * Matrix combinations and fixture content for the catalog-tighten e2e.
 *
 * Each combination installs a tiny fixture workspace under one pnpm layout, then
 * asserts catalog-tighten tightens the catalog floor to the active installed
 * version. The fixture pins {@link FIXTURE_PACKAGE} to {@link FIXTURE_ACTIVE} via
 * an override, so the active version is predictable and below the package's
 * latest, making the expected tightened range deterministic across layouts.
 */

//region Fixture constants

/**
 * Catalog package the fixture pins and tightens; tiny, with several published versions.
 */
export const FIXTURE_PACKAGE = 'picomatch';

/**
 * Catalog floor written into the fixture, below the pinned active version.
 */
export const FIXTURE_FLOOR = '4.0.0';

/**
 * Active installed version the fixture pins via an override, so every layout resolves the same.
 */
export const FIXTURE_ACTIVE = '4.0.2';

/**
 * Higher version seeded as a stale virtual-store orphan; the resolver must ignore it.
 */
export const FIXTURE_ORPHAN = '4.0.4';

//endregion Fixture constants

//region Combinations

/**
 * pnpm node-linker mode under test.
 */
type NodeLinker = 'isolated' | 'hoisted' | 'pnp';

/**
 * One matrix combination: a pnpm layout plus whether to seed a stale orphan.
 */
export type LayoutCombo = {
  /**
   * Human-readable label used in the test name and container diagnostics.
   */
  readonly label: string;
  /**
   * pnpm `nodeLinker` mode for the install.
   */
  readonly nodeLinker: NodeLinker;
  /**
   * pnpm `hoist` setting; ignored under the pnp linker.
   */
  readonly hoist: boolean;
  /**
   * Whether to seed a higher-version stale orphan in the virtual store after install.
   */
  readonly staleOrphan: boolean;
};

/**
 * Every combination the matrix runs: the three node-linker modes (hoist toggled
 * for the node-modules linkers) plus the stale-orphan regression.
 */
export const COMBOS: readonly LayoutCombo[] = [
  {
    label: 'isolated, hoist on',
    nodeLinker: 'isolated',
    hoist: true,
    staleOrphan: false,
  },
  {
    label: 'isolated, hoist off',
    nodeLinker: 'isolated',
    hoist: false,
    staleOrphan: false,
  },
  {
    label: 'hoisted, hoist on',
    nodeLinker: 'hoisted',
    hoist: true,
    staleOrphan: false,
  },
  {
    label: 'hoisted, hoist off',
    nodeLinker: 'hoisted',
    hoist: false,
    staleOrphan: false,
  },
  {
    label: 'pnp',
    nodeLinker: 'pnp',
    hoist: false,
    staleOrphan: false,
  },
  {
    label: 'isolated, stale orphan',
    nodeLinker: 'isolated',
    hoist: false,
    staleOrphan: true,
  },
];

//endregion Combinations

//region Fixture files

/**
 * Builds the `pnpm-workspace.yaml` for one combination: the `packages/*\/*` glob
 * matching catalog-tighten's workspace discovery, the catalog floor, the
 * combination's linker and hoist settings, and an override pinning the active
 * version. The `hoist` line is omitted under pnp, where it does not apply.
 *
 * @param combo - combination whose pnpm settings to encode
 *
 * @returns `pnpm-workspace.yaml` text for the fixture
 *
 * @example
 * ```ts
 * buildWorkspaceYaml({ label: 'pnp', nodeLinker: 'pnp', hoist: false, staleOrphan: false })
 * ```
 */
export function buildWorkspaceYaml(combo: LayoutCombo,): string {
  /**
   * `hoist:` line, present only for node-modules linkers where the setting is meaningful.
   */
  const hoistLine = combo.nodeLinker === 'pnp'
    ? ''
    : `hoist: ${String(combo.hoist,)}\n`;
  return [
    'packages:',
    '  - \'packages/*/*\'',
    'catalog:',
    `  '${FIXTURE_PACKAGE}': '>=${FIXTURE_FLOOR}'`,
    `nodeLinker: ${combo.nodeLinker}`,
    `${hoistLine}overrides:`,
    `  ${FIXTURE_PACKAGE}: ${FIXTURE_ACTIVE}`,
    '',
  ].join('\n',);
}

/**
 * Root `package.json` for the fixture workspace.
 */
export const FIXTURE_ROOT_PACKAGE_JSON: string = `${JSON.stringify(
  {
    name: 'catalog-tighten-fixture-root',
    private: true,
    version: '0.0.0',
  },
  undefined,
  2,
)}\n`;

/**
 * Consumer `package.json` at `packages/grp/consumer`, depending on the catalog entry.
 */
export const FIXTURE_CONSUMER_PACKAGE_JSON: string = `${JSON.stringify(
  {
    name: 'catalog-tighten-fixture-consumer',
    private: true,
    version: '0.0.0',
    dependencies: {
      [FIXTURE_PACKAGE]: 'catalog:',
    },
  },
  undefined,
  2,
)}\n`;

/**
 * Expected catalog line after a successful tighten, asserted by the in-container run.
 */
export const EXPECTED_TIGHTENED: string = `${FIXTURE_PACKAGE}: >=${FIXTURE_FLOOR} -> >=${FIXTURE_ACTIVE}`;

//endregion Fixture files
