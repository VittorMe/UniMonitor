import { config as loadDotenv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// O Prisma 7 nao carrega o .env sozinho; sem isto os comandos de CLI
// rodariam sem DATABASE_URL.
loadDotenv();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
    // O usuario do banco nao tem permissao para criar databases, entao o
    // `migrate dev` nao consegue montar o shadow database. Aponte esta
    // variavel para um banco vazio de uso exclusivo para habilita-lo.
    ...(process.env['SHADOW_DATABASE_URL']
      ? { shadowDatabaseUrl: env('SHADOW_DATABASE_URL') }
      : {}),
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
