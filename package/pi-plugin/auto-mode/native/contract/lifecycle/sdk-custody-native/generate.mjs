import assert from 'node:assert/strict';

//region Exact transforms over the reviewed, SHA-pinned private-field manager.
export const internalMethods=[
  '_setSessionFile',
  '_loadEntries',
  '_buildIndex',
  '_rewriteFile',
  '_hasConversation',
  '_persist',
  '_appendEntry'
];
export function replaceOne({
  source,
  before,
  after
}){assert.equal(
  source.split(before)
    .length,
  2,
  before
);return source.replace(
  before,
  after
);}
export function generate(source){
  assert.equal(
    source.includes('#rootOccurrence'),
    false
  );
  const helpers=[...source.matchAll(/^ {4}(_[A-Za-z]+)\(/gm)].map(value=>value[1]);assert.deepEqual(
    [...helpers].sort(),
    [...internalMethods].sort()
  );
  let value=source;
  for(const name of internalMethods){value=replaceOne({
    source:value,
    before:`    ${name}(`,
    after:`    #${name}(`
  });value=value.replaceAll(
    `this.${name}(`,
    `this.#${name}(`
  );}
  value=replaceOne({
    source:value,
    before:'export class SessionManager {',
    after:'export class SessionManager {\n    #rootOccurrence = Object.freeze({});\n    #changeRootOccurrence() { this.#rootOccurrence = Object.freeze({}); }\n    static rootOccurrenceOf(manager) { return manager.#rootOccurrence; }'
  });
  value=replaceOne({
    source:value,
    before:'            this.newSession(newSessionOptions);\n        }\n    }',
    after:'            this.newSession(newSessionOptions);\n        }\n        Object.freeze(this);\n    }'
  });
  value=replaceOne({
    source:value,
    before:'        this.#sessionFile = resolvePath(sessionFile);',
    after:'        this.#changeRootOccurrence();\n        this.#sessionFile = resolvePath(sessionFile);'
  });
  value=replaceOne({
    source:value,
    before:'        this.#sessionId = options?.id ?? createSessionId();',
    after:'        this.#changeRootOccurrence();\n        this.#sessionId = options?.id ?? createSessionId();'
  });
  value=replaceOne({
    source:value,
    before:'        this.#leafId = branchFromId;\n    }',
    after:'        if (this.#leafId === branchFromId) return;\n        this.#changeRootOccurrence();\n        this.#leafId = branchFromId;\n    }'
  });
  value=replaceOne({
    source:value,
    before:'    resetLeaf() {\n        this.#leafId = null;\n    }',
    after:'    resetLeaf() {\n        if (this.#leafId === null) return;\n        this.#changeRootOccurrence();\n        this.#leafId = null;\n    }'
  });
  value=replaceOne({
    source:value,
    before:'        const fromId = this.#leafId ?? "root";\n        this.#leafId = branchFromId;',
    after:'        const fromId = this.#leafId ?? "root";\n        this.#changeRootOccurrence();\n        this.#leafId = branchFromId;'
  });
  for(const indent of [
    '            ',
    '        '
  ])value=replaceOne({
    source:value,
    before:`\n${indent}this.#fileEntries = [header, ...pathWithoutLabels, ...labelEntries];`,
    after:`\n${indent}this.#changeRootOccurrence();\n${indent}this.#fileEntries = [header, ...pathWithoutLabels, ...labelEntries];`
  });
  value+='\n// The prototype is fixed before any owned constructor is exposed. Private fields remain internally mutable.\nObject.freeze(SessionManager.prototype);\nObject.freeze(SessionManager);\nexport function readRootOccurrence(manager) { return SessionManager.rootOccurrenceOf(manager); }\n';
  return value;
}
export function withBranchFailure(source){
  const start=source.indexOf('    branch(branchFromId) {');
  const close=source.indexOf(
    '\n    }\n',
    start
  );assert.ok((start!==(-1))&&(close>start));
  // Exact pinned indentation identifies this method's end; this is not a general JavaScript parser.
  const end=close+'\n    }\n'.length;
  const region=source.slice(
    start,
    end
  );
    const after='        throw fixtureFailure;\n        this.#leafId = branchFromId;';
    const before='        this.#leafId = branchFromId;';
  return `${source.slice(
    0,
    start
  )+replaceOne({
    source:region,
    before,
    after
  })
    +source.slice(end)
    }\nexport const fixtureFailure = new Error("Owned branch-entry failure");\n`;
}
export function mutate({
  source,
  mode
}){
  if(mode==='intact')return source;
  if(mode==='missing-occurrence')return replaceOne({
    source,
    before:'#changeRootOccurrence() { this.#rootOccurrence = Object.freeze({}); }',
    after:'#changeRootOccurrence() {}'
  });
  if(mode==='mutable-instance')return replaceOne({
    source,
    before:'        Object.freeze(this);',
    after:'        // Instance freeze removed by this sensitivity control.'
  });
  if(mode==='mutable-prototype')return replaceOne({
    source,
    before:'Object.freeze(SessionManager.prototype);',
    after:'// Prototype freeze removed by this sensitivity control.'
  });
  if(mode==='mutable-constructor')return replaceOne({
    source,
    before:'Object.freeze(SessionManager);',
    after:'// Constructor freeze removed by this sensitivity control.'
  });
  if(mode==='public-loader')return source.replaceAll(
    '#_loadEntries',
    '_loadEntries'
  );
  const omittedSites={
    'unmarked-reset':[
      '        this.#changeRootOccurrence();\n        this.#leafId = null;',
      '        this.#leafId = null;'
    ],
    'unmarked-summary':[
      '        const fromId = this.#leafId ?? "root";\n        this.#changeRootOccurrence();',
      '        const fromId = this.#leafId ?? "root";'
    ],
    'unmarked-persistent-fork':[
      '            this.#changeRootOccurrence();\n            this.#fileEntries = [header, ...pathWithoutLabels, ...labelEntries];',
      '            this.#fileEntries = [header, ...pathWithoutLabels, ...labelEntries];'
    ],
    'unmarked-memory-fork':[
      '\n        this.#changeRootOccurrence();\n        this.#fileEntries = [header, ...pathWithoutLabels, ...labelEntries];',
      '\n        this.#fileEntries = [header, ...pathWithoutLabels, ...labelEntries];'
    ],
    'unmarked-new-session':[
      '        this.#changeRootOccurrence();\n        this.#sessionId = options?.id ?? createSessionId();',
      '        this.#sessionId = options?.id ?? createSessionId();'
    ],
    'unmarked-switch':[
      '        this.#changeRootOccurrence();\n        this.#sessionFile = resolvePath(sessionFile);',
      '        this.#sessionFile = resolvePath(sessionFile);'
    ],
  };
  if(Object.hasOwn(
    omittedSites,
    mode
  )){const [before,after]=omittedSites[mode];return replaceOne({
    source,
    before,
    after
  });}
  if(mode==='late-branch-marker')return replaceOne({
    source,
    before:'        this.#changeRootOccurrence();\n        this.#leafId = branchFromId;\n    }',
    after:'        this.#leafId = branchFromId;\n        this.#changeRootOccurrence();\n    }'
  });
  throw new Error(`Unrecognized custody sensitivity mode: ${mode}`);
}
//endregion
