import {
  structuredActivitiesSchema,
  type LessonInput,
  type RecommendedActivity,
} from "../../src/shared/contracts";

const everydayMaterials = ["교과서", "공책", "필기구"] as const;
const printableMaterials = [...everydayMaterials, "인쇄물", "활동지"] as const;

export const materialAllowlist = {
  none: everydayMaterials,
  print: printableMaterials,
  basic: [
    ...printableMaterials,
    "종이",
    "색종이",
    "포스트잇",
    "빈 카드",
    "봉투",
    "자",
    "가위",
    "테이프",
    "풀",
    "수 모형",
    "주사위",
    "화이트보드",
    "보드마커",
    "타이머",
    "칠판",
    "분수 모형",
  ],
} as const;

export class ActivityValidationError extends Error {
  constructor(readonly issues: string[]) {
    super("AI activity validation failed");
  }
}

function unique<T>(items: readonly T[]) {
  return new Set(items).size === items.length;
}

function identity(label: string) {
  return label.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function validateActivities(result: unknown, lesson: LessonInput): RecommendedActivity[] {
  const parsed = structuredActivitiesSchema.safeParse(result);

  if (!parsed.success) {
    throw new ActivityValidationError(
      parsed.error.issues.slice(0, 8).map((issue) =>
        `${issue.path.join(".") || "최상위 응답"} 필드의 자료형 또는 값 범위를 확인하세요.`
      ),
    );
  }

  const { activities } = parsed.data;
  const allowedMaterials = new Set<string>(materialAllowlist[lesson.materials]);
  const issues: string[] = [];

  if (!unique(activities.map((activity) => activity.id))) {
    issues.push("세 활동의 ID가 서로 달라야 합니다.");
  }

  if (!unique(activities.map((activity) => identity(activity.title))) ||
      !unique(activities.map((activity) => identity(activity.overview)))) {
    issues.push("활동 이름과 개요가 서로 달라야 합니다.");
  }

  activities.forEach((activity, index) => {
    const prefix = `활동 ${index + 1}`;
    const minutes = activity.steps.reduce((sum, step) => sum + step.durationMinutes, 0);
    const exact = lesson.durationMode === "exact";

    if (activity.learningObjective !== lesson.objective) {
      issues.push(`${prefix}: learningObjective에 입력된 학습목표를 그대로 기록하세요.`);
    }

    if (activity.durationMinutes !== minutes ||
        (exact ? minutes !== lesson.durationMinutes : minutes > lesson.durationMinutes)) {
      issues.push(`${prefix}: 단계별 시간 합계와 durationMinutes를 일치시키고 ${lesson.durationMinutes}분 ${exact ? "정확히" : "이하"} 조건을 맞추세요.`);
    }

    if (activity.steps.some((step, stepIndex) => step.order !== stepIndex + 1)) {
      issues.push(`${prefix}: 단계 순서를 1부터 빠짐없이 번호로 매기세요.`);
    }

    if (activity.preparationMinutes > lesson.preparationMinutes ||
        (activity.preparationMinutes > 0 && activity.preparationInstructions.length === 0)) {
      issues.push(`${prefix}: 사전 준비 시간은 ${lesson.preparationMinutes}분 이하여야 하고, 시간이 필요하면 준비 방법도 적으세요.`);
    }

    if (!unique(activity.materials) || activity.materials.some((item) => !allowedMaterials.has(item))) {
      issues.push(`${prefix}: 허용된 준비물 이름만 중복 없이 사용하세요.`);
    }

    const exclusions = activity.excludedMechanisms ?? [];
    const omitted = lesson.mechanisms.filter((mechanism) => !activity.playMechanisms.includes(mechanism));
    const reported = exclusions.map((exclusion) => exclusion.mechanism);

    if (!unique(activity.playMechanisms) || !unique(reported) ||
        reported.length !== omitted.length || omitted.some((mechanism) => !reported.includes(mechanism))) {
      issues.push(`${prefix}: 메커니즘을 중복 없이 선택하고, 사용하지 않은 교사 선호 메커니즘 각각에 제외 이유를 적으세요.`);
    }

    if (minutes >= 40 && activity.steps.length < 5) {
      issues.push(`${prefix}: 40분 이상이면 규칙이 바뀌거나 새로운 과제를 푸는 여러 단계(최소 5개)로 편성하세요.`);
    }
  });

  if (issues.length) {
    throw new ActivityValidationError(issues.slice(0, 8));
  }

  return activities.map(({ steps, excludedMechanisms, ...activity }) => ({
    ...activity,
    steps: steps.map(({ teacherScript, ...step }) =>
      teacherScript === null ? step : { ...step, teacherScript }
    ),
    ...(excludedMechanisms === null ? {} : { excludedMechanisms }),
  }));
}
