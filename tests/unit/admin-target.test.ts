import { describe, expect, it } from "vitest";
import {
  PROJECT_REF,
  PROJECT_URL,
  verifyTarget,
  databaseOptions,
} from "../../scripts/admin-target.mjs";
describe("administrative target guard", () => {
  const direct = `postgresql://postgres@db.${PROJECT_REF}.supabase.co:5432/postgres`;
  it("requires exact Cloud confirmation and matching database identity", () => {
    expect(() => verifyTarget(PROJECT_URL, direct, "")).toThrow();
    expect(verifyTarget(PROJECT_URL, direct, PROJECT_REF).hosted).toBe(true);
    expect(() =>
      verifyTarget(
        PROJECT_URL,
        "postgresql://postgres@db.other.supabase.co/postgres",
        PROJECT_REF,
      ),
    ).toThrow();
    expect(() =>
      verifyTarget("https://other.supabase.co", direct, PROJECT_REF),
    ).toThrow();
  });
  it("refuses transaction poolers and allows local isolated development", () => {
    expect(() =>
      verifyTarget(
        PROJECT_URL,
        `postgresql://postgres.${PROJECT_REF}@aws-0.pooler.supabase.com:6543/postgres`,
        PROJECT_REF,
      ),
    ).toThrow();
    expect(
      verifyTarget(
        "http://127.0.0.1:54321",
        "postgresql://localhost/postgres",
        "",
      ).hosted,
    ).toBe(false);
  });
  it("never disables TLS verification through copied URL parameters", () => {
    const target = verifyTarget(
      PROJECT_URL,
      direct + "?sslmode=disable",
      PROJECT_REF,
    );
    const options = databaseOptions(target, "");
    expect(options.ssl).toMatchObject({ rejectUnauthorized: true });
    expect(options.connectionString).not.toContain("sslmode");
    expect(() =>
      databaseOptions(target, "/missing-supabase-root-ca.crt"),
    ).toThrow("Cannot load a valid Supabase root CA");
  });
});
