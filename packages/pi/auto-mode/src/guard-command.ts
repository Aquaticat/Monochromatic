/**
 * `/guard` command registration.
 *
 * Keeps trust-directive command handling out of the extension entry point so
 * index.ts stays focused on lifecycle wiring.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import { TRUST_ENTRY_TYPE, } from './types.ts';

/**
 * Register `/guard` trust-directive command.
 *
 * @param pi - extension API used to register commands and persist entries
 *
 * @example
 * ```typescript
 * registerGuardCommand({ pi });
 * ```
 */
function registerGuardCommand(
  {
    pi,
  }: {
    readonly pi: ExtensionAPI;
  },
): void {
  pi.registerCommand(
    'guard',
    {
      description: 'Manage auto-mode: /guard <trust directive> or /guard reset',
      async handler(
        args: string,
        ctx: ExtensionContext,
      ) {
        /**
         * Dynamically imported context helper; lazy to keep startup cost low when /guard is never used.
         */
        const { getTrustDirectives, } = await import('./context.ts');
        /**
         * Trimmed argument string; empty string falls through to the list-directives branch.
         */
        const trimmed = args.trim();
        if (trimmed === '') {
          /**
           * Current trust directives for the session, listed back to the user when `/guard` is bare.
           */
          const directives = getTrustDirectives(ctx,);
          if (directives.length
            === 0)
            ctx.ui
              .notify('No trust directives set for this session.',);
          else {
            ctx.ui
              .notify(
              `Trust directives:\n${
                directives
                  .map(
                    function formatDirective(
                      directive,
                      index,
                    ) {
                      return `  ${index + 1}. ${directive}`;
                    },
                  )
                  .join('\n',)
              }`,
            );
          }
          return;
        }
        if (trimmed === 'reset') {
          pi.appendEntry(
            TRUST_ENTRY_TYPE,
            null,
          );
          ctx.ui
            .notify('Trust directives cleared for this session.',);
          return;
        }
        pi.appendEntry(
          TRUST_ENTRY_TYPE,
          trimmed,
        );
        ctx.ui
          .notify(`Trust directive added: ${trimmed}`,);
      },
    },
  );
}

export { registerGuardCommand, };
