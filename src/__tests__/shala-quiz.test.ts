import { describe, it, expect } from 'vitest';
import { QUIZ_QUESTIONS } from '../app/shala/quizData';

describe('Student Environmental Awareness Quiz', () => {
  it('contains at least 5 structured questions', () => {
    expect(QUIZ_QUESTIONS.length).toBeGreaterThanOrEqual(5);
  });

  it('provides complete translations in pa, hi, and en for every question and option', () => {
    for (const q of QUIZ_QUESTIONS) {
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
});
