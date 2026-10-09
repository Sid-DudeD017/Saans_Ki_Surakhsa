// TODO(P2): Consolidate these local Ghar translations into the shared src/lib/i18n.tsx infrastructure.
import { useLanguage } from '../../lib/i18n';

export type GharTranslationKey =
  | 'rooms.kitchen' | 'rooms.master_bedroom' | 'rooms.living_room' | 'rooms.new_room'
  | 'ui.your_rooms' | 'ui.add_room' | 'ui.use_example' | 'ui.start_over'
  | 'ui.loading' | 'ui.unsupported_location' | 'ui.data_unavailable' | 'ui.error'
  | 'ui.unsupported_msg'
  | 'ui.api_failed'
  | 'ui.change_match_yours'
  | 'ui.room_size' | 'ui.size_small' | 'ui.size_medium' | 'ui.size_large' | 'ui.size_custom_m' | 'ui.size_custom_ft'
  | 'ui.windows' | 'ui.num_windows' | 'ui.usually_open' | 'ui.morning' | 'ui.afternoon' | 'ui.night'
  | 'ui.air_purifier' | 'ui.no_purifier' | 'ui.yes_small' | 'ui.yes_large' | 'ui.know_cadr'
  | 'ui.kitchen_details' | 'ui.cooking_fuel' | 'ui.fuel_lpg' | 'ui.fuel_png' | 'ui.fuel_electric' | 'ui.fuel_kerosene' | 'ui.fuel_biomass'
  | 'ui.meal_times' | 'ui.chimney' | 'ui.not_counted'
  | 'ui.smoking' | 'ui.select' | 'ui.no' | 'ui.sometimes' | 'ui.every_day' | 'ui.prefer_not'
  | 'ui.incense' | 'ui.mosquito_coils'
  | 'ui.remove_room' | 'ui.what_assumed'
  | 'location.home' | 'location.change' | 'location.save' | 'location.cancel' | 'location.use_current'
  | 'family.title' | 'family.add_person' | 'family.empty' | 'family.name_opt' | 'family.role_opt' | 'family.remove'
  | 'family.schedule' | 'family.to' | 'family.outdoors' | 'family.add_block'
  | 'family.incomplete' | 'family.avg' | 'family.worst' | 'family.in' | 'family.purifier_comp'
  | 'chart.outside' | 'chart.this_room' | 'chart.unit'
  | 'cat.good' | 'cat.satisfactory' | 'cat.moderate' | 'cat.poor' | 'cat.very_poor' | 'cat.severe' | 'cat.severe_plus'
  | 'ui.recommendations'
  | 'summary.title' | 'summary.outsidePeak' | 'summary.worstRoom' | 'summary.cleanestRoom' | 'summary.biggestChange' | 'summary.noData' | 'summary.titlePlan'
  | 'plan.fallback' | 'plan.purifier_small' | 'plan.purifier_large' | 'plan.purifier_custom'
  | 'plan.windows_close_morning' | 'plan.windows_close_afternoon' | 'plan.windows_close_night'
  | 'plan.source_cooking' | 'plan.source_smoking' | 'plan.source_incense' | 'plan.source_mosquito_coil'
  | 'plan.ventilation_poor' | 'plan.mask_n95'
  | 'assumptions.warning'
  | 'assumptions.room'
  | 'assumptions.outdoor'
  | 'assumptions.physics'
  | 'assumptions.purifier'
  | 'assumptions.sources'
  | 'assumptions.isolation';

