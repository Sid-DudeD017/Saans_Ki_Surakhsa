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

  // The page and its tabs
  subtitle: { pa: 'ਪਰਾਲੀ ਬਿਨਾਂ ਅੱਗ ਦੇ ਸਾਂਭੋ', hi: 'पराली बिना आग के सँभालें', en: 'Clear your stubble without fire' },
  tabs: { pa: 'ਕਿਸਾਨ ਸਾਥੀ ਦੇ ਹਿੱਸੇ', hi: 'किसान साथी के हिस्से', en: 'Kisan Saathi sections' },
  tabPlan: { pa: 'ਯੋਜਨਾ', hi: 'योजना', en: 'Plan' },
  tabMachines: { pa: 'ਮਸ਼ੀਨਾਂ', hi: 'मशीनें', en: 'Machines' },
  tabShop: { pa: 'ਦੁਕਾਨ', hi: 'दुकान', en: 'Shop' },
  tabHelp: { pa: 'ਮਦਦ', hi: 'मदद', en: 'Help' },
  comingSoon: { pa: 'ਜਲਦੀ ਆ ਰਿਹਾ ਹੈ', hi: 'जल्द आ रहा है', en: 'Coming soon' },
  shopSoon: {
    pa: 'ਕਿਰਾਏ ਜਾਂ ਖਰੀਦਣ ਲਈ ਮਸ਼ੀਨਾਂ ਅਤੇ ਡੀਕੰਪੋਜ਼ਰ ਇੱਥੇ ਆਉਣਗੇ।',
    hi: 'किराए या खरीद के लिए मशीनें और डीकंपोज़र यहाँ आएँगे।',
    en: 'Machines and decomposer to rent or buy will appear here.',
  },
  helpSoon: {
    pa: 'ਸ਼ਿਕਾਇਤ ਦਰਜ ਕਰਨਾ ਅਤੇ ਫ਼ੋਨ ਕਰਨ ਲਈ ਨੰਬਰ ਇੱਥੇ ਆਉਣਗੇ।',
    hi: 'शिकायत दर्ज करना और फ़ोन करने के लिए नंबर यहाँ आएँगे।',
    en: 'Complaints and numbers to call will appear here.',
  },
  emergency: {
    pa: 'ਅੱਗ ਫੈਲ ਰਹੀ ਹੋਵੇ ਜਾਂ ਖ਼ਤਰਾ ਹੋਵੇ: 112 ਤੇ ਫ਼ੋਨ ਕਰੋ',
    hi: 'आग फैल रही हो या ख़तरा हो: 112 पर फ़ोन करें',
    en: 'Fire spreading or danger: call 112',
  },

  // Farm location (K3)
  locationNotSet: { pa: 'ਖੇਤ ਦੀ ਥਾਂ ਹਾਲੇ ਨਹੀਂ ਦੱਸੀ', hi: 'खेत की जगह अभी नहीं बताई', en: 'Farm location not set' },
  farmAt: { pa: 'ਖੇਤ: {place}', hi: 'खेत: {place}', en: 'Farm: {place}' },
  near: { pa: '{lat}, {lon} ਦੇ ਨੇੜੇ', hi: '{lat}, {lon} के पास', en: 'near {lat}, {lon}' },
  setLocation: { pa: 'ਥਾਂ ਦੱਸੋ', hi: 'जगह बताएँ', en: 'Set location' },
  change: { pa: 'ਬਦਲੋ', hi: 'बदलें', en: 'Change' },
  useMyLocation: { pa: 'ਮੇਰੀ ਥਾਂ ਵਰਤੋ', hi: 'मेरी जगह इस्तेमाल करें', en: 'Use my location' },
  locating: { pa: 'ਥਾਂ ਲੱਭ ਰਿਹਾ ਹਾਂ…', hi: 'जगह ढूँढ रहा हूँ…', en: 'Finding your location…' },
  locationDenied: {
    pa: 'ਫ਼ੋਨ ਨੇ ਥਾਂ ਨਹੀਂ ਦੱਸੀ। ਪਿੰਡ ਦਾ ਨਾਂ ਲਿਖੋ।',
    hi: 'फ़ोन ने जगह नहीं बताई। गाँव का नाम लिखें।',
    en: "Your phone didn't share its location. Type your village instead.",
  },
  villageName: { pa: 'ਪਿੰਡ ਦਾ ਨਾਂ', hi: 'गाँव का नाम', en: 'Village name' },
  locationPrivacy: {
    pa: 'ਅਸੀਂ ਸਿਰਫ਼ ਲਗਭਗ ਥਾਂ (ਕਰੀਬ 1 ਕਿਲੋਮੀਟਰ) ਰੱਖਦੇ ਹਾਂ, ਇਸੇ ਫ਼ੋਨ ਤੇ।',
    hi: 'हम सिर्फ़ लगभग जगह (करीब 1 किलोमीटर) रखते हैं, इसी फ़ोन पर।',
    en: 'We keep only the rough spot (about 1 km), on this phone.',
  },
  save: { pa: 'ਸੰਭਾਲੋ', hi: 'सहेजें', en: 'Save' },
  cancel: { pa: 'ਰੱਦ ਕਰੋ', hi: 'रद्द करें', en: 'Cancel' },

  // Farm profile (K4)
  yourFarm: { pa: 'ਤੁਹਾਡਾ ਖੇਤ', hi: 'आपका खेत', en: 'Your farm' },
  farmEmpty: {
    pa: 'ਖੇਤ ਬਾਰੇ ਦੱਸੋ ਤਾਂ ਜੋ ਹਿਸਾਬ ਲਾ ਸਕੀਏ। ਯੋਜਨਾ ਵਾਲੀ ਗੱਲਬਾਤ ਵੀ ਇਹ ਭਰ ਦਿੰਦੀ ਹੈ।',
    hi: 'खेत के बारे में बताइए ताकि हिसाब लगा सकें। योजना वाली बातचीत भी इसे भर देती है।',
    en: 'Tell us about your farm so we can work things out. The Plan conversation fills this in too.',
  },
  fillFarm: { pa: 'ਖੇਤ ਦੀ ਜਾਣਕਾਰੀ ਭਰੋ', hi: 'खेत की जानकारी भरें', en: 'Add farm details' },
  fromChat: { pa: 'ਗੱਲਬਾਤ ਤੋਂ', hi: 'बातचीत से', en: 'From your conversation' },
  killa: { pa: 'ਕਿੱਲੇ', hi: 'किल्ले', en: 'acres' },
  farmInvalid: {
    pa: 'ਝੋਨੇ ਦੇ ਕਿੱਲੇ ਅਤੇ ਟਰੈਕਟਰ 0 ਜਾਂ ਵੱਧ ਹੋਣ, ਅਤੇ ਕਣਕ ਦੀ ਤਾਰੀਖ਼ ਵਾਢੀ ਤੋਂ ਬਾਅਦ।',
    hi: 'धान के किल्ले और ट्रैक्टर 0 या ज़्यादा हों, और गेहूँ की तारीख़ कटाई के बाद।',
    en: 'Paddy and tractors must be 0 or more, and the wheat date must come after harvest.',
  },

  // Machine photos (K7, K8)
  machinesTitle: { pa: 'ਤੁਹਾਡੀਆਂ ਮਸ਼ੀਨਾਂ', hi: 'आपकी मशीनें', en: 'Your machines' },
  machinesIntro: {
    pa: 'ਹਰ ਮਸ਼ੀਨ ਦੀ ਫ਼ੋਟੋ ਖਿੱਚੋ। ਫਿਰ ਅਸੀਂ ਦੱਸਾਂਗੇ ਕਿ ਇਹ ਤੁਹਾਡੇ ਖੇਤ ਲਈ ਕਾਫ਼ੀ ਹਨ ਜਾਂ ਨਹੀਂ।',
    hi: 'हर मशीन की फ़ोटो खींचिए। फिर हम बताएँगे कि ये आपके खेत के लिए काफ़ी हैं या नहीं।',
    en: "Take a photo of each machine. Then we'll tell you if they're enough for your farm.",
  },
  takePhoto: { pa: 'ਫ਼ੋਟੋ ਖਿੱਚੋ', hi: 'फ़ोटो खींचें', en: 'Take photo' },
  fromGallery: { pa: 'ਗੈਲਰੀ ਵਿੱਚੋਂ ਚੁਣੋ', hi: 'गैलरी से चुनें', en: 'Choose from gallery' },
  sendingPhoto: { pa: 'ਫ਼ੋਟੋ ਭੇਜ ਰਿਹਾ ਹਾਂ…', hi: 'फ़ोटो भेज रहा हूँ…', en: 'Sending photo…' },
  looksLike: { pa: 'ਇਹ {machine} ਲੱਗਦੀ ਹੈ', hi: 'यह {machine} लगती है', en: 'This looks like a {machine}' },
  sure: { pa: '{pct}% ਯਕੀਨ', hi: '{pct}% यकीन', en: '{pct}% sure' },
  tapToCorrect: { pa: 'ਗ਼ਲਤ ਹੈ ਤਾਂ ਸਹੀ ਮਸ਼ੀਨ ਛੂਹੋ', hi: 'ग़लत है तो सही मशीन छुएँ', en: "If that's wrong, tap the right one" },
  whichMachine: { pa: 'ਇਹ ਕਿਹੜੀ ਮਸ਼ੀਨ ਹੈ?', hi: 'यह कौन सी मशीन है?', en: 'Which machine is this?' },
  noMachineSeen: {
    pa: 'ਫ਼ੋਟੋ ਵਿੱਚ ਕੋਈ ਮਸ਼ੀਨ ਨਹੀਂ ਦਿਸੀ। ਫਿਰ ਖਿੱਚੋ ਜਾਂ ਹੇਠਾਂ ਚੁਣੋ।',
    hi: 'फ़ोटो में कोई मशीन नहीं दिखी। फिर से खींचें या नीचे चुनें।',
    en: "We couldn't see a machine. Take another photo or pick one below.",
  },
  notSure: {
    pa: 'ਪੱਕਾ ਨਹੀਂ ਪਤਾ ਲੱਗਿਆ। ਹੇਠਾਂ ਚੁਣੋ।',
    hi: 'पक्का पता नहीं चला। नीचे चुनें।',
    en: "We're not sure which machine this is. Pick it below.",
  },
  aiUnavailable: {
    pa: 'ਮਸ਼ੀਨ ਦੀ ਪਛਾਣ ਹਾਲੇ ਨਹੀਂ ਹੋ ਰਹੀ। ਹੇਠਾਂ ਚੁਣੋ।',
    hi: 'मशीन की पहचान अभी नहीं हो रही। नीचे चुनें।',
    en: "Machine recognition isn't available right now. Pick it below.",
  },
  howMany: { pa: 'ਕਿੰਨੀਆਂ?', hi: 'कितनी?', en: 'How many?' },
  fewer: { pa: 'ਇੱਕ ਘੱਟ', hi: 'एक कम', en: 'One fewer' },
  more: { pa: 'ਇੱਕ ਵੱਧ', hi: 'एक ज़्यादा', en: 'One more' },
  mine: { pa: 'ਆਪਣੀ', hi: 'अपनी', en: 'Mine' },
  rented: { pa: 'ਕਿਰਾਏ ਦੀ', hi: 'किराए की', en: 'Rented' },
  addMachine: { pa: 'ਮੇਰੀਆਂ ਮਸ਼ੀਨਾਂ ਵਿੱਚ ਜੋੜੋ', hi: 'मेरी मशीनों में जोड़ें', en: 'Add to my machines' },
  remove: { pa: 'ਹਟਾਓ', hi: 'हटाएँ', en: 'Remove' },
  noMachinesYet: { pa: 'ਹਾਲੇ ਕੋਈ ਮਸ਼ੀਨ ਨਹੀਂ ਜੋੜੀ', hi: 'अभी कोई मशीन नहीं जोड़ी', en: 'No machines added yet' },
  photoFailed: { pa: 'ਫ਼ੋਟੋ ਨਹੀਂ ਗਈ: {why}', hi: 'फ़ोटो नहीं गई: {why}', en: "The photo didn't send: {why}" },
  tryAgain: { pa: 'ਫਿਰ ਕੋਸ਼ਿਸ਼ ਕਰੋ', hi: 'फिर से कोशिश करें', en: 'Try again' },
  photoPrivacy: {
    pa: 'ਭੇਜੀ ਫ਼ੋਟੋ ਵਿੱਚ ਚਿਹਰੇ ਧੁੰਦਲੇ ਕੀਤੇ ਜਾਂਦੇ ਹਨ ਅਤੇ ਥਾਂ ਦੀ ਜਾਣਕਾਰੀ ਮਿਟਾ ਦਿੱਤੀ ਜਾਂਦੀ ਹੈ।',
    hi: 'भेजी गई फ़ोटो में चेहरे धुंधले किए जाते हैं और जगह की जानकारी हटा दी जाती है।',
    en: "In the photo we keep, faces are blurred and the photo's location data is removed.",
  },
  checkNext: {
    pa: 'ਅਗਲਾ ਕਦਮ: ਕੀ ਇਹ ਮਸ਼ੀਨਾਂ ਕਾਫ਼ੀ ਹਨ? (ਜਲਦੀ ਆ ਰਿਹਾ ਹੈ)',
    hi: 'अगला कदम: क्या ये मशीनें काफ़ी हैं? (जल्द आ रहा है)',
    en: 'Next: are these machines enough? (coming soon)',
  },
} satisfies Record<string, Record<Language, string>>;

