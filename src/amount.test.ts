// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import {
  type Amount,
  amountParts,
  conversion,
  formatAmount,
  readAmount,
  sumAmounts,
} from './amount.js'

const n = (value: number, unit = ''): Amount => ({ kind: 'number', value, unit, scalable: true })

describe('Einheiten', () => {
  it('rechnet Masse, Volumen und Stück um', () => {
    expect(conversion('kg', 'g')).toBe(1000)
    expect(conversion('l', 'ml')).toBe(1000)
    expect(conversion('Stück', '')).toBe(1)
    expect(conversion('Stk.', 'stück')).toBe(1)
    expect(conversion('g', 'ml')).toBeUndefined()
  })

  it('lässt EL, TL und Prise getrennt', () => {
    expect(conversion('EL', 'TL')).toBeUndefined()
    expect(conversion('EL', 'ml')).toBeUndefined()
    expect(conversion('Prise', 'g')).toBeUndefined()
    expect(conversion('EL', 'el')).toBe(1)
  })
})

describe('sumAmounts', () => {
  it('fasst je Größe zusammen und wechselt in die lesbare Einheit', () => {
    const sum = sumAmounts([n(500, 'g'), n(0.7, 'kg'), n(250, 'ml'), n(2), n(1, 'Stück')])
    expect(sum.map(formatAmount)).toEqual(['1,2 kg', '250 ml', '3'])
  })

  it('behält EL, Spannen und Texte einzeln', () => {
    const sum = sumAmounts([
      n(2, 'EL'),
      n(1, 'EL'),
      n(1, 'TL'),
      { kind: 'range', min: 1, max: 2, unit: 'Zehen', scalable: true },
      { kind: 'text', text: 'etwas', unit: '' },
    ])
    expect(sum.map(formatAmount)).toEqual(['3 EL', '1 TL', '1–2 Zehen', 'etwas'])
  })

  it('verändert die Eingabe nicht', () => {
    const a = n(100, 'g')
    sumAmounts([a, n(50, 'g')])
    expect(a).toEqual(n(100, 'g'))
  })
})

describe('amountParts und readAmount', () => {
  it('trennt Menge und Einheit', () => {
    expect(amountParts(n(1500, 'g'))).toEqual({ quantity: '1,5', unit: 'kg' })
    expect(amountParts(n(3))).toEqual({ quantity: '3', unit: '' })
  })

  it('prüft gespeicherte Mengen', () => {
    expect(readAmount({ kind: 'number', value: 2, unit: 'EL' })).toEqual(n(2, 'EL'))
    expect(readAmount({ kind: 'number', value: Infinity, unit: '' })).toBeUndefined()
    expect(readAmount({ kind: 'html', value: 1 })).toBeUndefined()
    expect(readAmount(null)).toBeUndefined()
  })
})
