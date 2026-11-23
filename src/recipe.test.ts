// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { addAmounts, formatAmount, parseDuration, timerSeconds } from './amount.js'
import {
  listIngredients,
  parseRecipe,
  readFrontMatter,
  scaleRecipe,
  ingredientSnippet,
  setFrontMatter,
  timerSnippet,
  splitFrontMatter,
} from './recipe.js'

const KUCHEN = `---
title: Zwetschgenkuchen
servings: 12
tags: [Kuchen, Hefe]
time.prep: 30 min
time.cook: 1 h
source: Oma
---
== Teig ==
Rolle @./Hefeteig{500%g} aus und lege ihn in eine #Backform{}.

== Belag ==
Belege mit @Zwetschgen{1,5%kg} und streue @Zimt{=1%Prise} sowie @Zucker{80%g} darüber.
Backe ~{40%Minuten} bei 180 °C.

> Schmeckt lauwarm am besten.
`

describe('Front Matter', () => {
  it('liest Werte, Listen und Kommentare', () => {
    const { fields, body } = splitFrontMatter(`---
title: "Brot: einfach"
tags:
  - Brot
  - Sauerteig
servings: 2 # Laibe
---
Text`)
    expect(fields).toEqual({ title: 'Brot: einfach', tags: ['Brot', 'Sauerteig'], servings: '2' })
    expect(body).toBe('Text')
  })

  it('ohne Front Matter bleibt alles Text', () => {
    expect(splitFrontMatter('Nur @Salz{}')).toEqual({ fields: {}, body: 'Nur @Salz{}' })
  })
})

describe('parseRecipe', () => {
  const r = parseRecipe(KUCHEN)

  it('liest die Metadaten', () => {
    expect(r.meta).toEqual({
      title: 'Zwetschgenkuchen',
      servings: 12,
      tags: ['Kuchen', 'Hefe'],
      prepMinutes: 30,
      cookMinutes: 60,
      source: 'Oma',
    })
    expect(r.warnings).toEqual([])
  })

  it('liest Zutaten mit Dezimalkomma, fixen Mengen und Referenzen', () => {
    expect(r.ingredients).toEqual([
      {
        name: 'Hefeteig',
        amount: { kind: 'number', value: 500, unit: 'g', scalable: true },
        optional: false,
        hidden: false,
        reference: 'Hefeteig',
      },
      {
        name: 'Zwetschgen',
        amount: { kind: 'number', value: 1.5, unit: 'kg', scalable: true },
        optional: false,
        hidden: false,
      },
      {
        name: 'Zimt',
        amount: { kind: 'number', value: 1, unit: 'Prise', scalable: false },
        optional: false,
        hidden: false,
      },
      {
        name: 'Zucker',
        amount: { kind: 'number', value: 80, unit: 'g', scalable: true },
        optional: false,
        hidden: false,
      },
    ])
    expect(r.cookware).toEqual(['Backform'])
    expect(r.timers).toEqual([
      { amount: { kind: 'number', value: 40, unit: 'Minuten', scalable: false } },
    ])
  })

  it('gliedert in Abschnitte, Schritte und Notizen und verbindet Zeilen mit Leerzeichen', () => {
    expect(r.sections.map((s) => s.name)).toEqual(['Teig', 'Belag'])
    const belag = r.sections[1]!.blocks
    expect(belag[0]).toMatchObject({ type: 'step', number: 2 })
    const text =
      belag[0]!.type === 'step'
        ? belag[0]!.tokens
            .filter((t) => t.type === 'text')
            .map((t) => t.text)
            .join('|')
        : ''
    expect(text).toContain('darüber. Backe ')
    expect(belag[1]).toEqual({ type: 'note', text: 'Schmeckt lauwarm am besten.' })
  })

  it('skaliert, fixe Mengen bleiben', () => {
    const doubled = scaleRecipe(r, 2)
    expect(doubled.ingredients.map((i) => formatAmount(i.amount))).toEqual([
      '1 kg',
      '3 kg',
      '1 Prise',
      '160 g',
    ])
    expect(r.ingredients[0]!.amount).toMatchObject({ value: 500 })
  })

  it('fasst die Zutatenliste zusammen und lässt versteckte aus', () => {
    const list = listIngredients(
      parseRecipe(
        '@Mehl{500%g} und @Mehl{0,1%kg}, @Mehl{1%Tasse}, @-Wasser{1%l}, @?Petersilie{}(gehackt).',
      ),
    )
    expect(list.map((i) => [i.name, i.amounts.map(formatAmount), i.optional, i.notes])).toEqual([
      ['Mehl', ['600 g', '1 Tasse'], false, []],
      ['Petersilie', [], true, ['gehackt']],
    ])
  })

  it('meldet Probleme statt abzustürzen', () => {
    expect(parseRecipe('Ohne Titel').warnings).toContain('Titel fehlt (Front Matter „title:“).')
    expect(parseRecipe('---\ntitle: X\nservings: viele\n---\n').warnings[0]).toMatch(/Portionen/)
    const long = parseRecipe(`---\ntitle: X\n---\n${'a'.repeat(60_000)}`)
    expect(long.warnings[0]).toMatch(/zu lang/)
  })

  it('behandelt HTML im Text als Text', () => {
    const html = parseRecipe('---\ntitle: <b>x</b>\n---\nMische <script>alert(1)</script> @Salz{}.')
    expect(html.meta.title).toBe('<b>x</b>')
    const step = html.sections[0]!.blocks[0]!
    expect(step.type === 'step' && step.tokens[0]).toEqual({
      type: 'text',
      text: 'Mische <script>alert(1)</script> ',
    })
  })

  it('liest Ausbeute für Unterrezepte', () => {
    expect(parseRecipe('---\ntitle: Hefeteig\nyield: 800 g\n---\n').meta.yield).toEqual({
      value: 800,
      unit: 'g',
    })
  })
})

