import { draftToQuestion } from '../storage'
import type { Question } from '../types'

export function createSampleQuestions(): Question[] {
  return [
    draftToQuestion({
      part: 'Part 2',
      questionText: 'When will the design team review the new poster?',
      choices: {
        A: 'In the small meeting room.',
        B: 'After lunch on Wednesday.',
        C: 'A blue background.',
        D: 'Yes, it was reviewed.',
      },
      correctAnswer: 'B',
      myAnswer: 'A',
      explanation: 'When은 시간을 묻기 때문에 일정으로 답한 B가 자연스럽습니다.',
      tags: ['의문사', '일정'],
      mistakeReason: 'LC못들음',
    }),
    draftToQuestion({
      part: 'Part 5',
      questionText: 'The workshop will begin _____ at nine o’clock.',
      choices: {
        A: 'prompt',
        B: 'prompted',
        C: 'promptly',
        D: 'promptness',
      },
      correctAnswer: 'C',
      myAnswer: 'A',
      explanation: '동사 begin을 꾸미는 부사 promptly가 필요합니다.',
      tags: ['품사', '부사'],
      mistakeReason: '품사',
    }),
    draftToQuestion({
      part: 'Part 7',
      questionText:
        'A library notice says the second floor will close at 6 p.m. for a lighting inspection. What should evening visitors do?',
      choices: {
        A: 'Use the first-floor reading area.',
        B: 'Bring their own lamps.',
        C: 'Return every book before 6 p.m.',
        D: 'Meet the inspector upstairs.',
      },
      correctAnswer: 'A',
      explanation: '폐쇄되는 층 대신 이용 가능한 공간을 고르는 문맥 추론 예시입니다.',
      tags: ['공지', '의도파악'],
    }),
  ]
}
