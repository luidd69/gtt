Voglio che esegui un audit di debug totale su questa applicazione Vite come farebbe un QA senior incaricato di trovare tutto ciò che può rompersi prima che l’app vada in produzione.

Non limitarti a leggere il codice:
- avvia il progetto
- usa davvero l’app
- prova tutte le funzionalità
- testa anche casi limite e errori intenzionali
- controlla console, rete, build e comportamento responsive
- individua bug logici, bug UI, errori di stato, problemi di validazione, error handling mancante, regressioni e incoerenze funzionali

Per ogni problema trovato:
- spiega come riprodurlo
- spiega perché accade
- classifica severità e impatto
- proponi fix concreto
- applica il fix se possibile
- ritesta dopo la correzione

Non fidarti del codice.
Non dare per scontato che una funzione “esista” solo perché c’è nell’interfaccia.
Verifica davvero che tutto funzioni.
Cerca attivamente di rompere i flussi.

Alla fine produci:
1. report completo bug
2. elenco fix applicati
3. problemi residui
4. suggerimenti per test automatici mancanti
5. valutazione finale di affidabilità dell’app
