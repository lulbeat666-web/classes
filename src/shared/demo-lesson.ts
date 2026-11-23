import { lessonInputSchema, type LessonInput } from "./contracts";

export const demoLesson: LessonInput = {
  grade: 5,
  subject: "수학",
  objective: "분수의 나눗셈 원리를 설명할 수 있다.",
  textbookContent: "분수의 나눗셈을 그림과 식으로 나타내고, 나누는 분수가 몇 번 들어가는지 알아보았습니다.",
  durationMinutes: 20,
  durationMode: "exact",
  materials: "basic",
  preparationMinutes: 5,
  groupSize: 28,
  mechanisms: ["random", "movement", "craft", "exchange"],
};

function normalizedLessonKey(lesson: LessonInput) {
  return JSON.stringify({ ...lesson, mechanisms: [...lesson.mechanisms].sort() });
}

const demoLessonKey = normalizedLessonKey(lessonInputSchema.parse(demoLesson));

export function isDemoLesson(lesson: LessonInput): boolean {
  const parsed = lessonInputSchema.safeParse(lesson);
  return parsed.success && normalizedLessonKey(parsed.data) === demoLessonKey;
}
