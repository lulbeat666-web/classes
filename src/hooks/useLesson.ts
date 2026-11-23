import { useEffect, useState } from 'react'
import { defaultLesson } from '../options'
import { lessonInputSchema } from '../shared/contracts'
import type { LessonInput } from '../shared/contracts'

const storageKey = 'creative-class-ai.preferences.v1'

function omitText({ objective: _objective, textbookContent: _content, ...filters }: LessonInput) {
  return filters
}

function readLesson(): LessonInput {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (stored && typeof stored === 'object') {
      const parsed = lessonInputSchema.safeParse({
        ...defaultLesson,
        ...stored,
        objective: '저장된 필터 확인',
        textbookContent: '',
      })
      if (parsed.success) return { ...defaultLesson, ...omitText(parsed.data) }
    }
  } catch {
    // Storage may be disabled or its content may be corrupt.
  }
  return defaultLesson
}

export function useLesson() {
  const [lesson, setLesson] = useState(readLesson)

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(omitText(lesson)))
    } catch {
      // Filters remain available for the current session.
    }
  }, [lesson])

  function resetFilters() {
    setLesson(({ objective, textbookContent }) => ({ ...defaultLesson, objective, textbookContent }))
  }

  return { lesson, setLesson, resetFilters }
}
