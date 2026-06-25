import { useState, type FormEvent } from 'react'
import {
  CHOICE_KEYS,
  MISTAKE_REASONS,
  PARTS,
  type ChoiceKey,
  type MistakeReason,
  type Part,
  type QuestionDraft,
} from '../types'

interface RegisterPageProps {
  onAdd: (draft: QuestionDraft) => void
  onAddSamples: () => void
}

const emptyChoices = { A: '', B: '', C: '', D: '' }

export function RegisterPage({ onAdd, onAddSamples }: RegisterPageProps) {
  const [part, setPart] = useState<Part>('Part 5')
  const [passage, setPassage] = useState('')
  const [groupId, setGroupId] = useState('')
  const [questionNumber, setQuestionNumber] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [choices, setChoices] = useState({ ...emptyChoices })
  const [correctAnswer, setCorrectAnswer] = useState<ChoiceKey>('A')
  const [myAnswer, setMyAnswer] = useState<ChoiceKey | ''>('')
  const [explanation, setExplanation] = useState('')
  const [tags, setTags] = useState('')
  const [mistakeReason, setMistakeReason] = useState<MistakeReason | ''>('')
  const [saved, setSaved] = useState(false)

  const reset = () => {
    setQuestionText('')
    setPassage('')
    setGroupId('')
    setQuestionNumber('')
    setChoices({ ...emptyChoices })
    setCorrectAnswer('A')
    setMyAnswer('')
    setExplanation('')
    setTags('')
    setMistakeReason('')
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onAdd({
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
    reset()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1600)
  }

  return (
    <section className="page-section">
      <div className="section-heading split-heading">
        <div>
          <span className="eyebrow">ADD QUESTION</span>
          <h2>문제 등록</h2>
          <p>직접 만든 문제나 학습 중 정리한 문항을 입력하세요.</p>
        </div>
        <button className="button ghost" type="button" onClick={onAddSamples}>
          샘플 3문제 추가
        </button>
      </div>

      <form className="question-form panel" onSubmit={handleSubmit}>
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
          <span>지문 (Part 6/7 선택)</span>
          <textarea
            rows={4}
            placeholder="같은 지문에 묶인 문제라면 여기에 지문을 입력하세요."
            value={passage}
            onChange={(event) => setPassage(event.target.value)}
          />
        </label>

        <div className="field-row two-columns">
          <label className="field">
            <span>세트 ID (선택)</span>
            <input
              placeholder="예: notice-001"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
            />
          </label>
          <label className="field">
            <span>문항 번호 (선택)</span>
            <input
              placeholder="예: 147"
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
            placeholder="문제 지문을 입력하세요."
            value={questionText}
            onChange={(event) => setQuestionText(event.target.value)}
          />
        </label>

        <fieldset className="choices-fieldset">
          <legend>선택지</legend>
          <div className="choice-input-grid">
            {CHOICE_KEYS.map((key) => (
              <label className="choice-input" key={key}>
                <span>{key}</span>
                <input
                  required
                  placeholder={`${key} 선택지`}
                  value={choices[key]}
                  onChange={(event) =>
                    setChoices((current) => ({ ...current, [key]: event.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field-row two-columns">
          <label className="field">
            <span>내가 고른 답 (선택)</span>
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
            <span>틀린 이유 (선택)</span>
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
            placeholder="헷갈린 포인트나 정답 근거를 적어두세요."
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
          />
        </label>

        <label className="field">
          <span>태그</span>
          <input
            placeholder="예: 가정법, 어휘, 회사공지 (쉼표로 구분)"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
        </label>

        <div className="form-actions">
          <span className={`save-message ${saved ? 'visible' : ''}`}>저장했습니다 ✓</span>
          <button className="button primary" type="submit">
            문제 저장
          </button>
        </div>
      </form>
    </section>
  )
}
