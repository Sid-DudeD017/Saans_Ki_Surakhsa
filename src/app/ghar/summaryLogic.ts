import { type IndoorEstimate, type PlanItem } from '../../../packages/aqi/indoor';

export interface RoomWithEstimate {
  id: string;
  name: string;
  estimate?: IndoorEstimate;
}

export interface MergedPlanItem extends PlanItem {
  uid: string;
  roomId: string;
  roomName: string;
}

export function buildMergedPlan(rooms: RoomWithEstimate[]): MergedPlanItem[] {
  const merged: MergedPlanItem[] = [];

  for (const r of rooms) {
    if (!r.estimate) continue;
    for (const item of r.estimate.plan) {
      merged.push({
        ...item,
        uid: `${r.id}_${item.key}`,
        roomId: r.id,
        roomName: r.name,
      });
    }
  }

  // Sort by time: items with 'from' go by their time, others go first
  merged.sort((a, b) => {
    if (a.from && !b.from) return 1;
    if (!a.from && b.from) return -1;
    if (a.from && b.from) {
      return a.from.localeCompare(b.from);
    }
    return 0;
  });

  return merged;
}

export interface HomeSummaryFacts {
  outsidePeak?: { pm25: number; time: string };
  worstRoom?: { name: string; pm25: number; sourceKey?: string; sourceParams?: Record<string, string|number> };
  cleanestRoom?: { name: string; pm25: number };
  biggestChange?: { actionKey: string; reduction: number; roomName: string; actionParams?: Record<string, string|number> };
}

export function buildHomeSummary(rooms: RoomWithEstimate[]): HomeSummaryFacts {
  const facts: HomeSummaryFacts = {};

  // Find outside peak from the first available estimate
  const firstEst = rooms.find(r => r.estimate)?.estimate;
  if (firstEst && firstEst.hourly_series) {
    // Look at today (first 24 hours)
    const todaySeries = firstEst.hourly_series.slice(0, 24);
    let peakVal = -1;
    let peakTime = '';
    for (const s of todaySeries) {
      if (s.outdoor_pm25_ug_m3 > peakVal) {
        peakVal = s.outdoor_pm25_ug_m3;
        peakTime = s.time;
      }
    }
    if (peakVal >= 0) {
      facts.outsidePeak = { pm25: peakVal, time: peakTime };
    }
  }

  // Worst and cleanest rooms based on current indoor PM2.5
  let worstVal = -1;
  let cleanestVal = Infinity;
  let worstRoom: RoomWithEstimate | undefined;
  let cleanestRoom: RoomWithEstimate | undefined;

  for (const r of rooms) {
    if (!r.estimate) continue;
    const pm = r.estimate.indoor_pm25_now_ug_m3;
    if (pm > worstVal) {
      worstVal = pm;
      worstRoom = r;
    }
    if (pm < cleanestVal) {
      cleanestVal = pm;
      cleanestRoom = r;
    }
  }

  if (worstRoom && worstVal >= 0) {
    // find main source from worst room plan
    let sourceKey: string | undefined;
    let sourceParams: Record<string, string|number> = {};
    let highestSourceVal = -1;
    for (const p of worstRoom.estimate!.plan) {
      if (p.kind === 'source' && p.pm25 !== undefined && p.pm25 > highestSourceVal && p.key) {
        highestSourceVal = p.pm25;
        sourceKey = p.key;
        sourceParams = { pm25: p.pm25, sourceType: p.sourceType || '' };
      }
    }
    facts.worstRoom = { name: worstRoom.name, pm25: worstVal, sourceKey, sourceParams };
  }

  if (cleanestRoom && cleanestVal < Infinity && cleanestRoom !== worstRoom) {
    facts.cleanestRoom = { name: cleanestRoom.name, pm25: cleanestVal };
  }

  // Biggest change
  let maxReduction = -1;
  let bestActionKey = '';
  let bestActionRoom = '';
  let bestActionParams: Record<string, string|number> = {};
  
  for (const r of rooms) {
    if (!r.estimate) continue;
    
    for (const p of r.estimate.plan) {
      if (p.kind === 'source' && p.pm25 && p.key) {
        if (p.pm25 > maxReduction) {
          maxReduction = p.pm25;
          bestActionKey = p.key;
          bestActionRoom = r.name;
          bestActionParams = { pm25: p.pm25, sourceType: p.sourceType || '' };
        }
      }
    }
  }
  
  if (maxReduction > 0) {
    facts.biggestChange = { actionKey: bestActionKey, reduction: maxReduction, roomName: bestActionRoom, actionParams: bestActionParams };
  }

  return facts;
}
