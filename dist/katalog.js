// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Katalog prüfen und bauen (nur Node). Ein Katalog ist ein Ordner mit
 *
 *   ingredients/<kategorie>.yaml   Artikel, eine Datei je Kategorie
 *   recipes/**\/*.cook              öffentliche Rezepte in Cooklang
 *   images/**\/*.webp|jpg           Fotos zu Rezepten (optional)
 *   nutrition/                     Nährwerte: BLS-Auszug, Zuordnung, Gewichte (optional)
 *
 * `buildKatalog` schreibt daraus ingredients.json, recipes.json, nutrition.json
 * und images/ – genau das, was die App unter `catalog/` lädt.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { parse } from 'yaml';
import { CATEGORIES, normalizeName } from './categories.js';
import { MAX_RECIPE_CHARS } from './limits.js';
import { parseRecipe } from './recipe.js';
import { checkReferences } from './references.js';
/** Version des Datenformats der gebauten Dateien. */
export const KATALOG_FORMAT = 1;
/** Fotos im Katalog: klein halten, die App lädt sie offline vor. */
export const MAX_IMAGE_BYTES = 400 * 1024;
const IMAGE_TYPES = {
    '.webp': [0x52, 0x49, 0x46, 0x46],
    '.jpg': [0xff, 0xd8, 0xff],
};
const RECIPE_PATH = /^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/;
const CATEGORY_IDS = new Set(CATEGORIES.map((c) => c.id));
const DIETS = new Set(['vegan', 'vegetarisch', 'pescetarisch', 'omnivor']);
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FIELDS = new Set(['id', 'name', 'synonyms', 'diet', 'units']);
/** Spalten des BLS-Auszugs in der Reihenfolge, die die App erwartet. */
export const NUTRIENT_COLUMNS = [
    'kcal',
    'kj',
    'fett',
    'fett_gesaettigt',
    'kohlenhydrate',
    'zucker',
    'ballaststoffe',
    'eiweiss',
    'salz',
];
const WEIGHT_KEY = /^[a-z]{1,20}$/;
/** Fehler mit allen gefundenen Problemen (für die CI-Ausgabe). */
export class KatalogError extends Error {
    errors;
    constructor(title, errors) {
        super(`${title}:\n  ${errors.join('\n  ')}`);
        this.errors = errors;
        this.name = 'KatalogError';
    }
}
function walk(dir) {
    if (!existsSync(dir))
        return [];
    let out = [];
    for (const name of readdirSync(dir).sort()) {
        const full = join(dir, name);
        if (statSync(full).isDirectory())
            out = out.concat(walk(full));
        else
            out.push(full);
    }
    return out;
}
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const stringList = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string' && s.trim() !== '');
/** Liest und prüft die Artikel (`ingredients/*.yaml`). */
export function loadIngredients(dir) {
    const errors = [];
    const items = [];
    const ids = new Map();
    const names = new Map();
    for (const file of readdirSync(dir)
        .filter((f) => f.endsWith('.yaml'))
        .sort()) {
        const category = basename(file, '.yaml');
        const where = (i) => `${file}[${i}]`;
        if (!CATEGORY_IDS.has(category)) {
            errors.push(`${file}: unbekannte Kategorie „${category}“`);
            continue;
        }
        let data;
        try {
            data = parse(readFileSync(join(dir, file), 'utf8'));
        }
        catch (e) {
            errors.push(`${file}: kein gültiges YAML – ${e instanceof Error ? e.message : String(e)}`);
            continue;
        }
        if (!Array.isArray(data)) {
            errors.push(`${file}: erwartet eine Liste`);
            continue;
        }
        data.forEach((entry, i) => {
            if (!isObject(entry)) {
                errors.push(`${where(i)}: erwartet ein Objekt`);
                return;
            }
            for (const key of Object.keys(entry)) {
                if (!FIELDS.has(key))
                    errors.push(`${where(i)}: unbekanntes Feld „${key}“`);
            }
            const { id, name, synonyms = [], diet, units = [] } = entry;
            if (typeof id !== 'string' || !ID.test(id))
                errors.push(`${where(i)}: ungültige id „${typeof id === 'string' ? id : JSON.stringify(id)}“`);
            if (typeof name !== 'string' || !name.trim() || name.length > 60) {
                errors.push(`${where(i)}: ungültiger Name`);
            }
            if (!stringList(synonyms) && !(Array.isArray(synonyms) && synonyms.length === 0))
                errors.push(`${where(i)}: synonyms muss eine Liste von Texten sein`);
            if (!stringList(units) && !(Array.isArray(units) && units.length === 0))
                errors.push(`${where(i)}: units muss eine Liste von Texten sein`);
            if (diet !== undefined && (typeof diet !== 'string' || !DIETS.has(diet)))
                errors.push(`${where(i)}: unbekannte Ernährungsform „${JSON.stringify(diet)}“`);
            if (typeof id !== 'string' || typeof name !== 'string')
                return;
            if (ids.has(id))
                errors.push(`${where(i)}: id „${id}“ doppelt (auch in ${ids.get(id)})`);
            ids.set(id, file);
            // Jeder Name und jedes Synonym darf nur einmal vorkommen, sonst ist die Kategorie mehrdeutig.
            for (const label of [name, ...(stringList(synonyms) ? synonyms : [])]) {
                const key = normalizeName(label);
                const other = names.get(key);
                if (other && other !== id)
                    errors.push(`${where(i)}: „${label}“ ist schon bei „${other}“ vergeben`);
                names.set(key, id);
            }
            const item = {
                id,
                name: name.trim(),
                category: category,
            };
            if (stringList(synonyms) && synonyms.length)
                item.synonyms = synonyms.map((s) => s.trim());
            if (typeof diet === 'string' && DIETS.has(diet))
                item.diet = diet;
            if (stringList(units) && units.length)
                item.units = units.map((u) => u.trim());
            items.push(item);
        });
    }
    if (errors.length)
        throw new KatalogError('Katalog fehlerhaft', errors);
    return items.sort((a, b) => a.id.localeCompare(b.id));
}
/**
 * Liest und prüft alle Rezepte. Fehler: unlesbar, ohne Titel, zu groß,
 * unzulässiger Pfad, nicht auflösbare Referenz, Zyklus. Hinweise: Zutaten,
 * die der Artikelkatalog nicht kennt.
 */
