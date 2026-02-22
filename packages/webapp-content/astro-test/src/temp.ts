import 'ses';

const randomStringMaxLength = 10;

const randomStringMinLength = 5;

const randomStringComponents = [
  '0',
  '1',
  '-',
  '+',
  '2',
  '=',
  '==',
  ' new ',
  ' Math ',
  ' Function ',
  ' Array ',
  ' async ',
  ' await ',
  ' function ',
  ' BigInt ',
  '[',
  ']',
  '[]',
  '(',
  ')',
  '()',
  '{',
  '}',
  '{}',
  '`${',
  ',',
  '.',
  '!',
  '`',
  '$',
  '%',
  '^',
  '~',
  '&',
  '&&',
  '*',
  '/',
  '\\',
  '|',
  '||',
  '?',
  '??',
  "'",
  '"',
  ':',
  ' Boolean ',
  ' Date ',
  ' Error ',
  ' Infinity ',
  ' Map ',
  ' NaN ',
  ' Number ',
  ' Object ',
  ' Promise ',
  ' Proxy ',
  ' Set ',
  ' RegExp ',
  ' String ',
  ' Symbol ',
  '<',
  '>',
  '...',
  ' yield ',
  ' typeof ',
  ' void ',
  ' let ',
  ' var ',
  ' const ',
  ' null ',
  ' undefined ',
  ' false ',
  ' true ',
  ' in ',
  ' instanceof ',
  ' delete ',
  ' break ',
  ' continue ',
  ' if ',
  ' else ',
  ' while ',
  ' do ',
  ' forEach ',
  ' of ',
  ' try ',
  ' catch ',
  ' throw ',
  ' switch ',
  ' return ',
  ' arguments ',
  ' from ',
  ' entries ',
  ' includes ',
  ' contains ',
  ' map ',
  ' flat ',
  ' ',
  '=>',
];

const validExpressions = new Map<string, any>();
let retryNumber = -1;

while (validExpressions.size < 100) {
  retryNumber++;

  const randomStringLength = randomStringMinLength
    + Math.trunc(Math
      .random() * (randomStringMaxLength - randomStringMinLength),);

  const randomString = ((): string => {
    let randomStringTemp = '';
    for (
      let randomStringPartIndex = 0;
      randomStringPartIndex < randomStringLength;
      randomStringPartIndex++
    ) {
      const randomStringPart: string = randomStringComponents[
        Math.trunc(Math
          .random() * randomStringComponents.length,)
      ] as string;

      randomStringTemp += randomStringPart;
    }
    return randomStringTemp;
  })();

  const randomCodeCompartment = new Compartment();

  try {
    randomCodeCompartment.evaluate(`
      'use strict';

      globalThis.result = (${randomString});

      if (globalThis.result === undefined) {
        throw new Error('undefined');
      }
      if (String(globalThis.result).length >= 10) {
        throw new Error('result too long');
      }
      `,);

    validExpressions.set(randomString, randomCodeCompartment
      .globalThis
      .result,);

    console.log(retryNumber, validExpressions.size,);
    console.log(randomString,);
    console.log(randomCodeCompartment.globalThis.result,);
    console.log();
  }
  catch {
    // console.warn(i);
    // console.warn(randomString);
    // console.warn();
  }
}
