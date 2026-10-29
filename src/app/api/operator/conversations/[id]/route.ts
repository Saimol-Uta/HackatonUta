import { NextResponse } from "next/server";
import { getContainer } from "@/server/container";
import { parseConversationId, rejectUnlessOperator } from "@/server/operator-auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const rejected = await rejectUnlessOperator();
  if (rejected) return rejected;
  const id = parseConversationId((await params).id);
  const detail = id === null ? null : await getContainer().dashboard.getConversation(id);
  return detail ? NextResponse.json(detail) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
