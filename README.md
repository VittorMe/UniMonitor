# UniMonitor

Aplicação web com backend em Node.js (Express + TypeScript + Prisma/MySQL) e frontend em React (Vite + TypeScript).

O UniMonitor e uma plataforma de monitoria academica: o admin organiza cursos, disciplinas e professores; o professor vincula monitores; o monitor publica sessoes; o aluno encontra vagas, participa e avalia.

## Como rodar

Pré-requisitos: Node.js 22.12+ — validado no **24.19.0 LTS** — e acesso ao MySQL.

```bash
# Backend — http://localhost:3333
cd backend
cp .env.example .env     # preencha DATABASE_URL e os segredos JWT
npm install
npm run prisma:generate
npm run prisma:deploy    # aplica as migrations
npm run db:seed          # cria o administrador inicial
npm run dev

# Frontend — http://localhost:5173
cd frontend
cp .env.example .env
npm install
npm run dev
```

O Vite encaminha `/api` para `http://localhost:3333`, então front e API compartilham a origem em desenvolvimento e os cookies de sessão são first-party.

Contas do seed (periodo letivo atual):

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Admin | admin@unimonitor.local | a definida em `SEED_ADMIN_PASSWORD` |
| Professor | joao@unimonitor.local | Prof@123456 |
| Monitora | maria@unimonitor.local | Monitor@123456 |
| Aluno | vittor@unimonitor.local | Aluno@123456 |

## Arquitetura

A organização é **por módulo de domínio**, não por tipo de arquivo: cada contexto de negócio fica autocontido, e adicionar uma funcionalidade significa criar uma pasta nova em vez de editar dezenas de arquivos espalhados.

```
backend/src/
├─ config/            env validado por Zod, logger
├─ infra/database/    instância única do Prisma
├─ shared/            erros, middlewares, utilitários reusáveis
├─ modules/
│  ├─ auth/           login, cadastro de aluno, refresh, cookies
│  ├─ users/          CRUD de usuarios (admin)
│  ├─ catalog/        cursos, disciplinas, salas
│  ├─ people/         professores, alunos, vinculos e monitores
│  ├─ sessions/       sessoes, conflitos, presenca QR
│  ├─ reviews/        feedback hibrido dos monitores
│  ├─ notifications/  avisos internos
│  └─ dashboard/      indicadores por perfil
├─ docs/              OpenAPI + Swagger UI em /api/docs
├─ routes.ts          registra os módulos sob /api/v1
├─ app.ts             monta o Express (isolado para permitir testes)
└─ server.ts          sobe o HTTP e trata encerramento gracioso

frontend/src/
├─ app/               providers e rotas
├─ features/          auth/, users/ — cada feature com api, tipos e telas
├─ pages/             telas simples sem lógica de domínio
└─ shared/            cliente HTTP, componentes e estilos comuns
```

Dentro de cada módulo do backend as camadas são **rota → controller → service → repository**:

- **controller** só traduz HTTP (ler requisição, devolver status);
- **service** concentra as regras de negócio e não conhece Express;
- **repository** é o único lugar que fala com o Prisma, então trocar o ORM não afeta as regras.

Para criar um módulo novo: crie `modules/<nome>/` com esses arquivos, exporte um `Router` e registre-o em `routes.ts`.

### Autenticação

Os tokens nunca chegam ao JavaScript do navegador:

- **access token** — JWT de 15 min, em cookie `httpOnly`, `SameSite=Lax`, `secure` em produção;
- **refresh token** — valor aleatório opaco (não é JWT), guardado no banco apenas como HMAC-SHA256. Sendo opaco, pode ser revogado a qualquer momento, o que um JWT autocontido não permite;
- **rotação** — cada `/auth/refresh` emite um novo refresh token e revoga o anterior;
- **detecção de reuso** — apresentar um refresh token já revogado encerra *todas* as sessões do usuário, limitando o dano de um token roubado;
- **perfis** — `ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`, aplicados por rota com `authorize('ADMIN', ...)`.

Como o estado da sessão não é legível pelo front, o React descobre quem está logado chamando `GET /auth/me`. O interceptor do Axios renova a sessão automaticamente em caso de 401 e unifica chamadas concorrentes numa só, para que requisições paralelas não disparem a detecção de reuso.

### Rotas da API

