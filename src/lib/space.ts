'use client';

// Who is using the app, and which part of it is theirs. Opening the app asks once (src/app/welcome):
// a farmer gets Kisan Saathi, a student or principal Saans Shala, someone checking their home Ghar ki
// Hawa. For now everyone signs in as a guest, and the choice stays on this phone. The round Switch
// button (SpaceSwitch.tsx) changes it at any time.
import { useSyncExternalStore } from 'react';

import type { UserRole } from './auth';
import type { SupportedLanguage } from '../components/ui/LanguageSwitcher';

export type Persona = 'farmer' | 'student' | 'principal' | 'home';
export type SpaceId = 'kisan' | 'shala' | 'ghar';

export interface Session {
  guest: true;
  persona: Persona;
  /** Where the app opens: the persona's space at first, then wherever the Switch button last went. */
  space: SpaceId;
}

export const PERSONAS: readonly Persona[] = ['farmer', 'student', 'principal', 'home'];
export const SPACE_IDS: readonly SpaceId[] = ['kisan', 'shala', 'ghar'];

type Words = Record<SupportedLanguage, string>;

export interface Space {
  id: SpaceId;
  href: string;
  icon: string;
  name: Words;
  /** Who it is for, under the name. */
  forWhom: Words;
  /** Strong colour (text, the chosen tab) and the soft wash behind the header and tiles. */
  accent: string;
  wash: string;
}

export const SPACES: Record<SpaceId, Space> = {
  kisan: {
    id: 'kisan',
    href: '/kisan',
    icon: '🌾',
    name: { en: 'Kisan Saathi', hi: 'किसान साथी', pa: 'ਕਿਸਾਨ ਸਾਥੀ' },
    forWhom: { en: 'Clear stubble without fire', hi: 'बिना आग पराली हटाएँ', pa: 'ਬਿਨਾਂ ਅੱਗ ਪਰਾਲੀ ਸਾਂਭੋ' },
    accent: '#15803d',
    wash: '#dcfce7',
  },
  shala: {
    id: 'shala',
    href: '/shala',
    icon: '🏫',
    name: { en: 'Saans Shala', hi: 'सांस शाला', pa: 'ਸਾਂਸ ਸ਼ਾਲਾ' },
    forWhom: { en: 'Safe air at school', hi: 'स्कूल में साफ़ हवा', pa: 'ਸਕੂਲ ਵਿੱਚ ਸਾਫ਼ ਹਵਾ' },
    accent: '#0369a1',
    wash: '#e0f2fe',
  },
  ghar: {
    id: 'ghar',
    href: '/ghar',
    icon: '🏠',
    name: { en: 'Ghar ki Hawa', hi: 'घर की हवा', pa: 'ਘਰ ਦੀ ਹਵਾ' },
    forWhom: { en: 'The air in your home', hi: 'आपके घर की हवा', pa: 'ਤੁਹਾਡੇ ਘਰ ਦੀ ਹਵਾ' },
    accent: '#0d9488',
    wash: '#ccfbf1',
  },
};

export const PERSONA_SPACE: Record<Persona, SpaceId> = { farmer: 'kisan', student: 'shala', principal: 'shala', home: 'ghar' };

/** The role Saans Shala's advice is written for (src/lib/auth.tsx). */
export const PERSONA_ROLE: Record<Persona, UserRole> = { farmer: 'citizen', student: 'student', principal: 'principal', home: 'parent' };

export function spaceOf(path: string): SpaceId | null {
  return SPACE_IDS.find((id) => path === SPACES[id].href || path.startsWith(`${SPACES[id].href}/`)) ?? null;
}

const KEY = 'saans_session';
const listeners = new Set<() => void>();

function parse(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Partial<Session>;
    if (s.guest !== true || !PERSONAS.includes(s.persona as Persona)) return null;
    const persona = s.persona as Persona;
    return { guest: true, persona, space: SPACE_IDS.includes(s.space as SpaceId) ? (s.space as SpaceId) : PERSONA_SPACE[persona] };
  } catch {
    return null;
  }
}

