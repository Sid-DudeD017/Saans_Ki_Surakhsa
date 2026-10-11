'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../../components/ui';
import type { Language } from './airQuality';
import { getDynamicQuiz, type QuizQuestion } from './quizData';

interface StudentQuizProps {
  language: Language;
}

const UI_TEXT = {
  title: {
    pa: 'ਵਾਤਾਵਰਣ ਅਤੇ ਹਵਾ ਜਾਗਰੂਕਤਾ ਕਵਿਜ਼',
    hi: 'पर्यावरण एवं वायु जागरूकता क्विज़',
    en: 'Clean Air & Environment Quiz',
  },
  subtitle: {
    pa: 'ਆਪਣੀ ਜਾਣਕਾਰੀ ਪਰਖੋ ਅਤੇ ਸਾਫ਼ ਹਵਾ ਦੇ ਚੈਂਪੀਅਨ ਬਣੋ!',
    hi: 'अपनी जानकारी परखें और स्वच्छ हवा के चैंपियन बनें!',
    en: 'Test your knowledge and become a Clean Air Champion!',
  },
  questionProgress: {
    pa: 'ਸਵਾਲ',
    hi: 'प्रश्न',
    en: 'Question',
  },
  of: {
    pa: 'ਵਿੱਚੋਂ',
    hi: 'में से',
    en: 'of',
  },
  score: {
    pa: 'ਅੰਕ',
    hi: 'स्कोर',
    en: 'Score',
  },
  next: {
    pa: 'ਅਗਲਾ ਸਵਾਲ',
    hi: 'अगला प्रश्न',
    en: 'Next Question',
  },
  finish: {
    pa: 'ਨਤੀਜਾ ਦੇਖੋ',
    hi: 'परिणाम देखें',
    en: 'See Results',
  },
  retry: {
    pa: 'ਨਵੇਂ ਸਵਾਲਾਂ ਨਾਲ ਦੁਬਾਰਾ ਖੇਡੋ',
    hi: 'नए प्रश्नों के साथ फिर खेलें',
    en: 'Play Again with New Questions',
  },
  wellDone: {
    pa: 'ਬਹੁਤ ਵਧੀਆ!',
    hi: 'शानदार प्रयास!',
    en: 'Outstanding Job!',
  },
  badgeChampion: {
    pa: '🌟 ਵਾਯੂ ਰੱਖਿਅਕ (Clean Air Champion)',
    hi: '🌟 वायु रक्षक (Clean Air Champion)',
    en: '🌟 Clean Air Champion',
  },
  badgeScout: {
    pa: '🌿 ਗ੍ਰੀਨ ਸਕਾਊਟ (Green Scout)',
    hi: '🌿 ग्रीन स्काउट (Green Scout)',
    en: '🌿 Green Scout',
  },
  badgeLearner: {
    pa: '🌱 ਵਾਤਾਵਰਣ ਸਿਖਿਆਰਥੀ (Eco Learner)',
    hi: '🌱 पर्यावरण शिक्षार्थी (Eco Learner)',
    en: '🌱 Eco Learner',
  },
  correct: {
    pa: 'ਬਿਲਕੁਲ ਸਹੀ!',
    hi: 'बिल्कुल सही!',
    en: 'Correct!',
  },
  incorrect: {
    pa: 'ਗ਼ਲਤ ਜਵਾਬ',
    hi: 'गलत उत्तर',
    en: 'Not quite!',
  },
};

