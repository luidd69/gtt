# Prompt per Sonnet 4.6 — Redesign grafico Flutter app orari pullman

Agisci come un **senior mobile product designer + senior Flutter UI engineer** specializzato in redesign di applicazioni di trasporto pubblico.

## Obiettivo
Devi **riprogettare graficamente una applicazione Flutter già esistente** in modo che adotti la stessa impostazione visiva, gerarchia e stile del design di riferimento descritto sotto.

**Attenzione:**
- l’app **esiste già**
- il tuo compito è fare un **redesign UI**
- **non devi inventare nuove funzionalità backend o logiche applicative che nel codice non esistono**
- se una funzione mostrata nel design di riferimento **non è presente nel codice reale**, **non implementarla**
- in quel caso devi solo:
  - mantenere la struttura della schermata coerente
  - valorizzare meglio ciò che già esiste
  - riadattare layout e componenti senza introdurre feature false

## Regola fondamentale
Devi seguire questo principio in tutto il lavoro:

> **Replica il linguaggio visivo, non forzare funzionalità inesistenti.**

Quindi:
- **sì** a stile, palette, spaziature, card, gerarchie, navigazione, componenti UI coerenti
- **no** a bottoni, tab, mappe live, tracking, notifiche, filtri o stati che richiedono dati o logiche non presenti nel progetto reale

---

# Design target da seguire

L’app deve avere una impostazione grafica **mobile-first**, moderna, pulita e molto leggibile, ispirata a una app trasporti premium.

## Direzione estetica
Usa questi principi visivi:

- stile moderno e professionale
- UI pulita, senza elementi decorativi inutili
- forte enfasi sulla leggibilità operativa
- estetica da app di mobilità reale, non concept astratto
- interfaccia chiara anche in utilizzo rapido, all’aperto, in movimento

## Sensazione complessiva
L’interfaccia deve trasmettere:

- rapidità
- chiarezza
- affidabilità
- controllo visivo immediato
- focus su linee, fermate, tempi di arrivo, direzioni e percorso

---

# Linee guida visuali

## Palette
Impostare una palette simile a questa:

- **sfondo principale**: grigi molto chiari / slate chiaro
- **superfici card**: bianco pieno
- **header e blocchi forti**: blu intenso / slate scuro
- **accent color**: blu acceso / ciano
- **stati positivi o ETA**: verde/emerald
- **warning discreti**: amber molto chiaro
- **testi secondari**: grigio medio
- **testi principali**: slate molto scuro

Non usare colori casuali.  
La palette deve essere coerente e aziendale.

## Tipografia
Deve essere estremamente leggibile:

- gerarchia molto netta tra titolo, sottotitolo, label, metadati
- titoli schermata chiari e compatti
- tempi di arrivo evidenziati con peso forte
- informazioni secondarie più leggere e discrete
- evitare testo troppo piccolo dove l’utente deve prendere decisioni rapide

## Forme
Usare:

- card con bordi arrotondati generosi
- pulsanti e pill con angoli morbidi
- contenitori moderni, puliti, coerenti
- shadow leggere, non invasive
- bordi sottili solo dove servono a separare bene

## Spaziatura
La UI deve respirare:

- padding generoso
- sezioni ben separate
- niente schermate dense e schiacciate
- allineamenti rigorosi
- griglia coerente su tutte le pagine

---

# Architettura visuale da rispettare

## 1. Home
La home deve avere una impostazione simile a questa:

### blocco alto forte
Un hero/header iniziale con:
- titolo schermata
- eventuale sottotitolo breve
- eventuale search box o call to action primaria già esistente nell’app
- forte identità visiva con gradiente o superficie colorata coerente

### contenuti principali in card
Subito sotto:
- arrivi imminenti / risultati principali / elementi più utili
- card pulite e leggibili
- ogni riga deve evidenziare chiaramente:
  - linea
  - destinazione
  - fermata o contesto
  - ETA / stato / orario se disponibile

### blocchi secondari
Più sotto:
- sezioni compatte tipo preferiti, linea monitorata, scorciatoie o elementi già presenti nel codice
- se non esistono, non inventarli

## 2. Ricerca / elenco fermate / elenco risultati
Se nell’app esiste una schermata di ricerca, lista fermate o risultati:
- rendila ordinata, chiara, filtrabile solo se i filtri esistono già
- barra ricerca ben visibile
- risultati in card o list item moderni
- distanza, stato live, linee servite o altre info devono essere visualmente separate bene
- usare badge/pill per linee o stato dove utile

## 3. Dettaglio linea o dettaglio fermata
Se nel codice esiste una schermata dettaglio:
- usare un header forte con numero linea o nome fermata
- evidenziare stato, direzione o metadati principali
- sequenza fermate o informazioni di dettaglio con timeline/lista ordinata
- fermata corrente o stato attivo ben distinto cromaticamente
- usare divisori delicati e gerarchia netta

## 4. Mappa
Se la mappa esiste già nel progetto:
- integrarla in modo visivamente coerente con il resto dell’app
- contenitore pulito, eventuale card superiore o inferiore per info contestuali
- non appesantire la schermata
- non aggiungere logiche live se non già disponibili

