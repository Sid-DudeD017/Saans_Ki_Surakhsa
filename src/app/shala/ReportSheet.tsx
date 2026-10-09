'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import { Card, Button, Badge, Alert, Stack } from '../../components/ui';
import {
  submitComplaint,
  prepareReportPhoto,
  uploadEvidencePhoto,
  getComplaintStatus,
  isMockMode,
  type ComplaintStatusData,
  type SupportedCitizenType,
} from '../../lib/api';
import { project, tilesAround, type LatLon, TILE } from './redZone';

export interface SavedReport {
  id: string;
  shortId: string;
  type: SupportedCitizenType;
  typeName: string;
  lat: number;
  lon: number;
  description: string;
  hasPhoto: boolean;
  createdAt: string;
  isMock: boolean;
}

export interface ReportSheetProps {
  initialLocation: { lat: number; lon: number; label: string; accuracyM?: number };
  schoolLocation?: { lat: number; lon: number; label: string };
  role?: string;
  language: 'pa' | 'hi' | 'en';
  onClose?: () => void;
  isInline?: boolean;
}

interface TileOption {
  type: SupportedCitizenType;
  icon: string;
  label: Record<'pa' | 'hi' | 'en', string>;
  hint: Record<'pa' | 'hi' | 'en', string>;
  destination: string;
  deadline: string;
}

const TILES: TileOption[] = [
  {
    type: 'farm_fire',
    icon: '🌾🔥',
    label: { pa: 'ਖੇਤ ਜਾਂ ਪਰਾਲੀ ਦੀ ਅੱਗ', hi: 'खेत या पराली की आग', en: 'Crop or field fire' },
    hint: {
      pa: 'ਐੱਸ.ਡੀ.ਐੱਮ, ਖੇਤੀਬਾੜੀ ਅਫ਼ਸਰ · 4 ਘੰਟੇ',
      hi: 'एसडीएम, जिला कृषि अधिकारी · 4 घंटे',
      en: 'SDM, District Agriculture Officer · 4 h',
    },
    destination: 'SDM, District Agriculture Officer',
    deadline: '4 h',
  },
  {
    type: 'garbage',
    icon: '🗑️🔥',
    label: { pa: 'ਕੂੜਾ ਸਾੜਨਾ', hi: 'कचरा जलाना', en: 'Rubbish burning' },
    hint: {
      pa: 'ਨਗਰ ਨਿਗਮ ਠੋਸ ਰਹਿੰਦ-ਖੂੰਹਦ · 12 ਘੰਟੇ',
      hi: 'नगर निगम ठोस अपशिष्ट · 12 घंटे',
      en: 'Municipal SWM · 12 h',
    },
    destination: 'Municipal SWM',
    deadline: '12 h',
  },
  {
    type: 'vehicle',
    icon: '🚚💨',
    label: { pa: 'ਧੂੰਆਂ ਛੱਡਦਾ ਵਾਹਨ', hi: 'धुआँ छोड़ता वाहन', en: 'Smoky vehicle' },
    hint: {
      pa: 'ਟ੍ਰੈਫਿਕ ਪੁਲਿਸ · 24 ਘੰਟੇ',
      hi: 'ट्रैफ़िक पुलिस · 24 घंटे',
      en: 'Traffic police · 24 h',
    },
    destination: 'Traffic police',
    deadline: '24 h',
  },
  {
    type: 'firecrackers',
    icon: '🎆',
    label: { pa: 'ਪਟਾਕੇ ਚਲਾਉਣਾ', hi: 'पटाखे चलाना', en: 'Firecrackers' },
    hint: {
      pa: 'ਸਥਾਨਕ ਪੁਲਿਸ · 2 ਘੰਟੇ',
      hi: 'स्थानीय पुलिस · 2 घंटे',
      en: 'Local police · 2 h',
    },
    destination: 'Local police',
    deadline: '2 h',
  },
  {
    type: 'dust',
    icon: '🏗️💨',
    label: { pa: 'ਉਸਾਰੀ ਜਾਂ ਸੜਕ ਦੀ ਧੂੜ', hi: 'निर्माण या सड़क की धूल', en: 'Construction or road dust' },
    hint: {
      pa: 'ਨਗਰ ਨਿਗਮ ਵਿਭਾਗ · 24 ਘੰਟੇ',
      hi: 'नगर निगम निकाय · 24 घंटे',
      en: 'Municipal body · 24 h',
    },
    destination: 'Municipal body',
    deadline: '24 h',
  },
  {
    type: 'industrial',
    icon: '🏭',
    label: { pa: 'ਫੈਕਟਰੀ ਜਾਂ ਭੱਠੇ ਦਾ ਧੂੰਆਂ', hi: 'फैक्ट्री या भट्ठे का धुआँ', en: 'Factory or kiln smoke' },
    hint: {
      pa: 'ਪ੍ਰਦੂਸ਼ਣ ਕੰਟਰੋਲ ਬੋਰਡ · 24 ਘੰਟੇ',
      hi: 'प्रदूषण नियंत्रण बोर्ड · 24 घंटे',
      en: 'Pollution Control Board · 24 h',
    },
    destination: 'Pollution Control Board',
    deadline: '24 h',
  },
];

const CHIP_CATEGORIES = [
  {
    title: { pa: 'ਤੁਸੀਂ ਕੀ ਦੇਖ ਰਹੇ ਹੋ', hi: 'आप क्या देख रहे हैं', en: 'What you see' },
    chips: [
      { id: 'thick_smoke', label: { pa: 'ਗਾੜ੍ਹਾ ਧੂੰਆਂ', hi: 'गाढ़ा धुआँ', en: 'thick smoke' } },
      { id: 'flames', label: { pa: 'ਅੱਗ ਦੀਆਂ ਲਾਟਾਂ', hi: 'आग की लपटें', en: 'flames' } },
      { id: 'ash_falling', label: { pa: 'ਸੁਆਹ ਡਿੱਗ ਰਹੀ ਹੈ', hi: 'राख गिर रही है', en: 'ash falling' } },
      { id: 'strong_smell', label: { pa: 'ਤੇਜ਼ ਬਦਬੂ', hi: 'तेज़ दुर्गंध', en: 'strong smell' } },
      { id: 'dust_cloud', label: { pa: 'ਧੂੜ ਦਾ ਗੁਬਾਰ', hi: 'धूल का गुबार', en: 'dust cloud' } },
    ],
  },
  {
    title: { pa: 'ਕਿੰਨੇ ਸਮੇਂ ਤੋਂ', hi: 'कितने समय से', en: 'How long' },
    chips: [
      { id: 'just_started', label: { pa: 'ਹੁਣੇ ਸ਼ੁਰੂ ਹੋਇਆ', hi: 'अभी शुरू हुआ', en: 'just started' } },
      { id: 'under_hour', label: { pa: 'ਇੱਕ ਘੰਟੇ ਤੋਂ ਘੱਟ', hi: 'एक घंटे से कम', en: 'under an hour' } },
      { id: 'hours', label: { pa: 'ਕਈ ਘੰਟਿਆਂ ਤੋਂ', hi: 'कई घंटों से', en: 'hours' } },
      { id: 'every_day', label: { pa: 'ਹਰ ਰੋਜ਼', hi: 'हर रोज़', en: 'every day' } },
    ],
  },
  {
    title: { pa: 'ਕੌਣ ਪ੍ਰਭਾਵਿਤ ਹੈ', hi: 'कौन प्रभावित है', en: 'Who is affected' },
    chips: [
      { id: 'children_outside', label: { pa: 'ਬਾਹਰ ਖੇਡਦੇ ਬੱਚੇ', hi: 'बाहर खेलते बच्चे', en: 'children outside' } },
      { id: 'class_indoors', label: { pa: 'ਅੰਦਰ ਕਲਾਸ', hi: 'अंदर क्लास रूम', en: 'a class indoors' } },
      { id: 'nearby_homes', label: { pa: 'ਨੇੜਲੇ ਘਰ', hi: 'आस-पास के घर', en: 'nearby homes' } },
    ],
  },
];

