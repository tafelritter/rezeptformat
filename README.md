# rezeptformat

Das Rezeptformat von [Tafelrunde](https://github.com/Tafelritter/tafelrunde): Cooklang mit Front Matter, deutschen Mengen und Referenzen zwischen Rezepten – dazu die Kategorien des Einkaufs, das Format des Artikelkatalogs und die Prüfung des öffentlichen [Katalogs](https://github.com/Tafelritter/katalog).

Ein Parser für alle: Die App liest Rezepte damit, der Katalog prüft neue Rezepte damit.

## Einbinden

Das Paket wird direkt per Git-Tag installiert (kein npm-Registry, kein Token):

```sh
pnpm add github:Tafelritter/rezeptformat#v1.0.0
```

`dist/` liegt deshalb im Repository; die CI prüft, dass es zum Quelltext passt.

| Einstieg                            | Inhalt                                                                        | Umgebung      |
| ----------------------------------- | ----------------------------------------------------------------------------- | ------------- |
| `@tafelritter/rezeptformat/basis`   | Kategorien, Artikelkatalog-Index, Mengen und Einheiten, Grenzen – ohne Parser | Browser, Node |
| `@tafelritter/rezeptformat`         | alles aus `basis`, dazu Cooklang-Parser, Skalierung, Referenzen, Zyklen       | Browser, Node |
| `@tafelritter/rezeptformat/katalog` | Katalog prüfen und bauen (`checkKatalog`, `buildKatalog`)                     | nur Node      |

`basis` ist für Code gedacht, der beim Start einer App geladen wird: Der Parser (mit `big.js`) bleibt so aus dem Start-Chunk.

```ts
import { parseRecipe, scaleRecipe, formatAmount } from '@tafelritter/rezeptformat'

const recipe = parseRecipe('---\ntitle: Teig\nservings: 2\n---\nVerknete @Mehl{500%g}.')
formatAmount(scaleRecipe(recipe, 3).ingredients[0]?.amount) // „1,5 kg“
```

Konventionen für Rezepte (Front Matter, Dezimalkomma, Referenzen): [Katalog – Rezepte schreiben](https://github.com/Tafelritter/katalog/blob/main/docs/rezepte.md).

## Katalog prüfen und bauen

```sh
rezeptformat validate [ordner]
rezeptformat build [ordner] --out <ziel> [--version <katalog-version>]
```

Der Ordner enthält `ingredients/`, `recipes/`, optional `images/` und `nutrition/`. `build` schreibt `ingredients.json`, `recipes.json`, `nutrition.json` und `images/` – genau das, was die App unter `catalog/` lädt. Die Felder `version` (Formatversion, derzeit 1) und `format` beschreiben das Datenformat, `katalog` die Version des Katalog-Releases.

## Entwicklung

Voraussetzungen: Node.js 24 und pnpm über Corepack.

```sh
pnpm install
pnpm test
pnpm build        # nach jeder Änderung an src/: dist/ neu bauen und mitcommitten
```

Releases entstehen über release-please: Commits nach Conventional Commits, der Release-PR setzt Version und Changelog, nach dem Merge gibt es Tag und Release. App und Katalog bekommen das Update über Renovate.

Änderungen am Format betreffen App und Katalog gleichzeitig: Ein **Breaking Change** (`feat!:`) erhöht die Hauptversion; dann zuerst den Katalog, danach die App umstellen.

## Lizenz

[AGPL-3.0-or-later](LICENSE). Sicherheitslücken bitte wie in [SECURITY.md](SECURITY.md) beschrieben melden.
