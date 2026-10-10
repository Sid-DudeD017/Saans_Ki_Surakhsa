// Student Environmental Awareness Quiz for Saans Ki Suraksha (P2)
// Comprehensive question bank with dynamic randomization and shuffling.
// Fully translated across Punjabi (pa), Hindi (hi), and English (en).

import type { Language } from './airQuality';

export interface QuizQuestion {
  id: string;
  icon: string;
  question: Record<Language, string>;
  options: Record<Language, string[]>;
  correctIndex: number;
  explanation: Record<Language, string>;
}

export const QUIZ_QUESTION_BANK: QuizQuestion[] = [
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
  {
    id: 'q6-stubble-burning',
    icon: '🌾',
    question: {
      pa: 'ਪਰਾਲੀ ਜਾਂ ਖੇਤਾਂ ਦੀ ਰਹਿੰਦ-ਖੂੰਹਦ ਸਾੜਨ ਨਾਲ ਹਵਾ ਵਿੱਚ ਕਿਹੜਾ ਪ੍ਰਦੂਸ਼ਣ ਫੈਲਦਾ ਹੈ?',
      hi: 'पराली या खेतों के अवशेष जलाने से हवा में कौन सा प्रदूषण फैलता है?',
      en: 'What pollution is released into the air when crop stubble is burnt?',
    },
    options: {
      pa: [
        'ਸ਼ੁੱਧ ਆਕਸੀਜਨ',
        'ਭਾਰੀ ਮਾਤਰਾ ਵਿੱਚ PM2.5, ਕਾਰਬਨ ਮੋਨੋਆਕਸਾਈਡ ਅਤੇ ਜ਼ਹਿਰੀਲਾ ਧੂੰਆਂ',
        'ਠੰਢੀ ਤਾਜ਼ੀ ਹਵਾ',
        'ਕੇਵਲ ਪਾਣੀ ਦੀ ਭਾਫ਼',
      ],
      hi: [
        'शुद्ध ऑक्सीजन',
        'भारी मात्रा में PM2.5, कार्बन मोनोऑक्साइड और ज़हरीला धुआँ',
        'ठंडी ताज़ा हवा',
        'केवल जलवाष्प',
      ],
      en: [
        'Pure oxygen',
        'Dense PM2.5 soot, carbon monoxide, and toxic smoke',
        'Crisp fresh breeze',
        'Water vapour only',
      ],
    },
    correctIndex: 1,
    explanation: {
      pa: 'ਪਰਾਲੀ ਸਾੜਨ ਨਾਲ PM2.5 ਅਤੇ CO ਦਾ ਸੰਘਣਾ ਧੂੰਆਂ ਨਿਕਲਦਾ ਹੈ ਜੋ ਪਿੰਡਾਂ ਅਤੇ ਸ਼ਹਿਰਾਂ ਨੂੰ ਕਈ ਦਿਨਾਂ ਤੱਕ ਧੁੰਦੂਕਾਰ (smog) ਵਿੱਚ ਲਪੇਟ ਲੈਂਦਾ ਹੈ।',
      hi: 'पराली जलाने से निकलने वाला PM2.5 और CO का गाढ़ा धुआँ पूरे क्षेत्र में ज़हरीला स्मॉग बना देता है।',
      en: 'Biomass burning emits high concentrations of fine soot (PM2.5) and CO, blanketing rural and urban areas in dangerous smog.',
    },
  },
  {
    id: 'q7-morning-fog',
    icon: '🌫️',
    question: {
      pa: 'ਸਰਦੀਆਂ ਵਿੱਚ ਸਵੇਰੇ-ਸਵੇਰੇ ਜ਼ਿਆਦਾ ਪ੍ਰਦੂਸ਼ਣ (Smog) ਕਿਉਂ ਮਹਿਸੂਸ ਹੁੰਦਾ ਹੈ?',
      hi: 'सर्दियों में सुबह-सुबह वायु प्रदूषण (Smog) अधिक क्यों रहता है?',
      en: 'Why is air pollution (smog) often worst in the early morning during winter?',
    },
    options: {
      pa: [
        'ਕਿਉਂਕਿ ਠੰਢੀ ਹਵਾ ਭਾਰੀ ਹੋਣ ਕਰਕੇ ਧੂੰਏਂ ਨੂੰ ਜ਼ਮੀਨ ਨੇੜੇ ਕੈਦ ਕਰ ਲੈਂਦੀ ਹੈ (Temperature Inversion)',
        'ਸੂਰਜ ਧੂੰਏਂ ਨੂੰ ਖਿੱਚਦਾ ਹੈ',
        'ਕਿਉਂਕਿ ਰੁੱਖ ਰਾਤ ਨੂੰ ਧੂੰਆਂ ਬਣਾਉਂਦੇ ਹਨ',
        'ਕਿਉਂਕਿ ਸਵੇਰੇ ਹਵਾ ਜ਼ਿਆਦਾ ਤੇਜ਼ ਚੱਲਦੀ ਹੈ',
      ],
      hi: [
        'क्योंकि ठंडी हवा भारी होने से धुएँ को ज़मीन के पास रोक लेती है (तापमान व्युत्क्रमण)',
        'सूर्य धुएँ को खींचता है',
        'क्योंकि पेड़ रात में धुआँ बनाते हैं',
        'क्योंकि सुबह हवा बहुत तेज़ बहती है',
      ],
      en: [
        'Cold, dense air traps smoke and pollutants close to the ground (Temperature Inversion)',
        'The sun pulls pollution downward',
        'Trees emit smoke during the night',
        'Winds always blow strongest at sunrise',
      ],
    },
    correctIndex: 0,
    explanation: {
      pa: 'ਸਰਦੀਆਂ ਵਿੱਚ ਠੰਢੀ ਹਵਾ ਜ਼ਮੀਨ ਨੇੜੇ ਜੰਮ ਜਾਂਦੀ ਹੈ ਅਤੇ ਧੂੰਏਂ ਨੂੰ ਉੱਪਰ ਨਹੀਂ ਜਾਣ ਦਿੰਦੀ। ਦੁਪਹਿਰ ਨੂੰ ਧੁੱਪ ਨਿਕਲਣ ਤੇ ਹਵਾ ਸਾਫ਼ ਹੋਣੀ ਸ਼ੁਰੂ ਹੁੰਦੀ ਹੈ।',
      hi: 'सर्दियों में तापमान व्युत्क्रमण के कारण ठंडी हवा की परत धुएँ को ज़मीन के निकट दबाकर रखती है, जो दोपहर की धूप के बाद ही छँटती है।',
      en: 'Thermal inversion traps cold stagnant air and pollutants at surface level. Pollutant dispersion improves once midday sun warms the ground.',
    },
  },
  {
    id: 'q8-asthma-symptoms',
    icon: '🫁',
    question: {
      pa: 'ਜੇ ਪ੍ਰਦੂਸ਼ਣ ਵਾਲੇ ਦਿਨ ਕਿਸੇ ਵਿਦਿਆਰਥੀ ਨੂੰ ਸਾਹ ਲੈਣ ਵਿੱਚ ਔਖ ਹੋਵੇ ਤਾਂ ਤੁਰੰਤ ਕੀ ਕਰਨਾ ਚਾਹੀਦਾ ਹੈ?',
      hi: 'यदि प्रदूषण वाले दिन किसी छात्र को साँस लेने में तकलीफ़ हो तो तुरंत क्या करना चाहिए?',
      en: 'If a student has trouble breathing on a high-pollution day, what is the immediate step?',
    },
    options: {
      pa: [
        'ਉਸਨੂੰ ਮੈਦਾਨ ਵਿੱਚ ਦੌੜਨ ਲਈ ਕਹੋ',
        'ਉਸਨੂੰ ਅੰਦਰ ਸ਼ਾਂਤ ਕਮਰੇ ਵਿੱਚ ਬਿਠਾਓ, ਪਾਣੀ ਪਿਲਾਓ ਅਤੇ ਇਨਹੇਲਰ/ਅਧਿਆਪਕ ਨੂੰ ਸੂਚਿਤ ਕਰੋ',
        'ਉਸਨੂੰ ਸਿੱਧਾ ਧੂੰਏਂ ਵਿੱਚ ਖੜ੍ਹਾ ਕਰੋ',
        'ਕੁਝ ਨਾ ਕਰੋ, ਆਪਣੇ ਆਪ ਠੀਕ ਹੋ ਜਾਵੇਗਾ',
      ],
      hi: [
        'उसे मैदान में दौड़ने को कहें',
        'उसे शांत इनडोर कमरे में बैठाएँ, पानी दें और इनहेलर/अध्यापक को सूचित करें',
        'उसे सीधे धुएँ में खड़ा करें',
        'कुछ न करें, अपने आप ठीक हो जाएगा',
      ],
      en: [
        'Ask them to run sprints outside',
        'Bring them indoors into a calm room, provide water, and notify the teacher/use their prescribed inhaler',
        'Have them stand outside in the smoke',
        'Do nothing and wait',
      ],
    },
    correctIndex: 1,
    explanation: {
      pa: 'ਧੂੰਏਂ ਨਾਲ ਸਾਹ ਨਾਲੀਆਂ ਸੁੰਗੜ ਸਕਦੀਆਂ ਹਨ। ਤੁਰੰਤ ਅੰਦਰ ਆਰਾਮ ਕਰਨਾ ਅਤੇ ਲੋੜ ਪੈਣ ਤੇ ਇਨਹੇਲਰ ਲੈਣਾ ਜਾਨ ਬਚਾਉਂਦਾ ਹੈ।',
      hi: 'प्रदूषण से वायुमार्ग में सूजन आ सकती है। तुरंत इनडोर विश्राम, पानी और आवश्यक इनहेलर देना बेहद ज़रूरी है।',
      en: 'Pollution triggers acute bronchospasm. Resting indoors away from smoke and using prescribed relief inhalers immediately relieves airway distress.',
    },
  },
  {
    id: 'q9-plants-purification',
    icon: '🪴',
    question: {
      pa: 'ਕਿਹੜੇ ਪੌਦੇ ਕਮਰੇ ਜਾਂ ਸਕੂਲ ਦੇ ਵਰਾਂਡੇ ਦੀ ਹਵਾ ਦੀ ਗੁਣਵੱਤਾ ਸੁਧਾਰਨ ਵਿੱਚ ਮਦਦ ਕਰਦੇ ਹਨ?',
      hi: 'कौन से पौधे कमरे या स्कूल के बरामदे की हवा को बेहतर बनाने में मदद करते हैं?',
      en: 'Which indoor/patio plants are known to help filter toxins from the air?',
    },
    options: {
      pa: [
        'ਪਲਾਸਟਿਕ ਦੇ ਨਕਲੀ ਫੁੱਲ',
        'ਸਨੇਕ ਪਲਾਂਟ (Snake Plant), ਮਨੀ ਪਲਾਂਟ ਅਤੇ ਐਲੋਵੇਰਾ',
        'ਕੰਡਿਆਲੇ ਜੰਗਲੀ ਝਾੜ',
        'ਸੁੱਕੀਆਂ ਲੱਕੜਾਂ',
      ],
      hi: [
        'प्लास्टिक के नकली फूल',
        'स्नेक प्लांट (Snake Plant), मनी प्लांट और एलोवेरा',
        'कांटेदार जंगली झाड़ियाँ',
        'सूखी लकड़ियाँ',
      ],
      en: [
        'Artificial plastic flowers',
        'Snake Plant, Money Plant, and Aloe Vera',
        'Thorny dead shrubs',
        'Piles of dry wood',
      ],
    },
    correctIndex: 1,
    explanation: {
      pa: 'ਸਨੇਕ ਪਲਾਂਟ ਅਤੇ ਐਲੋਵੇਰਾ ਰਾਤ ਵੇਲੇ ਵੀ ਆਕਸੀਜਨ ਛੱਡਦੇ ਹਨ ਅਤੇ ਹਵਾ ਵਿੱਚੋਂ ਜ਼ਹਿਰੀਲੇ ਕੈਮੀਕਲ (VOCs) ਸੋਖ ਲੈਂਦੇ ਹਨ।',
      hi: 'स्नेक प्लांट और एलोवेरा रात में भी ऑक्सीजन छोड़ते हैं और हवा से हानिकारक रासायनिक वाष्प अवशोषित करते हैं।',
      en: 'Plants like Snake Plant, Areca Palm, and Spider Plant absorb volatile toxins and release oxygen, improving indoor ambient air quality.',
    },
  },
  {
    id: 'q10-clean-travel',
    icon: '🚲',
    question: {
      pa: 'ਸਕੂਲ ਜਾਣ ਲਈ ਸਭ ਤੋਂ ਵਾਤਾਵਰਣ-ਅਨੁਕੂਲ (Eco-friendly) ਤਰੀਕਾ ਕਿਹੜਾ ਹੈ?',
      hi: 'स्कूल आने-जाने के लिए सबसे पर्यावरण-अनुकूल (Eco-friendly) तरीका कौन सा है?',
      en: 'What is the most eco-friendly way for students to travel to school?',
    },
    options: {
      pa: [
        'ਹਰ ਬੱਚੇ ਲਈ ਵੱਖਰੀ ਕਾਰ ਜਾਂ ਡੀਜ਼ਲ ਗੱਡੀ',
        'ਪੈਦਲ ਚੱਲਣਾ, ਸਾਈਕਲ ਚਲਾਉਣਾ ਜਾਂ ਸਕੂਲ ਬੱਸ/ਸਾਂਝਾ ਵਾਹਨ (Carpooling)',
        'ਪੁਰਾਣਾ ਧੂੰਆਂ ਛੱਡਣ ਵਾਲਾ ਸਕੂਟਰ',
        'ਤੇਜ਼ ਰੇਸਿੰਗ ਵਾਲੀ ਬਾਈਕ',
      ],
      hi: [
        'हर बच्चे के लिए अलग कार या डीज़ल वाहन',
        'पैदल चलना, साइकिल चलाना या स्कूल बस/साझा वाहन (Carpooling)',
        'पुराना धुआँ छोड़ने वाला स्कूटर',
        'तेज़ गति वाली भारी बाइक',
      ],
      en: [
        'A separate private diesel car for every individual student',
        'Walking, cycling, or shared school bus / carpooling',
        'An old polluting two-stroke scooter',
        'High-emission motorbikes',
      ],
    },
    correctIndex: 1,
    explanation: {
      pa: 'ਸਾਈਕਲ ਚਲਾਉਣ ਜਾਂ ਬੱਸ ਸਾਂਝੀ ਕਰਨ ਨਾਲ ਸੜਕਾਂ ਤੇ ਗੱਡੀਆਂ ਦੀ ਗਿਣਤੀ ਘਟਦੀ ਹੈ ਅਤੇ ਧੂੰਆਂ ਨਹੀਂ ਨਿਕਲਦਾ।',
      hi: 'पैदल चलने, साइकिल और स्कूल बस से सड़कों पर वाहनों का धुआँ बहुत कम हो जाता है।',
      en: 'Active transport (cycling/walking) and shared school buses drastically cut vehicular exhaust emissions and traffic congestion around campuses.',
    },
  },
];