Todas sob `/api/v1`. Documentacao interativa: **[http://localhost:3333/api/docs](http://localhost:3333/api/docs)** (JSON em `/api/docs.json`).

| Método | Rota | Acesso |
| --- | --- | --- |
| `GET` | `/health` | público |
| `POST` | `/auth/login` | público (limite de 10 tentativas/15 min) |
| `POST` | `/auth/refresh` | cookie de refresh |
| `POST` | `/auth/logout` | público |
| `GET` | `/auth/me` | autenticado |
| `POST` | `/auth/logout-all` | autenticado |
| `PATCH` | `/auth/password` | autenticado |
| `GET` | `/users`, `/users/:id` | `ADMIN`, `MANAGER` |
| `POST`, `PATCH`, `DELETE` | `/users`, `/users/:id` | `ADMIN` |

Erros seguem sempre o mesmo formato, com `details` por campo nos 422:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dados invalidos", "details": [...] } }
```

## Banco de dados e migrations

No Prisma 7 a URL de conexão **não fica mais no `schema.prisma`**. Ela vive em dois lugares:

- `prisma.config.ts` — usada pelo CLI nas migrations e na introspecção;
- o **driver adapter** `@prisma/adapter-mariadb`, passado ao `PrismaClient` em `src/infra/database/prisma.ts`, que é o que a aplicação usa em tempo de execução. Apesar do nome, é o adapter oficial do Prisma para MySQL.

O usuário do banco (`profuser`) **não tem permissão para criar bancos**, e o `prisma migrate dev` precisa criar um *shadow database* para funcionar. Por isso o fluxo padrão aqui é gerar o SQL e aplicá-lo:

```bash
cd backend
# 1. gere o SQL comparando o banco atual com o schema
npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

# 2. salve o resultado em prisma/migrations/<AAAAMMDDHHMMSS>_descricao/migration.sql
#    ATENÇÃO: salve em UTF-8 sem BOM — o BOM quebra o parser do MySQL

# 3. aplique e registre no histórico
npx prisma migrate deploy
```

Para habilitar o `prisma migrate dev`, crie um banco vazio de uso exclusivo e defina `SHADOW_DATABASE_URL` no `.env` — o `prisma.config.ts` já repassa essa variável quando ela existe.

## Segurança

- `.env` está no `.gitignore` e **não deve ser comitado**. Use `.env.example` como referência.
- As credenciais do banco em `backend/.env` foram passadas por chat; convém **trocar a senha** e criar um usuário MySQL restrito ao banco `unimonitor`.
- Troque `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` em produção:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
- Senha do administrador do seed: altere `SEED_ADMIN_PASSWORD` antes de usar em ambiente real.
- Na senha dentro da `DATABASE_URL`, caracteres especiais precisam ser percent-encoded (`@` vira `%40`), senão a URL é interpretada errado.

## Notas de manutenção

**Overrides de versão no backend.** O `npm audit` acusa zero vulnerabilidades, mas isso depende do bloco `overrides` no `package.json`. O motivo mais importante: o `@prisma/adapter-mariadb` fixa `mariadb@3.4.5`, versão que **vaza a senha em texto claro para um atacante na rede mesmo com `ssl: true`** ([GHSA-cqhc-2h57-wpxf](https://github.com/advisories/GHSA-cqhc-2h57-wpxf)). Como o adapter é dependência de execução e o banco fica num IP público, o override para `3.4.7` é obrigatório. Ao atualizar o Prisma, confira se esses overrides ainda são necessários — e não os remova sem rodar `npm audit`.

**Aprovação de scripts de instalação.** O npm 11 não executa scripts de `postinstall` sem autorização explícita, e o Prisma depende deles para posicionar os engines. As permissões estão registradas em `allowScripts` no `package.json`, fixadas por versão; ao subir a versão do Prisma será preciso reaprovar:

```bash
npm approve-scripts prisma @prisma/engines
```

**Pendencias em relacao ao MD.** Redis, Socket.IO, Web Push, Docker e suíte de testes ainda nao foram feitos — o MD os coloca como opcional/sprint de qualidade. O banco continua MySQL (sua conexao), nao PostgreSQL.

## Scripts

| Backend | |
| --- | --- |
| `npm run dev` | API com recarga automática |
| `npm run build` / `npm start` | compila para `dist/` e executa |
| `npm run typecheck` | checagem de tipos |
| `npm run prisma:deploy` | aplica migrations |
| `npm run db:seed` | cria/garante o administrador |
| `npm run prisma:studio` | interface visual do banco |

| Frontend | |
| --- | --- |
| `npm run dev` | Vite com proxy para a API |
| `npm run build` / `npm run preview` | build de produção e pré-visualização |
| `npm run typecheck` | checagem de tipos |
