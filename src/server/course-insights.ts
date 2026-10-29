// Joins the catalog with conversation demand for the metrics view.
import type { CourseDemand } from "@/adapters/supabase/dashboard-queries";
import type { Course } from "@/core/catalog/course";
import { courseLifecycle, type CourseLifecycle } from "@/core/catalog/course-lifecycle";
import { courseStateLabel } from "@/core/sales-agent/build-system-prompt";

export interface CourseInsight {
  id: number;
  slug: string;
  name: string;
  modality: string | null;
  trainingHours: number | null;
  startDate: string | null;
  endDate: string | null;
  publicPrice: number | null;
  url: string;
  lifecycle: CourseLifecycle;
  stateLabel: string;
  conversations: number;
  hotLeads: number;
}

export function buildCourseInsights(courses: Course[], demand: Map<number, CourseDemand>, today: string): CourseInsight[] {
  return courses.map((course) => ({
    id: course.id,
    slug: course.slug,
    name: course.name,
    modality: course.modality,
    trainingHours: course.trainingHours,
    startDate: course.startDate,
    endDate: course.endDate,
    publicPrice: course.prices?.public ?? null,
    url: course.url,
    lifecycle: courseLifecycle(course, today),
    stateLabel: courseStateLabel(course, today),
    conversations: demand.get(course.id)?.conversations ?? 0,
    hotLeads: demand.get(course.id)?.hotLeads ?? 0,
  }));
}
