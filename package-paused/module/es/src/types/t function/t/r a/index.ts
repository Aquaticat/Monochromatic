/**
 * Generic async function type with configurable parameter and return types.
 */
export type $<Parameters_ extends unknown[] = unknown[], Return = unknown,> = (
  ...parameters: Parameters_
) => Promise<Return>;
