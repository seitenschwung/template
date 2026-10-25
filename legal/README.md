# Impressum und Datenschutz

Die Rechtstexte werden nicht pro Projekt geschrieben. Jedes Projekt hat eine `legal.json` mit
seinen eigenen Angaben, die Texte stehen einmal hier. Die gemeinsame Pipeline erzeugt daraus bei
jedem Build `impressum.html` und `datenschutz.html`.

| Datei | Inhalt | Wer pflegt |
|---|---|---|
| `legal/hosting.json` | Fakten, die für alle Seiten gleich sind: Hoster, Betrieb, Logfrist, AV-Verträge, CrowdSec | Owner |
| `legal/bausteine.mjs` | Textbausteine (Kontakt, Formular, Stripe, …) mit den Hosts und Cookies, die sie erlauben | Owner, per PR |
| `legal/render.mjs` | Generator, nur Node-Bordmittel | Owner |
| `legal.json` im Projekt | Betreiber, Land, gewählte Bausteine, Bildnachweise | Box (Daten vom Kunden) |
| `legal-layout.html` im Projekt (optional) | Seitenrahmen im Design der Seite, mit `{{titel}}` und `{{inhalt}}` | Box |

## Was die Pipeline prüft

1. **Angaben vollständig?** Fehlt etwas (in `legal.json` oder `hosting.json`), steht auf der Seite
   `[FEHLT: …]`, der Lauf zeigt Warnungen, und **der Deploy auf die Live-Seite bricht ab**. Für eine
   Entwurfsseite die Repo-Variable `LEGAL_DRAFT=true` setzen.
2. **Passt der Text zur Seite?** Der Crawler lädt jede Seite. Jede Anfrage an einen fremden Host und
   jedes Cookie muss von einem gewählten Baustein abgedeckt sein, sonst wird die CI rot.
3. **Erreichbar?** Jede Seite muss auf `impressum.html` und `datenschutz.html` verlinken.

Projekte ohne `legal.json` bleiben unberührt (nur ein Hinweis im Lauf).

## legal.json

```json
{
  "land": "AT",                  // AT: § 5 ECG + § 25 MedienG, Datenschutzbehörde Wien. DE: § 5 DDG
  "art": "unternehmen",          // unternehmen | verein | privat
  "ausgabe": "public",           // Ordner, der als Web-Root ausgeliefert wird
  "betreiber": {
    "name": "", "anschrift": "", "email": "",        // Pflicht
    "unternehmensgegenstand": "",                    // Pflicht bei AT + unternehmen
    "rechtsform": "", "vertreten_durch": "", "telefon": "", "uid": "",
    "firmenbuch": "", "kammer": "", "berufsrecht": "", "gewerbebehoerde": ""
  },
  "aufsichtsbehoerde": "",       // Pflicht bei DE: Datenschutzbehörde des Bundeslandes
  "blattlinie": "",              // AT, optional
  "redaktion_verantwortlich": "",// DE, nur bei journalistisch-redaktionellen Inhalten
  "verbraucherschlichtung": "",  // optional
  "bausteine": ["kontakt-mail"], // siehe bausteine.mjs
  "eigene_abschnitte": [{ "titel": "", "text": "" }],
  "bildnachweise": ["Foto: Name / Unsplash"],
  "stand": "Oktober 2026"
}
```

`anschrift` darf ein Text oder eine Liste von Zeilen sein. Leere optionale Felder erscheinen nicht.
`eigene_abschnitte` ist für Sonderfälle ohne fremde Hosts. Ein neuer externer Dienst (Karte, Video,
Formular-Dienst, Analyse) bekommt einen Baustein in `bausteine.mjs`.

## Lokal ansehen (in der Box)

```
git clone -q --depth 1 --branch v1 https://github.com/seitenschwung/template /tmp/legal-kit
node /tmp/legal-kit/legal/render.mjs .
```

Die erzeugten Dateien stehen in `.gitignore` und werden nicht committet.

## Texte ändern

Baustein oder `hosting.json` per PR ändern, nach dem Merge den Tag `v1` verschieben. Die Seiten
übernehmen die Änderung beim nächsten Build; für sofort: den CI-Lauf jedes Projekts neu starten
(`gh workflow run ci.yml -R <repo>`).

Keine Rechtsberatung: Die Bausteine decken den technischen Betrieb ab. Ob die Texte für einen
Betreiber vollständig sind, prüft der Betreiber.
