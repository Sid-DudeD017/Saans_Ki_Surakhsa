// Kisan Saathi's screen text in the farmer's language. The agent's own words come from the agent.
import type { Language } from './kisanApi';

/** The shell sets no font; Gurmukhi and Devanagari need faces that have them (Noto on Android). */
export const FONT = "system-ui, -apple-system, 'Segoe UI', 'Noto Sans Gurmukhi', 'Noto Sans Devanagari', 'Noto Sans', sans-serif";

const STRINGS = {
  title: { pa: 'ਕਿਸਾਨ ਸਾਥੀ', hi: 'किसान साथी', en: 'Kisan Saathi' },
  intro: {
    pa: 'ਆਪਣੇ ਖੇਤ ਬਾਰੇ ਦੱਸੋ: ਪਿੰਡ, ਕਿੰਨੇ ਕਿੱਲੇ ਝੋਨਾ, ਵਾਢੀ ਕਦੋਂ, ਕਣਕ ਕਦੋਂ ਤੱਕ, ਅਤੇ ਕਿਹੜੀਆਂ ਮਸ਼ੀਨਾਂ ਹਨ।',
    hi: 'अपने खेत के बारे में बताइए: गाँव, कितने किल्ले धान, कटाई कब, गेहूँ कब तक, और कौन सी मशीनें हैं।',
    en: 'Tell us about your farm: your village, how much paddy, when you harvest, when wheat must be sown, and which machines you have.',
  },
  holdToTalk: { pa: 'ਦਬਾ ਕੇ ਰੱਖੋ ਅਤੇ ਬੋਲੋ', hi: 'दबाकर रखें और बोलें', en: 'Hold to talk' },
  recording: { pa: 'ਬੋਲੋ… ਛੱਡੋ ਤਾਂ ਭੇਜ ਦਿਆਂਗੇ', hi: 'बोलिए… छोड़ते ही भेज देंगे', en: 'Recording… let go to send' },
  tooShort: { pa: 'ਥੋੜ੍ਹਾ ਲੰਮਾ ਦਬਾ ਕੇ ਬੋਲੋ', hi: 'थोड़ा देर तक दबाकर बोलें', en: 'Hold a little longer while you speak' },
  micDenied: {
    pa: 'ਮਾਈਕ ਨਹੀਂ ਮਿਲਿਆ। ਲਿਖ ਕੇ ਭੇਜੋ।',
    hi: 'माइक नहीं मिला। लिखकर भेजें।',
    en: "The microphone isn't available. Type your message instead.",
  },
  typeHere: { pa: 'ਜਾਂ ਇੱਥੇ ਲਿਖੋ', hi: 'या यहाँ लिखें', en: 'Or type here' },
  send: { pa: 'ਭੇਜੋ', hi: 'भेजें', en: 'Send' },
  thinking: { pa: 'ਸੋਚ ਰਿਹਾ ਹਾਂ…', hi: 'सोच रहा हूँ…', en: 'Thinking…' },
  heard: { pa: 'ਸੁਣਿਆ', hi: 'सुना', en: 'Heard' },
  checkNumbers: { pa: 'ਇਹ ਨੰਬਰ ਠੀਕ ਹੈ? ਛੂਹ ਕੇ ਦੱਸੋ', hi: 'क्या यह नंबर सही है? छूकर बताइए', en: 'Is this number right? Tap to confirm' },
  planTitle: { pa: 'ਤੁਹਾਡੀ ਯੋਜਨਾ', hi: 'आपकी योजना', en: 'Your plan' },
  listen: { pa: 'ਸੁਣੋ', hi: 'सुनें', en: 'Listen' },
  confirmQuestion: { pa: 'ਕੀ ਇਹ ਸਭ ਠੀਕ ਹੈ?', hi: 'क्या यह सब सही है?', en: 'Is all of this right?' },
  yes: { pa: 'ਹਾਂ ਜੀ, ਠੀਕ ਹੈ', hi: 'हाँ जी, सही है', en: "Yes, that's right" },
  yesSays: { pa: 'ਹਾਂ ਜੀ', hi: 'हाँ जी', en: 'Yes' },
  no: { pa: 'ਨਹੀਂ, ਬਦਲਣਾ ਹੈ', hi: 'नहीं, बदलना है', en: 'No, change something' },
  noSays: { pa: 'ਨਹੀਂ, ਕੁਝ ਬਦਲਣਾ ਹੈ', hi: 'नहीं, कुछ बदलना है', en: 'No, something needs changing' },
  filedTitle: { pa: 'ਬੇਨਤੀ ਭੇਜ ਦਿੱਤੀ', hi: 'बिनती भेज दी', en: 'Request sent' },
  seeStatus: { pa: 'ਬੇਨਤੀ ਦੀ ਹਾਲਤ ਵੇਖੋ', hi: 'बिनती की स्थिति देखें', en: "See your request's status" },
  newChat: { pa: 'ਨਵੀਂ ਗੱਲਬਾਤ', hi: 'नई बातचीत', en: 'New conversation' },
  network: {
    pa: 'ਨੈੱਟਵਰਕ ਨਹੀਂ ਮਿਲ ਰਿਹਾ। ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ।',
    hi: 'नेटवर्क नहीं मिल रहा। फिर से कोशिश करें।',
    en: "Can't reach Kisan Saathi. Try again.",
  },
  demo: {
    pa: 'ਡੈਮੋ: ਉਦਾਹਰਨ ਜਵਾਬ',
    hi: 'डेमो: उदाहरण जवाब',
    en: 'Demo mode: example answers from the contract',
  },
  statusTitle: { pa: 'ਬੇਨਤੀ ਦੀ ਹਾਲਤ', hi: 'बिनती की स्थिति', en: 'Request status' },
  notFiled: { pa: 'ਹਾਲੇ ਕੋਈ ਬੇਨਤੀ ਨਹੀਂ ਭੇਜੀ ਗਈ।', hi: 'अभी कोई बिनती नहीं भेजी गई।', en: 'No request has been sent yet.' },
  unknownSession: {
    pa: 'ਇਹ ਗੱਲਬਾਤ ਨਹੀਂ ਮਿਲੀ। ਨਵੀਂ ਗੱਲਬਾਤ ਸ਼ੁਰੂ ਕਰੋ।',
    hi: 'यह बातचीत नहीं मिली। नई बातचीत शुरू करें।',
    en: "This conversation wasn't found. Start a new one.",
  },
  refreshes: { pa: 'ਹਰ 15 ਸਕਿੰਟ ਤਾਜ਼ਾ ਹੁੰਦਾ ਹੈ', hi: 'हर 15 सेकंड में ताज़ा होता है', en: 'Updates every 15 seconds' },
  callChc: { pa: 'CHC ਨੂੰ ਫ਼ੋਨ', hi: 'CHC को फ़ोन', en: 'CHC phone' },
  smsTo: { pa: 'SMS ਭੇਜਿਆ', hi: 'SMS भेजा', en: 'SMS sent to' },
  back: { pa: 'ਗੱਲਬਾਤ ਤੇ ਵਾਪਸ', hi: 'बातचीत पर वापस', en: 'Back to the conversation' },
  acres: { pa: 'ਏਕੜ', hi: 'एकड़', en: 'acres' },
  you: { pa: 'ਤੁਸੀਂ', hi: 'आप', en: 'You' },
} satisfies Record<string, Record<Language, string>>;

