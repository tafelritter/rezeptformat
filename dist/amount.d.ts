/** Mengen in Rezepten: Zahl, Spanne oder Text, mit deutscher Formatierung und Einheiten-Umrechnung. */
export type Amount = {
    kind: 'number';
    value: number;
    unit: string;
    scalable: boolean;
} | {
    kind: 'range';
    min: number;
    max: number;
    unit: string;
    scalable: boolean;
} | {
    kind: 'text';
    text: string;
    unit: string;
};
export declare function unitInfo(unit: string): {
    base: string;
    factor: number;
};
/** Umrechnungsfaktor von `from` nach `to`, falls gleiche Größe (z. B. kg → g = 1000). */
export declare function conversion(from: string, to: string): number | undefined;
export declare function scaleAmount(amount: Amount, factor: number): Amount;
/** Zahl auf sinnvolle Stellen runden und mit Komma ausgeben („1,5“, „0,25“, „333“). */
export declare function formatNumber(value: number): string;
/** Menge und Einheit getrennt, lesbar gerundet (für die Felder eines Listeneintrags). */
export declare function amountParts(amount: Amount): {
    quantity: string;
    unit: string;
};
export declare function formatAmount(amount: Amount | undefined): string;
/** Prüft eine gespeicherte Menge (aus einem synchronisierten Dokument). */
export declare function readAmount(value: unknown): Amount | undefined;
/** Summe zweier Mengen, falls zusammenfassbar (gleiche Größe, beide Zahlen). */
export declare function addAmounts(a: Amount, b: Amount): Amount | undefined;
/**
 * Fasst Mengen je Größe zusammen (500 g + 0,2 kg = 700 g; 2 + 1 Stück = 3).
 * Zahlen landen in der Basiseinheit; Spannen und Texte bleiben einzeln stehen.
 */
export declare function sumAmounts(amounts: readonly Amount[]): Amount[];
/** Liest Mengenangaben wie „800 g“, „1,5 kg“ oder „2 Bleche“. */
export declare function parseQuantity(text: string): {
    value: number;
    unit: string;
} | undefined;
/** Liest Dauern wie „20 min“, „1 h 30 min“, „1,5 Std.“ oder „90“ in Minuten. */
export declare function parseDuration(text: string): number | undefined;
/** Timer-Dauer in Sekunden. */
export declare function timerSeconds(amount: Amount): number | undefined;
