// Air Buddy's moods and the gas cards (P2): what each CPCB category and pollutant means to a child, in
// Punjabi, Hindi and English. The readings come in the shape of P3's GET /v1/aqi (AqiResponse).
import type { components } from '../../../packages/contracts/types';
import { getCategoryCode } from '../../../packages/aqi';

export type AqiResponse = components['schemas']['AqiResponse'] & {
  station_name?: string;
  city?: string;
  distance_km?: number;
};
export type ForecastResponse = components['schemas']['ForecastResponse'];
export type ForecastHour = components['schemas']['ForecastHour'];
export type Category = components['schemas']['AqiCategory'];
export type Pollutant = components['schemas']['Pollutant'];
export type Language = 'pa' | 'hi' | 'en';
type Words = Record<Language, string>;

export const CATEGORIES: Category[] = ['good', 'satisfactory', 'moderate', 'poor', 'very_poor', 'severe'];

/** CPCB's colour for each category, and a light tint of it for backgrounds. */
export const CATEGORY_COLOURS: Record<Category, { fill: string; tint: string; ink: string }> = {
  good: { fill: '#00b050', tint: '#e6f7ed', ink: '#14532d' },
  satisfactory: { fill: '#92d050', tint: '#f1f9e8', ink: '#3f6212' },
  moderate: { fill: '#ffff00', tint: '#fefce0', ink: '#713f12' },
  poor: { fill: '#ff9900', tint: '#fff3e0', ink: '#7c2d12' },
  very_poor: { fill: '#ff0000', tint: '#ffe8e8', ink: '#7f1d1d' },
  severe: { fill: '#c00000', tint: '#f9e0e0', ink: '#5c0000' },
};

export const CATEGORY_NAMES: Record<Category, Words> = {
  good: { pa: 'ਚੰਗੀ', hi: 'अच्छी', en: 'Good' },
  satisfactory: { pa: 'ਤਸੱਲੀਬਖ਼ਸ਼', hi: 'संतोषजनक', en: 'Satisfactory' },
  moderate: { pa: 'ਦਰਮਿਆਨੀ', hi: 'मध्यम', en: 'Moderate' },
  poor: { pa: 'ਖ਼ਰਾਬ', hi: 'खराब', en: 'Poor' },
  very_poor: { pa: 'ਬਹੁਤ ਖ਼ਰਾਬ', hi: 'बहुत खराब', en: 'Very poor' },
  severe: { pa: 'ਗੰਭੀਰ', hi: 'गंभीर', en: 'Severe' },
};

export type Mood = 'happy' | 'okay' | 'bothered' | 'worried' | 'unwell' | 'masked';

/** Air Buddy has one mood per category, and says one thing a child can do about it. */
export const BUDDY: Record<Category, { mood: Mood; name: Words; says: Words }> = {
  good: {
    mood: 'happy',
    name: { pa: 'ਖ਼ੁਸ਼', hi: 'खुश', en: 'Happy' },
    says: {
      pa: 'ਅੱਜ ਹਵਾ ਸਾਫ਼ ਹੈ! ਬਾਹਰ ਦੌੜੋ, ਟੱਪੋ ਅਤੇ ਖੇਡੋ।',
      hi: 'आज हवा साफ़ है! बाहर दौड़ो, कूदो और खेलो।',
      en: 'The air is clean today! Run, jump and play outside.',
    },
  },
  satisfactory: {
    mood: 'okay',
    name: { pa: 'ਠੀਕ', hi: 'ठीक', en: 'Okay' },
    says: {
      pa: 'ਹਵਾ ਠੀਕ ਹੈ। ਬਾਹਰ ਖੇਡੋ, ਅਤੇ ਖੰਘ ਆਵੇ ਤਾਂ ਆਰਾਮ ਕਰੋ।',
      hi: 'हवा ठीक है। बाहर खेलो, और खाँसी आए तो आराम करो।',
      en: 'The air is okay. Play outside, and rest if you start to cough.',
    },
  },
  moderate: {
    mood: 'bothered',
    name: { pa: 'ਥੋੜ੍ਹਾ ਪਰੇਸ਼ਾਨ', hi: 'थोड़ा परेशान', en: 'A bit bothered' },
    says: {
      pa: 'ਹਵਾ ਥੋੜ੍ਹੀ ਧੂੜ ਵਾਲੀ ਹੈ। ਆਰਾਮ ਨਾਲ ਖੇਡੋ, ਅਤੇ ਦਮਾ ਹੋਵੇ ਤਾਂ ਇਨਹੇਲਰ ਕੋਲ ਰੱਖੋ।',
      hi: 'हवा थोड़ी धूल भरी है। आराम से खेलो, और दमा हो तो इनहेलर पास रखो।',
      en: 'The air is a bit dusty. Play gently, and keep your inhaler close if you have asthma.',
    },
  },
  poor: {
    mood: 'worried',
    name: { pa: 'ਫ਼ਿਕਰਮੰਦ', hi: 'चिंतित', en: 'Worried' },
    says: {
      pa: 'ਅੱਜ ਹਵਾ ਗੰਦੀ ਹੈ। ਆਓ ਅੰਦਰ ਖੇਡੀਏ।',
      hi: 'आज हवा गंदी है। चलो अंदर खेलें।',
      en: "The air is dirty today. Let's play inside.",
    },
  },
  very_poor: {
    mood: 'unwell',
    name: { pa: 'ਬਿਮਾਰ', hi: 'बीमार', en: 'Unwell' },
    says: {
      pa: 'ਹਵਾ ਬਹੁਤ ਗੰਦੀ ਹੈ। ਅੰਦਰ ਰਹੋ ਅਤੇ ਖਿੜਕੀਆਂ ਬੰਦ ਰੱਖੋ।',
      hi: 'हवा बहुत गंदी है। अंदर रहो और खिड़कियाँ बंद रखो।',
      en: 'The air is very dirty. Stay inside and keep the windows shut.',
    },
  },
  severe: {
    mood: 'masked',
    name: { pa: 'ਮਾਸਕ ਵਿੱਚ', hi: 'मास्क में', en: 'Masked up' },
    says: {
      pa: 'ਅੱਜ ਹਵਾ ਖ਼ਤਰਨਾਕ ਹੈ। ਅੰਦਰ ਰਹੋ, ਅਤੇ ਬਾਹਰ ਜਾਣਾ ਪਵੇ ਤਾਂ ਚੰਗਾ ਮਾਸਕ ਪਾਓ।',
      hi: 'आज हवा खतरनाक है। घर के अंदर रहो, और बाहर जाना पड़े तो अच्छा मास्क पहनो।',
      en: 'The air is dangerous today. Stay indoors, and wear a good mask if you must go out.',
    },
  },
};

