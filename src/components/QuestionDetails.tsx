import { useEffect, useState, type FormEvent } from 'react'
import {
  CHOICE_KEYS,
  MISTAKE_REASONS,
  PARTS,
  type ChoiceKey,
  type MistakeReason,
  type Part,
  type Question,
} from '../types'
import { copyAnalysisPrompt } from '../utils/prompt'
import { formatDuration, getQuestionAverageSolveTimeMs } from '../utils/time'

interface QuestionDetailsProps {
  question: Question
  onDelete?: (id: string) => void
  onUpdate?: (question: Question) => void
}

export function QuestionDetails({ question, onDelete, onUpdate }: QuestionDetailsProps) {
  const [copyLabel, setCopyLabel] = useState('분석 프롬프트 복사')
  const averageSolveTimeMs = getQuestionAverageSolveTimeMs(question)
  const [editing, setEditing] = useState(false)
  const [part, setPart] = useState<Part>(question.part)
  const [passage, setPassage] = useState(question.passage ?? '')
  const [groupId, setGroupId] = useState(question.groupId ?? '')
  const [questionNumber, setQuestionNumber] = useState(question.questionNumber ?? '')
  const [questionText, setQuestionText] = useState(question.questionText)
  const [choices, setChoices] = useState({ ...question.choices })
  const [correctAnswer, setCorrectAnswer] = useState<ChoiceKey>(question.correctAnswer)
  const [myAnswer, setMyAnswer] = useState<ChoiceKey | ''>(question.myAnswer ?? '')
  const [explanation, setExplanation] = useState(question.explanation)
  const [tags, setTags] = useState(question.tags.join(', '))
  const [mistakeReason, setMistakeReason] = useState<MistakeReason | ''>(
    question.mistakeReason ?? '',
  )

  useEffect(() => {
    setPart(question.part)
    setPassage(question.passage ?? '')
    setGroupId(question.groupId ?? '')
    setQuestionNumber(question.questionNumber ?? '')
    setQuestionText(question.questionText)
    setChoices({ ...question.choices })
    setCorrectAnswer(question.correctAnswer)
    setMyAnswer(question.myAnswer ?? '')
    setExplanation(question.explanation)
    setTags(question.tags.join(', '))
    setMistakeReason(question.mistakeReason ?? '')
  }, [question])

  const handleCopy = async () => {
    try {
      await copyAnalysisPrompt(question)
      setCopyLabel('복사됨 ✓')
      window.setTimeout(() => setCopyLabel('분석 프롬프트 복사'), 1600)
    } catch {
      setCopyLabel('복사 실패')
    }
  }

  const handleUpdate = (event: FormEvent) => {
    event.preventDefault()
    if (!onUpdate) return
    onUpdate({
      ...question,
      part,
      passage: passage.trim() || undefined,
      groupId: groupId.trim() || undefined,
      questionNumber: questionNumber.trim() || undefined,
      questionText: questionText.trim(),
      choices,
      correctAnswer,
      myAnswer: myAnswer || undefined,
      explanation: explanation.trim(),
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      mistakeReason: mistakeReason || undefined,
    })
    setEditing(false)
  }

  return (
    <article className="question-card">
      <div className="question-card__head">
        <div className="badge-row">
          <span className="part-badge">{question.part}</span>
          {question.groupId && <span className="group-badge">세트 {question.groupId}</span>}
          {question.questionNumber && (
            <span className="group-badge">문항 {question.questionNumber}</span>
          )}
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
      {question.passage && (
        <div className="passage-box compact-passage">
          <strong>지문</strong>
          <p>{question.passage}</p>
        </div>
      )}
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
          {question.lastSolveTimeMs !== undefined && (
            <span className="time-badge">최근 {formatDuration(question.lastSolveTimeMs)}</span>
          )}
          {averageSolveTimeMs !== undefined && (
            <span className="time-badge">평균 {formatDuration(averageSolveTimeMs)}</span>
          )}
          {question.fastestSolveTimeMs !== undefined && (
            <span className="time-badge">
              최단 {formatDuration(question.fastestSolveTimeMs)}
            </span>
          )}
          {question.slowestSolveTimeMs !== undefined && (
            <span className="time-badge">
              최장 {formatDuration(question.slowestSolveTimeMs)}
            </span>
          )}
        </div>
        <div className="button-row">
          {onUpdate && (
            <button
              className="button ghost small"
              type="button"
              onClick={() => setEditing((current) => !current)}
            >
              {editing ? '수정 닫기' : '수정'}
            </button>
          )}
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

      {editing && (
        <form className="inline-edit-form" onSubmit={handleUpdate}>
          <div className="field-row two-columns">
            <label className="field">
              <span>파트</span>
              <select value={part} onChange={(event) => setPart(event.target.value as Part)}>
                {PARTS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>정답</span>
              <select
                value={correctAnswer}
                onChange={(event) => setCorrectAnswer(event.target.value as ChoiceKey)}
              >
                {CHOICE_KEYS.map((key) => (
                  <option key={key}>{key}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>지문</span>
            <textarea
              rows={3}
              value={passage}
              onChange={(event) => setPassage(event.target.value)}
            />
          </label>

          <div className="field-row two-columns">
            <label className="field">
              <span>세트 ID</span>
              <input value={groupId} onChange={(event) => setGroupId(event.target.value)} />
            </label>
            <label className="field">
              <span>문항 번호</span>
              <input
                value={questionNumber}
                onChange={(event) => setQuestionNumber(event.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span>문제</span>
            <textarea
              required
              rows={3}
              value={questionText}
              onChange={(event) => setQuestionText(event.target.value)}
            />
          </label>

          <div className="choice-input-grid">
            {CHOICE_KEYS.map((key) => (
              <label className="choice-input" key={key}>
                <span>{key}</span>
                <input
                  required
                  value={choices[key]}
                  onChange={(event) =>
                    setChoices((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>

          <div className="field-row two-columns">
            <label className="field">
              <span>내 답</span>
              <select
                value={myAnswer}
                onChange={(event) => setMyAnswer(event.target.value as ChoiceKey | '')}
              >
                <option value="">아직 안 풀었음</option>
                {CHOICE_KEYS.map((key) => (
                  <option key={key}>{key}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>틀린 이유</span>
              <select
                value={mistakeReason}
                onChange={(event) =>
                  setMistakeReason(event.target.value as MistakeReason | '')
                }
              >
                <option value="">미분류</option>
                {MISTAKE_REASONS.map((reason) => (
                  <option key={reason}>{reason}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>해설</span>
            <textarea
              rows={3}
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
            />
          </label>

          <label className="field">
            <span>태그</span>
            <input value={tags} onChange={(event) => setTags(event.target.value)} />
          </label>

          <div className="form-actions">
            <button className="button ghost" type="button" onClick={() => setEditing(false)}>
              취소
            </button>
            <button className="button primary" type="submit">
              수정 저장
            </button>
          </div>
        </form>
      )}
    </article>
  )
}
