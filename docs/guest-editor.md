# Guest sources in an editor

**What this is for.** A TensionScript guest is not TypeScript, but the language it is
written in *is* TypeScript's grammar with a different type vocabulary — and the best
editor for that grammar already exists. So a guest is opened as TypeScript on purpose:
that keeps the language server, which is what gives completion, hover, go-to-definition
and refactorings. The price is that the server reports errors about correct guest code,
and this document is how you pay as little of that price as possible.

**`docs/showcase.md`** shows what a guest program looks like; **`types/tension-guest.d.ts`**
is the declaration surface this recipe points the editor at.

---

## 1. Tell the editor that `.ten` and `.tension` are TypeScript

VS Code, in `.vscode/settings.json` (workspace) or your user settings:

```json
{
  "files.associations": {
    "*.ten": "typescript",
    "*.tension": "typescript"
  }
}
```

`.ten` is the canonical spelling (DL46); `.tension` — the longer spelling DL45 chose —
stays accepted, so both associations are here and either opens with the server attached.

Without this, VS Code shows the file as plain text and there is no server at all. With
it, everything below applies.

**`.ts`** needs no association — it is already TypeScript, which is why the deprecation
window costs an editor nothing.

## 2. Give the server the declarations

The guest language's types (`i32`, `usize`, `bool`), the std intrinsics
(`__spawnThread`, `__threadJoin`, `__spawnIndexOf`) and the task surface (`Task<T>`,
`TaskBase`, `TaskPolicy`) are declared in **`types/tension-guest.d.ts`**. Point a
`tsconfig.json` at it:

```json
{
  "compilerOptions": {
    "noEmit": true,
    "target": "es2022",
    "experimentalDecorators": true,
    "strict": false
  },
  "include": [
    "../TensionScript/types/tension-guest.d.ts",
    "**/*.ten"
  ]
}
```

`include` must name the `.d.ts` explicitly: it is not an entry in `package.json`'s
`types` field, because that field names the *compiler's* own declarations (`asc.d.ts`),
and a guest is not a program that imports the compiler.

**Measured** (DL45): on one real guest (`async/async-on-main`), `tsc` reports **13**
errors from the guest's language surface alone, and **3** once the declarations are in
the program. The three that remain are named in §4 and none of them is fixable by a
declaration.

## 3. Mark the language for GitHub

`.gitattributes`:

```gitattributes
*.ten linguist-language=TypeScript
*.tension linguist-language=TypeScript
```

This is for the web view only. It changes nothing about how the compiler reads a file,
and nothing about what the editor does.

## 4. The honest caveat — what this recipe does **not** do

**Mapping to `typescript` keeps the TypeScript server, so the declarations are what
silence it.** The alternative — a grammar-only language id that is not `typescript` —
silences the server by removing it, and takes completion, hover and go-to-definition
with it. If you would rather have no errors than have help, that is a legitimate choice
and it is a different one; this recipe is the other.

Three things are **not** silenced, and cannot be, because TypeScript has no such syntax:

- **`@external("env", "emit")` on a function declaration** → `TS1206 Decorators are not
  valid here`. Decorators are legal on classes and members in TypeScript, not on an
  ambient function declaration. It is a genuine language extension.
- **`async f(): i32`** → `TS1064 The return type of an async function ... must be the
  global Promise<T>`. In TensionScript an async function's declared type **is** its
  result type (`Task<i32>` is what you get from calling it; `i32` is what it resolves
  to). That is the language's design, and it is what makes `await t` yield `i32`
  instead of `Promise<i32>`.
- **`~lib/…` imports** → unresolved module. The editor has no mapping from `~lib/task`
  to `std/assembly/task`. Add a `paths` entry if you want them resolved:

  ```json
  { "compilerOptions": { "paths": { "~lib/*": ["../TensionScript/std/assembly/*"] } } }
  ```

  It is not in the snippet above because it changes *which* file the editor opens on
  go-to-definition, and for a guest the answer you want is usually the compiler's
  source, not a second copy of it.

**What has been verified:** the counts above, by running `tsc` on a guest copied to
`.ts` in a temporary directory. **What has not been verified: no editor was opened.
Whether VS Code renders a `.ten` file correctly today is not measured** — the
associations and the declaration program are what it needs, and this document does not
claim a screenshot.
