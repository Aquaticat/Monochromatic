export type PluginMessage = {
  generatedCssForLocalVariables: string;
};

export type AuthoredCssShared = {
  cssVar: `--${string}`;
  originalValue: string;
  mode: string;
  error?: {
    message: string;
    level: 'notice' | 'error';
  };
  originalComputedValue: string;
};

export type AuthoredCssNumber = AuthoredCssShared & {
  varType: 'number';
  computedValue: number;
};

// TODO: Check if computed value is always rgb() or rgba().
export type ComputedColor =
  | `rgb(${number}, ${number}, ${number})`
  | `rgba(${number}, ${number}, ${number}, ${number})`;

export type AuthoredCssColor = AuthoredCssShared & {
  varType: 'color';

  computedValue: ComputedColor;
};

export type AuthoredCssBoxShadow = AuthoredCssShared & {
  varType: 'box-shadow';
  computedValue: string;
};

export type AuthoredCssString = AuthoredCssShared & {
  varType: 'string';
  computedValue: string;
};

export type AuthoredCssBoolean = AuthoredCssShared & {
  varType: 'boolean';
  computedValue: boolean;
};

export type AuthoredCssInvalid = AuthoredCssShared & {
  varType: 'invalid';
  computedValue: string;
};

export type AuthoredCss =
  | AuthoredCssBoolean
  | AuthoredCssInvalid
  | AuthoredCssString
  | AuthoredCssNumber
  | AuthoredCssColor
  | AuthoredCssBoxShadow;