const EN: Record<GharTranslationKey, string> = {
  'rooms.kitchen': 'Kitchen',
  'rooms.master_bedroom': 'Master Bedroom',
  'rooms.living_room': 'Living Room',
  'rooms.new_room': 'New Room',
  'ui.your_rooms': 'Your rooms',
  'ui.add_room': 'Add a room',
  'ui.use_example': 'Use the example home',
  'ui.start_over': 'Start over',
  'ui.loading': 'Loading...',
  'ui.unsupported_location': 'Unsupported location',
  'ui.data_unavailable': 'Data unavailable',
  'ui.error': 'Error',
  'ui.unsupported_msg': 'Room estimates are available for Punjab and Delhi NCR for now.',
  'ui.api_failed': 'Outdoor AQI sources failed to respond. Retry after 60 seconds.',
  'ui.change_match_yours': 'We started with a typical room. Change it to match yours.',
  'ui.room_size': 'Room Size',
  'ui.size_small': 'Small (~10 m²)',
  'ui.size_medium': 'Medium (~15 m²)',
  'ui.size_large': 'Large (~20 m²)',
  'ui.size_custom_m': 'Custom (metres)',
  'ui.size_custom_ft': 'Custom (feet)',
  'ui.windows': 'Windows',
  'ui.num_windows': 'Number of windows',
  'ui.usually_open': 'Usually open in the:',
  'ui.morning': 'Morning',
  'ui.afternoon': 'Afternoon',
  'ui.night': 'Night',
  'ui.air_purifier': 'Air Purifier',
  'ui.no_purifier': 'No purifier',
  'ui.yes_small': 'Yes, small',
  'ui.yes_large': 'Yes, large',
  'ui.know_cadr': 'I know its CADR',
  'ui.kitchen_details': 'Kitchen details',
  'ui.cooking_fuel': 'Cooking fuel',
  'ui.fuel_lpg': 'LPG',
  'ui.fuel_png': 'Piped Gas',
  'ui.fuel_electric': 'Induction / Electric',
  'ui.fuel_kerosene': 'Kerosene',
  'ui.fuel_biomass': 'Wood / Dung (Chulha)',
  'ui.meal_times': 'Meal times',
  'ui.chimney': 'Chimney / Exhaust',
  'ui.not_counted': 'Not counted yet',
  'ui.smoking': 'Smoking indoors',
  'ui.select': 'Select...',
  'ui.no': 'No',
  'ui.sometimes': 'Sometimes',
  'ui.every_day': 'Every day',
  'ui.prefer_not': 'Prefer not to say',
  'ui.incense': 'Burn incense or dhoop',
  'ui.mosquito_coils': 'Burn mosquito coils at night',
  'ui.remove_room': 'Remove this room',
  'ui.what_assumed': 'What we assumed',
  'location.home': 'Home location',
  'location.change': 'Change',
  'location.save': 'Save',
  'location.cancel': 'Cancel',
  'location.use_current': 'Use current location',
  'family.title': "Family's Day",
  'family.add_person': '+ Add Person',
  'family.empty': 'Add family members to see their daily PM2.5 exposure based on their schedule.',
  'family.name_opt': 'Name (Optional)',
  'family.role_opt': 'Role (e.g. Child, Parent)',
  'family.remove': 'Remove',
  'family.schedule': 'Schedule:',
  'family.to': 'to',
  'family.outdoors': 'Outdoors',
  'family.add_block': '+ Add time block',
  'family.incomplete': 'Incomplete schedule: Missing {{missing}} hours of coverage. Please fill out the full 24 hours to see the daily average.',
  'family.avg': "Today's average:",
  'family.worst': 'Worst stretch:',
  'family.in': 'in',
  'family.purifier_comp': "If the {{room}} purifier runs at night, {{name}}'s day falls from {{baseline}} to {{improved}} µg/m³! (Modelled scenario)",
  'chart.outside': 'Outside',
  'chart.this_room': 'This room',
  'chart.unit': 'PM2.5, µg/m³, India time',
  'cat.good': 'good',
  'cat.satisfactory': 'satisfactory',
  'cat.moderate': 'moderate',
  'cat.poor': 'poor',
  'cat.very_poor': 'very poor',
  'cat.severe': 'severe',
  'cat.severe_plus': 'severe plus',
  'ui.recommendations': 'Recommendations for {{room}}',
  'summary.title': 'Your home today',
  'summary.outsidePeak': 'Outside air will peak at {{pm25}} µg/m³ around {{time}}.',
  'summary.worstRoom': 'The worst room is the {{room}} at {{pm25}} µg/m³',
  'summary.cleanestRoom': 'The cleanest room is the {{room}} at {{pm25}} µg/m³.',
  'summary.biggestChange': 'Biggest improvement: {{action}} drops it by {{reduction}} µg/m³.',
  'summary.noData': 'Add some rooms to see a summary of your home.',
  'summary.titlePlan': 'Your plan for today',
  'plan.fallback': '{{text}}',
  'plan.purifier_small': 'A small air purifier drops PM2.5 to {{pm25}} µg/m³',
  'plan.purifier_large': 'A large air purifier drops PM2.5 to {{pm25}} µg/m³',
  'plan.purifier_custom': 'A {{purifierCadr}} m³/h purifier drops PM2.5 to {{pm25}} µg/m³',
  'plan.windows_close_morning': 'Close windows in the morning ({{from}}–{{to}}) to keep out morning smog',
  'plan.windows_close_afternoon': 'Close windows in the afternoon ({{from}}–{{to}})',
  'plan.windows_close_night': 'Close windows at night ({{from}}–{{to}}) to keep out night smog',
  'plan.source_cooking': 'Cooking with {{sourceType}} drives PM2.5 up. Open windows while cooking.',
  'plan.source_smoking': 'Smoking indoors causes severe spikes. Smoke outside.',
  'plan.source_incense': 'Incense smoke stays trapped indoors.',
  'plan.source_mosquito_coil': 'Mosquito coils generate very high particulate matter.',
  'plan.ventilation_poor': 'With windows closed, indoor air may get stuffy over time. Consider opening windows when outdoor air is cleaner.',
  'plan.mask_n95': 'If you cannot afford a purifier, an N95 mask is strongly recommended when indoors during severe peaks.',
  'assumptions.warning': 'Warning (VERIFY): All displayed indoor values are modeled estimates, not direct sensor measurements.',
  'assumptions.room': 'Room: {{area}} m² area, {{height}} m ceiling, {{windows}} windows.',
  'assumptions.outdoor': 'Outdoor: Derived from {{pm25}} µg/m³ at {{time}}.',
  'assumptions.physics': 'Physics: Windows {{ventilation}} ({{ach}} ACH, {{penetration}}% particles enter). Settling {{decay}}/h.',
  'assumptions.purifier': 'Purifier: CADR {{cadr}} m³/h.',
  'assumptions.sources': 'Sources: Cooking on {{fuel}} ({{mg}} mg/h at {{meals}} meals/day).{{smoking}}{{incense}}{{coil}}',
  'assumptions.isolation': 'Isolation: Assumes kitchen smoke does not reach other rooms. Inter-room airflow is excluded.',
};

