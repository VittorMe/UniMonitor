import { httpClient } from '@/shared/api/http-client';

export interface Paginated<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

export interface Course {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  courses?: Course[];
  professors?: Array<{ id: string; name: string }>;
}

export interface Room {
  id: string;
  name: string;
  building: string;
  floor: string;
  capacity: number;
  isActive: boolean;
}

export interface Professor {
  id: string;
  registration: string;
  user: { id: string; name: string; email: string; role: string; isActive: boolean };
  period?: { year: number; semester: number; label: string };
  subjectLinks?: Array<{
    id: string;
    subjectId: string;
    subject: { id: string; name: string; code: string };
  }>;
}

export interface Student {
  id: string;
  registration: string;
  courseId: string;
  user: { id?: string; name: string; email?: string; isActive: boolean };
  course?: Course;
  monitor?: { id: string } | null;
}

export type SessionType = 'PRIVATE' | 'GROUP' | 'OFFICE_HOURS' | 'STUDY_GROUP';
export type SessionModality = 'PRESENTIAL' | 'ONLINE' | 'HYBRID';
export type SessionStatus = 'DRAFT' | 'PUBLISHED' | 'FULL' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export const TYPE_LABELS: Record<SessionType, string> = {
  PRIVATE: 'Individual',
  GROUP: 'Grupo',
  OFFICE_HOURS: 'Plantao',
  STUDY_GROUP: 'Grupo de estudos',
};

export const MODALITY_LABELS: Record<SessionModality, string> = {
  PRESENTIAL: 'Presencial',
  ONLINE: 'Online',
  HYBRID: 'Hibrida',
};

export const STATUS_LABELS: Record<SessionStatus, string> = {
  DRAFT: 'Rascunho',
  PUBLISHED: 'Publicada',
  FULL: 'Lotada',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Encerrada',
  CANCELLED: 'Cancelada',
};

export interface MonitoringSession {
  id: string;
  title: string;
  topic?: string | null;
  description?: string | null;
  type: SessionType;
  modality: SessionModality;
  startAt: string;
  endAt: string;
  maxParticipants: number;
  occupied?: number;
  status: SessionStatus;
  meetingUrl?: string | null;
  room?: Room | null;
  averageRating?: number | null;
  compatibility?: number;
  subjectMonitor?: {
    id: string;
    subject: Subject;
    monitor: { id: string; name: string };
  };
  _count?: { participants: number };
}

export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const formatCourseCodes = (courses?: Course[]) =>
  courses?.length ? courses.map((course) => course.code).join(', ') : '—';

export const catalogApi = {
  publicCourses: async () => {
    const { data } = await httpClient.get<{ data: Course[] }>('/public/courses');
    return data.data;
  },
  courses: async (params?: { search?: string }) => {
    const { data } = await httpClient.get<Paginated<Course>>('/catalog/courses', { params });
    return data;
  },
  courseOptions: async () => {
    const { data } = await httpClient.get<{ data: Course[] }>('/catalog/courses/options');
    return data.data;
  },
  createCourse: async (payload: { name: string; code: string }) => {
    const { data } = await httpClient.post<{ course: Course }>('/catalog/courses', payload);
    return data.course;
  },
  subjects: async (params?: { search?: string; courseId?: string; page?: number; perPage?: number }) => {
    const { data } = await httpClient.get<Paginated<Subject>>('/catalog/subjects', { params });
    return data;
  },
  subjectOptions: async () => {
    const { data } = await httpClient.get<{ data: Subject[] }>('/catalog/subjects/options');
    return data.data;
  },
  createSubject: async (payload: { name: string; code: string; courseIds: string[] }) => {
    const { data } = await httpClient.post<{ subject: Subject }>('/catalog/subjects', payload);
    return data.subject;
  },
  updateSubject: async (id: string, payload: { isActive?: boolean; name?: string; code?: string; courseIds?: string[] }) => {
    const { data } = await httpClient.patch<{ subject: Subject }>(`/catalog/subjects/${id}`, payload);
    return data.subject;
  },
  rooms: async () => {
    const { data } = await httpClient.get<Paginated<Room>>('/catalog/rooms');
    return data;
  },
  roomOptions: async () => {
    const { data } = await httpClient.get<{ data: Room[] }>('/catalog/rooms/options');
    return data.data;
  },
  createRoom: async (payload: { name: string; building: string; floor: string; capacity: number }) => {
    const { data } = await httpClient.post<{ room: Room }>('/catalog/rooms', payload);
    return data.room;
  },
};

