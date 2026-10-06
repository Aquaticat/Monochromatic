/**
 The `planDependentBumps` scenarios of `dependent-version-bump.unit.test.ts`, as differential cases.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />

/** @typedef {import('./dependent-version-types.mjs').DifferentialCase} DifferentialCase */
/** @typedef {import('./dependent-version-types.mjs').GraphNode} GraphNode */
/** @typedef {DifferentialCase & { expected: Record<string, unknown>, whole: boolean }} UnitCase */

/**
 A graph node whose directory follows from its name, as in the incumbent's fixture.

 @param {{ name: string, version: string | null, edgeNames?: string[] }} node - name, version and edges
 @returns {GraphNode} node
 */
function node({
  name,
  version,
  edgeNames = []
}) {
  return {
    name,
    directory: `package/module/${name}`,
    version,
    edgeNames,
  };
}

/**
 A planned bump of the graph cases.

 @param {{ name: string, from: string, to: string }} bump - name and versions
 @returns {{ name: string, directory: string, from: string, to: string }} bump
 */
function graphBump({
  name,
  from,
  to
}) {
  return {
    name,
    directory: `package/module/${name}`,
    from,
    to,
  };
}

/**
 The `planDependentBumps` cases of `dependent-version-bump.unit.test.ts`.

 @returns {UnitCase[]} cases
 */
export function graphCases() {
  /** @type {[string, GraphNode[], string[], string[], Record<string, unknown>][]} */
  const table = [
    [
      'bumps direct and transitive publishable dependents in name order',
      [
        node({
          name: 'z-app',
          version: '2.0.0',
          edgeNames: ['mid']
        }),
        node({
          name: 'mid',
          version: '1.0.0',
          edgeNames: ['base']
        }),
        node({
          name: 'base',
          version: '1.1.0'
        }),
        node({
          name: 'a-tool',
          version: '0.1.0',
          edgeNames: ['base']
        }),
      ],
      ['base'],
      [
        'z-app',
        'mid',
        'base',
        'a-tool'
      ],
      { value: [
        graphBump({
          name: 'a-tool',
          from: '0.1.0',
          to: '0.1.1'
        }),
        graphBump({
          name: 'mid',
          from: '1.0.0',
          to: '1.0.1'
        }),
        graphBump({
          name: 'z-app',
          from: '2.0.0',
          to: '2.0.1'
        })
      ] },
    ],
    [
      'walks through unpublishable packages but bumps only publishable ones',
      [
        node({
          name: 'app',
          version: '1.0.0',
          edgeNames: ['internal']
        }),
        node({
          name: 'internal',
          version: '1.0.0',
          edgeNames: ['base']
        }),
        node({
          name: 'base',
          version: '1.0.0'
        })
      ],
      ['base'],
      [
        'app',
        'base'
      ],
      { value: [graphBump({
        name: 'app',
        from: '1.0.0',
        to: '1.0.1'
      })] },
    ],
    [
      'skips already bumped and versionless dependents',
      [
        node({
          name: 'bumped-dependent',
          version: '3.0.0',
          edgeNames: ['base']
        }),
        node({
          name: 'versionless',
          version: null,
          edgeNames: ['base']
        }),
        node({
          name: 'base',
          version: '1.0.0'
        })
      ],
      [
        'base',
        'bumped-dependent'
      ],
      [
        'bumped-dependent',
        'versionless',
        'base'
      ],
      { value: [] },
    ],
    [
      'ignores external and self edges and terminates on cycles',
      [
        node({
          name: 'left',
          version: '1.0.0',
          edgeNames: [
            'right',
            'left',
            'external'
          ]
        }),
        node({
          name: 'right',
          version: '1.0.0',
          edgeNames: ['left']
        })
      ],
      ['left'],
      [
        'left',
        'right'
      ],
      { value: [graphBump({
        name: 'right',
        from: '1.0.0',
        to: '1.0.1'
      })] },
    ],
    [
      'returns nothing when no package was bumped',
      [node({
        name: 'a',
        version: '1.0.0',
        edgeNames: ['b']
      })],
      [],
      ['a'],
      { value: [] }
    ],
    [
      'throws when a dependent needing a bump has a prerelease version',
      [
        node({
          name: 'a',
          version: '1.0.0-rc.1',
          edgeNames: ['b']
        }),
        node({
          name: 'b',
          version: '1.0.0'
        })
      ],
      ['b'],
      [
        'a',
        'b'
      ],
      { kind: 'unsupported' },
    ],
  ];
  return table.map(function toCase([title, manifests, bumpedNames, publishableNames, expected]) {
    return /** @type {UnitCase} */ ({
      name: `planDependentBumps ${title}`,
      kind: 'planDependentBumps',
      input: {
        manifests,
        bumpedNames,
        publishableNames,
      },
      expected,
      whole: false,
    });
  });
}

/** The formatting case of `replaceManifestVersion`. */
