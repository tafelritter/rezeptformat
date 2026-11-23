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
import type { CatalogItem } from './catalog-index.js';
/** Version des Datenformats der gebauten Dateien. */
export declare const KATALOG_FORMAT = 1;
/** Fotos im Katalog: klein halten, die App lädt sie offline vor. */
export declare const MAX_IMAGE_BYTES: number;
/** Spalten des BLS-Auszugs in der Reihenfolge, die die App erwartet. */
export declare const NUTRIENT_COLUMNS: readonly ["kcal", "kj", "fett", "fett_gesaettigt", "kohlenhydrate", "zucker", "ballaststoffe", "eiweiss", "salz"];
/** Fehler mit allen gefundenen Problemen (für die CI-Ausgabe). */
export declare class KatalogError extends Error {
    readonly errors: string[];
    constructor(title: string, errors: string[]);
}
export interface KatalogRecipe {
    path: string;
    source: string;
    /** Fingerabdruck des Quelltexts (Hinweis „Original geändert“ in der App). */
    version: string;
    image?: string;
}
export interface NutritionFile {
    foods: Record<string, {
        n: (number | null)[];
        w?: Record<string, number>;
        d?: number;
    }>;
    units: Record<string, {
        ml?: number;
        g?: number;
    }>;
}
/** Liest und prüft die Artikel (`ingredients/*.yaml`). */
export declare function loadIngredients(dir: string): CatalogItem[];
/**
 * Liest und prüft alle Rezepte. Fehler: unlesbar, ohne Titel, zu groß,
 * unzulässiger Pfad, nicht auflösbare Referenz, Zyklus. Hinweise: Zutaten,
 * die der Artikelkatalog nicht kennt.
 */
export declare function loadRecipes(ingredients: readonly CatalogItem[], dir: string): {
    notes: string[];
    recipes: KatalogRecipe[];
};
/**
 * Fotos zu Rezepten: `images/<rezeptpfad>.webp` oder `.jpg`,
 * höchstens 400 KB, nur echte Bilddateien, nur zu vorhandenen Rezepten.
 */
export declare function loadImages(recipePaths: ReadonlySet<string>, dir: string): Map<string, {
    file: string;
    image: string;
}>;
/**
 * Nährwerte: BLS-Auszug (CC BY 4.0), Zuordnung Artikel → BLS-Code und
 * Gewichtstabelle. Fehlt einer der Teile, gibt es keine Nährwerte.
 */
export declare function loadNutrition(items: readonly CatalogItem[], dir: string): NutritionFile | undefined;
export interface Katalog {
    items: CatalogItem[];
    recipes: KatalogRecipe[];
    images: Map<string, {
        file: string;
        image: string;
    }>;
    nutrition: NutritionFile | undefined;
    notes: string[];
}
/** Prüft den ganzen Katalog im Ordner `root`; wirft `KatalogError` mit allen Fehlern. */
export declare function checkKatalog(root: string): Katalog;
/** Schreibt die Dateien, die die App lädt, nach `out` (vorher geleert). */
export declare function buildKatalog(root: string, out: string, version?: string): Katalog;
