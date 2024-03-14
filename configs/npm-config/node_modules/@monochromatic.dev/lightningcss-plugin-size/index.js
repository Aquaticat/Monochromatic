export default {
  Declaration: {
    custom: {
      size(property) {
        if (property.value[0].type === 'length') {
          /** @type {import('../ast').Size} */
          const value = { type: 'length-percentage', value: { type: 'dimension', value: property.value[0].value } };
          return [
            { property: 'inline-size', value },
            { property: 'block-size', value },
          ];
        }
      },
    },
  },
};
