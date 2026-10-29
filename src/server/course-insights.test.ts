import { describe, expect, it } from "vitest";
import { makeCourse } from "@/core/testing/fakes";
import { buildCourseInsights } from "./course-insights";

describe("buildCourseInsights", () => {
  it("adds the lifecycle state and the demand of each course, zero when nobody asked", () => {
    const python = makeCourse();
    const old = makeCourse({ id: 2, slug: "curso2", enrollmentStart: "2025-03-15", enrollmentEnd: "2025-04-07", startDate: "2025-04-05", endDate: "2025-05-04" });

    const insights = buildCourseInsights([python, old], new Map([[21, { conversations: 3, hotLeads: 1 }]]), "2026-10-29");

    expect(insights[0]).toMatchObject({ slug: "curso21", lifecycle: "upcoming", stateLabel: "inscripciones abren el 2026-10-30", conversations: 3, hotLeads: 1 });
    expect(insights[1]).toMatchObject({ slug: "curso2", lifecycle: "finished", stateLabel: "finalizado", conversations: 0, hotLeads: 0 });
  });
});
