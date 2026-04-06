/**
 * Toolbar event handler setup for the doodle widget.
 *
 * Wires up color picker, size slider, clear, export, and upload
 * controls to their respective actions.
 */

import { setSvgBackground, } from './background.ts';
import {
  setStrokeColor,
  setStrokeWidth,
} from './drawing-config.ts';
import { clearStrokes, } from './drawing.ts';
import { exportAsPdf, } from './export-pdf.ts';
import { exportAsPng, } from './export-png.ts';
import { exportAsSvg, } from './export-svg.ts';
import type {
  ExportDeps,
  ExportFormat,
} from './export.ts';
import { clearTextEntries, } from './text.ts';

/** Format-to-exporter dispatch table */
const EXPORTERS: Record<ExportFormat, (deps: ExportDeps,) => void | Promise<void>> = {
  pdf: exportAsPdf,
  png: exportAsPng,
  svg: exportAsSvg,
};

/**
 * Checks whether a string is a valid export format.
 *
 * @param value - string to check
 *
 * @returns `true` if value is a recognized export format
 */
function isExportFormat(value: string,): value is ExportFormat {
  return value in EXPORTERS;
}

/**
 * Dependencies for toolbar handler setup.
 */
type ToolbarHandlerDeps = {
  /** Color picker input */
  colorPicker: HTMLInputElement;
  /** Stroke width slider */
  sizeSlider: HTMLInputElement;
  /** Clear button */
  clearBtn: HTMLButtonElement;
  /** Export button */
  exportBtn: HTMLButtonElement;
  /** Export format dropdown */
  formatSelect: HTMLSelectElement;
  /** Upload trigger button */
  uploadBtn: HTMLButtonElement;
  /** Hidden file input */
  uploadInput: HTMLInputElement;
  /** Page element (coordinate reference for export sizing) */
  page: HTMLDivElement;
  /** SVG overlay element */
  svgOverlay: HTMLDivElement;
  /** Drawing canvas element */
  drawCanvas: HTMLCanvasElement;
  /** Text layer element */
  textLayer: HTMLDivElement;
  /** Canvas 2D rendering context */
  ctx: CanvasRenderingContext2D;
  /** Returns current canvas dimensions */
  getCanvasSize: () => {
    cw: number;
    ch: number;
  };
  /** Resizes and redraws the canvas */
  sizeCanvas: () => void;
  /** Pushes current state to undo history after a completed action */
  pushSnapshot: () => void;
};

/**
 * Attaches event listeners for all toolbar controls.
 *
 * @param deps - toolbar elements and shared state accessors
 *
 * @example
 * ```ts
 * setupToolbarHandlers(deps);
 * ```
 */
export function setupToolbarHandlers(deps: ToolbarHandlerDeps,): void {
  const {
    colorPicker,
    sizeSlider,
    clearBtn,
    exportBtn,
    formatSelect,
    uploadBtn,
    uploadInput,
    page,
    svgOverlay,
    drawCanvas,
    textLayer,
    ctx,
    getCanvasSize,
    sizeCanvas,
    pushSnapshot,
  } = deps;

  colorPicker.addEventListener(
    'input',
    function handleColorChange(): void {
      setStrokeColor(colorPicker.value,);
    },
  );

  sizeSlider.addEventListener(
    'input',
    function handleSizeChange(): void {
      setStrokeWidth(Number(sizeSlider.value,),);
    },
  );

  clearBtn.addEventListener(
    'click',
    function handleClear(): void {
      const {
        cw,
        ch,
      } = getCanvasSize();
      clearStrokes();
      clearTextEntries();
      ctx.clearRect(
        0,
        0,
        cw,
        ch,
      );
      pushSnapshot();
    },
  );

  exportBtn.addEventListener(
    'click',
    function handleExportClick(): void {
      /** Selected export format from the dropdown */
      const format = formatSelect.value;
      if (!isExportFormat(format,))
        return;
      void EXPORTERS[format]({
        container: page,
        overlay: svgOverlay,
        drawCanvas,
        textLayer,
      },);
    },
  );

  uploadBtn.addEventListener(
    'click',
    function handleUploadClick(): void {
      uploadInput.click();
    },
  );

  /**
   * Processes a user-selected SVG background file.
   *
   * Reads the file as text and renders it in the SVG overlay layer.
   *
   * @param file - uploaded SVG file
   */
  async function processBackgroundFile(file: File,): Promise<void> {
    clearStrokes();
    clearTextEntries();
    /** Raw SVG markup read from the uploaded file */
    const svgMarkup = await file.text();
    setSvgBackground({
      svgMarkup,
      overlay: svgOverlay,
    },);
    sizeCanvas();
    pushSnapshot();
  }

  uploadInput.addEventListener(
    'change',
    function handleFileChange(): void {
      /** Selected file from the upload input */
      const file = uploadInput.files?.item(0,) ?? null;
      if (file === null)
        return;
      void processBackgroundFile(file,);
    },
  );
}
