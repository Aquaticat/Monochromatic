/** Type boundary for the original mechanically checked dependency facade. @module */
import type {
  DependencySources,
  DependencyFacadeInput,
  DependencyFacade
} from './dependency-types.ts';

/**
 Bind original root, source, file, deadline, and cancellation observers.

 @param input - original observer capabilities and bounded declared file profile

 @returns original facade retaining opaque handle ownership and mechanical projections

 @example createDependencyFacade(input);
 */
export declare function createDependencyFacade<const Source extends DependencySources, const Root extends object>(input: DependencyFacadeInput<Source, Root>): DependencyFacade;