/** The six pollutants every child gets a card for; NH₃ and lead get one only when they're measured. */
export const CARD_POLLUTANTS: Pollutant[] = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3'];

export const GASES: Record<Pollutant, { symbol: string; icon: string; what: Words; from: Words; health: Words }> = {
  pm25: {
    symbol: 'PM2.5',
    icon: '💨',
    what: {
      pa: 'ਧੂੰਏਂ ਅਤੇ ਧੂੜ ਦੇ ਬਹੁਤ ਛੋਟੇ ਕਣ, ਜੋ ਫੇਫੜਿਆਂ ਦੇ ਅੰਦਰ ਤੱਕ ਚਲੇ ਜਾਂਦੇ ਹਨ।',
      hi: 'धुएँ और धूल के बहुत छोटे कण, जो फेफड़ों के अंदर तक चले जाते हैं।',
      en: 'Tiny bits of smoke and dust, so small they go deep into your lungs.',
    },
    from: {
      pa: 'ਪਰਾਲੀ ਅਤੇ ਕੂੜਾ ਸਾੜਨਾ, ਗੱਡੀਆਂ, ਅਤੇ ਚੁੱਲ੍ਹੇ ਦਾ ਧੂੰਆਂ।',
      hi: 'पराली और कचरा जलाना, गाड़ियाँ, और चूल्हे का धुआँ।',
      en: 'Burning straw and rubbish, vehicles, and smoke from stoves.',
    },
    health: {
      pa: 'ਦਮਾ (Asthma), ਬ੍ਰੋਂਕਾਈਟਿਸ, ਖੰਘ, ਅਤੇ ਫੇਫੜਿਆਂ ਤੇ ਦਿਲ ਦੀਆਂ ਬਿਮਾਰੀਆਂ।',
      hi: 'दमा (Asthma), ब्रोंकाइटिस, लगातार खाँसी, और फेफड़ों व दिल की बीमारियाँ।',
      en: 'Asthma flare-ups, bronchitis, chronic cough, and lung & heart damage.',
    },
  },
  pm10: {
    symbol: 'PM10',
    icon: '🌫️',
    what: {
      pa: 'ਧੂੜ ਅਤੇ ਬਰੀਕ ਰੇਤ, ਜੋ ਕਈ ਵਾਰ ਹਵਾ ਵਿੱਚ ਦਿਸਦੀ ਹੈ।',
      hi: 'धूल और बारीक रेत, जो कभी-कभी हवा में दिखती है।',
      en: 'Dust and grit that you can sometimes see in the air.',
    },
    from: {
      pa: 'ਧੂੜ ਵਾਲੀਆਂ ਸੜਕਾਂ, ਉਸਾਰੀ ਦਾ ਕੰਮ, ਅਤੇ ਹਵਾ ਨਾਲ ਉੱਡਦੀ ਮਿੱਟੀ।',
      hi: 'धूल भरी सड़कें, निर्माण का काम, और हवा से उड़ती मिट्टी।',
      en: 'Dusty roads, building work, and soil blown by the wind.',
    },
    health: {
      pa: 'ਅੱਖਾਂ ਅਤੇ ਗਲੇ ਵਿੱਚ ਜਲਣ, ਛਿੱਕਾਂ, ਸਾਹ ਵਿੱਚ ਘਰਘਰਾਹਟ (Wheezing), ਅਤੇ ਐਲਰਜੀ।',
      hi: 'आँखों और गले में जलन, छींकें, साँस में घरघराहट (Wheezing), और एलर्जी।',
      en: 'Eye & throat irritation, sneezing, wheezing, and respiratory allergies.',
    },
  },
  no2: {
    symbol: 'NO₂',
    icon: '🚌',
    what: {
      pa: 'ਗਰਮ ਇੰਜਣਾਂ ਵਿੱਚੋਂ ਨਿਕਲਦੀ ਗੈਸ, ਜੋ ਗਲੇ ਅਤੇ ਫੇਫੜਿਆਂ ਵਿੱਚ ਜਲਣ ਕਰਦੀ ਹੈ।',
      hi: 'गर्म इंजनों से निकलने वाली गैस, जो गले और फेफड़ों में जलन करती है।',
      en: 'A gas from hot engines that makes your throat and lungs sore.',
    },
    from: {
      pa: 'ਕਾਰ, ਬੱਸ ਅਤੇ ਟਰੱਕ ਦਾ ਧੂੰਆਂ, ਅਤੇ ਜਨਰੇਟਰ।',
      hi: 'कार, बस और ट्रक का धुआँ, और जनरेटर।',
      en: 'Car, bus and truck exhaust, and generators.',
    },
    health: {
      pa: 'ਸਾਹ ਦੀ ਨਾਲੀ ਵਿੱਚ ਸੋਜ, ਬੱਚਿਆਂ ਵਿੱਚ ਦਮੇ ਦਾ ਵੱਧ ਖ਼ਤਰਾ, ਅਤੇ ਛਾਤੀ ਵਿੱਚ ਜਕੜਨ।',
      hi: 'साँस की नली में सूजन, बच्चों में दमे का ख़तरा, और छाती में जकड़न।',
      en: 'Airway inflammation, childhood asthma risk, and chest tightness.',
    },
  },
  so2: {
    symbol: 'SO₂',
    icon: '🏭',
    what: {
      pa: 'ਤਿੱਖੀ ਬੋ ਵਾਲੀ ਗੈਸ, ਜਿਸ ਨਾਲ ਖੰਘ ਆ ਸਕਦੀ ਹੈ।',
      hi: 'तीखी गंध वाली गैस, जिससे खाँसी आ सकती है।',
      en: 'A sharp-smelling gas that can make you cough.',
    },
    from: {
      pa: 'ਕੋਲਾ ਸਾੜਨ ਵਾਲੇ ਬਿਜਲੀ ਘਰ ਅਤੇ ਕਾਰਖਾਨੇ।',
      hi: 'कोयला जलाने वाले बिजलीघर और कारखाने।',
      en: 'Power stations and factories that burn coal.',
    },
    health: {
      pa: 'ਗੰਭੀਰ ਖੰਘ, ਸਾਹ ਚੜ੍ਹਨਾ, ਅਤੇ ਦਮੇ ਦੇ ਮਰੀਜ਼ਾਂ ਵਿੱਚ ਤੇਜ਼ ਦੌਰਾ।',
      hi: 'गंभीर खाँसी, साँस फूलना, और दमे के मरीजों में दौरा ट्रिगर होना।',
      en: 'Severe coughing, shortness of breath, and asthma spasms.',
    },
  },
  co: {
    symbol: 'CO',
    icon: '🔥',
    what: {
      pa: 'ਅਜਿਹੀ ਗੈਸ ਜੋ ਨਾ ਦਿਸਦੀ ਹੈ ਨਾ ਸੁੰਘੀ ਜਾ ਸਕਦੀ ਹੈ; ਇਹ ਖੂਨ ਵਿੱਚ ਆਕਸੀਜਨ ਘਟਾ ਦਿੰਦੀ ਹੈ।',
      hi: 'ऐसी गैस जो न दिखती है न सूँघी जा सकती है; यह खून में ऑक्सीजन कम कर देती है।',
      en: "A gas you can't see or smell. It stops your blood carrying oxygen well.",
    },
    from: {
      pa: 'ਠੀਕ ਨਾ ਬਲਣ ਵਾਲੇ ਇੰਜਣ ਅਤੇ ਚੁੱਲ੍ਹੇ, ਖ਼ਾਸ ਕਰਕੇ ਬੰਦ ਕਮਰਿਆਂ ਵਿੱਚ।',
      hi: 'ठीक से न जलने वाले इंजन और चूल्हे, खासकर बंद कमरों में।',
      en: 'Engines and stoves that burn fuel badly, especially in closed rooms.',
    },
    health: {
      pa: 'ਸਿਰਦਰਦ, ਚੱਕਰ ਆਉਣੇ, ਬੇਹੋਸ਼ੀ, ਅਤੇ ਸਰੀਰ ਨੂੰ ਆਕਸੀਜਨ ਦੀ ਭਾਰੀ ਕਮੀ।',
      hi: 'सिरदर्द, चक्कर आना, अत्यधिक थकान, और दिल-दिमाग को ऑक्सीजन की कमी।',
      en: 'Headaches, dizziness, confusion, and reduced oxygen delivery to organs.',
    },
  },
  o3: {
    symbol: 'O₃',
    icon: '☀️',
    what: {
      pa: 'ਧੁੱਪ ਵਿੱਚ ਹੋਰ ਪ੍ਰਦੂਸ਼ਣ ਤੋਂ ਬਣਦੀ ਹੈ; ਅੱਖਾਂ ਅਤੇ ਫੇਫੜਿਆਂ ਵਿੱਚ ਚੁਭਦੀ ਹੈ।',
      hi: 'धूप में दूसरे प्रदूषण से बनती है; आँखों और फेफड़ों में चुभती है।',
      en: 'Made when sunlight cooks other pollution. It stings your eyes and lungs.',
    },
    from: {
      pa: 'ਗੱਡੀਆਂ ਅਤੇ ਕਾਰਖਾਨਿਆਂ ਦਾ ਧੂੰਆਂ ਧੁੱਪ ਵਿੱਚ, ਗਰਮ ਦੁਪਹਿਰ ਨੂੰ ਸਭ ਤੋਂ ਵੱਧ।',
      hi: 'गाड़ियों और कारखानों का धुआँ धूप में, गर्म दोपहर में सबसे ज़्यादा।',
      en: 'Vehicle and factory fumes in sunshine, worst on hot afternoons.',
    },
    health: {
      pa: 'ਡੂੰਘਾ ਸਾਹ ਲੈਣ ਤੇ ਛਾਤੀ ਵਿੱਚ ਦਰਦ, ਫੇਫੜਿਆਂ ਦੀ ਕਮਜ਼ੋਰੀ, ਅਤੇ ਖੰਘ।',
      hi: 'गहरी साँस लेने पर छाती में दर्द, खाँसी, और फेफड़ों की क्षमता घटना।',
      en: 'Chest tightness, pain when breathing deep, and reduced lung function.',
    },
  },
  nh3: {
    symbol: 'NH₃',
    icon: '🧪',
    what: {
      pa: 'ਤੇਜ਼ ਬੋ ਵਾਲੀ ਗੈਸ, ਜੋ ਹਵਾ ਵਿੱਚ ਛੋਟੇ ਕਣ ਬਣਾਉਂਦੀ ਹੈ।',
      hi: 'तेज़ गंध वाली गैस, जो हवा में छोटे कण बनाती है।',
      en: 'A strong-smelling gas that helps make tiny particles in the air.',
    },
    from: {
      pa: 'ਖਾਦ, ਪਸ਼ੂਆਂ ਦਾ ਗੋਹਾ, ਅਤੇ ਕੂੜੇ ਦੇ ਢੇਰ।',
      hi: 'खाद, पशुओं का गोबर, और कचरे के ढेर।',
      en: 'Fertiliser, animal dung, and rubbish heaps.',
    },
    health: {
      pa: 'ਨੱਕ, ਗਲੇ ਅਤੇ ਅੱਖਾਂ ਵਿੱਚ ਤਿੱਖੀ ਜਲਣ, ਅਤੇ ਸਾਹ ਲੈਣ ਵਿੱਚ ਔਖ।',
      hi: 'नाक, गले और आँखों में तेज़ जलन, और साँस लेने में तकलीफ़।',
      en: 'Nose & eye burning, coughing, and respiratory tract irritation.',
    },
  },
  pb: {
    symbol: 'Pb',
    icon: '⚠️',
    what: {
      pa: 'ਸਿੱਕਾ, ਇੱਕ ਧਾਤ ਜੋ ਥੋੜ੍ਹੀ ਮਾਤਰਾ ਵਿੱਚ ਵੀ ਸਰੀਰ ਲਈ ਮਾੜੀ ਹੈ।',
      hi: 'सीसा, एक धातु जो थोड़ी मात्रा में भी शरीर के लिए बुरी है।',
      en: 'Lead, a metal that harms the body even in small amounts.',
    },
    from: {
      pa: 'ਬੈਟਰੀਆਂ ਗਾਲਣਾ ਅਤੇ ਕੁਝ ਕਾਰਖਾਨੇ।',
      hi: 'बैटरियाँ गलाना और कुछ कारखाने।',
      en: 'Melting old batteries, and some factories.',
    },
    health: {
      pa: 'ਬੱਚਿਆਂ ਦੇ ਦਿਮਾਗੀ ਵਿਕਾਸ ਵਿੱਚ ਰੁਕਾਵਟ, ਸਿੱਖਣ ਦੀ ਕਮਜ਼ੋਰੀ, ਅਤੇ ਅਨੀਮੀਆ।',
      hi: 'बच्चों के मानसिक विकास में बाधा, सीखने में कठिनाई, और एनीमिया।',
      en: 'Children brain development impairment, learning deficits, and anemia.',
    },
  },
};

