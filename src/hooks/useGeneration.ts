import { useEffect, useRef, useState } from 'react'
import { generateActivities, GenerationApiError, getProviderStatus } from '../generation-client'
import type { GenerationResponse, LessonInput, ProviderStatus } from '../shared/contracts'

type Generated = GenerationResponse & { lesson: LessonInput }
type ProviderCheck =
  | { state: 'checking' }
  | { state: 'ready'; status: ProviderStatus }
  | { state: 'failed'; issue: GenerationApiError }

function apiIssue(error: unknown): GenerationApiError {
  if (error instanceof GenerationApiError) return error
  return new GenerationApiError('network', '서버에 연결하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
}

export function useGeneration() {
  const [providerCheck, setProviderCheck] = useState<ProviderCheck>({ state: 'checking' })
  const [checkAttempt, setCheckAttempt] = useState(0)
  const [result, setResult] = useState<Generated>()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const lock = useRef(false)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 8_000)
    async function loadStatus() {
      try {
        const status = await getProviderStatus(controller.signal)
        if (active) setProviderCheck({ state: 'ready', status })
      } catch (error) {
        if (active) setProviderCheck({ state: 'failed', issue: apiIssue(error) })
      } finally {
        window.clearTimeout(timer)
      }
    }
    void loadStatus()
    return () => {
      active = false
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [checkAttempt])

  function retryProviderCheck() {
    setError('')
    setProviderCheck({ state: 'checking' })
    setCheckAttempt((attempt) => attempt + 1)
  }

  async function generate(lesson: LessonInput, mode: GenerationResponse['mode'], model?: string) {
    if (lock.current) return
    lock.current = true
    setError('')
    setPending(true)
    try {
      const data = await generateActivities(lesson, mode, model)
      setResult({ ...data, lesson })
    } catch (error) {
      const issue = apiIssue(error)
      setError(issue.message)
      if (mode === 'openai' && (issue.reason === 'session' || issue.reason === 'routing' || issue.reason === 'network')) {
        setProviderCheck({ state: 'failed', issue })
      }
    } finally {
      lock.current = false
      setPending(false)
    }
  }

  return { providerCheck, retryProviderCheck, result, error, setError, pending, generate }
}
