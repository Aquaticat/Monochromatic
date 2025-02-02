import type {
  CustomAtRules,
  Size,
  Visitor,
} from 'lightningcss';

export default {
  Declaration: {
    custom: {
      // @ts-expect-error
      size(property) {
        if (property.value[0]!.type === 'length') {
          const value: Size = {
            type: 'length-percentage',
            value: { type: 'dimension', value: property.value[0].value },
          };
          return [
            { property: 'inline-size', value },
            { property: 'block-size', value },
          ];
        }
      },
    },
  },
} satisfies Visitor<CustomAtRules>;
