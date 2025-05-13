// eslint-disable prefer-string-raw Figma plugin cannot use String.raw
// eslint-disable prefer-add-event-listener Figma plugin use on...

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

/// <reference types="@figma/plugin-typings" />

// Runs this code if the plugin is run in Figma
import type {
  VariableCollection,
  VariableResolvedDataType,
  VariableValue,
} from '@figma/plugin-typings/plugin-api-standalone';
import type { AuthoredCss } from '../shared/message.ts';

const EPSILON = 0.1 ** 5;

const almostEqual = (a: number, b: number): boolean => {
  return Math.abs(a - b) < EPSILON;
};

const getCssValueOfFigmaVariableValue = (value: VariableValue,
  resolvedType: VariableResolvedDataType): string =>
{
  switch (resolvedType) {
    case 'COLOR': {
      const colorValue = value as RGBA;
      return `rgba(${colorValue.r * 255}, ${colorValue.g * 255}, ${
        colorValue.b * 255
      }, ${colorValue.a})`;
    }

    case 'STRING': {
      const stringValue = value as string;
      if (
        !(stringValue.startsWith('"')
          && stringValue.endsWith('"'))
        || (stringValue.startsWith("'")
            && stringValue.endsWith("'"))
          && !stringValue.includes('var(--')
      ) {
        return `'${stringValue.replaceAll("'", "\\'")}'`;
      }
      return stringValue;
    }

    case 'FLOAT': {
      const floatValue = value as number;
      return String(floatValue);
    }

    case 'BOOLEAN': {
      // TODO: May or may need special handling here.
      const booleanValue = value as boolean;
      return String(booleanValue);
    }

    default:
      throw new Error(`Unknown resolved type ${resolvedType} for value ${value}`);
  }
};

class EnhancedVariable {
  public readonly variable: Variable;
  public readonly collection: VariableCollection;
  public readonly modeNames: string[];
  public readonly modeIds: string[];
  private readonly _values: VariableValue[];
  private readonly _valuesByModeName: Record<string, VariableValue>;
  public readonly resolvedType: VariableResolvedDataType;
  private _name: string;
  public readonly description: string;
  public readonly collectionName: string;
  public readonly collectionId: string;
  public readonly id: string;
  private _generatedCss: string = '';

  constructor(variable: Variable) {
    const { variableCollectionId: collectionId, name, description, resolvedType, id }:
      Variable = variable;

    const collection: VariableCollection = collections.find(function collectionIdMatching(
      collection: VariableCollection,
    ): boolean {
      return collection.id === collectionId;
    })!;

    const modeIds: string[] = Object.keys(variable.valuesByMode);

    const modeNames: string[] = modeIds.map(
      function modeIdToName(modeIdToFind: string): string {
        return collection.modes.find(function findModeId({ modeId }): boolean {
          return modeIdToFind === modeId;
        })!
          .name;
      },
    );

    const values: VariableValue[] = Object.values(variable.valuesByMode);
    const valuesByModeName: Record<string, VariableValue> = Object.fromEntries(
      modeNames.map(function modeNameWithValue(modeName, index): [string, VariableValue] {
        return [modeName, values[index]!];
      }),
    );

    this.id = id;
    this.variable = variable;
    this.collection = collection;
    this.modeNames = modeNames;
    this.modeIds = modeIds;
    this._values = values;
    this._valuesByModeName = valuesByModeName;
    this.resolvedType = resolvedType;
    this._name = variable.name;
    this.description = description;
    this.collectionName = collection.name;
    this.collectionId = collectionId;

    this.recalculateGeneratedCss();
  }

  set name(name: string) {
    this._name = name;
    this.variable.name = name;
    this.recalculateGeneratedCss();
  }

  get name(): string {
    return this._name;
  }

  get generatedCss(): string {
    return this._generatedCss;
  }

  private recalculateGeneratedCss(): string {
    const { name, description, resolvedType } = this;
    const descriptionMatchesGeneratedCss = /`(?<code>.+)`/
      .exec(
        description,
      );
    this._generatedCss = descriptionMatchesGeneratedCss
      ?.groups
      ?.code
      ?? Object
        .entries(this._valuesByModeName)
        .map(function generateCssForMode(
          [modeName, value]: [string, VariableValue],
        ): string {
          return `[data-mode="${modeName}"] { --${name}: ${
            getCssValueOfFigmaVariableValue(
              value,
              resolvedType,
            )
          }; }`;
        })
        .join('\n');

    return this._generatedCss;
  }

  setValueByModeName(value: VariableValue, modeName: string): void {
    this._valuesByModeName[modeName] = value;
    const indexOfMode = this.modeNames.indexOf(modeName);
    const modeId = this.modeIds[indexOfMode]!;
    this._values[indexOfMode] = value;
    this.variable.setValueForMode(modeId, value);
    this.recalculateGeneratedCss();
  }

  getValueByModeName(modeName: string): VariableValue {
    return this._valuesByModeName[modeName]!;
  }
}

