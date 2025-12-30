import type * as ModuleEs from '@monochromatic-dev/module-es';

declare global {
  interface Window {
    moduleEs: typeof ModuleEs;
  }
}
