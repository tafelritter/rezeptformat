// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildKatalog,
  checkKatalog,
  loadImages,
  loadIngredients,
  loadNutrition,
  loadRecipes,
} from './katalog.js'

const dirs: string[] = []
function fixture(files: Record<string, string | Buffer>): string {
  const dir = mkdtempSync(join(tmpdir(), 'katalog-'))
  dirs.push(dir)
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true })
    writeFileSync(join(dir, name), content)
  }
  return dir
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true })
})

describe('Artikel', () => {
  it('liest Einträge mit Kategorie aus dem Dateinamen', () => {
    const dir = fixture({ 'backen.yaml': '- { id: mehl, name: Mehl, units: [kg] }\n' })
    expect(loadIngredients(dir)).toEqual([
      { id: 'mehl', name: 'Mehl', category: 'backen', units: ['kg'] },
    ])
  })

  it.each([
    ['unbekannte Kategorie', { 'xyz.yaml': '- { id: a, name: A }' }, /unbekannte Kategorie/],
    ['kein YAML', { 'backen.yaml': '- { id: a' }, /kein gültiges YAML/],
    ['keine Liste', { 'backen.yaml': 'id: a' }, /erwartet eine Liste/],
    ['ungültige id', { 'backen.yaml': '- { id: Mehl!, name: Mehl }' }, /ungültige id/],
    ['fehlender Name', { 'backen.yaml': '- { id: mehl }' }, /ungültiger Name/],
    ['unbekanntes Feld', { 'backen.yaml': '- { id: a, name: A, preis: 3 }' }, /unbekanntes Feld/],
    [
      'falsche Ernährungsform',
      { 'backen.yaml': '- { id: a, name: A, diet: keto }' },
      /Ernährungsform/,
    ],
    [
      'doppelte id',
      { 'backen.yaml': '- { id: a, name: A }', 'getraenke.yaml': '- { id: a, name: B }' },
      /doppelt/,
    ],
    [
      'Synonym mehrfach vergeben',
      { 'backen.yaml': '- { id: a, name: Zucker }\n- { id: b, name: B, synonyms: [zucker] }' },
      /schon bei „a“ vergeben/,
    ],
  ])('meldet %s', (_, files, message) => {
    expect(() => loadIngredients(fixture(files))).toThrow(message)
  })
})

describe('Rezepte', () => {
  const ingredients = [{ id: 'mehl', name: 'Mehl', category: 'backen' as const }]
  const cook = (title: string, body = '') => `---\ntitle: ${title}\n---\n${body}`

  it('liefert Rezepte mit Version', () => {
    const dir = fixture({ 'backen/teig.cook': cook('Teig', '@Mehl{1%g}') })
    const { recipes } = loadRecipes(ingredients, dir)
    expect(recipes[0]).toMatchObject({ path: 'backen/teig' })
    expect(recipes[0]!.version).toMatch(/^[0-9a-f]{16}$/)
  })

  it('meldet unbekannte Zutaten nur als Hinweis', () => {
    const dir = fixture({ 'a.cook': cook('A', '@Mehl{1%g} @Drachenfrucht{1}') })
    expect(loadRecipes(ingredients, dir).notes).toEqual([
      'a.cook: Zutat „Drachenfrucht“ fehlt im Artikelkatalog',
    ])
  })

  it.each([
    [
      'nicht auflösbare Referenz',
      { 'a.cook': cook('A', '@./Fehlt{1}') },
      /Referenz „Fehlt“ nicht im Katalog/,
    ],
    ['Zyklus', { 'a.cook': cook('A', '@./b{1}'), 'b.cook': cook('B', '@./a{1}') }, /Zyklus/],
    ['fehlender Titel', { 'a.cook': 'Nur Text' }, /Titel fehlt/],
    ['falscher Pfad', { 'Groß.cook': cook('A') }, /Pfad nur aus Kleinbuchstaben/],
    ['falsche Endung', { 'a.txt': 'x' }, /nur .cook-Dateien/],
    ['zu groß', { 'a.cook': cook('A', 'x'.repeat(60_000)) }, /größer als/],
  ])('meldet %s', (_, files, message) => {
    expect(() => loadRecipes(ingredients, fixture(files))).toThrow(message)
  })
})

