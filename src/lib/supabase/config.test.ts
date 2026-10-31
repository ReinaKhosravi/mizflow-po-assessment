import { afterEach, describe, expect, it, vi } from "vitest";
import { readSupabaseConfig } from "./config";
afterEach(() => vi.unstubAllEnvs());
describe("Supabase public configuration", () => {
  const jwt = (role: string) =>
    `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
  it("fails closed when configuration is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(readSupabaseConfig()).toBeNull();
  });
  it("accepts HTTPS publishable config and local legacy anon config", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_example_public_key",
    );
    expect(readSupabaseConfig()).not.toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", jwt("anon"));
    expect(readSupabaseConfig()).not.toBeNull();
  });
  it.each(["sb_secret_never_use_in_browser", jwt("service_role"), "invalid"])(
    "rejects non-public keys",
    (key) => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key);
      expect(readSupabaseConfig()).toBeNull();
    },
  );
  it("rejects insecure remote URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://example.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", jwt("anon"));
    expect(readSupabaseConfig()).toBeNull();
  });
});
