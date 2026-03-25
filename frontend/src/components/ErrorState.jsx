export default function ErrorState({ message, onRetry }) {
  return (
    <div className="empty-state" role="alert">
      <div className="empty-state-icon">⚠️</div>
      <p className="empty-state-title">Si è verificato un errore</p>
      <p className="empty-state-msg">
        {message || 'Impossibile caricare i dati. Controlla la connessione.'}
      </p>
      {onRetry && (
        <button className="btn btn-primary btn-sm" onClick={onRetry}>
          Riprova
        </button>
      )}
    </div>
  );
}
