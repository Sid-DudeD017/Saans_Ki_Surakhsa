// Air Buddy's moods and the gas cards (P2): what each CPCB category and pollutant means to a child, in
// Punjabi, Hindi and English. The readings come in the shape of P3's GET /v1/aqi (AqiResponse).
import type { components } from '../../../packages/contracts/types';
import { getCategoryCode } from '../../../packages/aqi';

export type AqiResponse = components['schemas']['AqiResponse'];
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

export const GASES: Record<Pollutant, { symbol: string; icon: string; what: Words; from: Words }> = {
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
  },
};

export const WORDS = {
  buddy: { pa: 'ਏਅਰ ਬੱਡੀ', hi: 'एयर बडी', en: 'Air Buddy' },
  todaysAir: { pa: 'ਅੱਜ ਦੀ ਹਵਾ', hi: 'आज की हवा', en: "Today's air" },
  cardsTitle: { pa: 'ਹਵਾ ਵਿੱਚ ਕੀ ਹੈ', hi: 'हवा में क्या है', en: "What's in the air" },
  biggest: { pa: 'ਅੱਜ ਸਭ ਤੋਂ ਵੱਧ', hi: 'आज सबसे ज़्यादा', en: 'Biggest today' },
  from: { pa: 'ਕਿੱਥੋਂ ਆਉਂਦੀ ਹੈ', hi: 'कहाँ से आती है', en: 'Where it comes from' },
  notMeasured: { pa: 'ਅੱਜ ਨੇੜੇ ਨਹੀਂ ਮਾਪੀ ਗਈ', hi: 'आज पास में नहीं मापी गई', en: 'Not measured nearby today' },
  index: { pa: 'ਸੂਚਕ', hi: 'सूचकांक', en: 'index' },
  exampleDay: { pa: 'ਉਦਾਹਰਨ ਦਿਨ', hi: 'उदाहरण दिन', en: 'Example day' },
} satisfies Record<string, Words>;

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
