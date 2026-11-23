import type { Diet } from './catalog-index.js';
import { type Amount } from './amount.js';
import { MAX_RECIPE_CHARS } from './limits.js';
export { MAX_RECIPE_CHARS };
export interface RecipeMeta {
    title: string;
    servings?: number;
    /** Ausbeute, z. B. 800 g Teig – Grundlage für Skalierung als Unterrezept. */
    yield?: {
        value: number;
        unit: string;
    };
    tags: string[];
    source?: string;
    description?: string;
    prepMinutes?: number;
    cookMinutes?: number;
    /** Manuelle Überschreibung der abgeleiteten Ernährungsform. */
    diet?: Diet;
}
export interface RecipeIngredient {
    name: string;
    amount?: Amount;
    optional: boolean;
    hidden: boolean;
    note?: string;
    /** Referenziertes Rezept (Pfad ohne `.cook`). */
    reference?: string;
}
export interface RecipeTimer {
    name?: string;
    amount: Amount;
}
export type Token = {
    type: 'text';
    text: string;
} | {
    type: 'ingredient';
    index: number;
    display: string;
} | {
    type: 'cookware';
    name: string;
} | {
    type: 'timer';
    index: number;
};
export type Block = {
    type: 'step';
    number: number;
    tokens: Token[];
} | {
    type: 'note';
    text: string;
};
export interface RecipeSection {
    name: string;
    blocks: Block[];
}
export interface ParsedRecipe {
    meta: RecipeMeta;
    /** Jede Verwendung einer Zutat im Text, in Reihenfolge. */
    ingredients: RecipeIngredient[];
    cookware: string[];
    timers: RecipeTimer[];
    sections: RecipeSection[];
    warnings: string[];
}
type FrontValue = string | string[];
/** Kleiner YAML-Ausschnitt: `key: wert`, `key: [a, b]` und Listen mit `- a`. */
export declare function splitFrontMatter(src: string): {
    fields: Record<string, FrontValue>;
    body: string;
};
/** Felder, die das Metadaten-Formular bearbeitet (Reihenfolge = Ausgabe). */
export declare const META_FIELDS: readonly ["title", "servings", "yield", "tags", "time.prep", "time.cook", "source", "description", "diet"];
export type MetaField = (typeof META_FIELDS)[number];
/**
 * Schreibt Felder ins Front Matter; leere Werte entfernen das Feld, andere
 * Felder bleiben erhalten. Der Rezepttext bleibt unverändert.
 */
export declare function setFrontMatter(src: string, patch: Partial<Record<MetaField, string | string[]>>): string;
/** Liest die Felder für das Formular (Rohwerte, wie im Text). */
export declare function readFrontMatter(src: string): Partial<Record<MetaField, string>>;
export declare function parseRecipe(src: string): ParsedRecipe;
/** Skaliert alle skalierbaren Mengen um `factor`. */
export declare function scaleRecipe(recipe: ParsedRecipe, factor: number): ParsedRecipe;
export interface ListedIngredient {
    name: string;
    /** Mengen, soweit zusammenfassbar addiert (z. B. 500 g + 0,1 kg = 600 g). */
    amounts: Amount[];
    optional: boolean;
    reference?: string;
    notes: string[];
}
/** Abgeleitete Zutatenliste: je Name zusammengefasst, versteckte Zutaten ausgelassen. */
export declare function listIngredients(recipe: ParsedRecipe): ListedIngredient[];
/** Cooklang-Schreibweise für eine Zutat (Einfügehilfe im Editor). */
export declare function ingredientSnippet(o: {
    name: string;
    quantity?: string;
    unit?: string;
    fixed?: boolean;
    optional?: boolean;
    note?: string;
    reference?: boolean;
}): string;
export declare function timerSnippet(minutes: number, name?: string): string;
