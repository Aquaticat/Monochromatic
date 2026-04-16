# Claude Code status words

**Status: abandoned.** The `spinnerVerbs` setting is purely cosmetic --
words are picked randomly from the list, not based on what Claude is actually doing.
This has always been the case; there was never a Haiku call or context-aware selection.
See [anthropics/claude-code#33057](https://github.com/anthropics/claude-code/issues/33057)
for the open feature request asking for context-aware verbs.

The inaccuracy feels worse now because the built-in list expanded
from ~56 generic verbs ("Thinking", "Working") to ~185 whimsical ones ("Sparkling", "Blooping").
Generic words never feel wrong; specific words like "Completing" clash with random selection.

No amount of curation fixes a random pick from a flat list.
The lists below make the spinner more interesting to read,
but the inaccuracy problem requires changes to Claude Code itself.

[contents](./TODO.claude-code-words.contents.txt)

[sorted](./TODO.claude-code-words.contents.sorted.txt)

## Words that are not included

### Negative

```txt
back-firing — implies failure/backlash
blabbing — disclosing secrets; betraying confidentiality
cursing — offensive language/uttering curses
exploiting — unethical abuse/taking unfair advantage
hexing — casting a harmful curse
scheming — plotting with malicious intent
tattling — informing/snitching on others
```

### Slang/jokes

Words that are tech-culture in-jokes rather than real technical verbs; they read as trying too hard to be clever.

```txt
bikeshedding — slang for arguing over trivial details
cargo-culting — slang for copying without understanding
dogfooding — slang for using your own product
rubberducking — slang for explaining code to an inanimate object
yak-shaving — slang for endless prerequisite tasks
```

### Metaphors with no tech meaning

Words that are physical-world metaphors without an actual technical definition;
same exclusion reasoning as maritime, agricultural, and mystical terms.

```txt
crystallizing — physical chemistry metaphor
percolating — coffee/fluid dynamics metaphor
siphoning — fluid transfer metaphor
unraveling — textile metaphor
```

### Irrelevant

#### Ultra-specific manual crafts (no digital/tech analogy)

```txt
chiffonading - Ultra-specific herb cutting technique
tatting - Obscure lace-making technique
knurling - Metal machining for grip texture
mortising - Woodworking joint cutting
tenoning - Woodworking joint making
purling - Knitting stitch technique
hemming - Sewing edge finishing
veneering - Wood veneer application
```

#### Highly specialized industrial processes

```txt
anodizing - Aluminum surface treatment
calcining - High-temperature mineral heating
electropolishing - Metal surface finishing
galvanizing - Zinc coating steel
ion-implanting - Semiconductor doping
passivating - Metal corrosion resistance
sintering - Powder metallurgy
```

#### Pre-digital maritime/agricultural

```txt
ballasting - Ship weight distribution
gybing - Sailing maneuver
mooring - Securing boats
reefing - Reducing sail area
threshing - Separating grain
winnowing - Separating chaff
```

#### Biological lab techniques

```txt
cryopreserving - Freezing biological samples
electroporating - Cell membrane permeabilization
immunolabeling - Antibody marking
lyophilizing - Freeze-drying
micropipetting - Precise liquid measurement
PCR-amplifying - DNA amplification
transfecting - DNA introduction into cells
```

#### Random animal sounds/domestic chores

```txt
quacking - Duck sounds
barking - Dog sounds
honking - Horn/goose sounds
ironing - Pressing clothes
laundering - Washing clothes
mopping - Floor cleaning
vacuuming - Floor cleaning
```

#### Mystical/fantasy terms

```txt
sigilizing - Creating magical symbols
scrying - Divination/fortune telling
glamouring - Magical illusion
warding - Magical protection
```

### Too general

```txt
abstracting — too broad; meta-verb without imagery
arranging — broad; non-specific
assembling — broad; non-specific
auditing — generic business/process term
brainstorming — generic creative task
building — extremely generic; overused
conceptualizing — vague ideation verb
connecting — generic; non-specific
contemplating — generic thinking verb
contracting — generic legal/process term
debugging — ubiquitous; bland
drafting — generic writing/design step
editing — very generic document/code action
envisioning — vague ideation verb
evaluating — generic assessment
expanding — generic growth verb
factoring — generic math/process term
generalizing — meta and vague
governing — generic leadership term
grading — generic assessment
grooming — generic maintenance term
ideating — generic ideation verb
integrating — ubiquitous; bland
leading — generic leadership term
limiting — generic constraint verb
linking — generic connection verb
logging — ubiquitous; bland
maximizing — generic optimization verb
mediating — generic conflict/process term
mending — generic repair verb
minimizing — generic optimization verb
mixing — generic combine verb
monitoring — ubiquitous ops verb
mutating — generic change verb
navigating — generic movement verb
negotiating — generic process verb
optimizing — ubiquitous; bland
organizing — generic arrangement verb
planning — generic process verb
prioritizing — generic planning verb
probing — generic investigation verb
programming — extremely general
proofreading — generic editing verb
reducing — generic decrease verb
reflecting — generic thinking verb
releasing — generic deployment verb
reporting — generic output verb
researching — generic info-gathering verb
revising — generic edit verb
roadmapping — generic planning verb
scheduling — generic planning verb
searching — generic; bland
settling — generic resolution verb
simplifying — generic improvement verb
solving — extremely general
sprinting — generic Agile/process term
strategizing — generic process verb
surveying — generic measurement verb
switching — generic change verb
systematizing — generic process verb
tagging — generic labeling verb
talking — extremely general
turning — extremely general
witnessing — generic observation verb
```
