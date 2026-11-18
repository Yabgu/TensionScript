import "./glue/js/index";
export * from "./index-wasm";

// The re-used-`ExpressionRef` guard is a **JavaScript-build** debug aid: it needs
// `process.env` and a stack, neither of which the self-hosted (wasm) compiler
// has. This file is the JS entry and is outside the wasm module graph
// (`src/asconfig.json` compiles `index-wasm.ts`), so the decision lives here and
// reaches the wrapper through `enableRefGuard`.
//   TENSION_REF_GUARD=1 node bin/tensionscript.js …
{
  const env = (globalThis as {
    process?: { env?: { [name: string]: string | undefined } };
  }).process?.env;
  const flag = env?.["TENSION_REF_GUARD"];
  enableRefGuard(flag === "1" || flag === "true");
}

// Full API
export * from "./ast";
export * from "./common";
export * from "./compiler";
export * from "./bindings";
export * from "./diagnostics";
export * from "./flow";
export * from "./module";
export * from "./parser";
export * from "./program";
export * from "./resolver";
export * from "./tokenizer";
export * from "./types";
export * from "./extra/ast";
export * from "./async/lower";
export * from "./closure/lower";
import * as util from "./util";
export { util };

import { enableRefGuard } from "./module";
