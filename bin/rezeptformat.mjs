#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * rezeptformat validate [ordner]               Katalog prüfen (Standard: aktueller Ordner)
 * rezeptformat build [ordner] --out <ziel>     prüfen und die Dateien für die App schreiben
 *                    [--version <version>]
 */
import { resolve } from 'node:path'
import { KatalogError, buildKatalog, checkKatalog } from '../dist/katalog.js'

const [command, ...rest] = process.argv.slice(2)
const option = (name) => {
  const i = rest.indexOf(name)
  return i >= 0 ? rest.splice(i, 2)[1] : undefined
}
const out = option('--out')
const version = option('--version') ?? ''
const root = resolve(rest[0] ?? '.')

if (command !== 'validate' && command !== 'build') {
  console.error(
    'Aufruf: rezeptformat validate [ordner] | build [ordner] --out <ziel> [--version <v>]',
  )
  process.exit(2)
}
if (command === 'build' && !out) {
  console.error('build braucht --out <ziel>')
  process.exit(2)
}
try {
  const k = command === 'build' ? buildKatalog(root, resolve(out), version) : checkKatalog(root)
  for (const note of k.notes) console.warn(`Hinweis: ${note}`)
  const summary = `${k.items.length} Artikel, ${k.recipes.length} Rezepte, ${Object.keys(k.nutrition?.foods ?? {}).length} mit Nährwerten`
  console.log(
    command === 'build' ? `Katalog gebaut: ${summary} → ${out}` : `Katalog in Ordnung: ${summary}`,
  )
} catch (e) {
  console.error(e instanceof KatalogError ? e.message : e)
  process.exit(1)
}