export const WORDS = {
  airQuality: { pa: 'ਹਵਾ ਗੁਣਵੱਤਾ', hi: 'वायु गुणवत्ता', en: 'Air quality' },
  buddy: { pa: 'ਏਅਰ ਬੱਡੀ', hi: 'एयर बडी', en: 'Air Buddy' },
  todaysAir: { pa: 'ਅੱਜ ਦੀ ਹਵਾ', hi: 'आज की हवा', en: "Today's air" },
  cardsTitle: { pa: 'ਹਵਾ ਵਿੱਚ ਕੀ ਹੈ', hi: 'हवा में क्या है', en: "What's in the air" },
  biggest: { pa: 'ਅੱਜ ਸਭ ਤੋਂ ਵੱਧ', hi: 'आज सबसे ज़्यादा', en: 'Biggest today' },
  from: { pa: 'ਕਿੱਥੋਂ ਆਉਂਦੀ ਹੈ', hi: 'कहाँ से आती है', en: 'Where it comes from' },
  healthRisks: { pa: 'ਸਿਹਤ ਤੇ ਅਸਰ ਅਤੇ ਬਿਮਾਰੀਆਂ', hi: 'स्वास्थ्य प्रभाव व बीमारियाँ', en: 'Health risks & diseases' },
  notMeasured: { pa: 'ਅੱਜ ਨੇੜੇ ਨਹੀਂ ਮਾਪੀ ਗਈ', hi: 'आज पास में नहीं मापी गई', en: 'Not measured nearby today' },
  index: { pa: 'ਸੂਚਕ', hi: 'सूचकांक', en: 'index' },
  exampleDay: { pa: 'ਉਦਾਹਰਨ ਦਿਨ', hi: 'उदाहरण दिन', en: 'Example day' },
  noReading: {
    pa: 'ਇਸ ਵੇਲੇ ਕੋਈ ਰੀਡਿੰਗ ਉਪਲਬਧ ਨਹੀਂ ਹੈ', // needs native-speaker review
    hi: 'अभी कोई रीडिंग उपलब्ध नहीं है', // needs native-speaker review
    en: 'No reading right now',
  },
  retry: {
    pa: 'ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ', // needs native-speaker review
    hi: 'पुनः प्रयास करें', // needs native-speaker review
    en: 'Retry',
  },
  noAdvice: {
    pa: 'ਰੀਡਿੰਗ ਤੋਂ ਬਿਨਾਂ ਸਲਾਹ ਉਪਲਬਧ ਨਹੀਂ ਹੈ', // needs native-speaker review
    hi: 'रीडिंग के बिना सलाह उपलब्ध नहीं है', // needs native-speaker review
    en: 'Advice is not available without a reading',
  },
  measuredAgo: {
    pa: 'ਪਹਿਲਾਂ ਮਾਪਿਆ ਗਿਆ', // needs native-speaker review
    hi: 'पहले मापा गया', // needs native-speaker review
    en: 'Measured',
  },
  staleReading: {
    pa: 'ਪੁਰਾਣਾ ਡਾਟਾ', // needs native-speaker review
    hi: 'पुराना डेटा', // needs native-speaker review
    en: 'Stale data',
  },
  exampleData: {
    pa: 'ਉਦਾਹਰਨ ਡਾਟਾ (ਡੈਮੋ ਮੋਡ)', // needs native-speaker review
    hi: 'उदाहरण डेटा (डेमो मोड)', // needs native-speaker review
    en: 'Example data (demo mode)',
  },
  source: {
    pa: 'ਸਰੋਤ', // needs native-speaker review
    hi: 'स्रोत', // needs native-speaker review
    en: 'Source',
  },
  stations: {
    pa: 'ਸਟੇਸ਼ਨ', // needs native-speaker review
    hi: 'स्टेशन', // needs native-speaker review
    en: 'stations',
  },
  dominantPollutant: {
    pa: 'ਮੁੱਖ ਪ੍ਰਦੂਸ਼ਕ', // needs native-speaker review
    hi: 'मुख्य प्रदूषक', // needs native-speaker review
    en: 'Dominant pollutant',
  },
  recordedAt: {
    pa: 'ਦਰਜ ਸਮਾਂ', // needs native-speaker review
    hi: 'दर्ज समय', // needs native-speaker review
    en: 'Recorded at',
  },
  activeRole: {
    pa: 'ਸਰਗਰਮ ਭੂਮਿਕਾ', // needs native-speaker review
    hi: 'सक्रिय भूमिका', // needs native-speaker review
    en: 'Active role',
  },
  loadingAir: {
    pa: 'ਹਵਾ ਗੁਣਵੱਤਾ ਡਾਟਾ ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...', // needs native-speaker review
    hi: 'वायु गुणवत्ता डेटा लोड हो रहा है...', // needs native-speaker review
    en: 'Loading air quality data...',
  },
  todaysAdvisory: {
    pa: 'ਅੱਜ ਦੀ ਸਲਾਹ', // needs native-speaker review
    hi: 'आज की सलाह', // needs native-speaker review
    en: "Today's Advisory",
  },
  seeAirWhereYouAre: {
    pa: 'ਜਿੱਥੇ ਤੁਸੀਂ ਹੋ ਉੱਥੇ ਦੀ ਹਵਾ ਦੇਖੋ', // needs native-speaker review
    hi: 'जहाँ आप हैं वहाँ की हवा देखें', // needs native-speaker review
    en: 'See the air where you are',
  },
  locationRationale: {
    pa: 'ਸਾਸ ਤੁਹਾਡੇ ਨੇੜਲੇ ਰੀਡਿੰਗ ਅਤੇ ਅੱਗ ਦੀਆਂ ਘਟਨਾਵਾਂ ਲੱਭਣ ਲਈ ਤੁਹਾਡੀ ਸਥਿਤੀ ਵਰਤਦਾ ਹੈ। ਇਹ ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ ਵਿੱਚ ਸੁਰੱਖਿਅਤ ਨਹੀਂ ਕੀਤਾ ਜਾਂਦਾ।', // needs native-speaker review
    hi: 'सांस आपके निकटतम रीडिंग और आग की घटनाओं का पता लगाने के लिए आपकी स्थिति का उपयोग करता है। यह आपकी प्रोफ़ाइल में सहेजा नहीं जाता है।', // needs native-speaker review
    en: "Saans uses your location to find the nearest readings and fires. It isn't saved to your profile.",
  },
  useMyLocation: {
    pa: 'ਮੇਰੀ ਸਥਿਤੀ ਵਰਤੋ', // needs native-speaker review
    hi: 'मेरी स्थिति का उपयोग करें', // needs native-speaker review
    en: 'Use my location',
  },
  notNow: {
    pa: 'ਹੁਣੇ ਨਹੀਂ', // needs native-speaker review
    hi: 'अभी नहीं', // needs native-speaker review
    en: 'Not now',
  },
  findingYou: {
    pa: 'ਤੁਹਾਡੀ ਸਥਿਤੀ ਲੱਭੀ ਜਾ ਰਹੀ ਹੈ…', // needs native-speaker review
    hi: 'आपकी स्थिति खोजी जा रही है…', // needs native-speaker review
    en: 'Finding you…',
  },
  nearYou: {
    pa: 'ਤੁਹਾਡੇ ਨੇੜੇ', // needs native-speaker review
    hi: 'आपके पास', // needs native-speaker review
    en: 'Near you',
  },
  showingSchool: {
    pa: 'ਤੁਹਾਡਾ ਸਕੂਲ ਦਿਖਾਇਆ ਜਾ ਰਿਹਾ ਹੈ, {district}', // needs native-speaker review
    hi: 'आपके स्कूल का दृश्य, {district}', // needs native-speaker review
    en: 'Showing your school, {district}',
  },
  locationOff: {
    pa: 'ਸਥਾਨ ਸੇਵਾ ਬੰਦ ਹੈ', // needs native-speaker review
    hi: 'स्थान सेवा बंद है', // needs native-speaker review
    en: 'Location is off',
  },
  searchPlace: {
    pa: 'ਕੋਈ ਸਥਾਨ ਚੁਣੋ', // needs native-speaker review
    hi: 'कोई स्थान चुनें', // needs native-speaker review
    en: 'Search a place',
  },
  howToEnableLocation: {
    pa: 'ਸਥਾਨ ਚਾਲੂ ਕਰਨ ਲਈ: ਐਡਰੈਸ ਬਾਰ ਵਿੱਚ ਲਾਕ ਜਾਂ ਟਿਊਨ ਆਈਕਨ ਤੇ ਟੈਪ ਕਰੋ, ਇਜਾਜ਼ਤ ਦਿਓ ਅਤੇ ਪੰਨਾ ਰਿਫ੍ਰੈਸ਼ ਕਰੋ।', // needs native-speaker review
    hi: 'स्थान चालू करने के लिए: पता पट्टी में लॉक या ट्यून आइकन पर टैप करें, अनुमति दें और पृष्ठ को रीफ्रेश करें।', // needs native-speaker review
    en: 'To enable location: Tap the lock or tune icon in your address bar, allow Location access, and refresh.',
  },
  couldNotFindYou: {
    pa: 'ਤੁਹਾਡੀ ਸਥਿਤੀ ਨਹੀਂ ਮਿਲ ਸਕੀ। ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ, ਜਾਂ ਸਥਾਨ ਚੁਣੋ।', // needs native-speaker review
    hi: 'आपकी स्थिति नहीं मिल सकी। पुनः प्रयास करें, या स्थान चुनें।', // needs native-speaker review
    en: "Couldn't find you. Try again, or search a place.",
  },
  insecureConnection: {
    pa: 'ਸਥਾਨ ਸੇਵਾ ਲਈ ਸੁਰੱਖਿਅਤ ਕਨੈਕਸ਼ਨ (HTTPS) ਲੋੜੀਂਦਾ ਹੈ।', // needs native-speaker review
    hi: 'स्थान सेवा के लिए सुरक्षित कनेक्शन (HTTPS) आवश्यक है।', // needs native-speaker review
    en: 'Location requires a secure connection (HTTPS).',
  },
  roughAccuracy: {
    pa: 'ਅੰਦਾਜ਼ਨ ਸ਼ੁੱਧਤਾ (±{meters} ਮੀ). ਰਿਪੋਰਟ ਕਰਦੇ ਸਮੇਂ ਪਿੰਨ ਬਦਲੀ ਜਾ ਸਕਦੀ ਹੈ।', // needs native-speaker review
    hi: 'अनुमानित सटीकता (±{meters} मी). रिपोर्ट करते समय पिन बदली जा सकती है।', // needs native-speaker review
    en: 'Rough accuracy (±{meters} m). Pin can be moved when reporting.',
  },
  freeTextUnavailable: {
    pa: 'ਖੁੱਲ੍ਹੀ ਖੋਜ ਅਜੇ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਹੇਠਾਂ ਦਿੱਤਾ ਗਿਆ ਸਕੂਲ ਚੁਣੋ:', // needs native-speaker review
    hi: 'मुक्त-पाठ खोज अभी उपलब्ध नहीं है। नीचे दिया गया ज्ञात स्कूल चुनें:', // needs native-speaker review
    en: 'Free-text place search is not available yet. Choose a known campus:',
  },
  change: {
    pa: 'ਬਦਲੋ', // needs native-speaker review
    hi: 'बदलें', // needs native-speaker review
    en: 'Change',
  },
  coverageNotice: {
    pa: 'ਪੂਰਵ-ਅਨੁਮਾਨ ਅਤੇ ਟਰੈਕਿੰਗ ਸਿਰਫ਼ ਪੰਜਾਬ ਅਤੇ ਦਿੱਲੀ ਐਨਸੀਆਰ ਨੂੰ ਕਵਰ ਕਰਦੀ ਹੈ।', // needs native-speaker review
    hi: 'पूर्वानुमान और निगरानी केवल पंजाब और दिल्ली एनसीआर को कवर करती है।', // needs native-speaker review
    en: 'Hourly forecast and tracking covers Punjab and Delhi NCR only.',
  },
  accurateTo: {
    pa: '{meters} ਮੀਟਰ ਤੱਕ ਸ਼ੁੱਧ', // needs native-speaker review
    hi: '{meters} मीटर तक सटीक', // needs native-speaker review
    en: 'accurate to {meters} metres',
  },
  nearestStation: {
    pa: 'ਨੇੜਲਾ ਸਟੇਸ਼ਨ', // needs native-speaker review
    hi: 'निकटतम स्टेशन', // needs native-speaker review
    en: 'Nearest station',
  },
  kmAway: {
    pa: '{km} ਕਿਲੋਮੀਟਰ ਦੂਰ', // needs native-speaker review
    hi: '{km} किमी दूर', // needs native-speaker review
    en: '{km} km away',
  },
  rightNow: {
    pa: 'ਹੁਣ ਦੀ ਸਥਿਤੀ', // needs native-speaker review
    hi: 'अभी की स्थिति', // needs native-speaker review
    en: 'Right now',
  },
  whatToDoToday: {
    pa: 'ਅੱਜ ਕੀ ਕਰਨਾ ਹੈ', // needs native-speaker review
    hi: 'आज क्या करें', // needs native-speaker review
    en: 'What to do today',
  },
  aroundYou: {
    pa: 'ਤੁਹਾਡੇ ਆਲੇ-ਦੁਆਲੇ', // needs native-speaker review
    hi: 'आपके आस-पास', // needs native-speaker review
    en: 'Around you',
  },
  learnAir: {
    pa: 'ਸਿੱਖੋ: ਹਵਾ ਵਿੱਚ ਕੀ ਹੈ', // needs native-speaker review
    hi: 'सीखें: हवा में क्या है', // needs native-speaker review
    en: "Learn: What's in the air",
  },
  playGame: {
    pa: 'ਖੇਡੋ: ਫਿਲਟਰ ਫ੍ਰੈਂਜ਼ੀ', // needs native-speaker review
    hi: 'खेलें: फ़िल्टर फ़्रेंज़ी', // needs native-speaker review
    en: 'Play: Filter Frenzy',
  },
  details: {
    pa: 'ਵੇਰਵੇ', // needs native-speaker review
    hi: 'विवरण', // needs native-speaker review
    en: 'Details',
  },
  actionItems: {
    pa: 'ਕਰਨ ਯੋਗ ਕੰਮ', // needs native-speaker review
    hi: 'कार्रवाई योग्य कदम', // needs native-speaker review
    en: 'Action items',
  },
  firesSummary: {
    pa: '{count} ਅੱਗ ਦੀਆਂ ਘਟਨਾਵਾਂ 25 ਕਿਲੋਮੀਟਰ ਦੇ ਅੰਦਰ, ਹਵਾ {dir} ਵੱਲੋਂ', // needs native-speaker review
    hi: '25 किमी के भीतर {count} आग की घटनाएँ, हवा {dir} से', // needs native-speaker review
    en: '{count} fires within 25 km, wind from the {dir}',
  },
  noFiresSummary: {
    pa: '25 ਕਿਲੋਮੀਟਰ ਦੇ ਅੰਦਰ ਕੋਈ ਅੱਗ ਨਹੀਂ, ਹਵਾ {dir} ਵੱਲੋਂ', // needs native-speaker review
    hi: '25 किमी के भीतर कोई आग नहीं, हवा {dir} से', // needs native-speaker review
    en: '0 fires within 25 km, wind from the {dir}',
  },
  noFiresSeen: {
    pa: 'ਪਿਛਲੇ ਸੈਟੇਲਾਈਟ ਗੇੜੇ ਤੋਂ 25 ਕਿਲੋਮੀਟਰ ਦੇ ਅੰਦਰ ਕੋਈ ਅੱਗ ਨਹੀਂ ਦਿਖੀ', // needs native-speaker review
    hi: 'अंतिम सैटेलाइट पास के बाद से 25 किमी के भीतर कोई आग नहीं देखी गई', // needs native-speaker review
    en: 'No fires seen within 25 km since the last satellite pass',
  },
  firesCountOnly: {
    pa: '25 ਕਿਲੋਮੀਟਰ ਦੇ ਅੰਦਰ {count} ਅੱਗ ਦੀਆਂ ਘਟਨਾਵਾਂ', // needs native-speaker review
    hi: '25 किमी के भीतर {count} आग की घटनाएँ', // needs native-speaker review
    en: '{count} fires within 25 km',
  },
  firesUnavailable: {
    pa: 'ਅੱਗ ਦਾ ਡਾਟਾ ਹਾਲੇ ਉਪਲਬਧ ਨਹੀਂ ਹੈ', // needs native-speaker review
    hi: 'आग का डेटा अभी उपलब्ध नहीं है', // needs native-speaker review
    en: 'Fire data not available right now',
  },
  nextHours: {
    pa: 'ਅਗਲੇ ਘੰਟੇ', // needs native-speaker review
    hi: 'अगले घंटे', // needs native-speaker review
    en: 'Next hours',
  },
  forecastUnavailable: {
    pa: 'ਅਨੁਮਾਨ ਹਾਲੇ ਉਪਲਬਧ ਨਹੀਂ ਹੈ', // needs native-speaker review
    hi: 'पूर्वानुमान अभी उपलब्ध नहीं है', // needs native-speaker review
    en: 'Forecast not available right now',
  },
  forecastCoverageNotice: {
    pa: 'ਘੰਟੇਵਾਰ ਅਨੁਮਾਨ ਸਿਰਫ਼ ਪੰਜਾਬ ਅਤੇ ਦਿੱਲੀ ਐਨਸੀਆਰ ਨੂੰ ਕਵਰ ਕਰਦਾ ਹੈ।', // needs native-speaker review
    hi: 'प्रति घंटा पूर्वानुमान केवल पंजाब और दिल्ली एनसीआर को कवर करता है।', // needs native-speaker review
    en: 'Hourly forecast covers Punjab and Delhi NCR only.',
  },
  airWorseAfter: {
    pa: '{time} ਤੋਂ ਬਾਅਦ ਹਵਾ ਹੋਰ ਖ਼ਰਾਬ ਹੋ ਸਕਦੀ ਹੈ।', // needs native-speaker review
    hi: '{time} के बाद हवा और खराब हो सकती है।', // needs native-speaker review
    en: 'Air should get worse after {time}.',
  },
  airImproveAfter: {
    pa: '{time} ਤੋਂ ਬਾਅਦ ਹਵਾ ਵਿੱਚ ਸੁਧਾਰ ਹੋ ਸਕਦਾ ਹੈ।', // needs native-speaker review
    hi: '{time} के बाद हवा में सुधार हो सकता है।', // needs native-speaker review
    en: 'Air should improve after {time}.',
  },
  example: {
    pa: 'ਉਦਾਹਰਨ', // needs native-speaker review
    hi: 'उदाहरण', // needs native-speaker review
    en: 'Example',
  },
  north: { pa: 'ਉੱਤਰ', hi: 'उत्तर', en: 'north' },
  northEast: { pa: 'ਉੱਤਰ-ਪੂਰਬ', hi: 'उत्तर-पूर्व', en: 'north-east' },
  east: { pa: 'ਪੂਰਬ', hi: 'पूर्व', en: 'east' },
  southEast: { pa: 'ਦੱਖਣ-ਪੂਰਬ', hi: 'दक्षिण-पूर्व', en: 'south-east' },
  south: { pa: 'ਦੱਖਣ', hi: 'दक्षिण', en: 'south' },
  southWest: { pa: 'ਦੱਖਣ-ਪੱਛਮ', hi: 'दक्षिण-पश्चिम', en: 'south-west' },
  west: { pa: 'ਪੱਛਮ', hi: 'पश्चिम', en: 'west' },
  northWest: { pa: 'ਉੱਤਰ-ਪੱਛਮ', hi: 'उत्तर-पश्चिम', en: 'north-west' },
} satisfies Record<string, Words>;

