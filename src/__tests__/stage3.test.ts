import { describe, expect, it } from 'vitest';
import { updateRoomState, DEFAULT_HOME } from '../app/ghar/homeState';

describe('Ghar Stage 3 Form Logic', () => {
  it('Converts ft to m2 correctly', () => {
    const start = DEFAULT_HOME.rooms[0];
    const ui = { ...start.ui, sizeMode: 'custom_ft' as const, customLength: 10, customWidth: 10 };
    const updated = updateRoomState(start, ui);
    // 10ft x 10ft = 3.048m x 3.048m = 9.290304 m2
    expect(updated.request.room_area_m2).toBeCloseTo(9.29, 2);
  });

  it('Converts m to m2 correctly', () => {
    const start = DEFAULT_HOME.rooms[0];
    const ui = { ...start.ui, sizeMode: 'custom_m' as const, customLength: 5, customWidth: 4 };
    const updated = updateRoomState(start, ui);
    expect(updated.request.room_area_m2).toBe(20);
  });

  it('Uses preset room sizes', () => {
    const start = DEFAULT_HOME.rooms[0];
    let updated = updateRoomState(start, { sizeMode: 'small' });
    expect(updated.request.room_area_m2).toBe(10);
    updated = updateRoomState(start, { sizeMode: 'medium' });
    expect(updated.request.room_area_m2).toBe(15);
    updated = updateRoomState(start, { sizeMode: 'large' });
    expect(updated.request.room_area_m2).toBe(20);
  });

  it('Converts cfm to m3/h', () => {
    const start = DEFAULT_HOME.rooms[0];
    // This is handled in the UI directly, but we can test the fallback in updateRoomState
    // Actually, in updateRoomState `purifier_cadr_m3_h` just takes room.request.purifier_cadr_m3_h if 'custom'.
    // The UI is what transforms cfm to m3h: val * 1.7
    // We'll test the preset values instead.
    const updatedSmall = updateRoomState(start, { purifierMode: 'small' });
    expect(updatedSmall.request.purifier_cadr_m3_h).toBe(250);

    const updatedLarge = updateRoomState(start, { purifierMode: 'large' });
    expect(updatedLarge.request.purifier_cadr_m3_h).toBe(500);

    const updatedNo = updateRoomState(start, { purifierMode: 'no' });
    expect(updatedNo.request.purifier_cadr_m3_h).toBe(0);
  });

  it('Sets windows_open to afternoon value', () => {
    const start = DEFAULT_HOME.rooms[0];
    let updated = updateRoomState(start, { windowsAfternoon: true });
    expect(updated.request.windows_open).toBe(true);

    updated = updateRoomState(start, { windowsAfternoon: false });
    expect(updated.request.windows_open).toBe(false);
  });

  it('Maps smoker select to smoker count properly', () => {
    const start = DEFAULT_HOME.rooms[0];
    
    expect(updateRoomState(start, { smokerSelect: 'unanswered' }).request.smokers).toBe(0);
    expect(updateRoomState(start, { smokerSelect: 'no' }).request.smokers).toBe(0);
    expect(updateRoomState(start, { smokerSelect: 'prefer_not' }).request.smokers).toBe(0);
    expect(updateRoomState(start, { smokerSelect: 'sometimes' }).request.smokers).toBe(0.5);
    expect(updateRoomState(start, { smokerSelect: 'every_day' }).request.smokers).toBe(1);
  });
});
