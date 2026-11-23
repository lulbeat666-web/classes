import type { ProviderStatus } from "../../src/shared/contracts";
import { errorResponse, json } from "../lib/http";
import { getOpenAIKey, openAIModel, type Env } from "../lib/provider-config";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const available = Boolean(await getOpenAIKey(request, env));
    const status: ProviderStatus = {
      mode: available ? "openai" : "demo",
      providers: [{ id: "openai", label: "OpenAI", available, models: [openAIModel] }],
    };
    return json(status);
  } catch (error) {
    return errorResponse(error);
  }
};
