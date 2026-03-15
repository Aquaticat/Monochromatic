import ffmpegPlugin from '@motion-canvas/ffmpeg';
import motionCanvasPlugin from '@motion-canvas/vite-plugin';
import { defineConfig, } from 'vite';

// CJS default export interop -- Vite 8 doesn't auto-unwrap .default from CJS modules
/** Unwrapped motion-canvas Vite plugin handling CJS default export interop. */
// eslint-disable-next-line typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-assignment, typescript-eslint/no-unsafe-type-assertion -- CJS interop requires runtime property access
const motionCanvas =
  (motionCanvasPlugin as unknown as { default?: typeof motionCanvasPlugin; }).default // eslint-disable-line typescript-eslint/no-unsafe-type-assertion -- CJS interop
    ?? motionCanvasPlugin;
/** Unwrapped ffmpeg plugin handling CJS default export interop. */
// eslint-disable-next-line typescript-eslint/no-unsafe-member-access, typescript-eslint/no-unsafe-assignment, typescript-eslint/no-unsafe-type-assertion -- CJS interop requires runtime property access
const ffmpeg = (ffmpegPlugin as unknown as { default?: typeof ffmpegPlugin; }).default
  ?? ffmpegPlugin;

export default defineConfig({
  plugins: [
    motionCanvas({
      project: ['./src/project.ts',],
    },),
    ffmpeg(),
  ],
},);