export function loadRecipes(ingredients, dir) {
    const errors = [];
    const notes = [];
    const recipes = [];
    for (const file of walk(dir)) {
        const rel = relative(dir, file).split(sep).join('/');
        if (!rel.endsWith('.cook')) {
            errors.push(`${rel}: nur .cook-Dateien erlaubt`);
            continue;
        }
        const path = rel.slice(0, -'.cook'.length);
        if (!RECIPE_PATH.test(path))
            errors.push(`${rel}: Pfad nur aus Kleinbuchstaben, Ziffern und Bindestrichen`);
        const source = readFileSync(file, 'utf8');
        if (source.length > MAX_RECIPE_CHARS) {
            errors.push(`${rel}: größer als ${MAX_RECIPE_CHARS} Zeichen`);
            continue;
        }
        const recipe = parseRecipe(source);
        for (const w of recipe.warnings)
            errors.push(`${rel}: ${w}`);
        recipes.push({ path, source, recipe });
    }
    const entries = recipes.map((r) => ({
        key: `catalog:${r.path}`,
        scope: 'catalog',
        path: r.path,
        recipe: r.recipe,
    }));
    const index = { entries };
    const known = new Set(ingredients.flatMap((i) => [i.name, ...(i.synonyms ?? [])]).map(normalizeName));
    for (const entry of entries) {
        const check = checkReferences(index, entry);
        for (const ref of check.unresolved)
            errors.push(`${entry.path}.cook: Referenz „${ref}“ nicht im Katalog`);
        if (check.cycle)
            errors.push(`${entry.path}.cook: Zyklus ${check.cycle.join(' → ')}`);
        for (const i of entry.recipe.ingredients) {
            if (!i.reference && !known.has(normalizeName(i.name))) {
                notes.push(`${entry.path}.cook: Zutat „${i.name}“ fehlt im Artikelkatalog`);
            }
        }
    }
    if (errors.length)
        throw new KatalogError('Rezepte fehlerhaft', errors);
    return {
        notes: [...new Set(notes)],
        recipes: recipes.map((r) => ({
            path: r.path,
            source: r.source,
            version: createHash('sha256').update(r.source).digest('hex').slice(0, 16),
        })),
    };
}
/**
 * Fotos zu Rezepten: `images/<rezeptpfad>.webp` oder `.jpg`,
 * höchstens 400 KB, nur echte Bilddateien, nur zu vorhandenen Rezepten.
 */
