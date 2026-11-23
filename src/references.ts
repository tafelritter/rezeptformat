// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Referenzen zwischen Rezepten (plan/04-phase-2-rezepte.md, 2.5):
 * `@./Hefeteig{500%g}` wird zuerst im selben Bereich über den Titel
 * aufgelöst, dann im öffentlichen Katalog über Pfad oder Titel.
 * Unterrezepte skalieren relativ zu ihrer Ausbeute (500 g von 800 g).
 */

import { normalizeName } from './categories.js'
import { type Amount, conversion } from './amount.js'
import { type ListedIngredient, type ParsedRecipe, listIngredients, scaleRecipe } from './recipe.js'

/** Ein Rezept, auf das verwiesen werden kann. */
export interface RecipeEntry {
  /** Eindeutiger Schlüssel, z. B. `space:<bereich>/<id>` oder `catalog:backen/hefeteig`. */
  key: string
  /** Bereich oder `catalog`. */
  scope: string
  /** Pfad im Katalog (ohne `.cook`), sonst leer. */
  path?: string
  recipe: ParsedRecipe
}

export interface RecipeIndex {
  entries: RecipeEntry[]
}

/** Maximale Tiefe als zweite Sicherung neben der Zyklen-Erkennung. */
const MAX_DEPTH = 8

