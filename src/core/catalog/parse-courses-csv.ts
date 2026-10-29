import { extractCourseDetails, type CourseDetails } from "./extract-course-details.ts";

export type CourseStatus = "open" | "closed";

export interface ScrapedCourse {
  slug: string;
  name: string;
  status: CourseStatus;
  trainingHours: number | null;
  url: string;
  imageUrl: string | null;
  fullTitle: string | null;
  description: string | null;
  objectives: string | null;
  location: string | null;
  organizers: string | null;
  /** Null when the CSV only has the listing columns. */
  details: CourseDetails | null;
}

/** Splits one CSV line, honoring double-quoted fields with embedded commas or quotes. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((field) => field.trim());
}

function parseHours(duration: string): number | null {
  const match = duration.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function slugFromUrl(url: string): string {
  const file = url.split("/").pop() ?? url;
  return file.replace(/\.php$/i, "");
}

const HEADINGS = {
  description: /^DESCRIPCIÓN(?: DEL CURSO)?\s*/,
  objectives: /^OBJETIVOS(?: DEL CURSO)?\s*/,
  location: /^LUGAR DE CELEBRACIÓN\s*/,
};

const textOrNull = (value: string | undefined, heading?: RegExp): string | null => {
  const text = (heading ? value?.replace(heading, "") : value)?.trim();
  return text ? text : null;
};

/**
 * Parses the CSV produced by the FISEI course scraper. Accepts both the listing-only
 * export (5 columns) and the full export with the detail page columns.
 */
export function parseCoursesCsv(csv: string): ScrapedCourse[] {
  const [header, ...rows] = csv.replace(/^\uFEFF/, "").split(/\r?\n/);
  const columns = splitCsvLine(header);

  return rows
    .filter((row) => row.trim() !== "")
    .map((row) => {
      const fields = splitCsvLine(row);
      const field = (column: string): string | undefined => {
        const index = columns.indexOf(column);
        return index === -1 ? undefined : fields[index];
      };
      const [name, status, duration, url, imageUrl] = fields;
      const detailsText = textOrNull(field("Requisitos y contenidos"));

      return {
        slug: slugFromUrl(url),
        name,
        status: status.toUpperCase() === "ABIERTO" ? "open" : "closed",
        trainingHours: parseHours(duration),
        url,
        imageUrl: imageUrl || null,
        fullTitle: textOrNull(field("Titulo completo")),
        description: textOrNull(field("Introducción"), HEADINGS.description),
        objectives: textOrNull(field("Objetivos"), HEADINGS.objectives),
        location: textOrNull(field("Ubicación"), HEADINGS.location),
        organizers: textOrNull(field("Organización")),
        details: detailsText ? extractCourseDetails(detailsText) : null,
      };
    });
}