export const REPORT_I18N = {
  headerTitle: {
    pa: 'ਰਿਪੋਰਟ ਦਰਜ ਕਰੋ',
    hi: 'रिपोर्ट दर्ज करें',
    en: 'Report incident',
  },
  myReportsBtn: {
    pa: 'ਮੇਰੀਆਂ ਰਿਪੋਰਟਾਂ',
    hi: 'मेरी रिपोर्टें',
    en: 'My reports',
  },
  closeBtn: {
    pa: 'ਬੰਦ ਕਰੋ',
    hi: 'बंद करें',
    en: 'Close',
  },
  backBtn: {
    pa: '← ਪਿੱਛੇ',
    hi: '← वापस',
    en: '← Back',
  },
  steps: {
    1: { pa: '1. ਕੀ ਹੈ?', hi: '1. क्या है?', en: '1. What is it?' },
    2: { pa: '2. ਕਿੱਥੇ?', hi: '2. कहाँ?', en: '2. Where?' },
    3: { pa: '3. ਵੇਰਵੇ', hi: '3. विवरण', en: '3. Details' },
    4: { pa: '4. ਜਾਂਚੋ ਅਤੇ ਭੇਜੋ', hi: '4. जांचें और भेजें', en: '4. Check & send' },
  },
  stepAnnouncements: {
    1: {
      pa: 'ਕਦਮ 1/4: ਕੀ ਹੈ?',
      hi: 'चरण 1/4: क्या है?',
      en: 'Step 1 of 4: What is it?',
    },
    2: {
      pa: 'ਕਦਮ 2/4: ਧੂੰਆਂ ਕਿੱਥੇ ਹੈ?',
      hi: 'चरण 2/4: धुआँ कहाँ है?',
      en: 'Step 2 of 4: Where is the smoke?',
    },
    3: {
      pa: 'ਕਦਮ 3/4: ਵੇਰਵੇ ਅਤੇ ਫੋਟੋ',
      hi: 'चरण 3/4: विवरण और फ़ोटो',
      en: 'Step 3 of 4: Add details and optional photo',
    },
    4: {
      pa: 'ਕਦਮ 4/4: ਜਾਂਚੋ ਅਤੇ ਭੇਜੋ',
      hi: 'चरण 4/4: जाँचें और भेजें',
      en: 'Step 4 of 4: Check and send your report',
    },
  },
  step1Title: {
    pa: 'ਕੀ ਹੈ?',
    hi: 'क्या है?',
    en: 'What is it?',
  },
  step1Subtitle: {
    pa: 'ਤੁਹਾਡੀ ਰਿਪੋਰਟ ਇਸ ਖੇਤਰ ਦੇ ਜ਼ਿੰਮੇਵਾਰ ਅਧਿਕਾਰੀ ਕੋਲ ਜਾਂਦੀ ਹੈ। ਤੁਸੀਂ ਇਸਨੂੰ ਮੇਰੀਆਂ ਰਿਪੋਰਟਾਂ ਵਿੱਚ ਦੇਖ ਸਕਦੇ ਹੋ।',
    hi: 'आपकी रिपोर्ट इस क्षेत्र के ज़िम्मेदार अधिकारी के पास जाती है। आप इसे मेरी रिपोर्टें में देख सकते हैं।',
    en: 'Your report goes to the officer responsible for this area. You can follow it under My reports.',
  },
  notSureBtn: {
    pa: '❓ ਪੱਕਾ ਨਹੀਂ ਪਤਾ? ਅਸੀਂ ਮਦਦ ਕਰਦੇ ਹਾਂ',
    hi: '❓ पक्का नहीं पता? हम मदद करते हैं',
    en: '❓ Not sure? Let us help you choose',
  },
  notSurePrompt: {
    pa: 'ਕੀ ਕੁਝ ਸੜ ਰਿਹਾ ਹੈ ਜਾਂ ਧੂੜ ਉੱਡ ਰਹੀ ਹੈ?',
    hi: 'क्या कुछ जल रहा है या धूल उड़ रही है?',
    en: 'What does it look or smell like?',
  },
  notSureFire: {
    pa: '🔥 ਕੁਝ ਸੜ ਰਿਹਾ ਹੈ (ਅੱਗ)',
    hi: '🔥 कुछ जल रहा है (आग)',
    en: '🔥 Something burning (fire)',
  },
  notSureDust: {
    pa: '💨 ਉਸਾਰੀ ਜਾਂ ਸੜਕ ਦੀ ਧੂੜ',
    hi: '💨 निर्माण या सड़क की धूल',
    en: '💨 Road or building dust',
  },
  notSureVehicle: {
    pa: '🚚 ਧੂੰਆਂ ਛੱਡਦਾ ਵਾਹਨ',
    hi: '🚚 धुआँ छोड़ता वाहन',
    en: '🚚 Smoky vehicle',
  },
  nearYou: {
    pa: 'ਤੁਹਾਡੇ ਨੇੜੇ',
    hi: 'आपके पास',
    en: 'Near you',
  },
  step2Instruction: {
    pa: 'ਪਿੰਨ ਨੂੰ ਖਿੱਚ ਕੇ ਧੂੰਏਂ ਵਾਲੀ ਥਾਂ ਤੇ ਲੈ ਜਾਓ।',
    hi: 'पिन को खींचकर धुएं वाली जगह पर रखें।',
    en: 'Drag the pin to where the smoke is.',
  },
  pinLocationLabel: {
    pa: 'ਪਿੰਨ ਦੀ ਸਥਿਤੀ',
    hi: 'पिन की स्थिति',
    en: 'Pin location',
  },
  deviceAccuracyLabel: {
    pa: 'ਯੰਤਰ ਦੀ ਸਹੀਤਾ',
    hi: 'डिवाइस सटीकता',
    en: 'Device accuracy',
  },
  useSchoolLocationBtn: {
    pa: 'ਸਕੂਲ ਦੀ ਸਥਿਤੀ ਵਰਤੋ',
    hi: 'स्कूल की लोकेशन चुनें',
    en: 'Use school location',
  },
  step3Title: {
    pa: 'ਵੇਰਵੇ',
    hi: 'विवरण',
    en: 'Details',
  },
  noteLabel: {
    pa: 'ਨੋਟ (ਵਿਕਲਪਿਕ):',
    hi: 'नोट (वैकल्पिक):',
    en: 'Note (optional):',
  },
  notePlaceholder: {
    pa: 'ਕੋਈ ਖਾਸ ਨਿਸ਼ਾਨੀ ਜਾਂ ਹੋਰ ਜਾਣਕਾਰੀ ਲਿਖੋ...',
    hi: 'कोई खास पहचान या अतिरिक्त जानकारी लिखें...',
    en: 'Add details (boundary wall, nearby landmark, etc.)...',
  },
  dictateBtn: {
    pa: '🎙️ ਬੋਲ ਕੇ ਲਿਖੋ',
    hi: '🎙️ बोलकर लिखें',
    en: '🎙️ Dictate note',
  },
  dictating: {
    pa: '🎙️ ਸੁਣ ਰਿਹਾ ਹੈ...',
    hi: '🎙️ सुन रहा है...',
    en: '🎙️ Listening...',
  },
  photoLabel: {
    pa: '📷 ਫੋਟੋ ਸਬੂਤ (ਵਿਕਲਪਿਕ):',
    hi: '📷 फ़ोटो प्रमाण (वैकल्पिक):',
    en: '📷 Photo evidence (optional):',
  },
  takePhotoBtn: {
    pa: '📸 ਫੋਟੋ ਖਿੱਚੋ ਜਾਂ ਅਪਲੋਡ ਕਰੋ',
    hi: '📸 फ़ोटो लें या अपलोड करें',
    en: '📸 Take or upload photo',
  },
  photoAttachedText: {
    pa: 'ਫੋਟੋ ਜੁੜੀ ਹੋਈ ਹੈ',
    hi: 'फ़ोटो संलग्न है',
    en: 'Image attached',
  },
  photoCleanedText: {
    pa: '✓ ~1,600 px ਆਕਾਰ • ਸਥਿਤੀ (EXIF) ਹਟਾਈ ਗਈ',
    hi: '✓ ~1,600 px आकार • लोकेशन (EXIF) हटाई गई',
    en: '✓ Shrunk to ~1,600 px • EXIF location stripped',
  },
  removePhotoBtn: {
    pa: 'ਹਟਾਓ',
    hi: 'हटाएं',
    en: 'Remove',
  },
  nextCheckBtn: {
    pa: 'ਅੱਗੇ: ਜਾਂਚੋ ਅਤੇ ਭੇਜੋ →',
    hi: 'आगे: जांचें और भेजें →',
    en: 'Next: Check & send →',
  },
  step4Title: {
    pa: 'ਜਾਂਚੋ ਅਤੇ ਭੇਜੋ',
    hi: 'जांचें और भेजें',
    en: 'Check and send',
  },
  step4Subtitle: {
    pa: 'ਰਿਪੋਰਟ ਭੇਜਣ ਤੋਂ ਪਹਿਲਾਂ ਵੇਰਵੇ ਚੈੱਕ ਕਰੋ।',
    hi: 'रिपोर्ट भेजने से पहले विवरण जांचें।',
    en: 'Confirm details before submitting.',
  },
  typeLabel: { pa: 'ਕਿਸਮ:', hi: 'प्रकार:', en: 'Type:' },
  routesToLabel: { pa: 'ਜਾਂਦੀ ਹੈ:', hi: 'जाती है:', en: 'Routes to:' },
  locationLabel: { pa: 'ਸਥਿਤੀ:', hi: 'स्थान:', en: 'Location:' },
  noteSummaryLabel: { pa: 'ਨੋਟ:', hi: 'नोट:', en: 'Note:' },
  photoSummaryLabel: { pa: 'ਫੋਟੋ:', hi: 'फ़ोटो:', en: 'Photo:' },
  noneAdded: { pa: 'ਕੋਈ ਨਹੀਂ', hi: 'कोई नहीं', en: 'None added' },
  noPhoto: { pa: 'ਕੋਈ ਫੋਟੋ ਨਹੀਂ', hi: 'कोई फोटो नहीं', en: 'No photo' },
  onePhotoAttached: {
    pa: '1 ਫੋਟੋ ਜੁੜੀ ਹੋਈ ਹੈ',
    hi: '1 फ़ोटो संलग्न है',
    en: '1 photo attached',
  },
  photoExifPrivacy: {
    pa: 'ਤੁਹਾਡੀ ਫੋਟੋ ਦੀ ਸਥਿਤੀ ਅਪਲੋਡ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਹਟਾ ਦਿੱਤੀ ਜਾਂਦੀ ਹੈ।',
    hi: 'अपलोड करने से पहले आपकी फोटो की लोकेशन हटा दी जाती है।',
    en: "Your photo's location is removed before upload.",
  },
  sendReportBtn: {
    pa: 'ਰਿਪੋਰਟ ਭੇਜੋ',
    hi: 'रिपोर्ट भेजें',
    en: 'Send report',
  },
  sendingReportBtn: {
    pa: 'ਰਿਪੋਰਟ ਭੇਜੀ ਜਾ ਰਹੀ ਹੈ...',
    hi: 'रिपोर्ट भेजी जा रही है...',
    en: 'Sending report...',
  },
  reportSentTitle: {
    pa: 'ਰਿਪੋਰਟ ਭੇਜੀ ਗਈ',
    hi: 'रिपोर्ट भेजी गई',
    en: 'Report sent',
  },
  reportSentUpdates: {
    pa: 'ਅਸੀਂ ਇੱਥੇ ਅੱਪਡੇਟ ਦਿਖਾਵਾਂਗੇ। ਹਵਾਲਾ {ref}',
    hi: 'हम यहाँ अपडेट दिखाएंगे। संदर्भ {ref}',
    en: "We'll show updates here. Reference {ref}",
  },
  mockNotice: {
    pa: 'ਸਿਰਫ਼ ਉਦਾਹਰਨ: ਇਹ ਰਿਪੋਰਟ ਨਹੀਂ ਭੇਜੀ ਗਈ।',
    hi: 'केवल उदाहरण: यह रिपोर्ट नहीं भेजी गई।',
    en: "Example only: this report wasn't sent.",
  },
  trackStatusBtn: {
    pa: 'ਸਥਿਤੀ ਦੇਖੋ',
    hi: 'स्थिति देखें',
    en: 'Track status',
  },
  reportAnotherBtn: {
    pa: 'ਹੋਰ ਰਿਪੋਰਟ ਭੇਜੋ',
    hi: 'अन्य रिपोर्ट भेजें',
    en: 'Report another incident',
  },
  noReportsYet: {
    pa: 'ਤੁਸੀਂ ਹਾਲੇ ਕੋਈ ਰਿਪੋਰਟ ਨਹੀਂ ਭੇਜੀ।',
    hi: 'आपने अभी कोई रिपोर्ट नहीं भेजी है।',
    en: 'No reports filed yet.',
  },
  checkingStatus: {
    pa: 'ਰਿਪੋਰਟ ਦੀ ਸਥਿਤੀ ਜਾਂਚ ਰਹੇ ਹਾਂ...',
    hi: 'रिपोर्ट की स्थिति जांच रहे हैं...',
    en: 'Checking report status...',
  },
  statusTimelineHeading: {
    pa: 'ਅਧਿਕਾਰਤ ਕਾਰਵਾਈ:',
    hi: 'आधिकारिक प्रगति:',
    en: 'Official Intake Progression:',
  },
  mergedNotice: {
    pa: 'ਕਿਸੇ ਨੇ ਪਹਿਲਾਂ ਹੀ ਇਸ ਅੱਗ ਦੀ ਰਿਪੋਰਟ ਕੀਤੀ ਹੈ। ਤੁਹਾਡੀ ਰਿਪੋਰਟ ਇਸ ਨਾਲ ਜੋੜ ਦਿੱਤੀ ਗਈ ਹੈ, ਜਿਸ ਨਾਲ ਇਸ ਵੱਲ ਜਲਦੀ ਧਿਆਨ ਦਿੱਤਾ ਜਾਵੇਗਾ।',
    hi: 'किसी ने पहले ही इस आग की रिपोर्ट की है। आपकी रिपोर्ट इससे जोड़ दी गई है, जिससे इस पर जल्दी ध्यान दिया जाएगा।',
    en: 'Someone already reported this fire. Your report was added to it, which helps it get attention.',
  },
};

