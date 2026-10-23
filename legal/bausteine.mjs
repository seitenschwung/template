// Textbausteine für Impressum und Datenschutz. Jede Seite wählt in ihrer legal.json unter
// "bausteine" aus, was sie braucht. Ein Baustein nennt die fremden Hosts (inklusive Subdomains)
// und Cookies (reguläre Ausdrücke als Text), die er mitbringt: Die Pipeline lässt nur diese zu,
// alles andere macht die CI rot.
//
// Neuer externer Dienst = neuer Baustein hier, per PR mit Review des Owners.
// Texte ändern: hier, dann den Tag v1 verschieben und die Seiten neu bauen.

export const BAUSTEINE = {
  'kontakt-mail': {
    titel: 'Kontakt per E-Mail oder Telefon',
    text: ({ email }) => `
<p>Wenn Sie uns per E-Mail oder Telefon kontaktieren, verarbeiten wir Ihre Angaben (z. B. Name,
E-Mail-Adresse, Telefonnummer und den Inhalt Ihrer Nachricht), um Ihre Anfrage zu bearbeiten.
Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, wenn die Anfrage auf einen Vertrag zielt, sonst
unser berechtigtes Interesse an der Beantwortung (Art. 6 Abs. 1 lit. f DSGVO). Wir löschen die
Angaben, sobald die Anfrage erledigt ist und keine gesetzlichen Aufbewahrungspflichten bestehen.</p>
<p>E-Mails an ${email} werden beim E-Mail-Anbieter des Betreibers gespeichert.</p>`,
  },

  'formular-mailto': {
    titel: 'Anfrageformular',
    text: () => `
<p>Das Anfrageformular auf dieser Website speichert und überträgt selbst keine Daten. Beim Absenden
öffnet sich Ihr eigenes E-Mail-Programm mit einer vorbereiteten Nachricht. Erst wenn Sie diese
abschicken, erhalten wir Ihre Angaben. Für die weitere Verarbeitung gilt der Abschnitt „Kontakt per
E-Mail oder Telefon“.</p>`,
  },

  'stripe': {
    titel: 'Zahlungsabwicklung über Stripe',
    hosts: ['stripe.com', 'stripe.network', 'stripecdn.com'],
    cookies: ['^__stripe_'],
    text: () => `
<p>Für Zahlungen leiten wir Sie zur Bezahlseite von Stripe weiter (Stripe Payments Europe, Limited,
1 Grand Canal Street Lower, Grand Canal Dock, Dublin, D02 H210, Irland). Stripe verarbeitet dort Ihre
Zahlungs- und Kontaktdaten (z. B. Name, E-Mail-Adresse, Kartendaten, Rechnungsadresse) sowie
Geräte- und Verbindungsdaten zur Betrugsvorbeugung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO
(Vertragserfüllung) und, für die Betrugsvorbeugung, Art. 6 Abs. 1 lit. f DSGVO.</p>
<p>Stripe kann Daten an Stripe, Inc. in den USA übermitteln. Stripe ist nach dem EU-US Data Privacy
Framework zertifiziert. Wir erhalten von Stripe nur die Angaben, die wir zur Abwicklung der
Bestellung brauchen, keine vollständigen Kartendaten. Details: <a href="https://stripe.com/de/privacy">stripe.com/de/privacy</a>.</p>`,
  },

  'externe-links': {
    titel: 'Links zu anderen Websites',
    text: () => `
<p>Diese Website enthält Links zu Angeboten anderer Anbieter. Erst wenn Sie einen solchen Link
anklicken, baut Ihr Browser eine Verbindung zum jeweiligen Anbieter auf. Für dessen Verarbeitung
ist allein dieser Anbieter verantwortlich.</p>`,
  },
};

// Österreich: zuständig ist immer die Datenschutzbehörde. Deutschland: die Landesbehörde am Sitz
// des Betreibers, deshalb kommt sie aus der legal.json ("aufsichtsbehoerde").
export const DSB_AT = 'Österreichische Datenschutzbehörde, Barichgasse 40–42, 1030 Wien, <a href="https://www.dsb.gv.at">www.dsb.gv.at</a>';
