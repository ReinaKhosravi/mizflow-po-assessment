import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AuthContextError, readContext } from "@/features/auth/context";
import {
  readTableSummaries,
  readOrderView,
  readKitchenTickets,
} from "@/features/orders/workflow-queries";
const schema = z.discriminatedUnion("view", [
  z.object({ view: z.literal("tables") }).strict(),
  z.object({ view: z.literal("kitchen") }).strict(),
  z.object({ view: z.literal("order"), tableId: z.uuid() }).strict(),
]);
export const dynamic = "force-dynamic";
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function GET(request: NextRequest) {
  try {
    const context = await readContext();
    const parsed = schema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) return reply({ error: "invalid" }, 400);
    const data =
      parsed.data.view === "tables"
        ? await readTableSummaries(context)
        : parsed.data.view === "kitchen"
          ? await readKitchenTickets(context)
          : await readOrderView(parsed.data.tableId, context);
    if (data === null) return reply({ error: "unavailable" }, 404);
    return reply({ data });
  } catch (error) {
    if (error instanceof AuthContextError)
      return reply(
        { error: error.code },
        error.code === "unauthenticated"
          ? 401
          : error.code === "forbidden"
            ? 403
            : 503,
      );
    return reply({ error: "unavailable" }, 503);
  }
}
