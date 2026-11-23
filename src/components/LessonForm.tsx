import { BookOpen, ChevronDown, Clock3, Layers3, LoaderCircle, Sparkles, TestTubeDiagonal } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { durations, materialOptions, mechanismIcons } from '../options'
import { subjects } from '../shared/contracts'
import type { LessonInput } from '../shared/contracts'
import { mechanismOptions } from '../shared/mechanisms'

type Props = {
  lesson: LessonInput
  pending: boolean
  onChange: (lesson: LessonInput) => void
  onExample: () => void
  onGenerate: () => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function SelectWrap({ children }: { children: ReactNode }) {
  return <span className="select-wrap">{children}<ChevronDown size={16} aria-hidden="true" /></span>
}

export function LessonForm({ lesson, pending, onChange, onExample, onGenerate }: Props) {
  function update<K extends keyof LessonInput>(key: K, value: LessonInput[K]) {
    onChange({ ...lesson, [key]: value })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onGenerate()
  }

  function toggleMechanism(id: LessonInput['mechanisms'][number]) {
    const selected = lesson.mechanisms.includes(id)
    if (selected) {
      update('mechanisms', lesson.mechanisms.filter((item) => item !== id))
    } else if (lesson.mechanisms.length < 4) {
      update('mechanisms', [...lesson.mechanisms, id])
    }
  }

  return (
    <form className="panel lesson-panel" id="lesson-form" onSubmit={submit}>
      <div className="form-section">
        <div className="section-head">
          <div className="section-title">
            <span className="section-icon mint-icon"><BookOpen size={19} /></span>
            <div><h2>수업 정보</h2><p>오늘 수업에서 배운 내용을 알려주세요.</p></div>
          </div>
          <button type="button" className="example-link" disabled={pending} onClick={onExample}>
            <TestTubeDiagonal size={15} /> 예시 불러오기
          </button>
        </div>
        <div className="field-grid">
          <Field label="학년">
            <SelectWrap>
              <select value={lesson.grade} onChange={(event) => update('grade', Number(event.currentTarget.value))}>
                {[1, 2, 3, 4, 5, 6].map((grade) => <option key={grade} value={grade}>{grade}학년</option>)}
              </select>
            </SelectWrap>
          </Field>
          <Field label="교과">
            <SelectWrap>
              <select value={lesson.subject} onChange={(event) => update('subject', event.currentTarget.value as LessonInput['subject'])}>
                {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
              </select>
            </SelectWrap>
          </Field>
        </div>
        <label className="field text-field">
          <span>학습목표 <span className="required-mark" aria-hidden="true">*</span></span>
          <textarea id="learning-objective" required rows={2} maxLength={600} value={lesson.objective}
            placeholder="예: 분수의 나눗셈 원리를 이해하고 설명할 수 있다."
            onChange={(event) => update('objective', event.currentTarget.value)} />
        </label>
        <label className="field text-field">
          <span>오늘 배운 교과서 내용 <span className="optional-mark">선택</span></span>
          <textarea rows={2} maxLength={1500} value={lesson.textbookContent}
            placeholder="예: 분수의 나눗셈을 그림으로 표현하고 계산 원리를 배웠어요."
            onChange={(event) => update('textbookContent', event.currentTarget.value)} />
        </label>
      </div>

      <div className="form-section">
        <div className="section-title">
          <span className="section-icon blue-icon"><Clock3 size={19} /></span>
          <div><h2>활동 조건</h2><p>우리 교실에서 지킬 조건을 정해요.</p></div>
        </div>
        <div className="field-grid">
          <Field label="활동 시간">
            <SelectWrap>
              <select value={lesson.durationMinutes} onChange={(event) => update('durationMinutes', Number(event.currentTarget.value))}>
                {durations.map((minutes) => <option key={minutes} value={minutes}>{minutes}분</option>)}
              </select>
            </SelectWrap>
          </Field>
          <Field label="시간 기준">
            <SelectWrap>
              <select value={lesson.durationMode} onChange={(event) => update('durationMode', event.currentTarget.value as LessonInput['durationMode'])}>
                <option value="exact">정확한 활동 시간</option>
                <option value="max">최대 활동 시간</option>
              </select>
            </SelectWrap>
          </Field>
          <div className="full-field">
            <Field label="준비물 허용 범위">
              <SelectWrap>
                <select value={lesson.materials} onChange={(event) => update('materials', event.currentTarget.value as LessonInput['materials'])}>
                  {materialOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </SelectWrap>
            </Field>
          </div>
          <Field label="사전 준비 시간">
            <SelectWrap>
              <select value={lesson.preparationMinutes} onChange={(event) => update('preparationMinutes', Number(event.currentTarget.value) as LessonInput['preparationMinutes'])}>
                {[0, 5, 10, 20].map((minutes) => <option key={minutes} value={minutes}>{minutes}분</option>)}
              </select>
            </SelectWrap>
          </Field>
          <Field label="학급 인원">
            <span className="number-wrap">
              <input type="number" min={1} max={50} required value={Number.isNaN(lesson.groupSize) ? '' : lesson.groupSize}
                onChange={(event) => update('groupSize', event.currentTarget.valueAsNumber)} />
              <span aria-hidden="true">명</span>
            </span>
          </Field>
        </div>
      </div>

      <div className="form-section">
        <div className="section-head mechanism-heading">
          <div className="section-title">
            <span className="section-icon violet-icon"><Layers3 size={19} /></span>
            <div><h2>놀이 요소</h2><p>원하는 요소를 최대 4개 골라주세요.</p></div>
          </div>
          <button type="button" className="auto-toggle" aria-pressed={lesson.mechanisms.length === 0}
            onClick={() => update('mechanisms', [])}>
            <Sparkles size={15} /> AI 자동 선택
          </button>
        </div>
        <div className="mechanism-grid" aria-label="놀이 메커니즘" role="group">
          {mechanismOptions.map(({ id, name, description }) => {
            const Icon = mechanismIcons[id]
            const selected = lesson.mechanisms.includes(id)
            return <button key={id} className="mechanism" type="button" aria-pressed={selected}
              title={description} disabled={!selected && lesson.mechanisms.length === 4}
              onClick={() => toggleMechanism(id)}><Icon size={17} />{name}</button>
          })}
        </div>
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" size={19} /> : <Sparkles size={19} />}
          {pending ? '활동을 준비하고 있어요' : '활동 3개 추천받기'}
        </button>
      </div>
    </form>
  )
}
