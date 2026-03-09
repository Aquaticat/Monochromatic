import type * as ModuleEs from '@monochromatic-dev/module-es';

declare global {
  // eslint-disable-next-line typescript-eslint/consistent-type-definitions -- interface required for declaration merging with global Window
  interface Window {
    moduleEs: typeof ModuleEs;
  }
}
