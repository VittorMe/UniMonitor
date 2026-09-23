import type { Role } from '@prisma/client';

import { prisma } from '../../infra/database/prisma.js';
import { usersRepository } from '../users/users.repository.js';

/**
 * O papel efetivo segue o vinculo academico: aluno com monitoria ativa
 * entra como MONITOR mesmo se `users.role` ainda estiver como STUDENT.
 * Admin e professor nao sao rebaixados.
 */
export const resolveEffectiveRole = async (user: { id: string; role: Role }): Promise<Role> => {
  if (user.role === 'ADMIN' || user.role === 'PROFESSOR') {
    return user.role;
  }

  const monitor = await prisma.monitor.findUnique({ where: { userId: user.id } });
  if (!monitor?.isActive) {
    return user.role;
  }

  if (user.role !== 'MONITOR') {
    await usersRepository.update(user.id, { role: 'MONITOR' });
  }

  return 'MONITOR';
};
