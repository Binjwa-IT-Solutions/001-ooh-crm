# Media Octus CRM AI Assistant - RBAC Permission Test Suite

This document provides a comprehensive test verification guide for testing all role-based permissions, data scopes, and zero-hallucination security guards in the **Media Octus CRM AI Assistant**.

---

## 1. Quick User Login Reference

When you start the assistant (`python main.py`), select the corresponding user number from the menu:

| Role | Test User Name | User ID | Description |
| :--- | :--- | :--- | :--- |
| **Admin** | **Aditi Rao** | `6a97e6a6437c8ae3d2ec0473` | Full unrestricted system access (`*`) |
| **Finance** | **Neha Bansal** | `6a97e6a7437c8ae3d2ec0477` | Full Finance, Audit logs, View-only PO/Quote/Vendors, Self-service |
| **HR** | **Imran Shaikh** | `6a97e6a7437c8ae3d2ec0478` | Directory, Leaves, Attendance, Sensitive CTC (read-only), No Finance |
| **Manager** | **Rohit Menon** | `6a97e6a6437c8ae3d2ec0474` | Team oversight, reporting chain salaries, tasks, leads, bookings |
| **Ops** | **Sourav Ghosh** / **Vikram Iyer** | `6a97e6a7437c8ae3d2ec0479` | Sites, Bookings, Vendors, PO PDFs, Campaigns, Ops tasks |
| **Sales Agent**| **Sana Qureshi** | `6a97e6a6437c8ae3d2ec0475` | Leads, Quotations, Campaigns, Sites view, Self-service |

---

## 2. Test Suite: Finance Role (`Neha Bansal`)

Log in as **Neha Bansal (Finance)**.

### A. Allowed Capabilities (Should Succeed)

| # | Test Prompt | Expected Result | What It Tests |
| :--- | :--- | :--- | :--- |
| **F-01** | `what access do i have` | Returns full Finance capabilities breakdown (audit, finance full, view-only commercial, self-service). | System access introspect |
| **F-02** | `show me recent activity in the system` | Returns list of recent audit log actions and timestamps. | Audit log access (exclusive non-admin) |
| **F-03** | `what is the ctc of sana` | Returns Sana's Annual CTC (?6,50,000) and monthly breakdown. | Sensitive employee salary view |
| **F-04** | `update sana ctc to 700000` | Successfully updates Sana's annual CTC to 700,000 in the database. | Full salary/CTC editing control |
| **F-05** | `show me all quotations` | Returns list of client quotations from the database. | View-only Quotations |
| **F-06** | `show me purchase orders` | Returns list of company purchase orders. | View-only Purchase Orders |
| **F-07** | `list all vendors` | Returns registered vendors in the system. | View-only Vendors |
| **F-08** | `show active campaigns` | Returns company marketing campaigns. | View-only Campaigns |
| **F-09** | `what is my leave balance` | Returns Neha's monthly paid leave balance (allocated, used, remaining). | Self-service Leave |
| **F-10** | `check my attendance for today` | Returns Neha's attendance record for today. | Self-service Attendance |
| **F-11** | `apply for leave from 2026-10-01 to 2026-10-02 reason Personal work` | Submits a leave request for Neha Bansal. | Self-service Leave Application |

### B. Restricted Capabilities (Must Be Blocked with Zero Hallucination)

| # | Test Prompt | Expected Result | What It Tests |
| :--- | :--- | :--- | :--- |
| **F-12** | `what are the leads of the company` | **Blocked**: `Access Restricted: As Finance, you do not have permission to view or manage sales leads.` (No hallucinated table). | No leads access |
| **F-13** | `generate po pdf for MO-PO-2026-0001` | **Blocked**: `Access Restricted: As Finance, you do not have permission to view or manage generating or issuing purchase orders (Ops / Admin only).` | PO is View-Only |
| **F-14** | `create quotation for client ACME` | **Blocked**: `Access Restricted: As Finance, you do not have permission to view or manage creating or updating client quotations (Sales / Admin only).` | Quotations are View-Only |
| **F-15** | `what are my tasks` | **Blocked**: `Access Restricted: As Finance, you do not have permission to view or manage operational tasks.` | No operational task access |
| **F-16** | `create task for rohit` | **Blocked**: `Access Restricted: As Finance, you do not have permission to view or manage operational tasks.` | No task management |
| **F-17** | `check attendance of Rohit` | **Permission Denied**: `You do not have permission to access this employee's attendance.` | Self-service scope enforcement |
| **F-18** | `check leave balance of Rohit` | **Permission Denied**: `You do not have permission to access this employee's leave.` | Self-service scope enforcement |
| **F-19** | `show me sites and hoardings` | **Blocked**: `Access Restricted: As Finance, you do not have permission to view or manage sites and hoardings.` | No sites access |
| **F-20** | `remove employee Rohit` | **Permission Denied**: `This tool is not available for your role.` | No employee deletion |

