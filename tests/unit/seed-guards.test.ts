import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
const sentinel = "do-not-log-this-seed-password";
function run(overrides: Record<string, string>) {
  return spawnSync(process.execPath, ["scripts/seed-demo.mjs"], {
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "development",
      MIZFLOW_DEMO_SEED: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      MIZFLOW_DEMO_DATABASE_URL: "",
      MIZFLOW_SEED_AUTH_KEY: "",
      MIZFLOW_SEED_KEY_ROTATED: "",
      MIZFLOW_CONFIRMED_PROJECT_REF: "",
      MIZFLOW_DEMO_PASSWORD: sentinel,
      ...overrides,
    },
  });
}
describe("development-only seed guardrails", () => {
  it("refuses provisioning without explicit development authorization", () => {
    const r = run({});
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("development-only");
    expect(r.stderr).not.toContain(sentinel);
  });
  it("refuses production even with the seed flag", () => {
    const r = run({
      NODE_ENV: "production",
      MIZFLOW_DEMO_SEED: "development-only",
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("development-only");
  });
  it("refuses hosted stacks before using any credential", () => {
    const r = run({
      MIZFLOW_DEMO_SEED: "development-only",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      MIZFLOW_DEMO_DATABASE_URL: "postgresql://localhost/demo",
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("loopback");
    expect(r.stderr).not.toContain(sentinel);
  });
  it("invalid database URLs never leak their credential text", () => {
    const r = run({
      MIZFLOW_DEMO_SEED: "development-only",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      MIZFLOW_DEMO_DATABASE_URL: `invalid:${sentinel}:@`,
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).not.toContain(sentinel);
  });
});
