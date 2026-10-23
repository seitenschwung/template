#!/usr/bin/env node
// Erzeugt impressum.html und datenschutz.html aus der legal.json eines Projekts.
//
//   node render.mjs [projektordner] [--status datei.json]
//
// Liest <projekt>/legal.json und, falls vorhanden, <projekt>/legal-layout.html (mit {{titel}} und
// {{inhalt}}), schreibt in <projekt>/<ausgabe> (Standard: public). Fehlende Angaben erscheinen auf
// der Seite als [FEHLT: …] und in der Statusdatei, die die Pipeline auswertet.
// Nur Node-Bordmittel, damit es in der CI und in jeder Box ohne Installation läuft.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BAUSTEINE, DSB_AT } from './bausteine.mjs';

const KIT = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const statusAt = args.indexOf('--status');
const statusFile = statusAt >= 0 ? args.splice(statusAt, 2)[1] : null;
const projekt = resolve(args[0] ?? '.');

function abbruch(msg) { console.error(`legal: ${msg}`); process.exit(2); }
function lies(datei) {
  try { return JSON.parse(readFileSync(datei, 'utf8')); }
  catch (e) { abbruch(`${datei} ist kein gültiges JSON (${e.message})`); }
}

const cfg = lies(join(projekt, 'legal.json'));
const hosting = lies(join(KIT, 'hosting.json'));
const b = cfg.betreiber ?? {};
const fehlend = [];

const h = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const leer = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
const zeilen = (v) => (Array.isArray(v) ? v : String(v).split('\n')).map(h).join('<br>');
// Pflichtangabe: Wert oder sichtbare Markierung, die auch in der Statusdatei landet.
function pflicht(v, was, quelle = 'legal.json') {
  if (!leer(v) && v !== false) return zeilen(v);
  fehlend.push(`${was} (${quelle})`);
  return `<mark class="legal-fehlt">[FEHLT: ${h(was)}]</mark>`;
}
const zeile = (label, v) => (leer(v) ? '' : `<p><strong>${h(label)}:</strong> ${zeilen(v)}</p>`);

const land = cfg.land;
if (!['AT', 'DE'].includes(land)) abbruch('"land" muss "AT" oder "DE" sein');
const art = cfg.art ?? 'unternehmen';
if (!['unternehmen', 'verein', 'privat'].includes(art)) abbruch('"art" muss "unternehmen", "verein" oder "privat" sein');
const gewaehlt = cfg.bausteine ?? [];
for (const id of gewaehlt) if (!BAUSTEINE[id]) abbruch(`unbekannter Baustein "${id}". Vorhanden: ${Object.keys(BAUSTEINE).join(', ')}`);

const name = pflicht(b.name, 'Name bzw. Firma des Betreibers');
const anschrift = pflicht(b.anschrift, 'Anschrift des Betreibers');
const email = pflicht(b.email, 'E-Mail-Adresse des Betreibers');

// ---------- Impressum ----------
function impressum() {
  const teile = [];
  if (land === 'AT') {
    teile.push(`<p>Informationen nach § 5 E-Commerce-Gesetz und Offenlegung nach § 25 Mediengesetz</p>`);
    teile.push(`<p><strong>${name}</strong>${leer(b.rechtsform) ? '' : `<br>${zeilen(b.rechtsform)}`}<br>${anschrift}</p>`);
    teile.push(zeile('Vertreten durch', b.vertreten_durch));
    if (art === 'unternehmen') teile.push(`<p><strong>Unternehmensgegenstand:</strong> ${pflicht(b.unternehmensgegenstand, 'Unternehmensgegenstand')}</p>`);
    else teile.push(zeile('Vereinszweck', b.unternehmensgegenstand));
  } else {
    teile.push(`<p>Angaben nach § 5 Digitale-Dienste-Gesetz</p>`);
    teile.push(`<p><strong>${name}</strong>${leer(b.rechtsform) ? '' : `<br>${zeilen(b.rechtsform)}`}<br>${anschrift}</p>`);
    teile.push(zeile('Vertreten durch', b.vertreten_durch));
  }
  teile.push(`<p><strong>E-Mail:</strong> ${email}${leer(b.telefon) ? '' : `<br><strong>Telefon:</strong> ${zeilen(b.telefon)}`}</p>`);
  teile.push(zeile(land === 'AT' ? 'UID-Nummer' : 'Umsatzsteuer-Identifikationsnummer', b.uid));
  teile.push(zeile(land === 'AT' ? 'Firmenbuch' : 'Register', b.firmenbuch));
  teile.push(zeile('Kammer / Berufsverband', b.kammer));
  teile.push(zeile('Berufsrecht', b.berufsrecht));
  teile.push(zeile('Aufsichtsbehörde', b.gewerbebehoerde));
  if (land === 'AT') teile.push(zeile('Grundlegende Richtung (Blattlinie)', cfg.blattlinie));
  else teile.push(zeile('Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV', cfg.redaktion_verantwortlich));
  if (!leer(cfg.verbraucherschlichtung)) teile.push(`<h2>Verbraucherschlichtung</h2><p>${zeilen(cfg.verbraucherschlichtung)}</p>`);
  if (!leer(cfg.bildnachweise)) teile.push(`<h2>Bildnachweise</h2><ul>${cfg.bildnachweise.map((x) => `<li>${h(x)}</li>`).join('')}</ul>`);
  teile.push(`<h2>Technische Umsetzung und Betrieb</h2><p>${h(hosting.betrieb.name)}</p>`);
  return teile.filter(Boolean).join('\n');
}