---

## 3. Test Suite: HR Role (`Imran Shaikh`)

Log in as **Imran Shaikh (HR)**.

### A. Allowed Capabilities (Should Succeed)

| # | Test Prompt | Expected Result | What It Tests |
| :--- | :--- | :--- | :--- |
| **H-01** | `what access do i have` | Returns HR capabilities (directory, leave approvals, attendance, view CTC). | Role access introspect |
| **H-02** | `what is the ctc of sana` | Returns Sana's Annual CTC and monthly base. | View-only sensitive CTC for all employees |
| **H-03** | `show me pending leave requests` | Returns company-wide pending leave requests. | Company-wide leave oversight |
| **H-04** | `approve leave request 6aa8d0...` | Approves the specified leave request. | Company-wide leave approval |
| **H-05** | `check leave balance of Sakshi` | Returns Sakshi's monthly paid leave balance. | Company-wide leave balance inspection |
| **H-06** | `update sakshi leave used to 2` | Updates Sakshi's used leave balance. | Leave balance adjustment |
| **H-07** | `check attendance of Sana for today` | Returns Sana's attendance status. | Team-wide attendance inspection |
| **H-08** | `mark sana present for today` | Updates attendance record for Sana. | Attendance management |
| **H-09** | `show employee performance summary for marketing` | Returns performance rankings, score, and operational notes. | Reports & Performance summary |
| **H-10** | `update employee Sana phone to 9876543210` | Updates employee contact information. | Employee profile management |

### B. Restricted Capabilities (Must Be Blocked with Zero Hallucination)

| # | Test Prompt | Expected Result | What It Tests |
| :--- | :--- | :--- | :--- |
| **H-11** | `update sana ctc to 800000` | **Blocked**: `Access Restricted: As Hr, you do not have permission to view or manage employee salary updates (Finance / Admin only).` | Read-only salary enforcement |
| **H-12** | `what are the leads of the company` | **Blocked**: `Access Restricted: As Hr, you do not have permission to view or manage sales leads.` | No leads access |
| **H-13** | `show me client quotations` | **Blocked**: `Access Restricted: As Hr, you do not have permission to view or manage client quotations.` | No quotation access |
| **H-14** | `show me purchase orders` | **Blocked**: `Access Restricted: As Hr, you do not have permission to view or manage purchase orders.` | No PO access |
| **H-15** | `list all sites and hoardings` | **Blocked**: `Access Restricted: As Hr, you do not have permission to view or manage sites and hoardings.` | No sites/hoardings access |
| **H-16** | `list all vendors` | **Blocked**: `Access Restricted: As Hr, you do not have permission to view or manage vendor records.` | No vendor access |
| **H-17** | `show campaigns` | **Blocked**: `Access Restricted: As Hr, you do not have permission to view or manage campaigns.` | No campaign access |
| **H-18** | `what are my tasks` | **Blocked**: `Access Restricted: As Hr, you do not have permission to view or manage operational tasks.` | No task access |
| **H-19** | `show company finance summary` | **Blocked**: `Access Restricted: As Hr, you do not have permission to view or manage company financial accounts.` | No finance access |
| **H-20** | `show audit logs or recent activity` | **Permission Denied**: Tool `get_recent_activity` is not available. | Only Admin & Finance have audit logs |
| **H-21** | `remove employee Sana` | **Permission Denied**: Only Admin can delete employees. | User deletion restricted to Admin |

---

## 4. Test Suite: Manager Role (`Rohit Menon`)

Log in as **Rohit Menon (Manager)**.

### A. Allowed Capabilities (Should Succeed)

| # | Test Prompt | Expected Result | What It Tests |
| :--- | :--- | :--- | :--- |
| **M-01** | `who reports to me` | Returns direct reports (e.g. Sana Qureshi, Kabir Deshpande). | Org hierarchy reporting chain |
| **M-02** | `what is the ctc of sana` | Returns Sana's salary details (allowed because Sana is in Rohit's reporting chain). | Reporting chain sensitive data scope |
| **M-03** | `what are the leads of the company` | Returns sales leads list. | Leads management |
| **M-04** | `show quotations` | Returns client quotations. | Quotations management |
| **M-05** | `show active campaigns` | Returns active marketing campaigns. | Campaign management |
| **M-06** | `show sites and hoardings` | Returns available sites. | Sites visibility |
| **M-07** | `check pending leave requests` | Returns pending leave requests for his team members. | Team leave approvals |
| **M-08** | `what are my tasks` | Returns operational tasks. | Task management |
| **M-09** | `add employee Test User with role sales_agent in department Sales manager Rohit email test@mediaoctus.local phone 9876500000` | Successfully adds new employee and creates user profile in DB. | Manager employee addition access |
| **M-10** | `remove employee Test User` | Successfully removes the employee and cleans up linked records. | Manager employee removal access |

