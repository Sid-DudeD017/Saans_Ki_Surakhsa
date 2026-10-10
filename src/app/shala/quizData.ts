// Student Environmental Awareness Quiz for Saans Ki Suraksha (P2)
// 5 engaging questions on air quality, health protection, and pollution mitigation.
// Fully translated across Punjabi (pa), Hindi (hi), and English (en).

import type { Language } from './airQuality';

export interface QuizQuestion {
  id: string;
  question: Record<Language, string>;
  options: Record<Language, string[]>;
  correctIndex: number;
  explanation: Record<Language, string>;
  icon: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1-pm25',
    icon: '🔬',
    question: {
      pa: 'PM2.5 ਕਣਾਂ ਨੂੰ ਸਭ ਤੋਂ ਵੱਧ ਖ਼ਤਰਨਾਕ ਕਿਉਂ ਮੰਨਿਆ ਜਾਂਦਾ ਹੈ?',
      hi: 'PM2.5 कणों को सबसे ख़तरनाक क्यों माना जाता है?',
      en: 'Why are PM2.5 particles considered the most dangerous?',
    },
    options: {
      pa: [
        'ਇਹ ਸਿਰਫ਼ ਬੱਦਲ ਬਣਾਉਂਦੇ ਹਨ',
        'ਇਹ ਬਹੁਤ ਛੋਟੇ ਹੁੰਦੇ ਹਨ ਅਤੇ ਫੇਫੜਿਆਂ ਤੇ ਖੂਨ ਵਿੱਚ ਜਾ ਸਕਦੇ ਹਨ',
        'ਇਹ ਪਾਣੀ ਨੂੰ ਮਿੱਠਾ ਬਣਾਉਂਦੇ ਹਨ',
        'ਇਹ ਸਿਰਫ਼ ਰਾਤ ਨੂੰ ਹੀ ਆਉਂਦੇ ਹਨ',
      ],
      hi: [
        'ये केवल बादल बनाते हैं',
        'ये बहुत सूक्ष्म होते हैं और फेफड़ों व रक्त में पहुँच सकते हैं',
        'ये पानी को मीठा बनाते हैं',
        'ये केवल रात में आते हैं',
      ],
      en: [
        'They only form clouds',
        'They are microscopic and penetrate deep into lungs and bloodstream',
        'They make water sweet',
        'They only appear at night',
      ],
    },
    correctIndex: 1,
    explanation: {
      pa: 'PM2.5 ਵਾਲਾਂ ਨਾਲੋਂ 30 ਗੁਣਾ ਪਤਲੇ ਹੁੰਦੇ ਹਨ। ਇਹ ਫੇਫੜਿਆਂ ਦੇ ਡੂੰਘੇ ਹਿੱਸੇ ਵਿੱਚ ਜਾ ਕੇ ਖੂਨ ਰਾਹੀਂ ਸਰੀਰ ਵਿੱਚ ਫੈਲ ਸਕਦੇ ਹਨ।',
      hi: 'PM2.5 बाल से 30 गुना पतले होते हैं। वे फेफड़ों की गहराई तक जाकर रक्त में मिल सकते हैं।',
      en: 'PM2.5 particles are 30 times thinner than human hair, allowing them to penetrate deep into alveoli and enter the bloodstream.',
    },
  },
  {
    id: 'q2-mask',
    icon: '😷',
    question: {
      pa: 'ਧੂੰਏਂ ਅਤੇ ਪ੍ਰਦੂਸ਼ਣ ਤੋਂ ਬਚਣ ਲਈ ਕਿਹੜਾ ਮਾਸਕ ਸਭ ਤੋਂ ਵਧੀਆ ਕੰਮ ਕਰਦਾ ਹੈ?',
      hi: 'धुएँ और वायु प्रदूषण से बचने के लिए कौन सा मास्क सबसे प्रभावी है?',
      en: 'Which mask is most effective against toxic smoke and air pollution?',
    },
    options: {
      pa: [
        'ਕੋਈ ਵੀ ਸੂਤੀ ਰੁਮਾਲ ਜਾਂ ਗਮਛਾ',
        'ਢਿੱਲਾ ਸਰਜੀਕਲ ਮਾਸਕ',
        'ਚੰਗੀ ਤਰ੍ਹਾਂ ਫਿੱਟ N95 / FFP2 ਮਾਸਕ',
        'ਮਾਸਕ ਦੀ ਕੋਈ ਲੋੜ ਨਹੀਂ',
      ],
      hi: [
        'कोई भी सूती रुमाल या गमछा',
        'ढीला सर्जिकल मास्क',
        'अच्छी तरह फ़िट N95 / FFP2 मास्क',
        'मास्क की ज़रूरत नहीं होती',
      ],
      en: [
        'A simple cotton handkerchief',
        'A loose surgical mask',
        'A tight-fitting N95 / FFP2 respirator mask',
        'No mask is needed',
      ],
    },
    correctIndex: 2,
    explanation: {
      pa: 'N95 ਮਾਸਕ 95% ਤੋਂ ਵੱਧ ਹਾਨੀਕਾਰਕ ਬਾਰੀਕ ਕਣਾਂ (PM2.5) ਨੂੰ ਰੋਕਦਾ ਹੈ। ਕੱਪੜੇ ਦੇ ਰੁਮਾਲ ਵਿੱਚੋਂ ਬਾਰੀਕ ਧੂੰਆਂ ਲੰਘ ਜਾਂਦਾ ਹੈ।',
      hi: 'N95 मास्क 95% से अधिक बारीक कणों (PM2.5) को फ़िल्टर करता है। कपड़े के रुमाल से बारीक धुआँ आसानी से निकल जाता है।',
      en: 'N95 respirators filter out at least 95% of fine particulate matter, while simple cloths let microscopic soot pass right through.',
    },
  },
  {
    id: 'q3-severe-aqi',
    icon: '🏫',
    question: {
      pa: 'ਜਦੋਂ AQI 400 ਤੋਂ ਵੱਧ (Severe) ਹੋਵੇ, ਤਾਂ ਸਕੂਲ ਵਿੱਚ ਕੀ ਕਰਨਾ ਚਾਹੀਦਾ ਹੈ?',
      hi: 'जब AQI 400 से ऊपर (Severe) हो, तो स्कूल में क्या करना चाहिए?',
      en: 'When AQI is above 400 (Severe), what should be done at school?',
    },
    options: {
      pa: [
        'ਖੁੱਲ੍ਹੇ ਮੈਦਾਨ ਵਿੱਚ ਤੇਜ਼ ਦੌੜ ਲਗਾਓ',
        'ਬਾਹਰ ਖੇਡਾਂ ਬੰਦ ਕਰਕੇ ਅੰਦਰ ਬੈਠੋ ਤੇ ਖਿੜਕੀਆਂ ਬੰਦ ਰੱਖੋ',
        'ਸਾਰੇ ਕੂੜੇ ਨੂੰ ਇਕੱਠਾ ਕਰਕੇ ਅੱਗ ਲਗਾਓ',
        'ਪੱਖੇ ਤੇਜ਼ ਚਲਾ ਕੇ ਬਾਹਰ ਖੇਡੋ',
      ],
      hi: [
        'खुले मैदान में तेज़ दौड़ लगाएँ',
        'बाहरी खेल बंद करके अंदर रहें और खिड़कियाँ बंद रखें',
        'सारे कचरे को इकट्ठा करके जलाएँ',
        'पंखे तेज़ चलाकर बाहर खेलें',
      ],
      en: [
        'Run fast sprints in the open field',
        'Shift activities indoors, cancel outdoor sports, and keep windows shut',
        'Burn dried leaves and school garbage',
        'Play outside with fans on',
      ],
    },
    correctIndex: 1,
    explanation: {
      pa: 'ਕਸਰਤ ਕਰਨ ਵੇਲੇ ਅਸੀਂ ਤੇਜ਼ ਸਾਹ ਲੈਂਦੇ ਹਾਂ ਜਿਸ ਨਾਲ ਪ੍ਰਦੂਸ਼ਣ ਸਿੱਧਾ ਫੇਫੜਿਆਂ ਵਿੱਚ ਜਾਂਦਾ ਹੈ। ਇਸ ਲਈ Severe AQI ਦੌਰਾਨ ਅੰਦਰ ਰਹਿਣਾ ਜ਼ਰੂਰੀ ਹੈ।',
      hi: 'व्यायाम के दौरान हम गहरी साँस लेते हैं जिससे ज़हरीला धुआँ फेफड़ों में भर जाता है। Severe AQI में इनडोर रहना ही सुरक्षित है।',
      en: 'Strenuous activity increases breathing rates by up to 5x. Moving indoors and keeping windows closed protects developing lungs.',
    },
  },
  {
    id: 'q4-clean-air-action',
    icon: '🌱',
    question: {
      pa: 'ਆਪਣੇ ਪਿੰਡ ਜਾਂ ਸ਼ਹਿਰ ਦੀ ਹਵਾ ਨੂੰ ਸਾਫ਼ ਰੱਖਣ ਲਈ ਵਿਦਿਆਰਥੀ ਕੀ ਮਦਦ ਕਰ ਸਕਦੇ ਹਨ?',
      hi: 'अपने गाँव या शहर की हवा को स्वच्छ रखने के लिए विद्यार्थी क्या कर सकते हैं?',
      en: 'How can students help keep the air clean in their village or town?',
    },
    options: {
      pa: [
        'ਸੁੱਕੇ ਪੱਤੇ ਅਤੇ ਪਲਾਸਟਿਕ ਨੂੰ ਖੁੱਲ੍ਹੇ ਵਿੱਚ ਸਾੜਨਾ',
        'ਰੁੱਖ ਲਗਾਉਣਾ ਅਤੇ ਕੂੜਾ ਜਾਂ ਪਰਾਲੀ ਸਾੜਨ ਦੀ ਬਜਾਏ ਰਿਪੋਰਟ ਕਰਨਾ',
        'ਹਰ ਛੋਟੀ ਦੂਰੀ ਲਈ ਮੋਟਰਸਾਈਕਲ ਚਲਾਉਣਾ',
        'ਪਟਾਕੇ ਚਲਾਉਣਾ',
      ],
      hi: [
        'सूखे पत्ते और प्लास्टिक खुले में जलाना',
        'पेड़ लगाना और कचरा/पराली जलाने की जगह रिपोर्ट करना',
        'हर छोटी दूरी के लिए मोटरसाइकिल चलाना',
        'पटाखे फोड़ना',
      ],
      en: [
        'Burn dry leaves and plastic in the open',
        'Plant native trees and report illegal open burning/stubble fires',
        'Ride motorbikes for short distances',
        'Burst firecrackers',
      ],
    },
    correctIndex: 1,
    explanation: {
      pa: 'ਰੁੱਖ ਹਵਾ ਵਿੱਚੋਂ ਧੂੜ ਛਾਣਦੇ ਹਨ। ਕੂੜਾ ਸਾੜਨ ਦੀ ਬਜਾਏ ਕੰਪੋਸਟ ਬਣਾਉਣਾ ਜਾਂ Saans ਐਪ ਤੇ ਰਿਪੋਰਟ ਕਰਨਾ ਹਵਾ ਨੂੰ ਸੁਰੱਖਿਅਤ ਰੱਖਦਾ ਹੈ।',
      hi: 'पेड़ हवा से धूल-धुआँ छानते हैं। पत्तों की खाद बनाना और जलते कचरे की रिपोर्ट करना प्रदूषण रोकता है।',
      en: 'Trees filter particulates, and reporting open burning through Saans helps authorities stop fires and clean the air.',
    },
  },
  {
    id: 'q5-indoor-air',
    icon: '🏠',
    question: {
      pa: 'ਘਰ ਦੇ ਅੰਦਰ ਦੀ ਹਵਾ ਨੂੰ ਸਾਫ਼ ਰੱਖਣ ਲਈ ਕੀ ਸਭ ਤੋਂ ਫਾਇਦੇਮੰਦ ਹੈ?',
      hi: 'घर के अंदर की हवा को साफ़ रखने के लिए सबसे मददगार क्या है?',
      en: 'What helps keep indoor air cleanest during smog episodes?',
    },
    options: {
      pa: [
        'ਅੰਦਰ ਧੂਪ-ਬੱਤੀ ਅਤੇ ਅਗਰਬੱਤੀ ਬਹੁਤ ਜ਼ਿਆਦਾ ਜਲਾਉਣਾ',
        'ਗਿੱਲੇ ਕੱਪੜੇ ਨਾਲ ਪੋਚਾ ਲਗਾਉਣਾ ਅਤੇ HEPA ਪਿਊਰੀਫਾਇਰ ਚਲਾਉਣਾ',
        'ਸਾਰਾ ਦਿਨ ਖਿੜਕੀਆਂ ਖੁੱਲ੍ਹੀਆਂ ਰੱਖਣਾ ਜਦੋਂ ਬਾਹਰ ਧੂੰਆਂ ਹੋਵੇ',
        'ਕਮਰੇ ਵਿੱਚ ਲੱਕੜ ਜਲਾ ਕੇ ਸੇਕਣਾ',
      ],
      hi: [
        'अंदर बहुत ज़्यादा अगरबत्ती और धूप जलाना',
        'गीले कपड़े से पोछा लगाना और HEPA प्यूरीफायर का उपयोग करना',
        'बाहर धुआँ होने पर भी खिड़कियाँ खुली रखना',
        'कमरे में लकड़ी जलाकर धुआँ करना',
      ],
      en: [
        'Burning excessive incense sticks inside',
        'Wet mopping dust and using a HEPA air purifier with windows closed',
        'Keeping windows open during dense smog',
        'Burning firewood inside closed rooms',
      ],
    },
    correctIndex: 1,
    explanation: {
      pa: 'ਸੁੱਕੀ ਝਾੜੂ ਨਾਲ ਧੂੜ ਉੱਡਦੀ ਹੈ, ਜਦਕਿ ਗਿੱਲੇ ਪੋਚੇ ਨਾਲ ਕਣ ਜੰਮ ਜਾਂਦੇ ਹਨ। HEPA ਫਿਲਟਰ ਬੰਦ ਕਮਰੇ ਵਿੱਚੋਂ 99% ਧੂੰਆਂ ਸਾਫ਼ ਕਰਦਾ ਹੈ।',
      hi: 'सूखे झाड़ू से धूल हवा में उड़ती है, जबकि गीले पोछे से बैठ जाती है। HEPA फ़िल्टर बंद कमरे से 99% धुआँ साफ़ करता है।',
      en: 'Wet mopping captures settled dust without kicking it into the air, while HEPA filters trap 99.97% of airborne soot in sealed rooms.',
    },
  },
];
