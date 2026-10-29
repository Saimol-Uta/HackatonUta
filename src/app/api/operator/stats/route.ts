import { NextResponse } from "next/server";
import { getContainer } from "@/server/container";
import { rejectUnlessOperator } from "@/server/operator-auth";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const rejected = await rejectUnlessOperator();
  if (rejected) return rejected;
  return NextResponse.json(await getContainer().dashboard.stats());
}
