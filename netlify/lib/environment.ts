import type { Context } from "@netlify/functions";
import type { Env } from "../../functions/lib/provider-config";

export function getNetlifyEnvironment({ user }: Pick<Context, "user">): Env {
  // Netlify authenticates team members before supplying context.user to the function.
  return {
    OPENAI_API_KEY: user?.id ? process.env.OPENAI_API_KEY : undefined,
    ENABLE_LIVE_GENERATION: process.env.ENABLE_LIVE_GENERATION ?? "true",
  };
}
