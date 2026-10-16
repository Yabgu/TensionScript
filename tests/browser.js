import * as tensionscript from "../dist/asc.js";

if (typeof tensionscript.definitionFiles.assembly !== "string") throw Error("missing bundled assembly.d.ts");
if (typeof tensionscript.definitionFiles.portable !== "string") throw Error("missing bundled portable.d.ts");

const files = { "index.ts": `export function test(): void {}` };

console.log("# tensionscript --version");
{
  const { stdout, stderr } = await tensionscript.main([ "--version" ]);

  console.log(">>> STDOUT >>>");
  process.stdout.write(stdout.toString());
  console.log(">>> STDERR >>>");
  process.stdout.write(stderr.toString());
}

console.log("\n# tensionscript --help");
{
  const { stdout, stderr } = await tensionscript.main([ "--help" ]);

  console.log(">>> STDOUT >>>");
  process.stdout.write(stdout.toString());
  console.log(">>> STDERR >>>");
  process.stdout.write(stderr.toString());
}

console.log("\n# tensionscript index.ts --textFile");
{
  const { error, stdout, stderr } = await tensionscript.main([ "index.ts", "--textFile" ], {
    readFile: (name, baseDir) => {
      console.log("readFile: " + name + ", baseDir=" + baseDir);
      if (Object.prototype.hasOwnProperty.call(files, name)) return files[name];
      return null;
    },
    writeFile: (name, data, baseDir) => {
      console.log("writeFile: " + name + ", baseDir=" + baseDir);
    },
    listFiles: (dirname, baseDir) => {
      console.log("listFiles: " + dirname + ", baseDir=" + baseDir);
      return [];
    }
  });

  if (error) {
    console.log(">>> THROWN >>>");
    console.log(error);
  }
  console.log(">>> STDOUT >>>");
  process.stdout.write(stdout.toString());
  console.log(">>> STDERR >>>");
  process.stdout.write(stderr.toString());
}

console.log("\n# tensionscript.compileString");
{
  const { stdout, stderr, text, binary } = await tensionscript.compileString(`export function test(): void {}`, { optimizeLevel: 3, exportTable: true, stats: true });
  console.log(">>> .stdout >>>");
  process.stdout.write(stdout.toString());
  console.log(">>> .stderr >>>");
  process.stdout.write(stderr.toString());
  console.log(">>> .text >>>");
  process.stdout.write(text);
  console.log(">>> .binary >>> " + binary.length + " bytes");
}
