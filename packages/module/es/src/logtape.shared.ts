import {
  type Config,
  getConsoleSink,
  getLevelFilter,
  type LogRecord,
  type Sink,
  withFilter,
} from '@logtape/logtape';

/**
 * Creates a base logtape configuration object that works across all environments.
 *
 * This function provides the core logging configuration structure with proper
 * sink routing, console formatting, and logger categories. It handles environment
 * detection for colored vs plain console output and sets up appropriate log levels
 * for different categories (app, module, test, esbuild-plugin).
 *
 * @param fileSink - File or storage sink that implements both Sink and AsyncDisposable interfaces
 * @returns Complete logtape configuration object with sinks, filters, and loggers
 *
 * @example
 * Basic usage with custom file sink:
 * ```ts
 * import { createBaseConfig } from '@monochromatic-dev/module-es';
 *
 * const myFileSink = createCustomFileSink();
 * const config = createBaseConfig(myFileSink);
 * await logtapeConfigure(config);
 * ```
 *
 * @example
 * Environment-aware console formatting:
 * ```ts
 * // In test environment or with NO_COLOR, uses plain formatting
 * // In development, uses colored console output
 * const config = createBaseConfig(fileSink);
 * ```
 *
 * @remarks
 * Logger category configuration:
 * - **'a' (app)**: Debug level, outputs to file + console info+
 * - **'t' (test)**: Debug level, outputs to file + console info+
 * - **'m' (module)**: Debug level, outputs to file + console warn+
 * - **'esbuild-plugin'**: Debug level, outputs to file + console warn+
 * - **'logtape.meta'**: Warning level, outputs to console only
 *
 * Console sink behavior:
 * - **Colored**: Full formatting with timestamps and colors (development)
 * - **Plain**: Text-only formatting for test environments or when NO_COLOR is set
 */
