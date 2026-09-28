import { Router } from 'express';

import { requireAuth } from '../../core/auth/auth-middleware.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { requirePermission } from '../../core/rbac/index.js';
import { EmployeesController } from './employees.controller.js';

/**
 * REFERENCE MODULE — routes.
 *
 * Every route declares a permission. No exceptions, including read-only ones.
 * Note the ordering: literal paths (`/me`, `/manager-options`) are registered
 * before `/:id`, otherwise Express matches "me" as an id.
 */
const router = Router();

router.use(requireAuth);

router.get('/me', requirePermission('employees.self'), asyncHandler(EmployeesController.me));

router.get(
  '/manager-options',
  requirePermission('employees.view'),
  asyncHandler(EmployeesController.managerOptions),
);

router.get(
  '/teams',
  requirePermission('employees.view'),
  asyncHandler(EmployeesController.teams),
);

router.post(
  '/teams',
  requirePermission('employees.view'),
  asyncHandler(EmployeesController.createTeam),
);

router.post(
  '/teams/reassign',
  requirePermission('employees.view'),
  asyncHandler(EmployeesController.reassignTeamMember),
);

router.patch(
  '/teams/name',
  requirePermission('employees.view'),
  asyncHandler(EmployeesController.updateTeamName),
);

router.post(
  '/teams/members',
  requirePermission('employees.view'),
  asyncHandler(EmployeesController.assignTeamMember),
);

router.delete(
  '/teams/members/:id',
  requirePermission('employees.view'),
  asyncHandler(EmployeesController.removeTeamMember),
);

router.patch(
  '/teams/:id',
  requirePermission('employees.view'),
  asyncHandler(EmployeesController.updateTeam),
);

router.delete(
  '/teams/:id',
  requirePermission('employees.view'),
  asyncHandler(EmployeesController.deleteTeam),
);

router.post(
  '/teams/:id/members',
  requirePermission('employees.view'),
  asyncHandler(EmployeesController.addMemberToTeam),
);

router.delete(
  '/teams/:id/members/:employeeId',
  requirePermission('employees.view'),
  asyncHandler(EmployeesController.removeMemberFromTeam),
);

router.get(
  '/:id/crm-summary',
  requirePermission('employees.view'),
  asyncHandler(EmployeesController.memberCrmSummary),
);

router.get('/', requirePermission('employees.view'), asyncHandler(EmployeesController.list));

router.post('/', requirePermission('employees.manage'), asyncHandler(EmployeesController.create));

router.get('/:id', requirePermission('employees.view'), asyncHandler(EmployeesController.getById));

router.get(
  '/:id/reports',
  requirePermission('employees.view'),
  asyncHandler(EmployeesController.directReports),
);

router.patch(
  '/:id',
  requirePermission('employees.manage'),
  asyncHandler(EmployeesController.update),
);

router.delete(
  '/:id',
  requirePermission('employees.manage'),
  asyncHandler(EmployeesController.deactivate),
);

export default router;

