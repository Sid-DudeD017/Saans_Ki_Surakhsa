// Saans Command's words in English, Hindi and Punjabi. The Hindi and Punjabi need a native speaker's
// check before launch, like Ghar ki Hawa's (gharTranslations.ts, marked VERIFY).
import type { SupportedLanguage } from '../../components/ui/LanguageSwitcher';

type Words = Record<SupportedLanguage, string>;

export const WORDS = {
  tabCases: { en: 'Cases', hi: 'मामले', pa: 'ਮਾਮਲੇ' },
  tabMap: { en: 'Map', hi: 'नक्शा', pa: 'ਨਕਸ਼ਾ' },
  tabCase: { en: 'Case', hi: 'मामला', pa: 'ਮਾਮਲਾ' },
  sections: { en: 'Command sections', hi: 'कमांड के हिस्से', pa: 'ਕਮਾਂਡ ਦੇ ਹਿੱਸੇ' },

  countCases: { en: 'Cases', hi: 'मामले', pa: 'ਮਾਮਲੇ' },
  countHelp: { en: 'Help requests', hi: 'मदद के अनुरोध', pa: 'ਮਦਦ ਦੀਆਂ ਬੇਨਤੀਆਂ' },
  countEscalated: { en: 'Escalated', hi: 'ऊपर भेजे गए', pa: 'ਉੱਪਰ ਭੇਜੇ ਗਏ' },
  countFires: { en: 'Satellite fires', hi: 'उपग्रह से दिखी आग', pa: 'ਉਪਗ੍ਰਹਿ ਤੋਂ ਦਿਸੀ ਅੱਗ' },

  status: { en: 'Status', hi: 'स्थिति', pa: 'ਸਥਿਤੀ' },
  district: { en: 'District', hi: 'ज़िला', pa: 'ਜ਼ਿਲ੍ਹਾ' },
  open: { en: 'Open', hi: 'खुले', pa: 'ਖੁੱਲ੍ਹੇ' },
  approved: { en: 'Help approved', hi: 'मदद मंज़ूर', pa: 'ਮਦਦ ਮਨਜ਼ੂਰ' },
  changed: { en: 'Changed', hi: 'बदले गए', pa: 'ਬਦਲੇ ਗਏ' },
  closed: { en: 'Closed', hi: 'बंद', pa: 'ਬੰਦ' },
  all: { en: 'All', hi: 'सभी', pa: 'ਸਾਰੇ' },
  allDistricts: { en: 'All districts', hi: 'सभी ज़िले', pa: 'ਸਾਰੇ ਜ਼ਿਲ੍ਹੇ' },
  unassigned: { en: 'Unassigned', hi: 'बिना ज़िले के', pa: 'ਬਿਨਾਂ ਜ਼ਿਲ੍ਹੇ ਦੇ' },
  signedInAs: { en: 'Signed in as', hi: 'इस नाम से साइन इन', pa: 'ਇਸ ਨਾਮ ਨਾਲ ਸਾਈਨ ਇਨ' },

  loading: { en: 'Loading cases…', hi: 'मामले खुल रहे हैं…', pa: 'ਮਾਮਲੇ ਖੁੱਲ੍ਹ ਰਹੇ ਹਨ…' },
  noQueue: { en: 'No queue', hi: 'सूची नहीं मिली', pa: 'ਸੂਚੀ ਨਹੀਂ ਮਿਲੀ' },
  noMatch: { en: 'No cases match.', hi: 'कोई मामला मेल नहीं खाता।', pa: 'ਕੋਈ ਮਾਮਲਾ ਮੇਲ ਨਹੀਂ ਖਾਂਦਾ।' },
  tapPin: { en: 'Tap a pin to see the case.', hi: 'मामला देखने के लिए पिन दबाएँ।', pa: 'ਮਾਮਲਾ ਵੇਖਣ ਲਈ ਪਿੰਨ ਦਬਾਓ।' },
  onMap: { en: 'on the map', hi: 'नक्शे पर', pa: 'ਨਕਸ਼ੇ ਉੱਤੇ' },
  openCase: { en: 'Open case', hi: 'मामला खोलें', pa: 'ਮਾਮਲਾ ਖੋਲ੍ਹੋ' },
  pickCase: { en: 'Pick a case from the list or the map.', hi: 'सूची या नक्शे से कोई मामला चुनें।', pa: 'ਸੂਚੀ ਜਾਂ ਨਕਸ਼ੇ ਤੋਂ ਕੋਈ ਮਾਮਲਾ ਚੁਣੋ।' },
  allCases: { en: 'All cases', hi: 'सभी मामले', pa: 'ਸਾਰੇ ਮਾਮਲੇ' },
  cantOpen: { en: "Couldn't open the case", hi: 'मामला नहीं खुल सका', pa: 'ਮਾਮਲਾ ਨਹੀਂ ਖੁੱਲ੍ਹ ਸਕਿਆ' },
  opening: { en: 'Opening the case…', hi: 'मामला खुल रहा है…', pa: 'ਮਾਮਲਾ ਖੁੱਲ੍ਹ ਰਿਹਾ ਹੈ…' },
  mapLabel: { en: 'Cases on the map', hi: 'नक्शे पर मामले', pa: 'ਨਕਸ਼ੇ ਉੱਤੇ ਮਾਮਲੇ' },
  mapKey: { en: 'Map key', hi: 'नक्शे की कुंजी', pa: 'ਨਕਸ਼ੇ ਦੀ ਕੁੰਜੀ' },
  pinReport: { en: 'Report', hi: 'शिकायत', pa: 'ਸ਼ਿਕਾਇਤ' },
  pinHelp: { en: 'Farmer asked for help', hi: 'किसान ने मदद माँगी', pa: 'ਕਿਸਾਨ ਨੇ ਮਦਦ ਮੰਗੀ' },

  escalated: { en: 'Escalated', hi: 'ऊपर भेजा गया', pa: 'ਉੱਪਰ ਭੇਜਿਆ ਗਿਆ' },
  actBy: { en: 'Act by', hi: 'कार्रवाई की आख़िरी तारीख़', pa: 'ਕਾਰਵਾਈ ਦੀ ਆਖ਼ਰੀ ਤਾਰੀਖ਼' },
  helpLine: { en: 'Help request: offer a machine first', hi: 'मदद का अनुरोध: पहले मशीन दें', pa: 'ਮਦਦ ਦੀ ਬੇਨਤੀ: ਪਹਿਲਾਂ ਮਸ਼ੀਨ ਦਿਓ' },
  reportsMerged: { en: 'reports merged', hi: 'शिकायतें जुड़ीं', pa: 'ਸ਼ਿਕਾਇਤਾਂ ਜੁੜੀਆਂ' },
  satelliteSaw: { en: 'Satellite saw a fire', hi: 'उपग्रह ने आग देखी', pa: 'ਉਪਗ੍ਰਹਿ ਨੇ ਅੱਗ ਵੇਖੀ' },
} satisfies Record<string, Words>;

