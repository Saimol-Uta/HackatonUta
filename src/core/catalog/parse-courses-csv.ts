export type CourseStatus = "open" | "closed";

export interface ScrapedCourse {
  slug: string;
  name: string;
  status: CourseStatus;
  trainingHours: number | null;
  url: string;
  imageUrl: string | null;
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

/** Parses the listing CSV produced by the FISEI course scraper. */
export function parseCoursesCsv(csv: string): ScrapedCourse[] {
  const [, ...rows] = csv.replace(/^﻿/, "").split(/\r?\n/);

  return rows
    .filter((row) => row.trim() !== "")
    .map((row) => {
      const [name, status, duration, url, imageUrl] = splitCsvLine(row);
      return {
        slug: slugFromUrl(url),
        name,
        status: status.toUpperCase() === "ABIERTO" ? "open" : "closed",
        trainingHours: parseHours(duration),
        url,
        imageUrl: imageUrl || null,
      };
    });
}
