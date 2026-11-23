import type { Config, Context } from "@netlify/functions";
import { createGenerateHandler } from "../../functions/api/generate-activities";
import { getConfiguredOpenAIKey } from "../../functions/lib/provider-config";
import { getNetlifyEnvironment } from "../lib/environment";

// The initial request and a repair attempt must both fit Netlify's 60-second limit.
const handleGeneration = createGenerateHandler({ timeoutMs: 27_000 }, getConfiguredOpenAIKey);

export default function generateActivities(request: Request, context: Pick<Context, "user">) {
  return handleGeneration({ request, env: getNetlifyEnvironment(context) });
}

export const config: Config = {
  path: "/api/generate-activities",
  method: "POST",
};
