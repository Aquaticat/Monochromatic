export type $<Parameters_ extends unknown[] = unknown[],
  Return extends unknown = unknown,> = (
    ...parameters: Parameters_
  ) => Promise<Return>;