// Compatibility export
export const QUIZ_QUESTIONS = QUIZ_QUESTION_BANK;

/**
 * Fisher-Yates shuffle that produces a freshly randomized set of N questions,
 * and also shuffles each question's 4 options across pa, hi, and en synchronously
 * so the correct answer isn't always in the same slot.
 */
export function getDynamicQuiz(count = 5): QuizQuestion[] {
  // 1. Pick `count` distinct questions randomly from the bank
  const shuffledBank = [...QUIZ_QUESTION_BANK];
  for (let i = shuffledBank.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledBank[i], shuffledBank[j]] = [shuffledBank[j], shuffledBank[i]];
  }
  const picked = shuffledBank.slice(0, Math.min(count, shuffledBank.length));

  // 2. Shuffle the 4 choices for each chosen question
  return picked.map((q) => {
    const indices = [0, 1, 2, 3];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const newCorrectIndex = indices.indexOf(q.correctIndex);
    const newOptions: Record<Language, string[]> = {
      pa: indices.map((idx) => q.options.pa[idx]),
      hi: indices.map((idx) => q.options.hi[idx]),
      en: indices.map((idx) => q.options.en[idx]),
    };

    return {
      ...q,
      options: newOptions,
      correctIndex: newCorrectIndex,
    };
  });
}
