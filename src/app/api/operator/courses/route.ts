import { NextResponse } from "next/server";
import { getContainer } from "@/server/container";
import { buildCourseInsights } from "@/server/course-insights";
import { rejectUnlessOperator } from "@/server/operator-auth";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const rejected = await rejectUnlessOperator();
  if (rejected) return rejected;
  const { catalog, dashboard, clock } = getContainer();
  const [courses, demand] = await Promise.all([catalog.listCourses(), dashboard.demandByCourse()]);
  return NextResponse.json(buildCourseInsights(courses, demand, clock.today()));
}
