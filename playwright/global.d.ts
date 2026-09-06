import type * as ModuleLogger from '@monochromatic-dev/module-logger';
import type * as ModuleLoggerBrowser from '@monochromatic-dev/module-logger/browser';

declare global {
  interface Window {
    moduleLogger: typeof ModuleLogger;
    moduleLoggerBrowser: typeof ModuleLoggerBrowser;
  }
}