// useSyncExternalStore needs the same object back while nothing changed.
let lastRaw: string | null | undefined;
let lastSession: Session | null = null;

function read(): Session | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return lastSession; // storage blocked: whatever was chosen since the page opened
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastSession = parse(raw);
  }
  return lastSession;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function write(session: Session | null) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked: the choice lasts until the page closes
    lastRaw = session ? JSON.stringify(session) : null;
    lastSession = session;
  }
  listeners.forEach((l) => l());
}

export const session = {
  /** The signed-in guest; undefined until the page has read this phone's storage. */
  use(): Session | null | undefined {
    return useSyncExternalStore(subscribe, read, () => undefined);
  },
  get: read,
  signInAsGuest(persona: Persona) {
    write({ guest: true, persona, space: PERSONA_SPACE[persona] });
  },
  /** Remember the space the Switch button went to, so the app opens there next time. */
  moveTo(space: SpaceId) {
    const s = read();
    if (s && s.space !== space) write({ ...s, space });
  },
  signOut() {
    write(null);
  },
};

const WORDS = {
  tagline: { en: 'Clean air for every farm, school and home', hi: 'हर खेत, स्कूल और घर के लिए साफ़ हवा', pa: 'ਹਰ ਖੇਤ, ਸਕੂਲ ਅਤੇ ਘਰ ਲਈ ਸਾਫ਼ ਹਵਾ' },
  opening: { en: 'Opening Saans…', hi: 'Saans खुल रहा है…', pa: 'Saans ਖੁੱਲ੍ਹ ਰਿਹਾ ਹੈ…' },
  loginTitle: { en: 'Log in', hi: 'लॉग इन करें', pa: 'ਲੌਗ ਇਨ ਕਰੋ' },
  phone: { en: 'Phone number', hi: 'फ़ोन नंबर', pa: 'ਫ਼ੋਨ ਨੰਬਰ' },
  soon: { en: 'Coming soon', hi: 'जल्द आ रहा है', pa: 'ਜਲਦੀ ਆ ਰਿਹਾ ਹੈ' },
  guestGo: { en: 'Continue as guest', hi: 'मेहमान के रूप में आगे बढ़ें', pa: 'ਮਹਿਮਾਨ ਵਜੋਂ ਅੱਗੇ ਵਧੋ' },
  guestNote: {
    en: 'As a guest, what you choose stays on this phone.',
    hi: 'मेहमान के रूप में, आपकी पसंद इसी फ़ोन पर रहती है।',
    pa: 'ਮਹਿਮਾਨ ਵਜੋਂ, ਤੁਹਾਡੀ ਚੋਣ ਇਸੇ ਫ਼ੋਨ ਉੱਤੇ ਰਹਿੰਦੀ ਹੈ।',
  },
  whoTitle: { en: 'Who are you?', hi: 'आप कौन हैं?', pa: 'ਤੁਸੀਂ ਕੌਣ ਹੋ?' },
  whoIntro: {
    en: "We'll open the part of Saans made for you. Switch any time with the red button.",
    hi: 'हम Saans का वह हिस्सा खोलेंगे जो आपके लिए बना है। लाल बटन से कभी भी बदलें।',
    pa: 'ਅਸੀਂ Saans ਦਾ ਉਹ ਹਿੱਸਾ ਖੋਲ੍ਹਾਂਗੇ ਜੋ ਤੁਹਾਡੇ ਲਈ ਬਣਿਆ ਹੈ। ਲਾਲ ਬਟਨ ਨਾਲ ਕਦੇ ਵੀ ਬਦਲੋ।',
  },
  back: { en: 'Back', hi: 'वापस', pa: 'ਵਾਪਸ' },
  official: { en: 'Work for the government? Open Command', hi: 'सरकारी अधिकारी? कमांड खोलें', pa: 'ਸਰਕਾਰੀ ਅਧਿਕਾਰੀ? ਕਮਾਂਡ ਖੋਲ੍ਹੋ' },
  switch: { en: 'Switch', hi: 'बदलें', pa: 'ਬਦਲੋ' },
  switchTo: { en: 'Switch to', hi: 'इसमें बदलें', pa: 'ਇਸ ਵਿੱਚ ਬਦਲੋ' },
  youAreHere: { en: "You're here", hi: 'आप यहाँ हैं', pa: 'ਤੁਸੀਂ ਇੱਥੇ ਹੋ' },
  guest: { en: 'Guest', hi: 'मेहमान', pa: 'ਮਹਿਮਾਨ' },
  notSignedIn: { en: 'Not signed in', hi: 'साइन इन नहीं किया', pa: 'ਸਾਈਨ ਇਨ ਨਹੀਂ ਕੀਤਾ' },
  signIn: { en: 'Sign in', hi: 'साइन इन करें', pa: 'ਸਾਈਨ ਇਨ ਕਰੋ' },
  signOut: { en: 'Sign out', hi: 'साइन आउट', pa: 'ਸਾਈਨ ਆਊਟ' },
  changeWho: { en: 'Change who I am', hi: 'मैं कौन हूँ, बदलें', pa: 'ਮੈਂ ਕੌਣ ਹਾਂ, ਬਦਲੋ' },
  language: { en: 'Language', hi: 'भाषा', pa: 'ਭਾਸ਼ਾ' },
  close: { en: 'Close', hi: 'बंद करें', pa: 'ਬੰਦ ਕਰੋ' },
  account: { en: 'Your account', hi: 'आपका खाता', pa: 'ਤੁਹਾਡਾ ਖਾਤਾ' },
  notifications: { en: 'Notifications', hi: 'सूचनाएँ', pa: 'ਸੂਚਨਾਵਾਂ' },
  airNow: { en: 'Air now', hi: 'अभी की हवा', pa: 'ਹੁਣ ਦੀ ਹਵਾ' },
} satisfies Record<string, Words>;

