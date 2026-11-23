import { z } from 'zod'
import { useEffect, useRef, useState } from 'react'
import { generationResponseSchema, providerStatusSchema } from '../shared/contracts'
import type { GenerationResponse, LessonInput, ProviderStatus } from '../shared/contracts'

const errorSchema = z.object({ error: z.object({ message: z.string() }) })

type Generated = GenerationResponse & { lesson: LessonInput }

export function useGeneration() {
  const [status, setStatus] = useState<ProviderStatus>()
  const [providerError, setProviderError] = useState(false)
  const [result, setResult] = useState<Generated>()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const lock = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    async function loadStatus() {
      try {
        const response = await fetch('/api/providers', { signal: controller.signal })
        if (!response.ok) throw new Error()
        setStatus(providerStatusSchema.parse(await response.json()))
      } catch {
        if (!controller.signal.aborted) setProviderError(true)
      }
    }
    void loadStatus()
    return () => controller.abort()
  }, [])

  async function generate(lesson: LessonInput, mode: GenerationResponse['mode'], model?: string) {
    if (lock.current) return false
    lock.current = true
    setError('')
    setPending(true)
    try {
      const response = await fetch('/api/generate-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson, mode, model }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const failure = errorSchema.safeParse(body)
        setError(failure.success ? failure.data.error.message : '생성 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
        return false
      }
      const parsed = generationResponseSchema.safeParse(body)
      if (!parsed.success) {
        setError('활동 정보를 표시할 수 없어요. 다시 생성해 주세요.')
        return false
      }
      setResult({ ...parsed.data, lesson })
      return true
    } catch {
      setError('생성 서버에 연결하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
      return false
    } finally {
      lock.current = false
      setPending(false)
    }
  }

  return { status, providerError, result, error, setError, pending, generate }
}
