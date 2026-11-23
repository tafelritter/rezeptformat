import { type CategoryId } from './categories.js';
export type Diet = 'vegan' | 'vegetarisch' | 'pescetarisch' | 'omnivor';
export interface CatalogItem {
    id: string;
    name: string;
    category: CategoryId;
    synonyms?: string[];
    diet?: Diet;
    units?: string[];
}
export interface CatalogIndex {
    /** Kategorie zu einem normalisierten Namen oder Synonym. */
    lookup(normalizedName: string): CategoryId | undefined;
    /** Ernährungsform eines Artikels, falls im Katalog bekannt. */
    diet(normalizedName: string): Diet | undefined;
    /** Katalog-ID und Anzeigename zu einem Namen oder Synonym („Zwiebel“ → `zwiebeln`, „Zwiebeln“). */
    item(normalizedName: string): CatalogRef | undefined;
    /** Anzeigenamen für Vorschläge. */
    names: string[];
    size: number;
}
export interface CatalogRef {
    id: string;
    name: string;
}
export declare const EMPTY_CATALOG: CatalogIndex;
/** Baut den Index aus der (untrusted) Katalogdatei; ungültige Einträge werden übersprungen. */
export declare function buildCatalogIndex(data: unknown): CatalogIndex;
