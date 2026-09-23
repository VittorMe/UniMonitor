import type { RequestHandler } from 'express';

import { requireUser } from '../../shared/http/require-user.js';
import { parsePeriod } from '../../shared/academic-period.js';
import {
  monitorsService,
  professorSubjectsService,
  professorsService,
  studentsService,
} from './people.service.js';
import type {
  AssignMonitorInput,
  CreateProfessorInput,
  CreateStudentInput,
  LinkSubjectInput,
  UpdateProfessorInput,
} from './people.schemas.js';

export const peopleController = {
  listProfessors: (async (req, res) => {
    res.json(await professorsService.list(req.query as never));
  }) as RequestHandler,

  createProfessor: (async (req, res) => {
    res.status(201).json({ professor: await professorsService.create(req.body as CreateProfessorInput) });
  }) as RequestHandler,

  updateProfessor: (async (req, res) => {
    res.json({
      professor: await professorsService.update(
        req.params['id'] as string,
        req.body as UpdateProfessorInput,
      ),
    });
  }) as RequestHandler,

  linkSubject: (async (req, res) => {
    res.status(201).json({
      link: await professorsService.linkSubject(req.params['id'] as string, req.body as LinkSubjectInput),
    });
  }) as RequestHandler,

  unlinkSubject: (async (req, res) => {
    const query = req.query as { year?: string; semester?: string };
    await professorsService.unlinkSubject(
      req.params['id'] as string,
      req.params['subjectId'] as string,
      query.year ? Number(query.year) : undefined,
      query.semester ? Number(query.semester) : undefined,
    );
    res.status(204).send();
  }) as RequestHandler,

  listStudents: (async (req, res) => {
    res.json(await studentsService.list(req.query as never));
  }) as RequestHandler,

  listProfessorStudents: (async (req, res) => {
    res.json(await studentsService.listForProfessor(requireUser(req).id, req.query as never));
  }) as RequestHandler,

  createStudent: (async (req, res) => {
    res.status(201).json({ student: await studentsService.create(req.body as CreateStudentInput) });
  }) as RequestHandler,

  professorSubjects: (async (req, res) => {
    const query = req.query as { year?: string; semester?: string };
    res.json({
      data: await professorSubjectsService.listMine(
        requireUser(req).id,
        query.year ? Number(query.year) : undefined,
        query.semester ? Number(query.semester) : undefined,
      ),
      period: parsePeriod(
        query.year ? Number(query.year) : undefined,
        query.semester ? Number(query.semester) : undefined,
      ),
    });
  }) as RequestHandler,

  listMonitors: (async (req, res) => {
    const query = req.query as { year?: string; semester?: string };
    res.json({
      data: await monitorsService.listBySubject(
        requireUser(req).id,
        req.params['id'] as string,
        query.year ? Number(query.year) : undefined,
        query.semester ? Number(query.semester) : undefined,
      ),
    });
  }) as RequestHandler,

  assignMonitor: (async (req, res) => {
    res.status(201).json({
      assignment: await monitorsService.assign(
        requireUser(req).id,
        req.params['id'] as string,
        req.body as AssignMonitorInput,
      ),
    });
  }) as RequestHandler,

  unassignMonitor: (async (req, res) => {
    const query = req.query as { year?: string; semester?: string };
    await monitorsService.unassign(
      requireUser(req).id,
      req.params['subjectId'] as string,
      req.params['monitorId'] as string,
      query.year ? Number(query.year) : undefined,
      query.semester ? Number(query.semester) : undefined,
    );
    res.status(204).send();
  }) as RequestHandler,

  myMonitorSubjects: (async (req, res) => {
    const query = req.query as { year?: string; semester?: string };
    res.json({
      data: await monitorsService.listMine(
        requireUser(req).id,
        query.year ? Number(query.year) : undefined,
        query.semester ? Number(query.semester) : undefined,
      ),
    });
  }) as RequestHandler,
};