export function getWindCompassDirection(deg: number): 'north' | 'northEast' | 'east' | 'southEast' | 'south' | 'southWest' | 'west' | 'northWest' {
  const directions = [
    'north',
    'northEast',
    'east',
    'southEast',
    'south',
    'southWest',
    'west',
    'northWest',
  ] as const;
  const index = Math.round(((deg % 360) / 45)) % 8;
  return directions[index];
}

export function formatFiresWindSummary(
  firesCount: number,
  wind?: { speed_kmh: number; direction_deg: number },
  language: Language = 'en'
): string | null {
  if (!wind || typeof wind.direction_deg !== 'number') {
    return firesCount > 0
      ? WORDS.firesCountOnly[language].replace('{count}', String(firesCount))
      : WORDS.noFiresSeen[language];
  }
  const dirKey = getWindCompassDirection(wind.direction_deg);
  const dirWord = WORDS[dirKey][language];
  const template = firesCount > 0 ? WORDS.firesSummary[language] : WORDS.noFiresSummary[language];
  return template.replace('{count}', String(firesCount)).replace('{dir}', dirWord);
}

export function formatForecastHour(isoTime: string, language: Language = 'en'): string {
  if (!isoTime) return '—';
  try {
    const timeMatch = isoTime.match(/T(\d{2}):/);
    let h = 0;
    if (timeMatch) {
      h = parseInt(timeMatch[1], 10);
    } else {
      const d = new Date(isoTime);
      if (isNaN(d.getTime())) return isoTime;
      h = d.getHours();
    }
    const ampm = h >= 12 ? 'pm' : 'am';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12} ${ampm}`;
  } catch {
    return isoTime;
  }
}

const CATEGORY_SEVERITY_RANK: Record<Category, number> = {
  good: 0,
  satisfactory: 1,
  moderate: 2,
  poor: 3,
  very_poor: 4,
  severe: 5,
};

export function buildForecastTrendSentence(
  hours: ForecastHour[],
  language: Language = 'en'
): string | null {
  if (!hours || hours.length < 2) return null;
  const startSeverity = CATEGORY_SEVERITY_RANK[hours[0].category];

  // Check if air gets worse
  const worseHour = hours.find((h) => CATEGORY_SEVERITY_RANK[h.category] > startSeverity);
  if (worseHour) {
    const timeStr = formatForecastHour(worseHour.time, language);
    return WORDS.airWorseAfter[language].replace('{time}', timeStr);
  }

  // Check if air improves
  const betterHour = hours.find((h) => CATEGORY_SEVERITY_RANK[h.category] < startSeverity);
  if (betterHour) {
    const timeStr = formatForecastHour(betterHour.time, language);
    return WORDS.airImproveAfter[language].replace('{time}', timeStr);
  }

  return null;
}

export interface GasCard {
  pollutant: Pollutant;
  dominant: boolean;
  /** null when no station nearby measured it today. */
  reading: { subIndex: number; category: Category; concentration: number; unit: string } | null;
}

/**
 * The cards in the order a child should read them: the dominant pollutant first, then the others
 * measured today from worst to best, then the six standard ones nobody measured nearby.
 */
export function gasCards(aqi: AqiResponse): GasCard[] {
  const measured = Object.entries(aqi.sub_indices ?? {}) as [Pollutant, components['schemas']['SubIndex']][];
  const cards: GasCard[] = measured
    .filter(([p]) => p in GASES)
    .map(([pollutant, s]) => ({
      pollutant,
      dominant: pollutant === aqi.dominant_pollutant,
      reading: { subIndex: s.sub_index, category: getCategoryCode(s.sub_index), concentration: s.concentration, unit: s.unit },
    }))
    .sort((a, b) => Number(b.dominant) - Number(a.dominant) || b.reading!.subIndex - a.reading!.subIndex);
  for (const pollutant of CARD_POLLUTANTS) {
    if (!cards.some((c) => c.pollutant === pollutant)) cards.push({ pollutant, dominant: false, reading: null });
  }
  return cards;
}

/** "ug/m3" as people write it. */
export function unitLabel(unit: string) {
  return unit.replace('ug/m3', 'µg/m³').replace('mg/m3', 'mg/m³');
}
