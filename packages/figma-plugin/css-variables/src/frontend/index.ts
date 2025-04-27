import {
  logtapeConfiguration,
  logtapeConfigure,
  logtapeGetLogger,
} from '@monochromatic-dev/module-es/ts';
import iframeSrcDoc from './iframe.html?raw' assert { type: 'string' };

/*import postcssColorFunction from '@csstools/postcss-color-function';
import postcssColorMixFunction from '@csstools/postcss-color-mix-function';
import postcssContrastColorFunction from '@csstools/postcss-contrast-color-function';
import postcssGradientsInterpolationMethod from '@csstools/postcss-gradients-interpolation-method';
import postcssLightDarkFunction from '@csstools/postcss-light-dark-function';
import postcssOklabFunction from '@csstools/postcss-oklab-function';
import postcssRelativeColorSyntax from '@csstools/postcss-relative-color-syntax';*/

//region cssnano
/*

import postcssConvertValues from 'postcss-convert-values';

import postcssDiscardComments from 'postcss-discard-comments';
import postcssDiscardDuplicates from 'postcss-discard-duplicates';
import postcssDiscardEmpty from 'postcss-discard-empty';
import postcssDiscardOverridden from 'postcss-discard-overridden';
import postcssDiscardUnused from 'postcss-discard-unused';
import postcssMergeIdents from 'postcss-merge-idents';
import postcssMergeLonghand from 'postcss-merge-longhand';

import postcssMergeRules from 'postcss-merge-rules';

import postcssMinifyFontValues from 'postcss-minify-font-values';
import postcssMinifyGradients from 'postcss-minify-gradients';

import postcssMinifyParams from 'postcss-minify-params';

import postcssMinifySelectors from 'postcss-minify-selectors';
import postcssNormalizeCharset from 'postcss-normalize-charset';
import postcssNormalizeDisplayValues from 'postcss-normalize-display-values';
import postcssNormalizePositions from 'postcss-normalize-positions';
import postcssNormalizeRepeatStyle from 'postcss-normalize-repeat-style';
import postcssNormalizeString from 'postcss-normalize-string';
import postcssNormalizeTimingFunctions from 'postcss-normalize-timing-functions';
import postcssNormalizeUnicode from 'postcss-normalize-unicode';
import postcssNormalizeUrl from 'postcss-normalize-url';
import postcssNormalizeWhitespace from 'postcss-normalize-whitespace';
import postcssOrderedValues from 'postcss-ordered-values';
*/

//endregion cssnano
/*

import postcss, { parse } from 'postcss';
import postcssCalc from 'postcss-calc';
import postcssColorFunctionalNotation from 'postcss-color-functional-notation';
import postcssColorHexAlpha from 'postcss-color-hex-alpha';
import postcssCustomProperties from 'postcss-custom-properties';
import postcssNesting from 'postcss-nesting';
*/

await logtapeConfigure(await logtapeConfiguration());

const l = logtapeGetLogger(['a', 'ui']);

l.debug`ui ready`;

parent.postMessage({ pluginMessage: 'ui ready' }, '*');

const iframe = document.querySelector('#authoredCss') as HTMLIFrameElement;

l.debug`got iframe ${iframe}`;

iframe.srcdoc = iframeSrcDoc;

// eslint-disable-next-line require-await We probably need await at some point.
window.addEventListener('message', async (event): Promise<void> => {
  if (Object.hasOwn(event.data, 'pluginMessage')) {
    l.info`got this from plugin ${event.data.pluginMessage}`;

    const pluginMessage: Record<string, string> = event.data.pluginMessage;

    if (Object.hasOwn(pluginMessage, 'generatedCssForLocalVariables')) {
      // Abandoned way of using minified CSS.
      /*const { css } = await postcss([
      postcssNesting(),
      postcssCustomProperties({ preserve: false }),
      postcssCalc({ warnWhenCannotResolve: true, mediaQueries: true }),
      postcssLightDarkFunction(),
      postcssColorFunction(),
      postcssColorMixFunction(),
      postcssContrastColorFunction(),
      postcssOklabFunction(),
      postcssRelativeColorSyntax(),
      postcssColorFunctionalNotation(),
      postcssColorHexAlpha(),
      postcssGradientsInterpolationMethod(),

      //region cssnano

      postcssConvertValues({ path: ' ' }),

      postcssDiscardComments(),
      postcssDiscardDuplicates(),
      postcssDiscardEmpty(),
      postcssDiscardOverridden(),
      postcssDiscardUnused({}),
      postcssMergeIdents(),
      postcssMergeLonghand(),

      postcssMergeRules({ path: ' ' }),

      postcssMinifyFontValues({}),
      postcssMinifyGradients(),

      postcssMinifyParams({ path: ' ' }),

      postcssMinifySelectors(),
      postcssNormalizeCharset(),
      postcssNormalizeDisplayValues(),
      postcssNormalizePositions(),
      postcssNormalizeRepeatStyle(),
      postcssNormalizeString({}),
      postcssNormalizeTimingFunctions(),
      postcssNormalizeUnicode({ path: ' ' }),
      postcssNormalizeUrl(),
      postcssNormalizeWhitespace(),
      postcssOrderedValues(),
      //endregion cssnano
    ])
      .process(pluginMessage.generatedCssForLocalVariables!);

    l.info`${css}`;

    const cssRoot = parse(css);
    l.info`${cssRoot}`;

    cssRoot.walk((node) => {
      l.debug`${node}`;
    });*/

      // CSS as authored
      const css = pluginMessage.generatedCssForLocalVariables!;

      //region - Get iframe and set authored CSS in it.

      // iframe.addEventListener(
      //   'load',
      //   async function iframeOnload() {

      // const contentDocument = iframe.contentWindow?.document;

      // l.info`got iframe ${contentDocument}`;

      // iframe.contentDocument!.adoptedStyleSheets = [
      //   await new CSSStyleSheet().replace(css),
      // ];
      // },
      // { once: true },
      // );

      iframe.contentWindow!.postMessage({ css }, '*');

      //endregion - Get iframe and set authored CSS in it.
    } else if (Object.hasOwn(event.data, 'authoredCss')) {
      l.info`got this from authoredCss ${event.data.authoredCss}`;
    }
  }
});
