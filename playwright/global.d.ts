import type * as ModuleEs from '@monochromatic-dev/module-es';
import type * as ModuleLogger from '@monochromatic-dev/module-logger';

declare global {
  interface Window {
    moduleEs: typeof ModuleEs;
    moduleLogger: typeof ModuleLogger;
  }
}
