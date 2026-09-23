const error = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
    },
  },
});

const uuidParam = (name: string, description: string) => ({
  name,
  in: 'path' as const,
  required: true,
  schema: { type: 'string', format: 'uuid' },
  description,
});

const cookieAuth = [{ cookieAuth: [] }, { bearerAuth: [] }];

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'UniMonitor API',
    version: '0.1.0',
    description:
      'API da plataforma de monitoria academica. A autenticacao usa cookies httpOnly ' +
      '(`unimonitor_at` e `unimonitor_rt`). No Swagger, faca login em `POST /auth/login` ' +
      'com "Try it out" — o navegador guarda o cookie e as demais rotas passam a funcionar. ' +
      'Tambem e aceito `Authorization: Bearer <access token>`.\n\n' +
      'Avaliacoes de monitor: o aluno avalia na agenda apos a presenca. ' +
      'A listagem fica so com o professor da disciplina e com o proprio monitor. ' +
      'O autor fica gravado no banco. O professor da disciplina sempre ve o autor. ' +
      'O monitor so ve o nome quando o aluno desmarca o anonimato. Comentario privado fica ' +
      'visivel so para o autor e o professor da disciplina.',
  },
  servers: [{ url: '/api/v1', description: 'API versionada' }],
  tags: [
    { name: 'Saude', description: 'Disponibilidade da API e do banco' },
    { name: 'Autenticacao' },
    { name: 'Usuarios' },
    { name: 'Catalogo' },
    { name: 'Pessoas' },
    { name: 'Sessoes' },
    { name: 'Avaliacoes' },
    { name: 'Notificacoes' },
    { name: 'Paineis' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'unimonitor_at',
        description: 'Access token JWT emitido no login',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: {},
            },
          },
        },
      },
      Role: { type: 'string', enum: ['ADMIN', 'PROFESSOR', 'MONITOR', 'STUDENT'] },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { $ref: '#/components/schemas/Role' },
          isActive: { type: 'boolean' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password', 'registration', 'courseId'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8, maxLength: 72 },
          registration: { type: 'string' },
          courseId: { type: 'string', format: 'uuid' },
        },
      },
      CreateReviewRequest: {
        type: 'object',
        required: ['sessionId', 'clarity', 'punctuality', 'mastery'],
        properties: {
          sessionId: { type: 'string', format: 'uuid' },
          clarity: { type: 'integer', minimum: 1, maximum: 5, description: 'Didatica / clareza' },
          punctuality: { type: 'integer', minimum: 1, maximum: 5, description: 'Pontualidade' },
          mastery: { type: 'integer', minimum: 1, maximum: 5, description: 'Dominio do conteudo' },
          comment: { type: 'string', maxLength: 1000 },
          isAnonymous: {
            type: 'boolean',
            default: true,
            description: 'Se true, o monitor e outros alunos nao veem o nome do autor',
          },
          publishComment: {
            type: 'boolean',
            default: true,
            description: 'Se false, o comentario fica so com professor e admin',
          },
        },
      },
      ReviewAuthor: {
        type: 'object',
        properties: {
          studentId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          registration: { type: 'string' },
        },
      },
      Review: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          monitorId: { type: 'string', format: 'uuid' },
          sessionId: { type: 'string', format: 'uuid' },
          sessionTitle: { type: 'string' },
          subject: { type: 'string' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          clarity: { type: 'integer', minimum: 1, maximum: 5 },
          punctuality: { type: 'integer', minimum: 1, maximum: 5 },
          mastery: { type: 'integer', minimum: 1, maximum: 5 },
          comment: { type: 'string', nullable: true },
          commentHidden: { type: 'boolean' },
          isAnonymous: { type: 'boolean' },
          publishComment: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          author: { allOf: [{ $ref: '#/components/schemas/ReviewAuthor' }], nullable: true },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          perPage: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Saude'],
        summary: 'Checagem da API e do MySQL',
        security: [],
        responses: { 200: { description: 'API e banco acessiveis' } },
      },
    },
    '/public/courses': {
      get: {
        tags: ['Catalogo'],
        summary: 'Cursos ativos (cadastro publico)',
        security: [],
        responses: { 200: { description: 'Lista de cursos' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Autenticacao'],
        summary: 'Login (grava cookies httpOnly)',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: { description: 'Sessao iniciada; cookies `unimonitor_at` e `unimonitor_rt`' },
          401: error('Credenciais invalidas'),
          429: error('Muitas tentativas'),
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Autenticacao'],
        summary: 'Cadastro de aluno',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
        },
        responses: {
          201: { description: 'Aluno criado e autenticado' },
          409: error('E-mail ou matricula ja cadastrados'),
          422: error('Dados invalidos'),
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Autenticacao'],
        summary: 'Renova o access token (rotaciona o refresh)',
        security: [],
        responses: {
          204: { description: 'Cookies renovados' },
          401: error('Refresh invalido ou reutilizado'),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Autenticacao'],
        summary: 'Encerra a sessao atual',
        security: [],
        responses: { 204: { description: 'Cookies limpos' } },
      },
    },
    '/auth/logout-all': {
      post: {
        tags: ['Autenticacao'],
        summary: 'Revoga todos os refresh tokens do usuario',
        security: cookieAuth,
        responses: { 204: { description: 'Sessoes encerradas' }, 401: error('Nao autenticado') },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Autenticacao'],
        summary: 'Usuario autenticado',
        security: cookieAuth,
        responses: {
          200: {
            description: 'Perfil atual',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          401: error('Nao autenticado'),
        },
      },
      patch: {
        tags: ['Autenticacao'],
        summary: 'Atualiza nome, e-mail, matricula e curso do usuario autenticado',
        security: cookieAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  registration: { type: 'string' },
                  courseId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Perfil atualizado; o cookie de acesso e renovado' },
          400: error('Campo nao permitido para este perfil'),
          409: error('E-mail ou matricula ja em uso'),
        },
      },
    },
    '/auth/password': {
      patch: {
        tags: ['Autenticacao'],
        summary: 'Troca de senha',
        security: cookieAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string' },
                  newPassword: { type: 'string', minLength: 8, maxLength: 72 },
                },
              },
            },
          },
        },
        responses: { 204: { description: 'Senha atualizada' }, 401: error('Senha atual incorreta') },
      },
    },
    '/users': {
      get: {
        tags: ['Usuarios'],
        summary: 'Lista usuarios',
        security: cookieAuth,
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'perPage', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'role', in: 'query', schema: { $ref: '#/components/schemas/Role' } },
        ],
        responses: { 200: { description: 'Lista paginada' }, 403: error('Apenas admin') },
      },
      post: {
        tags: ['Usuarios'],
        summary: 'Cria usuario',
        security: cookieAuth,
        responses: { 201: { description: 'Usuario criado' }, 403: error('Apenas admin') },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Usuarios'],
        summary: 'Detalhe do usuario',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID do usuario')],
        responses: { 200: { description: 'Usuario' }, 404: error('Nao encontrado') },
      },
      patch: {
        tags: ['Usuarios'],
        summary: 'Atualiza usuario',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID do usuario')],
        responses: { 200: { description: 'Usuario atualizado' } },
      },
      delete: {
        tags: ['Usuarios'],
        summary: 'Remove usuario',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID do usuario')],
        responses: { 204: { description: 'Removido' } },
      },
    },
    '/catalog/courses': {
      get: {
        tags: ['Catalogo'],
        summary: 'Lista cursos',
        security: cookieAuth,
        responses: { 200: { description: 'Lista paginada' } },
      },
      post: {
        tags: ['Catalogo'],
        summary: 'Cria curso',
        security: cookieAuth,
        responses: { 201: { description: 'Curso criado' }, 403: error('Apenas admin') },
      },
    },
    '/catalog/courses/options': {
      get: {
        tags: ['Catalogo'],
        summary: 'Cursos para selects',
        security: cookieAuth,
        responses: { 200: { description: 'Opcoes' } },
      },
    },
    '/catalog/courses/{id}': {
      patch: {
        tags: ['Catalogo'],
        summary: 'Atualiza curso',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID do curso')],
        responses: { 200: { description: 'Curso atualizado' } },
      },
    },
    '/catalog/subjects': {
      get: {
        tags: ['Catalogo'],
        summary: 'Lista disciplinas, com professores do periodo atual',
        security: cookieAuth,
        responses: { 200: { description: 'Lista paginada' } },
      },
      post: {
        tags: ['Catalogo'],
        summary: 'Cria disciplina',
        security: cookieAuth,
        responses: { 201: { description: 'Disciplina criada' } },
      },
    },
    '/catalog/subjects/options': {
      get: {
        tags: ['Catalogo'],
        summary: 'Disciplinas para selects',
        security: cookieAuth,
        responses: { 200: { description: 'Opcoes' } },
      },
    },
    '/catalog/subjects/{id}': {
      patch: {
        tags: ['Catalogo'],
        summary: 'Ativa, desativa ou atualiza disciplina',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da disciplina')],
        responses: { 200: { description: 'Disciplina atualizada' } },
      },
    },
    '/catalog/rooms': {
      get: {
        tags: ['Catalogo'],
        summary: 'Lista salas',
        security: cookieAuth,
        responses: { 200: { description: 'Lista paginada' } },
      },
      post: {
        tags: ['Catalogo'],
        summary: 'Cria sala',
        security: cookieAuth,
        responses: { 201: { description: 'Sala criada' } },
      },
    },
    '/catalog/rooms/options': {
      get: {
        tags: ['Catalogo'],
        summary: 'Salas para selects',
        security: cookieAuth,
        responses: { 200: { description: 'Opcoes' } },
      },
    },
    '/catalog/rooms/{id}': {
      patch: {
        tags: ['Catalogo'],
        summary: 'Atualiza sala',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da sala')],
        responses: { 200: { description: 'Sala atualizada' } },
      },
    },
    '/admin/professors': {
      get: {
        tags: ['Pessoas'],
        summary: 'Lista professores',
        security: cookieAuth,
        responses: { 200: { description: 'Lista paginada' } },
      },
      post: {
        tags: ['Pessoas'],
        summary: 'Cadastra professor',
        security: cookieAuth,
        responses: { 201: { description: 'Professor criado' } },
      },
    },
    '/admin/professors/{id}': {
      patch: {
        tags: ['Pessoas'],
        summary: 'Atualiza professor',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID do professor')],
        responses: { 200: { description: 'Professor atualizado' } },
      },
    },
    '/admin/professors/{id}/subjects': {
      post: {
        tags: ['Pessoas'],
        summary: 'Vincula professor a disciplina no periodo. A mesma disciplina aceita varios professores (turmas).',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID do professor')],
        responses: { 201: { description: 'Vinculo criado' } },
      },
    },
    '/admin/professors/{id}/subjects/{subjectId}': {
      delete: {
        tags: ['Pessoas'],
        summary: 'Retira o professor da disciplina no periodo atual',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID do professor'), uuidParam('subjectId', 'ID da disciplina')],
        responses: { 204: { description: 'Desvinculado' }, 404: error('Vinculo nao encontrado') },
      },
    },
    '/admin/students': {
      get: {
        tags: ['Pessoas'],
        summary: 'Lista alunos',
        security: cookieAuth,
        responses: { 200: { description: 'Lista paginada' } },
      },
      post: {
        tags: ['Pessoas'],
        summary: 'Cadastra aluno',
        security: cookieAuth,
        responses: { 201: { description: 'Aluno criado' } },
      },
    },
    '/professor/subjects': {
      get: {
        tags: ['Pessoas'],
        summary: 'Disciplinas do professor no periodo',
        security: cookieAuth,
        responses: { 200: { description: 'Lista' }, 403: error('Apenas professor') },
      },
    },
    '/professor/students': {
      get: {
        tags: ['Pessoas'],
        summary: 'Busca alunos para promover a monitor',
        security: cookieAuth,
        responses: { 200: { description: 'Lista paginada' } },
      },
    },
    '/professor/subjects/{id}/monitors': {
      get: {
        tags: ['Pessoas'],
        summary: 'Monitores da disciplina',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da disciplina')],
        responses: { 200: { description: 'Lista' } },
      },
      post: {
        tags: ['Pessoas'],
        summary: 'Promove aluno a monitor da disciplina',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da disciplina')],
        responses: { 201: { description: 'Monitor vinculado' } },
      },
    },
    '/professor/subjects/{subjectId}/monitors/{monitorId}': {
      delete: {
        tags: ['Pessoas'],
        summary: 'Desativa o monitor na disciplina',
        security: cookieAuth,
        parameters: [uuidParam('subjectId', 'ID da disciplina'), uuidParam('monitorId', 'ID do monitor')],
        responses: { 204: { description: 'Desvinculado' } },
      },
    },
    '/monitor/subjects': {
      get: {
        tags: ['Pessoas'],
        summary: 'Disciplinas em que o usuario e monitor',
        security: cookieAuth,
        responses: { 200: { description: 'Lista' } },
      },
    },
    '/monitor/sessions': {
      get: {
        tags: ['Sessoes'],
        summary: 'Sessoes do monitor',
        security: cookieAuth,
        responses: { 200: { description: 'Lista' } },
      },
      post: {
        tags: ['Sessoes'],
        summary: 'Publica sessao',
        security: cookieAuth,
        responses: { 201: { description: 'Sessao criada' }, 409: error('Conflito de horario') },
      },
    },
    '/monitor/sessions/{id}': {
      put: {
        tags: ['Sessoes'],
        summary: 'Atualiza sessao',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da sessao')],
        responses: { 200: { description: 'Sessao atualizada' } },
      },
    },
    '/monitor/sessions/{id}/cancel': {
      patch: {
        tags: ['Sessoes'],
        summary: 'Cancela sessao',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da sessao')],
        responses: { 204: { description: 'Cancelada' } },
      },
    },
    '/monitor/sessions/{id}/start': {
      post: {
        tags: ['Sessoes'],
        summary: 'Inicia atendimento e emite token/QR de presenca',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da sessao')],
        responses: { 200: { description: 'Token temporario (cerca de 5 minutos)' } },
      },
    },
    '/monitor/sessions/{id}/complete': {
      post: {
        tags: ['Sessoes'],
        summary: 'Encerra o atendimento',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da sessao')],
        responses: { 204: { description: 'Encerrada' } },
      },
    },
    '/monitor/sessions/{id}/participants': {
      get: {
        tags: ['Sessoes'],
        summary: 'Participantes da sessao',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da sessao')],
        responses: { 200: { description: 'Lista' } },
      },
    },
    '/monitor/participants/{id}/accept': {
      patch: {
        tags: ['Sessoes'],
        summary: 'Aceita pedido de vaga (aula individual)',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da participacao')],
        responses: { 200: { description: 'Confirmado' } },
      },
    },
    '/monitor/participants/{id}/reject': {
      patch: {
        tags: ['Sessoes'],
        summary: 'Recusa pedido de vaga',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da participacao')],
        responses: { 200: { description: 'Recusado' } },
      },
    },
    '/monitor/availability': {
      get: {
        tags: ['Sessoes'],
        summary: 'Horarios recorrentes do monitor',
        security: cookieAuth,
        responses: { 200: { description: 'Lista' } },
      },
      post: {
        tags: ['Sessoes'],
        summary: 'Cria horario recorrente',
        security: cookieAuth,
        responses: { 201: { description: 'Disponibilidade criada' } },
      },
    },
    '/monitor/availability/{id}': {
      put: {
        tags: ['Sessoes'],
        summary: 'Atualiza horario recorrente',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da disponibilidade')],
        responses: { 200: { description: 'Atualizada' } },
      },
    },
    '/monitor/availability/{id}/generate': {
      post: {
        tags: ['Sessoes'],
        summary: 'Gera sessoes a partir do horario recorrente',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da disponibilidade')],
        responses: { 201: { description: 'Sessoes geradas' } },
      },
    },
    '/student/subjects': {
      get: {
        tags: ['Sessoes'],
        summary: 'Disciplinas ativas para busca',
        security: cookieAuth,
        responses: { 200: { description: 'Lista' } },
      },
    },
    '/student/sessions': {
      get: {
        tags: ['Sessoes'],
        summary: 'Busca monitorias com pontuacao de compatibilidade',
        security: cookieAuth,
        parameters: [
          { name: 'subjectId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'date', in: 'query', schema: { type: 'string' } },
          { name: 'modality', in: 'query', schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'topic', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Sessoes ranqueadas' } },
      },
    },
    '/student/sessions/{id}': {
      get: {
        tags: ['Sessoes'],
        summary: 'Detalhe da sessao',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da sessao')],
        responses: { 200: { description: 'Sessao' } },
      },
    },
    '/student/sessions/{id}/join': {
      post: {
        tags: ['Sessoes'],
        summary: 'Solicita vaga',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da sessao')],
        responses: { 201: { description: 'Pedido criado' }, 409: error('Sem vaga ou ja inscrito') },
      },
    },
    '/student/sessions/{id}/leave': {
      delete: {
        tags: ['Sessoes'],
        summary: 'Cancela participacao',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da sessao')],
        responses: { 204: { description: 'Cancelada' } },
      },
    },
    '/student/sessions/{id}/attend': {
      post: {
        tags: ['Sessoes'],
        summary: 'Confirma presenca com o token do QR',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da sessao')],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token'],
                properties: { token: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Presenca registrada' } },
      },
    },
    '/student/appointments': {
      get: {
        tags: ['Sessoes'],
        summary: 'Agenda do aluno (inclui avaliacao ja enviada)',
        security: cookieAuth,
        responses: { 200: { description: 'Participacoes' } },
      },
    },
    '/student/reviews': {
      post: {
        tags: ['Avaliacoes'],
        summary: 'Avalia o monitor apos presenca confirmada',
        description:
          'A nota geral e a media arredondada de clareza, pontualidade e dominio. ' +
          'Uma avaliacao por sessao. So quem esteve presente (`ATTENDED`) pode avaliar.',
        security: cookieAuth,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateReviewRequest' } } },
        },
        responses: {
          201: {
            description: 'Avaliacao criada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { review: { $ref: '#/components/schemas/Review' } },
                },
              },
            },
          },
          403: error('Sem presenca na sessao'),
          409: error('Ja avaliou esta sessao'),
          422: error('Dados invalidos'),
        },
      },
    },
    '/monitor/reviews': {
      get: {
        tags: ['Avaliacoes'],
        summary: 'Avaliacoes recebidas pelo monitor autenticado',
        description: 'O nome do aluno so aparece se ele tiver desmarcado o anonimato.',
        security: cookieAuth,
        responses: {
          200: {
            description: 'Lista',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Review' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/professor/subjects/{id}/reviews': {
      get: {
        tags: ['Avaliacoes'],
        summary: 'Avaliacoes da disciplina no periodo (professor ve o autor)',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da disciplina')],
        responses: { 200: { description: 'Lista com autor' }, 403: error('Disciplina de outro professor') },
      },
    },
    '/notifications': {
      get: {
        tags: ['Notificacoes'],
        summary: 'Notificacoes do usuario',
        security: cookieAuth,
        responses: { 200: { description: 'Lista e contagem de nao lidas' } },
      },
    },
    '/notifications/read-all': {
      patch: {
        tags: ['Notificacoes'],
        summary: 'Marca todas como lidas',
        security: cookieAuth,
        responses: { 204: { description: 'Atualizado' } },
      },
    },
    '/notifications/{id}/read': {
      patch: {
        tags: ['Notificacoes'],
        summary: 'Marca uma notificacao como lida',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da notificacao')],
        responses: { 204: { description: 'Atualizado' } },
      },
    },
    '/admin/dashboard': {
      get: {
        tags: ['Paineis'],
        summary: 'Indicadores gerais',
        security: cookieAuth,
        responses: { 200: { description: 'Metricas administrativas' } },
      },
    },
    '/professor/subjects/{id}/statistics': {
      get: {
        tags: ['Paineis'],
        summary: 'Indicadores da disciplina',
        security: cookieAuth,
        parameters: [uuidParam('id', 'ID da disciplina')],
        responses: { 200: { description: 'Metricas' } },
      },
    },
    '/monitor/statistics': {
      get: {
        tags: ['Paineis'],
        summary: 'Indicadores do monitor',
        security: cookieAuth,
        responses: { 200: { description: 'Metricas' } },
      },
    },
  },
};