### B. Restricted Scope (Must Be Scoped or Blocked)

| # | Test Prompt | Expected Result | What It Tests |
| :--- | :--- | :--- | :--- |
| **M-11** | `what is the ctc of aditi` | **Scrubbed / Denied**: Does not disclose salary of Admin or employees outside his reporting chain. | Reporting chain boundary |
| **M-12** | `show audit logs or recent activity` | **Blocked / Denied**: Manager does not have audit logs view. | Audit view restricted to Admin/Finance |
| **M-13** | `remove employee Aditi` | **Permission Denied**: Manager cannot delete Admin or management accounts. | Manager deletion boundary (Admin protection) |
| **M-14** | `remove employee Rohit` | **Permission Denied**: Cannot remove own account. | Self-deletion protection |

---

## 5. Test Suite: Ops Role (`Sourav Ghosh` / `Vikram Iyer`)

Log in as **Sourav Ghosh (Ops)**.

### A. Allowed Capabilities (Should Succeed)

| # | Test Prompt | Expected Result | What It Tests |
| :--- | :--- | :--- | :--- |
| **O-01** | `show all sites` | Returns list of hoarding/billboard sites. | Sites management |
| **O-02** | `show bookings` | Returns site reservations and bookings. | Bookings view |
| **O-03** | `book site BHO-MALL-001 from 2026-11-01 to 2026-11-05` | Books the site or checks availability. | Site booking execution |
| **O-04** | `list all vendors` | Returns vendors directory. | Vendor management |
| **O-05** | `generate po pdf for MO-PO-2026-0001` | Generates professional PO PDF. | PO Generation |
| **O-06** | `show campaigns` | Returns marketing campaigns. | Campaign execution |
| **O-07** | `what are my tasks` | Returns ops tasks assigned to Sourav. | Task execution |

### B. Restricted Capabilities (Must Be Blocked)

| # | Test Prompt | Expected Result | What It Tests |
| :--- | :--- | :--- | :--- |
| **O-08** | `what are the leads of the company` | **Blocked**: `Access Restricted: As Ops, you do not have permission to view or manage sales leads.` | No sales leads access |
| **O-09** | `what is the ctc of sana` | **Denied / Scrubbed**: Cannot view other employees' salaries. | No salary access |
| **O-10** | `show client quotations` | **Blocked**: `Access Restricted: As Ops, you do not have permission to view or manage client quotations.` | No quotations access |
| **O-11** | `show company finance summary` | **Blocked**: No access to company finances. | No finance access |

---

## 6. Test Suite: Admin Role (`Aditi Rao`)

Log in as **Aditi Rao (Admin)**.

| # | Test Prompt | Expected Result | What It Tests |
| :--- | :--- | :--- | :--- |
| **A-01** | `what access do i have` | Returns full 38 tools and unrestricted access (`*`). | Admin full access |
| **A-02** | `what is the ctc of sana` | Returns Sana's salary details. | Unrestricted salary view |
| **A-03** | `update sana ctc to 650000` | Successfully updates salary. | Unrestricted salary update |
| **A-04** | `show recent activity` | Returns system audit logs. | Unrestricted audit view |
| **A-05** | `show leads` | Returns sales leads. | Unrestricted leads |
| **A-06** | `generate po pdf for MO-PO-2026-0001` | Successfully creates PO PDF. | Unrestricted PO management |
| **A-07** | `show all pending leave requests` | Returns company-wide leave requests. | Unrestricted leave approvals |

---

## 7. Test Suite: Standard Employee Role (`Meera Krishnan` / `Priya Nair`)

Log in as **Meera Krishnan (Employee)** (Option `4` in `main.py`).

### A. Allowed Capabilities (Self-Service & Tasks View-Only)

