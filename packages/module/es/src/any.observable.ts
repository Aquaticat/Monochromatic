import type { Promisable, } from 'type-fest';

export function createObservable<const Value,>(value: Value,
  onChange: (value: Value, oldValue: Value,) => void,): { value: Value; }
{
  const proxy = new Proxy({
    value,
  }, {
    set(target, _property: 'value', newValue: Value,): true {
      const oldValue: Value = target.value;
      onChange(newValue, oldValue,);
      target.value = newValue;
      return true;
    },
  },);

  // Trigger onChange for initial value
  onChange(value, value,);

  return proxy;
}

export async function createObservableAsync<const Value,>(value: Value,
  onChange: (value: Value, oldValue: Value,) => Promisable<void>,
): Promise<{ value: Value; }> {
  const proxy = new Proxy({
    value,
  }, {
    // TODO: Test
    set(target, _property: 'value', newValue: Value,): true {
      const oldValue: Value = target.value;
      // Can't await here because Proxy handler doesn't accept async functions.
      onChange(newValue, oldValue,);
      target.value = newValue;
      return true;
    },
  },);

  // Trigger onChange for initial value
  await onChange(value, value,);

  return proxy;
}
