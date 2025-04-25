import {
  logtapeConfiguration,
  logtapeConfigure,
  logtapeGetLogger,
} from '@monochromatic-dev/module-es/ts';

import postcssColorFunction from '@csstools/postcss-color-function';
import postcssColorMixFunction from '@csstools/postcss-color-mix-function';
import postcssContrastColorFunction from '@csstools/postcss-contrast-color-function';
// import postcssExtract from '@csstools/postcss-extract';
import postcssGradientsInterpolationMethod from '@csstools/postcss-gradients-interpolation-method';
import postcssLightDarkFunction from '@csstools/postcss-light-dark-function';
import postcssOklabFunction from '@csstools/postcss-oklab-function';
import postcssRelativeColorSyntax from '@csstools/postcss-relative-color-syntax';

//region cssnano

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

//endregion cssnano

import postcss, { parse } from 'postcss';
import postcssCalc from 'postcss-calc';
import postcssColorFunctionalNotation from 'postcss-color-functional-notation';
import postcssColorHexAlpha from 'postcss-color-hex-alpha';
import postcssCustomProperties from 'postcss-custom-properties';
import postcssNesting from 'postcss-nesting';

await logtapeConfigure(await logtapeConfiguration());

const l = logtapeGetLogger(['a', 'ui']);

l.info`ui ready`;

parent.postMessage({ pluginMessage: 'ui ready' }, '*');

onmessage = async (event): Promise<void> => {
  l.info`got this from plugin ${event.data.pluginMessage}`;

  const pluginMessage: Record<string, string> = event.data.pluginMessage;

  if (Object.hasOwn(pluginMessage, 'generatedCssForLocalVariables')) {
    const { css } = await postcss([
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
    });
  }
};
