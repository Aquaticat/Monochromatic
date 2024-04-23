declare module '*.toml' {
  import type { z } from 'zod';
  import type ThemeConsts from '@monochromatic.dev/schema-theme-consts';
  export default {} as unknown as z.infer<typeof ThemeConsts>;
  export const accumulated = new Map() as unknown as ReadonlyMap<string, z.infer<typeof ThemeConsts>>;
}
