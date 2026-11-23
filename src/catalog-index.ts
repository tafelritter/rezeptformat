// SPDX-License-Identifier: AGPL-3.0-or-later

import { type CategoryId, isCategoryId, normalizeName } from './categories.js'

export type Diet = 'vegan' | 'vegetarisch' | 'pescetarisch' | 'omnivor'

export interface CatalogItem {
  id: string
  name: string
  category: CategoryId
  synonyms?: string[]
  diet?: Diet
  units?: string[]
}

export interface CatalogIndex {
  /** Kategorie zu einem normalisierten Namen oder Synonym. */
  lookup(normalizedName: string): CategoryId | undefined
  /** Ernährungsform eines Artikels, falls im Katalog bekannt. */
  diet(normalizedName: string): Diet | undefined
  /** Katalog-ID und Anzeigename zu einem Namen oder Synonym („Zwiebel“ → `zwiebeln`, „Zwiebeln“). */
  item(normalizedName: string): CatalogRef | undefined
  /** Anzeigenamen für Vorschläge. */
  names: string[]
  size: number
}

export interface CatalogRef {
  id: string
  name: string
}

export const EMPTY_CATALOG: CatalogIndex = {
  lookup: () => undefined,
  diet: () => undefined,
  item: () => undefined,
  names: [],
  size: 0,
}

const DIETS = new Set<string>(['vegan', 'vegetarisch', 'pescetarisch', 'omnivor'])

/** Baut den Index aus der (untrusted) Katalogdatei; ungültige Einträge werden übersprungen. */
export function buildCatalogIndex(data: unknown): CatalogIndex {
  const items =
    typeof data === 'object' && data !== null && Array.isArray((data as { items?: unknown }).items)
      ? ((data as { items: unknown[] }).items as Partial<CatalogItem>[])
      : []
  const byName = new Map<string, CategoryId>()
  const diets = new Map<string, Diet>()
  const refs = new Map<string, CatalogRef>()
  const names: string[] = []
  for (const item of items) {
    if (typeof item?.name !== 'string' || !isCategoryId(item.category)) continue
    names.push(item.name)
    const ref: CatalogRef | undefined =
      typeof item.id === 'string' && /^[a-z0-9-]{1,60}$/.test(item.id)
        ? { id: item.id, name: item.name }
        : undefined
    for (const label of [item.name, ...(Array.isArray(item.synonyms) ? item.synonyms : [])]) {
      if (typeof label !== 'string') continue
      byName.set(normalizeName(label), item.category)
      if (ref) refs.set(normalizeName(label), ref)
      if (typeof item.diet === 'string' && DIETS.has(item.diet))
        diets.set(normalizeName(label), item.diet)
    }
  }
  return {
    lookup: (key) => byName.get(key),
    diet: (key) => diets.get(key),
    item: (key) => refs.get(key),
    names: names.sort((a, b) => a.localeCompare(b, 'de')),
    size: names.length,
  }
}
