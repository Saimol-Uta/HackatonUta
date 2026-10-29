import { NextResponse } from "next/server";
import type { EnrollmentStatus } from "@/core/conversation/types";
import { getContainer } from "@/server/container";
import { parseConversationId, rejectUnlessOperator } from "@/server/operator-auth";

const STATUSES: EnrollmentStatus[] = ["pending", "confirmed", "cancelled"];

/** Operators confirm or cancel an enrollment request after checking payment. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const rejected = await rejectUnlessOperator();
  if (rejected) return rejected;
  const id = parseConversationId((await params).id);
  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const status = STATUSES.find((s) => s === body?.status);
  if (id === null) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!status) return NextResponse.json({ error: "invalid_status" }, { status: 400 });

  const updated = await getContainer().dashboard.setEnrollmentStatus(id, status);
  return updated ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
