/**
 Preserve original SessionManager root occurrences and private native mutation methods.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { type ClassDeclaration, parse } from 'yuku-parser';
import { NativeBatchBuildError } from '../../integration/native-batch/build-entries.ts';
import { privatizeNativeMembers } from '../../integration/native-batch/build-members.ts';
import { replaceOnce } from '../../integration/native-batch/build-rebase.ts';

//region Original manager methods are qualified before private ownership is installed

/**
 These original native helper methods own SessionManager's mutable root state.
 */
const internalMethods = [
  '_setSessionFile',
  '_loadEntries',
  '_buildIndex',
  '_rewriteFile',
  '_hasConversation',
  '_persist',
  '_appendEntry'
] as const;

/**
 Manager custody generation retains its own source transformation diagnostic boundary.
 */
const l = tagged({ tag: 'auto-mode-native-manager-custody-source' });

/**
 Require the original native manager and its complete qualified internal method membership.

 @param source - qualified native manager source before private method conversion

 @throws NativeBatchBuildError when source parsing, class identity, or method membership changes
 */
function assertOriginalManagerMethods(source: string): void {
  /**
   The parser establishes executable method membership independently of source comments and strings.
   */
  const parsed = parse(source, { sourceType: 'module' });
  if (parsed.diagnostics.length > 0) throw new NativeBatchBuildError('Cannot parse original native manager source');
  /**
   The qualified source has one named exported original manager class.
   */
  const managers: ClassDeclaration[] = [];
  for (const node of parsed.program.body) {
    if (node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'ClassDeclaration'
      && node.declaration.id?.name === 'SessionManager') managers.push(node.declaration);
  }
  if (managers.length !== 1) throw new NativeBatchBuildError('Original native SessionManager class is unavailable or duplicated');
  /**
   Class membership was established before its body is inspected.
   */
  const manager = nonNullishOrThrow(managers[0]);
  /**
   Every original underscore-prefixed native method must belong to the retained helper set.
   */
  const helpers: string[] = [];
  for (const member of manager.body.body) {
    if (member.type === 'MethodDefinition' && !member.computed && member.key.type === 'Identifier'
      && member.key.name.startsWith('_')) helpers.push(member.key.name);
  }
  if (helpers.length !== internalMethods.length || internalMethods.some(function missingOriginalMethod(name) {
    return !helpers.includes(name);
  })) throw new NativeBatchBuildError('Original native manager helper membership differs from the qualified method set');
}

/**
 Convert the fixed original method declarations and direct instance references together.

 @param source - manager source whose original helper membership was already qualified

 @returns source retaining private native helper methods and their original calls

 @throws NativeBatchBuildError when an exact original method declaration changes
 */
function privatizeManagerMethods(source: string): string {
  /**
   The fixed helper set has bounded size; each exact declaration edit preserves all other source bytes.
   */
  const declarations = internalMethods.reduce(function privateMethod(current, name): string {
    return replaceOnce({ source: current, from: `    ${name}(`, to: `    #${name}(` });
  }, source);
  return privatizeNativeMembers({ source: declarations, members: internalMethods });
}

//endregion Original manager methods are qualified before private ownership is installed

//region Root mutation sites publish original occurrence transitions before native state changes

/**
 Protect native manager custody while preserving each original root replacement and branch transition.

 @param source - qualified native manager whose original data fields are already private

 @returns original manager with private root occurrence and fixed exposed constructor surface

 @throws NativeBatchBuildError when ownership is already installed or original methods and mutation sites change

 @example
 ```ts
 const generated = generate(privateFieldManager);
 ```
 */
