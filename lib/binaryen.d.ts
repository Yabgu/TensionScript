// `lib/binaryen.js` re-exports `dist/binaryen.js`, the vendored Binaryen that
// `scripts/build-binaryen.js` builds from `third_party/binaryen`. That file has no
// typings of its own — the whole C API this compiler uses is declared ambiently by
// `src/glue/binaryen.d.ts` — so this says the only thing a consumer needs: the
// default export is the loaded module.
declare const binaryen: any;
export default binaryen;
