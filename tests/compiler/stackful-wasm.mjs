// The byte reader the fiber-backend tests share (DL36, split out in DL37).
//
// **One reader, not two.** The section list, an import's name pair, a custom
// section's payload and a composite type's form are all this file does; the tests
// beside it ask it questions. A second copy would be exactly the drift this suite
// exists to catch elsewhere — two answers to "what does this artifact contain"
// that could quietly disagree.
//
// Why not `WebAssembly.Module`: a `fiber` artifact built before DL37 declared
// continuation types, which a Node without wasmfx refuses to parse, so an
// assertion routed through the engine could not run at all (DL36 §3). Reading the
// bytes has no such dependency — and the bytes are what the claim is about.

/** One unsigned LEB128 value at `at`, and the offset after it. */
export function leb(bytes, at) {
  let value = 0, shift = 0, i = at;
  for (;;) {
    const byte = bytes[i++];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [value, i];
    shift += 7;
  }
}

/** Every section as `{ id, start, end }`, where `start` is the payload's first byte. */
export function sections(bytes) {
  const out = [];
  let i = 8; // magic + version
  while (i < bytes.length) {
    const id = bytes[i++];
    let size;
    [size, i] = leb(bytes, i);
    out.push({ id, start: i, end: i + size });
    i += size;
  }
  return out;
}

/** The name of a custom section (id 0), advancing `section.start` past it. */
export function sectionName(bytes, section) {
  let len;
  [len, section.start] = leb(bytes, section.start);
  const name = Buffer.from(bytes.subarray(section.start, section.start + len)).toString("utf8");
  section.start += len;
  return name;
}

/** `module.field` for every import, in file order. */
export function importsOf(bytes) {
  const names = [];
  const importSection = sections(bytes).find((s) => s.id === 2);
  if (!importSection) return names;
  let i = importSection.start;
  let count;
  [count, i] = leb(bytes, i);
  for (let n = 0; n < count; ++n) {
    let len;
    [len, i] = leb(bytes, i);
    const module = Buffer.from(bytes.subarray(i, i + len)).toString("utf8");
    i += len;
    [len, i] = leb(bytes, i);
    const field = Buffer.from(bytes.subarray(i, i + len)).toString("utf8");
    i += len;
    const kind = bytes[i++];
    names.push(`${module}.${field}`);
    if (kind === 0) { let t; [t, i] = leb(bytes, i); }                              // func
    else if (kind === 1) { i += 1; let l; [l, i] = leb(bytes, i); i += 1; let m; [m, i] = leb(bytes, i); }
    else if (kind === 2) { let l; [l, i] = leb(bytes, i); i += 1; let m; [m, i] = leb(bytes, i); }
    else if (kind === 3) { i += 1; let t; [t, i] = leb(bytes, i); }
    else if (kind === 4) { i += 1; let t; [t, i] = leb(bytes, i); }
  }
  return names;
}

/** The raw payloads of every custom section named `name`. */
export function customSectionsOf(bytes, name) {
  const found = [];
  for (const section of sections(bytes)) {
    if (section.id !== 0) continue;
    const probe = { id: 0, start: section.start, end: section.end };
    if (sectionName(bytes, probe) === name) {
      found.push(bytes.subarray(probe.start, section.end));
    }
  }
  return found;
}

/**
 * A count per **composite type form byte** in the type section.
 *
 * The one that matters for I85 is `0x5d`: a **continuation** type. A `fiber`
 * artifact must report zero of them — a continuation type is what an engine
 * without stack switching refuses to parse, whether or not an instruction uses
 * it, and that was the whole Windows blocker.
 *
 * Counted by walking the section rather than scanning for the byte, because
 * `0x5d` can also appear *inside* a type's payload (a field's type, a heap-type
 * index). A raw `indexOf` would report a match that is not a type — so the walk
 * reads each type's form and steps over its payload.
 */
export function compositeTypeForms(bytes) {
  const forms = new Map();
  const typeSection = sections(bytes).find((s) => s.id === 1);
  if (!typeSection) return forms;
  let i = typeSection.start;
  let count;
  [count, i] = leb(bytes, i);
  for (let n = 0; n < count; ++n) {
    const form = bytes[i++];
    forms.set(form, (forms.get(form) || 0) + 1);
    if (form === 0x60 || form === 0x4e) {
      // (form, params vec, results vec); every value type this compiler emits is
      // a single byte, so a vector's length is also its byte count.
      for (let vec = 0; vec < 2; ++vec) {
        let len;
        [len, i] = leb(bytes, i);
        i += len;
      }
    } else {
      // A form whose payload this reader does not model (cont/struct/array). It
      // has already been counted, which is all a caller needs: a non-zero `0x5d`
      // is a failure on its own, and nothing else is asked about it.
      break;
    }
  }
  return forms;
}