const norm = (s: string) => normalizeName(s.replace(/\.cook$/i, '').replace(/^\.\//, ''))

export function resolveReference(
  index: RecipeIndex,
  reference: string,
  fromScope: string,
): RecipeEntry | undefined {
  const wanted = norm(reference)
  const title = norm(reference.split('/').at(-1) ?? reference)
  const sameScope = index.entries.filter((e) => e.scope === fromScope)
  const catalog = index.entries.filter((e) => e.scope === 'catalog')
  return (
    sameScope.find((e) => norm(e.recipe.meta.title) === title) ??
    catalog.find((e) => e.path !== undefined && norm(e.path) === wanted) ??
    catalog.find((e) => norm(e.recipe.meta.title) === title)
  )
}

/**
 * Faktor, mit dem ein Unterrezept skaliert wird, wenn `amount` davon gebraucht wird:
 * gegen die Ausbeute (500 g von 800 g = 0,625) oder gegen die Portionen (2 von 4 = 0,5).
 */
export function referenceFactor(amount: Amount | undefined, sub: ParsedRecipe): number | undefined {
  if (!amount || amount.kind === 'text') return undefined
  const value = amount.kind === 'number' ? amount.value : (amount.min + amount.max) / 2
  const y = sub.meta.yield
  if (y) {
    const c = amount.unit ? conversion(amount.unit, y.unit) : y.unit ? undefined : 1
    if (c !== undefined) return (value * c) / y.value
  }
  if (!amount.unit && sub.meta.servings) return value / sub.meta.servings
  return undefined
}

/** Findet einen Zyklus ab `start`; liefert die Titel im Kreis oder `undefined`. */
export function findCycle(index: RecipeIndex, start: RecipeEntry): string[] | undefined {
  const path: RecipeEntry[] = []
  const visit = (entry: RecipeEntry): string[] | undefined => {
    const at = path.findIndex((p) => p.key === entry.key)
    if (at >= 0) return [...path.slice(at), entry].map((e) => e.recipe.meta.title || e.key)
    if (path.length > MAX_DEPTH) return undefined
    path.push(entry)
    for (const ingredient of entry.recipe.ingredients) {
      if (!ingredient.reference) continue
      const target = resolveReference(index, ingredient.reference, entry.scope)
      const cycle = target && visit(target)
      if (cycle) return cycle
    }
    path.pop()
    return undefined
  }
  return visit(start)
}

/** Prüft ein (noch nicht gespeichertes) Rezept auf Zyklen und nicht auflösbare Referenzen. */
export function checkReferences(
  index: RecipeIndex,
  entry: RecipeEntry,
): { cycle?: string[]; unresolved: string[] } {
  const others = index.entries.filter((e) => e.key !== entry.key)
  const withEntry: RecipeIndex = { entries: [...others, entry] }
  const unresolved = entry.recipe.ingredients
    .filter((i) => i.reference && !resolveReference(withEntry, i.reference, entry.scope))
    .map((i) => i.reference!)
  const cycle = findCycle(withEntry, entry)
  return cycle ? { cycle, unresolved } : { unresolved }
}

export interface ResolvedReference {
  /** Index der Zutat im Rezept (Verwendung im Text). */
  ingredient: number
  entry?: RecipeEntry
  /** Faktor für das Unterrezept; `undefined`, wenn sich die Menge nicht umrechnen lässt. */
  factor?: number
}

export function resolveAll(
  index: RecipeIndex,
  recipe: ParsedRecipe,
  scope: string,
): ResolvedReference[] {
  return recipe.ingredients.flatMap((i, n) => {
    if (!i.reference) return []
    const entry = resolveReference(index, i.reference, scope)
    const resolved: ResolvedReference = { ingredient: n }
    if (entry) {
      resolved.entry = entry
      const factor = referenceFactor(i.amount, entry.recipe)
      if (factor !== undefined) resolved.factor = factor
    }
    return [resolved]
  })
}

/**
 * Zutatenliste mit aufgelösten Unterrezepten (für Einkaufsliste und
 * Ernährungsform). Nicht auflösbare Referenzen bleiben als eigene Zeile stehen.
 */
export function flattenIngredients(
  index: RecipeIndex,
  recipe: ParsedRecipe,
  scope: string,
  factor = 1,
  depth = 0,
  seen: ReadonlySet<string> = new Set(),
): ListedIngredient[] {
  const scaled = scaleRecipe(recipe, factor)
  const own: ParsedRecipe = {
    ...scaled,
    ingredients: scaled.ingredients.filter((i) => !i.reference),
  }
  const out = listIngredients(own)
  for (const i of scaled.ingredients) {
    if (!i.reference || i.hidden) continue
    const entry = resolveReference(index, i.reference, scope)
    const subFactor = entry ? referenceFactor(i.amount, entry.recipe) : undefined
    if (!entry || depth >= MAX_DEPTH || seen.has(entry.key)) {
      const item: ListedIngredient = {
        name: i.name,
        amounts: i.amount ? [i.amount] : [],
        optional: i.optional,
        notes: [],
      }
      item.reference = i.reference
      out.push(item)
      continue
    }
    const nested = flattenIngredients(
      index,
      entry.recipe,
      entry.scope,
      subFactor ?? 1,
      depth + 1,
      new Set([...seen, entry.key]),
    )
    for (const n of nested) out.push(i.optional ? { ...n, optional: true } : n)
  }
  return mergeListed(out)
}

function mergeListed(items: ListedIngredient[]): ListedIngredient[] {
  const byName = new Map<string, ListedIngredient>()
  for (const item of items) {
    const key = `${normalizeName(item.name)}\u0000${item.reference ?? ''}`
    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, { ...item, amounts: [...item.amounts], notes: [...item.notes] })
      continue
    }
    existing.optional &&= item.optional
    for (const note of item.notes) if (!existing.notes.includes(note)) existing.notes.push(note)
    for (const amount of item.amounts) {
      const scaled = existing.amounts.findIndex(
        (a) =>
          a.kind === 'number' &&
          amount.kind === 'number' &&
          conversion(amount.unit, a.unit) !== undefined,
      )
      if (scaled >= 0 && amount.kind === 'number') {
        const a = existing.amounts[scaled] as Extract<Amount, { kind: 'number' }>
        existing.amounts[scaled] = {
          ...a,
          value: a.value + amount.value * conversion(amount.unit, a.unit)!,
        }
      } else existing.amounts.push(amount)
    }
  }
  return [...byName.values()]
}

/** Für die Anzeige: Zutatenliste des Unterrezepts mit dem passenden Faktor. */
export function subRecipeIngredients(resolved: ResolvedReference): ListedIngredient[] {
  if (!resolved.entry) return []
  return listIngredients(scaleRecipe(resolved.entry.recipe, resolved.factor ?? 1))
}
