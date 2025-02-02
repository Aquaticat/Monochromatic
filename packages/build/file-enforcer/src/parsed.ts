import { findUp } from 'find-up';
import resolve from 'oxc-resolver';
import { z } from 'zod';
import { parser } from 'zod-opts';

const parsed: {
  config: string;
} = parser()
  .options({
    config: {
      type: z
        .string()
        .transform((val, ctx) => {
          const oxcResolveResult = resolve.sync(process.cwd(), val);
          if (oxcResolveResult.error) {
            ctx.addIssue({
              message: `oxc resolver error: ${oxcResolveResult.error}`,
              code: z.ZodIssueCode.custom,
              fatal: true,
            });
            return z.NEVER;
          }

          return oxcResolveResult.path!;
        })
        .default((await findUp('file-enforcer.toml'))!)
        .describe(
          'Absolute path to specification file. Or a relative path to current working directory. If not provided, will find the closest "file-enforcer.toml" in parent directories.',
        ),
    },
  })
  .parse();
export default parsed;
