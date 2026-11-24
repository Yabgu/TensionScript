// The fiber backend's artifact record, asserted from the artifact.
//
// **The same program as `tools/thread-promise/programs/stackful-external-await.ts`**
// (DL23's Q4 fixture), reduced to what the assertion needs: a stackful body that
// awaits a task whose completion comes from somewhere else. That shape is
// load-bearing here — an `await` on a task the compiler can see settle is
// optimised out, park and all, and then there is no suspension in the artifact to
// be either `suspend` or a park call.
//
// What this test is about is not what the program computes but **what was
// emitted**: the park import, the absence of `suspend`, and the custom section's
// bytes. The assertions are in `stackful-fiber-record.js`.
import { Task, TaskRecord } from "~lib/task";
import { RemotePolicy } from "~lib/thread";

async function leaf(): i32 {
  return 1;
}

/** A handle for a completion this store does not produce: class and key stamped. */
function pendingJob(key: i32): Task<i32> {
  const record = new TaskRecord();
  record.class_ = 4;
  record.key = key;
  const handle = new Task<i32>();
  handle._record = record;
  return handle;
}

export async function main(): i32 {
  let warm_up = await leaf();
  let job = pendingJob(7);
  let policy = new RemotePolicy(1, 0, -1);
  policy.await(job);
  return warm_up;
}