const STORAGE_KEY = 'saans_my_reports';

let cachedReportsJson = '';
let cachedReports: SavedReport[] = [];
const SERVER_EMPTY_REPORTS: SavedReport[] = [];

export function loadStoredReports(): SavedReport[] {
  if (typeof window === 'undefined') return SERVER_EMPTY_REPORTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || '[]';
    if (raw !== cachedReportsJson) {
      cachedReportsJson = raw;
      cachedReports = JSON.parse(raw);
    }
    return cachedReports;
  } catch {
    return cachedReports;
  }
}

function getServerReportsSnapshot(): SavedReport[] {
  return SERVER_EMPTY_REPORTS;
}

const storageListeners = new Set<() => void>();
function subscribeReports(callback: () => void) {
  storageListeners.add(callback);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener('storage', handleStorage);
  return () => {
    storageListeners.delete(callback);
    window.removeEventListener('storage', handleStorage);
  };
}

function notifyReportsListeners() {
  storageListeners.forEach((l) => l());
}

function saveReportToStorage(report: SavedReport) {
  if (typeof window === 'undefined') return;
  try {
    const existing = loadStoredReports();
    const updated = [report, ...existing.filter((r) => r.id !== report.id)].slice(0, 20);
    cachedReportsJson = JSON.stringify(updated);
    cachedReports = updated;
    localStorage.setItem(STORAGE_KEY, cachedReportsJson);
    notifyReportsListeners();
  } catch (e) {
    console.error('Failed to save report to storage', e);
  }
}