export function generate(source: string): string {
  /**
   Each custody transformation retains its original source qualification diagnostics.
   */
  const rl = tagged({ tag: generate.name, l });
  rl.debug('preparing original native manager root ownership');
  if (source.includes('#rootOccurrence')) throw new NativeBatchBuildError('Native manager root ownership is already installed');
  assertOriginalManagerMethods(source);
  /**
   Qualified original internal method calls retain their native implementation under private names.
   */
  const methodsSource = privatizeManagerMethods(source);
  /**
   The original manager owns the current root occurrence and the only mutation capability.
   */
  const occurrenceSource = replaceOnce({
    source: methodsSource,
    from:'export class SessionManager {',
    to:'export class SessionManager {\n    #rootOccurrence = Object.freeze({});\n    #changeRootOccurrence() { this.#rootOccurrence = Object.freeze({}); }\n    static rootOccurrenceOf(manager) { return manager.#rootOccurrence; }'
  });
  /**
   Construction freezes the public instance after native initialization completes.
   */
  const constructorSource = replaceOnce({
    source: occurrenceSource,
    from:'            this.newSession(newSessionOptions);\n        }\n    }',
    to:'            this.newSession(newSessionOptions);\n        }\n        Object.freeze(this);\n    }'
  });
  /**
   Switching session files retires the original root before changing the native file field.
   */
  const fileSource = replaceOnce({
    source: constructorSource,
    from:'        this.#sessionFile = resolvePath(sessionFile);',
    to:'        this.#changeRootOccurrence();\n        this.#sessionFile = resolvePath(sessionFile);'
  });
  /**
   New-session identity receives a new original root occurrence before native assignment.
   */
  const sessionSource = replaceOnce({
    source: fileSource,
    from:'        this.#sessionId = options?.id ?? createSessionId();',
    to:'        this.#changeRootOccurrence();\n        this.#sessionId = options?.id ?? createSessionId();'
  });
  /**
   An unchanged branch retains its root while actual native leaf changes retire it first.
   */
  const branchSource = replaceOnce({
    source: sessionSource,
    from:'        this.#leafId = branchFromId;\n    }',
    to:'        if (this.#leafId === branchFromId) return;\n        this.#changeRootOccurrence();\n        this.#leafId = branchFromId;\n    }'
  });
  /**
   Native reset preserves an already empty leaf and otherwise retires the original root first.
   */
  const resetSource = replaceOnce({
    source: branchSource,
    from:'    resetLeaf() {\n        this.#leafId = null;\n    }',
    to:'    resetLeaf() {\n        if (this.#leafId === null) return;\n        this.#changeRootOccurrence();\n        this.#leafId = null;\n    }'
  });
  /**
   Branch summaries retain their native source identity across the root transition.
   */
  const summarySource = replaceOnce({
    source: resetSource,
    from:'        const fromId = this.#leafId ?? "root";\n        this.#leafId = branchFromId;',
    to:'        const fromId = this.#leafId ?? "root";\n        this.#changeRootOccurrence();\n        this.#leafId = branchFromId;'
  });
  /**
   Persisted fork publication retires its original root before changing native entries.
   */
  const persistentForkSource = replaceOnce({
    source: summarySource,
    from:'\n            this.#fileEntries = [header, ...pathWithoutLabels, ...labelEntries];',
    to:'\n            this.#changeRootOccurrence();\n            this.#fileEntries = [header, ...pathWithoutLabels, ...labelEntries];'
  });
  /**
   In-memory forks retain the same original retirement ordering as persisted forks.
   */
  const memoryForkSource = replaceOnce({
    source: persistentForkSource,
    from:'\n        this.#fileEntries = [header, ...pathWithoutLabels, ...labelEntries];',
    to:'\n        this.#changeRootOccurrence();\n        this.#fileEntries = [header, ...pathWithoutLabels, ...labelEntries];'
  });
  return memoryForkSource + '\n// The prototype is fixed before any owned constructor is exposed. Private fields remain internally mutable.\nObject.freeze(SessionManager.prototype);\nObject.freeze(SessionManager);\nexport function readRootOccurrence(manager) { return SessionManager.rootOccurrenceOf(manager); }\n';
}

//endregion Root mutation sites publish original occurrence transitions before native state changes
