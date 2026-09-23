import { Link } from 'react-router-dom';

export const ForbiddenPage = () => (
  <div className="centered-page">
    <h1>Sem permissao</h1>
    <p>Seu perfil de acesso nao permite abrir esta tela.</p>
    <Link to="/" className="button button-primary">
      Voltar ao painel
    </Link>
  </div>
);
