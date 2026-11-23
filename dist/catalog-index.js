// SPDX-License-Identifier: AGPL-3.0-or-later
import { isCategoryId, normalizeName } from './categories.js';
export const EMPTY_CATALOG = {
    lookup: () => undefined,
    diet: () => undefined,
    item: () => undefined,
    names: [],
    size: 0,
};
const DIETS = new Set(['vegan', 'vegetarisch', 'pescetarisch', 'omnivor']);
/** Baut den Index aus der (untrusted) Katalogdatei; ungültige Einträge werden übersprungen. */
export function buildCatalogIndex(data) {
    const items = typeof data === 'object' && data !== null && Array.isArray(data.items)
        ? data.items
        : [];
    const byName = new Map();
    const diets = new Map();
    const refs = new Map();
    const names = [];
    for (const item of items) {
        if (typeof item?.name !== 'string' || !isCategoryId(item.category))
            continue;
        names.push(item.name);
        const ref = typeof item.id === 'string' && /^[a-z0-9-]{1,60}$/.test(item.id)
            ? { id: item.id, name: item.name }
            : undefined;
        for (const label of [item.name, ...(Array.isArray(item.synonyms) ? item.synonyms : [])]) {
            if (typeof label !== 'string')
                continue;
            byName.set(normalizeName(label), item.category);
            if (ref)
                refs.set(normalizeName(label), ref);
            if (typeof item.diet === 'string' && DIETS.has(item.diet))
                diets.set(normalizeName(label), item.diet);
        }
    }
    return {
        lookup: (key) => byName.get(key),
        diet: (key) => diets.get(key),
        item: (key) => refs.get(key),
        names: names.sort((a, b) => a.localeCompare(b, 'de')),
        size: names.length,
    };
}
