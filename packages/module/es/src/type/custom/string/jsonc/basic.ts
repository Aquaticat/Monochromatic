export type jsonc = string & {__brand: 'jsonc'};

//
//```jsonc
// // comment1
// {
// // comment2
// "a": /*comment3*/ 1,
// "b": 2,
// },
// ```
//
// {//}
