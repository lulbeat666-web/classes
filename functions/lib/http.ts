const maxRequestBytes = 16 * 1024;

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return json({ error: { code: error.code, message: error.message } }, error.status);
  }

  return json({ error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." } }, 500);
}

export function verifyRequestOrigin(request: Request) {
  const origin = request.headers.get("Origin");

  if ((origin && origin !== new URL(request.url).origin) ||
      request.headers.get("Sec-Fetch-Site") === "cross-site") {
    throw new ApiError(403, "ORIGIN_DENIED", "앱과 동일한 사이트에서만 생성 요청을 할 수 있습니다.");
  }
}

export async function readJson(request: Request): Promise<unknown> {
  const mediaType = request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();

  if (mediaType !== "application/json") {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "JSON 형식으로 요청을 보내 주세요.");
  }

  if (Number(request.headers.get("Content-Length")) > maxRequestBytes) {
    throw new ApiError(413, "REQUEST_TOO_LARGE", "입력 내용이 너무 깁니다. 내용을 줄인 후 다시 시도해 주세요.");
  }

  const reader = request.body?.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let receivedBytes = 0;
  let body = "";

  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        receivedBytes += value.byteLength;
        if (receivedBytes > maxRequestBytes) {
          void reader.cancel().catch(() => {});
          throw new ApiError(413, "REQUEST_TOO_LARGE", "입력 내용이 너무 깁니다. 내용을 줄인 후 다시 시도해 주세요.");
        }

        body += decoder.decode(value, { stream: true });
      }
    }

    return JSON.parse(body + decoder.decode());
  } catch (error) {
    if (error instanceof ApiError) throw error;

    throw new ApiError(400, "INVALID_JSON", "요청 내용을 JSON으로 읽을 수 없습니다.");
  } finally {
    reader?.releaseLock();
  }
}
