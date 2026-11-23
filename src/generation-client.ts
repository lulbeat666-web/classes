import { z } from 'zod'
import { generationResponseSchema, providerStatusSchema } from './shared/contracts'
import type { GenerationResponse, LessonInput, ProviderStatus } from './shared/contracts'
import { demoGeneration } from './shared/demo-activities'
import { isDemoLesson } from './shared/demo-lesson'

const errorSchema = z.object({ error: z.object({ message: z.string() }) })

export class GenerationApiError extends Error {
  constructor(
    readonly reason: 'session' | 'routing' | 'network' | 'invalid' | 'server',
    message: string,
  ) {
    super(message)
    this.name = 'GenerationApiError'
  }
}

async function requestJson(path: string, options: RequestInit, fetcher: typeof fetch): Promise<unknown> {
  let response: Response
  try {
    const headers = new Headers(options.headers)
    headers.set('Accept', 'application/json')
    response = await fetcher(path, { ...options, headers, redirect: 'manual' })
  } catch {
    throw new GenerationApiError('network', '서버에 연결하지 못했어요. 네트워크 상태를 확인하고 다시 시도해 주세요.')
  }

  if (response.status === 401 || response.type === 'opaqueredirect' ||
      (response.status >= 300 && response.status < 400)) {
    throw new GenerationApiError('session', '로그인 세션을 확인할 수 없어요. 앱을 새 탭에서 열고 로그인한 뒤 다시 시도해 주세요.')
  }

  const contentType = response.headers.get('Content-Type') ?? ''
  const isJson = /^(application\/json|application\/[^;]+\+json)(?:\s*;|$)/i.test(contentType)
  if (response.status === 404 || response.status === 405 || (!isJson && response.ok)) {
    throw new GenerationApiError('routing', '이 주소에서 생성 API를 찾을 수 없어요. 배포된 앱 주소를 열거나 로컬의 Wrangler Pages 서버를 실행해 주세요.')
  }
  if (!isJson) {
    if (response.status === 403) {
      throw new GenerationApiError('session', '이 요청의 접근 권한을 확인할 수 없어요. 앱을 새 탭에서 열고 로그인해 주세요.')
    }
    throw new GenerationApiError('server', '활동 생성 서버가 일시적으로 응답하지 않아요. 잠시 후 다시 시도해 주세요.')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new GenerationApiError('invalid', '서버 응답을 읽지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
  if (!response.ok) {
    const failure = errorSchema.safeParse(body)
    throw new GenerationApiError('server', failure.success
      ? failure.data.error.message
      : '활동 생성 요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
  return body
}

export function parseProviderBootstrap(value: string | null | undefined): ProviderStatus | undefined {
  if (!value) return undefined
  try {
    const parsed = providerStatusSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

export async function getProviderStatus(signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<ProviderStatus> {
  const body = await requestJson('/api/providers', { signal, cache: 'no-store' }, fetcher)
  const parsed = providerStatusSchema.safeParse(body)
  if (!parsed.success) {
    throw new GenerationApiError('invalid', '서버의 연결 정보를 읽지 못했어요. 다시 확인해 주세요.')
  }
  return parsed.data
}

export async function generateActivities(
  lesson: LessonInput,
  mode: GenerationResponse['mode'],
  model?: string,
  fetcher: typeof fetch = fetch,
): Promise<GenerationResponse> {
  if (mode === 'demo') {
    if (!isDemoLesson(lesson)) {
      throw new GenerationApiError('invalid', '예시 활동을 보려면 분수 나눗셈 예시를 불러와 주세요.')
    }
    return demoGeneration
  }

  const body = await requestJson('/api/generate-activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lesson, mode, model }),
    signal: AbortSignal.timeout(70_000),
  }, fetcher)
  const parsed = generationResponseSchema.safeParse(body)
  if (!parsed.success || parsed.data.mode !== mode) {
    throw new GenerationApiError('invalid', '활동 정보를 표시할 수 없어요. 다시 생성해 주세요.')
  }
  return parsed.data
}