export type StringKey = keyof typeof STRINGS;

export function say(key: StringKey, language: Language): string {
  return STRINGS[key][language];
}

/** What each line of the read-back card is, in the farmer's language. */
const CARD_LABELS: Record<string, Record<Language, string>> = {
  paddy: { pa: 'ਝੋਨਾ', hi: 'धान', en: 'Paddy' },
  harvest: { pa: 'ਵਾਢੀ', hi: 'कटाई', en: 'Harvest' },
  wheat_by: { pa: 'ਕਣਕ ਦੀ ਬਿਜਾਈ ਤੱਕ', hi: 'गेहूँ की बुआई तक', en: 'Sow wheat by' },
  tractors: { pa: 'ਟਰੈਕਟਰ', hi: 'ट्रैक्टर', en: 'Tractors' },
  machine: { pa: 'ਤੁਹਾਡੀ ਮਸ਼ੀਨ', hi: 'आपकी मशीन', en: 'Your machine' },
  decomposer: { pa: 'ਡੀਕੰਪੋਜ਼ਰ', hi: 'डीकंपोज़र', en: 'Decomposer' },
  coverage: { pa: 'ਤੁਹਾਡੀਆਂ ਮਸ਼ੀਨਾਂ ਨਾਲ', hi: 'आपकी मशीनों से', en: 'With your machines' },
  booking: { pa: 'CHC ਤੋਂ ਬੁਕਿੰਗ', hi: 'CHC से बुकिंग', en: 'Booked from a CHC' },
  coverage_after: { pa: 'ਬੁਕਿੰਗ ਨਾਲ', hi: 'बुकिंग के साथ', en: 'With the booking' },
  short: { pa: 'ਹਾਲੇ ਬਾਕੀ', hi: 'अभी बाकी', en: 'Still short' },
};

