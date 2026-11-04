// Compare an observed lldb run against an expect.json.
//
// Pure: no I/O, no process spawning. The runner owns both ends.

/**
 * The expected value sentinel for a local the debugger cannot read at the
 * stop - optimized out, or with no machine location. Asserting the sentinel
 * states the live-range contract (a variable consumed before the line must
 * not appear live) without pinning lldb's exact wording for it.
 */
export const UNAVAILABLE = "<unavailable>";

/**
 * @param {{
 *   stops: {file: string, line: number, reason: string, variables: {name: string, type: string, value: string}[]}[],
 *   resolved: boolean
 * }} observed
 * @param {object} expected  parsed expect.json
 */
export function compare(observed, expected) {
  const diffs = [];
  const notes = [];
  const wantStops = expected.stops ?? [];
  const wantVars = expected.variables ?? [];

  if (!observed.resolved) {
    diffs.push("breakpoint never resolved: the process exited without hitting it");
  }

  if (observed.stops.length !== wantStops.length) {
    diffs.push(`stops: expected ${wantStops.length}, observed ${observed.stops.length}`);
  }

  const count = Math.min(observed.stops.length, wantStops.length);
  for (let i = 0; i < count; i++) {
    const got = observed.stops[i];
    const want = wantStops[i];
    if (normalizeFile(got.file) !== normalizeFile(want.file) || got.line !== want.line) {
      diffs.push(
        `stop ${i + 1}: expected ${want.file}:${want.line}, observed ${got.file}:${got.line}`
      );
    }
    if (want.reason && got.reason !== want.reason) {
      diffs.push(`stop ${i + 1}: expected reason "${want.reason}", observed "${got.reason}"`);
    }
  }

  const vars = new Map();
  for (const stop of observed.stops) {
    for (const variable of stop.variables) vars.set(variable.name, variable);
  }

  for (const want of wantVars) {
    const got = vars.get(want.name);
    if (!got) {
      diffs.push(`variable ${want.name}: not observed`);
      continue;
    }
    if (got.type !== want.type) {
      diffs.push(`variable ${want.name}: expected type ${want.type}, observed ${got.type}`);
    }
    if (want.value === UNAVAILABLE) {
      if (!isOptimizedOut(got.value)) {
        diffs.push(
          `variable ${want.name}: expected no readable value, observed ${got.value}`
        );
      }
    } else if (got.value !== want.value) {
      diffs.push(`variable ${want.name}: expected ${want.value}, observed ${got.value}`);
    }
  }

  for (const [name, got] of vars) {
    if (!wantVars.some((want) => want.name === name)) {
      notes.push(`variable ${name} = ${got.value} (not asserted)`);
    }
  }

  return { pass: diffs.length === 0, diffs, notes };
}

function normalizeFile(file) {
  return file.replace(/\\/g, "/").replace(/^.*\//, "");
}

/** The expect.json body a passing run describes: stops and variables. */
export function observedToExpect(observed) {
  return {
    stops: observed.stops.map((stop) => ({
      file: stop.file,
      line: stop.line,
      reason: stop.reason,
    })),
    variables: observed.stops
      .flatMap((stop) => stop.variables)
      .filter((variable) => !variable.name.startsWith("__"))
      .map((variable) => ({
        name: variable.name,
        type: variable.type,
        value: isUnavailable(variable.value) ? UNAVAILABLE : variable.value,
      })),
  };
}

/** Whether the debugger reported no readable value at this stop. */
function isUnavailable(value) {
  return value === UNAVAILABLE || /no location|optimized out|not available/i.test(value);
}

const isOptimizedOut = isUnavailable;
