import { api } from '@/shared/api/client';

import type {
  Employee,
  EmployeeFormValues,
  EmployeeListQuery,
  EmployeeListResponse,
  ManagerOption,
  MemberCrmSummaryResponse,
  TeamHierarchyResponse,
} from './types';

/**
 * REFERENCE MODULE — the API layer.
 *
 * Every network call a module makes lives in one file like this. Components
 * call these functions; they never touch `fetch` or build URLs themselves.
 */

function buildQuery(query: EmployeeListQuery): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    // Empty filters are omitted rather than sent as blank strings — the server
    // validates the enum, and "" is not a valid department.
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Turns the form's strings into the JSON the API expects: blanks dropped, money
 * converted from rupees, ids left as strings.
 */
function toPayload(values: EmployeeFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    fullName: values.fullName,
    workEmail: values.workEmail,
    mobile: values.mobile,
    department: values.department,
    designation: values.designation,
    employmentType: values.employmentType,
    dateOfJoining: values.dateOfJoining,
    workLocation: values.workLocation,
    status: values.status,
  };

  const optional: Array<[string, string]> = [
    ['personalEmail', values.personalEmail],
    ['dateOfBirth', values.dateOfBirth],
    ['dateOfExit', values.dateOfExit],
    ['reportingManagerId', values.reportingManagerId],
    ['panNumber', values.panNumber],
    ['aadhaarNumber', values.aadhaarNumber],
    ['bankAccountNumber', values.bankAccountNumber],
    ['ifsc', values.ifsc],
    ['address', values.address],
  ];

  for (const [key, value] of optional) {
    if (value.trim() !== '') payload[key] = value.trim();
  }

  // The user types rupees; the API's validator converts to integer paise.
  if (values.annualCtcRupees.trim() !== '') {
    payload.annualCtc = Number(values.annualCtcRupees);
  }

  const emergency = {
    name: values.emergencyContactName.trim(),
    relationship: values.emergencyContactRelationship.trim(),
    mobile: values.emergencyContactMobile.trim(),
  };
  if (emergency.name || emergency.relationship || emergency.mobile) {
    payload.emergencyContact = emergency;
  }

  return payload;
}

export const employeesApi = {
  list: (query: EmployeeListQuery = {}) =>
    api.get<EmployeeListResponse>(`/api/employees${buildQuery(query)}`),

  getById: (id: string) =>
    api.get<{ employee: Employee }>(`/api/employees/${id}`).then((res) => res.employee),

  getMine: () => api.get<{ employee: Employee }>('/api/employees/me').then((res) => res.employee),

  directReports: (id: string) =>
    api.get<{ employees: Employee[] }>(`/api/employees/${id}/reports`).then((res) => res.employees),

  managerOptions: () =>
    api.get<{ options: ManagerOption[] }>('/api/employees/manager-options').then((r) => r.options),

  teams: (managerId?: string) => {
    const q = managerId ? `?managerId=${encodeURIComponent(managerId)}` : '';
    return api.get<TeamHierarchyResponse>(`/api/employees/teams${q}`);
  },

  createTeam: (payload: { name: string; description?: string; managerId?: string }) =>
    api.post<{ message: string; team: any }>('/api/employees/teams', payload).then((res) => res.team),

  updateTeam: (teamId: string, payload: { name?: string; description?: string }) =>
    api.patch<{ message: string; team: any }>(`/api/employees/teams/${teamId}`, payload).then((res) => res.team),

  deleteTeam: (teamId: string) =>
    api.delete<{ success: boolean; message: string }>(`/api/employees/teams/${teamId}`),

  addMemberToTeam: (teamId: string, employeeId: string) =>
    api.post<{ message: string; team: any }>(`/api/employees/teams/${teamId}/members`, { employeeId }).then((res) => res.team),

  removeMemberFromTeam: (teamId: string, employeeId: string) =>
    api.delete<{ message: string; team: any }>(`/api/employees/teams/${teamId}/members/${employeeId}`).then((res) => res.team),

  reassignTeamMember: (payload: { sourceTeamId: string; targetTeamId: string; employeeId: string }) =>
    api.post<{ message: string }>('/api/employees/teams/reassign', payload),

  updateTeamName: (teamName: string, managerId?: string) =>
    api.patch<{ message: string; managerId: string; teamName: string }>('/api/employees/teams/name', {
      teamName,
      managerId,
    }),

  assignMember: (employeeId: string, managerId?: string | null) =>
    api
      .post<{ message: string; employee: Employee }>('/api/employees/teams/members', {
        employeeId,
        managerId,
      })
      .then((res) => res.employee),

  removeMember: (employeeId: string) =>
    api
      .delete<{ message: string; employee: Employee }>(`/api/employees/teams/members/${employeeId}`)
      .then((res) => res.employee),

  getMemberCrmSummary: (employeeId: string) =>
    api.get<MemberCrmSummaryResponse>(`/api/employees/${employeeId}/crm-summary`),

  assignManager: (employeeId: string, reportingManagerId: string | null) =>
    api
      .post<{ message: string; employee: Employee }>('/api/employees/teams/members', {
        employeeId,
        managerId: reportingManagerId ? reportingManagerId : null,
      })
      .then((res) => res.employee),

  create: (values: EmployeeFormValues) =>
    api
      .post<{ employee: Employee }>('/api/employees', toPayload(values))
      .then((res) => res.employee),

  update: (id: string, values: EmployeeFormValues) =>
    api
      .patch<{ employee: Employee }>(`/api/employees/${id}`, toPayload(values))
      .then((res) => res.employee),

  deactivate: (id: string) => api.delete<{ id: string }>(`/api/employees/${id}`),
};

