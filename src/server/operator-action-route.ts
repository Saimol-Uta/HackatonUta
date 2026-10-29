// Shared handler shape for the operator action routes (take over, resume, send message).
import "server-only";
import { NextResponse } from "next/server";
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
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not found")) return NextResponse.json({ error: "not_found" }, { status: 404 });
      if (message.includes("empty")) return NextResponse.json({ error: "empty_message" }, { status: 400 });
      console.error("[operator] action failed", error);
      return NextResponse.json({ error: "action_failed" }, { status: 500 });
    }
  };
}