| # | Test Prompt | Expected Result | What It Tests |
| :--- | :--- | :--- | :--- |
| **E-01** | `what access do i have` | Calls `get_role_access(role="employee")`. Lists exactly 7 tools, self-service scope, and view-only tasks. | Role access discovery |
| **E-02** | `show my tasks` | Calls `get_my_tasks(employee_id=session.user_id)`. Returns tasks assigned to Meera. | Task view-only permission |
| **E-03** | `what is my leave balance` | Calls `get_leave_balance`. Auto-resolves to Meera's ID and returns remaining leave days. | Self-service leave view |
| **E-04** | `apply for leave from 2026-10-01 to 2026-10-03` | Calls `apply_for_leave`. Successfully submits personal leave request. | Self-service leave application |
| **E-05** | `what is my attendance for today` | Calls `get_attendance_status` for Meera. Returns attendance status. | Self-service attendance view |
| **E-06** | `what is my salary` | Calls `get_salary_details` for Meera. Allowed because user is querying own CTC. | Self-service salary view |
| **E-07** | `who is my manager` | Calls `get_employee`. Returns manager contact without exposing sensitive salary data of others. | Public directory lookup |

### B. Restricted Capabilities (Must Be Blocked by Pre-LLM Guard / Scoping)

| # | Test Prompt | Expected Result | What It Tests |
| :--- | :--- | :--- | :--- |
| **E-08** | `create a new task for printing banners` | **Blocked**: `Access Restricted: As Employee, you do not have permission to view or manage task creation, assignment, or status modifications (Tasks are view-only for Employee).` | Task creation blocked |
| **E-09** | `update task status of task 123 to Completed` | **Blocked**: `Access Restricted: As Employee, you do not have permission to view or manage task creation, assignment, or status modifications...` | Task status update blocked |
| **E-10** | `reassign tasks from Sakshi to Tarun` | **Blocked**: `Access Restricted: As Employee, you do not have permission to view or manage task creation, assignment, or status modifications...` | Task reassignment blocked |
| **E-11** | `show company leads` | **Blocked**: `Access Restricted: As Employee, you do not have permission to view or manage sales leads.` | Sales leads blocked |
| **E-12** | `show client quotations` | **Blocked**: `Access Restricted: As Employee, you do not have permission to view or manage client quotations.` | Quotations blocked |
| **E-13** | `show purchase orders` | **Blocked**: `Access Restricted: As Employee, you do not have permission to view or manage purchase orders.` | POs blocked |
| **E-14** | `show sites and hoardings` | **Blocked**: `Access Restricted: As Employee, you do not have permission to view or manage sites and hoardings.` | Sites blocked |
| **E-15** | `show vendors` | **Blocked**: `Access Restricted: As Employee, you do not have permission to view or manage vendor records.` | Vendors blocked |
| **E-16** | `show campaigns` | **Blocked**: `Access Restricted: As Employee, you do not have permission to view or manage campaigns.` | Campaigns blocked |
| **E-17** | `show company financial accounts` | **Blocked**: `Access Restricted: As Employee, you do not have permission to view company financial accounts.` | Finance blocked |
| **E-18** | `update salary of Sana to 500000` | **Blocked**: `Access Restricted: As Employee, you do not have permission to view or manage employee salary updates...` | Salary updates blocked |
| **E-19** | `what is Sana's salary` | Calls `get_salary_details`. Returns `permission_denied: You do not have permission to view this employee's salary.` | Sensitive salary scoping |
| **E-20** | `check attendance of Rohit` | Calls `get_attendance_status`. Returns `permission_denied: You do not have permission to access this employee's attendance.` | Attendance scoping |
| **E-21** | `check leave balance of Sana` | Calls `get_leave_balance`. Returns `permission_denied: You do not have permission to access this employee's leave.` | Leave balance scoping |
| **E-22** | `approve pending leave request` | **Blocked**: `Access Restricted: As Employee, you do not have permission to view or manage approving, rejecting, or modifying employee leave requests...` | Leave approvals blocked |
| **E-23** | `add a new employee to our company` | **Blocked**: `Access Restricted: As Employee, you do not have permission to view or manage adding, updating, or removing employees...` | Employee management blocked |

---

## 8. How to Run These Tests

1. Open your PowerShell terminal in the project folder:
   ```powershell
   python main.py
   ```
2. Enter the number corresponding to the user you wish to test (e.g., `4` for Meera Krishnan [Employee], `5` for Neha Bansal [Finance], `2` for Imran Shaikh [HR], `7` for Rohit Menon [Manager], `1` for Aditi Rao [Admin]).
3. Type the prompt verbatim from the tables above.
4. Verify that:
   - Allowed operations call the proper database tool and return live MongoDB data.
   - Restricted operations return the immediate, clean **`Access Restricted: As {Role}, you do not have permission to view or manage...`** response with **zero hallucinated tables**.
5. Type `exit` to switch users and re-test another role.
