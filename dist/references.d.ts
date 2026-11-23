import { type Amount } from './amount.js';
import { type ListedIngredient, type ParsedRecipe } from './recipe.js';
/** Ein Rezept, auf das verwiesen werden kann. */
export interface RecipeEntry {
    /** Eindeutiger Schlüssel, z. B. `space:<bereich>/<id>` oder `catalog:backen/hefeteig`. */
    key: string;
    /** Bereich oder `catalog`. */
    scope: string;
    /** Pfad im Katalog (ohne `.cook`), sonst leer. */
    path?: string;
    recipe: ParsedRecipe;
}
export interface RecipeIndex {
    entries: RecipeEntry[];
}
export declare function resolveReference(index: RecipeIndex, reference: string, fromScope: string): RecipeEntry | undefined;
/**
 * Faktor, mit dem ein Unterrezept skaliert wird, wenn `amount` davon gebraucht wird:
 * gegen die Ausbeute (500 g von 800 g = 0,625) oder gegen die Portionen (2 von 4 = 0,5).
 */
export declare function referenceFactor(amount: Amount | undefined, sub: ParsedRecipe): number | undefined;
/** Findet einen Zyklus ab `start`; liefert die Titel im Kreis oder `undefined`. */
export declare function findCycle(index: RecipeIndex, start: RecipeEntry): string[] | undefined;
/** Prüft ein (noch nicht gespeichertes) Rezept auf Zyklen und nicht auflösbare Referenzen. */
export declare function checkReferences(index: RecipeIndex, entry: RecipeEntry): {
    cycle?: string[];
    unresolved: string[];
};
export interface ResolvedReference {
    /** Index der Zutat im Rezept (Verwendung im Text). */
    ingredient: number;
    entry?: RecipeEntry;
    /** Faktor für das Unterrezept; `undefined`, wenn sich die Menge nicht umrechnen lässt. */
    factor?: number;
}
export declare function resolveAll(index: RecipeIndex, recipe: ParsedRecipe, scope: string): ResolvedReference[];
/**
 * Zutatenliste mit aufgelösten Unterrezepten (für Einkaufsliste und
 * Ernährungsform). Nicht auflösbare Referenzen bleiben als eigene Zeile stehen.
 */
export declare function flattenIngredients(index: RecipeIndex, recipe: ParsedRecipe, scope: string, factor?: number, depth?: number, seen?: ReadonlySet<string>): ListedIngredient[];
/** Für die Anzeige: Zutatenliste des Unterrezepts mit dem passenden Faktor. */
export declare function subRecipeIngredients(resolved: ResolvedReference): ListedIngredient[];
