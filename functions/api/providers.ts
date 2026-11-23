import type { ProviderStatus } from "../../src/shared/contracts";
import { errorResponse, json } from "../lib/http";
import { getOpenAIKey, openAIModel, type Env, type OpenAIKeyResolver } from "../lib/provider-config";

export function createProvidersHandler(resolveOpenAIKey: OpenAIKeyResolver = getOpenAIKey) {
  return async ({ request, env }: { request: Request; env: Env }) => {
    try {
      const available = Boolean(await resolveOpenAIKey(env, request));
      const status: ProviderStatus = {
        mode: available ? "openai" : "demo",
        providers: [{ id: "openai", label: "OpenAI", available, models: [openAIModel] }],
      };
      return json(status);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export const onRequestGet: PagesFunction<Env> = createProvidersHandler();