describe('Mengen', () => {
  it('formatiert deutsch und wechselt die Einheit', () => {
    expect(formatAmount({ kind: 'number', value: 1500, unit: 'g', scalable: true })).toBe('1,5 kg')
    expect(formatAmount({ kind: 'number', value: 0.25, unit: 'l', scalable: true })).toBe('250 ml')
    expect(formatAmount({ kind: 'number', value: 1 / 3, unit: 'EL', scalable: true })).toBe(
      '0,33 EL',
    )
    expect(formatAmount({ kind: 'range', min: 2, max: 3, unit: '', scalable: true })).toBe('2–3')
  })

  it('addiert nur verträgliche Einheiten', () => {
    const g = { kind: 'number' as const, value: 500, unit: 'g', scalable: true }
    expect(addAmounts(g, { ...g, value: 1, unit: 'kg' })).toMatchObject({ value: 1500, unit: 'g' })
    expect(addAmounts(g, { ...g, unit: 'ml' })).toBeUndefined()
  })

  it('liest Dauern und Timer', () => {
    expect(parseDuration('1 h 30 min')).toBe(90)
    expect(parseDuration('1,5 Std.')).toBe(90)
    expect(parseDuration('45')).toBe(45)
    expect(timerSeconds({ kind: 'number', value: 2, unit: 'h', scalable: false })).toBe(7200)
    expect(timerSeconds({ kind: 'number', value: 40, unit: 'Minuten', scalable: false })).toBe(2400)
  })
})

describe('Front Matter bearbeiten', () => {
  it('setzt, entfernt und erhält Felder, Text bleibt', () => {
    const src = '---\ntitle: Alt\nauthor: Oma\n---\nMische @Salz{}.'
    const out = setFrontMatter(src, {
      title: 'Neu: Kuchen',
      servings: '4',
      tags: ['A', 'B c'],
      source: '',
    })
    expect(out).toBe(
      '---\ntitle: "Neu: Kuchen"\nservings: 4\ntags: [A, B c]\nauthor: Oma\n---\nMische @Salz{}.',
    )
    expect(parseRecipe(out).meta).toMatchObject({
      title: 'Neu: Kuchen',
      servings: 4,
      tags: ['A', 'B c'],
    })
    expect(readFrontMatter(out)).toEqual({ title: 'Neu: Kuchen', servings: '4', tags: 'A, B c' })
  })

  it('legt Front Matter an, wenn es fehlt', () => {
    expect(setFrontMatter('Text', { title: 'X' })).toBe('---\ntitle: X\n---\nText')
  })
})

describe('Einfügehilfen', () => {
  it('erzeugen gültiges Cooklang', () => {
    const snippet = ingredientSnippet({
      name: 'Rote Bete',
      quantity: '1,5',
      unit: 'kg',
      note: 'gewürfelt',
    })
    expect(snippet).toBe('@Rote Bete{1,5%kg}(gewürfelt)')
    expect(
      ingredientSnippet({
        name: 'Zimt',
        quantity: '1',
        unit: 'Prise',
        fixed: true,
        optional: true,
      }),
    ).toBe('@?Zimt{=1%Prise}')
    expect(
      ingredientSnippet({ name: 'Hefeteig', quantity: '500', unit: 'g', reference: true }),
    ).toBe('@./Hefeteig{500%g}')
    expect(ingredientSnippet({ name: 'Bö{se}%' })).toBe('@Böse{}')
    expect(timerSnippet(20)).toBe('~{20%min}')
    const r = parseRecipe(`---\ntitle: X\n---\n${snippet} ${timerSnippet(5, 'Ruhen')}`)
    expect(r.ingredients[0]).toMatchObject({
      name: 'Rote Bete',
      note: 'gewürfelt',
      amount: { value: 1.5, unit: 'kg' },
    })
    expect(r.timers[0]).toMatchObject({ name: 'Ruhen', amount: { value: 5, unit: 'min' } })
  })
})