export type WordKey = keyof typeof WORDS;

export function word(key: WordKey, language: SupportedLanguage): string {
  return WORDS[key][language] ?? WORDS[key].en;
}

export const PERSONA_WORDS: Record<Persona, { icon: string; title: Words; short: Words }> = {
  farmer: {
    icon: '🧑‍🌾',
    title: { en: "I'm a farmer", hi: 'मैं किसान हूँ', pa: 'ਮੈਂ ਕਿਸਾਨ ਹਾਂ' },
    short: { en: 'Farmer', hi: 'किसान', pa: 'ਕਿਸਾਨ' },
  },
  student: {
    icon: '🎒',
    title: { en: "I'm a student", hi: 'मैं विद्यार्थी हूँ', pa: 'ਮੈਂ ਵਿਦਿਆਰਥੀ ਹਾਂ' },
    short: { en: 'Student', hi: 'विद्यार्थी', pa: 'ਵਿਦਿਆਰਥੀ' },
  },
  principal: {
    icon: '🧑‍🏫',
    title: { en: "I'm a principal or teacher", hi: 'मैं प्रिंसिपल या शिक्षक हूँ', pa: 'ਮੈਂ ਪ੍ਰਿੰਸੀਪਲ ਜਾਂ ਅਧਿਆਪਕ ਹਾਂ' },
    short: { en: 'Principal or teacher', hi: 'प्रिंसिपल या शिक्षक', pa: 'ਪ੍ਰਿੰਸੀਪਲ ਜਾਂ ਅਧਿਆਪਕ' },
  },
  home: {
    icon: '🏠',
    title: { en: "Just my home's air", hi: 'बस मेरे घर की हवा', pa: 'ਬੱਸ ਮੇਰੇ ਘਰ ਦੀ ਹਵਾ' },
    short: { en: 'Home', hi: 'घर', pa: 'ਘਰ' },
  },
};
