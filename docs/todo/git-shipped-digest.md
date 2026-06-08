# Reading what shipped this week

The problem:
 in a busy week this repo gets a few hundred commits (383 in the last 7 days).
 Read as one
long list,
 that is unreadable soup.
 The good news is that almost every commit you make starts with a
label like `fix(music-player):` or `feat(kv-store):`.
 Anything that groups commits by those labels turns
hundreds of lines into a short,
 readable summary.

Here are the ways to get that summary,
 written for someone who knows `git commit` and `git push` and not
much else,
 ordered from least setup to most.
 The maintained helper script option is deliberately left
out,
 because the goal is to not own more tooling.

## Option 1: run one command when you are curious (owns nothing)

This is the lowest-effort path.
 You paste a single line into the terminal and it prints the week's
commits sorted,
 which groups all the `feat(...)` together,
 all the `fix(...)` together,
 and so on.
 There
is nothing to install and nothing to maintain.
 The only thing to remember is that this file exists.

```bash
# everything from the last week, grouped because sorting clusters the same labels together
git log --since='1 week ago' --pretty=format:'%s' | sort
```

If you only want the headline ("how much of each kind shipped"),
 this prints a tally:

```bash
# count commits by their label type: feat, fix, docs, etc.
git log --since='1 week ago' --pretty=format:'%s' | sed -E 's/^([a-z]+).*/\1/' | sort | uniq -c | sort -rn
```

- Good:
   nothing to install,
   nothing to own,
   works today.
- Bad:
   you run it by hand each time,
   and a malformed commit (a few have giant one-line bodies) looks ugly
  in the output.

## Option 2: git-cliff (a changelog generator)

git-cliff is a small program that reads those same commit labels and writes a tidy `CHANGELOG.md` file,
split into sections like "Features" and "Bug fixes".
 You install it once,
 add a small settings file
(`cliff.toml`),
 and run one command to regenerate the changelog whenever you want.

Be warned:
 this is exactly the "own more tooling" you said you would rather avoid.
 It is a new program
plus a settings file that needs tuning,
 especially because this repo produces a lot of `docs` commits
that you would want the settings to fold away.
 It is included here only because you asked for every
option.

- Good:
   the most polished,
   durable output;
   nicely grouped sections;
   can target a date range.
- Bad:
   a new program and a settings file to own and tune.
   Against your stated preference.

## Option 3: weekly tags (one new command to learn)

A tag is a sticky note you stick on a commit to mark a moment,
 like "end of this week".
 This teaches you
exactly one new command,
 `git tag`,
 and reuses the `push` you already know.

```bash
# once a week, mark the moment and push the mark
git tag week-2026-06-05
git push --tags

# later, list what landed between two weekly marks
git log week-2026-05-29..week-2026-06-05 --oneline
```

- Good:
   durable markers,
   almost no new knowledge,
   nothing to install.
- Bad:
   a tag only marks a boundary,
   it does not group.
   Pair it with the Option 1 command to actually read
  what is between two marks,
   and you have to remember to tag.

## Option 4: squash-merge through GitHub (biggest change)

Instead of committing straight to `main`,
 you would do a chunk of work on a side branch,
 then on GitHub
press the "Squash and merge" button,
 which collapses all those little commits into one tidy entry on
`main`.
 Then "what shipped" is simply the short list of those single entries.

This is the cleanest possible history,
 but it is the biggest change to how you work:
 branch,
 push the
branch,
 open a pull request,
 click merge,
 every time.
 It fights your current habit of committing straight
to `main`,
 which suits you fine.
 And because this repo is just you,
 the "review" part of a pull request
is pointless,
 since there is no second person to review it.

- Good:
   the cleanest "what shipped" view,
   for free,
   once adopted.
- Bad:
   the most ceremony,
   fights how you actually work,
   and the review purpose does not apply to a
  solo repo.

## Which to pick

Ranking for a two-command setup that will not own tooling:
**Option 1 (run a command) > Option 3 (tags) > Option 2 (git-cliff) > Option 4 (squash-merge).
**

- Option 1 beats Option 3 because it actually groups and shows the answer immediately,
   while a tag only
  marks a boundary and still needs a command to read between marks.
- Option 3 beats Option 2 because a tag costs one command and zero installed programs,
   while git-cliff is
  the "own more tooling" you ruled out.
- Option 2 beats Option 4 because git-cliff produces the tidy result without changing how you commit,
  while squash-merge makes you adopt branches and pull requests you currently never use.

If you ever stop minding one tiny owned tool,
 the maintained helper script (left out here) or git-cliff
would just run Option 1 for you automatically,
 so you would not paste it by hand.
