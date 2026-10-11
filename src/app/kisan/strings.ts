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
  // The mic (tap or hold) and its steps
  tapOrHold: { pa: 'ਛੂਹੋ ਜਾਂ ਦਬਾ ਕੇ ਬੋਲੋ', hi: 'छुएँ या दबाकर बोलें', en: 'Tap or hold to talk' },
  micStarting: { pa: 'ਮਾਈਕ ਚਾਲੂ ਹੋ ਰਿਹਾ ਹੈ…', hi: 'माइक चालू हो रहा है…', en: 'Turning the microphone on…' },
  listeningHold: { pa: 'ਸੁਣ ਰਿਹਾ ਹਾਂ {time} · ਛੱਡੋ ਤਾਂ ਭੇਜ ਦਿਆਂਗੇ', hi: 'सुन रहा हूँ {time} · छोड़ते ही भेज देंगे', en: 'Listening {time} · let go to send' },
  listeningTap: { pa: 'ਸੁਣ ਰਿਹਾ ਹਾਂ {time} · ਭੇਜਣ ਲਈ ਛੂਹੋ', hi: 'सुन रहा हूँ {time} · भेजने के लिए छुएँ', en: 'Listening {time} · tap to send' },
  slideToCancel: { pa: '← ਰੱਦ ਕਰਨ ਲਈ ਖੱਬੇ ਖਿੱਚੋ', hi: '← रद्द करने के लिए बाएँ खींचें', en: '← Slide left to cancel' },
  releaseToCancel: { pa: 'ਛੱਡੋ ਤਾਂ ਰੱਦ ਹੋ ਜਾਵੇਗਾ', hi: 'छोड़ते ही रद्द हो जाएगा', en: 'Let go to cancel' },
  stopsByItself: { pa: 'ਚੁੱਪ ਹੋਵੋਗੇ ਤਾਂ ਆਪੇ ਭੇਜ ਦਿਆਂਗੇ', hi: 'चुप होते ही अपने आप भेज देंगे', en: "It sends by itself when you stop talking" },
  cancelled: { pa: 'ਰੱਦ ਕਰ ਦਿੱਤਾ, ਕੁਝ ਨਹੀਂ ਭੇਜਿਆ', hi: 'रद्द कर दिया, कुछ नहीं भेजा', en: 'Cancelled. Nothing was sent.' },
  noSpeech: { pa: 'ਕੁਝ ਸੁਣਾਈ ਨਹੀਂ ਦਿੱਤਾ। ਫ਼ੋਨ ਨੇੜੇ ਕਰਕੇ ਫਿਰ ਬੋਲੋ।', hi: 'कुछ सुनाई नहीं दिया। फ़ोन पास करके फिर बोलें।', en: "I didn't hear anything. Hold the phone closer and try again." },
  tooShort: { pa: 'ਬਹੁਤ ਛੋਟਾ ਸੀ, ਥੋੜ੍ਹਾ ਹੋਰ ਬੋਲੋ', hi: 'बहुत छोटा था, थोड़ा और बोलें', en: 'That was too short. Say a little more.' },
  understanding: { pa: 'ਤੁਹਾਡੀ ਗੱਲ ਸਮਝ ਰਿਹਾ ਹਾਂ…', hi: 'आपकी बात समझ रहा हूँ…', en: 'Understanding what you said…' },
  voiceNote: { pa: 'ਆਵਾਜ਼ ਸੁਨੇਹਾ', hi: 'आवाज़ संदेश', en: 'Voice note' },
  fixHeard: { pa: 'ਗ਼ਲਤ ਸੁਣਿਆ? ਠੀਕ ਕਰੋ', hi: 'ग़लत सुना? ठीक करें', en: 'Heard wrong? Fix it' },
  sendNow: { pa: 'ਭੇਜੋ', hi: 'भेजें', en: 'Send' },
  // What I still need (the agent's missing slots)
  needTitle: { pa: 'ਮੈਨੂੰ ਇਹ ਪਤਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ', hi: 'मुझे यह पता होना चाहिए', en: 'What I need to know' },
  needAll: { pa: 'ਸਭ ਕੁਝ ਪਤਾ ਲੱਗ ਗਿਆ', hi: 'सब कुछ पता चल गया', en: 'I have everything I need' },
  need_village: { pa: 'ਪਿੰਡ', hi: 'गाँव', en: 'Village' },
  need_paddy_area: { pa: 'ਝੋਨਾ', hi: 'धान', en: 'Paddy' },
  need_harvest_date: { pa: 'ਵਾਢੀ', hi: 'कटाई', en: 'Harvest' },
  need_wheat_deadline: { pa: 'ਕਣਕ ਦੀ ਬਿਜਾਈ', hi: 'गेहूँ की बुआई', en: 'Wheat sowing' },
  need_tractors: { pa: 'ਟਰੈਕਟਰ', hi: 'ट्रैक्टर', en: 'Tractors' },
  need_machines: { pa: 'ਮਸ਼ੀਨਾਂ', hi: 'मशीनें', en: 'Machines' },
  // "Try saying…": Gurpreet's own answers
  trySaying: { pa: 'ਇੰਝ ਬੋਲ ਕੇ ਵੇਖੋ', hi: 'ऐसे बोलकर देखें', en: 'Try saying' },
  say_all: {
    pa: 'ਭਵਾਨੀਗੜ੍ਹ, ਸੰਗਰੂਰ। 18 ਕਿੱਲੇ ਝੋਨਾ, ਵਾਢੀ 20 ਅਕਤੂਬਰ, ਕਣਕ 9 ਨਵੰਬਰ ਤੱਕ। ਇੱਕ ਟਰੈਕਟਰ, ਸੁਪਰ ਸੀਡਰ 2 ਦਿਨ।',
    hi: 'भवानीगढ़, संगरूर। 18 किल्ले धान, कटाई 20 अक्टूबर, गेहूँ 9 नवंबर तक। एक ट्रैक्टर, सुपर सीडर 2 दिन।',
    en: 'Bhawanigarh, Sangrur. 18 acres of paddy, harvest 20 October, wheat by 9 November. One tractor, a Super Seeder for 2 days.',
  },
  say_village: { pa: 'ਮੇਰਾ ਪਿੰਡ ਭਵਾਨੀਗੜ੍ਹ ਹੈ, ਜ਼ਿਲ੍ਹਾ ਸੰਗਰੂਰ', hi: 'मेरा गाँव भवानीगढ़ है, ज़िला संगरूर', en: 'My village is Bhawanigarh, in Sangrur' },
  say_paddy_area: { pa: '18 ਕਿੱਲੇ ਝੋਨਾ ਹੈ', hi: '18 किल्ले धान है', en: 'I have 18 acres of paddy' },
  say_harvest_date: { pa: 'ਵਾਢੀ 20 ਅਕਤੂਬਰ ਨੂੰ ਹੋਵੇਗੀ', hi: 'कटाई 20 अक्टूबर को होगी', en: 'Harvest is on 20 October' },
  say_wheat_deadline: { pa: 'ਕਣਕ 9 ਨਵੰਬਰ ਤੱਕ ਬੀਜਣੀ ਹੈ', hi: 'गेहूँ 9 नवंबर तक बोना है', en: 'Wheat must be sown by 9 November' },
  say_tractors: { pa: 'ਮੇਰੇ ਕੋਲ ਇੱਕ ਟਰੈਕਟਰ ਹੈ', hi: 'मेरे पास एक ट्रैक्टर है', en: 'I have one tractor' },
  say_machines: { pa: 'ਸੁਪਰ ਸੀਡਰ 2 ਦਿਨ ਲਈ ਕਿਰਾਏ ਤੇ', hi: 'सुपर सीडर 2 दिन के लिए किराए पर', en: 'A Super Seeder, rented for 2 days' },
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
  forDays: { pa: 'ਕਿੰਨੇ ਦਿਨਾਂ ਲਈ?', hi: 'कितने दिनों के लिए?', en: 'For how many days?' },
  nDays: { pa: '{n} ਦਿਨ', hi: '{n} दिन', en: '{n} {dayWord}' },
  wholeSeason: { pa: 'ਪੂਰਾ ਸੀਜ਼ਨ', hi: 'पूरा सीज़न', en: 'whole season' },
  otherNotCounted: {
    pa: '"ਹੋਰ ਮਸ਼ੀਨ" ਹਿਸਾਬ ਵਿੱਚ ਨਹੀਂ ਗਿਣੀ ਜਾਂਦੀ।',
    hi: '"दूसरी मशीन" हिसाब में नहीं गिनी जाती।',
    en: '"Other machine" isn\'t counted in the check.',
  },

  // Is it enough? (K10)
  checkTitle: { pa: 'ਕੀ ਤੁਹਾਡੀਆਂ ਮਸ਼ੀਨਾਂ ਕਾਫ਼ੀ ਹਨ?', hi: 'क्या आपकी मशीनें काफ़ी हैं?', en: 'Are your machines enough?' },
  checkButton: { pa: 'ਹਿਸਾਬ ਲਾਓ', hi: 'हिसाब लगाएँ', en: 'Work it out' },
  checkAgain: { pa: 'ਫਿਰ ਹਿਸਾਬ ਲਾਓ', hi: 'फिर से हिसाब लगाएँ', en: 'Work it out again' },
  checking: { pa: 'ਹਿਸਾਬ ਲਾ ਰਿਹਾ ਹਾਂ…', hi: 'हिसाब लगा रहा हूँ…', en: 'Working it out…' },
  changed: {
    pa: 'ਖੇਤ ਜਾਂ ਮਸ਼ੀਨਾਂ ਬਦਲ ਗਈਆਂ ਹਨ।',
    hi: 'खेत या मशीनें बदल गई हैं।',
    en: 'Your farm or machines have changed.',
  },
  needPaddy: {
    pa: 'ਪਹਿਲਾਂ ਖੇਤ ਵਾਲੇ ਕਾਰਡ ਤੇ ਝੋਨੇ ਦੇ ਕਿੱਲੇ ਭਰੋ।',
    hi: 'पहले खेत वाले कार्ड पर धान के किल्ले भरें।',
    en: 'Add your paddy acres on the farm card first.',
  },
  needDates: {
    pa: 'ਪਹਿਲਾਂ ਖੇਤ ਵਾਲੇ ਕਾਰਡ ਤੇ ਵਾਢੀ ਅਤੇ ਕਣਕ ਦੀਆਂ ਤਾਰੀਖ਼ਾਂ ਭਰੋ।',
    hi: 'पहले खेत वाले कार्ड पर कटाई और गेहूँ की तारीख़ें भरें।',
    en: 'Add the harvest and wheat dates on the farm card first.',
  },
  verdict_enough: { pa: 'ਕਾਫ਼ੀ ਹਨ', hi: 'काफ़ी हैं', en: 'Enough' },
  verdict_almost: { pa: 'ਲਗਭਗ', hi: 'लगभग', en: 'Almost' },
  verdict_short: { pa: 'ਕਾਫ਼ੀ ਨਹੀਂ', hi: 'काफ़ी नहीं', en: 'Not enough' },
  coveredBy: {
    pa: '{date} ਤੱਕ {total} ਵਿੱਚੋਂ {covered} ਕਿੱਲੇ ਬਿਨਾਂ ਅੱਗ ਦੇ ਸਾਫ਼',
    hi: '{date} तक {total} में से {covered} किल्ले बिना आग के साफ़',
    en: '{covered} of {total} acres cleared by {date} without fire',
  },
  gapLeft: {
    pa: '{gap} ਕਿੱਲੇ ਬਾਕੀ: ਲਗਭਗ {straw} ਟਨ ਪਰਾਲੀ',
    hi: '{gap} किल्ले बाकी: लगभग {straw} टन पराली',
    en: '{gap} acres left: about {straw} t of straw',
  },
  smokeIfBurnt: {
    pa: 'ਜੇ ਸਾੜੀ ਤਾਂ: ਲਗਭਗ {kg} ਕਿਲੋ PM2.5 ਧੂੰਆਂ',
    hi: 'अगर जलाई तो: लगभग {kg} किलो PM2.5 धुआँ',
    en: "If it's burnt: about {kg} kg of PM2.5 smoke",
  },
  moreDays: {
    pa: 'ਲਗਭਗ {days} ਦਿਨ ਹੋਰ {machine} ਨਾਲ ਪੂਰਾ ਹੋ ਜਾਵੇਗਾ',
    hi: 'लगभग {days} दिन और {machine} से पूरा हो जाएगा',
    en: 'About {days} more {dayWord} of a {machine} would clear it',
  },
  assumedDry: {
    pa: 'ਇਹ ਮੰਨ ਕੇ ਕਿ ਸਾਰੇ ਦਿਨ ਸੁੱਕੇ ਰਹਿਣਗੇ। CHC ਯੋਜਨਾ ਮੀਂਹ ਦੀ ਭਵਿੱਖਬਾਣੀ ਵੀ ਵੇਖਦੀ ਹੈ।',
    hi: 'यह मानकर कि सारे दिन सूखे रहेंगे। CHC योजना बारिश का पूर्वानुमान भी देखती है।',
    en: 'This assumes every day is dry. The CHC plan also checks the rain forecast.',
  },

  // From the verdict to action (K11)
  findChc: { pa: 'ਬਾਕੀ ਲਈ CHC ਮਸ਼ੀਨ ਲੱਭੋ', hi: 'बाकी के लिए CHC मशीन ढूँढें', en: 'Find CHC machines for the rest' },
  seeShop: { pa: 'ਕਿਰਾਏ ਜਾਂ ਖਰੀਦਣ ਲਈ ਵੇਖੋ', hi: 'किराए या खरीद के लिए देखें', en: 'See what to rent or buy' },
  needLocation: {
    pa: 'ਪਹਿਲਾਂ ਉੱਪਰ ਖੇਤ ਦੀ ਥਾਂ ਦੱਸੋ ਤਾਂ ਜੋ ਨੇੜੇ ਦੇ CHC ਲੱਭ ਸਕੀਏ।',
    hi: 'पहले ऊपर खेत की जगह बताएँ ताकि पास के CHC ढूँढ सकें।',
    en: 'Set your farm location above first, so we can find CHCs near you.',
  },
  planning: { pa: 'ਨੇੜੇ ਦੀਆਂ CHC ਮਸ਼ੀਨਾਂ ਲੱਭ ਰਿਹਾ ਹਾਂ…', hi: 'पास की CHC मशीनें ढूँढ रहा हूँ…', en: 'Looking for CHC machines near you…' },
  chcPlanTitle: { pa: 'ਸੁਝਾਈਆਂ CHC ਮਸ਼ੀਨਾਂ', hi: 'सुझाई गई CHC मशीनें', en: 'Suggested CHC machines' },
  fromChc: { pa: '{chc} ਤੋਂ', hi: '{chc} से', en: 'from {chc}' },
  withThese: { pa: 'ਇਹਨਾਂ ਨਾਲ: {pct}%', hi: 'इनके साथ: {pct}%', en: 'With these: {pct}%' },
  rainDays: { pa: 'ਮੀਂਹ ਦੀ ਸੰਭਾਵਨਾ: {n} ਦਿਨ', hi: 'बारिश की संभावना: {n} दिन', en: 'Rain expected on {n} days' },
  noChcFree: {
    pa: 'ਤੁਹਾਡੇ ਖੇਤ ਦੇ ਨੇੜੇ ਸਮੇਂ ਸਿਰ ਕੋਈ CHC ਮਸ਼ੀਨ ਖਾਲੀ ਨਹੀਂ।',
    hi: 'आपके खेत के पास समय पर कोई CHC मशीन खाली नहीं।',
    en: 'No CHC machine near your farm is free in time.',
  },
  demoChc: { pa: 'ਡੈਮੋ CHC ਜਾਣਕਾਰੀ', hi: 'डेमो CHC जानकारी', en: 'Demo CHC data' },
  notBookedYet: {
    pa: 'ਹਾਲੇ ਕੁਝ ਬੁੱਕ ਨਹੀਂ ਹੋਇਆ। ਯੋਜਨਾ ਵਾਲੀ ਗੱਲਬਾਤ ਵਿੱਚ ਮੰਗੋ, ਵਿਭਾਗ ਨੂੰ ਤੁਹਾਡੀ ਬੇਨਤੀ ਪਹੁੰਚ ਜਾਵੇਗੀ।',
    hi: 'अभी कुछ बुक नहीं हुआ। योजना वाली बातचीत में माँगिए, विभाग को आपकी बिनती पहुँच जाएगी।',
    en: "Nothing is booked yet. Ask for it in the Plan conversation and your request goes to the department.",
  },
  askInChat: { pa: 'ਗੱਲਬਾਤ ਵਿੱਚ ਮੰਗੋ', hi: 'बातचीत में माँगें', en: 'Ask in the conversation' },

  // Machines tab: the gap first, the season strip, what-if days, booking through Saathi
  gapNotCovered: { pa: '{gap} ਕਿੱਲੇ ਬਾਕੀ ਰਹਿ ਜਾਣਗੇ', hi: '{gap} किल्ले बाकी रह जाएँगे', en: '{gap} acres not covered' },
  allCovered: { pa: 'ਸਾਰੇ {total} ਕਿੱਲੇ ਬਿਨਾਂ ਅੱਗ ਦੇ ਸਾਫ਼', hi: 'सारे {total} किल्ले बिना आग के साफ़', en: 'All {total} acres cleared without fire' },
  atRisk: {
    pa: '{straw} ਟਨ ਪਰਾਲੀ · ਸਾੜੀ ਤਾਂ ਲਗਭਗ {kg} ਕਿਲੋ PM2.5 ਧੂੰਆਂ',
    hi: '{straw} टन पराली · जलाई तो लगभग {kg} किलो PM2.5 धुआँ',
    en: '{straw} t of straw · about {kg} kg of PM2.5 smoke if burnt',
  },
  whatIfDays: {
    pa: '{machine} ਦੇ {days} ਦਿਨ ਹੋਰ → {pct}%',
    hi: '{machine} के {days} दिन और → {pct}%',
    en: '{days} more {dayWord} of the {machine} → {pct}%',
  },
  closeGap: { pa: 'ਬਾਕੀ ਦਾ ਹੱਲ ਲੱਭੋ', hi: 'बाकी का हल ढूँढें', en: 'Close the gap' },
  workingOut: { pa: 'ਹਿਸਾਬ ਲਾ ਰਿਹਾ ਹਾਂ…', hi: 'हिसाब लगा रहा हूँ…', en: 'Working it out…' },
  seasonTitle: { pa: 'ਤੁਹਾਡਾ ਮੌਸਮ: {from} ਤੋਂ {to}', hi: 'आपका मौसम: {from} से {to}', en: 'Your season: {from} to {to}' },
  daysLeftToSow: { pa: 'ਕਣਕ ਬੀਜਣ ਲਈ {n} ਦਿਨ ਬਾਕੀ', hi: 'गेहूँ बोने के लिए {n} दिन बाकी', en: '{n} days left to sow wheat' },
  sowingPassed: { pa: 'ਕਣਕ ਦੀ ਬਿਜਾਈ ਦੀ ਤਰੀਕ ਲੰਘ ਗਈ', hi: 'गेहूँ की बुआई की तारीख़ निकल गई', en: 'The wheat sowing date has passed' },
  day_own: { pa: 'ਤੁਹਾਡੀਆਂ ਮਸ਼ੀਨਾਂ', hi: 'आपकी मशीनें', en: 'your machines' },
  day_chc: { pa: 'CHC ਬੁਕਿੰਗ', hi: 'CHC बुकिंग', en: 'CHC booking' },
  day_rain: { pa: 'ਮੀਂਹ', hi: 'बारिश', en: 'rain' },
  day_idle: { pa: 'ਕੋਈ ਮਸ਼ੀਨ ਨਹੀਂ', hi: 'कोई मशीन नहीं', en: 'no machine' },
  seasonHint: {
    pa: 'ਮੀਂਹ ਅਤੇ CHC ਦੇ ਦਿਨ CHC ਮਸ਼ੀਨਾਂ ਲੱਭਣ ਤੋਂ ਬਾਅਦ ਦਿਸਣਗੇ।',
    hi: 'बारिश और CHC के दिन CHC मशीनें ढूँढने के बाद दिखेंगे।',
    en: 'Rain and CHC days show once you look for CHC machines.',
  },
  askSaathiBook: { pa: 'ਸਾਥੀ ਨੂੰ ਬੁੱਕ ਕਰਨ ਲਈ ਕਹੋ', hi: 'साथी से बुक करने को कहें', en: 'Ask Saathi to book it' },
  bookPlanMsg: {
    pa: 'ਕਿਰਪਾ ਕਰਕੇ ਮੇਰੇ ਲਈ ਇਹ CHC ਮਸ਼ੀਨਾਂ ਬੁੱਕ ਕਰ ਦਿਓ: {items}।',
    hi: 'कृपया मेरे लिए ये CHC मशीनें बुक कर दीजिए: {items}।',
    en: 'Please book these CHC machines for me: {items}.',
  },
  bookOneMsg: {
    pa: 'ਕਿਰਪਾ ਕਰਕੇ {chc} ਤੋਂ {acres} ਕਿੱਲਿਆਂ ਲਈ {machine} ਬੁੱਕ ਕਰ ਦਿਓ, {deadline} ਤੋਂ ਪਹਿਲਾਂ।',
    hi: 'कृपया {chc} से {acres} किल्लों के लिए {machine} बुक कर दीजिए, {deadline} से पहले।',
    en: 'Please book a {machine} from {chc} for {acres} acres, before {deadline}.',
  },
  daysStep: { pa: 'ਦਿਨ', hi: 'दिन', en: 'Days' },
  countStep: { pa: 'ਗਿਣਤੀ', hi: 'गिनती', en: 'How many' },

  // Shop: the best pick and the rest
  bestForYou: { pa: 'ਤੁਹਾਡੇ ਲਈ ਸਭ ਤੋਂ ਵਧੀਆ', hi: 'आपके लिए सबसे अच्छा', en: 'Best for you' },
  rentA: { pa: '{machine} ਕਿਰਾਏ ਤੇ ਲਓ', hi: '{machine} किराए पर लें', en: 'Rent a {machine}' },
  forYourGap: { pa: 'ਤੁਹਾਡੇ ਬਾਕੀ {gap} ਕਿੱਲਿਆਂ ਲਈ, {date} ਤੋਂ ਪਹਿਲਾਂ', hi: 'आपके बाकी {gap} किल्लों के लिए, {date} से पहले', en: 'For your {gap} acres left, before {date}' },
  statClears: { pa: 'ਸਾਫ਼ ਕਰੇਗਾ', hi: 'साफ़ करेगा', en: 'it clears' },
  statCost: { pa: 'ਖ਼ਰਚਾ, ₹{rate}/ਕਿੱਲਾ', hi: 'ख़र्च, ₹{rate}/किल्ला', en: 'cost, ₹{rate}/acre' },
  statFree: { pa: 'ਪਹਿਲਾ ਖ਼ਾਲੀ ਦਿਨ', hi: 'पहला ख़ाली दिन', en: 'first free day' },
  askChc: { pa: 'CHC ਤੋਂ ਪੁੱਛੋ', hi: 'CHC से पूछें', en: 'ask the CHC' },
  acresN: { pa: '{n} ਕਿੱਲੇ', hi: '{n} किल्ले', en: '{n} acres' },
  freeOnly: {
    pa: 'ਤੁਹਾਡੀ ਤਰੀਕ ਤੋਂ ਪਹਿਲਾਂ ਸਿਰਫ਼ {n} ਦਿਨ ਖ਼ਾਲੀ',
    hi: 'आपकी तारीख़ से पहले सिर्फ़ {n} दिन ख़ाली',
    en: 'Free only {n} {dayWord} before your deadline',
  },
  stillShortAsk: {
    pa: 'ਹਾਲੇ {acres} ਕਿੱਲੇ ਬਾਕੀ: ਸਾਥੀ ਵਿਭਾਗ ਤੋਂ ਹੋਰ ਮਸ਼ੀਨ ਮੰਗ ਸਕਦਾ ਹੈ',
    hi: 'अभी {acres} किल्ले बाकी: साथी विभाग से और मशीन माँग सकता है',
    en: '{acres} acres still short: Saathi can ask the department for more',
  },
  noRental: {
    pa: 'ਨੇੜੇ ਕਿਸੇ CHC ਕੋਲ ਤੁਹਾਡੇ ਦਿਨਾਂ ਵਿੱਚ ਖ਼ਾਲੀ ਮਸ਼ੀਨ ਨਹੀਂ। ਸਾਥੀ ਵਿਭਾਗ ਤੋਂ ਮੰਗ ਸਕਦਾ ਹੈ।',
    hi: 'पास के किसी CHC के पास आपके दिनों में ख़ाली मशीन नहीं। साथी विभाग से माँग सकता है।',
    en: 'No CHC near you has a machine free in your season. Saathi can ask the department.',
  },
  pricesNeedLocation: {
    pa: 'CHC ਦੇ ਰੇਟ ਅਤੇ ਖ਼ਾਲੀ ਦਿਨ ਵੇਖਣ ਲਈ ਉੱਪਰ ਖੇਤ ਦੀ ਥਾਂ ਦੱਸੋ।',
    hi: 'CHC के रेट और ख़ाली दिन देखने के लिए ऊपर खेत की जगह बताएँ।',
    en: 'Set your farm location above to see CHC rates and free days.',
  },
  checkingChcs: { pa: 'ਨੇੜੇ ਦੇ CHC ਵੇਖ ਰਿਹਾ ਹਾਂ…', hi: 'पास के CHC देख रहा हूँ…', en: 'Checking CHCs near you…' },
  group_inTime: { pa: 'ਸਮੇਂ ਸਿਰ ਸਾਰਾ ਸਾਫ਼ ਕਰਦੇ ਹਨ', hi: 'समय पर सारा साफ़ करते हैं', en: 'Clear all of it in time' },
  group_part: { pa: 'ਕੁਝ ਹਿੱਸਾ ਸਾਫ਼ ਕਰਦੇ ਹਨ', hi: 'कुछ हिस्सा साफ़ करते हैं', en: 'Clear part of it' },
  group_other: { pa: 'ਬਹੁਤ ਦੇਰ, ਜਾਂ ਹਿਸਾਬ ਵਿੱਚ ਨਹੀਂ', hi: 'बहुत देर, या हिसाब में नहीं', en: 'Too late, or not in the check yet' },
  group_all: { pa: 'ਸਾਰੀਆਂ ਮਸ਼ੀਨਾਂ', hi: 'सारी मशीनें', en: 'Everything in the shop' },
  showDetails: { pa: 'ਪੂਰੀ ਜਾਣਕਾਰੀ', hi: 'पूरी जानकारी', en: 'Details' },
  hideDetails: { pa: 'ਛੋਟਾ ਕਰੋ', hi: 'छोटा करें', en: 'Hide details' },
  needMachineMsg: {
    pa: 'ਮੈਨੂੰ {deadline} ਤੋਂ ਪਹਿਲਾਂ {acres} ਕਿੱਲਿਆਂ ਲਈ {machine} ਚਾਹੀਦਾ ਹੈ। ਨੇੜੇ ਕੋਈ ਖ਼ਾਲੀ ਨਹੀਂ, ਕਿਰਪਾ ਕਰਕੇ ਵਿਭਾਗ ਤੋਂ ਮੰਗ ਲਓ।',
    hi: 'मुझे {deadline} से पहले {acres} किल्लों के लिए {machine} चाहिए। पास में कोई ख़ाली नहीं, कृपया विभाग से माँग लीजिए।',
    en: 'I need a {machine} for {acres} acres before {deadline}. None near me is free; please ask the department.',
  },
  rentSummary: { pa: '{chc}: ₹{cost}, {date} ਤੋਂ ਖ਼ਾਲੀ', hi: '{chc}: ₹{cost}, {date} से ख़ाली', en: '{chc}: ₹{cost}, free from {date}' },

  // Shop (K14–K17)
  shopTitle: { pa: 'ਕਿਰਾਏ ਤੇ ਲਓ ਜਾਂ ਖਰੀਦੋ', hi: 'किराए पर लें या खरीदें', en: 'Rent or buy' },
  shopIntro: {
    pa: 'ਪਰਾਲੀ ਸਾੜਨ ਤੋਂ ਬਚਾਉਣ ਵਾਲੀਆਂ ਮਸ਼ੀਨਾਂ। ਪਹਿਲਾਂ CHC ਤੋਂ ਕਿਰਾਏ ਤੇ ਲੈਣਾ ਸਸਤਾ ਪੈਂਦਾ ਹੈ।',
    hi: 'पराली जलाने से बचाने वाली मशीनें। पहले CHC से किराए पर लेना सस्ता पड़ता है।',
    en: 'What lets you clear stubble without burning it. Renting from a CHC is usually the cheaper first step.',
  },
  filterFits: { pa: 'ਤੁਹਾਡੇ ਖੇਤ ਲਈ', hi: 'आपके खेत के लिए', en: 'For your farm' },
  filterMachines: { pa: 'ਮਸ਼ੀਨਾਂ', hi: 'मशीनें', en: 'Machines' },
  filterDecomposer: { pa: 'ਡੀਕੰਪੋਜ਼ਰ', hi: 'डीकंपोज़र', en: 'Decomposer' },
  fitsBadge: { pa: 'ਤੁਹਾਡੇ ਖੇਤ ਲਈ ਠੀਕ', hi: 'आपके खेत के लिए ठीक', en: 'Fits your farm' },
  fitsNeedFarm: {
    pa: 'ਮਸ਼ੀਨਾਂ ਵਾਲੇ ਹਿੱਸੇ ਵਿੱਚ ਖੇਤ ਦੀ ਜਾਣਕਾਰੀ ਭਰੋ ਤਾਂ ਜੋ ਦੱਸ ਸਕੀਏ ਕਿ ਕੀ ਠੀਕ ਰਹੇਗਾ।',
    hi: 'मशीनें वाले हिस्से में खेत की जानकारी भरें ताकि बता सकें कि क्या ठीक रहेगा।',
    en: 'Fill in your farm on the Machines tab and we can say what fits.',
  },
  noGap: {
    pa: 'ਤੁਹਾਡੀਆਂ ਮਸ਼ੀਨਾਂ ਨਾਲ ਪੂਰਾ ਖੇਤ ਸਾਫ਼ ਹੋ ਜਾਂਦਾ ਹੈ। ਹੋਰ ਕੁਝ ਨਹੀਂ ਚਾਹੀਦਾ।',
    hi: 'आपकी मशीनों से पूरा खेत साफ़ हो जाता है। और कुछ नहीं चाहिए।',
    en: 'Your machines already clear the whole field. You need nothing more.',
  },
  clearsGap: {
    pa: 'ਤੁਹਾਡੇ ਬਾਕੀ {gap} ਕਿੱਲੇ ਲਗਭਗ {inDays} ਸਾਫ਼ ਕਰਦਾ ਹੈ',
    hi: 'आपके बाकी {gap} किल्ले करीब {inDays} साफ़ करता है',
    en: 'Clears your {gap} acres left in about {inDays}',
  },
  clearsPart: {
    pa: 'ਬਾਕੀ {gap} ਵਿੱਚੋਂ {acres} ਕਿੱਲੇ ਸਾਫ਼ ਕਰਦਾ ਹੈ',
    hi: 'बाकी {gap} में से {acres} किल्ले साफ़ करता है',
    en: 'Clears {acres} of your {gap} acres left',
  },
  needsTractor: {
    pa: 'ਇਸ ਲਈ ਖਾਲੀ ਟਰੈਕਟਰ ਚਾਹੀਦਾ ਹੈ।',
    hi: 'इसके लिए खाली ट्रैक्टर चाहिए।',
    en: 'This needs a free tractor.',
  },
  acresPerDay: { pa: 'ਇੱਕ ਦਿਨ ਵਿੱਚ ਲਗਭਗ {n} ਕਿੱਲੇ', hi: 'एक दिन में करीब {n} किल्ले', en: 'About {n} acres a day' },
  notInCheck: {
    pa: 'ਇਹ ਮਸ਼ੀਨ ਹਾਲੇ ਹਿਸਾਬ ਵਿੱਚ ਨਹੀਂ।',
    hi: 'यह मशीन अभी हिसाब में नहीं है।',
    en: "Not in the 'is it enough?' check yet.",
  },
  priceAsk: {
    pa: 'ਕੀਮਤ: CHC ਜਾਂ ਡੀਲਰ ਤੋਂ ਪੁੱਛੋ',
    hi: 'कीमत: CHC या डीलर से पूछें',
    en: 'Price: ask the CHC or dealer',
  },
  priceAbout: { pa: 'ਕੀਮਤ: ਲਗਭਗ ₹{amount}, {per}', hi: 'कीमत: करीब ₹{amount}, {per}', en: 'Price: about ₹{amount}, {per}' },
  subsidyFarmer: {
    pa: 'ਖ਼ੁਦ ਖਰੀਦੋ ਤਾਂ ਸਬਸਿਡੀ: {pct}%, ਵੱਧ ਤੋਂ ਵੱਧ {max}',
    hi: 'खुद खरीदें तो सब्सिडी: {pct}%, ज़्यादा से ज़्यादा {max}',
    en: 'Subsidy if you buy: {pct}%, up to {max}',
  },
  subsidyChc: {
    pa: 'CHC ਜਾਂ ਸਹਿਕਾਰੀ ਸਭਾ ਲਈ: {pct}%, ਵੱਧ ਤੋਂ ਵੱਧ {max}',
    hi: 'CHC या सहकारी समिति के लिए: {pct}%, ज़्यादा से ज़्यादा {max}',
    en: 'For a CHC or co-operative: {pct}%, up to {max}',
  },
  rentFromChc: { pa: 'CHC ਤੋਂ ਕਿਰਾਏ ਤੇ ਲਓ', hi: 'CHC से किराए पर लें', en: 'Rent from a CHC' },
  applySubsidy: { pa: 'ਸਬਸਿਡੀ ਲਈ ਅਰਜ਼ੀ ↗', hi: 'सब्सिडी के लिए आवेदन ↗', en: 'Apply for subsidy ↗' },
  findingChcs: { pa: 'CHC ਲੱਭ ਰਿਹਾ ਹਾਂ…', hi: 'CHC ढूँढ रहा हूँ…', en: 'Looking for CHCs…' },
  noChcHas: {
    pa: '{km} ਕਿਲੋਮੀਟਰ ਦੇ ਅੰਦਰ ਕਿਸੇ CHC ਕੋਲ ਇਹ ਮਸ਼ੀਨ ਨਹੀਂ।',
    hi: '{km} किलोमीटर के अंदर किसी CHC के पास यह मशीन नहीं।',
    en: 'No CHC within {km} km has this machine.',
  },
  chcUntracked: {
    pa: 'ਸਾਡੀ CHC ਸੂਚੀ ਵਿੱਚ ਇਹ ਮਸ਼ੀਨ ਹਾਲੇ ਨਹੀਂ। ਨੇੜੇ ਦੇ CHC ਤੋਂ ਸਿੱਧਾ ਪੁੱਛੋ।',
    hi: 'हमारी CHC सूची में यह मशीन अभी नहीं है। पास के CHC से सीधे पूछें।',
    en: "Our CHC list doesn't track this machine yet. Ask your nearest CHC directly.",
  },
  chcRate: { pa: '₹{rate} ਪ੍ਰਤੀ ਕਿੱਲਾ', hi: '₹{rate} प्रति किल्ला', en: '₹{rate} an acre' },
  chcAway: { pa: '{km} ਕਿਲੋਮੀਟਰ ਦੂਰ', hi: '{km} किलोमीटर दूर', en: '{km} km away' },
  tooLate: {
    pa: 'ਇਸ ਸੀਜ਼ਨ ਲਈ ਦੇਰ ਹੋ ਗਈ: ਇਸਨੂੰ ਲਗਭਗ {need} ਦਿਨ ਚਾਹੀਦੇ ਹਨ, ਤੁਹਾਡੇ ਕੋਲ {have} ਹਨ।',
    hi: 'इस सीज़न के लिए देर हो गई: इसे करीब {need} दिन चाहिए, आपके पास {have} हैं।',
    en: 'Too late this season: it needs about {need} days and you have {have}.',
  },
  inTime: {
    pa: 'ਸਮਾਂ ਹੈ: ਇਸਨੂੰ ਲਗਭਗ {need} ਦਿਨ ਚਾਹੀਦੇ ਹਨ, ਤੁਹਾਡੇ ਕੋਲ {have} ਹਨ।',
    hi: 'समय है: इसे करीब {need} दिन चाहिए, आपके पास {have} हैं।',
    en: 'In time: it needs about {need} days and you have {have}.',
  },
  askKvk: {
    pa: 'ਆਪਣੇ KVK ਜਾਂ ਖੇਤੀਬਾੜੀ ਦਫ਼ਤਰ ਤੋਂ ਪੁੱਛੋ।',
    hi: 'अपने KVK या कृषि कार्यालय से पूछें।',
    en: 'Ask your KVK or agriculture office for it.',
  },
  shopDisclaimer: {
    pa: 'ਕੀਮਤਾਂ ਅਤੇ ਸਬਸਿਡੀ ਬਦਲਦੀਆਂ ਰਹਿੰਦੀਆਂ ਹਨ; ਖਰੀਦਣ ਤੋਂ ਪਹਿਲਾਂ ਵੇਚਣ ਵਾਲੇ ਜਾਂ ਖੇਤੀਬਾੜੀ ਦਫ਼ਤਰ ਨਾਲ ਪੱਕਾ ਕਰੋ। ਸਾਂਸ ਕੋਈ ਕਮਿਸ਼ਨ ਨਹੀਂ ਲੈਂਦਾ।',
    hi: 'कीमतें और सब्सिडी बदलती रहती हैं; खरीदने से पहले विक्रेता या कृषि कार्यालय से पक्का करें। सांस कोई कमीशन नहीं लेता।',
    en: 'Prices and subsidies change; check with the seller or agriculture office before you buy. Saans takes no commission.',
  },
  shopSources: { pa: 'ਸਰੋਤ', hi: 'स्रोत', en: 'Sources' },

  // Help: numbers to call (K23), complaints (K20) and tickets (K21)
  callTitle: { pa: 'ਫ਼ੋਨ ਕਰਨ ਲਈ ਨੰਬਰ', hi: 'फ़ोन करने के लिए नंबर', en: 'Numbers to call' },
  call: { pa: 'ਫ਼ੋਨ ਕਰੋ', hi: 'फ़ोन करें', en: 'Call' },
  copy: { pa: 'ਕਾਪੀ', hi: 'कॉपी', en: 'Copy' },
  copied: { pa: 'ਕਾਪੀ ਹੋ ਗਿਆ', hi: 'कॉपी हो गया', en: 'Copied' },
  setLocationForNumbers: {
    pa: 'ਆਪਣੇ ਜ਼ਿਲ੍ਹੇ ਦੇ ਦਫ਼ਤਰਾਂ ਦੇ ਨੰਬਰ ਵੇਖਣ ਲਈ ਉੱਪਰ ਖੇਤ ਦੀ ਥਾਂ ਦੱਸੋ।',
    hi: 'अपने ज़िले के दफ़्तरों के नंबर देखने के लिए ऊपर खेत की जगह बताएँ।',
    en: "Set your farm location above to see your district's offices.",
  },
  onlyChecked: {
    pa: 'ਅਸੀਂ ਸਿਰਫ਼ ਉਹੀ ਨੰਬਰ ਦਿੰਦੇ ਹਾਂ ਜੋ ਸਰਕਾਰੀ ਵੈੱਬਸਾਈਟਾਂ ਤੇ ਮਿਲੇ।',
    hi: 'हम सिर्फ़ वही नंबर देते हैं जो सरकारी वेबसाइटों पर मिले।',
    en: 'We only list numbers we found on official websites.',
  },
  checkedOn: { pa: '{date} ਨੂੰ ਵੇਖਿਆ', hi: '{date} को देखा', en: 'checked {date}' },
  complainTitle: { pa: 'ਸ਼ਿਕਾਇਤ ਕਰੋ', hi: 'शिकायत करें', en: 'Make a complaint' },
  complainIntro: {
    pa: 'ਜੋ ਮਦਦ ਮਿਲਣੀ ਸੀ ਉਸ ਬਾਰੇ: CHC, ਮਸ਼ੀਨ, ਸਬਸਿਡੀ ਜਾਂ ਅਫ਼ਸਰ। ਸ਼ਿਕਾਇਤ ਜ਼ਿਲ੍ਹਾ ਖੇਤੀਬਾੜੀ ਅਫ਼ਸਰ ਕੋਲ ਜਾਂਦੀ ਹੈ।',
    hi: 'जो मदद मिलनी थी उसके बारे में: CHC, मशीन, सब्सिडी या अधिकारी। शिकायत ज़िला कृषि अधिकारी के पास जाती है।',
    en: 'About help you were promised: a CHC, a machine, a subsidy or an officer. It goes to the district agriculture officer.',
  },
  startComplaint: { pa: 'ਸ਼ਿਕਾਇਤ ਸ਼ੁਰੂ ਕਰੋ', hi: 'शिकायत शुरू करें', en: 'Start a complaint' },
  whatHappened: { pa: 'ਕੀ ਹੋਇਆ?', hi: 'क्या हुआ?', en: 'What happened?' },
  g_chc_no_show: { pa: 'ਬੁੱਕ ਕੀਤੀ CHC ਮਸ਼ੀਨ ਨਹੀਂ ਆਈ', hi: 'बुक की गई CHC मशीन नहीं आई', en: "The CHC machine didn't come" },
  g_chc_overcharge: { pa: 'CHC ਨੇ ਵੱਧ ਪੈਸੇ ਲਏ', hi: 'CHC ने ज़्यादा पैसे लिए', en: 'The CHC charged too much' },
  g_machine_broken: { pa: 'ਮਸ਼ੀਨ ਖ਼ਰਾਬ ਹੋ ਗਈ', hi: 'मशीन ख़राब हो गई', en: 'The machine broke down' },
  g_subsidy_delay: { pa: 'ਸਬਸਿਡੀ ਨਹੀਂ ਮਿਲੀ', hi: 'सब्सिडी नहीं मिली', en: "My subsidy hasn't come" },
  g_officer_conduct: { pa: 'ਕਿਸੇ ਅਫ਼ਸਰ ਦਾ ਵਤੀਰਾ', hi: 'किसी अधिकारी का बर्ताव', en: "An officer's behaviour" },
  g_other: { pa: 'ਕੁਝ ਹੋਰ', hi: 'कुछ और', en: 'Something else' },
  next: { pa: 'ਅੱਗੇ', hi: 'आगे', en: 'Next' },
  goBack: { pa: 'ਪਿੱਛੇ', hi: 'पीछे', en: 'Back' },
  tellMore: { pa: 'ਹੋਰ ਦੱਸੋ', hi: 'और बताइए', en: 'Tell us more' },
  tellMoreHint: { pa: 'ਕਦੋਂ, ਕੀ ਵਾਅਦਾ ਸੀ, ਕੀ ਹੋਇਆ', hi: 'कब, क्या वादा था, क्या हुआ', en: 'When, what was promised, what happened' },
  whichChc: { pa: 'ਕਿਹੜਾ CHC?', hi: 'कौन सा CHC?', en: 'Which CHC?' },
  addPhoto: { pa: 'ਫ਼ੋਟੋ ਜੋੜੋ (ਜੇ ਚਾਹੋ)', hi: 'फ़ोटो जोड़ें (चाहें तो)', en: 'Add a photo (optional)' },
  checkAndSend: { pa: 'ਵੇਖੋ ਅਤੇ ਭੇਜੋ', hi: 'देखें और भेजें', en: 'Check and send' },
  sendComplaint: { pa: 'ਸ਼ਿਕਾਇਤ ਭੇਜੋ', hi: 'शिकायत भेजें', en: 'Send complaint' },
  sendingComplaint: { pa: 'ਭੇਜ ਰਿਹਾ ਹਾਂ…', hi: 'भेज रहा हूँ…', en: 'Sending…' },
  complaintNeedsLocation: {
    pa: 'ਪਹਿਲਾਂ ਉੱਪਰ ਖੇਤ ਦੀ ਥਾਂ ਦੱਸੋ; ਸ਼ਿਕਾਇਤ ਉਸੇ ਜ਼ਿਲ੍ਹੇ ਨੂੰ ਜਾਂਦੀ ਹੈ।',
    hi: 'पहले ऊपर खेत की जगह बताएँ; शिकायत उसी ज़िले को जाती है।',
    en: 'Set your farm location above first; the complaint goes to that district.',
  },
  complaintFailed: { pa: 'ਸ਼ਿਕਾਇਤ ਨਹੀਂ ਗਈ: {why}', hi: 'शिकायत नहीं गई: {why}', en: "The complaint didn't send: {why}" },
  smsLabel: { pa: 'ਟਿਕਟ ਨੰਬਰ SMS ਤੇ ਭੇਜੋ (ਜੇ ਚਾਹੋ)', hi: 'टिकट नंबर SMS पर भेजें (चाहें तो)', en: 'Text me the ticket number (optional)' },
  smsHint: {
    pa: 'ਤੁਹਾਡਾ 10 ਅੰਕਾਂ ਦਾ ਮੋਬਾਈਲ ਨੰਬਰ। ਇਹ ਸਿਰਫ਼ ਇਸ ਇੱਕ SMS ਲਈ ਹੈ ਅਤੇ ਅਫ਼ਸਰ ਨੂੰ ਨਹੀਂ ਜਾਂਦਾ।',
    hi: 'आपका 10 अंकों का मोबाइल नंबर। यह सिर्फ़ इस एक SMS के लिए है और अधिकारी को नहीं जाता।',
    en: "Your 10-digit mobile number. It's used for this one SMS and isn't sent to the officer.",
  },
  smsInvalid: {
    pa: 'ਮੋਬਾਈਲ ਨੰਬਰ 10 ਅੰਕਾਂ ਦਾ ਹੋਵੇ ਅਤੇ 6, 7, 8 ਜਾਂ 9 ਨਾਲ ਸ਼ੁਰੂ ਹੋਵੇ।',
    hi: 'मोबाइल नंबर 10 अंकों का हो और 6, 7, 8 या 9 से शुरू हो।',
    en: 'A mobile number has 10 digits and starts with 6, 7, 8 or 9.',
  },
  smsSending: { pa: 'SMS ਭੇਜ ਰਿਹਾ ਹਾਂ…', hi: 'SMS भेज रहा हूँ…', en: 'Sending the SMS…' },
  smsSent: { pa: 'ਟਿਕਟ ਨੰਬਰ {to} ਤੇ SMS ਕਰ ਦਿੱਤਾ', hi: 'टिकट नंबर {to} पर SMS कर दिया', en: 'Ticket number texted to {to}' },
  smsFailed: {
    pa: 'SMS ਨਹੀਂ ਗਿਆ। ਟਿਕਟ ਨੰਬਰ ਲਿਖ ਲਓ।',
    hi: 'SMS नहीं गया। टिकट नंबर लिख लें।',
    en: "The SMS didn't go. Please write the ticket number down.",
  },
  sentTitle: { pa: 'ਸ਼ਿਕਾਇਤ ਭੇਜ ਦਿੱਤੀ', hi: 'शिकायत भेज दी', en: 'Complaint sent' },
  yourTicket: { pa: 'ਤੁਹਾਡਾ ਟਿਕਟ ਨੰਬਰ', hi: 'आपका टिकट नंबर', en: 'Your ticket number' },
  keepTicket: {
    pa: "ਇਹ ਨੰਬਰ ਸੰਭਾਲ ਕੇ ਰੱਖੋ। ਇਹ 'ਮੇਰੀਆਂ ਸ਼ਿਕਾਇਤਾਂ' ਵਿੱਚ ਵੀ ਹੈ।",
    hi: "यह नंबर सँभालकर रखें। यह 'मेरी शिकायतें' में भी है।",
    en: "Keep this number. It's also saved under My complaints.",
  },
  done: { pa: 'ਠੀਕ ਹੈ', hi: 'ठीक है', en: 'Done' },
  myTickets: { pa: 'ਮੇਰੀਆਂ ਸ਼ਿਕਾਇਤਾਂ', hi: 'मेरी शिकायतें', en: 'My complaints' },
  noTickets: { pa: 'ਹਾਲੇ ਕੋਈ ਸ਼ਿਕਾਇਤ ਨਹੀਂ।', hi: 'अभी कोई शिकायत नहीं।', en: 'No complaints yet.' },
  refresh: { pa: 'ਤਾਜ਼ਾ ਕਰੋ', hi: 'ताज़ा करें', en: 'Refresh' },
  sentOn: { pa: 'ਭੇਜੀ: {date}', hi: 'भेजी: {date}', en: 'Sent {date}' },
  t_received: { pa: 'ਮਿਲ ਗਈ', hi: 'मिल गई', en: 'Received' },
  t_sent_to_officer: { pa: 'ਅਫ਼ਸਰ ਨੂੰ ਭੇਜੀ', hi: 'अधिकारी को भेजी', en: 'Sent to the officer' },
  t_case_opened: { pa: 'ਅਫ਼ਸਰ ਕੋਲ ਹੈ', hi: 'अधिकारी के पास है', en: 'The officer has it' },
  t_merged: { pa: 'ਪਹਿਲੀ ਸ਼ਿਕਾਇਤ ਨਾਲ ਜੋੜੀ', hi: 'पहली शिकायत से जोड़ी', en: 'Joined an earlier complaint' },
  t_acted_on: { pa: 'ਕਾਰਵਾਈ ਹੋਈ', hi: 'कार्रवाई हुई', en: 'Action taken' },
  t_closed: { pa: 'ਬੰਦ', hi: 'बंद', en: 'Closed' },
  statusUnknown: { pa: 'ਹਾਲੇ ਪਤਾ ਨਹੀਂ ਲੱਗਿਆ', hi: 'अभी पता नहीं चला', en: "Couldn't check right now" },
  ignoredTitle: { pa: 'ਸਮੇਂ ਸਿਰ ਕਿਸੇ ਅਫ਼ਸਰ ਨੇ ਕਾਰਵਾਈ ਨਹੀਂ ਕੀਤੀ', hi: 'समय पर किसी अधिकारी ने कार्रवाई नहीं की', en: 'No officer acted in time' },
  ignoredCall: {
    pa: 'ਸ਼ਿਕਾਇਤ ਵੱਡੇ ਅਫ਼ਸਰ ਕੋਲ ਭੇਜ ਦਿੱਤੀ ਗਈ ਹੈ। ਹੁਣੇ ਫ਼ੋਨ ਕਰੋ ਅਤੇ ਆਪਣਾ ਟਿਕਟ ਨੰਬਰ ਦੱਸੋ।',
    hi: 'शिकायत बड़े अधिकारी को भेज दी गई है। अभी फ़ोन करें और अपना टिकट नंबर बताएँ।',
    en: 'Your complaint has gone up to a senior officer. Call now and give your ticket number.',
  },
  notHappy: {
    pa: 'ਜਵਾਬ ਤੋਂ ਖ਼ੁਸ਼ ਨਹੀਂ? ਉੱਪਰ ਦਿੱਤੇ ਨੰਬਰਾਂ ਤੇ ਫ਼ੋਨ ਕਰੋ ਅਤੇ ਆਪਣਾ ਟਿਕਟ ਨੰਬਰ ਦੱਸੋ।',
    hi: 'जवाब से ख़ुश नहीं? ऊपर दिए नंबरों पर फ़ोन करें और अपना टिकट नंबर बताएँ।',
    en: 'Not happy with the answer? Call the numbers above and give your ticket number.',
  },
} satisfies Record<string, Record<Language, string>>;

export type StringKey = keyof typeof STRINGS;

export function say(key: StringKey, language: Language): string {
  return STRINGS[key][language];
}

/** English's "day" or "days" for a count; Punjabi and Hindi strings don't use it. */
export function dayWord(n: number): string {
  return n === 1 ? 'day' : 'days';
}

/** "in 1 day" / "in 2 days" as each language says it after "about": ਦਿਨ/ਦਿਨਾਂ ਵਿੱਚ, दिन/दिनों में. */
export function inDays(n: number, language: Language): string {
  const one = n === 1;
  if (language === 'pa') return `${n} ${one ? 'ਦਿਨ' : 'ਦਿਨਾਂ'} ਵਿੱਚ`;
  if (language === 'hi') return `${n} ${one ? 'दिन' : 'दिनों'} में`;
  return `${n} ${one ? 'day' : 'days'}`;
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
