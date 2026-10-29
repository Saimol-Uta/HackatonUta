import type { CoursePrices } from "./extract-course-details.ts";

export interface Course {
  id: number;
  slug: string;
  name: string;
  fullTitle: string | null;
  trainingHours: number | null;
  url: string;
  imageUrl: string | null;
  description: string | null;
  objectives: string | null;
  location: string | null;
  organizers: string | null;
  enrollmentStart: string | null;
  enrollmentEnd: string | null;
  startDate: string | null;
  endDate: string | null;
  schedule: string | null;
  modality: string | null;
  certificate: string | null;
  prices: CoursePrices | null;
  detailsText: string | null;
}

export interface Promotion {
  code: string;
  courseId: number | null;
  discountPct: number;
  validUntil: string | null;
}