// ---------- Datenschutz ----------
function datenschutz() {
  const abschnitte = [];
  const ab = (titel, html) => abschnitte.push(`<h2>${abschnitte.length + 1}. ${h(titel)}</h2>\n${html}`);

  ab('Verantwortlich', `<p>${name}${leer(b.vertreten_durch) ? '' : `, vertreten durch ${zeilen(b.vertreten_durch)}`}<br>${anschrift}<br>E-Mail: ${email}</p>`);

  const fremd = gewaehlt.some((id) => BAUSTEINE[id].hosts?.length);
  ab('Das Wichtigste vorab', fremd
    ? `<p>Diese Website verwendet keine Analyse- oder Tracking-Dienste. Dienste anderer Anbieter werden nur dort eingebunden, wo es unten beschrieben ist. Schriften und Bilder kommen vom eigenen Server.</p>`
    : `<p>Diese Website setzt keine Cookies, verwendet keine Analyse- oder Tracking-Dienste und lädt Schriften, Bilder und Videos ausschließlich vom eigenen Server. Daten anderer Anbieter werden erst übertragen, wenn Sie selbst einen Link zu einer anderen Website anklicken.</p>`);

  const q = 'legal/hosting.json im Template';
  const tage = leer(hosting.log_tage) ? pflicht(null, 'Speicherdauer der Logfiles in Tagen', q) : h(hosting.log_tage);
  const av = hosting.av_vertraege === true
    ? 'Mit beiden bestehen Verträge zur Auftragsverarbeitung nach Art. 28 DSGVO.'
    : pflicht(null, 'Verträge zur Auftragsverarbeitung bestätigt', q);
  let crowdsec;
  if (hosting.crowdsec_meldet_ips === true) {
    crowdsec = ' Diese IP-Adressen werden mit Zeitpunkt und Art der Auffälligkeit an die CrowdSec SAS, Paris, Frankreich, gemeldet, die daraus eine gemeinsame Sperrliste gegen Angriffe erstellt.';
  } else if (hosting.crowdsec_meldet_ips === false) {
    crowdsec = ' Die Auswertung findet nur auf unserem Server statt, es werden keine Daten weitergegeben.';
  } else {
    crowdsec = ' ' + pflicht(null, 'Meldet CrowdSec IP-Adressen an die CrowdSec-Zentrale?', q);
  }
  ab('Hosting und Server-Logfiles', `
<p>Diese Website läuft auf einem Server der ${h(hosting.hoster)} (${h(hosting.standort)}). Mit dem
technischen Betrieb ist ${h(hosting.betrieb.name)}, ${pflicht(hosting.betrieb.anschrift, 'Anschrift des technischen Betreibers', q)}, beauftragt. ${av}</p>
<p>Bei jedem Aufruf speichert der Webserver in Logfiles: IP-Adresse, Datum und Uhrzeit, aufgerufene
Adresse, Statuscode, übertragene Datenmenge, die zuvor besuchte Seite (Referrer) und die Kennung des
Browsers. Das ist nötig, um die Website sicher und stabil zu betreiben und Angriffe abzuwehren
(berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO). Die Logfiles werden nach ${tage} Tagen gelöscht.</p>
<p>Zum Schutz vor Angriffen werten wir die Logfiles automatisch mit der Software CrowdSec aus und
sperren IP-Adressen, die auffällige Anfragen senden, für begrenzte Zeit.${crowdsec}</p>`);

  for (const id of gewaehlt) ab(BAUSTEINE[id].titel, BAUSTEINE[id].text({ h, b, cfg, email }));
  for (const e of cfg.eigene_abschnitte ?? []) ab(e.titel, `<p>${zeilen(e.text)}</p>`);

  const behoerde = land === 'AT' ? DSB_AT : pflicht(cfg.aufsichtsbehoerde, 'zuständige Datenschutz-Aufsichtsbehörde (Bundesland)');
  ab('Ihre Rechte', `
<p>Sie haben das Recht auf Auskunft über Ihre bei uns gespeicherten Daten, auf Berichtigung, Löschung
und Einschränkung der Verarbeitung, auf Datenübertragbarkeit und auf Widerspruch gegen die
Verarbeitung (Art. 15 bis 21 DSGVO). Schreiben Sie dazu an ${email}.</p>
<p>Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren. Zuständig ist:
${behoerde}</p>`);

  if (!leer(cfg.stand)) abschnitte.push(`<p>Stand: ${h(cfg.stand)}</p>`);
  return abschnitte.join('\n');
}

