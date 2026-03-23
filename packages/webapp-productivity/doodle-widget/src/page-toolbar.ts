/**
 * Toolbar HTML rendering for the doodle widget.
 *
 * Produces the top toolbar with tool selection toggle, page navigation
 * toggle, drawing settings, upload, export, and clear controls.
 */
import { $ as h, } from '@monochromatic-dev/module-es/h-html';

/**
 * Renders a single radio toggle option inside a toggle group.
 *
 * @param id - unique element id for the radio input
 *
 * @param name - shared radio group name
 *
 * @param label - visible label text
 *
 * @param checked - whether this option is initially selected
 *
 * @param value - radio value attribute, defaults to id
 *
 * @returns label-wrapped radio input HTML string
 */
function renderToggleOption({ id, name, label, checked, value, }: {
  id: string;
  name: string;
  label: string;
  checked: boolean;
  value?: string;
},): string {
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
          value: value ?? id,
          ...(checked ? { checked: '', } : {}),
        },
      },),
      h({ tag: 'span', text: label, },),
    ],
  },);
}

/**
 * Renders the page selector toggle group.
 *
 * @param pageCount - number of pages to generate radio buttons for
 *
 * @returns page toggle group HTML string
 */
function renderPageToggle(pageCount: number,): string {
  return h({
    tag: 'div',
    class: 'toggle-group',
    attrs: { id: 'page-toggle', },
    children: Array.from(
      { length: pageCount, },
      function renderPageOption(_: unknown, index: number,): string {
        return renderToggleOption({
          id: `page-${String(index,)}`,
          name: 'page',
          label: String(index + 1,),
          checked: index === 0,
          value: String(index,),
        },);
      },
    ),
  },);
}

/**
 * Renders the toolbar with tool selection, page navigation, upload,
 * and clear controls.
 *
 * @param pageCount - number of pages for the page toggle group
 *
 * @returns toolbar HTML string
 */
export function renderToolbar(pageCount: number,): string {
  return h({
    tag: 'div',
    class: 'toolbar',
    children: [
      h({ tag: 'span', class: 'toolbar-title', text: 'Doodle', },),
      h({
        tag: 'div',
        class: 'toggle-group',
        attrs: { id: 'tool-toggle', },
        children: [
          renderToggleOption({ id: 'tool-draw', name: 'tool', label: 'Draw',
            checked: true, },),
          renderToggleOption({ id: 'tool-text', name: 'tool', label: 'Text',
            checked: false, },),
        ],
      },),
      h({
        tag: 'div',
        class: 'draw-settings',
        children: [
          h({ tag: 'input',
            attrs: { type: 'color', id: 'color-picker',
              value: '#c24e2e', }, },),
          h({ tag: 'input',
            attrs: { type: 'range', id: 'size-slider', min: '1', max: '50',
              value: '10', }, },),
        ],
      },),
      renderPageToggle(pageCount,),
      h({ tag: 'button', attrs: { id: 'upload-btn', type: 'button', },
        text: 'Upload background', },),
      h({ tag: 'input',
        attrs: { type: 'file', id: 'upload-input', accept: '.svg,image/svg+xml',
          hidden: '', }, },),
      h({
        tag: 'div',
        class: 'export-group',
        children: [
          h({ tag: 'button', attrs: { id: 'export-btn', type: 'button', },
            text: 'Export', },),
          h({ tag: 'select', attrs: { id: 'format-select', },
            children: [
              h({ tag: 'option', attrs: { value: 'pdf', selected: '', },
                text: 'PDF', },),
              h({ tag: 'option', attrs: { value: 'svg', }, text: 'SVG', },),
              h({ tag: 'option', attrs: { value: 'png', }, text: 'PNG', },),
            ], },),
        ],
      },),
      h({ tag: 'button', attrs: { id: 'clear-btn', type: 'button', }, text: 'Clear', },),
    ],
  },);
}