export type WordKey = keyof typeof WORDS;

export const say = (key: WordKey, language: SupportedLanguage) => WORDS[key][language] ?? WORDS[key].en;

/** What each kind of case is, for the list and the map. */
export const TYPE_WORDS: Record<string, Words> = {
  farm_fire: { en: 'Farm fire', hi: 'खेत में आग', pa: 'ਖੇਤ ਵਿੱਚ ਅੱਗ' },
  garbage: { en: 'Garbage burning', hi: 'कूड़ा जलाना', pa: 'ਕੂੜਾ ਸਾੜਨਾ' },
  vehicle: { en: 'Smoky vehicle', hi: 'धुआँ छोड़ता वाहन', pa: 'ਧੂੰਆਂ ਛੱਡਦਾ ਵਾਹਨ' },
  firecrackers: { en: 'Firecrackers', hi: 'पटाखे', pa: 'ਪਟਾਕੇ' },
  farmer_support: { en: 'Farmer asks for a machine', hi: 'किसान को मशीन चाहिए', pa: 'ਕਿਸਾਨ ਨੂੰ ਮਸ਼ੀਨ ਚਾਹੀਦੀ ਹੈ' },
  kisan_grievance: { en: "Farmer's complaint", hi: 'किसान की शिकायत', pa: 'ਕਿਸਾਨ ਦੀ ਸ਼ਿਕਾਇਤ' },
};

