import outdent from '@cspotcode/outdent';
import type {
  AuthoredCss,
  ComputedColor,
} from '../shared/message.ts';

import { isPositiveNumberString } from '@monochromatic-dev/module-es/ts';

import {
  asConcur,
  forEachConcur,
} from 'lfi';

const DEFAULT_ELEMENT_WIDTH_NUMBER = 3840 - 8 * 2;

const testCssVar = async (
  cssValue: string,
  cssVar: `--${string}`,
  mode: string,
  depth = 0,
): Promise<AuthoredCss> => {
  if (depth > 10) {
    throw new Error('Infinite loop detected');
  }
  console.log(
    `testCssVar(cssValue: ${cssValue}, cssVar: ${cssVar}, mode: ${mode}, depth: ${depth})`,
  );

  const modeApplier: HTMLDivElement =
    document.querySelector(`body > [data-mode="${mode}"]`)
      ?? (function createModeApplier(): HTMLDivElement {
        const createdModeApplier = document.createElement('div');
        createdModeApplier.dataset.mode = mode;
        document.body.append(createdModeApplier);
        return createdModeApplier;
      })();

  {
    const testElementAssumeUnitfulLength = document.createElement('div');
    testElementAssumeUnitfulLength.style.width = cssValue;
    testElementAssumeUnitfulLength.style.height = cssValue;
    modeApplier.append(testElementAssumeUnitfulLength);

    const computedStyle = window.getComputedStyle(
      testElementAssumeUnitfulLength,
    );
    // TODO: Also compute height.
    const computedWidth = computedStyle.getPropertyValue(
      'width',
    );
    testElementAssumeUnitfulLength.remove();
    if (
      computedWidth
        === `${DEFAULT_ELEMENT_WIDTH_NUMBER}px`
    ) {
      /*            console.log(
        `${cssVar} isn't a unitful length value.
        Try treating it as a number`,
      );*/
    } else {
      return {
        cssVar,
        originalValue: cssValue,
        computedValue: Number(computedWidth.slice(0, -('px'.length))),
        varType: 'number',
        mode,
        error: {
          message: outdent({ newline: ' ' })`
            Figma doesn't support unitful length values,
            consider using a number or string for this value.
            If you're relying on the behavior of converting from rem to px,
            you can safely ignore this error.`,
          level: cssValue.includes('em') ? 'notice' : 'error',
        },
        originalComputedValue: computedWidth,
      };
    }
  }
  {
    const testElementAssumeNumber = document.createElement(
      'div',
    );
    testElementAssumeNumber.style.width = `${cssValue}px`;
    testElementAssumeNumber.style.height = `${cssValue}px`;
    modeApplier.append(testElementAssumeNumber);

    const computedStyle = window.getComputedStyle(
      testElementAssumeNumber,
    );
    const computedWidth = computedStyle.getPropertyValue(
      'width',
    );
    testElementAssumeNumber.remove();
    if (
      computedWidth
        === `${DEFAULT_ELEMENT_WIDTH_NUMBER}px`
    ) {
      /*            console.log(
        `${cssVar} isn't a number value.
        Try treating it as a unitful length value`,
      );*/
    } else {
      return {
        cssVar,
        originalValue: cssValue,
        computedValue: Number(computedWidth.slice(0, -('px'.length))),
        varType: 'number',
        mode,
        originalComputedValue: computedWidth,
      };
    }
  }
  {
    const testElementAssumeColor = document.createElement(
      'div',
    );
    testElementAssumeColor.style.backgroundColor = cssValue;
    testElementAssumeColor.style.color = cssValue;
    document.body.append(testElementAssumeColor);

    const computedStyle = window.getComputedStyle(
      testElementAssumeColor,
    );
    const computedBackgroundColor = computedStyle
      .getPropertyValue(
        'background-color',
      );
    const computedColor = computedStyle.getPropertyValue(
      'color',
    );
    testElementAssumeColor.remove();
    if (computedBackgroundColor === computedColor) {
      // eslint-disable-next-line no-else-return
      return {
        cssVar,
        originalValue: cssValue,
        computedValue: computedBackgroundColor as ComputedColor,
        varType: 'color',
        mode,
        originalComputedValue: computedBackgroundColor,
      };
    } else {
      /*            console.log(
        `${cssVar} isn't a color value. Try treating it as something else.`,
      );*/
    }
  }
  {
    const testElementAssumeBoxShadow = document.createElement(
      'div',
    );
    testElementAssumeBoxShadow.style.boxShadow = cssValue;
    document.body.append(testElementAssumeBoxShadow);

    const computedStyle = window.getComputedStyle(
      testElementAssumeBoxShadow,
    );
    const computedBoxShadow = computedStyle
      .getPropertyValue(
        'box-shadow',
      );
    testElementAssumeBoxShadow.remove();

    if (
      // If the element's background color and color are different,
      // it means at least one of them isn't applied.
      // It means the CSS var isn't a color value.
      computedBoxShadow === 'none'
    ) {
      /*            console.log(
        `${cssVar} isn't a box-shadow value.
        Try treating it as something else.`,
      );*/
    } else {
      return {
        cssVar,
        originalValue: cssValue,
        computedValue: computedBoxShadow,
        varType: 'box-shadow',
        mode,
        originalComputedValue: computedBoxShadow,
      };
    }
  }

  // If all else fails, assume it's a string (CSS content value).
  // MAYBE: Or should the code filter out the strings before they get inside the iframe?
  //
  // string Figma variables already export with quotes
  // when converting to CSS in the Figma plugin backend script.
  {
    const testElementAssumeString = document.createElement(
      'div',
    );
    testElementAssumeString.id = `testElementAssumeString${cssVar}`;
    testElementAssumeString.style.setProperty(cssVar, cssValue);
    const assumeStringStyleSheet = await new CSSStyleSheet().replace(
      `#testElementAssumeString${cssVar}::before { content: ${cssValue}; }`,
    );
    document.adoptedStyleSheets.push(assumeStringStyleSheet);
    document.body.append(testElementAssumeString);
    const computedStyle = window.getComputedStyle(
      testElementAssumeString,
    );
    // This isn't the resolved content.
    const computedContent = computedStyle
      .getPropertyValue(
        'content',
      );
    if (computedContent === 'none') {
      console
        .log`${cssVar} isn't a string (CSS content) value.
              Try treating it as something else.`;
    } else {
      return {
        cssVar,
        originalValue: cssValue,
        computedValue: cssValue.includes('var(--')
          // TODO: Handle the case where cssValue contains var(--)
          ? cssValue.replaceAll('var(--', 'var(--')
          : cssValue,
        varType: 'string',
        mode,
        originalComputedValue: computedContent,
      };
    }
  }

  /* vale alex.Ablist = NO */
  // If even assuming it's a string fails, return invalid.
  return {
    cssVar,
    originalValue: cssValue,
    computedValue: cssValue,
    varType: 'invalid',
    mode,
    error: {
      message: outdent({ newline: ' ' })`
        ${cssVar}'s ${cssValue} can't be treated as a unitful length,
        a number, a color, a box-shadow, or a string (CSS content) value.`,
      level: 'error',
    },
    originalComputedValue: cssValue,
  };
  /* vale alex.Ablist = YES */
};

