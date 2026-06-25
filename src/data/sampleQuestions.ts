import { draftToQuestion } from '../storage'
import type { Question } from '../types'

export function createSampleQuestions(): Question[] {
  return [
    draftToQuestion({
      part: 'Part 6',
      groupId: 'sample-release',
      questionNumber: '1',
      passage:
        'The marketing team has postponed the product launch until Friday. The public announcement must reflect the new date.',
      questionText:
        'The marketing team has postponed the product launch until Friday. _____, the press release will be revised before noon.',
      choices: {
        A: 'However',
        B: 'Therefore',
        C: 'Otherwise',
        D: 'Similarly',
      },
      correctAnswer: 'B',
      myAnswer: 'A',
      explanation: '출시가 연기되었기 때문에 보도자료도 수정된다는 결과 관계이므로 Therefore가 자연스럽습니다.',
      tags: ['문장삽입', '접속부사'],
      mistakeReason: '전치사/접속사',
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