export type StringKey = keyof typeof STRINGS;

export function say(key: StringKey, language: Language): string {
  return STRINGS[key][language];
}

/** say() with {name} placeholders filled in. */
export function sayWith(key: StringKey, language: Language, values: Record<string, string | number>): string {
  return say(key, language).replace(/\{(\w+)\}/g, (all, name: string) => (name in values ? String(values[name]) : all));
}

const MACHINE_LABELS: Record<string, Record<Language, string>> = {
  happy_seeder: { pa: 'ਹੈਪੀ ਸੀਡਰ', hi: 'हैप्पी सीडर', en: 'Happy Seeder' },
  super_seeder: { pa: 'ਸੁਪਰ ਸੀਡਰ', hi: 'सुपर सीडर', en: 'Super Seeder' },
  mulcher_rmb: { pa: 'ਮਲਚਰ + ਉਲਟਾਵਾਂ ਹਲ', hi: 'मल्चर + पलटने वाला हल', en: 'Mulcher + RMB plough' },
  baler: { pa: 'ਬੇਲਰ', hi: 'बेलर', en: 'Baler' },
  other: { pa: 'ਹੋਰ ਮਸ਼ੀਨ', hi: 'दूसरी मशीन', en: 'Other machine' },
};

export function machineLabel(type: string, language: Language): string {
  return MACHINE_LABELS[type]?.[language] ?? type;
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

/** "2026-11-09" as "9 ਨਵੰਬਰ" / "9 नवंबर" / "9 Nov". */
export function dayMonth(isoDay: string, language: Language): string {
  const [, m, d] = isoDay.split('-').map(Number);
  return m >= 1 && m <= 12 && d ? `${d} ${MONTHS[language][m - 1]}` : isoDay;
}