// Common configuration for all environments
export const createBaseConfig = (
  fileSink: Sink & AsyncDisposable,
): Config<string, string> => {
  const myProcess = typeof process === 'undefined' ? undefined : process as unknown as {
    env: { NODE_ENV: string | undefined; NO_COLOR: undefined | boolean | string; };
  };
  const noColor = Boolean(myProcess?.env.NODE_ENV === 'test'
    || myProcess?.env.NO_COLOR
    // This somehow doesn't work?
    || (import.meta as unknown as { vitest: boolean; }).vitest);
  const consoleSink = noColor
    ? getConsoleSink({
      formatter: function consoleFormatter(record: LogRecord): readonly unknown[] {
        // Copypasted from https://jsr.io/@logtape/logtape/0.10.0/formatter.ts
        let msg = '';
        const values: unknown[] = [];
        for (let messageIndex = 0; messageIndex < record.message.length; messageIndex++) {
          if (messageIndex % 2 === 0) {
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands -- Good enough for defaultConsoleFormatter in logtape library, good enough for the library.
            msg += record.message[messageIndex];
          } else {
            msg += '%o';
            values.push(record.message[messageIndex]);
          }
        }
        const date = new Date(record.timestamp);
        const time = `${date.getUTCHours().toString().padStart(2, '0')}:${
          date
            .getUTCMinutes()
            .toString()
            .padStart(2, '0')
        }:${date.getUTCSeconds().toString().padStart(2, '0')}.${
          date.getUTCMilliseconds().toString().padStart(3, '0')
        }`;
        return [
          `${time} ${record.level.slice(0, 3)} ${record.category.join('\u00B7')} ${msg}`,
          ...values,
        ];
      },
    })
    : getConsoleSink();
  return ({
    reset: true,

    sinks: {
      console: consoleSink,
      consoleInfoPlus: withFilter(consoleSink, getLevelFilter('info')),
      consoleWarnPlus: withFilter(consoleSink, getLevelFilter('warning')),
      file: fileSink,
    },

    filters: {},

    loggers: [
      /* a is short for app, m is short for module, t is short for test
       Sorry, but terminal space is precious. */
      { category: ['a'], lowestLevel: 'debug', sinks: ['file', 'consoleInfoPlus'] },
      { category: ['t'], lowestLevel: 'debug', sinks: ['file', 'consoleInfoPlus'] },
      { category: ['m'], lowestLevel: 'debug', sinks: ['file', 'consoleWarnPlus'] },
      {
        category: ['esbuild-plugin'],
        lowestLevel: 'debug',
        sinks: ['file', 'consoleWarnPlus'],
      },
      { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
    ],
  });
};

/**
 * Creates an in-memory logging sink that stores log records as JSON strings.
 *
 * This function provides a fallback logging mechanism when file or persistent storage
 * isn't available. The sink accumulates log records in memory as JSON strings and
 * outputs the accumulated content to console when disposed. Useful for testing
 * environments, temporary logging, or when persistent storage fails.
 *
 * @returns Memory-based sink that implements both Sink and AsyncDisposable interfaces
 *
 * @example
 * Basic usage as fallback sink:
 * ```ts
 * import { createMemorySink, createBaseConfig } from '@monochromatic-dev/module-es';
 *
 * const memorySink = createMemorySink();
 * const config = createBaseConfig(memorySink);
 * await logtapeConfigure(config);
 *
 * // Log records are stored in memory
 * logger.info('Application started');
 *
 * // Dispose to output accumulated logs
 * await memorySink[Symbol.asyncDispose]();
 * ```
 *
 * @example
 * Testing scenario with memory sink:
 * ```ts
 * // Memory sink is ideal for testing scenarios
 * const testSink = createMemorySink();
 * const testConfig = createBaseConfig(testSink);
 *
 * // Run tests with memory logging
 * logger.debug('Test case started');
 * logger.error('Expected error for test');
 *
 * // Dispose after tests complete
 * await testSink[Symbol.asyncDispose]();
 * ```
 *
 * @remarks
 * **Memory behavior:**
 * - Stores each log record as a JSON string with 2-space indentation
 * - Accumulates records in an internal array until disposal
 * - Clears the internal array after disposal
 * - Outputs total content length for monitoring purposes
 *
 * **Disposal process:**
 * 1. Joins all accumulated records with newlines
 * 2. Outputs disposal message and content length to console
 * 3. Clears the internal storage array
 * 4. Ready for reuse after disposal
 */
// Memory fallback sink creation
export const createMemorySink = (): Sink & AsyncDisposable => {
  const lines: string[] = [];

  const memorySink: Sink & AsyncDisposable = (record: LogRecord): void => {
    lines.push(JSON.stringify(record, null, 2));
  };

  // eslint-disable-next-line @typescript-eslint/require-await -- To keep the signature consistent, we've to make it an async function.
  memorySink[Symbol.asyncDispose] = async function disposeMemorySink(): Promise<void> {
    console.log('disposing in memory array sink');
    const content = lines.join('\n');
    lines.length = 0;
    console.log('disposed memory sink', 'with content length', content.length);
  };

  return memorySink;
};

/**
 * Example logger identifier for application's main entry point.
 *
 * This constant provides a ready-to-use logger category for your application's
 * main execution file. Following the project's logging conventions, it uses
 * the 'a' (app) category with 'index' as the subcategory, making it perfect
 * for main application logic, startup sequences, and primary workflows.
 *
 * @example
 * Basic usage in main application file:
 * ```ts
 * import { logtapeId, logtapeGetLogger } from '@monochromatic-dev/module-es';
 *
 * const logger = logtapeGetLogger(logtapeId);
 * logger.info('Application starting up');
 * logger.debug('Initialization complete');
 * ```
 *
 * @example
 * Custom logger categories following same pattern:
 * ```ts
 * // Follow the same pattern for other app components
 * const apiLoggerId = ['a', 'api'] as const;
 * const configLoggerId = ['a', 'config'] as const;
 * const routerLoggerId = ['a', 'router'] as const;
 *
 * const apiLogger = logtapeGetLogger(apiLoggerId);
 * const configLogger = logtapeGetLogger(configLoggerId);
 * ```
 *
 * @example
 * Integration with configuration setup:
 * ```ts
 * import { logtapeConfiguration, logtapeConfigure, logtapeId, logtapeGetLogger } from '@monochromatic-dev/module-es';
 *
 * // Set up logging first
 * await logtapeConfigure(await logtapeConfiguration());
 *
 * // Then use the logger
 * const logger = logtapeGetLogger(logtapeId);
 * logger.info('Logging configured successfully');
 * ```
 *
 * @remarks
 * **Category structure:**
 * - **'a'**: Application category (debug level, file + console info+)
 * - **'index'**: Subcategory for main entry point
 *
 * **Logging behavior:**
 * - Logs to both file and console (info level and above)
 * - Debug and higher levels captured in file storage
 * - Follows project's standard logging configuration
 *
 * **Type safety:**
 * - Uses `as const` assertion for literal type preservation
 * - Compatible with logtape's logger category system
 * - Provides compile-time type checking for logger usage
 */
export const logtapeId = ['a', 'index'] as const;

export {
  configure as logtapeConfigure,
  getLogger as logtapeGetLogger,
} from '@logtape/logtape';
