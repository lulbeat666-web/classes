import { useState } from 'react'
import {
  BookOpenCheck, Check, ChevronDown, Clipboard, Clock3, FileText, FlaskConical,
  Hourglass, Lightbulb, Package, Sparkles, Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { GenerationResponse, RecommendedActivity } from '../shared/contracts'
import { mechanismOptions } from '../shared/mechanisms'
import { mechanismIcons } from '../options'

type Props = {
  result?: GenerationResponse
  pending: boolean
  onExample: () => void
}

const mechanismNames = Object.fromEntries(mechanismOptions.map(({ id, name }) => [id, name]))

const scoreLabels = {
  engagement: '놀이 몰입감',
  creativity: '독창적 조합',
  learningAlignment: '학습목표 연계',
  studentAgency: '학생 주도성',
  feasibility: '교실 실행 가능성',
} satisfies Record<keyof RecommendedActivity['qualityScores'], string>

function scoreRows(scores: RecommendedActivity['qualityScores']) {
  return (Object.keys(scoreLabels) as (keyof typeof scoreLabels)[]).map((key) => ({
    label: scoreLabels[key],
    score: scores[key],
  }))
}

function activityText(activity: RecommendedActivity, mode: GenerationResponse['mode']) {
  const bullets = (items: string[]) => items.map((item) => '• ' + item).join('\n')
  const text = [
    activity.title,
    activity.tagline,
    mode === 'demo' ? '분수 나눗셈 예시 활동' : 'Creative Class AI 추천 활동',
    '활동 ' + activity.durationMinutes + '분 · 사전 준비 ' + activity.preparationMinutes + '분',
    activity.activityType + ' · ' + activity.groupType + ' · ' + activity.movementLevel + ' · ' + activity.noiseLevel,
    '놀이 요소 ' + activity.playMechanisms.map((id) => mechanismNames[id]).join(', '),
    '준비물 ' + activity.materials.join(', '),
    '\n활동 개요\n' + activity.overview,
    '\n학습목표\n' + activity.learningObjective + '\n' + bullets(activity.essentialLearningActions),
    '\n학습목표 연결\n' + activity.learningConnection,
    '\n진행 순서\n' + activity.steps.map((step) =>
      step.order + '. ' + step.title + ' (' + step.durationMinutes + '분)\n' + step.description +
      (step.teacherScript ? '\n“' + step.teacherScript + '”' : ''),
    ).join('\n\n'),
    '\n재미 요소\n' + bullets(activity.engagementPoints),
    '\n준비 방법\n' + (activity.preparationInstructions.length ? bullets(activity.preparationInstructions) : '별도 사전 준비 없음'),
    '\n안전 유의사항\n' + bullets(activity.safetyNotes),
    '\n예상 문제와 해결 방법\n' + bullets(activity.potentialProblems.map(({ problem, solution }) => problem + '\n  ' + solution)),
    '\n' + (mode === 'demo' ? '예시 평가' : 'AI 추정 평가') + '\n' + bullets(scoreRows(activity.qualityScores).map(({ label, score }) => label + ' ' + score + '/5')),
  ]
  if (activity.excludedMechanisms?.length) {
    text.push('\n이번 활동에서 제외한 요소\n' + bullets(activity.excludedMechanisms.map(({ mechanism, reason }) => mechanismNames[mechanism] + ' · ' + reason)))
  }
  return text.join('\n')
}

async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const field = document.createElement('textarea')
    const focused = document.activeElement
    field.value = text
    field.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
    document.body.appendChild(field)
    field.select()
    try {
      if (!document.execCommand('copy')) throw new Error()
    } finally {
      field.remove()
      if (focused instanceof HTMLElement) focused.focus()
    }
  }
}

function Detail({ title, children }: { title: string; children: ReactNode }) {
  return <section className="activity-detail-section"><h4>{title}</h4>{children}</section>
}

function Bullets({ items }: { items: string[] }) {
  return <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
}

