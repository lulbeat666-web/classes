import { useRef, useState } from 'react'
import {
  BookOpen, CircleAlert, FlaskConical, RotateCcw, Settings2, Sparkles, X,
} from 'lucide-react'
import { LessonForm } from './components/LessonForm'
import { Results } from './components/Results'
import { useLesson } from './hooks/useLesson'
import { useGeneration } from './hooks/useGeneration'
import { lessonInputSchema } from './shared/contracts'
import { demoLesson, isDemoLesson } from './shared/demo-lesson'
import type { LessonInput } from './shared/contracts'

function scrollToResults() {
  document.getElementById('recommendation-output')?.scrollIntoView({ block: 'start', behavior: 'instant' })
}

export function App() {
  const { lesson, setLesson, resetFilters } = useLesson()
  const { providerCheck, retryProviderCheck, result, error, setError, pending, generate } = useGeneration()
  const optionsDialog = useRef<HTMLDialogElement>(null)
  const [notice, setNotice] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const status = providerCheck.state === 'ready' ? providerCheck.status : undefined
  const providerIssue = providerCheck.state === 'failed' ? providerCheck.issue : undefined
  const provider = status?.providers.find(({ available }) => available)
  const live = status?.mode === 'openai' && Boolean(provider)
  const statusLabel = live ? 'OpenAI 연결됨' : providerCheck.state === 'checking' ? '연결 확인 중' : '예시 모드'
  const settingsMessage = providerIssue?.message ?? (providerCheck.state === 'checking'
    ? '서버에 연결하는 중에도 분수 나눗셈 예시 활동을 볼 수 있어요.'
    : '새 학습목표로 추천을 받으려면 운영자가 서버에서 OpenAI를 연결해야 해요.')

  function updateLesson(next: LessonInput) {
    setLesson(next)
    if (error) setError('')
    if (notice) setNotice('')
  }

  function loadExample() {
    updateLesson(demoLesson)
    setNotice('분수 나눗셈 예시를 불러왔어요.')
  }

  function openSettings() {
    optionsDialog.current?.showModal()
  }

  async function handleGenerate(sample: boolean) {
    if (pending) return
    if (sample) loadExample()
    const parsed = lessonInputSchema.safeParse(sample ? demoLesson : lesson)
    if (!parsed.success) {
      setError(lesson.objective.trim() ? '활동 조건을 다시 확인해 주세요.' : '학습목표를 입력해 주세요.')
      if (!lesson.objective.trim()) document.getElementById('learning-objective')?.focus()
      return
    }

    const useDemo = sample || (!live && isDemoLesson(parsed.data))
    if (!live && !useDemo) {
      setError(providerCheck.state === 'checking'
        ? '연결 가능 여부를 확인하고 있어요. 잠시 후 다시 시도해 주세요.'
        : providerIssue?.message ?? settingsMessage)
      scrollToResults()
      return
    }

    const mode = useDemo ? 'demo' : 'openai'
    const requestModel = mode === 'openai' ? selectedModel || provider?.models[0]?.id : undefined
    const request = generate(parsed.data, mode, requestModel)
    scrollToResults()
    await request
  }

  return (
    <>
      <header className="toolbar">
        <div className="page-width toolbar-inner">
          <a className="wordmark" href="./" aria-label="Creative Class AI 홈">
            <span className="brand-icon"><BookOpen size={21} strokeWidth={2.25} /><Sparkles className="brand-spark" size={12} /></span>
            <span>Creative Class<span className="brand-ai">AI</span></span>
          </a>
          <div className="toolbar-actions">
            <button type="button" className="mode-pill" onClick={openSettings}>
              <span className={providerIssue ? 'status-dot status-alert' : 'status-dot'} /> {statusLabel}
            </button>
            <button type="button" className="settings-button" aria-label="설정" onClick={openSettings}><Settings2 size={19} /></button>
          </div>
        </div>
      </header>

      <main className="page-width main-content">
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-content">
            <p className="hero-kicker"><Sparkles size={15} /> 초등 교사를 위한 수업 활동 도구</p>
            <h1 id="page-title">오늘의 수업에,<br /><em>놀이를 더해요.</em></h1>
            <p className="hero-description">학습목표에 맞는 창의적인 활동을 추천받아 보세요.</p>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="orbit orbit-outer" />
            <div className="orbit orbit-inner" />
            <img src="/classroom-illustration.webp" alt="" width={720} height={512} fetchPriority="high" />
          </div>
        </section>

        <div className="workspace-grid">
          <div className="form-column">
            <LessonForm lesson={lesson} pending={pending} onChange={updateLesson} onExample={loadExample}
              onGenerate={() => void handleGenerate(false)} />
            <p className="sr-only" role="status">{notice}</p>
          </div>
          <div className="output-column" id="recommendation-output">
            {error && (
              <div className="api-error" role="alert">
                <CircleAlert size={19} />
                <p>{error}</p>
                {providerIssue?.reason === 'session'
                  ? <a href="./" target="_blank" rel="noopener noreferrer">앱 새 탭에서 열기</a>
                  : providerIssue
                    ? <button type="button" onClick={retryProviderCheck}>연결 다시 확인</button>
                    : !live && <button type="button" onClick={() => void handleGenerate(true)}>예시 결과 보기</button>}
              </div>
            )}
            <Results result={result} pending={pending} onExample={() => void handleGenerate(true)} />
          </div>
        </div>

        <footer className="page-footer">
          <span><BookOpen size={16} /> Creative Class AI</span>
          <button type="button" onClick={openSettings}><Settings2 size={15} /> 설정</button>
        </footer>
      </main>

      <dialog className="settings-dialog" ref={optionsDialog} aria-labelledby="settings-title"
        onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close() }}>
        <div className="dialog-content">
          <div className="dialog-header">
            <span className="section-icon mint-icon"><Settings2 size={19} /></span>
            <h2 id="settings-title">설정</h2>
            <button type="button" className="settings-button" aria-label="설정 닫기" onClick={() => optionsDialog.current?.close()}><X size={19} /></button>
          </div>
          <div className="settings-section">
            <h3>활동 생성</h3>
            <p className="settings-status"><span className={providerIssue ? 'status-dot status-alert' : 'status-dot'} /> {statusLabel}</p>
            {live && provider ? (
              <label className="field">
                <span>{provider.label} 모델</span>
                <select value={selectedModel || provider.models[0]?.id} onChange={(event) => setSelectedModel(event.currentTarget.value)}>
                  {provider.models.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
            ) : (
              <p>{settingsMessage}</p>
            )}
            <div className="settings-actions">
              {providerIssue?.reason === 'session' && (
                <a className="secondary-button" href="./" target="_blank" rel="noopener noreferrer">앱 새 탭에서 열기</a>
              )}
              {providerIssue && (
                <button type="button" className="secondary-button" onClick={retryProviderCheck}>
                  <RotateCcw size={16} /> 연결 다시 확인
                </button>
              )}
              <button type="button" className="secondary-button" disabled={pending} onClick={() => {
                optionsDialog.current?.close()
                void handleGenerate(true)
              }}><FlaskConical size={16} /> 예시 결과 보기</button>
            </div>
          </div>
          <div className="settings-section">
            <h3>저장된 필터</h3>
            <p>수업 조건과 놀이 요소는 이 브라우저에 저장돼요.</p>
            <button type="button" className="secondary-button" onClick={() => {
              resetFilters()
              setError('')
              setNotice('필터를 기본값으로 되돌렸어요.')
              optionsDialog.current?.close()
            }}><RotateCcw size={16} /> 기본값으로 되돌리기</button>
          </div>
        </div>
      </dialog>
    </>
  )
}
