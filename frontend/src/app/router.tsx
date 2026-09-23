import { Navigate, Route, Routes } from 'react-router-dom';

import { LoginPage } from '@/features/auth/LoginPage';
import { ProfilePage } from '@/features/auth/ProfilePage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { UsersPage } from '@/features/users/UsersPage';
import {
  CoursesPage,
  DashboardPage,
  ProfessorSubjectPage,
  ProfessorsPage,
  RoomsPage,
  StudentsAdminPage,
  SubjectsPage,
} from '@/pages/DashboardPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { AvailabilityPage, NewSessionPage, SessionDetailPage } from '@/pages/MonitorPages';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AgendaPage, AttendancePage, FindSessionsPage } from '@/pages/StudentPages';
import { MonitorReviewsPage } from '@/pages/ReviewsPages';
import { AppLayout } from '@/shared/components/AppLayout';

export const AppRouter = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/cadastro" element={<RegisterPage />} />
    <Route path="/sem-permissao" element={<ForbiddenPage />} />

    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="cursos" element={<CoursesPage />} />
          <Route path="disciplinas" element={<SubjectsPage />} />
          <Route path="salas" element={<RoomsPage />} />
          <Route path="professores" element={<ProfessorsPage />} />
          <Route path="alunos" element={<StudentsAdminPage />} />
          <Route path="usuarios" element={<UsersPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['PROFESSOR']} />}>
          <Route path="professor/disciplinas/:id" element={<ProfessorSubjectPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['MONITOR']} />}>
          <Route path="sessoes/nova" element={<NewSessionPage />} />
          <Route path="sessoes/:id" element={<SessionDetailPage />} />
          <Route path="disponibilidade" element={<AvailabilityPage />} />
          <Route path="feedback" element={<MonitorReviewsPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['STUDENT', 'MONITOR']} />}>
          <Route path="monitorias" element={<FindSessionsPage />} />
          <Route path="agenda" element={<AgendaPage />} />
          <Route path="presenca" element={<AttendancePage />} />
        </Route>
      </Route>
    </Route>

    <Route path="/404" element={<NotFoundPage />} />
    <Route path="*" element={<Navigate to="/404" replace />} />
  </Routes>
);
