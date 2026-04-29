# @monochromatic-dev/figma-to-penpot

Figma export file to Penpot file format converter.

Converts decoded Figma Kiwi documents (from `@monochromatic-dev/figma-kiwi`)
into Penpot binfile-v3 format: a ZIP archive of JSON files following the
`penpot/export-files` schema that can be imported directly into Penpot.

## Supported formats

- `.fig` -- Figma design files; each CANVAS becomes a Penpot page
- `.deck` -- Figma presentation decks; each SLIDE becomes a Penpot page
- `.jam` -- FigJam whiteboards; each CANVAS becomes a Penpot page

## Usage

```ts
import { parseFigmaFile, } from '@monochromatic-dev/figma-kiwi';
import {
  convertFigmaToPenpot,
  serializePenpotZip,
} from '@monochromatic-dev/figma-to-penpot';
import { writeFile, } from 'node:fs/promises';

// Parse the Figma file
const figmaFile = await parseFigmaFile('input.fig',);

// Convert to Penpot data model
const penpotDoc = convertFigmaToPenpot(figmaFile, { fileName: 'My Design', },);

// Serialize to .penpot ZIP
const zipBuffer = await serializePenpotZip(penpotDoc,);

// Write to file
await writeFile('output.penpot', zipBuffer,);
```

Or use the convenience function that combines conversion and serialization:

```ts
const zipBuffer = await figmaToPenpot(figmaFile, 'output.penpot',);
```

## CLI

```sh
bun packages/figma-parsers/penpot/scripts/convert.ts input.fig [output.penpot]
```

## Type mapping

| Figma NodeType                 | Penpot shape type    |
| ------------------------------ | -------------------- |
| CANVAS                         | frame (becomes page) |
| FRAME / SECTION / STICKY       | frame                |
| GROUP                          | group                |
| SLIDE (deck)                   | frame (becomes page) |
| TEXT                           | text                 |
| ROUNDED_RECTANGLE / RECTANGLE  | rect                 |
| ELLIPSE                        | circle               |
| VECTOR / LINE / STAR / POLYGON | path                 |
| BOOLEAN_OPERATION              | bool                 |
| SYMBOL / INSTANCE / COMPONENT  | frame                |

Nodes with no Penpot equivalent (DOCUMENT, NONE, NODE, SLIDE_GRID,
SLIDE_ROW, VARIABLE, VARIABLE_SET) are skipped.

## Limitations

- Gradient fills and image fills are not yet converted (only solid fills)
- Figma components and instances are converted as plain frames
- Text style mapping is minimal (font, size, weight, color)
- Layout properties (auto-layout, constraints) are not mapped
- Plugin data, design tokens, and color/typography libraries are not converted
