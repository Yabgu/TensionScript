// A `Program` assembled the way the CLI assembles one, for tests that need to
// *resolve* code rather than only parse it.
//
// Why this exists: an `async` construct carries a parse-time diagnostic
// (AS100 "Not implemented: Async functions", ASYNC_PHASE1.md) until the
// lowering lands, and any reported error stops `asc` before compilation — so a
// `tests/compiler` fixture cannot reach the resolver. These tests drive the
// resolver directly through the public `Program` API instead, which is the same
// entry point the compiler uses for expression resolution
// (`Compiler#compileExpression` -> `Resolver#resolveExpression`), minus the
// codegen step Phase 3 owns. Nothing here is a mock: it is the CLI's own
// construction sequence —
//
//   1. every top-level `std/assembly/*.ts` file, as a library source
//      (cli/index.js:488-492);
//   2. the runtime `rt/index-<runtime>.ts` as an entry (cli/index.js:643-661);
//   3. the caller's sources as entries (cli/index.js:664-690);
//   4. the import backlog drained through the same `~lib/` lookup the CLI uses
//      (cli/index.js:526-600 for `getFile`, 612-633 for the loop), without
//      which the standard library's own imports never resolve and
//      `program.initialize()` asserts.
//
// The generated `libraryFiles` map carries the std sources exactly as the
// build bundled them, so a test that imports this module tests the build that
// is actually on disk (`npm run build` must have run, as for `dist/`).

import * as assemblyscript from "../../dist/assemblyscript.js";
import { libraryFiles, libraryPrefix } from "../../cli/index.generated.js";

/** The runtime the CLI would pick by default (`cli/options.json`). */
export const DEFAULT_RUNTIME = "rt/index-incremental";

/** Mirrors the CLI's `getFile` for `~lib/` paths: plain name, then `index`. */
function libraryFile(internalPath) {
  if (!internalPath.startsWith(libraryPrefix)) return null;
  const plainName = internalPath.substring(libraryPrefix.length);
  if (Object.prototype.hasOwnProperty.call(libraryFiles, plainName)) {
    return { text: libraryFiles[plainName], path: `${libraryPrefix}${plainName}.ts` };
  }
  const indexName = `${plainName}/index`;
  if (Object.prototype.hasOwnProperty.call(libraryFiles, indexName)) {
    return { text: libraryFiles[indexName], path: `${libraryPrefix}${indexName}.ts` };
  }
  return null;
}

/**
 * Builds a program holding the standard library, the runtime, and `sources`
 * (an array of `[path, text]`), with the import backlog drained.
 * `program.initialize()` is not called: each test decides when to initialize,
 * because a test that mutates the AST first must do it before initialization.
 */
export function buildProgram(sources, runtime = DEFAULT_RUNTIME) {
  const program = new assemblyscript.Program(new assemblyscript.Options());
  for (const libPath of Object.keys(libraryFiles)) {
    if (libPath.includes("/")) continue; // sub-directories load on demand
    program.parser.parseFile(libraryFiles[libPath], `${libraryPrefix}${libPath}.ts`, false);
  }
  program.parser.parseFile(libraryFiles[runtime], `${libraryPrefix}${runtime}.ts`, true);
  for (const [path, text] of sources) program.parser.parseFile(text, path, true);

  let backlog;
  while ((backlog = drainBacklog()).length) {
    for (const internalPath of backlog) {
      const file = libraryFile(internalPath);
      if (file) program.parser.parseFile(file.text, file.path, false);
      else program.parser.parseFile(null, `${internalPath}.ts`, false);
    }
  }
  return program;

  function drainBacklog() {
    const paths = [];
    let internalPath;
    while ((internalPath = assemblyscript.nextFile(program)) !== null) paths.push(internalPath);
    return paths;
  }
}

/**
 * The `Function` element a test's source declares at its top level. `file` is
 * the source's *internal path* — `filesByName` is keyed by it, and the parser
 * strips the extension (`probe.ts` -> `probe`) — and it exists only after
 * `program.initialize()`.
 */
export function resolveTopLevel(program, name, file = "probe") {
  const source = program.filesByName.get(file.replace(/\.ts$/, ""));
  if (!source) throw new Error(`No such source: ${file}`);
  return program.resolver.resolveFunction(source.getMember(name), null);
}

/** The static type of an expression, resolved in `flow`. */
export function typeOf(program, expression, flow) {
  const type = program.resolver.resolveExpression(
    expression, flow, assemblyscript.Type.auto, assemblyscript.ReportMode.Report
  );
  return type ? type.toString() : null;
}

/** The diagnostic codes the program has reported so far, in order. */
export function diagnosticCodes(program) {
  return program.parser.diagnostics.map(diagnostic => diagnostic.code);
}

/** The diagnostics' texts, in order. */
export function diagnosticTexts(program) {
  return program.parser.diagnostics.map(diagnostic => diagnostic.toString());
}

export { assemblyscript };