describe('Fotos', () => {
  const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])

  it('ordnet Fotos Rezepten zu', () => {
    const dir = fixture({ 'backen/hefeteig.webp': webp })
    expect(loadImages(new Set(['backen/hefeteig']), dir).get('backen/hefeteig')?.image).toBe(
      'images/backen/hefeteig.webp',
    )
  })

  it.each([
    ['falsches Format', { 'a.png': webp }, /nur .webp und .jpg/],
    ['ohne Rezept', { 'torte.webp': webp }, /kein Rezept/],
    ['kein Bild', { 'kuchen.jpg': Buffer.from('<svg/>') }, /keine gültige Bilddatei/],
    [
      'zu groß',
      { 'kuchen.webp': Buffer.concat([webp, Buffer.alloc(500 * 1024)]) },
      /größer als 400 KB/,
    ],
  ])('meldet %s', (_, files, message) => {
    expect(() => loadImages(new Set(['kuchen']), fixture(files))).toThrow(message)
  })
})

const CSV = `# Kommentar
bls;name;kcal;kj;fett;fett_gesaettigt;kohlenhydrate;zucker;ballaststoffe;eiweiss;salz
C214100;Weizen Mehl, Type 405;348;1475;0.93;0.12;71.77;0.307;5.3;10.46;0.002
S151100;Ahornsirup;260;1100;0;0;67;60;;0;0
`
const items = [
  { id: 'mehl', name: 'Mehl', category: 'backen' as const },
  { id: 'ahornsirup', name: 'Ahornsirup', category: 'fruehstueck-aufstriche' as const },
]

describe('Nährwerte', () => {
  it('verbindet Auszug, Zuordnung und Gewichte; fehlende Werte bleiben null', () => {
    const dir = fixture({
      'bls-4.0-auszug.csv': CSV,
      'zuordnung.yaml':
        'items:\n  - { id: mehl, bls: C214100 }\n  - { id: ahornsirup, bls: S151100 }\n',
      'gewichte.yaml':
        'einheiten:\n  el: { ml: 15 }\nartikel:\n  - { id: mehl, el: 10 }\n  - { id: ahornsirup, dichte: 1.32 }\n',
    })
    const n = loadNutrition(items, dir)!
    expect(n.units).toEqual({ el: { ml: 15 } })
    expect(n.foods.mehl).toEqual({
      n: [348, 1475, 0.93, 0.12, 71.77, 0.307, 5.3, 10.46, 0.002],
      w: { el: 10 },
    })
    expect(n.foods.ahornsirup).toEqual({ n: [260, 1100, 0, 0, 67, 60, null, 0, 0], d: 1.32 })
  })

  it('ohne Ordner keine Nährwerte', () => {
    expect(loadNutrition(items, fixture({}))).toBeUndefined()
  })

  it.each([
    [
      'unbekannter Artikel',
      'items:\n  - { id: zucker, bls: C214100 }\n',
      '',
      /unbekannter Artikel/,
    ],
    ['fehlender Code', 'items:\n  - { id: mehl, bls: X000000 }\n', '', /fehlt im Auszug/],
    [
      'Gewicht ohne Nährwerte',
      'items: []\n',
      'artikel:\n  - { id: mehl, el: 10 }\n',
      /hat keine Nährwerte/,
    ],
    [
      'ungültiges Gewicht',
      'items:\n  - { id: mehl, bls: C214100 }\n',
      'artikel:\n  - { id: mehl, el: -1 }\n',
      /ungültig/,
    ],
  ])('meldet %s', (_, zuordnung, gewichte, message) => {
    const dir = fixture({
      'bls-4.0-auszug.csv': CSV,
      'zuordnung.yaml': zuordnung,
      'gewichte.yaml': gewichte,
    })
    expect(() => loadNutrition(items, dir)).toThrow(message)
  })
})

describe('Ganzer Katalog', () => {
  it('prüft und baut die Dateien für die App', () => {
    const root = fixture({
      'ingredients/backen.yaml': '- { id: mehl, name: Mehl, diet: vegan }\n',
      'recipes/backen/teig.cook': '---\ntitle: Teig\n---\n@Mehl{500%g} kneten.',
      'images/backen/teig.jpg': Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    })
    expect(checkKatalog(root).recipes[0]).toMatchObject({
      path: 'backen/teig',
      image: 'images/backen/teig.jpg',
    })
    const out = join(root, 'dist')
    buildKatalog(root, out, '1.2.3')
    const ingredients = JSON.parse(readFileSync(join(out, 'ingredients.json'), 'utf8')) as Record<
      string,
      unknown
    >
    expect(ingredients).toMatchObject({ version: 1, format: 1, license: 'CC-BY-SA-4.0' })
    expect(ingredients.katalog).toBe('1.2.3')
    expect(existsSync(join(out, 'images/backen/teig.jpg'))).toBe(true)
    expect(existsSync(join(out, 'nutrition.json'))).toBe(false)
  })
})
