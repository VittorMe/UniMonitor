export const ROLES = ['ADMIN', 'PROFESSOR', 'MONITOR', 'STUDENT'] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administracao',
  PROFESSOR: 'Professor',
  MONITOR: 'Monitor',
  STUDENT: 'Aluno',
};

/** Aluno com monitoria ativa usa a area de monitor, nao a de aluno. */
export const effectiveUser = (session: SessionResponse): User => {
  const { user, profile } = session;
  if (profile?.monitorId && user.role !== 'ADMIN' && user.role !== 'PROFESSOR') {
    return { ...user, role: 'MONITOR' };
  }
  return user;
};

/** Aceita a sessao nova ou o formato antigo (so o usuario) ainda em cache. */
export const toSessionResponse = (data: unknown): SessionResponse | null => {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (record.user && typeof record.user === 'object' && record.user !== null && 'role' in record.user) {
    return data as SessionResponse;
  }
  if ('role' in record && 'email' in record && 'name' in record) {
    return { user: data as User };
  }
  return null;
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthProfile {
  professorId: string | null;
  studentId: string | null;
  monitorId: string | null;
  registration: string | null;
  courseId: string | null;
}

export interface AcademicPeriod {
  year: number;
  semester: 1 | 2;
  label: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  registration: string;
  courseId: string;
}

export interface SessionResponse {
  user: User;
  profile?: AuthProfile;
  period?: AcademicPeriod;
}
