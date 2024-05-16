import { z } from 'zod';
import { parser } from 'zod-opts';

export const parsed: {
  command: string;
} = parser()
  .args([{ name: 'command', type: z.enum(['build', 'serve', 'watch', 'clean', 'preparse', 'dependencies']) }])
  .options({})
  .parse();
