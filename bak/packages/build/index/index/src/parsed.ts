import { z } from 'zod';
import { parser } from 'zod-opts';

const parsed: {
  command: string;
} = parser()
  .args([{
    name: 'command',
    type: z.enum([
      'build',
      'serve',
      'watch',
      'clean',
      'preparse',
      'dependencies',
      'precommit',
      'test',
    ]),
  }])
  .options({})
  .parse();
export default parsed;
