import { dirname, join } from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function buildWeb() {
  const pkg = JSON.parse(fs.readFileSync(join(__dirname, "../package-lock.json")));

  const mainVersion = pkg.version;
  const longVersion = pkg.packages["node_modules/long"].version || pkg.dependencies.long.version;

  const distUrl = mainVersion === "0.0.0" ? `./` : `https://cdn.jsdelivr.net/npm/@yabgu_gm/tensionscript@${mainVersion}/dist/`;
  const longUrl = `https://cdn.jsdelivr.net/npm/long@${longVersion}/index.js`;
  // **No `binaryen` entry.** Binaryen is bundled into `dist/asc.js` and
  // `dist/assemblyscript.js` (it is built from `third_party/binaryen`, not fetched
  // from a registry), so there is no bare specifier left for an import map to
  // resolve. A CDN URL here would point at a package version this tree no longer
  // consumes, which is worse than no entry: it would load a *different* Binaryen
  // under the name the bundled build already provides.
  const importmap = {
    "imports": {
      "@yabgu_gm/tensionscript": `${distUrl}assemblyscript.js`,
      "@yabgu_gm/tensionscript/asc": `${distUrl}asc.js`,
      "long": longUrl
    }
  };

  fs.writeFileSync(join(__dirname, "..", "dist", "importmap.json"), `${JSON.stringify(importmap, null, 2)}
  `);
  fs.writeFileSync(join(__dirname, "..", "dist", "web.js"), `var TENSIONSCRIPT_VERSION = ${JSON.stringify(mainVersion)};
  var TENSIONSCRIPT_IMPORTMAP = ${JSON.stringify(importmap, null, 2)};
  if (!document.currentScript.src.includes("noinstall")) {
    let elem = document.createElement("script");
    elem.type = "importmap";
    elem.text = JSON.stringify(TENSIONSCRIPT_IMPORTMAP);
    document.head.appendChild(elem);
  }
  if (!document.currentScript.src.includes("noshim")) {
    let elem = document.createElement("script");
    elem.async = true;
    elem.src = "https://cdn.jsdelivr.net/npm/es-module-shims@1/dist/es-module-shims.wasm.min.js";
    document.head.appendChild(elem);
  }
  `);
}