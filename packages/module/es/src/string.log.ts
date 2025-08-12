export type Logger = {
  trace: (message: string) => unknown,
  debug: (message: string) => unknown,
  info: (message: string) => unknown,
  warn: (message: string) => unknown,
  error: (message: string) => unknown,
  fatal: (message: string) => unknown,
}

export const consoleLogger:Logger = {
  trace: console.trace,
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
  fatal: console.error,
}