export function cardLabel(kind: string, language: Language): string {
  return CARD_LABELS[kind]?.[language] ?? kind;
}

const ICONS: Record<string, string> = {
  field: '🌾',
  calendar: '📅',
  tractor: '🚜',
  check: '✅',
  help: '🙋',
  spray: '🧴',
};

/** Machine icons are machine codes (super_seeder, happy_seeder, …); they share one picture. */
export function cardIcon(icon: string | undefined): string {
  if (!icon) return '•';
  return ICONS[icon] ?? '⚙️';
}

const STATUS_LABELS: Record<string, Record<Language, string>> = {
  filed: { pa: 'ਬੇਨਤੀ ਭੇਜੀ ਗਈ', hi: 'बिनती भेजी गई', en: 'Request sent' },
  seen: { pa: 'ਵਿਭਾਗ ਨੇ ਵੇਖ ਲਈ', hi: 'विभाग ने देख ली', en: 'Seen by the department' },
  machine_assigned: { pa: 'ਮਸ਼ੀਨ ਮਿਲ ਗਈ', hi: 'मशीन मिल गई', en: 'Machine assigned' },
  in_field: { pa: 'ਮਸ਼ੀਨ ਖੇਤ ਵਿੱਚ', hi: 'मशीन खेत में', en: 'Machine in the field' },
  action_taken: { pa: 'ਕੰਮ ਹੋ ਗਿਆ', hi: 'काम हो गया', en: 'Work done' },
  closed: { pa: 'ਬੰਦ', hi: 'बंद', en: 'Closed' },
};

export const STATUS_ORDER = ['filed', 'seen', 'machine_assigned', 'in_field', 'action_taken', 'closed'] as const;

export function statusLabel(status: string, language: Language): string {
  return STATUS_LABELS[status]?.[language] ?? status;
}

const MONTHS: Record<Language, string[]> = {
  pa: ['ਜਨਵਰੀ', 'ਫ਼ਰਵਰੀ', 'ਮਾਰਚ', 'ਅਪ੍ਰੈਲ', 'ਮਈ', 'ਜੂਨ', 'ਜੁਲਾਈ', 'ਅਗਸਤ', 'ਸਤੰਬਰ', 'ਅਕਤੂਬਰ', 'ਨਵੰਬਰ', 'ਦਸੰਬਰ'],
  hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/**
 * "2026-10-20T18:02:00+05:30" as the farmer reads it: "20 ਅਕਤੂਬਰ, 18:02", India time. Written by hand
 * because browsers often lack Punjabi month names (Intl gives "M10").
 */
export function indiaClock(at: string, language: Language): string {
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return at;
  const ist = new Date(ms + (5 * 60 + 30) * 60_000);
  const hh = String(ist.getUTCHours()).padStart(2, '0');
  const mm = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${ist.getUTCDate()} ${MONTHS[language][ist.getUTCMonth()]}, ${hh}:${mm}`;
}
