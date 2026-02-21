# Figma and browser automation: the WebGL wall

## The problem

AI agents cannot meaningfully interact with Figma designs through browser automation tools (BrowserOS, Playwright, Puppeteer, etc.).
The design canvas is rendered entirely in WebGL -- there is no DOM representation of frames, layers, text, or interactive elements inside the canvas.
Browser automation can see and click Figma's *chrome* (toolbars, panels, menus, layer names) but is completely blind to the actual design content.

## What this means in practice

- **Screenshots show pixels, not structure** -- the agent can take a screenshot but cannot inspect, query, or programmatically read anything on the canvas
- **Clicking is coordinate guessing** -- without DOM nodes, hitting a specific frame or element requires pixel-coordinate estimation from screenshots
- **Zoom is stuck** -- Figma's keyboard shortcuts (Shift+1 to zoom-to-fit, Shift+2 to zoom-to-selection) are captured by the WebGL canvas before reaching the DOM event system, so dispatching them via JavaScript has no effect
- **Prototype previews are also WebGL** -- even the inline preview panel renders phone frames as canvas content, not DOM
- **Figma comments are inaccessible** -- comments are rendered in the canvas overlay system and are not exposed as DOM elements that automation can read

## What each tool can and cannot do

### Figma MCP (REST API based)

**Can do:**
- Read node tree structure and metadata
- Render specific nodes as static PNG screenshots
- Read component properties, styles, variables
- Access file/page metadata

**Cannot do:**
- Read Figma comments
- Run or interact with prototypes
- See prototype transitions and interaction hotspots
- Observe variable mode switching in real time
- Access annotation or dev mode markup

### Browser automation (BrowserOS, Playwright, etc.)

**Can do:**
- See and click Figma's toolbar, panels, menus
- Navigate between pages in the sidebar
- Open the prototype preview panel
- Click "Next frame" / "Previous frame" in prototype preview
- Take screenshots of whatever is visible (but at whatever zoom level Figma decides)

**Cannot do:**
- Read any text rendered on the canvas
- Click on specific design frames or elements
- Zoom to a specific frame reliably
- Read prototype interaction flows
- Extract design specs (spacing, colors, fonts) from the canvas
- Read comments or annotations

### "Claude in Chrome" / human-in-the-loop

**Best current option for full context.**
The human navigates to the relevant frame, and the agent analyzes the screenshot visually.
Clunky, slow, and requires manual effort -- but actually works.

## Workarounds

### For design audits

1.  Use Figma MCP for structured node data and static frame screenshots
2.  Have the human manually screenshot specific screens, prototype flows, and comment threads
3.  Have the human paste comment text directly into the conversation
4.  Combine both data sources in the agent's analysis

### For prototype review

No automated solution exists.
The human must run the prototype manually and either screen-record or screenshot each state.

### For comment review

No automated solution exists.
The human must copy-paste comment text or screenshot comment threads.

## Root cause

Figma chose WebGL for performance -- rendering thousands of vector objects in the DOM would be unusable.
This is the correct engineering decision for a design tool, but it makes the application opaque to every accessibility and automation API that depends on DOM structure.
Figma's own accessibility features (screen reader mode) provide limited text alternatives, but these are not sufficient for design review automation.

## What would actually fix this

- Figma exposing comments, prototype flows, and annotation data through their REST API or MCP plugin
- A dedicated Figma MCP that wraps the full API surface (comments, prototype links, dev mode annotations), not just the node tree
- Figma providing a "headless prototype runner" API that returns frame sequences for a given interaction flow

None of these exist as of February 2026.
