# Independent review of expanded Depot graph failures

## Purpose and scope

Review the original retained graph artifact ZIPs and source-bound command logs,
separating application assertions,
harness/tool prerequisites,
provider access,
and incomplete execution.
This is a read-only evidence review;
it does not dispatch or repair the measured workload.
The application source remains `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.

## Review queue

- Verify the original corrected GitHub run `39140975786` artifacts,
  including all GitHub-hosted and Depot-hosted repeated samples.
- Verify the original native run `gb01kjx2qk` artifacts.
- Review native correction `fnvwqfg0bb` after its existing allocation is terminal.
  No replacement allocation is authorized by this review.
- Classify the exact lint,
  matcher/p-map,
  `wg-allowedips`,
  logger,
  `conf-fork`,
  WebKit OPFS,
  paused-owner discovery,
  budget/unstarted,
  and `newuidmap` boundaries against retained source and logs.
- Send substantive corrections before the whole-report sufficiency review.
  That later review remains dependent on the parent's graph,
  operating-system,
  and semantic queues.

## Publication correction

The platform diagnostic publisher completed with exit `0`.
Its `cli-git` notice naming a future `665` second wait limit did not establish an exhausted wait.
The earlier status wording that it had given up was too strong and is withdrawn.
Direct remote discovery returned `d71c018380e55365bf9dd5131914c2be152f0808` for `refs/heads/main`;
the ancestry check for the diagnostic ledger commit exited `0`.
The [existing wait-notice diagnosis](../troubleshooting/cli-git-push-wait-notice.md)
explains the separate advisory and failure paths.
No concurrent push process was interrupted.

## Current status

The original-archive and claim-level review is in progress.
No conclusion about complete graph acceptance or a provider speed ratio follows from this queue record.