const processCssVarRuleStyle = async (
  ruleStyle: `--${string}`,
  rule: CSSStyleRule & { selectorText: string; },
  mode: string,
): Promise<void> => {
  const cssVar = ruleStyle;
  const cssValue: string = rule.style.getPropertyValue(cssVar);

  // low-hanging fruit:
  // If the CSS var is a number at first glance,
  // skip everything and send the value to the backend.
  // noinspection JSCheckFunctionSignatures
  if (
    isPositiveNumberString(cssValue)
  ) {
    window.parent.postMessage({
      authoredCss: {
        cssVar,
        originalValue: cssValue,
        computedValue: Number(cssValue),
        varType: 'number',
        mode,
        originalComputedValue: cssValue,
      },
    }, '*');
  } else if (cssValue === 'true') {
    window.parent.postMessage({
      authoredCss: {
        cssVar,
        originalValue: cssValue,
        computedValue: true,
        varType: 'boolean',
        mode,
        originalComputedValue: cssValue,
      },
    }, '*');
  } else if (cssValue === 'false') {
    window.parent.postMessage({
      authoredCss: {
        cssVar,
        originalValue: cssValue,
        computedValue: false,
        varType: 'boolean',
        mode,
        originalComputedValue: cssValue,
      },
    }, '*');
  } else {
    // creates multiple test elements to test the CSS var
    const authoredCss = await testCssVar(cssValue, cssVar, mode, 0);

    // Send the message to the outer iframe
    window.parent.postMessage({ authoredCss }, '*');
  }
};

const processBasicRule = async (
  rule: CSSStyleRule & { selectorText: string; },
  mode: string,
): Promise<void> => {
  // console.log(rule.style);
  const ruleStyles: string[] = [];

  for (let i = 0; i < rule.style.length; i++) {
    ruleStyles.push(rule.style.item(i));
  }

  /*  for (const ruleStyle of ruleStyles) {
    if (ruleStyle.startsWith('--')) {
      await processCssVarRuleStyle(ruleStyle, rule, mode);
    } else {
      // console.log(`non-css var: ${ruleStyle}`);
    }
  }*/
  await forEachConcur(
    async function processRuleStyle(ruleStyle: string) {
      if (ruleStyle.startsWith('--')) {
        await processCssVarRuleStyle(ruleStyle as `--${string}`, rule, mode);
      } else {
        // console.log(`non-css var: ${ruleStyle}`);
      }
    },
    asConcur(ruleStyles),
  );
};

const processNonBasicRule = (
  rule: CSSStyleRule & { selectorText: string; },
): void => {
  console.log(`non-basic rule: ${rule.selectorText}`);
};

const processRule = async (
  rule: CSSStyleRule & { selectorText: string; },
): Promise<void> => {
  // Basic Rules
  if (/^\[data-mode=(?:"\w+"|'\w+')]$/.test(rule.selectorText.trim())) {
    const mode = rule.selectorText.trim().slice('[data-mode="'.length, -'"]'
      .length);
    await processBasicRule(rule, mode);
  } else {
    processNonBasicRule(rule);
  }
};

const handleReceivingCss = async (event: MessageEvent): Promise<void> => {
  // console.log(`inner iframe received message: ${event.data.css}`);
  const sheet = await new CSSStyleSheet().replace(event.data.css);
  document.adoptedStyleSheets = [sheet];
  window.parent.postMessage(
    { authoredCss: 'adopted stylesheets applied' },
    '*',
  );

  const ruleList = sheet.cssRules;

  const rules: (CSSStyleRule & { selectorText: string; })[] = [];

  for (let i = 0; i < ruleList.length; i++) {
    rules.push(ruleList.item(i) as CSSStyleRule & { selectorText: string; });
  }

  await forEachConcur(
    processRule,
    asConcur(rules),
  );
};

const messageHandler = async (event: MessageEvent): Promise<void> => {
  if (Object.hasOwn(event.data, 'css')) { await handleReceivingCss(event); }
};
window.addEventListener('message', messageHandler);
