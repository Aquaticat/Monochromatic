// Another pain to type...
// "This is horrifying" - Aquaticat
// Thanks ChatGPT, you're finally useful.

import type {
  WithoutFirst,
  WithoutFirst10,
  WithoutFirst2,
  WithoutFirst3,
  WithoutFirst4,
  WithoutFirst5,
  WithoutFirst6,
  WithoutFirst7,
  WithoutFirst8,
  WithoutFirst9,
} from './arrayLike.ts';

// 10 presetInputs ought to be enough for everyone. Right, right?
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0,
  T_fn extends (...inputs: [T_0]) => any,>(fn: T_fn,
  presetInput0: T_0): () => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1,
  T_fn extends (...inputs: [T_0, T_1]) => any,>(fn: T_fn,
  presetInput0: T_0): (laterInput1: T_1) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1,
  T_fn extends (...inputs: [T_0, T_1]) => any,>(fn: T_fn, presetInput0: T_0,
  presetInput1: T_1): () => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2,
  T_fn extends (...inputs: [T_0, T_1, T_2]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
): (laterInput1: T_1, laterInput2: T_2) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2,
  T_fn extends (...inputs: [T_0, T_1, T_2]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
): (laterInput2: T_2) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2,
  T_fn extends (...inputs: [T_0, T_1, T_2]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
): () => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
): (laterInput1: T_1, laterInput2: T_2, laterInput3: T_3) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
): (laterInput2: T_2, laterInput3: T_3) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
): (laterInput3: T_3) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
): () => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
): (laterInput1: T_1, laterInput2: T_2, laterInput3: T_3,
  laterInput4: T_4) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
): (laterInput2: T_2, laterInput3: T_3, laterInput4: T_4) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
): (laterInput3: T_3, laterInput4: T_4) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
): () => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
): (laterInput1: T_1, laterInput2: T_2, laterInput3: T_3,
  laterInput4: T_4) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
): (laterInput2: T_2, laterInput3: T_3, laterInput4: T_4) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
): (laterInput3: T_3, laterInput4: T_4) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
): (laterInput4: T_4) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
): () => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
): (laterInput1: T_1, laterInput2: T_2, laterInput3: T_3, laterInput4: T_4,
  laterInput5: T_5) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
): (laterInput2: T_2, laterInput3: T_3, laterInput4: T_4,
  laterInput5: T_5) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
): (laterInput3: T_3, laterInput4: T_4, laterInput5: T_5) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
): (laterInput4: T_4, laterInput5: T_5) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
): (laterInput5: T_5) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
): () => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
): (laterInput1: T_1, laterInput2: T_2, laterInput3: T_3, laterInput4: T_4,
  laterInput5: T_5, laterInput6: T_6) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
): (laterInput2: T_2, laterInput3: T_3, laterInput4: T_4, laterInput5: T_5,
  laterInput6: T_6) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
): (laterInput3: T_3, laterInput4: T_4, laterInput5: T_5,
  laterInput6: T_6) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
): (laterInput4: T_4, laterInput5: T_5, laterInput6: T_6) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
): (laterInput5: T_5, laterInput6: T_6) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
): (laterInput6: T_6) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
): () => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
): (laterInput1: T_1, laterInput2: T_2, laterInput3: T_3, laterInput4: T_4,
  laterInput5: T_5, laterInput6: T_6, laterInput7: T_7) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
): (laterInput2: T_2, laterInput3: T_3, laterInput4: T_4, laterInput5: T_5,
  laterInput6: T_6, laterInput7: T_7) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
): (laterInput3: T_3, laterInput4: T_4, laterInput5: T_5, laterInput6: T_6,
  laterInput7: T_7) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
): (laterInput4: T_4, laterInput5: T_5, laterInput6: T_6,
  laterInput7: T_7) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
): (laterInput5: T_5, laterInput6: T_6, laterInput7: T_7) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
): (laterInput6: T_6, laterInput7: T_7) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
): (laterInput7: T_7) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
  presetInput7: T_7,
): () => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
): (laterInput1: T_1, laterInput2: T_2, laterInput3: T_3, laterInput4: T_4,
  laterInput5: T_5, laterInput6: T_6, laterInput7: T_7,
  laterInput8: T_8) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
): (laterInput2: T_2, laterInput3: T_3, laterInput4: T_4, laterInput5: T_5,
  laterInput6: T_6, laterInput7: T_7, laterInput8: T_8) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
): (laterInput3: T_3, laterInput4: T_4, laterInput5: T_5, laterInput6: T_6,
  laterInput7: T_7, laterInput8: T_8) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
): (laterInput4: T_4, laterInput5: T_5, laterInput6: T_6, laterInput7: T_7,
  laterInput8: T_8) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
): (laterInput5: T_5, laterInput6: T_6, laterInput7: T_7,
  laterInput8: T_8) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
): (laterInput6: T_6, laterInput7: T_7, laterInput8: T_8) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
): (laterInput7: T_7, laterInput8: T_8) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
  presetInput7: T_7,
): (laterInput8: T_8) => ReturnType<T_fn>;
/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
  presetInput7: T_7,
  presetInput8: T_8,
): () => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
): (laterInput1: T_1, laterInput2: T_2, laterInput3: T_3, laterInput4: T_4,
  laterInput5: T_5, laterInput6: T_6, laterInput7: T_7, laterInput8: T_8,
  laterInput9: T_9) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9, T_others extends any[], T_fn extends (
  ...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9, ...T_others]
) => any,>(fn: T_fn,
  presetInput0: T_0
): (laterInput1: T_1, laterInput2: T_2, laterInput3: T_3, laterInput4: T_4,
  laterInput5: T_5, laterInput6: T_6, laterInput7: T_7, laterInput8: T_8,
  laterInput9: T_9, ...laterInputOthers: T_others) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
): (laterInput2: T_2, laterInput3: T_3, laterInput4: T_4, laterInput5: T_5,
  laterInput6: T_6, laterInput7: T_7, laterInput8: T_8,
  laterInput9: T_9) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9, T_others extends any[], T_fn extends (
  ...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9, ...T_others]
) => any,>(fn: T_fn, presetInput0: T_0,
  presetInput1: T_1
): (laterInput2: T_2, laterInput3: T_3, laterInput4: T_4, laterInput5: T_5,
  laterInput6: T_6, laterInput7: T_7, laterInput8: T_8, laterInput9: T_9,
  ...laterInputOthers: T_others) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
): (laterInput3: T_3, laterInput4: T_4, laterInput5: T_5, laterInput6: T_6,
  laterInput7: T_7, laterInput8: T_8, laterInput9: T_9) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9, T_others extends any[], T_fn extends (
  ...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9, ...T_others]
) => any,>(fn: T_fn, presetInput0: T_0, presetInput1: T_1,
  presetInput2: T_2
): (laterInput3: T_3, laterInput4: T_4, laterInput5: T_5, laterInput6: T_6,
  laterInput7: T_7, laterInput8: T_8, laterInput9: T_9,
  ...laterInputOthers: T_others) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
): (laterInput4: T_4, laterInput5: T_5, laterInput6: T_6, laterInput7: T_7,
  laterInput8: T_8, laterInput9: T_9) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9, T_others extends any[], T_fn extends (
  ...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9, ...T_others]
) => any,>(fn: T_fn, presetInput0: T_0, presetInput1: T_1, presetInput2: T_2,
  presetInput3: T_3
): (laterInput4: T_4, laterInput5: T_5, laterInput6: T_6, laterInput7: T_7,
  laterInput8: T_8, laterInput9: T_9, ...laterInputOthers: T_others) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
): (laterInput5: T_5, laterInput6: T_6, laterInput7: T_7, laterInput8: T_8,
  laterInput9: T_9) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9, T_others extends any[], T_fn extends (
  ...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9, ...T_others]
) => any,>(fn: T_fn, presetInput0: T_0, presetInput1: T_1, presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4
): (laterInput5: T_5, laterInput6: T_6, laterInput7: T_7, laterInput8: T_8,
  laterInput9: T_9, ...laterInputOthers: T_others) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
): (laterInput6: T_6, laterInput7: T_7, laterInput8: T_8,
  laterInput9: T_9) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9, T_others extends any[], T_fn extends (
  ...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9, ...T_others]
) => any,>(fn: T_fn, presetInput0: T_0, presetInput1: T_1, presetInput2: T_2,
  presetInput3: T_3, presetInput4: T_4,
  presetInput5: T_5
): (laterInput6: T_6, laterInput7: T_7, laterInput8: T_8, laterInput9: T_9,
  ...laterInputOthers: T_others) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
): (laterInput7: T_7, laterInput8: T_8, laterInput9: T_9) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9, T_others extends any[], T_fn extends (
  ...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9, ...T_others]
) => any,>(fn: T_fn, presetInput0: T_0, presetInput1: T_1, presetInput2: T_2,
  presetInput3: T_3, presetInput4: T_4, presetInput5: T_5,
  presetInput6: T_6
): (laterInput7: T_7, laterInput8: T_8, laterInput9: T_9,
  ...laterInputOthers: T_others) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
  presetInput7: T_7,
): (laterInput8: T_8, laterInput9: T_9) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9, T_others extends any[], T_fn extends (
  ...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9, ...T_others]
) => any,>(fn: T_fn, presetInput0: T_0, presetInput1: T_1, presetInput2: T_2,
  presetInput3: T_3, presetInput4: T_4, presetInput5: T_5, presetInput6: T_6,
  presetInput7: T_7
): (laterInput8: T_8, laterInput9: T_9,
  ...laterInputOthers: T_others) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
  presetInput7: T_7,
  presetInput8: T_8,
): (laterInput9: T_9) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9, T_others extends any[], T_fn extends (
  ...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9, ...T_others]
) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
  presetInput7: T_7,
  presetInput8: T_8,
): (laterInput9: T_9, ...laterInputOthers: T_others) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9,
  T_fn extends (...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
  presetInput7: T_7,
  presetInput8: T_8,
  presetInput9: T_9,
): () => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9, T_others extends any[], T_fn extends (
  ...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9, ...T_others]
) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
  presetInput7: T_7,
  presetInput8: T_8,
  presetInput9: T_9,
): (...laterInputOthers: T_others) => ReturnType<T_fn>;

