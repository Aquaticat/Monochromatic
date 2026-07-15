// Fixture: dense brace-delimited bodies should trigger block-body-newline.
// Expected violation: stylistic(block-body-newline)

const condition = true;
const values = [1,];

function doThing(): void {}

function denseFunction(): number {return 1;}

const denseArrow = (): number => {return denseFunction();};

if (condition) {doThing();}
else {doThing();}

for (const item of values) {void item;}

while (!condition) {doThing();}

do {doThing();} while (!condition);

try {doThing();}
catch (error) {throw error;}
finally {doThing();}

switch (denseFunction()) {case 1: doThing(); break; default: doThing();}

class DenseClassBody {static value = 0;}

class DenseWithMethod {
  method(): number {return DenseClassBody.value;}
}

class DenseWithStaticBlock {
  static {DenseClassBody.value = 1;}
}

class FullyDenseMethod {method(): number {return 1;}}

class FullyDenseStatic {static {DenseClassBody.value = 2;}}

namespace DenseNamespace {export const namespaceValue = 1;}

namespace OuterNamespace {export namespace InnerNamespace {export const inner = 1;}}

function commentAtStart(): void {/* keep start */doThing();}

function commentAtEnd(): void {doThing();/* keep end */}

function commentOnly(): void {/* keep only */}

function lineCommentAtStart(): void {// keep line start
  doThing();}

function lineCommentAtEnd(): void {doThing(); // keep line end
}

export {
  commentAtEnd,
  commentAtStart,
  commentOnly,
  denseArrow,
  denseFunction,
  DenseClassBody,
  DenseNamespace,
  DenseWithMethod,
  DenseWithStaticBlock,
  FullyDenseMethod,
  FullyDenseStatic,
  lineCommentAtEnd,
  lineCommentAtStart,
};
