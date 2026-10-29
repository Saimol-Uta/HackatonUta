import { describe, expect, it } from "vitest";
import { makeCourse } from "../testing/fakes";
import { matchCourseByText } from "./match-course";

const TODAY = "2026-10-29";
const python2 = makeCourse();
const python2Old = makeCourse({
  id: 2,
  slug: "curso2",
  name: "Fundamentos de Python 2",
  enrollmentStart: "2025-03-15",
  enrollmentEnd: "2025-04-07",
  startDate: "2025-04-05",
  endDate: "2025-05-04",
});
const python1 = makeCourse({ id: 20, slug: "curso20", name: "FUNDAMENTOS DE PYTHON 1" });
const ccna = makeCourse({ id: 16, slug: "curso16", name: "INTRODUCCIÓN A LAS REDES – PREPARACIÓN CCNA" });
const courses = [python2Old, python1, python2, ccna];

describe("matchCourseByText", () => {
  it("finds a course by its name, ignoring case and accents", () => {
    expect(matchCourseByText(courses, "¿Cuánto cuesta Fundamentos de Python 2?", TODAY)?.slug).toBe("curso21");
    expect(matchCourseByText(courses, "info de introduccion a las redes ccna", TODAY)?.slug).toBe("curso16");
  });

  it("matches a short mention that keeps the distinctive words", () => {
    expect(matchCourseByText(courses, "me interesa python 2", TODAY)?.slug).toBe("curso21");
  });

  it("tells levels apart by their number", () => {
    expect(matchCourseByText(courses, "quiero python 1", TODAY)?.slug).toBe("curso20");
    expect(matchCourseByText(courses, "quiero python 3", TODAY)).toBeNull();
  });

  it("prefers the active edition over a finished one with the same name", () => {
    expect(matchCourseByText([python2Old, python2], "Fundamentos de Python 2", TODAY)?.slug).toBe("curso21");
  });

  it("returns null when no course is named", () => {
    expect(matchCourseByText(courses, "hola, ¿qué cursos tienen?", TODAY)).toBeNull();
  });
});
