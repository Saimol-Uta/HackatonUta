import { describe, expect, it } from "vitest";
import { makeCourse } from "../testing/fakes";
import { buildSystemPrompt } from "./build-system-prompt";

const python2 = makeCourse();
const ccna = makeCourse({
  id: 16,
  slug: "curso16",
  name: "INTRODUCCIÓN A LAS REDES – PREPARACIÓN CCNA",
  enrollmentStart: "2026-10-01",
  enrollmentEnd: "2026-10-15",
  startDate: "2026-10-16",
  endDate: "2026-12-05",
  prices: { utaStudent: 120, utaStaff: 150, public: 180 },
  detailsText: "Módulo 1: Networking Today",
});

describe("buildSystemPrompt", () => {
  const base = { courses: [python2, ccna], promotions: [], today: "2026-10-29", focusCourse: null, injectionSuspected: false };

  it("lists every course with its real state and price tiers", () => {
    const prompt = buildSystemPrompt(base);

    expect(prompt).toContain("FUNDAMENTOS DE PYTHON 2 [curso21] — inscripciones abren el 2026-10-30");
    expect(prompt).toContain("INTRODUCCIÓN A LAS REDES – PREPARACIÓN CCNA [curso16] — en curso hasta 2026-12-05");
    expect(prompt).toContain("Estudiantes UTA $40 · Graduados/docentes/administrativos UTA $50 · Público general $60");
    expect(prompt).toContain("Today is 2026-10-29");
  });

  it("includes the detail text of the focus course only", () => {
    const prompt = buildSystemPrompt({ ...base, focusCourse: ccna });

    expect(prompt).toContain("Módulo 1: Networking Today");
    expect(prompt).not.toContain("Módulo 1: Módulos, paquetes y PIP");
  });

  it("states there are no promotions when none is active, and lists active ones", () => {
    expect(buildSystemPrompt(base)).toContain("No active promotions");
    expect(
      buildSystemPrompt({ ...base, promotions: [{ code: "UTA10", courseId: 21, discountPct: 10, validUntil: null }] }),
    ).toContain("UTA10: 10% off FUNDAMENTOS DE PYTHON 2");
  });

  it("adds a security alert when an injection attempt is suspected", () => {
    expect(buildSystemPrompt(base)).not.toContain("SECURITY ALERT");
    expect(buildSystemPrompt({ ...base, injectionSuspected: true })).toContain("SECURITY ALERT");
  });
});
