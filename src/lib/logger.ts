import "server-only";

type SecurityEvent =
  | "auth_failed"
  | "auth_unavailable"
  | "membership_denied"
  | "database_unavailable"
  | "logout_failed";
/** Intentionally exclude emails, user IDs, cookies, tokens, SQL and raw errors. */
export function logSecurityEvent(event: SecurityEvent, status?: number) {
  const reference = crypto.randomUUID();
  console.warn(
    JSON.stringify({
      level: "warn",
      event,
      reference,
      ...(Number.isInteger(status) ? { status } : {}),
      timestamp: new Date().toISOString(),
    }),
  );
  return reference;
}
