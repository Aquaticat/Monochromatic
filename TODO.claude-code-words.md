# Claude Code status words

**Status: replaced by statusline transcript extraction.**

Claude Code's built-in `spinnerVerbs` picks words randomly from a flat list,
not based on what Claude is actually doing.
This has always been the case; there was never a Haiku call or context-aware selection.
See [anthropics/claude-code#33057](https://github.com/anthropics/claude-code/issues/33057)
for the upstream feature request.

The inaccuracy feels worse with specific words ("Completing" at the start of processing)
than with generic ones ("Thinking"). No amount of curation fixes random selection.

## What replaced it

The [statusline plugin](./packages/claude-code-plugins/statusline/) now extracts
a context-aware gerund from the last 8KB of the session transcript.
Since Claude's prose naturally contains gerunds describing its activity
("Let me search for...", "I'll try refactoring..."),
the displayed word reflects what Claude was most recently talking about.

The built-in spinner is disabled via:

```json
{
  "spinnerVerbs": { "mode": "replace", "verbs": [] },
  "spinnerTipsEnabled": false
}
```

The file-enforcer config (`claude.file-enforcer.config.ts`) that synced the word list
into `spinnerVerbs` has been removed.

## Archived word lists

These lists were curated for the `spinnerVerbs` approach and are no longer active.
Kept for reference.

- [contents](./TODO.claude-code-words.contents.txt) (565 words, alphabetical)
- [sorted](./TODO.claude-code-words.contents.sorted.txt) (same, sorted)

## Words that were excluded

### Negative

```txt
back-firing -- implies failure/backlash
blabbing -- disclosing secrets; betraying confidentiality
cursing -- offensive language/uttering curses
exploiting -- unethical abuse/taking unfair advantage
hexing -- casting a harmful curse
scheming -- plotting with malicious intent
tattling -- informing/snitching on others
```

### Slang/jokes

Tech-culture in-jokes rather than real technical verbs;
read as trying too hard to be clever.

```txt
bikeshedding -- slang for arguing over trivial details
cargo-culting -- slang for copying without understanding
dogfooding -- slang for using your own product
rubberducking -- slang for explaining code to an inanimate object
yak-shaving -- slang for endless prerequisite tasks
```

### Metaphors with no tech meaning

Physical-world metaphors without an actual technical definition;
same exclusion reasoning as maritime, agricultural, and mystical terms.

```txt
crystallizing -- physical chemistry metaphor
percolating -- coffee/fluid dynamics metaphor
siphoning -- fluid transfer metaphor
unraveling -- textile metaphor
```

### Irrelevant

#### Ultra-specific manual crafts (no digital/tech analogy)

```txt
chiffonading -- ultra-specific herb cutting technique
tatting -- obscure lace-making technique
knurling -- metal machining for grip texture
mortising -- woodworking joint cutting
tenoning -- woodworking joint making
purling -- knitting stitch technique
hemming -- sewing edge finishing
veneering -- wood veneer application
```

#### Highly specialized industrial processes

```txt
anodizing -- aluminum surface treatment
calcining -- high-temperature mineral heating
electropolishing -- metal surface finishing
galvanizing -- zinc coating steel
ion-implanting -- semiconductor doping
passivating -- metal corrosion resistance
sintering -- powder metallurgy
```

#### Pre-digital maritime/agricultural

```txt
ballasting -- ship weight distribution
gybing -- sailing maneuver
mooring -- securing boats
reefing -- reducing sail area
threshing -- separating grain
winnowing -- separating chaff
```

#### Biological lab techniques

```txt
cryopreserving -- freezing biological samples
electroporating -- cell membrane permeabilization
immunolabeling -- antibody marking
lyophilizing -- freeze-drying
micropipetting -- precise liquid measurement
PCR-amplifying -- DNA amplification
transfecting -- DNA introduction into cells
```

#### Random animal sounds/domestic chores

```txt
quacking -- duck sounds
barking -- dog sounds
honking -- horn/goose sounds
ironing -- pressing clothes
laundering -- washing clothes
mopping -- floor cleaning
vacuuming -- floor cleaning
```

#### Mystical/fantasy terms

```txt
sigilizing -- creating magical symbols
scrying -- divination/fortune telling
glamouring -- magical illusion
warding -- magical protection
```

### Too general

```txt
abstracting -- too broad; meta-verb without imagery
arranging -- broad; non-specific
assembling -- broad; non-specific
auditing -- generic business/process term
brainstorming -- generic creative task
building -- extremely generic; overused
conceptualizing -- vague ideation verb
connecting -- generic; non-specific
contemplating -- generic thinking verb
contracting -- generic legal/process term
debugging -- ubiquitous; bland
drafting -- generic writing/design step
editing -- very generic document/code action
envisioning -- vague ideation verb
evaluating -- generic assessment
expanding -- generic growth verb
factoring -- generic math/process term
generalizing -- meta and vague
governing -- generic leadership term
grading -- generic assessment
grooming -- generic maintenance term
ideating -- generic ideation verb
integrating -- ubiquitous; bland
leading -- generic leadership term
limiting -- generic constraint verb
linking -- generic connection verb
logging -- ubiquitous; bland
maximizing -- generic optimization verb
mediating -- generic conflict/process term
mending -- generic repair verb
minimizing -- generic optimization verb
mixing -- generic combine verb
monitoring -- ubiquitous ops verb
mutating -- generic change verb
navigating -- generic movement verb
negotiating -- generic process verb
optimizing -- ubiquitous; bland
organizing -- generic arrangement verb
planning -- generic process verb
prioritizing -- generic planning verb
probing -- generic investigation verb
programming -- extremely general
proofreading -- generic editing verb
reducing -- generic decrease verb
reflecting -- generic thinking verb
releasing -- generic deployment verb
reporting -- generic output verb
researching -- generic info-gathering verb
revising -- generic edit verb
roadmapping -- generic planning verb
scheduling -- generic planning verb
searching -- generic; bland
settling -- generic resolution verb
simplifying -- generic improvement verb
solving -- extremely general
sprinting -- generic Agile/process term
strategizing -- generic process verb
surveying -- generic measurement verb
switching -- generic change verb
systematizing -- generic process verb
tagging -- generic labeling verb
talking -- extremely general
turning -- extremely general
witnessing -- generic observation verb
```
