Frontend for Node.js
====================

Usage
-----

For an up to date list of available command line options, see:

```
$> tensionscript --help
```

API
---

The API accepts the same options as the CLI but also lets you override stdout and stderr. Example:

```js
import tensionscript from "@yabgu_gm/tensionscript/asc";

const { error, stdout } = await tensionscript.main([
  "myModule.ts",
  "--outFile", "myModule.wasm",
  "--optimize",
  "--sourceMap",
  "--stats"
]);
if (error) {
  console.log("Compilation failed: " + error.message);
} else {
  console.log(stdout.toString());
}
```

The result has the following structure:

| Property | Description
|----------|-------------
| error    | Encountered error, if any
| stdout   | Standard output stream
| stderr   | Standard error stream
| stats    | Statistics

You can also compile a single source string directly (note that this API has limited functionality):

```js
import tensionscript from "@yabgu_gm/tensionscript/asc";
const { binary, text, stdout, stderr } = await tensionscript.compileString(`...`, { optimize: 2 });
...
```


Available command line options can also be obtained programmatically:

```js
import { options } from "@yabgu_gm/tensionscript/asc";
...
```
