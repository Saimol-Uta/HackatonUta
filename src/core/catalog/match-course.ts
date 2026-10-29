import type { Course } from "./course";
import { courseLifecycle } from "./course-lifecycle";

// Words that appear in many course names and say nothing about which course it is.
const STOPWORDS = new Set(["de", "del", "la", "las", "el", "los", "y", "a", "en", "para", "con", "al", "curso", "taller", "preparacion"]);

export const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokens = (text: string): string[] => normalizeText(text).split(" ").filter((t) => t && !STOPWORDS.has(t));

const MIN_SCORE = 0.6;

/**
 * Finds the course a message names, without calling a model, so the reply can start at once.
 * A course matches when most of its distinctive words appear in the text, at least one of them
 * not a number ("Python 2" must not match "Python 1"). Among equal matches, a course that is
 * not finished wins over a past edition.
 */
export function matchCourseByText(courses: Course[], text: string, today: string): Course | null {
  const words = new Set(tokens(text));
  let best: { course: Course; score: number; active: boolean } | null = null;

  for (const course of courses) {
    const nameTokens = [...new Set(tokens(course.name))];
    if (nameTokens.length === 0) continue;
    const hits = nameTokens.filter((t) => words.has(t));
    if (!hits.some((t) => !/^\d+$/.test(t))) continue;
    // Every number in the name must be present: editions and levels differ only by them.
    if (nameTokens.some((t) => /^\d+$/.test(t) && !words.has(t))) continue;
    const score = hits.length / nameTokens.length;
    if (score < MIN_SCORE) continue;

    const active = courseLifecycle(course, today) !== "finished";
    if (!best || score > best.score || (score === best.score && active && !best.active)) {
      best = { course, score, active };
    }
  }
  return best?.course ?? null;
}
