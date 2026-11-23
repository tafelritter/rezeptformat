# Sicherheit

`@tafelritter/rezeptformat` liest Rezepttext, der nicht vertrauenswürdig ist (geteilte, importierte und öffentliche Rezepte). Das Ergebnis enthält nur Texte und Zahlen; die App gibt es nie als HTML aus. Das Bedrohungsmodell der App steht in [Tafelritter/tafelrunde](https://github.com/Tafelritter/tafelrunde/blob/main/docs/threat-model.md).

## Schwachstelle melden

Bitte **kein öffentliches Issue** anlegen, sondern GitHubs private Meldefunktion nutzen: **Security → Report a vulnerability**. Eingangsbestätigung innerhalb von 7 Tagen.

## Im Fokus

- Eingaben, die den Parser abstürzen lassen oder sehr lange rechnen lassen
- Umgehung der Größengrenzen
- Pfade im Katalog, die aus dem Katalog-Ordner herausführen