const HI: Record<GharTranslationKey, string> = {
  'rooms.kitchen': 'रसोई', // VERIFY
  'rooms.master_bedroom': 'शयनकक्ष', // VERIFY
  'rooms.living_room': 'बैठक', // VERIFY
  'rooms.new_room': 'नया कमरा', // VERIFY
  'ui.your_rooms': 'आपके कमरे', // VERIFY
  'ui.add_room': 'कमरा जोड़ें', // VERIFY
  'ui.use_example': 'उदाहरण घर का उपयोग करें', // VERIFY
  'ui.start_over': 'फिर से शुरू करें', // VERIFY
  'ui.loading': 'लोड हो रहा है...', // VERIFY
  'ui.unsupported_location': 'असमर्थित स्थान', // VERIFY
  'ui.data_unavailable': 'डेटा उपलब्ध नहीं है', // VERIFY
  'ui.error': 'त्रुटि', // VERIFY
  'ui.unsupported_msg': 'कमरे के अनुमान अभी पंजाब और दिल्ली एनसीआर के लिए उपलब्ध हैं।', // VERIFY
  'ui.api_failed': 'बाहरी एक्यूआई स्रोतों ने जवाब नहीं दिया। 60 सेकंड बाद पुनः प्रयास करें।', // VERIFY
  'ui.change_match_yours': 'हमने एक सामान्य कमरे से शुरुआत की है। इसे अपने अनुसार बदलें।', // VERIFY
  'ui.room_size': 'कमरे का आकार', // VERIFY
  'ui.size_small': 'छोटा (~10 m²)', // VERIFY
  'ui.size_medium': 'मध्यम (~15 m²)', // VERIFY
  'ui.size_large': 'बड़ा (~20 m²)', // VERIFY
  'ui.size_custom_m': 'कस्टम (मीटर)', // VERIFY
  'ui.size_custom_ft': 'कस्टम (फुट)', // VERIFY
  'ui.windows': 'खिड़कियाँ', // VERIFY
  'ui.num_windows': 'खिड़कियों की संख्या', // VERIFY
  'ui.usually_open': 'आमतौर पर खुलती हैं:', // VERIFY
  'ui.morning': 'सुबह', // VERIFY
  'ui.afternoon': 'दोपहर', // VERIFY
  'ui.night': 'रात', // VERIFY
  'ui.air_purifier': 'एयर प्यूरीफायर', // VERIFY
  'ui.no_purifier': 'कोई प्यूरीफायर नहीं', // VERIFY
  'ui.yes_small': 'हाँ, छोटा', // VERIFY
  'ui.yes_large': 'हाँ, बड़ा', // VERIFY
  'ui.know_cadr': 'मुझे इसका CADR पता है', // VERIFY
  'ui.kitchen_details': 'रसोई का विवरण', // VERIFY
  'ui.cooking_fuel': 'पकाने का ईंधन', // VERIFY
  'ui.fuel_lpg': 'LPG', // VERIFY
  'ui.fuel_png': 'पाइप गैस', // VERIFY
  'ui.fuel_electric': 'इंडक्शन / इलेक्ट्रिक', // VERIFY
  'ui.fuel_kerosene': 'मिट्टी का तेल', // VERIFY
  'ui.fuel_biomass': 'लकड़ी / गोबर (चूल्हा)', // VERIFY
  'ui.meal_times': 'भोजन का समय', // VERIFY
  'ui.chimney': 'चिमनी / एग्जॉस्ट', // VERIFY
  'ui.not_counted': 'अभी गिना नहीं गया है', // VERIFY
  'ui.smoking': 'अंदर धूम्रपान', // VERIFY
  'ui.select': 'चुनें...', // VERIFY
  'ui.no': 'नहीं', // VERIFY
  'ui.sometimes': 'कभी-कभी', // VERIFY
  'ui.every_day': 'हर दिन', // VERIFY
  'ui.prefer_not': 'बताना नहीं चाहते', // VERIFY
  'ui.incense': 'अगरबत्ती या धूप जलाना', // VERIFY
  'ui.mosquito_coils': 'रात में कछुआ छाप जलाना', // VERIFY
  'ui.remove_room': 'इस कमरे को हटाएं', // VERIFY
  'ui.what_assumed': 'हमने क्या माना', // VERIFY
  'location.home': 'घर का स्थान', // VERIFY
  'location.change': 'बदलें', // VERIFY
  'location.save': 'सहेजें', // VERIFY
  'location.cancel': 'रद्द करें', // VERIFY
  'location.use_current': 'वर्तमान स्थान का उपयोग करें', // VERIFY
  'family.title': "परिवार का दिन", // VERIFY
  'family.add_person': '+ व्यक्ति जोड़ें', // VERIFY
  'family.empty': 'उनके शेड्यूल के आधार पर दैनिक PM2.5 एक्सपोज़र देखने के लिए परिवार के सदस्यों को जोड़ें।', // VERIFY
  'family.name_opt': 'नाम (वैकल्पिक)', // VERIFY
  'family.role_opt': 'भूमिका (उदा. बच्चा, माता-पिता)', // VERIFY
  'family.remove': 'हटाएं', // VERIFY
  'family.schedule': 'शेड्यूल:', // VERIFY
  'family.to': 'से', // VERIFY
  'family.outdoors': 'बाहर', // VERIFY
  'family.add_block': '+ समय खंड जोड़ें', // VERIFY
  'family.incomplete': 'अधूरा शेड्यूल: {{missing}} घंटे की कवरेज गायब है। दैनिक औसत देखने के लिए पूरे 24 घंटे भरें।', // VERIFY
  'family.avg': "आज का औसत:", // VERIFY
  'family.worst': 'सबसे खराब समय:', // VERIFY
  'family.in': 'में', // VERIFY
  'family.purifier_comp': "अगर रात में {{room}} का प्यूरीफायर चलता है, तो {{name}} का दिन {{baseline}} से गिरकर {{improved}} µg/m³ हो जाता है! (मॉडल परिदृश्य)", // VERIFY
  'chart.outside': 'बाहर', // VERIFY
  'chart.this_room': 'यह कमरा', // VERIFY
  'chart.unit': 'PM2.5, µg/m³, भारत का समय', // VERIFY
  'cat.good': 'अच्छा', // VERIFY
  'cat.satisfactory': 'संतोषजनक', // VERIFY
  'cat.moderate': 'मध्यम', // VERIFY
  'cat.poor': 'खराब', // VERIFY
  'cat.very_poor': 'बहुत खराब', // VERIFY
  'cat.severe': 'गंभीर', // VERIFY
  'cat.severe_plus': 'अति गंभीर', // VERIFY
  'ui.recommendations': '{{room}} के लिए सुझाव', // VERIFY
  'summary.title': 'आज आपका घर', // VERIFY
  'summary.outsidePeak': 'बाहरी हवा लगभग {{time}} बजे {{pm25}} µg/m³ तक पहुंच जाएगी।', // VERIFY
  'summary.worstRoom': 'सबसे खराब कमरा {{room}} है जो {{pm25}} µg/m³ पर है', // VERIFY
  'summary.cleanestRoom': 'सबसे साफ कमरा {{room}} है जो {{pm25}} µg/m³ पर है।', // VERIFY
  'summary.biggestChange': 'सबसे बड़ा सुधार: {{action}} इसे {{reduction}} µg/m³ तक कम कर देता है।', // VERIFY
  'summary.noData': 'अपने घर का सारांश देखने के लिए कुछ कमरे जोड़ें।', // VERIFY
  'summary.titlePlan': 'आज के लिए आपकी योजना', // VERIFY
  'plan.fallback': '{{text}}', // VERIFY
  'plan.purifier_small': 'एक छोटा एयर प्यूरीफायर PM2.5 को {{pm25}} µg/m³ तक गिरा देता है', // VERIFY
  'plan.purifier_large': 'एक बड़ा एयर प्यूरीफायर PM2.5 को {{pm25}} µg/m³ तक गिरा देता है', // VERIFY
  'plan.purifier_custom': 'एक {{purifierCadr}} m³/h प्यूरीफायर PM2.5 को {{pm25}} µg/m³ तक गिरा देता है', // VERIFY
  'plan.windows_close_morning': 'सुबह की धुंध को बाहर रखने के लिए सुबह ({{from}}–{{to}}) खिड़कियां बंद करें', // VERIFY
  'plan.windows_close_afternoon': 'दोपहर में खिड़कियां बंद करें ({{from}}–{{to}})', // VERIFY
  'plan.windows_close_night': 'रात की धुंध को बाहर रखने के लिए रात में ({{from}}–{{to}}) खिड़कियां बंद करें', // VERIFY
  'plan.source_cooking': '{{sourceType}} से खाना पकाने से PM2.5 बढ़ जाता है। खाना पकाते समय खिड़कियां खुली रखें।', // VERIFY
  'plan.source_smoking': 'घर के अंदर धूम्रपान करने से भारी उछाल आता है। बाहर धूम्रपान करें।', // VERIFY
  'plan.source_incense': 'अगरबत्ती का धुआं घर के अंदर फंसा रहता है।', // VERIFY
  'plan.source_mosquito_coil': 'मच्छर कॉइल बहुत अधिक कण पदार्थ उत्पन्न करते हैं।', // VERIFY
  'plan.ventilation_poor': 'खिड़कियां बंद होने पर, अंदर की हवा समय के साथ घुटन भरी हो सकती है। बाहरी हवा साफ होने पर खिड़कियां खोलने पर विचार करें।', // VERIFY
  'plan.mask_n95': 'यदि आप प्यूरीफायर नहीं खरीद सकते हैं, तो गंभीर चोटियों के दौरान घर के अंदर N95 मास्क की दृढ़ता से सिफारिश की जाती है।', // VERIFY
  'assumptions.warning': 'चेतावनी (सत्यापित करें): सभी प्रदर्शित इनडोर मान मॉडल किए गए अनुमान हैं, सीधे सेंसर माप नहीं।', // VERIFY
  'assumptions.room': 'कमरा: {{area}} m² क्षेत्र, {{height}} m छत, {{windows}} खिड़कियां।', // VERIFY
  'assumptions.outdoor': 'बाहरी: {{time}} पर {{pm25}} µg/m³ से प्राप्त।', // VERIFY
  'assumptions.physics': 'भौतिकी: खिड़कियां {{ventilation}} ({{ach}} ACH, {{penetration}}% कण प्रवेश करते हैं)। सैटलिंग {{decay}}/h।', // VERIFY
  'assumptions.purifier': 'प्यूरीफायर: CADR {{cadr}} m³/h।', // VERIFY
  'assumptions.sources': 'स्रोत: {{fuel}} पर खाना पकाना ({{meals}} भोजन/दिन पर {{mg}} mg/h)।{{smoking}}{{incense}}{{coil}}', // VERIFY
  'assumptions.isolation': 'अलगाव: यह मानता है कि रसोई का धुआं अन्य कमरों तक नहीं पहुंचता है। कमरों के बीच हवा का प्रवाह शामिल नहीं है।', // VERIFY
};

