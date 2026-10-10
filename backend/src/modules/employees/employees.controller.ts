import { Request, Response } from 'express';

import { UnauthorizedError } from '../../core/errors/index.js';
import { employeeService } from './employees.service.js';
import {
  addTeamMemberSchema,
  assignTeamMemberSchema,
  createEmployeeSchema,
  createTeamSchema,
  employeeIdSchema,
  listEmployeesSchema,
  reassignTeamMemberSchema,
  updateEmployeeSchema,
  updateTeamNameSchema,
  updateTeamSchema,
} from './employees.validator.js';

/**
 * REFERENCE MODULE — the controller layer.
 *
 * Parse the request, call the service, send the response. That is all.
 * No queries, no business rules, no try/catch — `asyncHandler` on the route
 * forwards rejections to the central error handler.
 */

function context(req: Request) {
  // requireAuth runs before every route here, so ctx is always present —
  // this narrows the type and fails loudly if a route is ever misconfigured.
  if (!req.ctx) throw new UnauthorizedError();
  return req.ctx;
}

export class EmployeesController {
  /** GET /api/employees */
  static async list(req: Request, res: Response) {
    const query = listEmployeesSchema.parse(req.query);
    const result = await employeeService.list(query, context(req));
    res.status(200).json(result);
  }

  /** GET /api/employees/me */
  static async me(req: Request, res: Response) {
    const employee = await employeeService.getMine(context(req));
    res.status(200).json({ employee });
  }

  /** PATCH /api/employees/me */
  static async updateMine(req: Request, res: Response) {
    const input = updateEmployeeSchema.parse(req.body);
    const employee = await employeeService.updateMine(input, context(req));
    res.status(200).json({ message: 'Profile updated', employee });
  }

  /** GET /api/employees/manager-options */
  static async managerOptions(req: Request, res: Response) {
    const options = await employeeService.listManagerOptions(context(req));
    res.status(200).json({ options });
  }

  /** GET /api/employees/teams — manager-wise team groups */
  static async teams(req: Request, res: Response) {
    const managerId = typeof req.query.managerId === 'string' ? req.query.managerId : undefined;
    const result = await employeeService.getTeamHierarchy(context(req), managerId);
    res.status(200).json(result);
  }

  /** POST /api/employees/teams — create a named team under manager */
  static async createTeam(req: Request, res: Response) {
    const input = createTeamSchema.parse(req.body);
    const team = await employeeService.createTeam(input, context(req));
    res.status(201).json({ message: 'Team created successfully', team });
  }

  /** PATCH /api/employees/teams/:id — update named team */
  static async updateTeam(req: Request, res: Response) {
    const { id } = employeeIdSchema.parse(req.params);
    const input = updateTeamSchema.parse(req.body);
    const team = await employeeService.updateTeam(id, input, context(req));
    res.status(200).json({ message: 'Team updated successfully', team });
  }

  /** DELETE /api/employees/teams/:id — delete team */
  static async deleteTeam(req: Request, res: Response) {
    const { id } = employeeIdSchema.parse(req.params);
    const result = await employeeService.deleteTeam(id, context(req));
    res.status(200).json(result);
  }

  /** POST /api/employees/teams/:id/members — add member to team */
  static async addMemberToTeam(req: Request, res: Response) {
    const { id } = employeeIdSchema.parse(req.params);
    const input = addTeamMemberSchema.parse(req.body);
    const team = await employeeService.addMemberToTeam(id, input.employeeId, context(req));
    res.status(200).json({ message: 'Member added to team', team });
  }

  /** DELETE /api/employees/teams/:id/members/:employeeId — remove member from team */
  static async removeMemberFromTeam(req: Request, res: Response) {
    const { id } = employeeIdSchema.parse({ id: req.params.id });
    const { id: employeeId } = employeeIdSchema.parse({ id: req.params.employeeId });
    const team = await employeeService.removeMemberFromTeam(id, employeeId, context(req));
    res.status(200).json({ message: 'Member removed from team', team });
  }

  /** POST /api/employees/teams/reassign — reassign member between teams */
  static async reassignTeamMember(req: Request, res: Response) {
    const input = reassignTeamMemberSchema.parse(req.body);
    const result = await employeeService.reassignTeamMember(
      input.sourceTeamId,
      input.targetTeamId,
      input.employeeId,
      context(req),
    );
    res.status(200).json(result);
  }

  /** PATCH /api/employees/teams/name — legacy update team name */
  static async updateTeamName(req: Request, res: Response) {
    const input = updateTeamNameSchema.parse(req.body);
    const result = await employeeService.updateTeamName(input.managerId, input.teamName, context(req));
    res.status(200).json({ message: 'Team name updated', ...result });
  }

  /** POST /api/employees/teams/members — legacy assign eligible member to team */
  static async assignTeamMember(req: Request, res: Response) {
    const input = assignTeamMemberSchema.parse(req.body);
    const employee = await employeeService.assignTeamMember(input.employeeId, input.managerId ?? null, context(req));
    res.status(200).json({ message: 'Team member assigned successfully', employee });
  }

  /** DELETE /api/employees/teams/members/:id — legacy remove member from team */
  static async removeTeamMember(req: Request, res: Response) {
    const { id } = employeeIdSchema.parse(req.params);
    const employee = await employeeService.removeTeamMember(id, context(req));
    res.status(200).json({ message: 'Team member removed from team', employee });
  }

  /** GET /api/employees/:id/crm-summary — complete member CRM activity overview */
  static async memberCrmSummary(req: Request, res: Response) {
    const { id } = employeeIdSchema.parse(req.params);
    const summary = await employeeService.getMemberCrmSummary(id, context(req));
    res.status(200).json(summary);
  }

  /** GET /api/employees/:id */
  static async getById(req: Request, res: Response) {
    const { id } = employeeIdSchema.parse(req.params);
    const employee = await employeeService.getById(id, context(req));
    res.status(200).json({ employee });
  }

  /** GET /api/employees/:id/reports */
  static async directReports(req: Request, res: Response) {
    const { id } = employeeIdSchema.parse(req.params);
    const employees = await employeeService.getDirectReports(id, context(req));
    res.status(200).json({ employees });
  }

  /** POST /api/employees */
  static async create(req: Request, res: Response) {
    const input = createEmployeeSchema.parse(req.body);
    const employee = await employeeService.create(input, context(req));
    res.status(201).json({ message: 'Employee created', employee });
  }

  /** PATCH /api/employees/:id */
  static async update(req: Request, res: Response) {
    const { id } = employeeIdSchema.parse(req.params);
    const input = updateEmployeeSchema.parse(req.body);
    const employee = await employeeService.update(id, input, context(req));
    res.status(200).json({ message: 'Employee updated', employee });
  }

  /** DELETE /api/employees/:id — soft delete. */
  static async deactivate(req: Request, res: Response) {
    const { id } = employeeIdSchema.parse(req.params);
    const result = await employeeService.deactivate(id, context(req));
    res.status(200).json({ message: 'Employee deactivated', ...result });
  }
}


