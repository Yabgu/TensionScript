// Build the compiler's Binaryen from the submodule.
//
// The compiler reaches Binaryen only through Binaryen's C API compiled to wasm, and
// that API had no constructors for `cont.new`, `suspend` or `resume`. So
// `third_party/binaryen` pins our fork — tag `tension-v131.0.0` — which adds six C
// functions, and this script is what turns it into the `binaryen.js` the rest of the
// tree imports.
//
// # Where the output goes, and why it is not committed
//
// `third_party/binaryen-out/` is a build product: 11 MB of wasm-in-JS that follows
// from a gitlink. It is gitignored, exactly as `dist/` is, and `npm run build`
// produces it on demand. Committing it would mean a 11 MB blob per Binaryen bump
// and a second copy of a fact the submodule already records.
//
// # Why the build is out of tree
//
// **Nothing may be written inside `third_party/binaryen/`.** A single generated file
// in there makes the submodule show as modified in every `git status` for every
// reader, and the fix ("just check it out") destroys their work. So cmake's build
// tree lives at `third_party/binaryen-out/build`, which is inside the ignored
// directory and outside the submodule.
//
// # Why the emscripten output is bundled again
//
// `-sSINGLE_FILE` gives one *file*, but it is still a module exporting a **factory**
// (`export default Binaryen;`) that must be awaited before the module is usable. The
// rest of this tree imports an already-loaded object (`import binaryen from
// "../../lib/binaryen.js"`), which is how AssemblyScript's own `binaryen` package
// behaves. esbuild is already a dependency here, so one `--bundle` step closes that
// gap and produces the same shape we consumed before.
//
//   node scripts/build-binaryen.mjs           # build if needed
//   node scripts/build-binaryen.mjs --force   # rebuild even if up to date

import { spawnSync } from "node:child_process";
import os from "node:os";
import fs from "node:fs";
import pathUtil from "path";
import { fileURLToPath } from "url";
import esbuild from "esbuild";

const __dirname = pathUtil.dirname(fileURLToPath(import.meta.url));
const repo = pathUtil.resolve(__dirname, "..");
const submodule = pathUtil.join(repo, "third_party", "binaryen");
const out = pathUtil.join(repo, "third_party", "binaryen-out");
const build = pathUtil.join(out, "build");
const artifact = pathUtil.join(out, "binaryen.js");
const stampFile = pathUtil.join(out, "stamp.json");
const force = process.argv.includes("--force");

function die(message) {
  console.error(`build-binaryen: ${message}`);
  process.exit(1);
}

/**
 * `7.0.0-git (777e6e5d)` from emcc's first version line.
 *
 * The full line is `emcc (Emscripten gcc/clang-like replacement + linker emulating
 * GNU ld) 7.0.0-git (777e6e5db7b4990bcaeb1b9998ed642cc84e6629)`, which is too long to
 * print on every build and says the same thing.
 */
function emccLabel(version) {
  if (!version) return "unknown";
  const match = /([0-9][\w.+-]*)\s*\(([0-9a-f]{8})/.exec(version);
  return match ? `${match[1]} (${match[2]})` : version;
}

function note(message) {
  console.log(`build-binaryen: ${message}`);
}

// ── the toolchain ─────────────────────────────────────────────────────────────
//
// Resolved only when something has to be built (see the stamp check above): a tree
// that already has the artifact needs no emscripten at all, which is the case in CI
// on every platform but the one that builds it, and the case for anyone consuming a
// checkout whose artifact was cached or shared.
//
// `emcc` is checked before cmake is invoked at all: cmake's failure for a missing
// compiler is three screens of probe output that ends in "no CMAKE_CXX_COMPILER
// could be found", which does not say what to install. Emscripten 7.0.0 (commit
// 777e6e5d) is what this tree is built and tested with — the distro package and
// `~/emsdk` are the same commit on this machine, and either works; nothing here
// version-gates, because a contributor with a newer emsdk should not be blocked.

function which(name) {
  for (const dir of (process.env.PATH ?? "").split(pathUtil.delimiter)) {
    if (!dir) continue;
    const candidate = pathUtil.join(dir, name);
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // not a file, or not readable: the next PATH entry
    }
  }
  return null;
}

function resolveEmscripten() {
  const emcc = which("emcc") ?? which("emcc.py");
  if (!emcc) {
    die(
      "emcc is not on PATH. This tree builds Binaryen from source, so it needs\n" +
      "  emscripten 7.0.0 (commit 777e6e5d) — either the distro package\n" +
      "  (`pacman -S emscripten`, put /usr/lib/emscripten on PATH) or emsdk:\n" +
      "    git clone https://github.com/emscripten-core/emsdk ~/emsdk\n" +
      "    ~/emsdk/emsdk install latest && source ~/emsdk/emsdk_env.sh\n" +
      "  then re-run `npm run binaryen:build`."
    );
  }
  const emcmake = pathUtil.join(pathUtil.dirname(emcc), "emcmake");
  if (!fs.existsSync(emcmake)) {
    die(`emcmake is not next to ${emcc}. A complete emscripten install has both.`);
  }
  return { emcc, emcmake };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) die(`${command}: ${result.error.message}`);
  if (result.status !== 0) die(`${command} ${args.join(" ")} failed (exit ${result.status})`);
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error) die(`${command}: ${result.error.message}`);
  if (result.status !== 0) die(`${command} ${args.join(" ")} failed (exit ${result.status})`);
  return (result.stdout ?? "").trim();
}

if (!fs.existsSync(pathUtil.join(submodule, "CMakeLists.txt"))) {
  die(
    `third_party/binaryen is not checked out.\n` +
    `  run:  git submodule update --init third_party/binaryen`
  );
}