const PA: Record<GharTranslationKey, string> = {
  'rooms.kitchen': 'ਰਸੋਈ', // VERIFY
  'rooms.master_bedroom': 'ਸੌਣ ਵਾਲਾ ਕਮਰਾ', // VERIFY
  'rooms.living_room': 'ਬੈਠਕ', // VERIFY
  'rooms.new_room': 'ਨਵਾਂ ਕਮਰਾ', // VERIFY
  'ui.your_rooms': 'ਤੁਹਾਡੇ ਕਮਰੇ', // VERIFY
  'ui.add_room': 'ਕਮਰਾ ਸ਼ਾਮਲ ਕਰੋ', // VERIFY
  'ui.use_example': 'ਉਦਾਹਰਣ ਘਰ ਦੀ ਵਰਤੋਂ ਕਰੋ', // VERIFY
  'ui.start_over': 'ਮੁੜ ਸ਼ੁਰੂ ਕਰੋ', // VERIFY
  'ui.loading': 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...', // VERIFY
  'ui.unsupported_location': 'ਅਸਮਰਥਿਤ ਸਥਾਨ', // VERIFY
  'ui.data_unavailable': 'ਡਾਟਾ ਉਪਲਬਧ ਨਹੀਂ ਹੈ', // VERIFY
  'ui.error': 'ਗਲਤੀ', // VERIFY
  'ui.unsupported_msg': 'ਕਮਰੇ ਦੇ ਅਨੁਮਾਨ ਹੁਣ ਪੰਜਾਬ ਅਤੇ ਦਿੱਲੀ ਐਨਸੀਆਰ ਲਈ ਉਪਲਬਧ ਹਨ।', // VERIFY
  'ui.api_failed': 'ਬਾਹਰੀ AQI ਸਰੋਤਾਂ ਨੇ ਜਵਾਬ ਨਹੀਂ ਦਿੱਤਾ। 60 ਸਕਿੰਟਾਂ ਬਾਅਦ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।', // VERIFY
  'ui.change_match_yours': 'ਅਸੀਂ ਇੱਕ ਆਮ ਕਮਰੇ ਨਾਲ ਸ਼ੁਰੂਆਤ ਕੀਤੀ ਹੈ। ਇਸਨੂੰ ਆਪਣੇ ਅਨੁਸਾਰ ਬਦਲੋ।', // VERIFY
  'ui.room_size': 'ਕਮਰੇ ਦਾ ਆਕਾਰ', // VERIFY
  'ui.size_small': 'ਛੋਟਾ (~10 m²)', // VERIFY
  'ui.size_medium': 'ਦਰਮਿਆਨਾ (~15 m²)', // VERIFY
  'ui.size_large': 'ਵੱਡਾ (~20 m²)', // VERIFY
  'ui.size_custom_m': 'ਕਸਟਮ (ਮੀਟਰ)', // VERIFY
  'ui.size_custom_ft': 'ਕਸਟਮ (ਫੁੱਟ)', // VERIFY
  'ui.windows': 'ਖਿੜਕੀਆਂ', // VERIFY
  'ui.num_windows': 'ਖਿੜਕੀਆਂ ਦੀ ਗਿਣਤੀ', // VERIFY
  'ui.usually_open': 'ਆਮ ਤੌਰ \'ਤੇ ਖੁੱਲ੍ਹੀਆਂ ਹੁੰਦੀਆਂ ਹਨ:', // VERIFY
  'ui.morning': 'ਸਵੇਰ', // VERIFY
  'ui.afternoon': 'ਦੁਪਹਿਰ', // VERIFY
  'ui.night': 'ਰਾਤ', // VERIFY
  'ui.air_purifier': 'ਏਅਰ ਪਿਊਰੀਫਾਇਰ', // VERIFY
  'ui.no_purifier': 'ਕੋਈ ਪਿਊਰੀਫਾਇਰ ਨਹੀਂ', // VERIFY
  'ui.yes_small': 'ਹਾਂ, ਛੋਟਾ', // VERIFY
  'ui.yes_large': 'ਹਾਂ, ਵੱਡਾ', // VERIFY
  'ui.know_cadr': 'ਮੈਨੂੰ ਇਸਦਾ CADR ਪਤਾ ਹੈ', // VERIFY
  'ui.kitchen_details': 'ਰਸੋਈ ਦਾ ਵੇਰਵਾ', // VERIFY
  'ui.cooking_fuel': 'ਖਾਣਾ ਬਣਾਉਣ ਦਾ ਬਾਲਣ', // VERIFY
  'ui.fuel_lpg': 'LPG', // VERIFY
  'ui.fuel_png': 'ਪਾਈਪ ਗੈਸ', // VERIFY
  'ui.fuel_electric': 'ਇੰਡਕਸ਼ਨ / ਇਲੈਕਟ੍ਰਿਕ', // VERIFY
  'ui.fuel_kerosene': 'ਮਿੱਟੀ ਦਾ ਤੇਲ', // VERIFY
  'ui.fuel_biomass': 'ਲੱਕੜ / ਗੋਹਾ (ਚੁੱਲ੍ਹਾ)', // VERIFY
  'ui.meal_times': 'ਖਾਣੇ ਦਾ ਸਮਾਂ', // VERIFY
  'ui.chimney': 'ਚਿਮਨੀ / ਐਗਜ਼ੌਸਟ', // VERIFY
  'ui.not_counted': 'ਹਾਲੇ ਗਿਣਿਆ ਨਹੀਂ ਗਿਆ', // VERIFY
  'ui.smoking': 'ਅੰਦਰ ਸਿਗਰਟ ਪੀਣਾ', // VERIFY
  'ui.select': 'ਚੁਣੋ...', // VERIFY
  'ui.no': 'ਨਹੀਂ', // VERIFY
  'ui.sometimes': 'ਕਦੇ-ਕਦੇ', // VERIFY
  'ui.every_day': 'ਹਰ ਦਿਨ', // VERIFY
  'ui.prefer_not': 'ਦੱਸਣਾ ਨਹੀਂ ਚਾਹੁੰਦੇ', // VERIFY
  'ui.incense': 'ਅਗਰਬੱਤੀ ਜਾਂ ਧੂਪ ਜਲਾਉਣਾ', // VERIFY
  'ui.mosquito_coils': 'ਰਾਤ ਨੂੰ ਮੱਛਰ ਮਾਰਨ ਵਾਲੀ ਕੋਇਲ ਜਲਾਉਣਾ', // VERIFY
  'ui.remove_room': 'ਇਸ ਕਮਰੇ ਨੂੰ ਹਟਾਓ', // VERIFY
  'ui.what_assumed': 'ਅਸੀਂ ਕੀ ਮੰਨਿਆ', // VERIFY
  'location.home': 'ਘਰ ਦਾ ਸਥਾਨ', // VERIFY
  'location.change': 'ਬਦਲੋ', // VERIFY
  'location.save': 'ਸੇਵ ਕਰੋ', // VERIFY
  'location.cancel': 'ਰੱਦ ਕਰੋ', // VERIFY
  'location.use_current': 'ਮੌਜੂਦਾ ਸਥਾਨ ਵਰਤੋ', // VERIFY
  'family.title': "ਪਰਿਵਾਰ ਦਾ ਦਿਨ", // VERIFY
  'family.add_person': '+ ਵਿਅਕਤੀ ਸ਼ਾਮਲ ਕਰੋ', // VERIFY
  'family.empty': 'ਉਨ੍ਹਾਂ ਦੇ ਸ਼ਡਿਊਲ ਦੇ ਆਧਾਰ \'ਤੇ ਰੋਜ਼ਾਨਾ PM2.5 ਐਕਸਪੋਜ਼ਰ ਦੇਖਣ ਲਈ ਪਰਿਵਾਰ ਦੇ ਮੈਂਬਰਾਂ ਨੂੰ ਸ਼ਾਮਲ ਕਰੋ।', // VERIFY
  'family.name_opt': 'ਨਾਂ (ਵਿਕਲਪਿਕ)', // VERIFY
  'family.role_opt': 'ਭੂਮਿਕਾ (ਜਿਵੇਂ ਬੱਚਾ, ਮਾਤਾ-ਪਿਤਾ)', // VERIFY
  'family.remove': 'ਹਟਾਓ', // VERIFY
  'family.schedule': 'ਸ਼ਡਿਊਲ:', // VERIFY
  'family.to': 'ਤੋਂ', // VERIFY
  'family.outdoors': 'ਬਾਹਰ', // VERIFY
  'family.add_block': '+ ਸਮਾਂ ਬਲਾਕ ਸ਼ਾਮਲ ਕਰੋ', // VERIFY
  'family.incomplete': 'ਅਧੂਰਾ ਸ਼ਡਿਊਲ: {{missing}} ਘੰਟੇ ਦੀ ਕਵਰੇਜ ਗਾਇਬ ਹੈ। ਰੋਜ਼ਾਨਾ ਔਸਤ ਦੇਖਣ ਲਈ ਪੂਰੇ 24 ਘੰਟੇ ਭਰੋ।', // VERIFY
  'family.avg': "ਅੱਜ ਦੀ ਔਸਤ:", // VERIFY
  'family.worst': 'ਸਭ ਤੋਂ ਖਰਾਬ ਸਮਾਂ:', // VERIFY
  'family.in': 'ਵਿੱਚ', // VERIFY
  'family.purifier_comp': "ਜੇ ਰਾਤ ਨੂੰ {{room}} ਦਾ ਪਿਊਰੀਫਾਇਰ ਚੱਲਦਾ ਹੈ, ਤਾਂ {{name}} ਦਾ ਦਿਨ {{baseline}} ਤੋਂ ਡਿੱਗ ਕੇ {{improved}} µg/m³ ਹੋ ਜਾਂਦਾ ਹੈ! (ਮਾਡਲ ਦ੍ਰਿਸ਼)", // VERIFY
  'chart.outside': 'ਬਾਹਰ', // VERIFY
  'chart.this_room': 'ਇਹ ਕਮਰਾ', // VERIFY
  'chart.unit': 'PM2.5, µg/m³, ਭਾਰਤ ਦਾ ਸਮਾਂ', // VERIFY
  'cat.good': 'ਚੰਗਾ', // VERIFY
  'cat.satisfactory': 'ਤਸੱਲੀਬਖਸ਼', // VERIFY
  'cat.moderate': 'ਦਰਮਿਆਨਾ', // VERIFY
  'cat.poor': 'ਖਰਾਬ', // VERIFY
  'cat.very_poor': 'ਬਹੁਤ ਖਰਾਬ', // VERIFY
  'cat.severe': 'ਗੰਭੀਰ', // VERIFY
  'cat.severe_plus': 'ਅਤਿ ਗੰਭੀਰ', // VERIFY
  'ui.recommendations': '{{room}} ਲਈ ਸੁਝਾਅ', // VERIFY
  'summary.title': 'ਅੱਜ ਤੁਹਾਡਾ ਘਰ', // VERIFY
  'summary.outsidePeak': 'ਬਾਹਰੀ ਹਵਾ ਲਗਭਗ {{time}} ਵਜੇ {{pm25}} µg/m³ ਤੱਕ ਪਹੁੰਚ ਜਾਵੇਗੀ।', // VERIFY
  'summary.worstRoom': 'ਸਭ ਤੋਂ ਮਾੜਾ ਕਮਰਾ {{room}} ਹੈ ਜੋ {{pm25}} µg/m³ ਤੇ ਹੈ', // VERIFY
  'summary.cleanestRoom': 'ਸਭ ਤੋਂ ਸਾਫ਼ ਕਮਰਾ {{room}} ਹੈ ਜੋ {{pm25}} µg/m³ ਤੇ ਹੈ।', // VERIFY
  'summary.biggestChange': 'ਸਭ ਤੋਂ ਵੱਡਾ ਸੁਧਾਰ: {{action}} ਇਸਨੂੰ {{reduction}} µg/m³ ਤੱਕ ਘਟਾਉਂਦਾ ਹੈ।', // VERIFY
  'summary.noData': 'ਆਪਣੇ ਘਰ ਦਾ ਸੰਖੇਪ ਦੇਖਣ ਲਈ ਕੁਝ ਕਮਰੇ ਸ਼ਾਮਲ ਕਰੋ।', // VERIFY
  'summary.titlePlan': 'ਅੱਜ ਲਈ ਤੁਹਾਡੀ ਯੋਜਨਾ', // VERIFY
  'plan.fallback': '{{text}}', // VERIFY
  'plan.purifier_small': 'ਇੱਕ ਛੋਟਾ ਏਅਰ ਪਿਊਰੀਫਾਇਰ PM2.5 ਨੂੰ {{pm25}} µg/m³ ਤੱਕ ਡਿਗਾਉਂਦਾ ਹੈ', // VERIFY
  'plan.purifier_large': 'ਇੱਕ ਵੱਡਾ ਏਅਰ ਪਿਊਰੀਫਾਇਰ PM2.5 ਨੂੰ {{pm25}} µg/m³ ਤੱਕ ਡਿਗਾਉਂਦਾ ਹੈ', // VERIFY
  'plan.purifier_custom': 'ਇੱਕ {{purifierCadr}} m³/h ਪਿਊਰੀਫਾਇਰ PM2.5 ਨੂੰ {{pm25}} µg/m³ ਤੱਕ ਡਿਗਾਉਂਦਾ ਹੈ', // VERIFY
  'plan.windows_close_morning': 'ਸਵੇਰ ਦੀ ਧੁੰਦ ਨੂੰ ਬਾਹਰ ਰੱਖਣ ਲਈ ਸਵੇਰੇ ({{from}}–{{to}}) ਖਿੜਕੀਆਂ ਬੰਦ ਕਰੋ', // VERIFY
  'plan.windows_close_afternoon': 'ਦੁਪਹਿਰ ਨੂੰ ਖਿੜਕੀਆਂ ਬੰਦ ਕਰੋ ({{from}}–{{to}})', // VERIFY
  'plan.windows_close_night': 'ਰਾਤ ਦੀ ਧੁੰਦ ਨੂੰ ਬਾਹਰ ਰੱਖਣ ਲਈ ਰਾਤ ਨੂੰ ({{from}}–{{to}}) ਖਿੜਕੀਆਂ ਬੰਦ ਕਰੋ', // VERIFY
  'plan.source_cooking': '{{sourceType}} ਨਾਲ ਖਾਣਾ ਬਣਾਉਣ ਨਾਲ PM2.5 ਵੱਧ ਜਾਂਦਾ ਹੈ। ਖਾਣਾ ਬਣਾਉਂਦੇ ਸਮੇਂ ਖਿੜਕੀਆਂ ਖੁੱਲ੍ਹੀਆਂ ਰੱਖੋ।', // VERIFY
  'plan.source_smoking': 'ਘਰ ਦੇ ਅੰਦਰ ਸਿਗਰਟ ਪੀਣ ਨਾਲ ਭਾਰੀ ਉਛਾਲ ਆਉਂਦਾ ਹੈ। ਬਾਹਰ ਸਿਗਰਟ ਪੀਓ।', // VERIFY
  'plan.source_incense': 'ਅਗਰਬੱਤੀ ਦਾ ਧੂੰਆਂ ਘਰ ਦੇ ਅੰਦਰ ਫਸਿਆ ਰਹਿੰਦਾ ਹੈ।', // VERIFY
  'plan.source_mosquito_coil': 'ਮੱਛਰ ਕੋਇਲ ਬਹੁਤ ਜ਼ਿਆਦਾ ਕਣ ਪਦਾਰਥ ਪੈਦਾ ਕਰਦੇ ਹਨ।', // VERIFY
  'plan.ventilation_poor': 'ਖਿੜਕੀਆਂ ਬੰਦ ਹੋਣ ਨਾਲ, ਅੰਦਰਲੀ ਹਵਾ ਸਮੇਂ ਦੇ ਨਾਲ ਘੁਟਣ ਵਾਲੀ ਹੋ ਸਕਦੀ ਹੈ। ਬਾਹਰੀ ਹਵਾ ਸਾਫ਼ ਹੋਣ ਤੇ ਖਿੜਕੀਆਂ ਖੋਲ੍ਹਣ ਬਾਰੇ ਵਿਚਾਰ ਕਰੋ।', // VERIFY
  'plan.mask_n95': 'ਜੇ ਤੁਸੀਂ ਪਿਊਰੀਫਾਇਰ ਨਹੀਂ ਖਰੀਦ ਸਕਦੇ, ਤਾਂ ਗੰਭੀਰ ਚੋਟੀਆਂ ਦੌਰਾਨ ਘਰ ਦੇ ਅੰਦਰ N95 ਮਾਸਕ ਦੀ ਸਖ਼ਤ ਸਿਫਾਰਸ਼ ਕੀਤੀ ਜਾਂਦੀ ਹੈ।', // VERIFY
  'assumptions.warning': 'ਚੇਤਾਵਨੀ (ਪੁਸ਼ਟੀ ਕਰੋ): ਸਾਰੇ ਪ੍ਰਦਰਸ਼ਿਤ ਇਨਡੋਰ ਮੁੱਲ ਮਾਡਲ ਕੀਤੇ ਅਨੁਮਾਨ ਹਨ, ਸਿੱਧੇ ਸੈਂਸਰ ਮਾਪ ਨਹੀਂ।', // VERIFY
  'assumptions.room': 'ਕਮਰਾ: {{area}} m² ਖੇਤਰ, {{height}} m ਛੱਤ, {{windows}} ਖਿੜਕੀਆਂ।', // VERIFY
  'assumptions.outdoor': 'ਬਾਹਰੀ: {{time}} ਤੇ {{pm25}} µg/m³ ਤੋਂ ਪ੍ਰਾਪਤ।', // VERIFY
  'assumptions.physics': 'ਭੌਤਿਕ ਵਿਗਿਆਨ: ਖਿੜਕੀਆਂ {{ventilation}} ({{ach}} ACH, {{penetration}}% ਕਣ ਦਾਖਲ ਹੁੰਦੇ ਹਨ)। ਸੈਟਲਿੰਗ {{decay}}/h।', // VERIFY
  'assumptions.purifier': 'ਪਿਊਰੀਫਾਇਰ: CADR {{cadr}} m³/h।', // VERIFY
  'assumptions.sources': 'ਸਰੋਤ: {{fuel}} ਤੇ ਖਾਣਾ ਪਕਾਉਣਾ ({{meals}} ਭੋਜਨ/ਦਿਨ ਤੇ {{mg}} mg/h)।{{smoking}}{{incense}}{{coil}}', // VERIFY
  'assumptions.isolation': 'ਅਲਗਾਵ: ਇਹ ਮੰਨਦਾ ਹੈ ਕਿ ਰਸੋਈ ਦਾ ਧੂੰਆਂ ਦੂਜੇ ਕਮਰਿਆਂ ਤੱਕ ਨਹੀਂ ਪਹੁੰਚਦਾ। ਕਮਰਿਆਂ ਦੇ ਵਿਚਕਾਰ ਹਵਾ ਦਾ ਪ੍ਰਵਾਹ ਸ਼ਾਮਲ ਨਹੀਂ ਹੈ।', // VERIFY
};

const DICTS: Record<string, Record<GharTranslationKey, string>> = {
  en: EN,
  hi: HI,
  pa: PA,
};

export function useGharLanguage() {
  const { language, t: globalT } = useLanguage();
  const dict = DICTS[language] || EN;

  const tLocal = (key: GharTranslationKey, vars?: Record<string, string | number>) => {
    let str = dict[key] || EN[key] || key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{{${k}}}`, String(v));
      }
    }
    return str;
  };

  return { language, t: globalT, tLocal };
}
