// The Shop catalogue (K13), data/seed/kisan_shop.json, typed for the Shop tab. Every figure in it
// names a source; src/__tests__/kisan-shop.test.ts holds the file to that.
import catalogue from '../../../data/seed/kisan_shop.json';
import type { Language } from './kisanApi';

export type Words = Record<Language, string>;

export interface Source {
  title: string;
  publisher: string;
  url: string | null;
  checked_on: string;
}

export interface SubsidyLine {
  part: Words | null;
  /** Subsidy for a farmer buying for themselves, and for a CHC or co-operative: pct of the price, capped at max_inr. */
  farmer: { pct: number; max_inr: [number, number] };
  chc: { pct: number; max_inr: [number, number] };
  source: string;
}

export interface ShopItem {
  id: string;
  kind: 'machine' | 'decomposer';
  /** The coverage engine's name for it, or null if the "is it enough?" check doesn't know it yet. */
  engine_type: string | null;
  names: Words;
  does: Words;
  acres_per_day: number | null;
  acres_source: string | null;
  min_window_days?: number;
  min_window_source?: string;
  /** Null: no source says what it costs, so the screen says to ask. */
  price_inr: { amount: number; per: Words; source: string } | null;
  subsidy: SubsidyLine[];
  rent_from_chc: boolean;
  links: { kind: 'subsidy'; url: string; source: string }[];
}

export interface ShopCatalogue {
  sources: Record<string, Source>;
  items: ShopItem[];
}

export const SHOP = catalogue as unknown as ShopCatalogue;
