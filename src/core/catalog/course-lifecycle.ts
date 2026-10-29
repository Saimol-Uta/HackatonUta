export type CourseLifecycle =
  | "upcoming"
  | "enrollment_open"
  | "enrollment_closed"
  | "in_progress"
  | "finished"
  | "unknown";

export interface CourseDates {
  enrollmentStart: string | null;
  enrollmentEnd: string | null;
  startDate: string | null;
  endDate: string | null;
}

/**
 * Derives where a course stands on a given day (ISO "YYYY-MM-DD").
 * The site's "ABIERTO"/"CERRADO" label is stale, so dates are the source of truth.
 */
export function courseLifecycle(dates: CourseDates, today: string): CourseLifecycle {
  const { enrollmentStart, enrollmentEnd, startDate, endDate } = dates;

  if (endDate && today > endDate) return "finished";
  if (startDate && today >= startDate) return "in_progress";
  if (enrollmentStart && today < enrollmentStart) return "upcoming";
  if (enrollmentEnd && today <= enrollmentEnd) return enrollmentStart ? "enrollment_open" : "unknown";
  if (enrollmentEnd && today > enrollmentEnd) return "enrollment_closed";
  return "unknown";
}
