/**
 Original source decoder owns runtime declaration admission. @module
 */
import type { DeclaredResultProgram } from './program-declaration-types.ts';

/**
 Decode the original inspected source profile without establishing execution authority.

 @param input - original source and complete callable names

 @returns owned source declaration
 */
export declare function declareResultProgram(input: Readonly<{
  source: string;
  toolNames: readonly string[];
}>): DeclaredResultProgram;

/**
 Require membership in the original source decoder's private declaration set.

 @param declaration - original source declaration candidate
 */
export declare function assertDeclaredProgram(declaration: unknown): asserts declaration is DeclaredResultProgram;
