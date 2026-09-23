import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadDotenv } from 'dotenv';

loadDotenv();

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  throw new Error('Defina DATABASE_URL no .env antes de rodar o seed');
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(databaseUrl) });

const requiredEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Defina ${key} no .env antes de rodar o seed`);
  return value;
};

const hash = (password: string) => bcrypt.hash(password, 12);

const main = async (): Promise<void> => {
  const adminEmail = requiredEnv('SEED_ADMIN_EMAIL', 'admin@unimonitor.local').toLowerCase();
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: requiredEnv('SEED_ADMIN_NAME', 'Administrador'),
      email: adminEmail,
      role: 'ADMIN',
      passwordHash: await hash(requiredEnv('SEED_ADMIN_PASSWORD')),
    },
  });

  const courses = [
    { code: 'DD', name: 'Design Digital' },
    { code: 'EC', name: 'Engenharia de Computação' },
    { code: 'CC', name: 'Ciência da Computação' },
    { code: 'ES', name: 'Engenharia de Software' },
    { code: 'IA', name: 'Inteligência Artificial' },
    { code: 'RC', name: 'Redes de Computadores' },
    { code: 'SI', name: 'Sistemas de Informação' },
  ] as const;

  for (const item of courses) {
    await prisma.course.upsert({
      where: { code: item.code },
      update: { name: item.name, isActive: true },
      create: { name: item.name, code: item.code },
    });
  }

  const allCourses = await prisma.course.findMany({ where: { isActive: true } });
  const course = await prisma.course.findUniqueOrThrow({ where: { code: 'SI' } });

  const linkSharedSubject = async (subjectId: string) => {
    for (const item of allCourses) {
      await prisma.subjectCourse.upsert({
        where: { subjectId_courseId: { subjectId, courseId: item.id } },
        update: {},
        create: { subjectId, courseId: item.id },
      });
    }
  };

  const subject = await prisma.subject.upsert({
    where: { code: 'BD002' },
    update: {},
    create: { name: 'Banco de Dados II', code: 'BD002' },
  });
  await linkSharedSubject(subject.id);

  const web = await prisma.subject.upsert({
    where: { code: 'PW001' },
    update: {},
    create: { name: 'Programacao Web', code: 'PW001' },
  });
  await linkSharedSubject(web.id);

  const room = await prisma.room.findFirst({ where: { name: 'Laboratorio 03' } });
  const lab =
    room ??
    (await prisma.room.create({
      data: { name: 'Laboratorio 03', building: 'Bloco B', floor: '2o andar', capacity: 30 },
    }));

  const professorUser = await prisma.user.upsert({
    where: { email: 'joao@unimonitor.local' },
    update: {},
    create: {
      name: 'Joao Silva',
      email: 'joao@unimonitor.local',
      role: 'PROFESSOR',
      passwordHash: await hash('Prof@123456'),
    },
  });

  const professor = await prisma.professor.upsert({
    where: { userId: professorUser.id },
    update: {},
    create: { userId: professorUser.id, registration: 'PROF2026001' },
  });

  const now = new Date();
  const year = now.getFullYear();
  const semester = now.getMonth() + 1 <= 6 ? 1 : 2;

  await prisma.professorSubject.upsert({
    where: {
      professorId_subjectId_year_semester: {
        professorId: professor.id,
        subjectId: subject.id,
        year,
        semester,
      },
    },
    update: { isActive: true },
    create: { professorId: professor.id, subjectId: subject.id, year, semester },
  });

  const mariaUser = await prisma.user.upsert({
    where: { email: 'maria@unimonitor.local' },
    update: { role: 'MONITOR' },
    create: {
      name: 'Maria Silva',
      email: 'maria@unimonitor.local',
      role: 'MONITOR',
      passwordHash: await hash('Monitor@123456'),
    },
  });

  const mariaStudent = await prisma.student.upsert({
    where: { userId: mariaUser.id },
    update: {},
    create: { userId: mariaUser.id, courseId: course.id, registration: '20241234' },
  });

  const mariaMonitor = await prisma.monitor.upsert({
    where: { userId: mariaUser.id },
    update: { isActive: true },
    create: { userId: mariaUser.id, studentId: mariaStudent.id, isActive: true },
  });

  await prisma.subjectMonitor.upsert({
    where: {
      monitorId_subjectId_year_semester: {
        monitorId: mariaMonitor.id,
        subjectId: subject.id,
        year,
        semester,
      },
    },
    update: { isActive: true, professorId: professor.id },
    create: {
      monitorId: mariaMonitor.id,
      subjectId: subject.id,
      professorId: professor.id,
      year,
      semester,
    },
  });

  await prisma.user.upsert({
    where: { email: 'vittor@unimonitor.local' },
    update: {},
    create: {
      name: 'Vittor Melo',
      email: 'vittor@unimonitor.local',
      role: 'STUDENT',
      passwordHash: await hash('Aluno@123456'),
    },
  });

  const vittor = await prisma.user.findUniqueOrThrow({ where: { email: 'vittor@unimonitor.local' } });
  await prisma.student.upsert({
    where: { userId: vittor.id },
    update: {},
    create: { userId: vittor.id, courseId: course.id, registration: '20240001' },
  });

  console.log(`Admin: ${admin.email}`);
  console.log('Professor: joao@unimonitor.local / Prof@123456');
  console.log('Monitor: maria@unimonitor.local / Monitor@123456');
  console.log('Aluno: vittor@unimonitor.local / Aluno@123456');
  console.log(`Cursos: ${courses.map((item) => item.code).join(', ')}`);
  console.log(`Sala demo: ${lab.name} | Periodo ${year}.${semester}`);
};

await main()
  .catch((error: unknown) => {
    console.error('Falha no seed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