Se **la mappa non esiste**, non crearla.

## 5. Percorso / itinerario
Se l’app ha una sezione percorso o step viaggio:
- presentare ogni step in blocchi chiari
- distinguere visivamente camminata, bus, metro o altro solo se quei dati esistono
- evidenziare durata totale e informazioni principali in un blocco hero superiore
- warning o alert solo se supportati dai dati reali

## 6. Preferiti / salvati
Se esistono preferiti, recenti o elementi salvati:
- trasformarli in card o moduli visivamente ordinati
- rendere chiaro cosa è fermata, linea o percorso
- usare layout compatto ma elegante

---

# Bottom navigation e struttura schermate
Se l’app usa già una bottom navigation:
- ridisegnarla in stile moderno, pulito, con item ben leggibili
- item attivo con evidenza cromatica chiara ma non aggressiva
- spaziatura comoda
- icone coerenti

Se l’app non usa bottom navigation:
- non aggiungerla solo perché è presente nel concept

---

# Comportamento richiesto sul codice esistente

## Analisi iniziale obbligatoria
Prima di modificare il codice:
1. analizza la struttura attuale dell’app Flutter
2. identifica:
   - schermate esistenti
   - widget principali
   - componenti riutilizzabili
   - tema attuale
   - navigazione attuale
   - feature realmente presenti
3. fai una mappatura tra:
   - **schermate reali dell’app**
   - **schermate del design target**
4. applica il redesign **solo dove ha senso**

## Regola di compatibilità
Se trovi differenze tra concept e app reale:
- **vincono sempre le feature reali**
- il design va adattato alla realtà del codice
- mai rompere la UX esistente per inseguire il mockup

## Non fare queste cose
- non aggiungere API
- non cambiare backend
- non creare provider, bloc, cubit o servizi inutili solo per fingere feature
- non aggiungere dati mock in produzione
- non creare schermate vuote senza senso
- non rompere routing, stato o logica esistente
- non eliminare feature esistenti solo perché “stanno male” nel nuovo design

---

# Obiettivi concreti del redesign
Devi ottenere questi risultati:

1. **coerenza grafica totale**
2. **gerarchia visiva più forte**
3. **leggibilità superiore**
4. **aspetto moderno e premium**
5. **migliore percezione di ordine e qualità**
6. **riuso di componenti stilistici comuni**
7. **riduzione del look amatoriale o incoerente**
8. **uniformità tra tutte le schermate esistenti**

---

# Implementazione Flutter richiesta

## Theme system
Dove possibile:
- centralizza colori
- centralizza text styles
- centralizza radius
- centralizza spacing
- centralizza componenti riutilizzabili

Preferire:
- `ThemeData`
- costanti tema
- componenti base riutilizzabili
- widget puliti e modulari

## Componenti consigliati
Usa e uniforma, dove utile:
- custom app bar
- search field stilizzato
- section header
- transit info card
- line badge
- eta badge
- stop card
- favorite card
- empty state puliti
- loading state coerenti

Ovviamente **solo dove coerente con le schermate già presenti**.

## Material design
Puoi usare Material 3 se aiuta a rendere l’app più moderna, ma:
- evita look generico da template standard
- personalizza bene tema, card, pulsanti e input

---

# Stati UI da trattare
Se nel progetto esistono questi stati, migliorali graficamente:

- loading
- empty state
- errore
- nessun risultato
- GPS non disponibile
- dati non aggiornati
- contenuti offline

Se questi stati non esistono già, non inventare una logica nuova pesante.  
Al massimo migliora la resa visiva di quelli presenti.

---

# Output richiesto
Lavora direttamente sul progetto e produci:

1. redesign coerente delle schermate esistenti
2. refactor del tema UI
3. componenti riutilizzabili dove opportuno
4. mantenimento integrale della logica esistente
5. codice pulito e leggibile

Alla fine fornisci:

## A. Sintesi iniziale
- schermate trovate
- schermate ridisegnate
- feature esistenti mantenute
- elementi del concept adattati
- elementi del concept scartati perché non presenti nel codice

## B. Modifiche effettuate
Elenco preciso di:
- file modificati
- nuovi widget creati
- cambiamenti al tema
- eventuali scelte di mapping tra concept e realtà

## C. Verifica finale
Conferma che:
- il redesign non ha introdotto feature fake
- il progetto compila
- le schermate principali sono coerenti tra loro
- la navigazione esistente continua a funzionare

---

# Criterio decisionale finale
Quando sei indeciso tra:
- fedeltà al concept
- fedeltà al codice reale

scegli sempre:

> **fedeltà al codice reale + resa visiva più forte possibile**

---

# Istruzione finale operativa
Adesso analizza il progetto Flutter esistente e applica un redesign completo delle schermate reali basandoti sullo stile descritto sopra.

Ripeti:  
- **mantieni tutte le funzionalità esistenti**
- **non aggiungere funzionalità non presenti**
- **adatta il design target alla realtà del codice**
- **rendi l’app visivamente moderna, coerente, premium e molto leggibile**
