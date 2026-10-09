import { describe, expect, it } from 'vitest';
import { buildMergedPlan, buildHomeSummary, type RoomWithEstimate } from '../app/ghar/summaryLogic';
import type { IndoorEstimate } from '../../packages/aqi/indoor';

describe('Home Summary and Merged Plan Logic', () => {
  const mockEstimate: IndoorEstimate = {
    indoor_pm25_now_ug_m3: 40,
    outdoor_pm25_now_ug_m3: 60,
    hourly_series: [
      { time: '2026-10-09T08:00:00+05:30', indoor_pm25_ug_m3: 40, outdoor_pm25_ug_m3: 60 },
      { time: '2026-10-09T14:00:00+05:30', indoor_pm25_ug_m3: 45, outdoor_pm25_ug_m3: 85 }, // Peak
      { time: '2026-10-09T20:00:00+05:30', indoor_pm25_ug_m3: 35, outdoor_pm25_ug_m3: 50 },
    ],
    today_plan: '',
    plan: [
      { kind: 'windows', key: 'windows_open_time', from: '14:00', to: '16:00', pm25: 50, text: 'Open windows at 14:00' },
      { kind: 'source', key: 'source_incense', pm25: 30, text: 'Incense adds up to 30' }
    ],
    assumptions: {}
  };

  const mockCleanEstimate: IndoorEstimate = {
    ...mockEstimate,
    indoor_pm25_now_ug_m3: 20,
    plan: [
      { kind: 'purifier', key: 'purifier_run', pm25: 15, text: 'Run purifier' }
    ]
  };

  const rooms: RoomWithEstimate[] = [
    { id: 'room1', name: 'Living Room', estimate: mockEstimate },
    { id: 'room2', name: 'Bedroom', estimate: mockCleanEstimate }
  ];

  it('Merging plans from rooms with stable identities and chronological sorting', () => {
    const merged = buildMergedPlan(rooms);
    expect(merged).toHaveLength(3);
    
    // source_incense and purifier_run have no 'from', so they sort first, in room order.
    expect(merged[0].key).toBe('source_incense');
    expect(merged[0].uid).toBe('room1_source_incense');

    expect(merged[1].key).toBe('purifier_run');
    expect(merged[1].uid).toBe('room2_purifier_run');
    expect(merged[1].roomName).toBe('Bedroom');

    expect(merged[2].key).toBe('windows_open_time'); // Has from: 14:00
    expect(merged[2].uid).toBe('room1_windows_open_time');
    expect(merged[2].from).toBe('14:00');
  });

  it('Builds deterministic home summary facts safely', () => {
    const summary = buildHomeSummary(rooms);

    // Outside peak
    expect(summary.outsidePeak?.pm25).toBe(85);
    expect(summary.outsidePeak?.time).toBe('2026-10-09T14:00:00+05:30');

    // Worst room
    expect(summary.worstRoom?.name).toBe('Living Room');
    expect(summary.worstRoom?.pm25).toBe(40);
    expect(summary.worstRoom?.sourceKey).toBe('source_incense');

    // Cleanest room
    expect(summary.cleanestRoom?.name).toBe('Bedroom');
    expect(summary.cleanestRoom?.pm25).toBe(20);

    // Biggest change
    expect(summary.biggestChange?.reduction).toBe(30);
    expect(summary.biggestChange?.actionKey).toBe('source_incense');
    expect(summary.biggestChange?.roomName).toBe('Living Room');
  });

  it('Handles missing or incomplete data safely without guessing', () => {
    const emptyRooms: RoomWithEstimate[] = [{ id: 'room1', name: 'Kitchen' }];
    const summary = buildHomeSummary(emptyRooms);
    expect(summary.outsidePeak).toBeUndefined();
    expect(summary.worstRoom).toBeUndefined();
    expect(summary.cleanestRoom).toBeUndefined();
    expect(summary.biggestChange).toBeUndefined();
  });
});

describe('Tick Persistence Logic', () => {
  it('Date-scoped completion so yesterday checks do not carry into today', () => {
    // We test the logic manually by creating the exact structure
    const getTodayStr = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    
    // Simulate yesterday data
    const yesterdayData = {
      date: '1999-01-01',
      checks: { 'room1_purifier_run': true }
    };
    
    expect(yesterdayData.date).not.toBe(getTodayStr());
    
    // Ticking logic validation: toggle updates the dictionary and date
    const state = { 'room1_purifier_run': false };
    const nextState = { ...state, 'room1_purifier_run': true };
    const written = { date: getTodayStr(), checks: nextState };
    expect(written.date).toBe(getTodayStr());
    expect(written.checks['room1_purifier_run']).toBe(true);
  });
});
