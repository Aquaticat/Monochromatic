# Gating changes with an AI review

You want changes looked at by an AI before,
 or at least right after,
 they become permanent.
 This repo is
just you,
 so there is no human reviewer;
 an AI is the realistic second pair of eyes.
 This file lays out
every realistic way to do that,
 in plain language,
 so you can pick later.
 Nothing here is built yet.

## Where things stand today

- The `pre-push` hook is git-lfs boilerplate only.
   It runs no review.
- `claude-code-review.yml` is wired to fire only on pull requests,
   which you almost never open,
   and the
  underlying Anthropic GitHub action is broken on Anthropic's side.
   So it is dead twice over.
   The file is
  safe to delete.
- The `*` branch protection rule asks for "status checks" but names none,
   so it enforces nothing.
- Net result:
   there is no review gate right now.

## Two decisions that shape everything

First,
 when does the review run?

- Per commit:
   too often.
   You commit hundreds of times a day,
   so reviewing each one is too slow and too
  expensive.
   Skip this.
- Per push (the sweet spot):
   you gather many commits,
   then push.
   Review the whole bundle once,
   right
  before it leaves your machine.
- After it is on GitHub:
   reviews what already landed.
   A safety net,
   not a gate.

Second,
 does it block or just advise?

- Advise:
   it shows findings and lets you proceed.
   It never wrongly stops you.
- Block:
   it refuses the push until you deal with the findings.
   Real teeth,
   but an AI is not perfectly
  consistent,
   so it will occasionally stop a perfectly good push.

## One more idea: independent review

There is a difference between the AI that wrote the code checking its own work,
 and a separate reviewer
looking with fresh eyes.
 Your own repo rules (`doc/agent/self-review.md`,
 and the CKB rule in `AGENTS.md`)
say self-review is not real evidence.
 So a separate engine is worth more as a gate than the same model
re-reading its own diff.
 Keep that in mind when picking who does the reviewing.

## The engines (who does the reviewing)

- Claude Code `/code-review`:
   you already have it.
   Runs locally against a diff.
   No new account,
   no
  per-file cost.
   It is the same vendor family as a lot of your coding,
   so it is the least independent of
  the real options.
- pi review (pi.
  dev):
   pi is your other harness,
   currently running codex `gpt-5.5`.
   It has no built-in
  code review of git changes.
   You would script one as a fresh,
   headless pi run (print or JSON mode) handed
  just the push diff plus a review prompt.
   Note that your `packages/pi-plugin/advisor` extension is not the tool
  for this:
   it reviews the current session's conversation with a secondary model (modelled after Claude
  Code's Advisor),
   which is exactly the same-session self-review your rules call non-independent.
   A fresh
  pi run on only the diff is more independent than that,
   though still your own model.
- CodeRabbit CLI:
   a hosted reviewer with a local command (`cr`),
   installed with a curl one-liner.
   It
  reviews staged,
   unstaged,
   or committed changes right in the terminal,
   and is built to slot into Claude
  Code and Codex loops before any pull request exists.
   It is a genuinely independent engine.
   Free tier is
  3 reviews per hour;
   unlimited is usage-based at 0.25 USD per file reviewed.
   Your code is sent to
  CodeRabbit's service,
   which is the privacy trade.
   See [CodeRabbit CLI][cr-cli] and [pricing notes][cr-blog].
- CodeRabbit,
   Greptile,
   or Qodo in pull-request mode:
   the classic hosted setup.
   Strong independent review,
  but only on pull requests,
   which you do not open.
- claude-code-action (the dead one):
   broken Anthropic-side.
   Not available.

## The options

### Option 1: CodeRabbit CLI at pre-push, advisory

A hook runs `cr` on what you are about to push,
 prints the findings,
 and lets the push through.

- Good:
   an independent second opinion at the right moment;
   fits direct-to-main with no PRs;
   low to build
  (install plus a hook);
   never false-stops you.
- Bad:
   your code leaves your machine to a third party;
   the free tier is 3 reviews per hour,
   which bursty
  pushes can hit,
   and the paid rate of 0.25 USD per file adds up on a big push;
   it adds some latency to
  every push.

### Option 2: Claude Code /code-review at pre-push, advisory

Same shape,
 but the reviewer is the `/code-review` you already have.

- Good:
   nothing new to install or sign up for;
   no per-file cost;
   your code stays inside tools you already
  use.
- Bad:
   less independent than a separate product;
   still spends tokens and adds latency on every push.

### Option 3: pi-driven review at pre-push (DIY, fresh pi run on the diff)

A hook hands the push diff to a fresh headless `pi` run (print or JSON mode) with a review prompt,
 using a
model you choose,
 for example codex `gpt-5.5`.

- Good:
   your harness,
   your model choice,
   no extra vendor;
   folds into the pi setup you already run.
- Bad:
   you build and maintain it;
   do not use the `advisor` extension for this,
   since it reviews the
  session conversation,
   which your rules flag as non-independent;
   the most effort of the local options.

### Option 4: any of the above, but blocking

Same as 1 through 3,
 except the hook refuses the push when it finds serious issues.

- Good:
   an actual hard gate,
   which is what "gated" literally means.
- Bad:
   occasional false-stops at bad moments;
   latency on every push.
   Best adopted after you already trust
  the advisory version.

### Option 5: CodeRabbit, Greptile, or Qodo in pull-request mode

Adopt branches and pull requests so a hosted reviewer gates each merge into main.

- Good:
   the textbook independent gate;
   durable review threads;
   tidy history as a bonus.
- Bad:
   makes you adopt the branch and pull-request workflow you avoid;
   the most ceremony and the biggest
  change to how you work.

### Option 6: manual, run a review yourself before pushing

Run `/code-review` or `cr` by hand when you remember.

- Good:
   zero setup.
- Bad:
   not a gate;
   you push in bursts and will forget.

## Which to pick

Ranking by fit for you:
 **1 > 2 > 4 > 3 > 6 > 5.
**

- 1 beats 2 because both are advisory pre-push checks,
   but CodeRabbit is a genuinely independent engine,
  which your own rules say is worth more than self-review,
   and it is built for exactly this direct-to-main,
  pre-PR loop.
   The price is cost and sending code to a third party.
   If either of those bothers you,
   swap to
  2 as your first choice.
- 2 beats 4 because you should start advisory before blocking:
   same review,
   none of the false-stop tax,
  and you can promote it to blocking once you trust it.
- 4 beats 3 because a blocking gate on a ready-made reviewer gives you teeth with no build,
   while the DIY
  pi route is more work for the same outcome and carries the independence caveat.
- 3 beats 6 because a built pi reviewer at least runs automatically,
   while the manual habit depends on
  memory you have already shown you skip.
- 6 beats 5 because,
   if you are not adopting pull requests,
   the manual stopgap costs nothing,
   while PR
  mode is the heaviest change and fights your whole workflow.

One sentence:
 try the CodeRabbit CLI as an advisory pre-push check first;
 if the cost or sending code out
bothers you,
 use your local `/code-review` the same way;
 tighten to blocking only once it has earned your
trust.

## Cost and your own guard rules

Any push-time review spends money or tokens on every push,
 and per your SPG rule about runaway agent token
burn,
 the hook must be guarded:
 skip when already inside an agent session,
 skip trivially small or
enormous diffs,
 and only run when pushing to main.
 Those guards get baked in whichever engine you choose.

[cr-cli]: https://www.coderabbit.ai/cli
[cr-blog]: https://www.coderabbit.ai/blog/coderabbit-cli-free-ai-code-reviews-in-your-cli
