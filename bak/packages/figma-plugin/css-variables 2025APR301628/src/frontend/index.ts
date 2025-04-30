import {
  logtapeConfiguration,
  logtapeConfigure,
  logtapeGetLogger,
} from '@monochromatic-dev/module-es/ts';
import iframeSrcDoc from './iframe.html?raw' assert { type: 'string' };

await logtapeConfigure(await logtapeConfiguration());

const l = logtapeGetLogger(['a', 'ui']);

// l.debug`ui ready`;

// parent.postMessage({ pluginMessage: 'ui ready' }, '*');

const iframe = document.querySelector('#authoredCss') as HTMLIFrameElement;

// l.debug`got iframe ${iframe}`;

iframe.srcdoc = iframeSrcDoc;

// eslint-disable-next-line require-await We probably need await at some point.
window.addEventListener('message', async (event): Promise<void> => {
  if (Object.hasOwn(event.data, 'pluginMessage')) {
    l.info`got this from plugin ${event.data.pluginMessage}`;

    const pluginMessage: Record<string, string> = event.data.pluginMessage;

    if (Object.hasOwn(pluginMessage, 'generatedCssForLocalVariables')) {
      // CSS as authored
      const css = pluginMessage.generatedCssForLocalVariables!;

      iframe.contentWindow!.postMessage({ css }, '*');

      //endregion - Get iframe and set authored CSS in it.
    }
  } else if (Object.hasOwn(event.data, 'authoredCss')) {
    if (Object.hasOwn(event.data.authoredCss, 'cssVar')) {
      // Send data to plugin backend and set the variable value in Figma in specified mode to computed value.
      window.parent.postMessage({ pluginMessage: event.data.authoredCss }, '*');
    } else {
      l.info`got this from authoredCss ${event.data.authoredCss}`;
    }
  }
});
