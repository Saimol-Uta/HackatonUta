export interface DateRange {
  start: string;
  end: string;
}

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const MONTH = Object.keys(MONTHS).join("|");

// A day, optionally followed by a month and a year, in either "05 de abril de 2025" or "05-abril-2025" form.
const DATE_TOKEN = new RegExp(
  `\\b(\\d{1,2})\\b(?:(?:\\s+de\\s+|\\s*-\\s*)(${MONTH}))?(?:(?:\\s+(?:de|del)\\s+|\\s*-\\s*)(\\d{4}))?`,
  "gi",
);

interface PartialDate {
  day: number;
  month: number | null;
  year: number | null;
}

const iso = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * Parses the free-text date ranges published on the FISEI course pages, e.g.
 * "Del 07 al 30 de junio de 2025" or "31-mayo al 05-julio-2025".
 * The start date inherits the month and year it omits from the end date.
 */
export function parseSpanishDateRange(text: string): DateRange | null {
  const tokens: PartialDate[] = [...text.matchAll(DATE_TOKEN)].map((match) => ({
    day: Number(match[1]),
    month: match[2] ? MONTHS[match[2].toLowerCase()] : null,
    year: match[3] ? Number(match[3]) : null,
  }));

  const [first, second] = tokens;
  if (!first || !second || second.month === null || second.year === null) return null;

  const startMonth = first.month ?? second.month;
  const startYear = first.year ?? second.year;
  return {
    start: iso(startYear, startMonth, first.day),
    end: iso(second.year, second.month, second.day),
  };
}
