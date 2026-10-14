/**
 Retain original native result conversion functions at their parsed source locations.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type { parse as parseNative } from 'yuku-parser';
import { NativeBatchBuildError } from './build-entries.ts';

//region Native result conversion keeps its original function implementations and source order

/**
 Result conversion preparation keeps diagnostics separate from runtime result consumption.
 */
const l = tagged({ tag: 'auto-mode-native-program-value-source' });

/**
 Extract the installed conversion functions for the original native result consumer.

 @param source - qualified original executor source

 @param parse - captured installed parser retaining original function locations

 @returns original text conversion helper and exported result conversion function

 @throws NativeBatchBuildError when source parsing or original function membership changes

 @example
 ```ts
 const generated = nativeScriptValueSource({ source, parse });
 ```
 */
export function nativeScriptValueSource({
  source,
  parse
}: {
  readonly source: string;
  readonly parse: typeof parseNative;
}): string {
  /**
   Each native result source extraction retains its own diagnostic boundary.
   */
  const rl = tagged({
    tag: nativeScriptValueSource.name,
    l
  });
  rl.debug('locating original native result conversion functions');
  /**
   Original semantic diagnostics reject ambiguous function declarations before extraction.
   */
  const parsed = parse(
    source,
    {
    sourceType: 'module',
    lang: 'js',
    preserveParens: true,
    semanticErrors: true,
  }
  );
  if (parsed.diagnostics
    .length
    > 0) throw new NativeBatchBuildError('Cannot parse original native result conversion source');
  /**
   The original helper precedes the exported converter without importing unrelated executor code.
   */
  const functions = [
    'textOf',
    'toScriptValue'
  ].map(function nativeResultFunction(name): string {
    /**
     Only an original top-level function with the exact decoded name can supply the converter.
     */
    const nodes = [];
    for (const candidate of parsed.program.body) {
      if (candidate.type === 'FunctionDeclaration' && candidate.id?.name === name) nodes.push(candidate);
    }
    if (nodes.length !== 1) throw new NativeBatchBuildError(`Original native result conversion function is unavailable or repeated: ${name}`);
    /**
     Exact membership establishes the original function whose source boundaries are retained.
     */
    const node = nonNullishOrThrow(nodes[0]);
    /**
     The original function declaration spelling is part of the qualified source profile.
     */
    const body = source.slice(
      node.start,
      node.end
    );
    if (!body.startsWith(`function ${name}(`)) throw new NativeBatchBuildError(`Original native result conversion declaration changed: ${name}`);
    return (name === 'toScriptValue' ? 'export ' : '') + body;
  });
  return `${functions.join('\n\n')}\n`;
}

//endregion Native result conversion keeps its original function implementations and source order
