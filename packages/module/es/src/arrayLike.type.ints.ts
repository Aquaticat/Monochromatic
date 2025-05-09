export type Ints<fromInclusive extends number, toInclusive extends number,> =
  fromInclusive extends -10 ? toInclusive extends -10 ? -10
    : toInclusive extends -9 ? (-10 | -9)
    : toInclusive extends -8 ? (-10 | -9 | -8)
    : toInclusive extends -7 ? (-10 | -9 | -8 | -7)
    : toInclusive extends -6 ? (-10 | -9 | -8 | -7 | -6)
    : toInclusive extends -5 ? (-10 | -9 | -8 | -7 | -6 | -5)
    : toInclusive extends -4 ? (-10 | -9 | -8 | -7 | -6 | -5 | -4)
    : toInclusive extends -3 ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3)
    : toInclusive extends -2 ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2)
    : toInclusive extends -1 ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1)
    : toInclusive extends 0 ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0)
    : toInclusive extends 1 ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1)
    : toInclusive extends 2
      ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2)
    : toInclusive extends 3
      ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3)
    : toInclusive extends 4
      ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4)
    : toInclusive extends 5
      ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
    : toInclusive extends 6
      ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
    : toInclusive extends 7
      ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
    : toInclusive extends 8 ? (
        | -10
        | -9
        | -8
        | -7
        | -6
        | -5
        | -4
        | -3
        | -2
        | -1
        | 0
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6
        | 7
        | 8
      )
    : toInclusive extends 9 ? (
        | -10
        | -9
        | -8
        | -7
        | -6
        | -5
        | -4
        | -3
        | -2
        | -1
        | 0
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6
        | 7
        | 8
        | 9
      )
    : toInclusive extends 10 ? (
        | -10
        | -9
        | -8
        | -7
        | -6
        | -5
        | -4
        | -3
        | -2
        | -1
        | 0
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6
        | 7
        | 8
        | 9
        | 10
      )
    : number
    : fromInclusive extends -9 ? toInclusive extends -9 ? -9
      : toInclusive extends -8 ? (-9 | -8)
      : toInclusive extends -7 ? (-9 | -8 | -7)
      : toInclusive extends -6 ? (-9 | -8 | -7 | -6)
      : toInclusive extends -5 ? (-9 | -8 | -7 | -6 | -5)
      : toInclusive extends -4 ? (-9 | -8 | -7 | -6 | -5 | -4)
      : toInclusive extends -3 ? (-9 | -8 | -7 | -6 | -5 | -4 | -3)
      : toInclusive extends -2 ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2)
      : toInclusive extends -1 ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1)
      : toInclusive extends 0 ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0)
      : toInclusive extends 1 ? (-   9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1)
      : toInclusive extends 2 ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2)
      : toInclusive extends 3
        ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3)
      : toInclusive extends 4
        ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toInclusive extends 5
        ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toInclusive extends 6
        ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toInclusive extends 7
        ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toInclusive extends 8
        ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toInclusive extends 9 ? (
          | -9
          | -8
          | -7
          | -6
          | -5
          | -4
          | -3
          | -2
          | -1
          | 0
          | 1
          | 2
          | 3
          | 4
          | 5
          | 6
          | 7
          | 8
          | 9
        )
      : toInclusive extends 10 ? (
          | -9
          | -8
          | -7
          | -6
          | -5
          | -4
          | -3
          | -2
          | -1
          | 0
          | 1
          | 2
          | 3
          | 4
          | 5
          | 6
          | 7
          | 8
          | 9
          | 10
        )
      : number
    : fromInclusive extends -8 ? toInclusive extends -8 ? -8
      : toInclusive extends -7 ? (-8 | -7)
      : toInclusive extends -6 ? (-8 | -7 | -6)
      : toInclusive extends -5 ? (-8 | -7 | -6 | -5)
      : toInclusive extends -4 ? (-8 | -7 | -6 | -5 | -4)
      : toInclusive extends -3 ? (-8 | -7 | -6 | -5 | -4 | -3)
      : toInclusive extends -2 ? (-8 | -7 | -6 | -5 | -4 | -3 | -2)
      : toInclusive extends -1 ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1)
      : toInclusive extends 0 ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0)
      : toInclusive extends 1 ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1)
      : toInclusive extends 2 ? (-8 | -   7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2)
      : toInclusive extends 3 ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3)
      : toInclusive extends 4
        ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toInclusive extends 5
        ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toInclusive extends 6
        ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toInclusive extends 7
        ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toInclusive extends 8
        ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toInclusive extends 9
        ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : toInclusive extends 10 ? (
          | -8
          | -7
          | -6
          | -5
          | -4
          | -3
          | -2
          | -1
          | 0
          | 1
          | 2
          | 3
          | 4
          | 5
          | 6
          | 7
          | 8
          | 9
          | 10
        )
      : number
    : fromInclusive extends -7 ? toInclusive extends -7 ? -7
      : toInclusive extends -6 ? (-7 | -6)
      : toInclusive extends -5 ? (-7 | -6 | -5)
      : toInclusive extends -4 ? (-7 | -6 | -5 | -4)
      : toInclusive extends -3 ? (-7 | -6 | -5 | -4 | -3)
      : toInclusive extends -2 ? (-7 | -6 | -5 | -4 | -3 | -2)
      : toInclusive extends -1 ? (-7 | -6 | -5 | -4 | -3 | -2 | -1)
      : toInclusive extends 0 ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0)
      : toInclusive extends 1 ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1)
      : toInclusive extends 2 ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2)
      : toInclusive extends 3 ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3)
      : toInclusive extends 4 ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toInclusive extends 5 ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toInclusive extends 6
        ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toInclusive extends 7
        ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toInclusive extends 8
        ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toInclusive extends 9
        ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : toInclusive extends 10
        ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)
      : number
    : fromInclusive extends -6 ? toInclusive extends -6 ? -6
      : toInclusive extends -5 ? (-6 | -5)
      : toInclusive extends -4 ? (-6 | -5 | -4)
      : toInclusive extends -3 ? (-6 | -5 | -4 | -3)
      : toInclusive extends -2 ? (-6 | -5 | -4 | -3 | -2)
      : toInclusive extends -1 ? (-6 | -5 | -4 | -3 | -2 | -1)
      : toInclusive extends 0 ? (-6 | -5 | -4 | -3 | -2 | -1 | 0)
      : toInclusive extends 1 ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1)
      : toInclusive extends 2 ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2)
      : toInclusive extends 3 ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3)
      : toInclusive extends 4 ? (-6 | -5 | -4 | -3 | -   2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toInclusive extends 5 ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toInclusive extends 6 ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toInclusive extends 7
        ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toInclusive extends 8
        ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toInclusive extends 9
        ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : toInclusive extends 10
        ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)
      : number
    : fromInclusive extends -5 ? toInclusive extends -5 ? -5
      : toInclusive extends -4 ? (-5 | -4)
      : toInclusive extends -3 ? (-5 | -4 | -3)
      : toInclusive extends -2 ? (-5 | -4 | -3 | -2)
      : toInclusive extends -1 ? (-5 | -4 | -3 | -2 | -1)
      : toInclusive extends 0 ? (-5 | -4 | -3 | -2 | -1 | 0)
      : toInclusive extends 1 ? (-5 | -4 | -3 | -2 | -1 | 0 | 1)
      : toInclusive extends 2 ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2)
      : toInclusive extends 3 ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3)
      : toInclusive extends 4 ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toInclusive extends 5 ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toInclusive extends 6 ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toInclusive extends 7 ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toInclusive extends 8
        ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toInclusive extends 9
        ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : toInclusive extends 10
        ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)
      : number
    : fromInclusive extends -4 ? toInclusive extends -4 ? -4
      : toInclusive extends -3 ? (-4 | -3)
      : toInclusive extends -2 ? (-4 | -3 | -2)
      : toInclusive extends -1 ? (-4 | -3 | -2 | -1)
      : toInclusive extends 0 ? (-4 | -3 | -2 | -1 | 0)
      : toInclusive extends 1 ? (-4 | -3 | -2 | -1 | 0 | 1)
      : toInclusive extends 2 ? (-4 | -3 | -2 | -1 | 0 | 1 | 2)
      : toInclusive extends 3 ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3)
      : toInclusive extends 4 ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toInclusive extends 5 ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toInclusive extends 6 ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toInclusive extends 7 ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toInclusive extends 8 ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toInclusive extends 9
        ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : toInclusive extends 10
        ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)
      : number
    : fromInclusive extends -3 ? toInclusive extends -3 ? -3
      : toInclusive extends -2 ? (-3 | -2)
      : toInclusive extends -1 ? (-3 | -2 | -1)
      : toInclusive extends 0 ? (-3 | -2 | -1 | 0)
      : toInclusive extends 1 ? (-3 | -2 | -1 | 0 | 1)
      : toInclusive extends 2 ? (-3 | -2 | -1 | 0 | 1 | 2)
      : toInclusive extends 3 ? (-3 | -2 | -1 | 0 | 1 | 2 | 3)
      : toInclusive extends 4 ? (-3 | -2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toInclusive extends 5 ? (-3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toInclusive extends 6 ? (-3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toInclusive extends 7 ? (-3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toInclusive extends 8 ? (-3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toInclusive extends 9 ? (-3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : toInclusive extends 10
        ? (-3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)
      : number
    : fromInclusive extends -2 ? toInclusive extends -2 ? -2
      : toInclusive extends -1 ? (-2 | -1)
      : toInclusive extends 0 ? (-2 | -1 | 0)
      : toInclusive extends 1 ? (-2 | -1 | 0 | 1)
      : toInclusive extends 2 ? (-2 | -1 | 0 | 1 | 2)
      : toInclusive extends 3 ? (-2 | -1 | 0 | 1 | 2 | 3)
      : toInclusive extends 4 ? (-2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toInclusive extends 5 ? (-2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toInclusive extends 6 ? (-2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toInclusive extends 7 ? (-2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toInclusive extends 8 ? (-2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toInclusive extends 9 ? (-2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : toInclusive extends 10 ? (-2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)
      : number
    : fromInclusive extends -1 ? toInclusive extends -1 ? -1
      : toInclusive extends 0 ? (-1 | 0)
      : toInclusive extends 1 ? (-1 | 0 | 1)
      : toInclusive extends 2 ? (-1 | 0 | 1 | 2)
      : toInclusive extends 3 ? (-1 | 0 | 1 | 2 | 3)
      : toInclusive extends 4 ? (-1 | 0 | 1 | 2 | 3 | 4)
      : toInclusive extends 5 ? (-1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toInclusive extends 6 ? (-1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toInclusive extends 7 ? (-1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toInclusive extends 8 ? (-1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toInclusive extends 9 ? (-1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : toInclusive extends 10 ? (-1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)
      : number
    : fromInclusive extends 0 ? toInclusive extends 0 ? 0
      : toInclusive extends 1 ? (0 | 1)
      : toInclusive extends 2 ? (0 | 1 | 2)
      : toInclusive extends 3 ? (0 | 1 | 2 | 3)
      : toInclusive extends 4 ? (0 | 1 | 2 | 3 | 4)
      : toInclusive extends 5 ? (0 | 1 | 2 | 3 | 4 | 5)
      : toInclusive extends 6 ? (0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toInclusive extends 7 ? (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toInclusive extends 8 ? (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toInclusive extends 9 ? (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : toInclusive extends 10 ? (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)
      : number
    : fromInclusive extends 1 ? toInclusive extends 1 ? 1
      : toInclusive extends 2 ? (1 | 2)
      : toInclusive extends 3 ? (1 | 2 | 3)
      : toInclusive extends 4 ? (1 | 2 | 3 | 4)
      : toInclusive extends 5 ? (1 | 2 | 3 | 4 | 5)
      : toInclusive extends 6 ? (1 | 2 | 3 | 4 | 5 | 6)
      : toInclusive extends 7 ? (1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toInclusive extends 8 ? (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toInclusive extends 9 ? (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : toInclusive extends 10 ? (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)
      : number
    : fromInclusive extends 2 ? toInclusive extends 2 ? 2
      : toInclusive extends 3 ? (2 | 3)
      : toInclusive extends 4 ? (2 | 3 | 4)
      : toInclusive extends 5 ? (2 | 3 | 4 | 5)
      : toInclusive extends 6 ? (2 | 3 | 4 | 5 | 6)
      : toInclusive extends 7 ? (2 | 3 | 4 | 5 | 6 | 7)
      : toInclusive extends 8 ? (2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toInclusive extends 9 ? (2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : toInclusive extends 10 ? (2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)
      : number
    : fromInclusive extends 3 ? toInclusive extends 3 ? 3
      : toInclusive extends 4 ? (3 | 4)
      : toInclusive extends 5 ? (3 | 4 | 5)
      : toInclusive extends 6 ? (3 | 4 | 5 | 6)
      : toInclusive extends 7 ? (3 | 4 | 5 | 6 | 7)
      : toInclusive extends 8 ? (3 | 4 | 5 | 6 | 7 | 8)
      : toInclusive extends 9 ? (3 | 4 | 5 | 6 | 7 | 8 | 9)
      : toInclusive extends 10 ? (3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)
      : number
    : fromInclusive extends 4 ? toInclusive extends 4 ? 4
      : toInclusive extends 5 ? (4 | 5)
      : toInclusive extends 6 ? (4 | 5 | 6)
      : toInclusive extends 7 ? (4 | 5 | 6 | 7)
      : toInclusive extends 8 ? (4 | 5 | 6 | 7 | 8)
      : toInclusive extends 9 ? (4 | 5 | 6 | 7 | 8 | 9)
      : toInclusive extends 10 ? (4 | 5 | 6 | 7 | 8 | 9 | 10)
      : number
    : fromInclusive extends 5 ? toInclusive extends 5 ? 5
      : toInclusive extends 6 ? (5 | 6)
      : toInclusive extends 7 ? (5 | 6 | 7)
      : toInclusive extends 8 ? (5 | 6 | 7 | 8)
      : toInclusive extends 9 ? (5 | 6 | 7 | 8 | 9)
      : toInclusive extends 10 ? (5 | 6 | 7 | 8 | 9 | 10)
      : number
    : fromInclusive extends 6 ? toInclusive extends 6 ? 6
      : toInclusive extends 7 ? (6 | 7)
      : toInclusive extends 8 ? (6 | 7 | 8)
      : toInclusive extends 9 ? (6 | 7 | 8 | 9)
      : toInclusive extends 10 ? (6 | 7 | 8 | 9 | 10)
      : number
    : fromInclusive extends 7 ? toInclusive extends 7 ? 7
      : toInclusive extends 8 ? (7 | 8)
      : toInclusive extends 9 ? (7 | 8 | 9)
      : toInclusive extends 10 ? (7 | 8 | 9 | 10)
      : number
    : fromInclusive extends 8 ? toInclusive extends 8 ? 8
      : toInclusive extends 9 ? (8 | 9)
      : toInclusive extends 10 ? (8 | 9 | 10)
      : number
    : fromInclusive extends 9
      ? toInclusive extends 9 ? 9 : toInclusive extends 10 ? (9 | 10) : number
    : fromInclusive extends 10 ? toInclusive extends 10 ? 10 : number
    : number;

export type IntsToExclusive<fromInclusive extends number, toExclusive extends number,> =
  fromInclusive extends -10 ? toExclusive extends -10 ? never
    : toExclusive extends -9 ? (-10)
    : toExclusive extends -8 ? (-10 | -9)
    : toExclusive extends -7 ? (-10 | -9 | -8)
    : toExclusive extends -6 ? (-10 | -9 | -8 | -7)
    : toExclusive extends -5 ? (-10 | -9 | -8 | -7 | -6)
    : toExclusive extends -4 ? (-10 | -9 | -8 | -7 | -6 | -5)
    : toExclusive extends -3 ? (-10 | -9 | -8 | -7 | -6 | -5 | -4)
    : toExclusive extends -2 ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3)
    : toExclusive extends -1 ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2)
    : toExclusive extends 0 ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1)
    : toExclusive extends 1 ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0)
    : toExclusive extends 2 ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1)
    : toExclusive extends 3
      ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2)
    : toExclusive extends 4
      ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3)
    : toExclusive extends 5
      ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4)
    : toExclusive extends 6
      ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
    : toExclusive extends 7
      ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
    : toExclusive extends 8
      ? (-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
    : toExclusive extends 9 ? (
        | -10
        | -9
        | -8
        | -7
        | -6
        | -5
        | -4
        | -3
        | -2
        | -1
        | 0
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6
        | 7
        | 8
      )
    : toExclusive extends 10 ? (
        | -10
        | -9
        | -8
        | -7
        | -6
        | -5
        | -4
        | -3
        | -2
        | -1
        | 0
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6
        | 7
        | 8
        | 9
      )
    : number
    : fromInclusive extends -9 ? toExclusive extends -9 ? never
      : toExclusive extends -8 ? (-9)
      : toExclusive extends -7 ? (-9 | -8)
      : toExclusive extends -6 ? (-9 | -8 | -7)
      : toExclusive extends -5 ? (-9 | -8 | -7 | -6)
      : toExclusive extends -4 ? (-9 | -8 | -7 | -6 | -5)
      : toExclusive extends -3 ? (-9 | -8 | -7 | -6 | -5 | -4)
      : toExclusive extends -2 ? (-9 | -8 | -7 | -6 | -5 | -4 | -3)
      : toExclusive extends -1 ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2)
      : toExclusive extends 0 ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1)
      : toExclusive extends 1 ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0)
      : toExclusive extends 2 ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1)
      : toExclusive extends 3 ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2)
      : toExclusive extends 4
        ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3)
      : toExclusive extends 5
        ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -   1 | 0 | 1 | 2 | 3 | 4)
      : toExclusive extends 6
        ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toExclusive extends 7
        ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toExclusive extends 8
        ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toExclusive extends 9
        ? (-9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toExclusive extends 10 ? (
          | -9
          | -8
          | -7
          | -6
          | -5
          | -4
          | -3
          | -2
          | -1
          | 0
          | 1
          | 2
          | 3
          | 4
          | 5
          | 6
          | 7
          | 8
          | 9
        )
      : number
    : fromInclusive extends -8 ? toExclusive extends -8 ? never
      : toExclusive extends -7 ? (-8)
      : toExclusive extends -6 ? (-8 | -7)
      : toExclusive extends -5 ? (-8 | -7 | -6)
      : toExclusive extends -4 ? (-8 | -7 | -6 | -5)
      : toExclusive extends -3 ? (-8 | -7 | -6 | -5 | -4)
      : toExclusive extends -2 ? (-8 | -7 | -6 | -5 | -4 | -3)
      : toExclusive extends -1 ? (-8 | -7 | -6 | -5 | -4 | -3 | -2)
      : toExclusive extends 0 ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1)
      : toExclusive extends 1 ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0)
      : toExclusive extends 2 ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1)
      : toExclusive extends 3 ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2)
      : toExclusive extends 4 ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3)
      : toExclusive extends 5
        ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toExclusive extends 6
        ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toExclusive extends 7
        ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toExclusive extends 8
        ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toExclusive extends 9
        ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toExclusive extends 10
        ? (-8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : number
    : fromInclusive extends -7 ? toExclusive extends -7 ? never
      : toExclusive extends -6 ? (-7)
      : toExclusive extends -5 ? (-7 | -6)
      : toExclusive extends -4 ? (-7 | -6 | -5)
      : toExclusive extends -3 ? (-7 | -6 | -5 | -4)
      : toExclusive extends -2 ? (-7 | -6 | -5 | -4 | -3)
      : toExclusive extends -1 ? (-7 | -6 | -5 | -4 | -3 | -2)
      : toExclusive extends 0 ? (-7 | -6 | -5 | -4 | -3 | -2 | -1)
      : toExclusive extends 1 ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0)
      : toExclusive extends 2 ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1)
      : toExclusive extends 3 ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2)
      : toExclusive extends 4 ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3)
      : toExclusive extends 5 ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toExclusive extends 6 ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toExclusive extends 7
        ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toExclusive extends 8
        ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toExclusive extends 9
        ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toExclusive extends 10
        ? (-7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : number
    : fromInclusive extends -6 ? toExclusive extends -6 ? never
      : toExclusive extends -5 ? (-6)
      : toExclusive extends -4 ? (-6 | -5)
      : toExclusive extends -3 ? (-6 | -5 | -4)
      : toExclusive extends -2 ? (-6 | -5 | -4 | -3)
      : toExclusive extends -1 ? (-6 | -5 | -4 | -3 | -2)
      : toExclusive extends 0 ? (-6 | -5 | -4 | -3 | -2 | -1)
      : toExclusive extends 1 ? (-6 | -5 | -4 | -3 | -2 | -1 | 0)
      : toExclusive extends 2 ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1)
      : toExclusive extends 3 ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2)
      : toExclusive extends 4 ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3)
      : toExclusive extends 5 ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toExclusive extends 6 ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toExclusive extends 7 ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toExclusive extends 8
        ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toExclusive extends 9
        ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toExclusive extends 10
        ? (-6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : number
    : fromInclusive extends -5 ? toExclusive extends -5 ? never
      : toExclusive extends -4 ? (-5)
      : toExclusive extends -3 ? (-5 | -4)
      : toExclusive extends -2 ? (-5 | -4 | -3)
      : toExclusive extends -1 ? (-5 | -4 | -3 | -2)
      : toExclusive extends 0 ? (-5 | -4 | -3 | -2 | -1)
      : toExclusive extends 1 ? (-5 | -4 | -3 | -2 | -1 | 0)
      : toExclusive extends 2 ? (-5 | -4 | -3 | -2 | -1 | 0 | 1)
      : toExclusive extends 3 ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2)
      : toExclusive extends 4 ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3)
      : toExclusive extends 5 ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toExclusive extends 6 ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toExclusive extends 7 ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toExclusive extends 8 ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toExclusive extends 9
        ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toExclusive extends 10
        ? (-5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : number
    : fromInclusive extends -4 ? toExclusive extends -4 ? never
      : toExclusive extends -3 ? (-4)
      : toExclusive extends -2 ? (-4 | -3)
      : toExclusive extends -1 ? (-4 | -3 | -2)
      : toExclusive extends 0 ? (-4 | -3 | -2 | -1)
      : toExclusive extends 1 ? (-4 | -3 | -2 | -1 | 0)
      : toExclusive extends 2 ? (-4 | -3 | -2 | -1 | 0 | 1)
      : toExclusive extends 3 ? (-4 | -3 | -2 | -1 | 0 | 1 | 2)
      : toExclusive extends 4 ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3)
      : toExclusive extends 5 ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toExclusive extends 6 ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toExclusive extends 7 ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toExclusive extends 8 ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toExclusive extends 9 ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toExclusive extends 10
        ? (-4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : number
    : fromInclusive extends -3 ? toExclusive extends -3 ? never
      : toExclusive extends -2 ? (-3)
      : toExclusive extends -1 ? (-3 | -2)
      : toExclusive extends 0 ? (-3 | -2 | -1)
      : toExclusive extends 1 ? (-3 | -2 | -1 | 0)
      : toExclusive extends 2 ? (-3 | -2 | -1 | 0 | 1)
      : toExclusive extends 3 ? (-3 | -2 | -1 | 0 | 1 | 2)
      : toExclusive extends 4 ? (-3 | -2 | -1 | 0 | 1 | 2 | 3)
      : toExclusive extends 5 ? (-3 | -2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toExclusive extends 6 ? (-3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toExclusive extends 7 ? (-3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toExclusive extends 8 ? (-3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toExclusive extends 9 ? (-3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toExclusive extends 10 ? (-3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : number
    : fromInclusive extends -2 ? toExclusive extends -2 ? never
      : toExclusive extends -1 ? (-2)
      : toExclusive extends 0 ? (-2 | -1)
      : toExclusive extends 1 ? (-2 | -1 | 0)
      : toExclusive extends 2 ? (-2 | -1 | 0 | 1)
      : toExclusive extends 3 ? (-2 | -1 | 0 | 1 | 2)
      : toExclusive extends 4 ? (-2 | -   1 | 0 | 1 | 2 | 3)
      : toExclusive extends 5 ? (-2 | -1 | 0 | 1 | 2 | 3 | 4)
      : toExclusive extends 6 ? (-2 | -1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toExclusive extends 7 ? (-2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toExclusive extends 8 ? (-2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toExclusive extends 9 ? (-2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toExclusive extends 10 ? (-2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : number
    : fromInclusive extends -1 ? toExclusive extends -1 ? never
      : toExclusive extends 0 ? (-1)
      : toExclusive extends 1 ? (-1 | 0)
      : toExclusive extends 2 ? (-1 | 0 | 1)
      : toExclusive extends 3 ? (-1 | 0 | 1 | 2)
      : toExclusive extends 4 ? (-1 | 0 | 1 | 2 | 3)
      : toExclusive extends 5 ? (-1 | 0 | 1 | 2 | 3 | 4)
      : toExclusive extends 6 ? (-1 | 0 | 1 | 2 | 3 | 4 | 5)
      : toExclusive extends 7 ? (-1 | 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toExclusive extends 8 ? (-1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toExclusive extends 9 ? (-1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toExclusive extends 10 ? (-1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : number
    : fromInclusive extends 0 ? toExclusive extends 0 ? never
      : toExclusive extends 1 ? (0)
      : toExclusive extends 2 ? (0 | 1)
      : toExclusive extends 3 ? (0 | 1 | 2)
      : toExclusive extends 4 ? (0 | 1 | 2 | 3)
      : toExclusive extends 5 ? (0 | 1 | 2 | 3 | 4)
      : toExclusive extends 6 ? (0 | 1 | 2 | 3 | 4 | 5)
      : toExclusive extends 7 ? (0 | 1 | 2 | 3 | 4 | 5 | 6)
      : toExclusive extends 8 ? (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toExclusive extends 9 ? (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toExclusive extends 10 ? (0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : number
    : fromInclusive extends 1 ? toExclusive extends 1 ? never
      : toExclusive extends 2 ? (1)
      : toExclusive extends 3 ? (1 | 2)
      : toExclusive extends 4 ? (1 | 2 | 3)
      : toExclusive extends 5 ? (1 | 2 | 3 | 4)
      : toExclusive extends 6 ? (1 | 2 | 3 | 4 | 5)
      : toExclusive extends 7 ? (1 | 2 | 3 | 4 | 5 | 6)
      : toExclusive extends 8 ? (1 | 2 | 3 | 4 | 5 | 6 | 7)
      : toExclusive extends 9 ? (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toExclusive extends 10 ? (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : number
    : fromInclusive extends 2 ? toExclusive extends 2 ? never
      : toExclusive extends 3 ? (2)
      : toExclusive extends 4 ? (2 | 3)
      : toExclusive extends 5 ? (2 | 3 | 4)
      : toExclusive extends 6 ? (2 | 3 | 4 | 5)
      : toExclusive extends 7 ? (2 | 3 | 4 | 5 | 6)
      : toExclusive extends 8 ? (2 | 3 | 4 | 5 | 6 | 7)
      : toExclusive extends 9 ? (2 | 3 | 4 | 5 | 6 | 7 | 8)
      : toExclusive extends 10 ? (2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)
      : number
    : fromInclusive extends 3 ? toExclusive extends 3 ? never
      : toExclusive extends 4 ? (3)
      : toExclusive extends 5 ? (3 | 4)
      : toExclusive extends 6 ? (3 | 4 | 5)
      : toExclusive extends 7 ? (3 | 4 | 5 | 6)
      : toExclusive extends 8 ? (3 | 4 | 5 | 6 | 7)
      : toExclusive extends 9 ? (3 | 4 | 5 | 6 | 7 | 8)
      : toExclusive extends 10 ? (3 | 4 | 5 | 6 | 7 | 8 | 9)
      : number
    : fromInclusive extends 4 ? toExclusive extends 4 ? never
      : toExclusive extends 5 ? (4)
      : toExclusive extends 6 ? (4 | 5)
      : toExclusive extends 7 ? (4 | 5 | 6)
      : toExclusive extends 8 ? (4 | 5 | 6 | 7)
      : toExclusive extends 9 ? (4 | 5 | 6 | 7 | 8)
      : toExclusive extends 10 ? (4 | 5 | 6 | 7 | 8 | 9)
      : number
    : fromInclusive extends 5 ? toExclusive extends 5 ? never
      : toExclusive extends 6 ? (5)
      : toExclusive extends 7 ? (5 | 6)
      : toExclusive extends 8 ? (5 | 6 | 7)
      : toExclusive extends 9 ? (5 | 6 | 7 | 8)
      : toExclusive extends 10 ? (5 | 6 | 7 | 8 | 9)
      : number
    : fromInclusive extends 6 ? toExclusive extends 6 ? never
      : toExclusive extends 7 ? (6)
      : toExclusive extends 8 ? (6 | 7)
      : toExclusive extends 9 ? (6 | 7 | 8)
      : toExclusive extends 10 ? (6 | 7 | 8 | 9)
      : number
    : fromInclusive extends 7 ? toExclusive extends 7 ? never
      : toExclusive extends 8 ? (7)
      : toExclusive extends 9 ? (7 | 8)
      : toExclusive extends 10 ? (7 | 8 | 9)
      : number
    : fromInclusive extends 8 ? toExclusive extends 8 ? never
      : toExclusive extends 9 ? (8)
      : toExclusive extends 10 ? (8 | 9)
      : number
    : fromInclusive extends 9
      ? toExclusive extends 9 ? never : toExclusive extends 10 ? (9) : number
    : fromInclusive extends 10 ? toExclusive extends 10 ? never : number
    : number;