function ActivityCard({ activity, mode }: { activity: RecommendedActivity; mode: GenerationResponse['mode'] }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [open, setOpen] = useState(false)
  const detailId = 'activity-detail-' + activity.id

  async function copy() {
    try {
      await writeClipboard(activityText(activity, mode))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <article className="activity-card">
      <div className="activity-title-row">
        <span className="activity-type">{activity.activityType}</span>
        <span className="activity-duration"><Clock3 size={15} /> {activity.durationMinutes}분</span>
      </div>
      <h3>{activity.title}</h3>
      <p className="activity-tagline">{activity.tagline}</p>
      <div className="badges" aria-label="활동의 놀이 요소">
        {activity.playMechanisms.map((id) => {
          const Icon = mechanismIcons[id]
          return <span className="mechanism-badge" key={id}><Icon size={14} /> {mechanismNames[id]}</span>
        })}
      </div>
      <div className="activity-facts">
        <span><Hourglass size={16} /> 사전 준비 {activity.preparationMinutes}분</span>
        <span><Users size={16} /> {activity.groupType}</span>
        <span className="activity-materials"><Package size={16} /> {activity.materials.join(' · ')}</span>
      </div>
      <div className="activity-actions">
        <button type="button" className="secondary-button" aria-expanded={open} aria-controls={detailId}
          onClick={() => setOpen(!open)}>
          {open ? '상세 접기' : '활동 상세 보기'} <ChevronDown className={open ? 'rotate-180' : ''} size={16} />
        </button>
        <button type="button" className="icon-button copy-button" aria-label={activity.title + ' 활동 복사'} onClick={() => void copy()}>
          {copyState === 'copied' ? <Check size={17} /> : <Clipboard size={17} />}
          {copyState === 'copied' ? '복사 완료' : '복사'}
        </button>
      </div>
      <div className="sr-only" aria-live="polite">{copyState === 'copied' ? '활동을 복사했어요.' : ''}</div>
      {copyState === 'failed' && <p className="inline-error" role="alert">클립보드에 복사하지 못했어요.</p>}

      <div className="activity-details" id={detailId} hidden={!open}>
        <Detail title="활동 개요"><p>{activity.overview}</p></Detail>
        <Detail title="학습목표와 연결">
          <p className="objective-text">{activity.learningObjective}</p>
          <Bullets items={activity.essentialLearningActions} />
          <p>{activity.learningConnection}</p>
        </Detail>
        <Detail title="단계별 진행 방법">
          <ol className="steps">
            {activity.steps.map((step) => <li key={step.order}>
              <div className="step-head"><b>{step.order}. {step.title}</b><span>{step.durationMinutes}분</span></div>
              <p>{step.description}</p>
              {step.teacherScript && <blockquote>“{step.teacherScript}”</blockquote>}
            </li>)}
          </ol>
        </Detail>
        <Detail title="학생들이 재미를 느낄 요소"><Bullets items={activity.engagementPoints} /></Detail>
        <Detail title="준비물과 준비 방법">
          <p>{activity.materials.join(' · ')}</p>
          {activity.preparationInstructions.length
            ? <Bullets items={activity.preparationInstructions} />
            : <p>별도 사전 준비가 필요 없어요.</p>}
        </Detail>
        <Detail title="교실 환경과 안전">
          <p>{activity.movementLevel} · {activity.noiseLevel}</p>
          <Bullets items={activity.safetyNotes} />
        </Detail>
        <Detail title="예상 문제와 해결 방법">
          {activity.potentialProblems.map(({ problem, solution }, index) =>
            <p key={index} className="problem"><strong>{problem}</strong><br />{solution}</p>,
          )}
        </Detail>
        {!!activity.excludedMechanisms?.length && <Detail title="이번 활동에서 제외한 요소">
          <Bullets items={activity.excludedMechanisms.map(({ mechanism, reason }) => mechanismNames[mechanism] + ' · ' + reason)} />
        </Detail>}
        <Detail title={mode === 'demo' ? '예시 평가' : 'AI 추정 평가'}>
          <p>{mode === 'demo' ? '예시 활동의 설계 기준별 참고 점수예요.' : 'AI가 활동 설계를 5점 척도로 추정한 참고 점수예요.'}</p>
          <dl className="score-list">{scoreRows(activity.qualityScores).map(({ label, score }) =>
            <div key={label}><dt>{label}</dt><dd>{score} / 5</dd></div>,
          )}</dl>
        </Detail>
      </div>
    </article>
  )
}

export function Results({ result, pending, onExample }: Props) {
  return (
    <section className="results-column" id="recommendations" aria-labelledby="results-title" aria-busy={pending}>
      <div className="panel results-panel">
        <div className="section-head">
          <div className="section-title">
            <span className="section-icon mint-icon"><Sparkles size={19} /></span>
            <div><h2 id="results-title">추천 활동</h2><p>교실에서 바로 쓸 수 있는 활동을 만나보세요.</p></div>
          </div>
          <span className="result-count">{result?.activities.length ?? 3}개 활동</span>
        </div>
        {pending ? (
          <div className="results-empty" role="status">
            <span className="empty-icon"><Sparkles size={31} className="activity-progress" /></span>
            <h3>수업에 어울리는 활동을 찾고 있어요</h3>
            <p>놀이 요소를 조합하고 활동 시간과 준비물을 확인해요.</p>
          </div>
        ) : result ? (
          <div className="result-list">
            <div className="result-source" role="status"><Check size={15} />
              {result.mode === 'demo' ? '분수 나눗셈 예시 · 활동 3개' : '활동 3개를 추천했어요'}
            </div>
            {result.activities.map((activity) => <ActivityCard key={activity.id} activity={activity} mode={result.mode} />)}
          </div>
        ) : (
          <div className="results-empty">
            <div className="empty-art" aria-hidden="true">
              <span className="empty-icon"><FileText size={33} strokeWidth={1.7} /></span>
              <Sparkles className="star-one" size={21} strokeWidth={1.8} />
              <Sparkles className="star-two" size={13} strokeWidth={2} />
            </div>
            <h3>아직 추천 활동이 없어요</h3>
            <p>수업 정보와 활동 조건을 입력하면<br className="desktop-break" /> 학습목표에 맞는 놀이 활동 3개를 제안해요.</p>
            <button type="button" className="secondary-button" onClick={onExample}>
              <FlaskConical size={16} /> 예시 결과 보기
            </button>
          </div>
        )}
      </div>
      {!result && !pending && (
        <aside className="tip-card">
          <span className="tip-icon"><Lightbulb size={20} /></span>
          <div><h3>학습목표 작성 팁</h3><p>학생이 할 행동을 적어주세요. “설명하기”, “비교하기”처럼<br className="tip-break" /> 구체적으로 쓰면 활동을 고르기 쉬워요.</p></div>
        </aside>
      )}
      {result && !pending && (
        <p className="result-note"><BookOpenCheck size={16} /> 시작하기 전에 교실 상황에 맞게 준비물과 진행 순서를 확인하세요.</p>
      )}
    </section>
  )
}