/* @__NO_SIDE_EFFECTS__ */ export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_8, T_9, T_others extends any[], T_fn extends (
    | ((...inputs: [T_0]) => any)
    | ((...inputs: [T_0, T_1]) => any)
    | ((...inputs: [T_0, T_1, T_2]) => any)
    | ((...inputs: [T_0, T_1, T_2, T_3]) => any)
    | ((...inputs: [T_0, T_1, T_2, T_3, T_4]) => any)
    | ((...inputs: [T_0, T_1, T_2, T_3, T_4, T_5]) => any)
    | ((...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6]) => any)
    | ((...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7]) => any)
    | ((...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8]) => any)
    | ((...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9]) => any)
    | ((...inputs: [T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, ...T_others]) => any)
  ),>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1?: T_1,
  presetInput2?: T_2,
  presetInput3?: T_3,
  presetInput4?: T_4,
  presetInput5?: T_5,
  presetInput6?: T_6,
  presetInput7?: T_7,
  presetInput8?: T_8,
  presetInput9?: T_9,
):
  | (() => ReturnType<T_fn>)
  | ((laterInput1: T_1) => ReturnType<T_fn>)
  | ((laterInput2: T_2) => ReturnType<T_fn>)
  | ((laterInput3: T_3) => ReturnType<T_fn>)
  | ((laterInput4: T_4) => ReturnType<T_fn>)
  | ((laterInput5: T_5) => ReturnType<T_fn>)
  | ((laterInput6: T_6) => ReturnType<T_fn>)
  | ((laterInput7: T_7) => ReturnType<T_fn>)
  | ((laterInput8: T_8) => ReturnType<T_fn>)
  | ((laterInput9: T_9) => ReturnType<T_fn>)
  | ((
    laterInput1: T_1,
    laterInput2: T_2,
  ) => ReturnType<T_fn>)
  | ((
    laterInput2: T_2,
    laterInput3: T_3,
  ) => ReturnType<T_fn>)
  | ((
    laterInput3: T_3,
    laterInput4: T_4,
  ) => ReturnType<T_fn>)
  | ((
    laterInput4: T_4,
    laterInput5: T_5,
  ) => ReturnType<T_fn>)
  | ((
    laterInput5: T_5,
    laterInput6: T_6,
  ) => ReturnType<T_fn>)
  | ((
    laterInput6: T_6,
    laterInput7: T_7,
  ) => ReturnType<T_fn>)
  | ((
    laterInput7: T_7,
    laterInput8: T_8,
  ) => ReturnType<T_fn>)
  | ((
    laterInput8: T_8,
    laterInput9: T_9,
  ) => ReturnType<T_fn>)
  | ((
    laterInput1: T_1,
    laterInput2: T_2,
    laterInput3: T_3,
  ) => ReturnType<T_fn>)
  | ((
    laterInput2: T_2,
    laterInput3: T_3,
    laterInput4: T_4,
  ) => ReturnType<T_fn>)
  | ((
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
  ) => ReturnType<T_fn>)
  | ((
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
  ) => ReturnType<T_fn>)
  | ((
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
  ) => ReturnType<T_fn>)
  | ((
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
  ) => ReturnType<T_fn>)
  | ((
    laterInput7: T_7,
    laterInput8: T_8,
    laterInput9: T_9,
  ) => ReturnType<T_fn>)
  | ((
    laterInput1: T_1,
    laterInput2: T_2,
    laterInput3: T_3,
    laterInput4: T_4,
  ) => ReturnType<T_fn>)
  | ((
    laterInput2: T_2,
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
  ) => ReturnType<T_fn>)
  | ((
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
  ) => ReturnType<T_fn>)
  | ((
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
  ) => ReturnType<T_fn>)
  | ((
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
  ) => ReturnType<T_fn>)
  | ((
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
    laterInput9: T_9,
  ) => ReturnType<T_fn>)
  | ((
    laterInput1: T_1,
    laterInput2: T_2,
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
  ) => ReturnType<T_fn>)
  | ((
    laterInput2: T_2,
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
  ) => ReturnType<T_fn>)
  | ((
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
  ) => ReturnType<T_fn>)
  | ((
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
  ) => ReturnType<T_fn>)
  | ((
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
    laterInput9: T_9,
  ) => ReturnType<T_fn>)
  | ((
    laterInput1: T_1,
    laterInput2: T_2,
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
  ) => ReturnType<T_fn>)
  | ((
    laterInput2: T_2,
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
  ) => ReturnType<T_fn>)
  | ((
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
  ) => ReturnType<T_fn>)
  | ((
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
    laterInput9: T_9,
  ) => ReturnType<T_fn>)
  | ((
    laterInput1: T_1,
    laterInput2: T_2,
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
  ) => ReturnType<T_fn>)
  | ((
    laterInput2: T_2,
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
  ) => ReturnType<T_fn>)
  | ((
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
    laterInput9: T_9,
  ) => ReturnType<T_fn>)
  | ((
    laterInput1: T_1,
    laterInput2: T_2,
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
  ) => ReturnType<T_fn>)
  | ((
    laterInput2: T_2,
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
    laterInput9: T_9,
  ) => ReturnType<T_fn>)
  | ((
    laterInput1: T_1,
    laterInput2: T_2,
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
    laterInput9: T_9,
  ) => ReturnType<T_fn>)
  | ((
    laterInput1: T_1,
    laterInput2: T_2,
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
    laterInput9: T_9,
    ...laterInputOthers: T_others
  ) => ReturnType<T_fn>)
  | ((
    laterInput2: T_2,
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
    laterInput9: T_9,
    ...laterInputOthers: T_others
  ) => ReturnType<T_fn>)
  | ((
    laterInput3: T_3,
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
    laterInput9: T_9,
    ...laterInputOthers: T_others
  ) => ReturnType<T_fn>)
  | ((
    laterInput4: T_4,
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
    laterInput9: T_9,
    ...laterInputOthers: T_others
  ) => ReturnType<T_fn>)
  | ((
    laterInput5: T_5,
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
    laterInput9: T_9,
    ...laterInputOthers: T_others
  ) => ReturnType<T_fn>)
  | ((
    laterInput6: T_6,
    laterInput7: T_7,
    laterInput8: T_8,
    laterInput9: T_9,
    ...laterInputOthers: T_others
  ) => ReturnType<T_fn>)
  | ((
    laterInput7: T_7,
    laterInput8: T_8,
    laterInput9: T_9,
    ...laterInputOthers: T_others
  ) => ReturnType<T_fn>)
  | ((
    laterInput8: T_8,
    laterInput9: T_9,
    ...laterInputOthers: T_others
  ) => ReturnType<T_fn>)
  | ((
    laterInput9: T_9,
    ...laterInputOthers: T_others
  ) => ReturnType<T_fn>)
  | ((
    ...laterInputOthers: T_others
  ) => ReturnType<T_fn>)
{
  if (!presetInput1) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(presetInput0, ...laterInputs);
    };
  }

  if (!presetInput2) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst2<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(presetInput0, // Don't scream at me here.
        presetInput1 as any, ...laterInputs);
    };
  }

  if (!presetInput3) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst3<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(presetInput0, presetInput1 as any, presetInput2 as any, ...laterInputs);
    };
  }

  if (!presetInput4) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst4<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(
        presetInput0,
        presetInput1 as any,
        presetInput2 as any,
        presetInput3 as any,
        ...laterInputs,
      );
    };
  }

  if (!presetInput5) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst5<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(
        presetInput0,
        presetInput1 as any,
        presetInput2 as any,
        presetInput3 as any,
        presetInput4 as any,
        ...laterInputs,
      );
    };
  }

  if (!presetInput6) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst6<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(
        presetInput0,
        presetInput1 as any,
        presetInput2 as any,
        presetInput3 as any,
        presetInput4 as any,
        presetInput5 as any,
        ...laterInputs,
      );
    };
  }

  if (!presetInput7) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst7<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(
        presetInput0,
        presetInput1 as any,
        presetInput2 as any,
        presetInput3 as any,
        presetInput4 as any,
        presetInput5 as any,
        presetInput6 as any,
        ...laterInputs,
      );
    };
  }

  if (!presetInput8) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst8<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(
        presetInput0,
        presetInput1 as any,
        presetInput2 as any,
        presetInput3 as any,
        presetInput4 as any,
        presetInput5 as any,
        presetInput6 as any,
        presetInput7 as any,
        ...laterInputs,
      );
    };
  }

  if (!presetInput9) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst9<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(
        presetInput0,
        presetInput1 as any,
        presetInput2 as any,
        presetInput3 as any,
        presetInput4 as any,
        presetInput5 as any,
        presetInput6 as any,
        presetInput7 as any,
        presetInput8 as any,
        ...laterInputs,
      );
    };
  }

  return function partiallyApplied(
    ...laterInputs: WithoutFirst10<Parameters<T_fn>>
  ): ReturnType<T_fn> {
    return fn(
      presetInput0,
      presetInput1 as any,
      presetInput2 as any,
      presetInput3 as any,
      presetInput4 as any,
      presetInput5 as any,
      presetInput6 as any,
      presetInput7 as any,
      presetInput8 as any,
      presetInput9 as any,
      ...laterInputs,
    );
  };
}
