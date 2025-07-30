import {
  logtapeConfiguration,
  logtapeConfigure,
  logtapeGetLogger,
} from '@monochromatic-dev/module-es/ts';
import type {
  AuthoredCss,
  PluginMessage,
} from '../shared/message.ts';

await logtapeConfigure(await logtapeConfiguration(),);

const l = logtapeGetLogger(['a', 'ui',],);

const iframe = document.querySelector('#authoredCss',) as HTMLIFrameElement;

const handleMessage = (
  event: { data: { pluginMessage: PluginMessage; } | { authoredCss: AuthoredCss; }; },
): void => {
  if (Object.hasOwn(event.data, 'pluginMessage',)) {
    const pluginMessage: Record<string, string> = (event
      .data as { pluginMessage: PluginMessage; })
      .pluginMessage;
    l.info`got this from plugin ${pluginMessage}`;

    if (Object.hasOwn(pluginMessage, 'generatedCssForLocalVariables',)) {
      // CSS as authored
      const css = pluginMessage.generatedCssForLocalVariables!;

      iframe.contentWindow!.postMessage({ css, }, '*',);
    }
  }
  else if (Object.hasOwn(event.data, 'authoredCss',)) {
    const authoredCss: AuthoredCss = (event
      .data as { authoredCss: AuthoredCss; })
      .authoredCss;
    if (Object.hasOwn(authoredCss, 'cssVar',)) {
      // Send data to plugin backend and set the variable value in Figma in specified mode to computed value.
      globalThis.parent.postMessage({ pluginMessage: authoredCss, }, '*',);
    }
    else {
      l.info`got this from authoredCss ${authoredCss}`;
    }
  }
};

globalThis.addEventListener('message', handleMessage,);
