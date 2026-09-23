import { Link } from 'react-router-dom';

export const NotFoundPage = () => (
  <div className="centered-page">
    <h1>404</h1>
    <p>A pagina que voce procurou nao existe.</p>
    <Link to="/" className="button button-primary">
      Voltar ao painel
    </Link>
  </div>
);
