// Shared handler shape for the operator action routes (take over, resume, send message).
import "server-only";
import { NextResponse } from "next/server";
import { OperatorActionError } from "@/core/sales-agent/operator-actions";
import { parseConversationId, rejectUnlessOperator } from "./operator-auth";

type RouteContext = { params: Promise<{ id: string }> };

export function operatorAction(run: (conversationId: number, request: Request) => Promise<void>) {
  return async (request: Request, { params }: RouteContext): Promise<Response> => {
    const rejected = await rejectUnlessOperator();
    if (rejected) return rejected;
    const id = parseConversationId((await params).id);
    if (id === null) return NextResponse.json({ error: "not_found" }, { status: 404 });
    try {
      await run(id, request);
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof OperatorActionError) {
        return NextResponse.json({ error: error.code }, { status: error.code === "not_found" ? 404 : 400 });
      }
      console.error(`[operator] action on conversation ${id} failed:`, error);
      // Telegram's reason (e.g. "bot was blocked by the user") is safe and useful for the operator.
      const detail = error instanceof Error ? error.message.slice(0, 300) : "unknown error";
      return NextResponse.json({ error: "action_failed", detail }, { status: 502 });
    }
  };
}