// Will be filled with real variables as soon as getFigmaVariables() is called for the first time,
// which is when we normalize all variables.
// Therefore, many variable methods won't need async.
let collections: VariableCollection[] = [];
let variables: Variable[] = [];
let enhancedVariables: EnhancedVariable[] = [];
let styles: [PaintStyle | TextStyle | EffectStyle | GridStyle][] = [];
let paintStyles: PaintStyle[] = [];
let textStyles: TextStyle[] = [];
let effectStyles: EffectStyle[] = [];
let gridStyles: GridStyle[] = [];

const populateFigmaVariables = async (): Promise<void> => {
  collections = await figma.variables.getLocalVariableCollectionsAsync();
  variables = await figma
    .variables
    .getLocalVariablesAsync();
  enhancedVariables = variables.map(
    function enhanceVariable(variable: Variable): EnhancedVariable {
      return new EnhancedVariable(variable);
    },
  );
};

const normalizeVariables = (): void => {
  for (const variable of variables) {
    if (variable.name.startsWith('--')) {
      console.log(`Normalizing variable ${variable.name}`);
      variable.name = variable.name.slice('--'.length);
    }
  }
};

const parseColorString = (colorStr: string): RGBA => {
  const isRgba = colorStr.startsWith('rgba(');
  const isRgb = colorStr.startsWith('rgb(');
  if (!isRgba && !isRgb) {
    throw new TypeError(`Invalid color format: ${colorStr}`);
  }
  const values = colorStr
    .slice(isRgba ? 'rgba('.length : 'rgb('.length, -')'.length)
    .split(',')
    .map(function trimValue(value): string {
      return value.trim();
    });

  return {
    r: Number(values[0]) / 255,
    g: Number(values[1]) / 255,
    b: Number(values[2]) / 255,
    a: isRgba ? Number(values[3]) : 1,
  };
};

const handleSettingVarMessage = ({
  cssVar,
  computedValue,
  originalValue,
  varType,
  mode,
  originalComputedValue,
}: AuthoredCss): void => {
  const getVariable = (cssVar: `--${string}`): EnhancedVariable => {
    return enhancedVariables.find(
      function compareVariableByTruncatedName(
        enhancedVariable: EnhancedVariable,
      ): boolean {
        return enhancedVariable.name === cssVar.slice('--'.length);
      },
    )!;
  };

  const logVariableChange = (): void => {
    console.log(
      `Setting variable ${cssVar} to ${computedValue} in mode ${mode} with original computed value ${originalComputedValue}`,
    );
  };

  const handleSimpleTypeChange = (value: string | number | boolean): void => {
    if (String(computedValue) !== String(originalValue)) {
      logVariableChange();
      getVariable(cssVar).setValueByModeName(value, mode);
    }
  };

  if (varType === 'number' || varType === 'boolean') {
    handleSimpleTypeChange(computedValue);
    return;
  }

  if (varType === 'color') {
    // If color (computed color) cannot be parsed as a color string,
    // we know our code has failed, so we're not catching errors here.
    const color = parseColorString(computedValue);

    try {
      const originalColor = parseColorString(originalValue);

      if (
        almostEqual(color.r, originalColor.r)
        && almostEqual(color.g, originalColor.g)
        && almostEqual(color.b, originalColor.b)
        && almostEqual(color.a, originalColor.a)
      ) {
        return;
      }
    } catch {
      // If originalColor cannot be parsed as a color string,
      // we know for sure we need to actually set the variable.
    }

    logVariableChange();
    getVariable(cssVar).setValueByModeName(color, mode);
    return;
  }

  if (varType === 'string') {
    if (computedValue !== originalValue) {
      const valueToSet = (computedValue.startsWith("'") && computedValue.endsWith("'"))
        ? computedValue.slice("'".length, -"'".length)
        : computedValue;

      logVariableChange();
      getVariable(cssVar).setValueByModeName(valueToSet, mode);
    }
    return;
  }

  throw new Error(`Unrecognized variable ${cssVar} type ${varType} in mode ${mode}`);
};
const main = async (): Promise<void> => {
  // Fill the local variable variables.
  await populateFigmaVariables();

  normalizeVariables();

  const generatedCssForLocalVariables: string = enhancedVariables
    .map((enhancedVariable) => enhancedVariable.generatedCss)
    .join('\n');

  console.log(generatedCssForLocalVariables);

  figma.showUI(__html__, { themeColors: true });

  figma.ui.postMessage({ generatedCssForLocalVariables }, { origin: '*' });

  figma.ui.onmessage = (message): void => {
    console.log('got this from the UI', message);
    if (message.cssVar) {
      handleSettingVarMessage(message as AuthoredCss);
    }
  };
};

if (new Set(['figma', 'slides']).has(figma.editorType)) {
  // noinspection JSIgnoredPromiseFromCall - Figma plugin API does not support top level await
  main();
}

export {};