// ---------- Ausgabe ----------
const STANDARD_LAYOUT = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{titel}}</title>
<meta name="robots" content="noindex">
<style>
body{margin:0;font:1.0625rem/1.65 system-ui,sans-serif;color:#1b1b1b;background:#fff}
main{max-width:44rem;margin:0 auto;padding:2.5rem 1.25rem 4rem}
h1{line-height:1.2}h2{font-size:1.25rem;margin-top:2rem}a{color:#0b4f9c}
mark.legal-fehlt{background:#ffe08a;color:#1b1b1b;padding:0 .2em}
nav{max-width:44rem;margin:0 auto;padding:1rem 1.25rem 0}
</style>
</head>
<body>
<nav><a href="./">Startseite</a> · <a href="impressum.html">Impressum</a> · <a href="datenschutz.html">Datenschutz</a></nav>
<main>
<h1>{{titel}}</h1>
{{inhalt}}
</main>
</body>
</html>
`;

const layoutDatei = join(projekt, 'legal-layout.html');
const layout = existsSync(layoutDatei) ? readFileSync(layoutDatei, 'utf8') : STANDARD_LAYOUT;
if (!layout.includes('{{inhalt}}')) abbruch('legal-layout.html braucht den Platzhalter {{inhalt}}');

const ausgabe = join(projekt, cfg.ausgabe ?? 'public');
mkdirSync(ausgabe, { recursive: true });
const seiten = { 'impressum.html': ['Impressum', impressum()], 'datenschutz.html': ['Datenschutzerklärung', datenschutz()] };
for (const [datei, [titel, inhalt]] of Object.entries(seiten)) {
  const html = layout.replaceAll('{{titel}}', h(titel)).replace('{{inhalt}}', () => inhalt);
  writeFileSync(join(ausgabe, datei), html);
}

const status = {
  vollstaendig: fehlend.length === 0,
  fehlend,
  hosts: [...new Set(gewaehlt.flatMap((id) => BAUSTEINE[id].hosts ?? []))],
  cookies: [...new Set(gewaehlt.flatMap((id) => BAUSTEINE[id].cookies ?? []))],
  seiten: Object.keys(seiten),
  layout: existsSync(layoutDatei) ? 'legal-layout.html' : 'Standard',
};
if (statusFile) writeFileSync(statusFile, JSON.stringify(status, null, 2));
console.log(`legal: ${Object.keys(seiten).join(', ')} in ${cfg.ausgabe ?? 'public'}/ geschrieben (Layout: ${status.layout})`);
if (fehlend.length) console.log(`legal: ${fehlend.length} Angabe(n) fehlen:\n  - ${fehlend.join('\n  - ')}`);
