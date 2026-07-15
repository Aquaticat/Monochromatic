# Git policy authoring contract

Neutral source contract shared by cli-git and repo-owned policy packages.
It prevents policy implementations from depending back on the cli-git executable package.

Consumers outside this workspace import authoring helpers and policy types from
`@monochromatic-dev/git-policy-cli`.
This private package is bundled into cli-git's single MJS artifact and is not published independently.
