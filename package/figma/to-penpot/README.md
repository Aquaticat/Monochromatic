# @monochromatic-dev/figma-to-penpot

Figma export file to Penpot file format converter.

Converts decoded Figma Kiwi documents (from `@monochromatic-dev/figma-kiwi`)
into Penpot binfile-v3 format:
 a ZIP archive of JSON files following the
`penpot/export-files` schema that can be imported directly into Penpot.

## Supported formats

- `.fig`:
   Figma design files;
   each CANVAS becomes a Penpot page
- `.deck`:
   Figma presentation decks;
   each SLIDE becomes a Penpot page
- `.jam`:
   FigJam whiteboards;
   each CANVAS becomes a Penpot page

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
node package/figma/to-penpot/src/convert.ts input.fig [output.penpot]
```

## Type mapping

<table>
<thead>
<tr>
<th>Figma NodeType</th>
<th>Penpot shape type</th>
</tr>
</thead>
<tbody>
<tr>
<td>CANVAS</td>
<td>frame (becomes page)</td>
</tr>
<tr>
<td>FRAME / SECTION / STICKY</td>
<td>frame</td>
</tr>
<tr>
<td>GROUP</td>
<td>group</td>
</tr>
<tr>
<td>SLIDE (deck)</td>
<td>frame (becomes page)</td>
</tr>
<tr>
<td>TEXT</td>
<td>text</td>
</tr>
<tr>
<td>ROUNDED_RECTANGLE / RECTANGLE</td>
<td>rect</td>
</tr>
<tr>
<td>ELLIPSE</td>
<td>circle</td>
</tr>
<tr>
<td>VECTOR / LINE / STAR / POLYGON</td>
<td>path</td>
</tr>
<tr>
<td>BOOLEAN_OPERATION</td>
<td>bool</td>
</tr>
<tr>
<td>SYMBOL / INSTANCE / COMPONENT</td>
<td>frame</td>
</tr>
</tbody>
</table>

Nodes with no Penpot equivalent (DOCUMENT,
 NONE,
 NODE,
 SLIDE_GRID,
SLIDE_ROW,
 VARIABLE,
 VARIABLE_SET) are skipped.

## Verification

The converter's output has been structurally verified against a
reference Penpot file (Teto.
penpot,
 1934 entries,
 Penpot 2.14.3 export).

Conformance checks:

- **ZIP structure**:
   matches `manifest.json` → `files/{id}.json` →
  `files/{id}/pages/{pageId}.json` → `files/{id}/pages/{pageId}/{shapeId}.json`
- **Manifest**:
   `type: "penpot/export-files"`,
   `version: 1`,
  `referer: "penpot"`,
   `files` array with `id`,
   `name`,
   `features`
- **Page JSON**:
   `id`,
   `name`,
   `background` (hex),
   `index`
- **Shape JSON**:
   all core keys present (`id`,
   `name`,
   `type`,
   `x`,
   `y`,
  `width`,
   `height`,
   `rotation`,
   `selrect`,
   `points`,
   `transform`,
  `transformInverse`,
   `parentId`,
   `frameId`,
   `flipX`,
   `flipY`,
   `fills`,
  `strokes`,
   `pageId`)
- **Root frame**:
   zero UUID,
   0.01x0.01 dimensions,
   identity transform
- **frameId convention**:
   frames reference parent frame (not self),
  matching Penpot's behavior where frameId == parentId for frame shapes

Differences from reference (minor,
 not expected to block import):

- Missing optional fields:
   `hideInViewer`,
   `r1`-`r4` (border radii),
  `shapeRef`,
   `touched`,
   `shadow`
- Missing `components/` and `media/` directories (no component or
  image support yet)
- Extra fields not in reference:
   `showContent`,
   `proportion`,
  `proportionLock`

Browser import was not completed due to Penpot's lack of a direct file
upload API accessible from automated tools (no CDP file input support,
httpOnly session cookies prevent curl-based import,
 and the browser
file dialog is not automatable from CDP).
 The structural verification
above provides confidence the format is correct.

## Limitations

- Gradient fills and image fills are not yet converted (only solid fills)
- Figma components and instances are converted as plain frames
- Text style mapping is minimal (font,
   size,
   weight,
   color)
- Layout properties (auto-layout,
   constraints) are not mapped
- Plugin data,
   design tokens,
   and color/typography libraries are not converted
