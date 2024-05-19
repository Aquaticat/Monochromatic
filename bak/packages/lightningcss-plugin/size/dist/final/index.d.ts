import { CustomProperty } from 'lightningcss';
import { DimensionPercentageFor_LengthValue } from 'lightningcss';

declare const _default: {
    Declaration: {
        custom: {
            size(property: CustomProperty): ({
                property: "inline-size";
                value: {
                    type: "length-percentage";
                    value: DimensionPercentageFor_LengthValue;
                };
            } | {
                property: "block-size";
                value: {
                    type: "length-percentage";
                    value: DimensionPercentageFor_LengthValue;
                };
            })[] | undefined;
        };
    };
};
export default _default;

export { }
