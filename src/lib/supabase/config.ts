import { z } from "zod";

const publicKey = z
  .string()
  .min(20)
  .refine((key) => {
    if (key.startsWith("sb_publishable_")) return true;
    // Support local Supabase's legacy anon JWT, but never an elevated key.
    try {
      const payload = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      );
      return payload.role === "anon";
    } catch {
      return false;
    }
  }, "Use a publishable key or legacy anon key, never a secret/service-role key");
const configSchema = z.object({
  url: z.url().refine((value) => {
    let u: URL;
    try {
      u = new URL(value);
    } catch {
      return false;
    }
    return (
      u.protocol === "https:" ||
      (u.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))
    );
  }),
  key: publicKey,
});
export function readSupabaseConfig() {
  const result = configSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return result.success ? result.data : null;
}
