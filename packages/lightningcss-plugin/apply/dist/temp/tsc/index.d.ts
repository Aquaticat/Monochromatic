import type { Declaration, DeclarationBlock } from 'lightningcss';
declare const _default: {
    Rule: {
        style(rule: {
            type: "style";
            value: import("lightningcss").StyleRule<Declaration, import("lightningcss").MediaQuery>;
        } & {
            value: Required<import("lightningcss").StyleRule<Declaration, import("lightningcss").MediaQuery>> & {
                declarations: Required<DeclarationBlock<Declaration>>;
            };
        }): ({
            type: "style";
            value: import("lightningcss").StyleRule<Declaration, import("lightningcss").MediaQuery>;
        } & {
            value: Required<import("lightningcss").StyleRule<Declaration, import("lightningcss").MediaQuery>> & {
                declarations: Required<DeclarationBlock<Declaration>>;
            };
        }) | {
            type: "ignored";
            value: null;
        };
    };
};
export default _default;
//# sourceMappingURL=index.d.ts.map