export function loadImages(recipePaths, dir) {
    const errors = [];
    const images = new Map();
    for (const file of walk(dir)) {
        const rel = relative(dir, file).split(sep).join('/');
        const ext = Object.keys(IMAGE_TYPES).find((e) => rel.endsWith(e));
        if (!ext) {
            errors.push(`images/${rel}: nur .webp und .jpg erlaubt`);
            continue;
        }
        const path = rel.slice(0, -ext.length);
        const bytes = readFileSync(file);
        if (!recipePaths.has(path))
            errors.push(`images/${rel}: kein Rezept „${path}.cook“`);
        if (bytes.length > MAX_IMAGE_BYTES)
            errors.push(`images/${rel}: größer als 400 KB`);
        if (!IMAGE_TYPES[ext].every((b, i) => bytes[i] === b))
            errors.push(`images/${rel}: keine gültige Bilddatei`);
        if (images.has(path))
            errors.push(`images/${rel}: mehrere Fotos für „${path}“`);
        images.set(path, { file, image: `images/${rel}` });
    }
    if (errors.length)
        throw new KatalogError('Katalogfotos fehlerhaft', errors);
    return images;
}
/**
 * Nährwerte: BLS-Auszug (CC BY 4.0), Zuordnung Artikel → BLS-Code und
 * Gewichtstabelle. Fehlt einer der Teile, gibt es keine Nährwerte.
 */
