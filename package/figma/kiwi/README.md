# @monochromatic-dev/figma-kiwi

Parser for Figma's exported binary file formats (.
fig,
 .
deck,
 .
jam).

These files use the Kiwi serialization format (github.
com/evanw/kiwi)
with a ZIP container.
 This package extracts and decodes the complete
file contents including the scene graph,
 metadata,
 and embedded images.

## File structure

All three formats share the same ZIP-based container:

- `canvas.fig`:
   Binary blob:
   16-byte header + deflate-compressed Kiwi schema + zstd-compressed document data
- `meta.json`:
   File metadata (background color,
   render bounds,
   export timestamp)
- `thumbnail.png`:
   Preview image
- `images/`:
   Referenced image assets (SHA-1 hash filenames)

## Usage

```typescript
import { parseFigmaFile, } from '@monochromatic-dev/figma-kiwi';

const file = await parseFigmaFile('/path/to/design.fig',);

console.log(file.fileType,); // "fig" | "deck" | "jam"
console.log(file.meta.fileName,);
console.log(file.document?.nodeChanges?.length,);
console.log(file.images.size,);
```

## Decoded document structure

The document is a `Message` struct containing `nodeChanges`:
 an array
of `NodeChange` messages,
 each representing a node in the scene graph.
Each node has fields like:

- `guid`:
   Unique identifier (sessionID + localID)
- `type`:
   Node type (DOCUMENT,
   CANVAS,
   FRAME,
   TEXT,
   ELLIPSE,
   etc.)
- `name`:
   Node name
- `visible`:
   Visibility flag
- `opacity`:
   Opacity value
- `parentIndex`:
   Parent reference (guid + position string)
- `transform`:
   2D transform matrix
- `size`:
   Dimensions (x,
   y)
- Many more properties depending on node type

## Kiwi encoding details

Figma uses the stock Kiwi binary format from evanw/kiwi with these
encoding rules:

- **MESSAGE**:
   Tagged fields with `tag(varuint)` + value,
   terminated by tag 0
- **STRUCT**:
   All fields in order without tags or terminators
- **ENUM**:
   Single varuint value
- **float**:
   VarFloat encoding (1 byte for 0.0,
   4 bytes otherwise with bit rotation)
- **string**:
   Null-terminated UTF-8
- **Array**:
   `count(varuint)` followed by count values

See `RESEARCH.md` for the full reverse engineering notes.
