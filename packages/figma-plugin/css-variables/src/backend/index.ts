// eslint-disable prefer-string-raw Figma plugin cannot use String.raw
// eslint-disable prefer-add-event-listener Figma plugin use on...

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

/// <reference path="../../../../../node_modules/@figma/plugin-typings/index.d.ts" />

// Runs this code if the plugin is run in Figma
import type {
  VariableCollection,
  VariableResolvedDataType,
  VariableValue,
} from '@figma/plugin-typings/plugin-api-standalone';

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
    const collection: VariableCollection = collections.find((
      collection: VariableCollection,
    ) => collection.id === collectionId)!;
    const modeIds: string[] = Object.keys(variable.valuesByMode);
    const modeNames: string[] = modeIds.map((modeIdToFind: string): string =>
      collection.modes.find(({ modeId }) => modeIdToFind === modeId)!.name
    );
    const values: VariableValue[] = Object.values(variable.valuesByMode);
    const valuesByModeName: Record<string, VariableValue> = Object.fromEntries(
      modeNames.map((modeName, index) => [modeName, values[index]!]),
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

const populateFigmaVariables = async (): Promise<void> => {
  collections = await figma.variables.getLocalVariableCollectionsAsync();
  variables = await figma
    .variables
    .getLocalVariablesAsync();
  enhancedVariables = variables.map((variable: Variable): EnhancedVariable =>
    new EnhancedVariable(variable)
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

type SettingVarMessage = {
  cssVar: string;
  originalValue: string;
  computedValue: number;
  varType: 'number';
  mode: string;
} | {
  cssVar: string;
  originalValue: string;
  computedValue: string;
  varType: 'string' | 'color' | 'box-shadow';
  mode: string;
} | {
  cssVar: string;
  originalValue: string;
  computedValue: boolean;
  varType: 'boolean';
  mode: string;
};

const handleSettingVarMessage = ({
  cssVar,
  computedValue,
  varType,
  mode,
}: SettingVarMessage): void => {
  if (varType === 'number') {
    console.log(`Setting variable ${cssVar} to ${computedValue} in mode ${mode}`);

    const variable: EnhancedVariable = enhancedVariables.find((enhancedVariable) =>
      enhancedVariable.name === cssVar.slice('--'.length)
    )!;
    variable.setValueByModeName(computedValue, mode);
  }
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
      handleSettingVarMessage(message as SettingVarMessage);
    }
  };
};

if (new Set(['figma', 'slides']).has(figma.editorType)) {
  // noinspection JSIgnoredPromiseFromCall - Figma plugin API does not support top level await
  main();
}

export {};
