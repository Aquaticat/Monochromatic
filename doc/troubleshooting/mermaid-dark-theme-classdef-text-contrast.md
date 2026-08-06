# Mermaid 11.16.1 dark theme with fill-only `classDef` styles produces unreadable light nodes

Status:
 resolved in this repository by commit `e917b3e10`.
This is a consumer styling error,
not a confirmed Mermaid defect.

## Symptom

A Mermaid flowchart rendered with `theme: 'dark'` can show nearly white text
inside nearly white boxes when a `classDef` sets a light `fill` but does not set
`color`.
In `doc/audit/oxlint-rule-architecture-review.html`,
the affected declarations had this shape before `e917b3e10`:

```mermaid
flowchart LR
  A["light rose fill"]
  classDef leak fill:#fff1f2,stroke:#e11d48,stroke-width:2px;
  class A leak;
```

The report also supplied a global dark-theme text color at
`doc/audit/oxlint-rule-architecture-review.html:293-300`:

```javascript
const darkThemeVariables = {
  edgeLabelBackground: documentStyles.getPropertyValue('--color-dark-surface-2').trim(),
  textColor: documentStyles.getPropertyValue('--color-dark-text').trim(),
};
// ...
theme: preferredColorScheme.matches ? 'dark' : 'neutral',
themeVariables: preferredColorScheme.matches ? darkThemeVariables : {},
```

That combination produced these measured pairs:

- Light green nodes: foreground `rgb(248, 250, 252)`,
  background `rgb(236, 253, 245)`,
  contrast `1.01:1`.
- Light rose nodes: foreground `rgb(248, 250, 252)`,
  background `rgb(255, 241, 242)`,
  contrast `1.05:1`.
- Twenty-three of 58 rendered flowchart nodes were below `4.5:1`.

The page itself had no JavaScript error.
Axe reported the SVG `foreignObject` nodes as inconclusive rather than as
contrast violations,
so a zero-violation Axe result did not prove the diagrams were readable.

## Root cause

The failure comes from composing two independent style sources:
Mermaid chooses a theme-wide label color,
while `classDef` copies the author's fill directly.
Mermaid does not derive a new foreground color from an explicit class fill.

### Step 1: the dark theme supplies a light default label color

Mermaid maps the `dark` theme name to `theme-dark.js` in
`packages/mermaid/src/themes/index.js:17-19` at release commit
`7ecca0cd7f1658ef74f4e7e91f925724ef403bbf`:

```javascript
dark: {
  getThemeVariables: darkThemeVariables,
},
```

The theme sets its default text color to `#ccc` in
`packages/mermaid/src/themes/theme-dark.js:30`:

```javascript
this.textColor = '#ccc';
```

Flowchart CSS then uses `nodeTextColor` or falls back to `textColor` in
`packages/mermaid/src/diagrams/flowchart/styles.ts:36-52`:

```typescript
`.label {
  font-family: ${options.fontFamily};
  color: ${options.nodeTextColor || options.textColor};
}
// ...
.label text,span {
  fill: ${options.nodeTextColor || options.textColor};
  color: ${options.nodeTextColor || options.textColor};
}
```

The report's `themeVariables.textColor` changed that fallback from Mermaid's
`#ccc` to `#f8fafc`.
This made the symptom look white-on-white,
but it was only an amplifier:
the stock dark theme still measured `1.46:1` on the light rose fill and
`1.52:1` on the light green fill.

### Step 2: `classDef` records fill and text color as separate properties

The flowchart grammar forwards every `classDef` property to `addClass` in
`packages/mermaid/src/diagrams/flowchart/parser/flow.jison:533-535`:

```jison
classDefStatement:CLASSDEF SPACE idString SPACE stylesOpt
    {$$ = $CLASSDEF;yy.addClass($idString,$stylesOpt);}
```

`addClass` stores every property as a node style,
but only an explicit property containing `color` is also recorded as a text
style.
The deciding code is in
`packages/mermaid/src/diagrams/flowchart/flowDb.ts:406-427`:

```typescript
public addClass(ids: string, _style: string[]) {
  const style = _style
    .join()
    .replace(/\\,/g, '§§§')
    .replace(/,/g, ';')
    .replace(/§§§/g, ',')
    .split(';');
  ids.split(',').forEach((id) => {
    let classNode = this.classes.get(id);
    if (classNode === undefined) {
      classNode = { id, styles: [], textStyles: [] };
      this.classes.set(id, classNode);
    }

    style.forEach((s) => {
      if (/color/.exec(s)) {
        const newStyle = s.replace('fill', 'bgFill');
        classNode.textStyles.push(newStyle);
      }
      classNode.styles.push(s);
    });
  });
}
```

A fill-only class therefore has no label-specific override.
There is no call in this path that measures contrast or derives `color` from
`fill`.

### Step 3: the renderer intentionally applies shape and label styles separately

`styles2String` classifies `color` as a label property and all other node
properties as shape properties in
`packages/mermaid/src/rendering-util/rendering-elements/shapes/handDrawnShapeStyles.ts:61-85`:

```typescript
export const styles2String = (node: Node) => {
  const { stylesArray } = compileStyles(node);
  const labelStyles: string[] = [];
  const nodeStyles: string[] = [];

  stylesArray.forEach((style) => {
    const key = style[0];
    if (isLabelStyle(key)) {
      labelStyles.push(style.join(':') + ' !important');
    } else {
      nodeStyles.push(style.join(':') + ' !important');
    }
  });

  return {
    labelStyles: labelStyles.join(';'),
    nodeStyles: nodeStyles.join(';'),
    // ...
  };
};
```

For a rectangle,
`drawRect` assigns `labelStyles` to `node.labelStyle` and `nodeStyles` to the
shape at
`packages/mermaid/src/rendering-util/rendering-elements/shapes/drawRect.ts:14-17`
and `:51-55`:

```typescript
const { labelStyles, nodeStyles } = styles2String(node);
node.labelStyle = labelStyles;
// ...
rect
  .attr('class', 'basic label-container')
  .attr('style', nodeStyles)
```

`labelHelper` then places that separate label style on the label group at
`packages/mermaid/src/rendering-util/rendering-elements/shapes/util.ts:27-34`:

```typescript
const labelEl = shapeSvg
  .insert('g')
  .attr('class', 'label')
  .attr('style', handleUndefinedAttr(node.labelStyle));
```

With only `fill:#fff1f2`,
the rectangle gets a light inline fill and the label group gets no inline color.
The label therefore keeps the light dark-theme fallback.
With `color:#0f172a`,
the label receives `color:#0f172a !important` and becomes readable.

### Corrected hypotheses

The hypothesis that Mermaid ignored an explicitly supplied `color` was wrong.
The release harness measured `16.25:1` after adding `color:#0f172a`.
The historical issue [mermaid-js/mermaid#1955][issue-1955] concerned that older,
now-fixed inability to apply class text color;
PR [mermaid-js/mermaid#1956][pr-1956] added the supported path in 2021.

The report's global white text override was not the root cause.
Removing it changes the bad pair from roughly `1.05:1` to `1.46:1`,
which remains unreadable.
The missing foreground property in each light `classDef` was the deciding input.
