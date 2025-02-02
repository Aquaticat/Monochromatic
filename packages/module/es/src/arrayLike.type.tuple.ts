/* @__NO_SIDE_EFFECTS__ */ export type Tuple<
  T_element,
  T_count extends number,
> = T_count extends 0 ? never[]
  : T_count extends 1 ? [T_element]
  : T_count extends 2 ? [T_element, T_element]
  : T_count extends 3 ? [T_element, T_element, T_element]
  : T_count extends 4 ? [
      T_element,
      T_element,
      T_element,
      T_element,
    ]
  : T_count extends 5 ? [
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
    ]
  : T_count extends 6 ? [
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
    ]
  : T_count extends 7 ? [
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
    ]
  : T_count extends 8 ? [
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
    ]
  : T_count extends 9 ? [
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
    ]
  : T_count extends 10 ? [
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
      T_element,
    ]
  : T_element[];
