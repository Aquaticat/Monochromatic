/** Generic async function type with configurable parameter and return types. */
export type $<Parameters_ extends unknown[] = unknown[],
  Return extends unknown = unknown,> = (
    ...parameters: Parameters_
  ) => Promise<Return>;
