/**
 * HTML document structure for the doodle widget.
 *
 * Uses h-html to produce a self-contained page with inlined CSS,
 * JavaScript, and the default SVG background overlay.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

/**
 * Renders a single radio toggle option inside the toggle group.
 *
 * @param id - unique element id for the radio input
 *
 * @param name - shared radio group name
 *
 * @param label - visible label text
 *
 * @param checked - whether this option is initially selected
 *
 * @returns label-wrapped radio input HTML string
 */
function renderToggleOption({ id, name, label, checked }: {
  id: string;
  name: string;
  label: string;
  checked: boolean;
}): string {
  return h({
    tag: 'label',
    class: 'toggle-option',
    children: [
      h({
        tag: 'input',
        attrs: {
          type: 'radio',
          name,
          id,
          value: id,
          ...(checked ? { checked: '' } : {}),
        },
      }),
      h({ tag: 'span', text: label, }),
    ],
  });
}

/**
 * Renders the toolbar with tool selection, upload, and clear controls.
 *
 * @returns toolbar HTML string
 */
function renderToolbar(): string {
  return h({
    tag: 'div',
    class: 'toolbar',
    children: [
      h({ tag: 'span', class: 'toolbar-title', text: 'Doodle', }),
      h({
        tag: 'div',
        class: 'toggle-group',
        children: [
          renderToggleOption({ id: 'tool-draw', name: 'tool', label: 'Draw', checked: true, }),
          renderToggleOption({ id: 'tool-text', name: 'tool', label: 'Text', checked: false, }),
        ],
      }),
      h({ tag: 'button', attrs: { id: 'upload-btn', type: 'button', }, text: 'Upload background', }),
      h({ tag: 'input', attrs: { type: 'file', id: 'upload-input', accept: 'image/*,.svg', hidden: '', }, }),
      h({ tag: 'button', attrs: { id: 'clear-btn', type: 'button', }, text: 'Clear', }),
    ],
  });
}

/**
 * Renders the canvas container with drawing surface and SVG overlay.
 *
 * @param svgContent - processed SVG string (white background removed)
 *
 * @returns canvas container HTML string
 */
function renderCanvasContainer(svgContent: string): string {
  return h({
    tag: 'div',
    attrs: { id: 'canvas-container', },
    children: [
      h({ tag: 'canvas', attrs: { id: 'draw-canvas', }, }),
      h({ tag: 'div', attrs: { id: 'svg-overlay', }, html: svgContent, }),
      h({ tag: 'div', attrs: { id: 'text-layer', }, }),
    ],
  });
}

/**
 * Renders the complete HTML document with all content inlined.
 *
 * @param css - CSS stylesheet string
 *
 * @param js - client-side JavaScript string
 *
 * @param svgContent - processed SVG background string
 *
 * @returns complete HTML document string
 */
export function renderPage({ css, js, svgContent, }: { css: string; js: string; svgContent: string }): string {
  return `<!DOCTYPE html>\n${h({
    tag: 'html',
    attrs: { lang: 'en', },
    children: [
      h({
        tag: 'head',
        children: [
          h({ tag: 'meta', attrs: { charset: 'utf8', }, }),
          h({ tag: 'meta', attrs: { name: 'viewport', content: 'width=device-width, initial-scale=1', }, }),
          h({ tag: 'meta', attrs: { name: 'color-scheme', content: 'light', }, }),
          h({ tag: 'title', text: 'Doodle Widget', }),
          h({ tag: 'style', html: css, }),
        ],
      }),
      h({
        tag: 'body',
        children: [
          h({
            tag: 'div',
            attrs: { id: 'app', },
            children: [renderToolbar(), renderCanvasContainer(svgContent)],
          }),
          h({ tag: 'script', attrs: { type: 'module', }, html: js, }),
        ],
      }),
    ],
  })}`;
}
