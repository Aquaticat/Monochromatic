// eslint-disable prefer-add-event-listener Figma plugin use on...

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

/// <reference path="../../../../../node_modules/@figma/plugin-typings/index.d.ts" />

// Runs this code if the plugin is run in Figma
if (new Set(['figma', 'slides']).has(figma.editorType)) {
  (async (): Promise<void> => {
    const localVariableCollections = await figma
      .variables
      .getLocalVariableCollectionsAsync();

    let generatedCssForLocalVariables: string = '';

    for (const localVariableCollection of localVariableCollections) {
      console.log(
        `variable collection ${localVariableCollection.name} start with modes ${localVariableCollection.modes}`,
      );

      let generatedCssForLocalVariableCollection: string = '';

      for (const localVariableIdInCollection of localVariableCollection.variableIds) {
        // eslint-disable-next-line no-await-in-loop
        const localVariableInCollection = (await figma
          .variables
          .getVariableByIdAsync(localVariableIdInCollection))!;

        const descriptionMatchesGeneratedCssForLocalVariableInCollection = /`(?<code>.+)`/
          .exec(
            localVariableInCollection.description,
          );

        // console.log(Object.values(localVariableInCollection.valuesByMode)[0]);

        // console.log(localVariableInCollection.resolvedType);

        const valueInPrimaryMode = Object
          .values(localVariableInCollection.valuesByMode)[0]!;

        const generatedCssForLocalVariableInCollection =
          descriptionMatchesGeneratedCssForLocalVariableInCollection
            ?.groups
            ?.code
            ?? `:root { --${localVariableInCollection.name}: ${
              localVariableInCollection.resolvedType === 'COLOR'
                ? `rgba(${(valueInPrimaryMode as RGBA).r * 255},${
                  (valueInPrimaryMode as RGBA).g * 255
                },${(valueInPrimaryMode as RGBA).b * 255},${
                  (valueInPrimaryMode as RGBA).a * 255
                })`
                : Object.values(localVariableInCollection.valuesByMode)[0]
            }; }`;

        // console.log(generatedCssForLocalVariableInCollection);

        generatedCssForLocalVariableCollection =
          `${generatedCssForLocalVariableCollection}
        ${generatedCssForLocalVariableInCollection}`;
      }

      generatedCssForLocalVariables = `${generatedCssForLocalVariables}
      ${generatedCssForLocalVariableCollection}`;
    }

    console.log(generatedCssForLocalVariables);

    figma.showUI(__html__, { themeColors: true });

    figma.ui.postMessage({ generatedCssForLocalVariables }, { origin: '*' });

    figma.ui.onmessage = (message): void => {
      console.log('got this from the UI', message);
    };

    // Make sure to close the plugin when you're done. Otherwise the plugin will
    // keep running, which shows the cancel button at the bottom of the screen.
  })();
}

export {};