export const adminApi = {
  dashboard: async () => {
    const { data } = await httpClient.get('/admin/dashboard');
    return data as {
      professors: number;
      students: number;
      subjects: number;
      monitors: number;
      sessionsThisMonth: number;
      attendanceRate: number;
      averageRating: number | null;
      averageClarity: number | null;
      averagePunctuality: number | null;
      averageMastery: number | null;
      bySubject: Array<{ name: string; count: number }>;
    };
  },
  professors: async (params?: { search?: string; perPage?: number }) => {
    const { data } = await httpClient.get<Paginated<Professor>>('/admin/professors', { params });
    return data;
  },
  createProfessor: async (payload: {
    name: string;
    email: string;
    password: string;
    registration: string;
  }) => {
    const { data } = await httpClient.post<{ professor: Professor }>('/admin/professors', payload);
    return data.professor;
  },
  linkSubject: async (professorId: string, subjectId: string) => {
    await httpClient.post(`/admin/professors/${professorId}/subjects`, { subjectId });
  },
  unlinkSubject: async (professorId: string, subjectId: string) => {
    await httpClient.delete(`/admin/professors/${professorId}/subjects/${subjectId}`);
  },
  students: async (params?: { search?: string }) => {
    const { data } = await httpClient.get<Paginated<Student>>('/admin/students', { params });
    return data;
  },
};

export const professorApi = {
  subjects: async () => {
    const { data } = await httpClient.get<{ data: Array<ProfessorSubject> }>('/professor/subjects');
    return data.data;
  },
  students: async (search: string, subjectId?: string) => {
    const { data } = await httpClient.get<Paginated<Student>>('/professor/students', {
      params: { search, perPage: 10, ...(subjectId ? { subjectId } : {}) },
    });
    return data.data;
  },
  monitors: async (subjectId: string) => {
    const { data } = await httpClient.get<{ data: MonitorAssignment[] }>(
      `/professor/subjects/${subjectId}/monitors`,
    );
    return data.data;
  },
  assignMonitor: async (subjectId: string, studentId: string) => {
    await httpClient.post(`/professor/subjects/${subjectId}/monitors`, { studentId });
  },
  unassignMonitor: async (subjectId: string, monitorId: string) => {
    await httpClient.delete(`/professor/subjects/${subjectId}/monitors/${monitorId}`);
  },
  sessions: async (subjectId: string) => {
    const { data } = await httpClient.get<{ data: MonitoringSession[] }>(
      `/professor/subjects/${subjectId}/sessions`,
    );
    return data.data;
  },
  reviews: async (subjectId: string) => {
    const { data } = await httpClient.get<{ data: Review[] }>(`/professor/subjects/${subjectId}/reviews`);
    return data.data;
  },
  statistics: async (subjectId: string) => {
    const { data } = await httpClient.get(`/professor/subjects/${subjectId}/statistics`);
    return data as ProfessorStats;
  },
};

export interface ProfessorSubject {
  id: string;
  subjectId: string;
  monitors: number;
  sessionsThisMonth: number;
  subject: Subject;
}

export interface MonitorAssignment {
  id: string;
  monitorId: string;
  isActive: boolean;
  monitor: {
    id: string;
    user: { name: string; email: string };
    student: { registration: string; course: Course };
  };
}

export interface ProfessorStats {
  monitors: number;
  sessionsThisMonth: number;
  studentsAttended: number;
  averageRating: number | null;
  averageClarity: number | null;
  averagePunctuality: number | null;
  averageMastery: number | null;
  topics: Array<{ topic: string; percent: number }>;
}

