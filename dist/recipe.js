// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Rezepte im Cooklang-Format (ADR 0003). Der Parser `@tmlmt/cooklang-parser`
 * ist hier gekapselt; der Rest der App kennt nur `ParsedRecipe`.
 *
 * Konventionen (docs/rezepte.md):
 * - Front Matter mit `title`, `servings` (Portionen) oder `yield` („800 g“),
 *   `tags`, `source`, `time.prep`, `time.cook`, `description`, `diet`.
 * - Dezimalkomma ist erlaubt: `@Mehl{1,5%kg}`.
 * - Referenzen: `@./Hefeteig{500%g}` – aufgelöst über den Titel im selben
 *   Bereich, sonst im öffentlichen Katalog.
 *
 * Rezepttext ist nicht vertrauenswürdig (geteilte oder importierte Rezepte):
 * Das Ergebnis enthält nur Texte und Zahlen und wird nie als HTML ausgegeben.
 */
import { Recipe as CooklangRecipe } from '@tmlmt/cooklang-parser';
import { addAmounts, parseDuration, parseQuantity, scaleAmount } from './amount.js';
import { MAX_RECIPE_CHARS } from './limits.js';
export { MAX_RECIPE_CHARS };
const DIETS = new Set(['vegan', 'vegetarisch', 'pescetarisch', 'omnivor']);
/** Kleiner YAML-Ausschnitt: `key: wert`, `key: [a, b]` und Listen mit `- a`. */
export function splitFrontMatter(src) {
    const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(src);
    if (!m)
        return { fields: {}, body: src };
    const fields = Object.create(null);
    let listKey;
    for (const raw of m[1].split(/\r?\n/)) {
        const line = raw.replace(/\s+#.*$/, '');
        if (!line.trim())
            continue;
        const item = /^\s+-\s*(.*)$/.exec(line) ?? /^-\s*(.*)$/.exec(line);
        if (item && listKey) {
            const list = fields[listKey];
            const value = unquote(item[1]);
            if (Array.isArray(list))
                list.push(value);
            else
                fields[listKey] = [value];
            continue;
        }
        const kv = /^([\w.\- ]+?)\s*:\s*(.*)$/.exec(line);
        if (!kv)
            continue;
        const key = kv[1].trim().toLowerCase();
        const value = kv[2].trim();
        listKey = key;
        if (value === '')
            fields[key] = [];
        else if (value.startsWith('[') && value.endsWith(']')) {
            fields[key] = value.slice(1, -1).split(',').map(unquote).filter(Boolean);
        }
        else
            fields[key] = unquote(value);
    }
    return { fields, body: src.slice(m[0].length) };
}
function unquote(value) {
    const v = value.trim();
    return /^(['"]).*\1$/.test(v) ? v.slice(1, -1) : v;
}
const asText = (v) => (Array.isArray(v) ? v.join(', ') : v)?.trim() || undefined;
function readMeta(fields, warnings) {
    const meta = { title: asText(fields.title) ?? '', tags: [] };
    const tags = fields.tags;
    meta.tags = (Array.isArray(tags) ? tags : (tags ?? '').split(','))
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 30);
    const servings = asText(fields.servings ?? fields.serves);
    if (servings) {
        const q = parseQuantity(servings);
        if (q && q.value > 0)
            meta.servings = q.value;
        else
            warnings.push(`Portionen „${servings}“ sind keine Zahl.`);
    }
    const yieldText = asText(fields.yield);
    if (yieldText) {
        const q = parseQuantity(yieldText);
        if (q && q.value > 0)
            meta.yield = q;
        else
            warnings.push(`Ausbeute „${yieldText}“ ist keine Menge wie „800 g“.`);
    }
    const source = asText(fields.source ?? fields['source.url']);
    if (source)
        meta.source = source;
    const description = asText(fields.description ?? fields.introduction);
    if (description)
        meta.description = description;
    const prep = asText(fields['time.prep'] ?? fields['prep time']);
    const cook = asText(fields['time.cook'] ?? fields['cook time']);
    const prepMinutes = prep ? parseDuration(prep) : undefined;
    const cookMinutes = cook ? parseDuration(cook) : undefined;
    if (prepMinutes !== undefined)
        meta.prepMinutes = prepMinutes;
    if (cookMinutes !== undefined)
        meta.cookMinutes = cookMinutes;
    const diet = asText(fields.diet)?.toLowerCase();
    if (diet) {
        if (DIETS.has(diet))
            meta.diet = diet;
        else
            warnings.push(`Unbekannte Ernährungsform „${diet}“.`);
    }
    return meta;
}
/** Felder, die das Metadaten-Formular bearbeitet (Reihenfolge = Ausgabe). */
export const META_FIELDS = [
    'title',
    'servings',
    'yield',
    'tags',
    'time.prep',
    'time.cook',
    'source',
    'description',
    'diet',
];
function yamlValue(value) {
    // Anführungszeichen, wenn YAML den Wert sonst anders lesen würde.
    return /^[\s]|[\s]$|[:#[\]{},&*!|>'"%@`]|^-/.test(value) || value === ''
        ? JSON.stringify(value)
        : value;
}
/**
 * Schreibt Felder ins Front Matter; leere Werte entfernen das Feld, andere
 * Felder bleiben erhalten. Der Rezepttext bleibt unverändert.
 */
export function setFrontMatter(src, patch) {
    const { fields, body } = splitFrontMatter(src);
    const merged = { ...fields };
    for (const [key, value] of Object.entries(patch)) {
        const empty = Array.isArray(value) ? value.length === 0 : !value?.trim();
        if (empty)
            delete merged[key];
        else
            merged[key] = Array.isArray(value) ? value.map((v) => v.trim()) : value.trim();
    }
    const order = [
        ...META_FIELDS,
        ...Object.keys(merged).filter((k) => !META_FIELDS.includes(k)),
    ];
    const lines = order.flatMap((key) => {
        const value = merged[key];
        if (value === undefined)
            return [];
        if (Array.isArray(value))
            return [`${key}: [${value.map(yamlValue).join(', ')}]`];
        return [`${key}: ${yamlValue(value.replace(/\r?\n/g, ' '))}`];
    });
    return `---\n${lines.join('\n')}\n---\n${body.replace(/^\r?\n/, '')}`;
}
/** Liest die Felder für das Formular (Rohwerte, wie im Text). */
export function readFrontMatter(src) {
    const { fields } = splitFrontMatter(src);
    const out = {};
    for (const key of META_FIELDS) {
        const v = fields[key];
        if (v !== undefined)
            out[key] = Array.isArray(v) ? v.join(', ') : v;
    }
    return out;
}
function num(v) {
    return v.type === 'decimal' ? v.value : v.num / v.den;
}
function toAmount(q, unit, scalable) {
    if (!q)
        return undefined;
    const u = (unit ?? '').trim();
    if (q.type === 'range')
        return { kind: 'range', min: num(q.min), max: num(q.max), unit: u, scalable };
    if (q.value.type === 'text') {
        // Dezimalkomma, das der Parser nicht als Zahl erkannt hat.
        const parsed = parseQuantity(q.value.value);
        if (parsed && parsed.unit === '')
            return { kind: 'number', value: parsed.value, unit: u, scalable };
        return { kind: 'text', text: q.value.value, unit: u };
    }
    return { kind: 'number', value: num(q.value), unit: u, scalable };
}
export function parseRecipe(src) {
    const warnings = [];
    let text = src;
    if (text.length > MAX_RECIPE_CHARS) {
        warnings.push(`Das Rezept ist zu lang und wurde nach ${MAX_RECIPE_CHARS} Zeichen abgeschnitten.`);
        text = text.slice(0, MAX_RECIPE_CHARS);
    }
    const { fields, body } = splitFrontMatter(text);
    const meta = readMeta(fields, warnings);
    const result = {
        meta,
        ingredients: [],
        cookware: [],
        timers: [],
        sections: [],
        warnings,
    };
    let parsed;
    try {
        parsed = new CooklangRecipe(body);
    }
    catch (error) {
        warnings.push(`Rezept konnte nicht gelesen werden: ${error instanceof Error ? error.message : String(error)}`);
        return result;
    }
    result.cookware = parsed.cookware.map((c) => c.name);
    result.timers = parsed.timers.map((t) => {
        const timer = {
            amount: toAmount(t.duration, t.unit, false) ?? {
                kind: 'text',
                text: '',
                unit: '',
            },
        };
        if (t.name)
            timer.name = t.name;
        return timer;
    });
    let stepNumber = 0;
    for (const section of parsed.sections) {
        const blocks = [];
        for (const content of section.content) {
            if (content.type === 'note') {
                blocks.push({ type: 'note', text: content.note });
                continue;
            }
            const tokens = [];
            for (const item of content.items) {
                if (item.type === 'text') {
                    const prev = tokens.at(-1);
                    // Zeilenumbrüche innerhalb eines Schritts liefert der Parser als getrennte Texte ohne Leerzeichen.
                    if (prev?.type === 'text' && !/\s$/.test(prev.text) && !/^[\s.,;:!?)]/.test(item.value)) {
                        prev.text += ` ${item.value}`;
                    }
                    else if (prev?.type === 'text')
                        prev.text += item.value;
                    else
                        tokens.push({ type: 'text', text: item.value });
                }
                else if (item.type === 'ingredient') {
                    const source = parsed.ingredients[item.index];
                    if (!source)
                        continue;
                    const part = item.quantityPartIndex !== undefined
                        ? source.quantityParts?.[item.quantityPartIndex]
                        : undefined;
                    const ingredient = {
                        name: source.name,
                        optional: source.flags?.includes('optional') ?? false,
                        hidden: source.flags?.includes('hidden') ?? false,
                    };
                    const amount = part
                        ? toAmount(part.value, part.unit, part.scalable)
                        : toAmount(source.quantity, source.unit, true);
                    if (amount)
                        ingredient.amount = amount;
                    if (source.preparation)
                        ingredient.note = source.preparation;
                    if (source.flags?.includes('recipe') && source.extras?.path) {
                        ingredient.reference = source.extras.path.replace(/\.cook$/, '');
                    }
                    result.ingredients.push(ingredient);
                    tokens.push({
                        type: 'ingredient',
                        index: result.ingredients.length - 1,
                        display: item.displayName,
                    });
                }
                else if (item.type === 'cookware') {
                    tokens.push({ type: 'cookware', name: parsed.cookware[item.index]?.name ?? '' });
                }
                else {
                    tokens.push({ type: 'timer', index: item.index });
                }
            }
            blocks.push({ type: 'step', number: ++stepNumber, tokens });
        }
        if (blocks.length || section.name)
            result.sections.push({ name: section.name, blocks });
    }
    if (!meta.title)
        warnings.push('Titel fehlt (Front Matter „title:“).');
    return result;
}
/** Skaliert alle skalierbaren Mengen um `factor`. */
export function scaleRecipe(recipe, factor) {
    if (factor === 1)
        return recipe;
    return {
        ...recipe,
        ingredients: recipe.ingredients.map((i) => i.amount ? { ...i, amount: scaleAmount(i.amount, factor) } : i),
    };
}
/** Abgeleitete Zutatenliste: je Name zusammengefasst, versteckte Zutaten ausgelassen. */
export function listIngredients(recipe) {
    const byName = new Map();
    for (const i of recipe.ingredients) {
        if (i.hidden)
            continue;
        const key = `${i.name.toLocaleLowerCase('de-DE')}\u0000${i.reference ?? ''}`;
        let entry = byName.get(key);
        if (!entry) {
            entry = { name: i.name, amounts: [], optional: i.optional, notes: [] };
            if (i.reference)
                entry.reference = i.reference;
            byName.set(key, entry);
        }
        else
            entry.optional &&= i.optional;
        if (i.note && !entry.notes.includes(i.note))
            entry.notes.push(i.note);
        if (!i.amount)
            continue;
        let merged = false;
        for (let k = 0; k < entry.amounts.length && !merged; k++) {
            const sum = addAmounts(entry.amounts[k], i.amount);
            if (sum) {
                entry.amounts[k] = sum;
                merged = true;
            }
        }
        if (!merged)
            entry.amounts.push(i.amount);
    }
    return [...byName.values()];
}
/** Cooklang-Schreibweise für eine Zutat (Einfügehilfe im Editor). */
export function ingredientSnippet(o) {
    const clean = (v) => (v ?? '').replace(/[{}%()@#~\n]/g, '').trim();
    const name = clean(o.name);
    const quantity = clean(o.quantity);
    const unit = clean(o.unit);
    const amount = quantity ? `${o.fixed ? '=' : ''}${quantity}${unit ? `%${unit}` : ''}` : '';
    const note = clean(o.note);
    return `@${o.optional ? '?' : ''}${o.reference ? './' : ''}${name}{${amount}}${note ? `(${note})` : ''}`;
}
export function timerSnippet(minutes, name = '') {
    const clean = name.replace(/[{}%@#~\n]/g, '').trim();
    return `~${clean}{${minutes}%min}`;
}
