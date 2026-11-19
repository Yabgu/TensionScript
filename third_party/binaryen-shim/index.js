// The `binaryen` module name, for the compiler's **self-build**.
//
// `scripts/build.js` bundles Binaryen into `dist/binaryen.js`, so nothing in `dist/`
// imports a bare `binaryen` any more. One thing still does: the JS wrapper the
// compiler emits when it compiles *itself* (`src/asconfig.json`'s targets). Its
// binding generator names an imported JavaScript file after the file — `lib/binaryen.js`
// becomes `import … from "binaryen"` — so the bootstrap needs that specifier to
// resolve, and this package is what makes it resolve.
//
// Two consequences worth stating: it is a **devDependency**, because a consumer of
// the published tarball never runs the self-build and this path would not exist for
// them; and it points at `dist/`, which means it only works after `npm run build` —
// which is exactly when the bootstrap runs.
export * from "../../dist/binaryen.js";
export { default } from "../../dist/binaryen.js";