export const monitorApi = {
  subjects: async () => {
    const { data } = await httpClient.get<{ data: MonitorSubject[] }>('/monitor/subjects');
    return data.data;
  },
  sessions: async () => {
    const { data } = await httpClient.get<{ data: MonitoringSession[] }>('/monitor/sessions');
    return data.data;
  },
  statistics: async () => {
    const { data } = await httpClient.get('/monitor/statistics');
    return data as {
      sessionsCompleted: number;
      studentsAttended: number;
      averageRating: number | null;
      averageClarity: number | null;
      averagePunctuality: number | null;
      averageMastery: number | null;
      attendanceRate: number;
      reviewsCount: number;
    };
  },
  reviews: async () => {
    const { data } = await httpClient.get<{ data: Review[] }>('/monitor/reviews');
    return data.data;
  },
  createSession: async (payload: Record<string, unknown>) => {
    const { data } = await httpClient.post<{ session: MonitoringSession }>('/monitor/sessions', payload);
    return data.session;
  },
  start: async (id: string) => {
    const { data } = await httpClient.post<{ token: string; expiresInSeconds: number }>(
      `/monitor/sessions/${id}/start`,
    );
    return data;
  },
  complete: async (id: string) => {
    await httpClient.post(`/monitor/sessions/${id}/complete`);
  },
  cancel: async (id: string) => {
    await httpClient.patch(`/monitor/sessions/${id}/cancel`);
  },
  participants: async (id: string) => {
    const { data } = await httpClient.get<{ data: SessionParticipant[] }>(`/monitor/sessions/${id}/participants`);
    return data.data;
  },
  accept: async (id: string) => {
    await httpClient.patch(`/monitor/participants/${id}/accept`);
  },
  reject: async (id: string) => {
    await httpClient.patch(`/monitor/participants/${id}/reject`);
  },
  availabilities: async () => {
    const { data } = await httpClient.get<{ data: Availability[] }>('/monitor/availability');
    return data.data;
  },
  createAvailability: async (payload: Record<string, unknown>) => {
    await httpClient.post('/monitor/availability', payload);
  },
  generate: async (id: string, weeks: number) => {
    const { data } = await httpClient.post<{ data: MonitoringSession[] }>(
      `/monitor/availability/${id}/generate`,
      { weeks },
    );
    return data.data;
  },
};

export interface MonitorSubject {
  id: string;
  subject: Subject;
  professor: { user: { name: string } };
}

export interface SessionParticipant {
  id: string;
  status: string;
  student: { user: { name: string; email: string }; registration: string; course: Course };
}

export interface Availability {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  title: string;
  isActive: boolean;
}

export const studentApi = {
  subjects: async () => {
    const { data } = await httpClient.get<{ data: Subject[] }>('/student/subjects');
    return data.data;
  },
  search: async (params: Record<string, string | undefined>) => {
    const { data } = await httpClient.get<{ data: MonitoringSession[] }>('/student/sessions', { params });
    return data.data;
  },
  get: async (id: string) => {
    const { data } = await httpClient.get<{ session: MonitoringSession }>(`/student/sessions/${id}`);
    return data.session;
  },
  join: async (id: string) => {
    await httpClient.post(`/student/sessions/${id}/join`);
  },
  leave: async (id: string) => {
    await httpClient.delete(`/student/sessions/${id}/leave`);
  },
  appointments: async () => {
    const { data } = await httpClient.get<{ data: Appointment[] }>('/student/appointments');
    return data.data;
  },
  attend: async (id: string, token: string) => {
    await httpClient.post(`/student/sessions/${id}/attend`, { token });
  },
  review: async (payload: {
    sessionId: string;
    clarity: number;
    punctuality: number;
    mastery: number;
    comment?: string;
    isAnonymous: boolean;
    publishComment: boolean;
  }) => {
    await httpClient.post('/student/reviews', payload);
  },
};

export interface Appointment {
  id: string;
  status: string;
  session: MonitoringSession;
  review?: AppointmentReview | null;
}

export interface AppointmentReview {
  id: string;
  rating: number;
  clarity: number;
  punctuality: number;
  mastery: number;
  comment?: string | null;
  isAnonymous: boolean;
  publishComment: boolean;
  createdAt: string;
}

export interface ReviewAuthor {
  studentId?: string;
  name: string;
  email?: string;
  registration?: string;
}

export interface Review {
  id: string;
  monitorId: string;
  sessionId: string;
  sessionTitle: string;
  subject: string;
  rating: number;
  clarity: number;
  punctuality: number;
  mastery: number;
  comment: string | null;
  commentHidden: boolean;
  isAnonymous: boolean;
  publishComment: boolean;
  createdAt: string;
  author: ReviewAuthor | null;
}

export const notificationsApi = {
  list: async () => {
    const { data } = await httpClient.get<{
      data: Array<{ id: string; title: string; message: string; readAt: string | null; createdAt: string; link?: string | null }>;
      unread: number;
    }>('/notifications');
    return data;
  },
  read: async (id: string) => {
    await httpClient.patch(`/notifications/${id}/read`);
  },
  readAll: async () => {
    await httpClient.patch('/notifications/read-all');
  },
};
