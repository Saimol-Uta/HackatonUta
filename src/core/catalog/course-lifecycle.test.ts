import { describe, expect, it } from "vitest";
import { courseLifecycle } from "./course-lifecycle";

const DATES = {
  enrollmentStart: "2026-10-30",
  enrollmentEnd: "2026-11-13",
  startDate: "2026-11-14",
  endDate: "2026-12-05",
};

describe("courseLifecycle", () => {
  it.each([
    ["2026-10-29", "upcoming"],
    ["2026-10-30", "enrollment_open"],
    ["2026-11-13", "enrollment_open"],
    ["2026-11-14", "in_progress"],
    ["2026-12-05", "in_progress"],
    ["2026-12-06", "finished"],
  ])("on %s the course is %s", (today, expected) => {
    expect(courseLifecycle(DATES, today)).toBe(expected);
  });

  it("is enrollment_closed between enrollment end and course start", () => {
    expect(courseLifecycle({ ...DATES, startDate: "2026-11-20" }, "2026-11-16")).toBe("enrollment_closed");
  });

  it("ignores the scraped 'ABIERTO' label: a 2025 course is finished in 2026", () => {
    expect(
      courseLifecycle(
        { enrollmentStart: "2025-05-19", enrollmentEnd: "2025-06-04", startDate: "2025-06-07", endDate: "2025-06-30" },
        "2026-10-29",
      ),
    ).toBe("finished");
  });

  it("is unknown without dates", () => {
    expect(
      courseLifecycle({ enrollmentStart: null, enrollmentEnd: null, startDate: null, endDate: null }, "2026-10-29"),
    ).toBe("unknown");
  });
});
