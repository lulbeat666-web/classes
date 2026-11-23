import type { Config, Context } from "@netlify/functions";
import { createProvidersHandler } from "../../functions/api/providers";
import { getConfiguredOpenAIKey } from "../../functions/lib/provider-config";
import { getNetlifyEnvironment } from "../lib/environment";

const handleProviders = createProvidersHandler(getConfiguredOpenAIKey);

export default function providers(request: Request, context: Pick<Context, "user">) {
  return handleProviders({ request, env: getNetlifyEnvironment(context) });
}

export const config: Config = {
  path: "/api/providers",
  method: "GET",
};
