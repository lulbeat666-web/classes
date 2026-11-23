import { z } from "zod";
import { structuredActivitiesSchema } from "../../src/shared/contracts";
import { ApiError } from "./http";
import { activityInstructions } from "./prompts";
import { ActivityValidationError } from "./validation";

export interface OpenAIOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

const providerSchema = z.toJSONSchema(structuredActivitiesSchema, {
  target: "draft-7",
  override({ jsonSchema }) {
    delete jsonSchema.minLength;
    delete jsonSchema.maxLength;
  },
});
delete providerSchema.$schema;

const outputEnvelope = z.object({
  status: z.literal("completed"),
  output: z.array(z.object({
    type: z.string(),
    role: z.string().optional(),
    content: z.array(z.object({
      type: z.string(),
      text: z.string().optional(),
    })).optional(),
  })),
});

function parseActivityOutput(body: unknown): unknown {
  const result = outputEnvelope.safeParse(body);
  if (!result.success) {
    throw new ActivityValidationError(["완성된 JSON 응답을 반환하세요. 각 단계의 설명은 짧게 작성하세요."]);
  }

  const text = result.data.output
    .filter(({ type, role }) => type === "message" && role === "assistant")
    .flatMap(({ content }) => content ?? [])
    .filter(({ type }) => type === "output_text")
    .map(({ text }) => text ?? "")
    .join("");

  try {
    return JSON.parse(text);
  } catch {
    throw new ActivityValidationError(["응답에 유효한 JSON 형식의 활동 3개를 포함하세요."]);
  }
}

export async function requestOpenAI(
  key: string,
  model: string,
  prompt: string,
  { fetcher = fetch, timeoutMs = 30000 }: OpenAIOptions,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        instructions: activityInstructions,
        input: prompt,
        store: false,
        max_output_tokens: 8000,
        text: {
          format: {
            type: "json_schema",
            name: "creative_class_activities",
            strict: true,
            schema: providerSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      if (response.status === 429) {
        throw new ApiError(429, "PROVIDER_RATE_LIMITED", "OpenAI 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.");
      }
      throw new ApiError(502, "PROVIDER_ERROR", "OpenAI 요청을 처리할 수 없습니다. 서버의 API 키와 사용량을 확인해 주세요.");
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;

      throw new ActivityValidationError(["완성된 JSON 응답을 반환하세요."]);
    }

    return parseActivityOutput(body);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError(504, "PROVIDER_TIMEOUT", "OpenAI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
    }
    if (error instanceof ApiError || error instanceof ActivityValidationError) throw error;

    throw new ApiError(502, "PROVIDER_ERROR", "OpenAI에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    clearTimeout(timer);
  }
}
