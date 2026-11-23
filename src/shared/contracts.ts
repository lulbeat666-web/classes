import { z } from "zod";
import { mechanismIds } from "./mechanisms";

export const subjects = [
  "국어",
  "수학",
  "사회",
  "과학",
  "영어",
  "도덕",
  "체육",
  "음악",
  "미술",
  "실과",
  "통합교과",
  "기타",
] as const;

export const lessonInputSchema = z.strictObject({
  grade: z.number().int().min(1).max(6),
  subject: z.enum(subjects),
  objective: z.string().trim().min(1).max(600),
  textbookContent: z.string().trim().max(1500),
  durationMinutes: z.number().int().min(10).max(60).multipleOf(5),
  durationMode: z.enum(["exact", "max"]),
  materials: z.enum(["none", "print", "basic"]),
  preparationMinutes: z.union([z.literal(0), z.literal(5), z.literal(10), z.literal(20)]),
  groupSize: z.number().int().min(1).max(50),
  mechanisms: z.array(z.enum(mechanismIds)).max(4)
    .refine((items) => new Set(items).size === items.length),
});

// The form keeps pending select values as strings and numbers. The server
// refines them to the allowlists above before accepting a request.
export interface LessonInput {
  grade: number;
  subject: string;
  objective: string;
  textbookContent: string;
  durationMinutes: number;
  durationMode: "exact" | "max";
  materials: "none" | "print" | "basic";
  preparationMinutes: number;
  groupSize: number;
  mechanisms: (typeof mechanismIds)[number][];
}

export const generationRequestSchema = z.strictObject({
  lesson: lessonInputSchema,
  mode: z.enum(["demo", "openai"]),
  model: z.string().min(1).max(100).optional(),
});

const text = z.string().regex(/\S/).max(1200);
const label = z.string().regex(/\S/).max(100);
const learningActions = z.array(text).min(1).max(8);
const score = z.number().int().min(1).max(5);
const mechanism = z.enum(mechanismIds);

const stepFields = {
  order: z.number().int().min(1).max(12),
  title: label,
  durationMinutes: z.number().int().min(1).max(60),
  description: text,
};

const exclusion = z.strictObject({ mechanism, reason: text });

const activityFields = {
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  title: label,
  tagline: text,
  activityType: label,
  durationMinutes: z.number().int().min(1).max(60),
  preparationMinutes: z.number().int().min(0).max(20),
  learningObjective: text,
  essentialLearningActions: learningActions,
  playMechanisms: z.array(mechanism).min(2).max(4),
  materials: z.array(label).min(1).max(12),
  groupType: label,
  movementLevel: label,
  noiseLevel: label,
  overview: text,
  engagementPoints: learningActions,
  learningConnection: text,
  preparationInstructions: z.array(text).max(8),
  safetyNotes: learningActions,
  potentialProblems: z.array(z.strictObject({ problem: text, solution: text })).min(1).max(6),
  qualityScores: z.strictObject({
    engagement: score,
    creativity: score,
    learningAlignment: score,
    studentAgency: score,
    feasibility: score,
  }),
};

export const recommendedActivitySchema = z.strictObject({
  ...activityFields,
  steps: z.array(z.strictObject({ ...stepFields, teacherScript: text.optional() })).min(3).max(12),
  excludedMechanisms: z.array(exclusion).max(4).optional(),
});

export type RecommendedActivity = z.infer<typeof recommendedActivitySchema>;

// Structured Outputs requires every property. The provider sends null when an
// optional value is inapplicable, and the API omits the value after validation.
export const structuredActivitiesSchema = z.strictObject({
  activities: z.array(z.strictObject({
    ...activityFields,
    steps: z.array(z.strictObject({ ...stepFields, teacherScript: text.nullable() })).min(3).max(12),
    excludedMechanisms: z.array(exclusion).max(4).nullable(),
  })).length(3),
});

export const generationResponseSchema = z.strictObject({
  activities: z.array(recommendedActivitySchema).length(3),
  mode: z.enum(["demo", "openai"]),
});

export type GenerationResponse = z.infer<typeof generationResponseSchema>;

export const providerStatusSchema = z.strictObject({
  mode: z.enum(["demo", "openai"]),
  providers: z.array(z.strictObject({
    id: z.literal("openai"),
    label: z.string(),
    available: z.boolean(),
    models: z.array(z.strictObject({ id: z.string(), label: z.string() })),
  })),
});

export type ProviderStatus = z.infer<typeof providerStatusSchema>;
