/** Standard-Kategorien der Einkaufsliste (plan/03-phase-1-einkaufsliste.md, 1.9). */
export declare const CATEGORIES: readonly [{
    readonly id: "obst-gemuese";
    readonly name: "Obst & Gemüse";
}, {
    readonly id: "brot-backwaren";
    readonly name: "Brot & Backwaren";
}, {
    readonly id: "milch-kaese-eier";
    readonly name: "Milch, Käse & Eier";
}, {
    readonly id: "fleisch-wurst-fisch";
    readonly name: "Fleisch, Wurst & Fisch";
}, {
    readonly id: "tiefkuehl";
    readonly name: "Tiefkühl";
}, {
    readonly id: "nudeln-reis-konserven";
    readonly name: "Nudeln, Reis & Konserven";
}, {
    readonly id: "backen";
    readonly name: "Backen";
}, {
    readonly id: "gewuerze-oele-saucen";
    readonly name: "Gewürze, Öle & Saucen";
}, {
    readonly id: "fruehstueck-aufstriche";
    readonly name: "Frühstück & Aufstriche";
}, {
    readonly id: "suesses-snacks";
    readonly name: "Süßes & Snacks";
}, {
    readonly id: "getraenke";
    readonly name: "Getränke";
}, {
    readonly id: "drogerie-haushalt";
    readonly name: "Drogerie & Haushalt";
}, {
    readonly id: "sonstiges";
    readonly name: "Sonstiges";
}];
export type CategoryId = (typeof CATEGORIES)[number]['id'];
export declare const FALLBACK_CATEGORY: CategoryId;
export declare function isCategoryId(value: unknown): value is CategoryId;
export declare function categoryName(id: CategoryId): string;
/** Standard-Reihenfolge; Läden können eine eigene festlegen. */
export declare const DEFAULT_ORDER: readonly CategoryId[];
/**
 * Vergleichsschlüssel für Artikelnamen: Unicode-normalisiert, klein,
 * Leerraum zusammengefasst. „  Äpfel “ und „äpfel“ ergeben denselben Schlüssel.
 */
export declare function normalizeName(name: string): string;
