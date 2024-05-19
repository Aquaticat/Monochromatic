// src/index.ts
var src_default = {
  Token: {
    dimension(token) {
      if (token.unit.startsWith("--")) {
        return {
          type: "function",
          value: {
            name: "calc",
            arguments: [
              {
                type: "token",
                value: {
                  type: "number",
                  value: token.value
                }
              },
              {
                type: "token",
                value: {
                  type: "delim",
                  value: "*"
                }
              },
              {
                type: "var",
                value: {
                  name: {
                    ident: token.unit
                  }
                }
              }
            ]
          }
        };
      }
      return void 0;
    }
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
