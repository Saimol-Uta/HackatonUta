import { parseSpanishDateRange } from "./parse-spanish-date-range.ts";

export interface CoursePrices {
  /** UTA students up to their last term. */
  utaStudent: number;
  /** UTA graduates, faculty and administrative staff. */
  utaStaff: number;
  public: number;
}

export interface CourseDetails {
  enrollmentStart: string | null;
  enrollmentEnd: string | null;
  startDate: string | null;
  endDate: string | null;
  schedule: string | null;
  modality: string | null;
  certificate: string | null;
  prices: CoursePrices | null;
  /** The whole details section, kept verbatim as grounding text for the agent. */
  text: string;
}

const SECTION_HEADER = /^REQUISITOS Y DETALLES MATERIALES Y EQUIPOS CONTENIDOS\s*/;

// Longer labels first so "Precio para los asistentes" wins over "Precio".
const LABELS = [
  "Fechas de inscripciones",
  "Período de inscripción",
  "El cupo de inscripciones",
  "Cupo de inscripciones",
  "Lugar del evento",
  "Fecha del curso",
  "Horario",
  "Precio para los asistentes",
  "Precio",
  "Tipo de capacitación",
  "Horas de capacitación",
  "Beneficiarios",
  "Modalidad",
  "Conocimientos previos",
  "Dirigido a",
] as const;

type Label = (typeof LABELS)[number];

const LABEL_PATTERN = new RegExp(`(${LABELS.join("|")}):`, "g");

// Free text after the last label runs into bullet lists and the syllabus.
const VALUE_END = /\s*(?:•|Módulo\s*\d)/;

function splitByLabel(text: string): Map<Label, string> {
  const matches = [...text.matchAll(LABEL_PATTERN)];
  const values = new Map<Label, string>();

  matches.forEach((match, i) => {
    const from = match.index + match[0].length;
    const to = matches[i + 1]?.index ?? text.length;
    const value = text.slice(from, to).split(VALUE_END)[0].trim();
    const label = match[1] as Label;
    if (value && !values.has(label)) values.set(label, value);
  });
  return values;
}

function parsePrices(value: string | undefined): CoursePrices | null {
  if (!value) return null;
  const amounts = [...value.matchAll(/(\d+)(?:,\d{2})?/g)].map((match) => Number(match[1]));
  if (amounts.length < 3) return null;
  const [utaStudent, utaStaff, publicPrice] = amounts;
  return { utaStudent, utaStaff, public: publicPrice };
}

/** Extracts the structured fields the agent relies on from a course's details section. */
export function extractCourseDetails(rawText: string): CourseDetails {
  const text = rawText.replace(SECTION_HEADER, "").trim();
  const values = splitByLabel(text);

  const enrollment = parseSpanishDateRange(
    values.get("Fechas de inscripciones") ?? values.get("Período de inscripción") ?? "",
  );
  const course = parseSpanishDateRange(values.get("Fecha del curso") ?? "");

  return {
    enrollmentStart: enrollment?.start ?? null,
    enrollmentEnd: enrollment?.end ?? null,
    startDate: course?.start ?? null,
    endDate: course?.end ?? null,
    schedule: values.get("Horario") ?? null,
    modality: values.get("Modalidad") ?? null,
    certificate: values.get("Tipo de capacitación") ?? null,
    prices: parsePrices(values.get("Precio para los asistentes") ?? values.get("Precio")),
    text,
  };
}
