import "server-only";
import { logSecurityEvent } from "./logger";
/** Never serialize a raw database error to a Server Component or browser. */
export function dataUnavailable(): never {
  logSecurityEvent("database_unavailable");
  throw new Error("Workspace data unavailable");
}
