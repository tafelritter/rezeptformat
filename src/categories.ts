// SPDX-License-Identifier: AGPL-3.0-or-later

/** Standard-Kategorien der Einkaufsliste (plan/03-phase-1-einkaufsliste.md, 1.9). */
export const CATEGORIES = [
  { id: 'obst-gemuese', name: 'Obst & Gemüse' },
  { id: 'brot-backwaren', name: 'Brot & Backwaren' },
  { id: 'milch-kaese-eier', name: 'Milch, Käse & Eier' },
  { id: 'fleisch-wurst-fisch', name: 'Fleisch, Wurst & Fisch' },
  { id: 'tiefkuehl', name: 'Tiefkühl' },
  { id: 'nudeln-reis-konserven', name: 'Nudeln, Reis & Konserven' },
  { id: 'backen', name: 'Backen' },
  { id: 'gewuerze-oele-saucen', name: 'Gewürze, Öle & Saucen' },
  { id: 'fruehstueck-aufstriche', name: 'Frühstück & Aufstriche' },
  { id: 'suesses-snacks', name: 'Süßes & Snacks' },
  { id: 'getraenke', name: 'Getränke' },
  { id: 'drogerie-haushalt', name: 'Drogerie & Haushalt' },
  { id: 'sonstiges', name: 'Sonstiges' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export const FALLBACK_CATEGORY: CategoryId = 'sonstiges'

const IDS = new Set<string>(CATEGORIES.map((c) => c.id))

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && IDS.has(value)
}

export function categoryName(id: CategoryId): string {
  return CATEGORIES.find((c) => c.id === id)?.name ?? id
}

/** Standard-Reihenfolge; Läden können eine eigene festlegen. */
export const DEFAULT_ORDER: readonly CategoryId[] = CATEGORIES.map((c) => c.id)

/**
 * Vergleichsschlüssel für Artikelnamen: Unicode-normalisiert, klein,
 * Leerraum zusammengefasst. „  Äpfel “ und „äpfel“ ergeben denselben Schlüssel.
 */
export function normalizeName(name: string): string {
  return name.normalize('NFC').toLocaleLowerCase('de-DE').replace(/\s+/g, ' ').trim()
}
