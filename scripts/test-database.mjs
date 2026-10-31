import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import pg from "pg";

// Always create a fresh disposable cluster. Never read a developer's DATABASE_URL.
const root = await mkdtemp(join(tmpdir(), "mizflow-rls-"));
const data = join(root, "data");
let started = false;
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error || result.status !== 0)
    throw new Error(
      `${command} failed: ${result.error?.message || result.stderr || result.stdout}`,
    );
  return result;
}
try {
  run(process.env.PG_INITDB || "initdb", [
    "-D",
    data,
    "-U",
    "postgres",
    "-A",
    "trust",
    "--no-locale",
    "--encoding=UTF8",
  ]);
  // Unix socket only, inside a private temp directory. No TCP listener or external credentials.
  run(process.env.PG_CTL || "pg_ctl", [
    "-D",
    data,
    "-l",
    join(root, "postgres.log"),
    "-o",
    `-F -k ${root} -h ''`,
    "-w",
    "start",
  ]);
  started = true;
  const db = new pg.Client({
    host: root,
    user: "postgres",
    database: "postgres",
  });
  await db.connect();
  try {
    await db.query(
      await readFile("supabase/tests/bootstrap-postgres.sql", "utf8"),
    );
    for (const name of (await readdir("supabase/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort())
      await db.query(await readFile(join("supabase/migrations", name), "utf8"));
  } finally {
    await db.end();
  }
  const result = spawnSync(
    process.execPath,
    [
      "--test",
      "--test-concurrency=1",
      resolve("tests/database/rls.test.mjs"),
      resolve("tests/database/workflow.test.mjs"),
    ],
    { stdio: "inherit", env: { ...process.env, MIZFLOW_TEST_PG_SOCKET: root } },
  );
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started)
    run(process.env.PG_CTL || "pg_ctl", [
      "-D",
      data,
      "-m",
      "fast",
      "-w",
      "stop",
    ]);
  await rm(root, { recursive: true, force: true });
}
