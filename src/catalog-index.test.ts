// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { buildCatalogIndex } from './catalog-index.js'
import { normalizeName } from './categories.js'

describe('Katalog-Index', () => {
  const index = buildCatalogIndex({
    version: 1,
    items: [
      { id: 'aepfel', name: 'Äpfel', category: 'obst-gemuese', synonyms: ['Apfel'] },
      { id: 'zahnpasta', name: 'Zahnpasta', category: 'drogerie-haushalt' },
      { id: 'kaputt', name: 'X', category: 'gibts-nicht' },
      null,
      'Unsinn',
    ],
  })

  it('findet Namen und Synonyme unabhängig von Schreibweise', () => {
    expect(index.lookup(normalizeName(' apfel '))).toBe('obst-gemuese')
    expect(index.lookup(normalizeName('ÄPFEL'))).toBe('obst-gemuese')
    expect(index.lookup(normalizeName('Zahnpasta'))).toBe('drogerie-haushalt')
    expect(index.lookup('unbekannt')).toBeUndefined()
  })

  it('liefert Katalog-ID und Anzeigename auch für Synonyme', () => {
    expect(index.item(normalizeName('Apfel'))).toEqual({ id: 'aepfel', name: 'Äpfel' })
    expect(index.item(normalizeName('Birne'))).toBeUndefined()
  })

  it('überspringt ungültige Einträge', () => {
    expect(index.names).toEqual(['Äpfel', 'Zahnpasta'])
    expect(index.size).toBe(2)
  })

  it('verträgt kaputte Dateien', () => {
    expect(buildCatalogIndex(null).size).toBe(0)
    expect(buildCatalogIndex({ items: 'x' }).size).toBe(0)
  })
})
