import {
  generationRequestSchema,
  type GenerationResponse,
  type LessonInput,
} from "../../src/shared/contracts";
import { demoActivities } from "../../src/shared/demo-activities";
import { isDemoLesson } from "../../src/shared/demo-lesson";
import { ApiError, errorResponse, json, readJson, verifyRequestOrigin } from "../lib/http";
import { requestOpenAI, type OpenAIOptions } from "../lib/openai";
import { getOpenAIKey, openAIModel, type Env } from "../lib/provider-config";
import { makeActivityPrompt } from "../lib/prompts";
import { ActivityValidationError, validateActivities } from "../lib/validation";

async function generateActivities(
  lesson: LessonInput,
  key: string,
  model: string,
  options: OpenAIOptions,
) {
  let repairIssues: string[] | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await requestOpenAI(key, model, makeActivityPrompt(lesson, repairIssues), options);
      return validateActivities(result, lesson);
    } catch (error) {
      if (!(error instanceof ActivityValidationError)) throw error;

      repairIssues = error.issues;
    }
  }

  throw new ApiError(502, "INVALID_AI_RESPONSE", "AI 응답이 활동 조건 검증을 통과하지 못했습니다. 다시 시도해 주세요.");
}

export function createGenerateHandler(options: OpenAIOptions = {}) {
  return async ({ request, env }: { request: Request; env: Env }) => {
    try {
      verifyRequestOrigin(request);
      const payload = generationRequestSchema.safeParse(await readJson(request));

      if (!payload.success) {
        const field = payload.error.issues[0]?.path.join(".");
        throw new ApiError(400, "INVALID_INPUT", field
          ? `입력값을 확인해 주세요. (${field})`
          : "입력 항목과 형식을 확인해 주세요.");
      }

      const { lesson, mode, model } = payload.data;
      if (mode === "demo") {
        if (!isDemoLesson(lesson)) {
          throw new ApiError(400, "DEMO_INPUT_MISMATCH", "예시 모드는 정해진 분수 나눗셈 수업만 보여 줍니다. 예시 수업을 불러와 주세요.");
        }
        const response: GenerationResponse = {
          mode,
          activities: validateActivities({ activities: demoActivities }, lesson),
        };
        return json(response);
      }

      if (model && model !== openAIModel.id) {
        throw new ApiError(400, "UNSUPPORTED_MODEL", "이 앱에서 사용할 수 있는 OpenAI 모델을 선택해 주세요.");
      }

      const key = await getOpenAIKey(request, env);
      if (!key) {
        throw new ApiError(503, "OPENAI_UNAVAILABLE", "OpenAI를 사용할 수 없습니다. 서버의 API 키, 생성 허용 및 접근 설정을 확인해 주세요.");
      }

      const response: GenerationResponse = {
        mode,
        activities: await generateActivities(lesson, key, openAIModel.id, options),
      };
      return json(response);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export const onRequestPost: PagesFunction<Env> = createGenerateHandler();
