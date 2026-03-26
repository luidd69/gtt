Agisci come uno sviluppatore frontend/mobile senior specializzato in applicazioni di trasporto pubblico, geolocalizzazione, mappe interattive e UX per smartphone.

Obiettivo: migliorare in modo sostanziale la funzionalità di ricerca tragitti e la mappa dell’app GTT, rendendo l’esperienza più chiara, leggibile e utile durante l’utilizzo reale su bus e metropolitana.

Requisiti funzionali da implementare
1. Risultati ricerca tragitti più chiari e dettagliati

Quando vengono restituiti i risultati dei percorsi, ogni soluzione deve mostrare in modo esplicito, leggibile e ben distinto:

numero della linea bus, tram o metro
tipologia del mezzo utilizzato (bus, tram, metro)
direzione o capolinea della linea
fermata di salita
fermata di discesa
eventuali cambi tra mezzi
tempo totale del tragitto
tempo di attesa previsto
durata delle singole tratte
tratte a piedi ben separate dalle tratte sui mezzi
eventuali ritardi o informazioni di servizio, se disponibili

La presentazione deve essere visivamente chiara e non ambigua: l’utente deve capire immediatamente su quale mezzo salire, dove salirci e dove scendere.

2. Miglioramento ricerca fermate sulla mappa

Implementare una ricerca fermate direttamente sulla mappa con queste caratteristiche:

campo di ricerca rapido per nome fermata o codice fermata
focus automatico della mappa sulla fermata cercata
evidenziazione visiva chiara della fermata trovata
apertura automatica del marker o pannello informativo della fermata
possibilità di selezionare rapidamente la fermata dai risultati suggeriti
3. Visualizzazione posizione utente sulla mappa

Se la geolocalizzazione è abilitata, mostrare sempre sulla mappa la posizione attuale dell’utente con marker dedicato.

Gestire correttamente tutti i casi:

permesso GPS negato
geolocalizzazione non disponibile
timeout nel recupero posizione
segnale debole o posizione imprecisa
browser o dispositivo non compatibile

In questi casi mostrare messaggi chiari, non tecnici e utili per l’utente.

4. Monitoraggio posizione utente rispetto al veicolo selezionato

Quando l’utente seleziona un veicolo o una fermata e poi sale effettivamente sul mezzo, usare il GPS per mostrare la sua posizione lungo il percorso.

Funzionalità richieste:

evidenziare sulla mappa la posizione dell’utente rispetto al tracciato del mezzo
mostrare l’avanzamento lungo il percorso previsto
aggiornare dinamicamente la posizione durante lo spostamento
associare il movimento dell’utente al tragitto selezionato
tentare il supporto anche per la metro, sapendo che il GPS in sotterranea può essere assente o molto impreciso

Per la metropolitana, prevedere una logica di degrado intelligente:

se il GPS non è affidabile, evitare comportamenti errati
informare l’utente che il tracciamento potrebbe essere limitato in galleria
mantenere comunque disponibile il monitoraggio logico del tragitto, se possibile
5. Avviso di avvicinamento alla destinazione

Se l’utente ha GPS attivo, si trova su un mezzo e ha impostato un itinerario, inviare un avviso quando si sta avvicinando alla fermata di destinazione o di discesa.

Il sistema deve:

rilevare che l’utente è verosimilmente a bordo del mezzo selezionato
stimare l’avvicinamento alla fermata corretta
notificare con anticipo sufficiente che sta per arrivare alla destinazione
gestire anche il caso di fermata intermedia per cambio mezzo
evitare falsi avvisi dovuti a errori GPS o perdita temporanea del segnale
6. Gestione robusta degli errori e dei casi limite

Implementare una gestione completa degli errori, con fallback chiari lato UX e logica applicativa stabile.

Coprire almeno questi scenari:

GPS disattivato o negato
perdita del segnale GPS durante il tragitto
posizione incoerente con il percorso selezionato
utente non realmente a bordo del mezzo scelto
dati del veicolo non aggiornati o non disponibili
fermata non trovata
errore di caricamento mappa
errore nei risultati di routing
problemi specifici della metropolitana dovuti all’assenza di segnale
batteria o aggiornamenti posizione troppo frequenti da ottimizzare
7. Requisiti UX/UI

L’interfaccia deve essere progettata per uso rapido su smartphone, durante spostamenti reali, quindi deve essere:

semplice da leggere al primo colpo
chiara nella distinzione tra linea, mezzo, fermate e cambi
ottimizzata per schermi piccoli
con elementi grandi e selezionabili facilmente
con feedback visivi immediati
con stato chiaro del tracking attivo o non attivo
con messaggi di errore comprensibili e non tecnici
Requisiti tecnici

Progetta e implementa la funzionalità con architettura pulita e modulare.

Considera:

gestione stato itinerario
gestione stato tracking utente
gestione permessi geolocalizzazione
aggiornamento real-time della posizione
sincronizzazione tra tragitto selezionato, veicolo e posizione utente
fallback per GPS assente o instabile
prevenzione di notifiche duplicate o incoerenti
ottimizzazione delle performance e del consumo batteria
Output richiesto

Fornisci:

piano di implementazione
struttura logica delle nuove funzionalità
componenti UI da modificare o aggiungere
flusso utente completo
gestione errori e fallback
eventuale codice o pseudo-codice necessario
proposta UX/UI migliorativa per smartphone