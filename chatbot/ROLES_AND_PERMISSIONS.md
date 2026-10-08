# Media Octus CRM - Role-Based Access Control (RBAC) Architecture & Permissions Document

This document provides an exhaustive breakdown of the access control system, exact permissions, data scopes, security guardrails, and changes implemented for the four core roles: **Admin**, **HR**, **Manager**, and **Finance**.

---

## 1. Executive Summary & Changes Made

### Key Architectural Enhancements Implemented
1. **Strict Tool-Level Permissions ([assistant/permissions.py](file:///d:/binjwa/Media%20Octus/assistant/permissions.py))**:
   - `update_salary`: Locked strictly to `finance.manage` (Admin and Finance only). HR can view salary details across the company but **cannot** update or edit salaries.
   - `remove_employee`: Granted to `users.delete` (Admin and Manager). Managers can remove non-management employees; HR cannot delete accounts.
   - `get_recent_activity`: Granted only to `audit.view` (Admin and Finance). Finance is the **only non-Admin role** with audit log visibility.
   - `generate_po_pdf`: Locked to `purchase_orders.manage` (Admin and Ops). Finance has read-only access (`get_purchase_orders`) and cannot generate or issue PO PDFs.
   - `get_employee_performance_summary`: Locked to `reports.view` (Admin, HR, Manager). Finance and Ops cannot view department-wide performance summaries.

2. **Pre-LLM Zero-Hallucination Guard ([assistant/assistant.py](file:///d:/binjwa/Media%20Octus/assistant/assistant.py))**:
   - Intercepts requests for entities and actions that a role is not authorized to access (such as leads, quotations, purchase orders, sites, bookings, vendors, campaigns, operational tasks, escalations, finances, and salary updates).
   - **Prevents LLM Hallucinations**: If a role has no tools for an entity (e.g., HR or Finance asking for sales leads), the system immediately blocks the request before calling the LLM, eliminating fabricated markdown tables or fake data.
   - **Cost & Token Efficiency**: Blocks unauthorized inquiries before spending API tokens on Groq or Gemini.

3. **Self-Service Scope Enforcement**:
   - Applied to **Finance**: Finance users can inspect their own attendance, check their own leave balance, and apply for personal leave. They are strictly blocked from viewing or managing team attendance or leave balances of other employees.
   - Applied to **HR**: HR has company-wide leave and attendance view/edit capabilities, but cannot access sales leads, client quotations, or purchase orders.

---

## 2. Comprehensive Role Permission Matrix

| Feature / Domain | Admin (`Aditi Rao`) | HR (`Imran Shaikh`) | Manager (`Rohit Menon`) | Finance (`Neha Bansal`) | Employee (`Meera Krishnan`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **System Scope** | Full Unrestricted (`*`) | Employees, Leaves, Attendance, Sensitive View | Team, Reporting Chain, Sales Pipeline, Operations | Finance, Bank, Audit, View-only Commercial, Self-service | **Self-Service Only + Tasks View-Only** |
| **Users / Directory** | Full (Create, Update, Delete) | View + Manage (Create, Update; **Cannot Delete**) | View + Manage + Add + Remove (Non-admin/manager employees) | View directory (Cannot add, edit, or delete) | Basic directory lookup (**Cannot add, edit, or delete**) |
| **Salary / CTC** | **Full Control** (View all & Update all) | **View Only** (All employees; **Cannot edit**) | **Scoped View** (Subordinates in reporting chain only) | **Full Control** (View all & Update all) | **Self-Service Only** (Own CTC only; others strictly blocked) |
| **Attendance** | Full (View & Update all) | **Team-Wide** (View & Update all) | **Team-Wide** (View team & personal) | **Self-Service Only** (Own attendance only) | **Self-Service Only** (Own attendance only) |
| **Leaves** | Full (Approve, Reject, Balances) | **Company-Wide** (Approve, Reject, Balances) | **Team-Wide** (Approve/Reject team requests) | **Self-Service Only** (Own balance & apply only) | **Self-Service Only** (Own balance & apply only) |
| **Reports / Performance** | View all reports | View all employee performance summaries | View employee performance summaries | **No Access** | **No Access** |
| **Audit Logs (Recent Activity)** | **Full Access** | **No Access** | **No Access** | **Full Access** (Only non-admin role) | **No Access** |
| **Company Finances** | **Full Access** | **No Access** | **No Access** | **Full Access** (Summaries, Bank details) | **No Access** |
| **Quotations** | Create, View, Update | **No Access** | Create, View, Update | **View Only** (Cannot create or edit) | **No Access** |
| **Purchase Orders** | Create, View, Issue PDF | **No Access** | View POs | **View Only** (Cannot generate or issue PDF) | **No Access** |
| **Vendors** | View, Manage | **No Access** | View vendors | **View Only** | **No Access** |
| **Campaigns** | View, Manage | **No Access** | View & Manage | **View Only** | **No Access** |
| **Sites & Hoardings** | View, Book, Manage | **No Access** | View sites & bookings | **No Access** | **No Access** |
| **Sales Leads** | View, Create, Update, Claim | **No Access** | View, Create, Update, Assign | **No Access** | **No Access** |
| **Operational Tasks** | Create, Reassign, Update status | **No Access** | Create, Reassign, Oversee team tasks | **No Access** | **View Only** (`get_my_tasks`; cannot edit/create/reassign) |
| **Escalations** | View, Acknowledge | **No Access** | View, Acknowledge | **No Access** | **No Access** |

---

## 3. Detailed Role-by-Role Breakdown

### A. Admin Role
- **Active Representative**: Aditi Rao (`6a97e6a6437c8ae3d2ec0473`)
- **Permission Wildcard**: `*`
- **Tool Count**: **38 Tools**
- **Capabilities**:
  - Unrestricted system-wide authority across every CRM domain.
  - Can create, edit, and delete employee records (`remove_employee` is Admin exclusive).
  - Can view and update salaries/CTC for any employee in the company.
  - Full leave approval, rejection, balance adjustments, and attendance management.
  - Complete control over sales pipeline, quotes, purchase orders, campaigns, sites, bookings, tasks, and audit logs.

---

### B. HR Role
- **Active Representative**: Imran Shaikh (`6a97e6a7437c8ae3d2ec0478`)
- **Permissions**:
  - `users.view`
  - `employees.view`, `employees.manage`, `employees.sensitive`
  - `attendance.self`, `attendance.view_team`
  - `leave.self`, `leave.manage`
  - `reports.view`
  - `candidates.view`, `candidates.manage`
- **Tool Count**: **14 Tools**
  - `get_role_access`, `get_employee`, `get_employee_performance_summary`, `update_employee`, `add_employee`
  - `get_leave_balance`, `update_leave_balance`, `apply_for_leave`, `get_pending_leave_requests`, `approve_leave_request`, `reject_leave_request`
  - `get_attendance_status`, `update_attendance_status`, `get_salary_details`
- **Capabilities**:
  - **Directory**: View directory, onboard new employees (`add_employee`), and update profile details (`update_employee`).
  - **Salary / CTC**: View sensitive CTC and salary breakdowns for any employee in the company (`get_salary_details`).
  - **Leaves**: Full company-wide leave management (inspect balances, adjust balances, review pending requests, approve/reject requests).
  - **Attendance**: View team attendance status and update attendance for any employee.
  - **Performance & Reports**: Generate performance summaries and review ratings for departments.
- **Strict Guardrails & Disallowments**:
  - **Salary Updates**: Cannot edit or update salaries (`update_salary` blocked).
  - **User Deletion**: Cannot remove or delete employee accounts (`remove_employee` blocked).
  - **No Commercial / Operational Access**: Strictly blocked from leads, client quotations, purchase orders, sites, bookings, vendors, campaigns, operational tasks, escalations, audit logs, and company finance accounts.

---

### C. Manager Role
- **Active Representative**: Rohit Menon (`6a97e6a6437c8ae3d2ec0474`)
- **Permissions**:
  - `users.view`, `users.create`, `users.delete`
  - `leads.view`, `leads.create`, `leads.update`, `leads.assign`, `leads.log_call`
  - `quotations.view`, `quotations.create`, `quotations.update`
  - `sites.view`, `bookings.view`, `vendors.view`, `purchase_orders.view`
  - `campaigns.view`, `campaigns.manage`
  - `tasks.view`, `tasks.manage`, `proofs.view`, `proofs.approve`
  - `employees.view`, `employees.manage`, `employees.self`
  - `attendance.self`, `attendance.view_team`
  - `leave.self`, `leave.manage`
  - `reports.view`, `candidates.view`, `candidates.manage`
- **Tool Count**: **32 Tools**
- **Capabilities**:
  - **Employee Lifecycle Management**: Can add new employees (`add_employee`) and remove/offboard employees (`remove_employee`).
  - **Reporting Chain Oversight**: Manages direct reports and subordinate teams (e.g., Sana Qureshi, Kabir Deshpande).
  - **Salary Scope**: Can view sensitive salary/CTC details **only for subordinates within his reporting hierarchy**. Cannot view salaries of the Admin or employees outside his reporting line.
  - **Sales Pipeline**: View, create, update, and assign leads; view and create client quotations.
  - **Operations Oversight**: View sites, site bookings, vendor lists, purchase orders, and campaigns.
  - **Team Oversight**: Approve or reject team leave requests; inspect team attendance.
  - **Task & Escalation Management**: Create tasks, assign/reassign tasks, review proof of work, and acknowledge system escalations.
- **Strict Guardrails & Disallowments**:
  - Cannot update employee salaries.
  - Cannot delete Admin accounts, other Managers, or own account.
  - Cannot view system audit logs (`get_recent_activity` is blocked).

---

### D. Finance Role
- **Active Representative**: Neha Bansal (`6a97e6a7437c8ae3d2ec0477`)
- **Permissions**:
  - `finance.view`, `finance.manage`, `finance.bank_details`
  - `audit.view`
  - `quotations.view`
  - `vendors.view`
  - `purchase_orders.view`
  - `campaigns.view`
  - `employees.view`, `employees.sensitive`
  - `employees.self`, `attendance.self`, `leave.self`
- **Tool Count**: **13 Tools**
  - `get_role_access`, `get_recent_activity`, `get_employee`
  - `get_salary_details`, `update_salary`, `get_company_finance_summary`
  - `get_quotations`, `get_purchase_orders`, `get_vendors`, `get_campaigns`
  - `get_leave_balance`, `apply_for_leave`, `get_attendance_status`
- **Capabilities**:
  - **Finance & Salaries**: Full control over financial summaries, bank details, employee CTC inspection (`get_salary_details`), and employee salary updates (`update_salary`).
  - **Audit Logs**: Full access to view system modifications, user mutations, and audit trails (`get_recent_activity`). Finance is the **only non-Admin role** with audit view.
  - **Commercial Records (Read-Only)**: View-only access to quotations (`get_quotations`), purchase orders (`get_purchase_orders`), vendor records (`get_vendors`), and marketing campaigns (`get_campaigns`).
  - **Self-Service Portal**: View personal employee profile, check personal monthly paid leave balance, check personal attendance status, and submit personal leave applications.
- **Strict Guardrails & Disallowments**:
  - **Quotations**: Cannot create, draft, or update client quotations (`generate_quotation_pdf`, `update_quotation` blocked).
  - **Purchase Orders**: Cannot generate or issue PO PDFs (`generate_po_pdf` blocked; restricted to Ops/Admin).
  - **Employee Management**: Cannot add, update, or remove employee profiles in the directory.
  - **Team Scoping**: Cannot inspect or edit the leave balances or attendance records of other employees.
  - **No Access**: Strictly blocked from sales leads, hoarding/billboard sites, bookings, operational tasks, and escalations.

### E. Employee Role (Standard Employee)
- **Active Representatives**: Meera Krishnan (`6a97e6a7437c8ae3d2ec0476`), Priya Nair
- **Core Principle**: Strictly Self-Service & View-Only Assigned Tasks. No operational, managerial, or financial access.
- **Assigned Permissions**:
  - `tasks.view`
  - `employees.self`
  - `attendance.self`
  - `leave.self`
- **Tool Count**: **7 Tools Strictly**
  - `get_role_access`: View permissions, capabilities, and system scope for the employee role or self.
  - `get_employee`: Basic directory lookup (sensitive salary/contact info of others is completely scrubbed).
  - `get_leave_balance`: View own leave balance (querying other employees returns `permission_denied`).
  - `apply_for_leave`: Submit personal leave applications.
  - `get_attendance_status`: Check own attendance status (querying other employees returns `permission_denied`).
  - `get_salary_details`: View own salary/CTC details (querying other employees returns `permission_denied`).
  - `get_my_tasks`: View tasks assigned to oneself (**view only**).
- **Capabilities**:
  - **Tasks (View-Only)**: Can view tasks assigned to themselves via `get_my_tasks`.
  - **Self-Service HR Portal**: Can check their own leave balance, apply for leave, check their own attendance, and inspect their own CTC.
- **Strict Guardrails & Disallowments**:
  - **No Task Management**: Cannot update task statuses (`update_task_status` restricted to `tasks.manage`), create tasks (`create_task` restricted to `tasks.manage`), or reassign tasks (`reassign_tasks` restricted to `tasks.manage`).
  - **No Management / Administration**: Cannot add, update, or remove employees; cannot approve, reject, or adjust leave requests; cannot update or modify anyone's attendance.
  - **No Operational Access**: Absolutely no access to sales leads, client quotations, purchase orders, outdoor sites/hoardings, bookings, vendors, or marketing campaigns.
  - **No Financial Access**: Strictly blocked from viewing company finances or modifying employee salaries.
  - **Pre-LLM Guard**: Inquiries about prohibited modules are immediately intercepted by the Pre-LLM Guard with an `Access Restricted: As Employee...` message before invoking the LLM.

---

## 4. File-by-File Change Log

1. **[assistant/permissions.py](file:///d:/binjwa/Media%20Octus/assistant/permissions.py)**:
   - Updated `ROLE_PERMISSIONS["hr"]`: Granted `users.view`, `employees.view`, `employees.manage`, `employees.sensitive`, `attendance.self`, `attendance.view_team`, `leave.self`, `leave.manage`, `reports.view`, `candidates.view`, `candidates.manage`.
   - Updated `ROLE_PERMISSIONS["finance"]`: Granted `finance.view`, `finance.manage`, `finance.bank_details`, `audit.view`, `quotations.view`, `vendors.view`, `purchase_orders.view`, `campaigns.view`, `employees.view`, `employees.sensitive`, `employees.self`, `attendance.self`, `leave.self`.
   - Updated `ROLE_PERMISSIONS["employee"]`: Set strictly to `tasks.view`, `employees.self`, `attendance.self`, `leave.self`.
   - Updated `TOOL_PERMISSIONS`:
     - `"update_task_status": ["tasks.manage"]` (Secured against Employee and Sales Agent; accessible only to Manager, Ops, and Admin).
     - `"create_task": ["tasks.manage"]` (Secured against Employee and Sales Agent; accessible only to Manager, Ops, and Admin).
     - `"reassign_tasks": ["tasks.manage"]` (Exclusive to Manager, Ops, and Admin).
     - `"update_salary": ["finance.manage"]` (Secured against HR and other roles; accessible only to Admin and Finance).
     - `"remove_employee": ["users.delete"]` (Exclusive to Admin).
     - `"generate_po_pdf": ["purchase_orders.manage"]` (Secured against Finance; accessible only to Ops and Admin).
     - `"get_employee_performance_summary": ["reports.view"]` (Accessible only to Admin, HR, and Manager).
     - `"get_escalations": ["tasks.manage", "escalations.view"]`
     - `"acknowledge_escalation": ["tasks.manage", "escalations.manage"]`

2. **[assistant/assistant.py](file:///d:/binjwa/Media%20Octus/assistant/assistant.py)**:
   - Implemented and extended the **Pre-LLM Zero-Hallucination & RBAC Access Guard**:
     - Evaluates queries before tool routing or LLM invocation.
     - Contains keyword and regex matching across 17 entity domains (leads, quotations, quotation generation, purchase orders, purchase order generation, sites, bookings, vendors, campaigns, operational tasks, task management, employee management, leave approvals, attendance management, escalations, company finances, and salary updates).
     - Instantly returns `Access Restricted: As {Role}, you do not have permission to view or manage {description}. Your role access is restricted according to company RBAC policy.` whenever an unauthorized action is requested.
   - Enforced self-service scoping in `execute_tool`:
     - Auto-resolves `employee_id` to `session.user_id` when the user asks about their own leave, attendance, salary, or profile.
     - `get_leave_balance`: Querying any other employee ID without `leave.manage` returns `permission_denied`.
     - `get_attendance_status`: Querying any other employee ID without `attendance.view_team` returns `permission_denied`.
     - `get_salary_details`: Querying any other employee ID without `employees.sensitive` returns `permission_denied`.

3. **[adapters/crm_adapter.py](file:///d:/binjwa/Media%20Octus/adapters/crm_adapter.py)**:
   - Updated `get_pending_leave_requests` and `update_leave_request_status`: Allowed both `admin` and `hr` to review, approve, and reject company-wide leave requests.
   - Updated `role_descriptions` in `get_role_access`: Clarified the capabilities, scopes, and explicit restrictions for HR, Finance, and Employee roles.

4. **[assistant/router.py](file:///d:/binjwa/Media%20Octus/assistant/router.py)**:
   - Cleaned `TOOL_DOMAINS["HR"]` to remove tools HR is not authorized to call (`update_salary`, `remove_employee`, `reassign_tasks`, `create_task`).
