/* @__NO_SIDE_EFFECTS__ */ export function* gen0to999(): Generator<number> {
  for (let i = 0; i < 1000; i++) {
    yield i;
  }
}

/* @__NO_SIDE_EFFECTS__ */ export function* gen0to999error(): Generator<number> {
  for (let i = 0; i < 999; i++) {
    yield i;
  }
  throw new RangeError(`fixture reached 999`);
}

/* @__NO_SIDE_EFFECTS__ */ export async function* gen0to999Async(): AsyncGenerator<
  number
> {
  for (let i = 0; i < 1000; i++) {
    yield i;
  }
}

/* @__NO_SIDE_EFFECTS__ */ export async function* gen0to999errorAsync(): AsyncGenerator<
  number
> {
  for (let i = 0; i < 999; i++) {
    yield i;
  }
  throw new RangeError(`fixture reached 999`);
}

/* @__NO_SIDE_EFFECTS__ */ export async function* gen0to999AsyncSlow(): AsyncGenerator<
  number
> {
  for (let i = 0; i < 1000; i++) {
    await (new Promise((resolve) => setTimeout(resolve, i)));
    yield i;
  }
}

/* @__NO_SIDE_EFFECTS__ */ export async function* gen0to999errorAsyncSlow(): AsyncGenerator<
  number
> {
  for (let i = 0; i < 999; i++) {
    await (new Promise((resolve) => setTimeout(resolve, i)));
    yield i;
  }
  throw new RangeError(`fixture reached 999`);
}