export function shortenId(id: string): string {
  if (id.length <= 8) return id;
  return `…${id.slice(-6)}`;
}

function unprojectOffset(centre: LatLon, dx: number, dy: number, zoom: number): LatLon {
  const cProj = project(centre, zoom);
  const worldX = cProj.x + dx;
  const worldY = cProj.y + dy;
  const scale = TILE * 2 ** zoom;
  const lon = (worldX / scale) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (worldY / scale);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return {
    lat: Math.round(lat * 10000) / 10000,
    lon: Math.round(lon * 10000) / 10000,
  };
}

export function ReportSheet({
  initialLocation,
  schoolLocation,
  role = 'citizen',
  language,
  onClose,
  isInline = false,
}: ReportSheetProps) {
  // Navigation: Step 1 (What) -> Step 2 (Where) -> Step 3 (Details) -> Step 4 (Check & Send)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [viewMode, setViewMode] = useState<'form' | 'my_reports'>('form');

  // Step 1: Incident Type
  const [selectedType, setSelectedType] = useState<SupportedCitizenType | null>(null);
  const [showNotSureHelper, setShowNotSureHelper] = useState(false);

  // Step 2: Location & Pin
  const [pin, setPin] = useState<LatLon>({
    lat: initialLocation.lat,
    lon: initialLocation.lon,
  });
  const [mapOffset, setMapOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number }>({
    clientX: 0,
    clientY: 0,
    startX: 0,
    startY: 0,
  });

  // Step 3: Details
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [description, setDescription] = useState(''); // Note starts empty!
  const [isRecording, setIsRecording] = useState(false);
  const [photoFile, setPhotoFile] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoHash, setPhotoHash] = useState<string | null>(null);
  const [photoSizeKb, setPhotoSizeKb] = useState<number>(0);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Step 4 & Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedReport, setSubmittedReport] = useState<SavedReport | null>(null);

  // "My reports" list & active status inspection (hydration-safe external store)
  const savedReports = React.useSyncExternalStore(
    subscribeReports,
    loadStoredReports,
    getServerReportsSnapshot
  );
  const [inspectingReport, setInspectingReport] = useState<SavedReport | null>(null);
  const [liveStatus, setLiveStatus] = useState<ComplaintStatusData | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [prevLoc, setPrevLoc] = useState({ lat: initialLocation.lat, lon: initialLocation.lon });
  if (prevLoc.lat !== initialLocation.lat || prevLoc.lon !== initialLocation.lon) {
    setPrevLoc({ lat: initialLocation.lat, lon: initialLocation.lon });
    setPin({ lat: initialLocation.lat, lon: initialLocation.lon });
    setMapOffset({ x: 0, y: 0 });
  }

  const fileInputId = useId();

  // Focus trapping and keyboard navigation
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = (document.activeElement as HTMLElement) || null;
    const container = sheetRef.current;
    if (container) {
      const focusables = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length > 0) {
        focusables[0].focus();
      }
    }
    return () => {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      if (onClose) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
      return;
    }
    if (e.key === 'Tab') {
      const container = sheetRef.current;
      if (!container) return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);

      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  // Screen reader live region step announcement (derived)
  const announcement =
    viewMode === 'my_reports'
      ? REPORT_I18N.myReportsBtn[language]
      : submittedReport
      ? `${REPORT_I18N.reportSentTitle[language]}. ${REPORT_I18N.reportSentUpdates[language].replace('{ref}', submittedReport.shortId)}`
      : REPORT_I18N.stepAnnouncements[step][language];

  // Handle Photo selection with canvas resize & EXIF stripping
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    try {
      const { blob, hash } = await prepareReportPhoto(file);
      setPhotoFile(blob);
      setPhotoHash(hash);
      setPhotoSizeKb(Math.round(blob.size / 1024));
      const previewUrl = URL.createObjectURL(blob);
      setPhotoPreview(previewUrl);
    } catch (err) {
      console.error('Photo preparation error', err);
      setPhotoError(err instanceof Error ? err.message : 'Failed to process photo');
    }
  };

  const removePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoHash(null);
    setPhotoSizeKb(0);
    setPhotoError(null);
  };

  // Toggle Chip insertion into Description
  const handleChipToggle = (chipId: string, phrase: string) => {
    const nextSet = new Set(selectedChips);
    let newDesc = description.trim();

    if (nextSet.has(chipId)) {
      nextSet.delete(chipId);
      const pattern = new RegExp(`(^|,\\s*|\\s*)${phrase}(,\\s*|\\s*|$)`, 'i');
      newDesc = newDesc.replace(pattern, ' ').replace(/\s{2,}/g, ' ').trim();
    } else {
      nextSet.add(chipId);
      if (newDesc.length > 0) {
        newDesc = `${newDesc}, ${phrase}`;
      } else {
        newDesc = phrase;
      }
    }

    if (newDesc.length <= 1000) {
      setSelectedChips(nextSet);
      setDescription(newDesc);
    }
  };

  // Voice note via SpeechRecognition
  const handleVoiceNote = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        language === 'pa'
          ? 'ਤੁਹਾਡਾ ਬ੍ਰਾਊਜ਼ਰ ਵੌਇਸ ਰਿਕਾਰਡਿੰਗ ਦਾ ਸਮਰਥਨ ਨਹੀਂ ਕਰਦਾ।'
          : language === 'hi'
          ? 'आपका ब्राउज़र वॉयस रिकॉर्डिंग का समर्थन नहीं करता।'
          : 'Speech recognition is not supported in this browser.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language === 'pa' ? 'pa-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsRecording(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setDescription((prev) => {
            const trimmed = prev.trim();
            const combined = trimmed ? `${trimmed}. ${transcript}` : transcript;
            return combined.slice(0, 1000);
          });
        }
        setIsRecording(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (e) {
      console.error('Voice dictation failed', e);
      setIsRecording(false);
    }
  };

  // Map Dragging and Pin Drop
  const ZOOM = 12;
  const tiles = tilesAround(initialLocation, ZOOM, 2);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: mapOffset.x,
      startY: mapOffset.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;

    const newX = Math.max(-140, Math.min(140, dragStartRef.current.startX + dx));
    const newY = Math.max(-140, Math.min(140, dragStartRef.current.startY + dy));

    setMapOffset({ x: newX, y: newY });
    const updated = unprojectOffset(initialLocation, newX, newY, ZOOM);
    setPin(updated);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left - rect.width / 2;
    const clickY = e.clientY - rect.top - rect.height / 2;

    const clampedX = Math.max(-140, Math.min(140, clickX));
    const clampedY = Math.max(-140, Math.min(140, clickY));
    setMapOffset({ x: clampedX, y: clampedY });

    const updated = unprojectOffset(initialLocation, clampedX, clampedY, ZOOM);
    setPin(updated);
  };

  // Submit Complaint Workflow
  const handleSendReport = async () => {
    if (!selectedType) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let evidenceList: Array<{
        object_key: string;
        media_type: string;
        hash: string;
        captured_timestamp: string;
        location?: { lat: number; lon: number };
      }> = [];

      // 1. Upload photo if present
      if (photoFile && photoHash) {
        const uploadResult = await uploadEvidencePhoto(photoFile, photoHash);
        evidenceList = [
          {
            object_key: uploadResult.object_key,
            media_type: uploadResult.media_type,
            hash: uploadResult.hash,
            captured_timestamp: new Date().toISOString(),
            location: { lat: pin.lat, lon: pin.lon },
          },
        ];
      }

      // 2. Submit complaint with the pin's coordinates, not the school's!
      const tile = TILES.find((t) => t.type === selectedType);
      const res = await submitComplaint({
        category: selectedType,
        description: description.trim(),
        lat: pin.lat,
        lon: pin.lon,
        latitude: pin.lat,
        longitude: pin.lon,
        reported_by_role: role,
        evidence: evidenceList,
      });

      const reportId = res.id || res.ticket_id;
      const isMock = isMockMode() || reportId.startsWith('c_mock_') || reportId.startsWith('TKT-');

      const saved: SavedReport = {
        id: reportId,
        shortId: shortenId(reportId),
        type: selectedType,
        typeName: tile ? tile.label[language] : selectedType,
        lat: pin.lat,
        lon: pin.lon,
        description: description.trim(),
        hasPhoto: !!photoFile,
        createdAt: res.created_at || new Date().toISOString(),
        isMock,
      };

      saveReportToStorage(saved);
      setSubmittedReport(saved);
    } catch (err) {
      console.error('Submission failed', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit incident report');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inspect Live Status of a saved report
  const handleInspectStatus = async (report: SavedReport) => {
    setInspectingReport(report);
    setStatusLoading(true);
    setStatusError(null);
    setLiveStatus(null);

    try {
      const data = await getComplaintStatus(report.id);
      setLiveStatus(data);
    } catch (err) {
      console.error('Failed to load complaint status', err);
      setStatusError(err instanceof Error ? err.message : 'Failed to load report status');
    } finally {
      setStatusLoading(false);
    }
  };

  const selectedTile = TILES.find((t) => t.type === selectedType);
  const placeLabel =
    initialLocation.label ||
    (language === 'pa' ? 'ਸੰਗਰੂਰ' : language === 'hi' ? 'संगरूर' : 'Sangrur');

  return (
    <div
      ref={sheetRef}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      style={{ outline: 'none' }}
    >
      {/* Screen Reader Step Announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {announcement}
      </div>

      <Card padding="lg" style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
        {/* Top Header & View Mode Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>📢</span>
            <h3 id="report-modal-title" style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>
              {REPORT_I18N.headerTitle[language]}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'form' ? 'my_reports' : 'form')}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '9999px',
                border: '1.5px solid #cbd5e1',
                backgroundColor: viewMode === 'my_reports' ? '#f0fdf4' : '#f8fafc',
                color: viewMode === 'my_reports' ? '#166534' : '#475569',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                minHeight: '44px',
                minWidth: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              📋 {REPORT_I18N.myReportsBtn[language]} ({savedReports.length})
            </button>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label={REPORT_I18N.closeBtn[language]}
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                ✕
              </Button>
            )}
          </div>
        </div>

        {/* VIEW 1: MY REPORTS DRAWER / INSPECTION */}
        {viewMode === 'my_reports' ? (
          <Stack gap="md">
            {inspectingReport ? (
              <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <Badge variant="neutral" size="sm">{inspectingReport.shortId}</Badge>
                    <h4 style={{ margin: '0.25rem 0 0 0', fontSize: '1rem', color: '#0f172a' }}>
                      {inspectingReport.typeName}
                    </h4>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {inspectingReport.lat.toFixed(4)}°N, {inspectingReport.lon.toFixed(4)}°E
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setInspectingReport(null)}
                    style={{ minHeight: '44px', minWidth: '44px' }}
                  >
                    {REPORT_I18N.backBtn[language]}
                  </Button>
                </div>

                {inspectingReport.isMock && (
                  <div style={{ padding: '0.5rem', backgroundColor: '#fef3c7', borderRadius: '0.375rem', fontSize: '0.75rem', color: '#92400e', marginBottom: '0.75rem' }}>
                    ℹ️ {REPORT_I18N.mockNotice[language]}
                  </div>
                )}

                {/* Status Timeline Card */}
                {statusLoading && <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{REPORT_I18N.checkingStatus[language]}</p>}
                {statusError && <Alert variant="danger">{statusError}</Alert>}
                {liveStatus && (
                  <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>
                        {liveStatus.status === 'closed' ? '✅' : liveStatus.status === 'acted_on' ? '⚡' : liveStatus.status === 'merged' ? '🔗' : '⏳'}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                          {liveStatus.stage_label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Status: <code>{liveStatus.status}</code>
                        </div>
                      </div>
                    </div>

                    <p style={{ margin: '0.5rem 0 0.75rem 0', fontSize: '0.8125rem', color: '#334155', lineHeight: 1.4 }}>
                      {liveStatus.explanation}
                    </p>

                    {/* Special notification if merged */}
                    {liveStatus.status === 'merged' && (
                      <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#eff6ff', borderLeft: '4px solid #3b82f6', borderRadius: '0.25rem', fontSize: '0.8125rem', color: '#1e40af', fontWeight: 600 }}>
                        {REPORT_I18N.mergedNotice[language]}
                      </div>
                    )}

                    {/* Read-only timeline steps */}
                    <div style={{ marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>
                        {REPORT_I18N.statusTimelineHeading[language]}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', fontWeight: 600 }}>
                          <span>✓</span> 1. Received &amp; verified
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: liveStatus.status !== 'received' ? '#166534' : '#94a3b8', fontWeight: liveStatus.status !== 'received' ? 600 : 400 }}>
                          <span>{liveStatus.status !== 'received' ? '✓' : '○'}</span> 2. Sent to department officer
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: ['case_opened', 'merged', 'acted_on', 'closed'].includes(liveStatus.status) ? '#166534' : '#94a3b8', fontWeight: ['case_opened', 'merged', 'acted_on', 'closed'].includes(liveStatus.status) ? 600 : 400 }}>
                          <span>{['case_opened', 'merged', 'acted_on', 'closed'].includes(liveStatus.status) ? '✓' : '○'}</span> 3. Case opened / Merged with area report
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: ['acted_on', 'closed'].includes(liveStatus.status) ? '#166534' : '#94a3b8', fontWeight: ['acted_on', 'closed'].includes(liveStatus.status) ? 600 : 400 }}>
                          <span>{['acted_on', 'closed'].includes(liveStatus.status) ? '✓' : '○'}</span> 4. Action taken on site
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: liveStatus.status === 'closed' ? '#166534' : '#94a3b8', fontWeight: liveStatus.status === 'closed' ? 600 : 400 }}>
                          <span>{liveStatus.status === 'closed' ? '✓' : '○'}</span> 5. Resolved and closed
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : savedReports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                <p style={{ margin: 0, fontSize: '0.875rem' }}>
                  {REPORT_I18N.noReportsYet[language]}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {savedReports.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleInspectStatus(item)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem 1rem',
                      backgroundColor: '#ffffff',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      minHeight: '44px',
                      width: '100%',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                        {item.typeName} <span style={{ color: '#64748b', fontWeight: 400 }}>({item.shortId})</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {new Date(item.createdAt).toLocaleDateString()} • {item.lat.toFixed(4)}°N, {item.lon.toFixed(4)}°E
                      </div>
                    </div>
                    <Badge variant="primary" size="sm">
                      {REPORT_I18N.trackStatusBtn[language]} →
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </Stack>
        ) : submittedReport ? (
          /* CONFIRMATION VIEW (HONEST & DEVELOPER-WORDING FREE) */
          <div style={{ textAlign: 'center', padding: '1.5rem 1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
            <h3 style={{ margin: '0 0 0.25rem 0', color: '#166534', fontSize: '1.25rem', fontWeight: 800 }}>
              {REPORT_I18N.reportSentTitle[language]}
            </h3>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#15803d' }}>
              {REPORT_I18N.reportSentUpdates[language].replace('{ref}', submittedReport.shortId)}
            </p>

            {submittedReport.isMock && (
              <div style={{ display: 'inline-block', padding: '0.35rem 0.75rem', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '9999px', fontSize: '0.8125rem', color: '#92400e', fontWeight: 600, marginBottom: '1rem' }}>
                ℹ️ {REPORT_I18N.mockNotice[language]}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <Button
                size="md"
                variant="primary"
                onClick={() => {
                  setInspectingReport(submittedReport);
                  setViewMode('my_reports');
                }}
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                {REPORT_I18N.trackStatusBtn[language]}
              </Button>
              <Button
                size="md"
                variant="secondary"
                onClick={() => {
                  setSubmittedReport(null);
                  setStep(1);
                  setSelectedType(null);
                  setDescription('');
                  setSelectedChips(new Set());
                  removePhoto();
                }}
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                {REPORT_I18N.reportAnotherBtn[language]}
              </Button>
            </div>
          </div>
        ) : (
          /* 4-STEP REPORT WIZARD */
          <div>
            {/* Progress Bar at top */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>
                <span style={{ color: step >= 1 ? '#0284c7' : '#94a3b8' }}>{REPORT_I18N.steps[1][language]}</span>
                <span style={{ color: step >= 2 ? '#0284c7' : '#94a3b8' }}>{REPORT_I18N.steps[2][language]}</span>
                <span style={{ color: step >= 3 ? '#0284c7' : '#94a3b8' }}>{REPORT_I18N.steps[3][language]}</span>
                <span style={{ color: step >= 4 ? '#0284c7' : '#94a3b8' }}>{REPORT_I18N.steps[4][language]}</span>
              </div>
              <div style={{ height: '6px', width: '100%', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${(step / 4) * 100}%`,
                    backgroundColor: '#0284c7',
                    transition: 'width 0.25s ease',
                  }}
                />
              </div>
            </div>

            {/* STEP 1: WHAT IS IT? */}
            {step === 1 && (
              <Stack gap="md">
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
                    {REPORT_I18N.step1Title[language]}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.4 }}>
                    {REPORT_I18N.step1Subtitle[language]}
                  </p>
                </div>

                {/* Big Tiles Grid: Responsive & full width on phones */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem', width: '100%' }}>
                  {TILES.filter((t) => isMockMode() || (t.type !== 'dust' && t.type !== 'industrial')).map((tile) => {
                    const isSelected = selectedType === tile.type;
                    return (
                      <button
                        key={tile.type}
                        type="button"
                        onClick={() => {
                          setSelectedType(tile.type);
                          setStep(2);
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '0.875rem 1rem',
                          borderRadius: '0.5rem',
                          border: `2px solid ${isSelected ? '#0284c7' : '#cbd5e1'}`,
                          backgroundColor: isSelected ? '#f0f9ff' : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          minHeight: '64px',
                          minWidth: '44px',
                          width: '100%',
                          transition: 'border-color 0.15s ease, background-color 0.15s ease',
                        }}
                      >
                        <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{tile.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                          {tile.label[language]}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                          {tile.hint[language]}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* "Not sure" Helper */}
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowNotSureHelper((prev) => !prev)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0284c7',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      padding: '0.25rem 0',
                      minHeight: '44px',
                      minWidth: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    {REPORT_I18N.notSureBtn[language]}
                  </button>

                  {showNotSureHelper && (
                    <div style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>
                        {REPORT_I18N.notSurePrompt[language]}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedType('farm_fire');
                            setStep(2);
                          }}
                          style={{ minHeight: '44px', minWidth: '44px' }}
                        >
                          {REPORT_I18N.notSureFire[language]}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedType('dust');
                            setStep(2);
                          }}
                          style={{ minHeight: '44px', minWidth: '44px' }}
                        >
                          {REPORT_I18N.notSureDust[language]}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedType('vehicle');
                            setStep(2);
                          }}
                          style={{ minHeight: '44px', minWidth: '44px' }}
                        >
                          {REPORT_I18N.notSureVehicle[language]}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Stack>
            )}

            {/* STEP 2: WHERE? (DRAGGABLE PIN MAP) */}
            {step === 2 && (
              <Stack gap="md">
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
                    📍 {REPORT_I18N.nearYou[language]} · {placeLabel}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                    {REPORT_I18N.step2Instruction[language]}
                  </p>
                </div>

                {/* Coordinates & Accuracy Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.8125rem', color: '#334155', fontWeight: 600 }}>
                    {REPORT_I18N.pinLocationLabel[language]}: <code>{pin.lat.toFixed(4)}°N, {pin.lon.toFixed(4)}°E</code>
                  </div>
                  {initialLocation.accuracyM && (
                    <Badge variant="neutral" size="sm">
                      {REPORT_I18N.deviceAccuracyLabel[language]} ±{initialLocation.accuracyM} m
                    </Badge>
                  )}
                </div>

                {/* Optional School Fallback button */}
                {schoolLocation && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPin({ lat: schoolLocation.lat, lon: schoolLocation.lon });
                      setMapOffset({ x: 0, y: 0 });
                    }}
                    style={{ minHeight: '44px', width: '100%' }}
                  >
                    🏫 {REPORT_I18N.useSchoolLocationBtn[language]}: {schoolLocation.label}
                  </Button>
                )}

                {/* Interactive Draggable Pin Map Viewport */}
                <div
                  ref={mapContainerRef}
                  onClick={handleMapClick}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '240px',
                    backgroundColor: '#e2e8f0',
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                    touchAction: 'none',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    border: '1px solid #cbd5e1',
                  }}
                  role="region"
                  aria-label="Map to select smoke location"
                >
                  {/* Background raster tile grid */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: `translate(-50%, -50%) translate(${mapOffset.x}px, ${mapOffset.y}px)`,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 64px)',
                      gridTemplateRows: 'repeat(5, 64px)',
                      opacity: 0.85,
                      pointerEvents: 'none',
                    }}
                  >
                    {tiles.slice(0, 25).map((t, idx) => (
                      <div
                        key={idx}
                        style={{
                          width: '64px',
                          height: '64px',
                          border: '1px solid #94a3b8',
                          backgroundColor: idx % 2 === 0 ? '#cbd5e1' : '#e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          color: '#64748b',
                        }}
                      >
                        {idx === 12 ? '📍' : ''}
                      </div>
                    ))}
                  </div>

                  {/* Center Crosshair Marker */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      pointerEvents: 'none',
                      zIndex: 2,
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: '2rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                        📍
                      </span>
                    </div>
                  </div>

                  {/* Floating drag instruction badge */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '0.5rem',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      color: '#ffffff',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                      zIndex: 3,
                    }}
                  >
                    👆 {REPORT_I18N.step2Instruction[language]}
                  </div>
                </div>

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  <Button
                    size="md"
                    variant="secondary"
                    onClick={() => setStep(1)}
                    style={{ minHeight: '44px', minWidth: '44px' }}
                  >
                    {REPORT_I18N.backBtn[language]}
                  </Button>
                  <Button
                    size="md"
                    variant="primary"
                    onClick={() => setStep(3)}
                    style={{ minHeight: '44px', minWidth: '44px' }}
                  >
                    {REPORT_I18N.steps[3][language]} →
                  </Button>
                </div>
              </Stack>
            )}

            {/* STEP 3: DETAILS */}
            {step === 3 && (
              <Stack gap="md">
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
                    📝 {REPORT_I18N.step3Title[language]}
                  </h4>
                </div>

                {/* Quick Chips Groups */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {CHIP_CATEGORIES.map((cat, idx) => (
                    <div key={idx}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                        {cat.title[language]}:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {cat.chips.map((chip) => {
                          const isSelected = selectedChips.has(chip.id);
                          return (
                            <button
                              key={chip.id}
                              type="button"
                              onClick={() => handleChipToggle(chip.id, chip.label[language])}
                              style={{
                                padding: '0.5rem 0.875rem',
                                borderRadius: '9999px',
                                border: `1.5px solid ${isSelected ? '#0284c7' : '#cbd5e1'}`,
                                backgroundColor: isSelected ? '#e0f2fe' : '#ffffff',
                                color: isSelected ? '#0369a1' : '#334155',
                                fontWeight: 600,
                                fontSize: '0.8125rem',
                                cursor: 'pointer',
                                minHeight: '44px',
                                minWidth: '44px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                            >
                              {isSelected ? '✓ ' : '+ '}
                              {chip.label[language]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Editable Text Area (Starts EMPTY, max 1000 characters) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label htmlFor="report-desc" style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                      {REPORT_I18N.noteLabel[language]}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={handleVoiceNote}
                        style={{
                          background: 'none',
                          border: '1px solid #cbd5e1',
                          borderRadius: '0.375rem',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          color: isRecording ? '#dc2626' : '#0284c7',
                          fontWeight: 600,
                          cursor: 'pointer',
                          minHeight: '44px',
                          minWidth: '44px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        {isRecording ? REPORT_I18N.dictating[language] : REPORT_I18N.dictateBtn[language]}
                      </button>
                      <span style={{ fontSize: '0.75rem', color: description.length > 900 ? '#dc2626' : '#64748b' }}>
                        {description.length}/1000
                      </span>
                    </div>
                  </div>
                  <textarea
                    id="report-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                    placeholder={REPORT_I18N.notePlaceholder[language]}
                    style={{
                      width: '100%',
                      padding: '0.625rem',
                      borderRadius: '0.375rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.875rem',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* Photo Input (1600px resize & EXIF stripping) */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>
                    {REPORT_I18N.photoLabel[language]}
                  </label>
                  {photoError && <Alert variant="danger">{photoError}</Alert>}

                  {photoPreview ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoPreview}
                        alt="Captured evidence"
                        style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>
                          {REPORT_I18N.photoAttachedText[language]} ({photoSizeKb} KB)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>
                          {REPORT_I18N.photoCleanedText[language]}
                        </div>
                        {photoHash && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                            SHA-256: {photoHash.slice(0, 12)}…
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={removePhoto}
                        style={{ minHeight: '44px', minWidth: '44px' }}
                      >
                        {REPORT_I18N.removePhotoBtn[language]}
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <input
                        id={fileInputId}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoSelect}
                        style={{ display: 'none' }}
                      />
                      <label
                        htmlFor={fileInputId}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.625rem 1rem',
                          borderRadius: '0.375rem',
                          border: '1.5px dashed #cbd5e1',
                          backgroundColor: '#f8fafc',
                          color: '#0284c7',
                          fontWeight: 600,
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          minHeight: '44px',
                          minWidth: '44px',
                        }}
                      >
                        {REPORT_I18N.takePhotoBtn[language]}
                      </label>
                    </div>
                  )}
                </div>

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  <Button
                    size="md"
                    variant="secondary"
                    onClick={() => setStep(2)}
                    style={{ minHeight: '44px', minWidth: '44px' }}
                  >
                    {REPORT_I18N.backBtn[language]}
                  </Button>
                  <Button
                    size="md"
                    variant="primary"
                    onClick={() => setStep(4)}
                    style={{ minHeight: '44px', minWidth: '44px' }}
                  >
                    {REPORT_I18N.nextCheckBtn[language]}
                  </Button>
                </div>
              </Stack>
            )}

            {/* STEP 4: CHECK AND SEND */}
            {step === 4 && (
              <Stack gap="md">
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
                    🔍 {REPORT_I18N.step4Title[language]}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#64748b' }}>
                    {REPORT_I18N.step4Subtitle[language]}
                  </p>
                </div>

                {submitError && <Alert variant="danger">{submitError}</Alert>}

                {/* Summary Card */}
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', fontSize: '0.875rem' }}>
                    <div style={{ color: '#64748b', fontWeight: 600 }}>{REPORT_I18N.typeLabel[language]}</div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      {selectedTile?.icon} {selectedTile?.label[language]}
                      <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 500 }}>
                        {REPORT_I18N.routesToLabel[language]} {selectedTile?.destination} ({selectedTile?.deadline})
                      </div>
                    </div>

                    <div style={{ color: '#64748b', fontWeight: 600 }}>{REPORT_I18N.locationLabel[language]}</div>
                    <div style={{ color: '#0f172a' }}>
                      <code>{pin.lat.toFixed(4)}°N, {pin.lon.toFixed(4)}°E</code>
                    </div>

                    <div style={{ color: '#64748b', fontWeight: 600 }}>{REPORT_I18N.noteSummaryLabel[language]}</div>
                    <div style={{ color: '#0f172a' }}>
                      {description || <em style={{ color: '#94a3b8' }}>{REPORT_I18N.noneAdded[language]}</em>}
                    </div>

                    <div style={{ color: '#64748b', fontWeight: 600 }}>{REPORT_I18N.photoSummaryLabel[language]}</div>
                    <div style={{ color: '#0f172a' }}>
                      {photoFile ? (
                        <span style={{ color: '#166534', fontWeight: 600 }}>
                          {REPORT_I18N.onePhotoAttached[language]} ({photoSizeKb} KB)
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>{REPORT_I18N.noPhoto[language]}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Privacy Notice */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: '#f0fdf4', borderRadius: '0.375rem', border: '1px solid #bbf7d0', fontSize: '0.8125rem', color: '#166534' }}>
                  <span>🛡️</span>
                  <span>{REPORT_I18N.photoExifPrivacy[language]}</span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <Button
                    size="md"
                    variant="secondary"
                    onClick={() => setStep(3)}
                    disabled={isSubmitting}
                    style={{ minHeight: '44px', minWidth: '44px' }}
                  >
                    {REPORT_I18N.backBtn[language]}
                  </Button>
                  <Button
                    size="md"
                    variant="primary"
                    onClick={handleSendReport}
                    disabled={isSubmitting}
                    style={{ minHeight: '44px', minWidth: '140px' }}
                  >
                    {isSubmitting ? REPORT_I18N.sendingReportBtn[language] : REPORT_I18N.sendReportBtn[language]}
                  </Button>
                </div>
              </Stack>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
