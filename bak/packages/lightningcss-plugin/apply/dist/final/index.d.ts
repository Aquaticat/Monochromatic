import type { Declaration } from 'lightningcss';
import type { DeclarationBlock } from 'lightningcss';
import { MediaQuery } from 'lightningcss';
import { StyleRule } from 'lightningcss';

declare const _default: {
    Rule: {
        style(rule: {
            type: "style";
            value: StyleRule<Declaration, MediaQuery>;
        } & {
            value: Required<StyleRule<Declaration, MediaQuery>> & {
                declarations: Required<DeclarationBlock<Declaration>>;
            };
        }): ({
            type: "style";
            value: StyleRule<Declaration, MediaQuery>;
        } & {
            value: Required<StyleRule<Declaration, MediaQuery>> & {
                declarations: Required<DeclarationBlock<Declaration>>;
            };
        }) | {
            type: "ignored";
            value: null;
        };
    };
};
export default _default;

export { }
