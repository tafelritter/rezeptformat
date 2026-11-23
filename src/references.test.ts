// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { formatAmount } from './amount.js'
import { parseRecipe } from './recipe.js'
import {
  type RecipeEntry,
  type RecipeIndex,
  checkReferences,
  findCycle,
  flattenIngredients,
  referenceFactor,
  resolveAll,
  resolveReference,
} from './references.js'

const entry = (key: string, scope: string, src: string, path?: string): RecipeEntry => ({
  key,
  scope,
  recipe: parseRecipe(src),
  ...(path ? { path } : {}),
})

const HEFETEIG = `---
title: Hefeteig
yield: 800 g
diet: vegetarisch
---
Verknete @Mehl{500%g}, @Milch{250%ml}, @Butter{50%g} und @Hefe{1/2%Würfel}.`

const KUCHEN = `---
title: Zwetschgenkuchen
servings: 12
---
Rolle @./Hefeteig{500%g} aus. Belege mit @Zwetschgen{1,5%kg} und @Butter{30%g}.`

const index: RecipeIndex = {
  entries: [
    entry('space:a/1', 'a', HEFETEIG),
    entry('space:a/2', 'a', KUCHEN),
    entry(
      'catalog:backen/hefeteig',
      'catalog',
      HEFETEIG.replace('800 g', '1 kg'),
      'backen/hefeteig',
    ),
    entry(
      'catalog:brot/pizzateig',
      'catalog',
      '---\ntitle: Pizzateig\nservings: 4\n---\n@Mehl{400%g}',
      'brot/pizzateig',
    ),
  ],
}

describe('Referenzen', () => {
  it('lösen zuerst im eigenen Bereich, dann im Katalog auf', () => {
    expect(resolveReference(index, 'Hefeteig', 'a')?.key).toBe('space:a/1')
    expect(resolveReference(index, 'hefeteig', 'b')?.key).toBe('catalog:backen/hefeteig')
    expect(resolveReference(index, './backen/Hefeteig.cook', 'b')?.key).toBe(
      'catalog:backen/hefeteig',
    )
    expect(resolveReference(index, 'Pizzateig', 'b')?.key).toBe('catalog:brot/pizzateig')
    expect(resolveReference(index, 'Gibts nicht', 'a')).toBeUndefined()
  })

  it('skalieren relativ zur Ausbeute oder zu den Portionen', () => {
    const teig = index.entries[0]!.recipe
    expect(referenceFactor({ kind: 'number', value: 500, unit: 'g', scalable: true }, teig)).toBe(
      0.625,
    )
    expect(referenceFactor({ kind: 'number', value: 0.4, unit: 'kg', scalable: true }, teig)).toBe(
      0.5,
    )
    expect(
      referenceFactor({ kind: 'number', value: 1, unit: 'l', scalable: true }, teig),
    ).toBeUndefined()
    const pizza = index.entries[3]!.recipe
    expect(referenceFactor({ kind: 'number', value: 2, unit: '', scalable: true }, pizza)).toBe(0.5)
  })

  it('liefern die Zutaten des Kuchens samt Hefeteig, passend skaliert und zusammengefasst', () => {
    const list = flattenIngredients(index, index.entries[1]!.recipe, 'a')
    expect(
      Object.fromEntries(list.map((i) => [i.name, i.amounts.map(formatAmount).join(' + ')])),
    ).toEqual({
      Zwetschgen: '1,5 kg',
      Butter: '61,3 g', // 30 g + 50 g · 0,625
      Mehl: '313 g',
      Milch: '156 ml',
      Hefe: '0,31 Würfel',
    })
    // Kuchen für 24 statt 12: alles doppelt
    const doubled = flattenIngredients(index, index.entries[1]!.recipe, 'a', 2)
    expect(doubled.find((i) => i.name === 'Mehl')?.amounts.map(formatAmount)).toEqual(['625 g'])
  })

  it('lassen nicht auflösbare Referenzen als Zeile stehen', () => {
    const r = parseRecipe('---\ntitle: X\n---\n@./Fehlt{1%Stück} und @Salz{}')
    expect(flattenIngredients(index, r, 'a').map((i) => [i.name, i.reference])).toEqual([
      ['Salz', undefined],
      ['Fehlt', 'Fehlt'],
    ])
    expect(resolveAll(index, r, 'a')).toEqual([{ ingredient: 0 }])
  })

  it('erkennen Zyklen und melden sie verständlich', () => {
    const a = entry('space:x/a', 'x', '---\ntitle: A\n---\n@./B{1}')
    const b = entry('space:x/b', 'x', '---\ntitle: B\n---\n@./C{1}')
    const c = entry('space:x/c', 'x', '---\ntitle: C\n---\n@./A{1}')
    const cyclic: RecipeIndex = { entries: [a, b, c] }
    expect(findCycle(cyclic, a)).toEqual(['A', 'B', 'C', 'A'])
    // Beim Speichern: Ein neues Rezept, das sich selbst referenziert
    const self = entry('space:x/s', 'x', '---\ntitle: Selbst\n---\n@./Selbst{1}')
    expect(checkReferences({ entries: [] }, self).cycle).toEqual(['Selbst', 'Selbst'])
    expect(checkReferences(index, entry('space:a/2', 'a', KUCHEN))).toEqual({ unresolved: [] })
    expect(
      checkReferences(index, entry('space:a/9', 'a', '---\ntitle: Y\n---\n@./Fehlt{1}')).unresolved,
    ).toEqual(['Fehlt'])
    // Auch bei Zyklen endet die Auflösung
    expect(flattenIngredients(cyclic, a.recipe, 'x').length).toBeGreaterThan(0)
  })
})
