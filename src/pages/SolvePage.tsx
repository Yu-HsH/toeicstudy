import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import {
  CHOICE_KEYS,
  MISTAKE_REASONS,
  type ChoiceKey,
  type MistakeReason,
  type Question,
} from '../types'

interface SolvePageProps {
  questions: Question[]
  isReview?: boolean
  onAnswer: (
    id: string,
    answer: ChoiceKey,
    reason: MistakeReason | undefined,
    isReview: boolean,
  ) => void
  onGoRegister: () => void
}

export function SolvePage({
  questions,
  isReview = false,
  onAnswer,
  onGoRegister,
}: SolvePageProps) {
  const studyQuestions = useMemo(
    () => (isReview ? questions.filter((question) => question.isMistake) : questions),
    [questions, isReview],
  )
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<ChoiceKey | null>(null)
  const [reason, setReason] = useState<MistakeReason | ''>('')

  const current = studyQuestions[index % Math.max(studyQuestions.length, 1)]
  const isCorrect = selected === current?.correctAnswer

  useEffect(() => {
    if (index >= studyQuestions.length && studyQuestions.length > 0) setIndex(0)
  }, [index, studyQuestions.length])

  useEffect(() => {
    setSelected(null)
    setReason('')
  }, [current?.id])

  if (studyQuestions.length === 0) {
    return (
      <section className="page-section">
        <div className="section-heading">
          <span className="eyebrow">{isReview ? 'REVIEW' : 'PRACTICE'}</span>
          <h2>{isReview ? '오답 복습' : '문제 풀기'}</h2>
        </div>
        <EmptyState
          icon={isReview ? '✓' : '＋'}
          title={isReview ? '복습할 오답이 없어요' : '아직 저장된 문제가 없어요'}
          description={
            isReview
              ? '문제를 풀고 틀리면 이곳에 자동으로 모입니다.'
              : '문제를 직접 등록하거나 예시용 샘플을 추가해 시작하세요.'
          }
          action={
            !isReview && (
              <button className="button primary" type="button" onClick={onGoRegister}>
                문제 등록하러 가기
              </button>
            )
          }
        />
      </section>
    )
  }

  const handleNext = () => {
    if (!selected || (!isCorrect && !reason)) return
    onAnswer(current.id, selected, reason || undefined, isReview)
    setIndex((currentIndex) => (currentIndex + 1) % studyQuestions.length)
    setSelected(null)
    setReason('')
  }

  return (
    <section className="page-section">
      <div className="section-heading split-heading">
        <div>
          <span className="eyebrow">{isReview ? 'REVIEW' : 'PRACTICE'}</span>
          <h2>{isReview ? '오답 복습' : '문제 풀기'}</h2>
          <p>
            {isReview
              ? '다시 맞힌 문제는 복습 정답 횟수가 올라갑니다.'
              : '저장된 문제를 한 문제씩 차분하게 풀어보세요.'}
          </p>
        </div>
        <span className="progress-label">
          {index + 1} / {studyQuestions.length}
        </span>
      </div>

      <div className="progress-track" aria-hidden="true">
        <span style={{ width: `${((index + 1) / studyQuestions.length) * 100}%` }} />
      </div>

      <article className="solve-card panel">
        <div className="badge-row">
          <span className="part-badge">{current.part}</span>
          {current.tags.map((tag) => (
            <span className="tag" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
        <h3 className="solve-question">{current.questionText}</h3>
        <div className="choice-list">
          {CHOICE_KEYS.map((key) => {
            const revealed = selected !== null
            const correctChoice = revealed && key === current.correctAnswer
            const wrongChoice = revealed && key === selected && key !== current.correctAnswer
            return (
              <button
                type="button"
                key={key}
                className={`choice-button ${correctChoice ? 'correct' : ''} ${
                  wrongChoice ? 'wrong' : ''
                }`}
                disabled={revealed}
                onClick={() => setSelected(key)}
              >
                <span className="choice-key">{key}</span>
                <span>{current.choices[key]}</span>
                {correctChoice && <span className="choice-result">정답</span>}
                {wrongChoice && <span className="choice-result">내 답</span>}
              </button>
            )
          })}
        </div>

        {selected && (
          <div className={`answer-feedback ${isCorrect ? 'success' : 'error'}`}>
            <strong>{isCorrect ? '정답입니다!' : `정답은 ${current.correctAnswer}입니다.`}</strong>
            {current.explanation && <p>{current.explanation}</p>}
          </div>
        )}

        {selected && !isCorrect && (
          <label className="field reason-picker">
            <span>이번에 틀린 이유를 골라주세요.</span>
            <select
              required
              value={reason}
              onChange={(event) => setReason(event.target.value as MistakeReason | '')}
            >
              <option value="">틀린 이유 선택</option>
              {MISTAKE_REASONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        )}

        {selected && (
          <div className="solve-actions">
            <button
              className="button primary"
              type="button"
              disabled={!isCorrect && !reason}
              onClick={handleNext}
            >
              {index === studyQuestions.length - 1 ? '저장하고 처음으로' : '저장하고 다음 문제'}
            </button>
          </div>
        )}
      </article>
    </section>
  )
}