// ── is it already built? ──────────────────────────────────────────────────────
//
// **The skip is keyed on the pin alone.** The artifact is a function of the
// submodule tree: `build/bin/binaryen_js.js` is the same file whichever emscripten
// 7.0.0 built it, and the tests that compare exact fixture bytes are *safer* when
// one artifact is shared than when each platform builds its own. So a matching
// commit with the artifact present is a hit, and the emcc version in the stamp is
// recorded for diagnosis rather than enforced — a different toolchain prints one
// line and reuses the artifact; `--force` is how you say "no, really rebuild".
//
// It matters operationally: `npm run build` on a tree with no emscripten installed
// must not die asking for one, because CI builds the artifact once and every other
// job downloads it, and because the packed tarball ships it.

const commit = capture("git", ["rev-parse", "HEAD"], { cwd: submodule });

if (!force && fs.existsSync(artifact) && fs.existsSync(stampFile)) {
  let previous = null;
  try {
    previous = JSON.parse(fs.readFileSync(stampFile, "utf8"));
  } catch {
    previous = null;
  }
  if (previous && previous.commit === commit) {
    note(`up to date — ${commit.slice(0, 12)} (built with emcc ${previous.emcc ?? "unknown"})`);
    process.exit(0);
  }
  note(`rebuilding: ${previous?.commit?.slice(0, 12) ?? "unknown"} → ${commit.slice(0, 12)}`);
}

// Past this point the artifact has to be produced, so the toolchain has to exist.
const { emcc, emcmake } = resolveEmscripten();
const emccVersion = capture(emcc, ["--version"]).split("\n")[0];
note(`building ${commit.slice(0, 12)} with ${emccLabel(emccVersion)}`);

// ── configure and build ───────────────────────────────────────────────────────
//
// `EMSCRIPTEN_ENABLE_SINGLE_FILE=ON` is Binaryen's own switch for the single-file
// output, and it is what its CMakeLists turns into `-sSINGLE_FILE` on the link line
// (CMakeLists.txt:544). Passing `-sSINGLE_FILE` through `CMAKE_EXE_LINKER_FLAGS`
// instead would work and duplicate a decision the tree already owns.
//
// **`-sMAXIMUM_MEMORY` is not set, deliberately.** It was tried, and emcc says what
// it is worth: `warning: MAXIMUM_MEMORY is only meaningful with ALLOW_MEMORY_GROWTH
// or IMPORTED_MEMORY [-Wunused-command-line-argument]` — the heap Binaryen compiles
// with does not grow, so a raised ceiling changes nothing and only adds noise to
// every link line. If a build ever does need more than the default, the flag to add
// is a pair (`ALLOW_MEMORY_GROWTH=1` with it), not this one alone.
fs.mkdirSync(out, { recursive: true });
note(`building ${commit.slice(0, 12)} with ${emccLabel(emccVersion)}`);
note("configuring (out of tree, so the submodule stays clean)");
run(emcmake, [
  "cmake",
  "-S", submodule,
  "-B", build,
  "-DCMAKE_BUILD_TYPE=Release",
  "-DBUILD_TESTS=OFF",
  "-DBUILD_TOOLS=OFF",
  "-DEMSCRIPTEN_ENABLE_SINGLE_FILE=ON",
], { cwd: repo });

note("building binaryen_js (a few minutes; this is 200 files of C++)");
run("cmake", ["--build", build, "--target", "binaryen_js", "-j", String(os.cpus().length)], { cwd: repo });

const raw = pathUtil.join(build, "bin", "binaryen_js.js");
if (!fs.existsSync(raw)) die(`cmake reported success but ${raw} is missing`);

// ── one ESM module, already loaded ────────────────────────────────────────────
//
// The emscripten output is an ES module whose default export is a **factory**. Wrap
// it in a module that awaits the factory and exports the result, so
// `lib/binaryen.js`'s `export { default } from …` yields the loaded object — the
// shape the glue destructures and the shape the npm package had.
const entry = pathUtil.join(out, "entry.mjs");
fs.writeFileSync(entry,
  `import factory from ${JSON.stringify(raw)};\n` +
  `const binaryen = await factory();\n` +
  `export default binaryen;\n`
);

note("bundling the emscripten module into one loaded ESM file");
await esbuild.build({
  entryPoints: [entry],
  outfile: artifact,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "esnext",
  minify: true,
  // **`charset` stays at esbuild's default `ascii`, and that is not a size
  // preference.** The emscripten output embeds the wasm module as raw bytes inside
  // a string literal; `charset: "utf8"` writes those bytes to the file as UTF-8,
  // Node reads them back as UTF-8, and every invalid sequence becomes U+FFFD — the
  // module still loads and `--version` still answers, and the first real compile
  // aborts inside Binaryen (`Assertion failed: it != indexes.memoryIndexes.end()`)
  // on a *corrupted* wasm payload. `ascii` escapes each byte above 0x7f as `\xNN`,
  // which is 3.6 MB larger and faithful. Measured both ways on this artifact.
  legalComments: "none",
  banner: {
    js: "/**\n * Binaryen " + commit.slice(0, 12) + ", built from third_party/binaryen by\n" +
        " * scripts/build-binaryen.mjs. Generated: do not edit.\n */"
  },
});
fs.rmSync(entry, { force: true });

fs.writeFileSync(stampFile, `${JSON.stringify({
  commit,
  // Recorded, not enforced: the skip is keyed on the pin (see the note above). The
  // label is short because it is printed on every `npm run build`.
  emcc: emccLabel(emccVersion),
  builtAt: new Date().toISOString(),
}, null, 2)}\n`);

const size = fs.statSync(artifact).size;
note(`${pathUtil.relative(repo, artifact)} (${(size / 1048576).toFixed(2)} MB)`);
