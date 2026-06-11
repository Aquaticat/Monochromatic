import type * as ModuleLogger from '@monochromatic-dev/module-logger';

declare global {
  interface Window {
    moduleLogger: typeof ModuleLogger;
  }
}