export const typeName = (type: string, language: SupportedLanguage) => TYPE_WORDS[type]?.[language] ?? TYPE_WORDS[type]?.en ?? type;

/** One case's screen (CaseDetailPanel.tsx). {name} marks a value filled in by fill(). */
export const DETAIL = {
  grievance: {
    chc_no_show: { en: "The CHC machine didn't come", hi: 'CHC की मशीन नहीं आई', pa: 'CHC ਦੀ ਮਸ਼ੀਨ ਨਹੀਂ ਆਈ' },
    chc_overcharge: { en: 'The CHC charged too much', hi: 'CHC ने ज़्यादा पैसे लिए', pa: 'CHC ਨੇ ਵੱਧ ਪੈਸੇ ਲਏ' },
    machine_broken: { en: 'The machine broke down', hi: 'मशीन ख़राब हो गई', pa: 'ਮਸ਼ੀਨ ਖ਼ਰਾਬ ਹੋ ਗਈ' },
    subsidy_delay: { en: 'The subsidy is late', hi: 'सब्सिडी में देरी', pa: 'ਸਬਸਿਡੀ ਵਿੱਚ ਦੇਰੀ' },
    officer_conduct: { en: "An officer's behaviour", hi: 'किसी अधिकारी का व्यवहार', pa: 'ਕਿਸੇ ਅਧਿਕਾਰੀ ਦਾ ਵਿਹਾਰ' },
    other: { en: 'Something else', hi: 'कुछ और', pa: 'ਕੁਝ ਹੋਰ' },
  } as Record<string, Words>,
  status: {
    OPEN: { en: 'Open', hi: 'खुला', pa: 'ਖੁੱਲ੍ਹਾ' },
    ACTION_APPROVED: { en: 'Help approved', hi: 'मदद मंज़ूर', pa: 'ਮਦਦ ਮਨਜ਼ੂਰ' },
    ACTION_CHANGED: { en: 'Changed', hi: 'बदला गया', pa: 'ਬਦਲਿਆ ਗਿਆ' },
    CLOSED: { en: 'Closed', hi: 'बंद', pa: 'ਬੰਦ' },
  } as Record<string, Words>,
  action: {
    APPROVE: { en: 'Send the machine', hi: 'मशीन भेजें', pa: 'ਮਸ਼ੀਨ ਭੇਜੋ' },
    CHANGE: { en: 'Send a different machine', hi: 'दूसरी मशीन भेजें', pa: 'ਦੂਜੀ ਮਸ਼ੀਨ ਭੇਜੋ' },
    REJECT: { en: 'Reject the recommendation', hi: 'सुझाव नामंज़ूर करें', pa: 'ਸੁਝਾਅ ਨਾਮਨਜ਼ੂਰ ਕਰੋ' },
    MARK_IN_FIELD: { en: 'Officer in the field', hi: 'अधिकारी मौके पर', pa: 'ਅਧਿਕਾਰੀ ਮੌਕੇ ਉੱਤੇ' },
    RECORD_ACTION_TAKEN: { en: 'Record action taken', hi: 'की गई कार्रवाई दर्ज करें', pa: 'ਕੀਤੀ ਕਾਰਵਾਈ ਦਰਜ ਕਰੋ' },
    CLOSE: { en: 'Close the case', hi: 'मामला बंद करें', pa: 'ਮਾਮਲਾ ਬੰਦ ਕਰੋ' },
    ESCALATE: { en: 'Escalated', hi: 'ऊपर भेजा गया', pa: 'ਉੱਪਰ ਭੇਜਿਆ ਗਿਆ' },
  } as Record<string, Words>,
  verification: {
    SATELLITE_CORROBORATED: { en: 'Satellite saw a fire', hi: 'उपग्रह ने आग देखी', pa: 'ਉਪਗ੍ਰਹਿ ਨੇ ਅੱਗ ਵੇਖੀ' },
    NO_MATCH: { en: 'No satellite fire nearby', hi: 'पास में उपग्रह से कोई आग नहीं', pa: 'ਨੇੜੇ ਉਪਗ੍ਰਹਿ ਤੋਂ ਕੋਈ ਅੱਗ ਨਹੀਂ' },
    NEEDS_REVIEW: { en: 'Evidence needs review', hi: 'सबूत की जाँच ज़रूरी', pa: 'ਸਬੂਤ ਦੀ ਜਾਂਚ ਜ਼ਰੂਰੀ' },
  } as Record<string, Words>,
  reportsMerged: { en: '{n} reports merged', hi: '{n} शिकायतें जुड़ीं', pa: '{n} ਸ਼ਿਕਾਇਤਾਂ ਜੁੜੀਆਂ' },
  version: { en: 'version', hi: 'संस्करण', pa: 'ਸੰਸਕਰਣ' },
  reported: { en: 'Reported', hi: 'शिकायत', pa: 'ਸ਼ਿਕਾਇਤ' },
  actBy: { en: 'Act by', hi: 'कार्रवाई की आख़िरी तारीख़', pa: 'ਕਾਰਵਾਈ ਦੀ ਆਖ਼ਰੀ ਤਾਰੀਖ਼' },
  escalated: { en: 'Escalated', hi: 'ऊपर भेजा गया', pa: 'ਉੱਪਰ ਭੇਜਿਆ ਗਿਆ' },
  escalatedText: {
    en: 'The deadline passed with no action, so the case went to {to} at {at}.',
    hi: 'समय सीमा बिना कार्रवाई के बीत गई, इसलिए मामला {at} पर {to} को भेजा गया।',
    pa: 'ਸਮਾਂ ਸੀਮਾ ਬਿਨਾਂ ਕਾਰਵਾਈ ਬੀਤ ਗਈ, ਇਸ ਲਈ ਮਾਮਲਾ {at} ਤੇ {to} ਨੂੰ ਭੇਜਿਆ ਗਿਆ।',
  },
  helpFirst: { en: 'Help before penalty: this farmer asked for a machine', hi: 'जुर्माने से पहले मदद: इस किसान ने मशीन माँगी है', pa: 'ਜੁਰਮਾਨੇ ਤੋਂ ਪਹਿਲਾਂ ਮਦਦ: ਇਸ ਕਿਸਾਨ ਨੇ ਮਸ਼ੀਨ ਮੰਗੀ ਹੈ' },
  helpIs: { en: "The farmer's help request is {status}", hi: 'किसान का मदद अनुरोध: {status}', pa: 'ਕਿਸਾਨ ਦੀ ਮਦਦ ਦੀ ਬੇਨਤੀ: {status}' },
  farmLine: {
    en: "{crop}, {acres} acres; {pct}% covered by the farmer's own plan",
    hi: '{crop}, {acres} एकड़; किसान की अपनी योजना से {pct}% पूरा',
    pa: '{crop}, {acres} ਏਕੜ; ਕਿਸਾਨ ਦੀ ਆਪਣੀ ਯੋਜਨਾ ਨਾਲ {pct}% ਪੂਰਾ',
  },
  stillNeed: { en: '{acres} acres still need a {machine}', hi: '{acres} एकड़ के लिए अभी {machine} चाहिए', pa: '{acres} ਏਕੜ ਲਈ ਅਜੇ {machine} ਚਾਹੀਦੀ ਹੈ' },
  neededBetween: { en: 'Needed between', hi: 'कब चाहिए', pa: 'ਕਦੋਂ ਚਾਹੀਦੀ ਹੈ' },
  fromTo: { en: '{from} and {to}', hi: '{from} से {to}', pa: '{from} ਤੋਂ {to}' },
  farm: { en: 'Farm', hi: 'खेत', pa: 'ਖੇਤ' },
  fromReport: { en: '{d} from the report', hi: 'शिकायत से {d}', pa: 'ਸ਼ਿਕਾਇਤ ਤੋਂ {d}' },
  twoFarms: { en: 'Two farms are about as close', hi: 'दो खेत लगभग बराबर पास हैं', pa: 'ਦੋ ਖੇਤ ਲਗਭਗ ਬਰਾਬਰ ਨੇੜੇ ਹਨ' },
  twoFarmsText: {
    en: 'Another open request ({id}) is within 100 m of the same distance. Check which farm is burning before you send a machine.',
    hi: 'एक और खुला अनुरोध ({id}) लगभग उतनी ही दूरी (100 मी के अंदर) पर है। मशीन भेजने से पहले देखें कि कौन-सा खेत जल रहा है।',
    pa: 'ਇੱਕ ਹੋਰ ਖੁੱਲ੍ਹੀ ਬੇਨਤੀ ({id}) ਲਗਭਗ ਉਨੀ ਹੀ ਦੂਰੀ (100 ਮੀ. ਦੇ ਅੰਦਰ) ਤੇ ਹੈ। ਮਸ਼ੀਨ ਭੇਜਣ ਤੋਂ ਪਹਿਲਾਂ ਵੇਖੋ ਕਿ ਕਿਹੜਾ ਖੇਤ ਸੜ ਰਿਹਾ ਹੈ।',
  },
  machineFree: { en: '{machine} at {chc}, free from {from} to {to}.', hi: '{chc} पर {machine}, {from} से {to} तक ख़ाली।', pa: '{chc} ਤੇ {machine}, {from} ਤੋਂ {to} ਤੱਕ ਖ਼ਾਲੀ।' },
  noMachine: { en: "No CHC machine of this type is free in the farmer's window.", hi: 'किसान के समय में इस तरह की कोई CHC मशीन ख़ाली नहीं है।', pa: 'ਕਿਸਾਨ ਦੇ ਸਮੇਂ ਵਿੱਚ ਇਸ ਕਿਸਮ ਦੀ ਕੋਈ CHC ਮਸ਼ੀਨ ਖ਼ਾਲੀ ਨਹੀਂ।' },
  theRequest: { en: 'The request', hi: 'अनुरोध', pa: 'ਬੇਨਤੀ' },
  theComplaint: { en: "The farmer's complaint", hi: 'किसान की शिकायत', pa: 'ਕਿਸਾਨ ਦੀ ਸ਼ਿਕਾਇਤ' },
  theReport: { en: 'The report', hi: 'शिकायत', pa: 'ਸ਼ਿਕਾਇਤ' },
  evidence: { en: 'Evidence', hi: 'सबूत', pa: 'ਸਬੂਤ' },
  satellite: { en: 'Satellite', hi: 'उपग्रह', pa: 'ਉਪਗ੍ਰਹਿ' },
  firmsFire: { en: 'FIRMS fire {d} away, {at}', hi: 'FIRMS आग {d} दूर, {at}', pa: 'FIRMS ਅੱਗ {d} ਦੂਰ, {at}' },
  sentTo: { en: 'Sent to', hi: 'किसे भेजा', pa: 'ਕਿਸਨੂੰ ਭੇਜਿਆ' },
  penalty: { en: 'Penalty', hi: 'जुर्माना', pa: 'ਜੁਰਮਾਨਾ' },
  penaltyFirst: { en: 'Possible, but offer the machine first', hi: 'हो सकता है, पर पहले मशीन दें', pa: 'ਹੋ ਸਕਦਾ ਹੈ, ਪਰ ਪਹਿਲਾਂ ਮਸ਼ੀਨ ਦਿਓ' },
  penaltyPossible: { en: 'Possible', hi: 'हो सकता है', pa: 'ਹੋ ਸਕਦਾ ਹੈ' },
  penaltyNeverComplaint: { en: "Never: this is the farmer's complaint", hi: 'कभी नहीं: यह किसान की शिकायत है', pa: 'ਕਦੇ ਨਹੀਂ: ਇਹ ਕਿਸਾਨ ਦੀ ਸ਼ਿਕਾਇਤ ਹੈ' },
  penaltyNeverHelp: { en: 'Never: this is a request for help', hi: 'कभी नहीं: यह मदद का अनुरोध है', pa: 'ਕਦੇ ਨਹੀਂ: ਇਹ ਮਦਦ ਦੀ ਬੇਨਤੀ ਹੈ' },
  mapLabel: { en: 'The report, the farm, the CHC and any satellite fire', hi: 'शिकायत, खेत, CHC और उपग्रह से दिखी आग', pa: 'ਸ਼ਿਕਾਇਤ, ਖੇਤ, CHC ਅਤੇ ਉਪਗ੍ਰਹਿ ਤੋਂ ਦਿਸੀ ਅੱਗ' },
  theFarm: { en: 'The farm', hi: 'खेत', pa: 'ਖੇਤ' },
  farmAsking: { en: 'Farm asking for help', hi: 'मदद माँगने वाला खेत', pa: 'ਮਦਦ ਮੰਗਣ ਵਾਲਾ ਖੇਤ' },
  satelliteFire: { en: 'Satellite fire', hi: 'उपग्रह से दिखी आग', pa: 'ਉਪਗ੍ਰਹਿ ਤੋਂ ਦਿਸੀ ਅੱਗ' },
  decide: { en: 'Decide', hi: 'फ़ैसला करें', pa: 'ਫ਼ੈਸਲਾ ਕਰੋ' },
  isClosed: { en: 'This case is closed.', hi: 'यह मामला बंद है।', pa: 'ਇਹ ਮਾਮਲਾ ਬੰਦ ਹੈ।' },
  reason: { en: 'Reason (recorded with the decision)', hi: 'कारण (फ़ैसले के साथ दर्ज होगा)', pa: 'ਕਾਰਨ (ਫ਼ੈਸਲੇ ਨਾਲ ਦਰਜ ਹੋਵੇਗਾ)' },
  machineToSend: { en: 'Machine to send', hi: 'भेजने वाली मशीन', pa: 'ਭੇਜਣ ਵਾਲੀ ਮਸ਼ੀਨ' },
  needReason: { en: 'Write a reason first: every decision is recorded with one.', hi: 'पहले कारण लिखें: हर फ़ैसला कारण के साथ दर्ज होता है।', pa: 'ਪਹਿਲਾਂ ਕਾਰਨ ਲਿਖੋ: ਹਰ ਫ਼ੈਸਲਾ ਕਾਰਨ ਨਾਲ ਦਰਜ ਹੁੰਦਾ ਹੈ।' },
  recorded: { en: '{action}: recorded.', hi: '{action}: दर्ज हो गया।', pa: '{action}: ਦਰਜ ਹੋ ਗਿਆ।' },
  conflict: { en: 'Someone else changed this case. It has been reloaded; decide again.', hi: 'किसी और ने यह मामला बदला है। इसे फिर से खोला गया है; दोबारा फ़ैसला करें।', pa: 'ਕਿਸੇ ਹੋਰ ਨੇ ਇਹ ਮਾਮਲਾ ਬਦਲਿਆ ਹੈ। ਇਸਨੂੰ ਮੁੜ ਖੋਲ੍ਹਿਆ ਗਿਆ ਹੈ; ਮੁੜ ਫ਼ੈਸਲਾ ਕਰੋ।' },
  notAllowed: { en: 'Not allowed for your role: {why}.', hi: 'आपकी भूमिका के लिए अनुमति नहीं: {why}।', pa: 'ਤੁਹਾਡੀ ਭੂਮਿਕਾ ਲਈ ਇਜਾਜ਼ਤ ਨਹੀਂ: {why}।' },
} as const;

/** A DETAIL sentence with its {names} filled in. */
export function fill(words: Words, language: SupportedLanguage, vars: Record<string, string | number> = {}) {
  return (words[language] ?? words.en).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
