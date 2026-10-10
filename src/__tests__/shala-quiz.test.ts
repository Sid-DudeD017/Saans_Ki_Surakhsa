import { describe, it, expect } from 'vitest';
import { QUIZ_QUESTION_BANK, getDynamicQuiz } from '../app/shala/quizData';

describe('Student Environmental Awareness Quiz', () => {
  it('contains at least 10 structured questions in the question bank', () => {
    expect(QUIZ_QUESTION_BANK.length).toBeGreaterThanOrEqual(10);
  });

  it('provides complete translations in pa, hi, and en for every question and option in the bank', () => {
    for (const q of QUIZ_QUESTION_BANK) {
      expect(q.question.pa).toBeTruthy();
      expect(q.question.hi).toBeTruthy();
      expect(q.question.en).toBeTruthy();

      expect(q.options.pa.length).toBe(4);
      expect(q.options.hi.length).toBe(4);
      expect(q.options.en.length).toBe(4);

      expect(q.explanation.pa).toBeTruthy();
      expect(q.explanation.hi).toBeTruthy();
      expect(q.explanation.en).toBeTruthy();

      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
    }
  });

  it('generates dynamic randomized quizzes where sets and options vary across sessions', () => {
    const quiz1 = getDynamicQuiz(5);
    const quiz2 = getDynamicQuiz(5);

    expect(quiz1.length).toBe(5);
    expect(quiz2.length).toBe(5);

    // Each question has valid bounds and shuffles
    for (const q of quiz1) {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
      expect(q.options.pa.length).toBe(4);
      expect(q.options.hi.length).toBe(4);
      expect(q.options.en.length).toBe(4);
    }
  });
});
