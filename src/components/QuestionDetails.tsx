import { useState } from 'react'
import { CHOICE_KEYS, type Question } from '../types'
import { copyAnalysisPrompt } from '../utils/prompt'

interface QuestionDetailsProps {
  question: Question
  onDelete?: (id: string) => void
}

export function QuestionDetails({ question, onDelete }: QuestionDetailsProps) {
  const [copyLabel, setCopyLabel] = useState('분석 프롬프트 복사')

  const handleCopy = async () => {
    try {
      await copyAnalysisPrompt(question)
      setCopyLabel('복사됨 ✓')
      window.setTimeout(() => setCopyLabel('분석 프롬프트 복사'), 1600)
    } catch {
      setCopyLabel('복사 실패')
    }
  }

  return (
    <article className="question-card">
      <div className="question-card__head">
        <div className="badge-row">
          <span className="part-badge">{question.part}</span>
          {question.isMistake && <span className="mistake-badge">오답</span>}
          {question.mistakeReason && (
            <span className="reason-badge">{question.mistakeReason}</span>
          )}
        </div>
        <time dateTime={question.createdAt}>
          {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(
            new Date(question.createdAt),
          )}
        </time>
      </div>
      <h3 className="question-text">{question.questionText}</h3>
      <div className="choice-list compact">
        {CHOICE_KEYS.map((key) => {
          const isCorrect = key === question.correctAnswer
          const isMine = key === question.myAnswer
          return (
            <div
              className={`choice-row ${isCorrect ? 'correct' : ''} ${
                isMine && !isCorrect ? 'wrong' : ''
              }`}
              key={key}
            >
              <span className="choice-key">{key}</span>
              <span>{question.choices[key]}</span>
              <span className="choice-mark">
                {isCorrect ? '정답' : isMine ? '내 답' : ''}
              </span>
            </div>
          )
        })}
      </div>
      {question.explanation && (
        <div className="explanation-box">
          <strong>내 해설</strong>
          <p>{question.explanation}</p>
        </div>
      )}
      <div className="question-card__foot">
        <div className="tag-list">
          {question.tags.map((tag) => (
            <span className="tag" key={tag}>
              #{tag}
            </span>
          ))}
          <span className="review-count">복습 정답 {question.reviewedCount}회</span>
        </div>
        <div className="button-row">
          <button className="button ghost small" type="button" onClick={handleCopy}>
            {copyLabel}
          </button>
          {onDelete && (
            <button
              className="button danger small"
              type="button"
              onClick={() => onDelete(question.id)}
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