export function StudentQuiz({ language }: StudentQuizProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => getDynamicQuiz(5));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const currentQ = questions[currentIndex] || questions[0];

  const handleSelect = (idx: number) => {
    if (isAnswered || !currentQ) return;
    setSelectedOption(idx);
    setIsAnswered(true);
    if (idx === currentQ.correctIndex) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setIsFinished(true);
    }
  };

  const handleReset = () => {
    // Generate fresh set of questions each time
    setQuestions(getDynamicQuiz(5));
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setIsFinished(false);
  };

  if (!currentQ) return null;

  if (isFinished) {
    const percentage = Math.round((score / questions.length) * 100);
    let badge = UI_TEXT.badgeChampion[language];
    let badgeColor = '#059669';
    let badgeBg = '#ecfdf5';

    if (score <= 2) {
      badge = UI_TEXT.badgeLearner[language];
      badgeColor = '#0284c7';
      badgeBg = '#f0f9ff';
    } else if (score <= 4) {
      badge = UI_TEXT.badgeScout[language];
      badgeColor = '#d97706';
      badgeBg = '#fffbeb';
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '1.5rem 1rem',
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid #e2e8f0',
          gap: '1rem',
        }}
      >
        <span style={{ fontSize: '3rem' }}>🏆</span>
        <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
          {UI_TEXT.wellDone[language]}
        </h3>
        <p style={{ margin: 0, fontSize: '0.95rem', color: '#475569' }}>
          {UI_TEXT.score[language]}: <strong style={{ color: '#0f172a' }}>{score} / {questions.length}</strong> ({percentage}%)
        </p>

        <div
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '2rem',
            backgroundColor: badgeBg,
            color: badgeColor,
            fontWeight: 700,
            fontSize: '0.95rem',
            border: `1.5px solid ${badgeColor}`,
          }}
        >
          {badge}
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={handleReset}
          style={{ marginTop: '0.5rem', minHeight: '44px', minWidth: '140px' }}
        >
          🔄 {UI_TEXT.retry[language]}
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1rem',
        backgroundColor: '#ffffff',
        borderRadius: '0.75rem',
        border: '1px solid #e2e8f0',
      }}
    >
      {/* Header with Title and Progress */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
            {currentQ.icon} {UI_TEXT.title[language]}
          </h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            {UI_TEXT.subtitle[language]}
          </p>
        </div>
        <div
          style={{
            fontSize: '0.8125rem',
            fontWeight: 700,
            padding: '0.25rem 0.65rem',
            backgroundColor: '#f1f5f9',
            borderRadius: '1rem',
            color: '#334155',
          }}
        >
          {UI_TEXT.questionProgress[language]} {currentIndex + 1} {UI_TEXT.of[language]} {questions.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${((currentIndex + 1) / questions.length) * 100}%`,
            backgroundColor: '#0284c7',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Question Text */}
      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.45 }}>
        {currentQ.question[language]}
      </div>

      {/* Option Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {currentQ.options[language].map((optionText, idx) => {
          let bg = '#f8fafc';
          let border = '#cbd5e1';
          let textColor = '#1e293b';

          if (isAnswered) {
            if (idx === currentQ.correctIndex) {
              bg = '#ecfdf5';
              border = '#10b981';
              textColor = '#065f46';
            } else if (idx === selectedOption) {
              bg = '#fef2f2';
              border = '#ef4444';
              textColor = '#991b1b';
            }
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={isAnswered}
              onClick={() => handleSelect(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                border: `1.5px solid ${border}`,
                backgroundColor: bg,
                color: textColor,
                textAlign: 'left',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: isAnswered ? 'default' : 'pointer',
                transition: 'all 0.15s ease-in-out',
                minHeight: '44px',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: isAnswered && idx === currentQ.correctIndex ? '#10b981' : isAnswered && idx === selectedOption ? '#ef4444' : '#e2e8f0',
                  color: isAnswered && (idx === currentQ.correctIndex || idx === selectedOption) ? '#ffffff' : '#475569',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {String.fromCharCode(65 + idx)}
              </span>
              <span style={{ flex: 1 }}>{optionText}</span>
              {isAnswered && idx === currentQ.correctIndex && <span>✅</span>}
              {isAnswered && idx === selectedOption && idx !== currentQ.correctIndex && <span>❌</span>}
            </button>
          );
        })}
      </div>

      {/* Explanation Box */}
      {isAnswered && (
        <div
          style={{
            padding: '0.75rem',
            borderRadius: '0.5rem',
            backgroundColor: selectedOption === currentQ.correctIndex ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${selectedOption === currentQ.correctIndex ? '#bbf7d0' : '#fde68a'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: selectedOption === currentQ.correctIndex ? '#15803d' : '#b45309' }}>
            {selectedOption === currentQ.correctIndex ? `🎉 ${UI_TEXT.correct[language]}` : `💡 ${UI_TEXT.incorrect[language]}`}
          </div>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#334155', lineHeight: 1.45 }}>
            {currentQ.explanation[language]}
          </p>
        </div>
      )}

      {/* Action Footer */}
      {isAnswered && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
          <Button
            variant="primary"
            size="md"
            onClick={handleNext}
            style={{ minHeight: '44px', minWidth: '120px' }}
          >
            {currentIndex + 1 < questions.length ? `👉 ${UI_TEXT.next[language]}` : `🏁 ${UI_TEXT.finish[language]}`}
          </Button>
        </div>
      )}
    </div>
  );
}
