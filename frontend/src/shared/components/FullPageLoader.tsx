export const FullPageLoader = ({ message = 'Carregando...' }: { message?: string }) => (
  <div className="full-page-loader" role="status" aria-live="polite">
    <span className="spinner" aria-hidden="true" />
    <p>{message}</p>
  </div>
);