export function loadNutrition(items, dir) {
    const errors = [];
    const files = ['zuordnung.yaml', 'gewichte.yaml', 'bls-4.0-auszug.csv'];
    if (!files.every((f) => existsSync(join(dir, f))))
        return undefined;
    const ids = new Set(items.map((i) => i.id));
    const bls = new Map();
    const lines = readFileSync(join(dir, 'bls-4.0-auszug.csv'), 'utf8')
        .split('\n')
        .filter((l) => l && !l.startsWith('#'));
    const header = lines.shift()?.split(';') ?? [];
    const columns = NUTRIENT_COLUMNS.map((c) => header.indexOf(c));
    if (header[0] !== 'bls' || columns.some((i) => i < 0))
        errors.push('bls-4.0-auszug.csv: Kopfzeile');
    for (const line of lines) {
        const cells = line.split(';');
        // Leer = fehlender Wert (nicht 0, siehe BLS-Dokumentation 4.3) → null
        const values = columns.map((i) => (cells[i] === '' ? null : Number(cells[i])));
        const bad = values.some((v) => v !== null && (!Number.isFinite(v) || v < 0));
        if (!/^[A-Z][0-9A-Z]{6}$/.test(cells[0] ?? '') || bad)
            errors.push(`bls-4.0-auszug.csv: Zeile „${cells[0]}“ ungültig`);
        else
            bls.set(cells[0], values);
    }
    const mapping = (parse(readFileSync(join(dir, 'zuordnung.yaml'), 'utf8')) ?? {});
    const foods = {};
    for (const [i, m] of (mapping.items ?? []).entries()) {
        const id = m?.id ?? '';
        if (!ids.has(id))
            errors.push(`zuordnung.yaml[${i}]: unbekannter Artikel „${id}“`);
        else if (!bls.has(m.bls ?? ''))
            errors.push(`zuordnung.yaml[${i}]: BLS-Code „${m.bls}“ fehlt im Auszug`);
        else if (foods[id])
            errors.push(`zuordnung.yaml[${i}]: „${id}“ doppelt`);
        else
            foods[id] = { n: bls.get(m.bls) };
    }
    for (const [i, m] of (mapping.unmapped ?? []).entries())
        if (!ids.has(m?.id ?? ''))
            errors.push(`zuordnung.yaml unmapped[${i}]: unbekannter Artikel „${m?.id}“`);
    const weights = (parse(readFileSync(join(dir, 'gewichte.yaml'), 'utf8')) ?? {});
    const units = {};
    for (const [key, u] of Object.entries(weights.einheiten ?? {})) {
        const value = isObject(u) ? (u.ml ?? u.g) : undefined;
        const ok = WEIGHT_KEY.test(key) &&
            isObject(u) &&
            Object.keys(u).length === 1 &&
            typeof value === 'number' &&
            value > 0;
        if (!ok)
            errors.push(`gewichte.yaml einheiten.${key}: ungültig`);
        else
            units[key] = u.ml !== undefined ? { ml: value } : { g: value };
    }
    for (const [i, w] of (weights.artikel ?? []).entries()) {
        const id = typeof w?.id === 'string' ? w.id : '';
        const where = `gewichte.yaml artikel[${i}] (${id})`;
        const food = foods[id];
        if (!food) {
            errors.push(`${where}: Artikel hat keine Nährwerte`);
            continue;
        }
        const entry = {};
        for (const [key, value] of Object.entries(w)) {
            if (key === 'id')
                continue;
            if (!(typeof value === 'number' && value > 0))
                errors.push(`${where}: ${key} ungültig`);
            else if (key === 'dichte')
                food.d = value;
            else if (WEIGHT_KEY.test(key))
                entry[key] = value;
            else
                errors.push(`${where}: unbekanntes Feld ${key}`);
        }
        if (Object.keys(entry).length)
            food.w = entry;
    }
    if (errors.length)
        throw new KatalogError('Nährwerte fehlerhaft', errors);
    return { foods, units };
}
/** Prüft den ganzen Katalog im Ordner `root`; wirft `KatalogError` mit allen Fehlern. */
export function checkKatalog(root) {
    const items = loadIngredients(join(root, 'ingredients'));
    const nutrition = loadNutrition(items, join(root, 'nutrition'));
    const result = loadRecipes(items, join(root, 'recipes'));
    const images = loadImages(new Set(result.recipes.map((r) => r.path)), join(root, 'images'));
    const recipes = result.recipes.map((r) => {
        const image = images.get(r.path)?.image;
        return image ? { ...r, image } : r;
    });
    return { items, recipes, images, nutrition, notes: result.notes };
}
/** Schreibt die Dateien, die die App lädt, nach `out` (vorher geleert). */
export function buildKatalog(root, out, version = '') {
    const katalog = checkKatalog(root);
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    // `katalog` = Version des Katalog-Releases; `version` bleibt die Formatversion, die die App prüft.
    const meta = { format: KATALOG_FORMAT, ...(version ? { katalog: version } : {}) };
    writeFileSync(join(out, 'ingredients.json'), JSON.stringify({ version: 1, ...meta, license: 'CC-BY-SA-4.0', items: katalog.items }));
    writeFileSync(join(out, 'recipes.json'), JSON.stringify({ version: 1, ...meta, license: 'CC-BY-SA-4.0', recipes: katalog.recipes }));
    if (katalog.nutrition) {
        writeFileSync(join(out, 'nutrition.json'), JSON.stringify({
            version: 1,
            ...meta,
            license: 'CC-BY-4.0 (BLS-Auszug), CC-BY-SA-4.0 (Zuordnung, Gewichte)',
            attribution: 'Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0',
            ...katalog.nutrition,
        }));
    }
    for (const { file, image } of katalog.images.values()) {
        const target = join(out, image);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(file, target);
    }
    return katalog;
}
