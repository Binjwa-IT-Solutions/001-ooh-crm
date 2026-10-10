# Media Octus CRM AI Assistant — Comprehensive Project Documentation

## 1. Executive Summary & Objective

### What Are We Doing?
We have built an enterprise-grade, conversational **CRM AI Assistant** for **Media Octus**, an outdoor advertising and media management company. 

Instead of forcing employees and managers to navigate complex multi-page web dashboards, fill out static forms, or run manual database queries, they can simply talk to the AI Assistant in plain, natural human language. The assistant acts as an intelligent internal operator: executing lookups, updating records, approving workflows, generating official PDF documents, and auditing activities—all in real-time.

---

## 2. Key Capabilities: What Can the Project Do?

The assistant supports **33 distinct operational tools** wired directly to a live **MongoDB database** (`media-octus-crm`), partitioned across the following core company domains:

### A. Human Resources & Employee Management
* **Employee Lookup & Directory:** Search employee profiles by name, ID, department, or role, and check who has direct reports under them.
* **Profile Management:** Update contact info, phone, email, departments, and manager reporting chains.
* **Onboarding & Offboarding:** Add new team members or safely remove employees with automatic reassignment of their subordinates to Admin.
* **Sensitive Salary Access:** Restrict access to salary details, monthly rates, and annual CTCs only to authorized roles (Admin, HR, Finance, or self).

### B. Leave & Attendance Operations
* **Balance Tracking:** Check leave allocations (paid, sick, casual leaves).
* **Self-Service Leave Application:** Employees can apply for leaves directly through chat.
* **Managerial Approval Workflows:** Managers and HR can view pending leave requests and approve or reject them with real-time balance deductions.
* **Attendance Tracking & Corrections:** View daily/monthly attendance statuses (Present, Absent, Half-Day) and allow authorized managers or HR to update records.

### C. Sales Pipeline & Client Quotations
* **Lead Ingestion & Assignment:** Add incoming customer leads, view the sales pipeline, update lead statuses (Contacted, Won, Lost), or assign leads to sales reps.
* **Lead Claiming:** Sales agents can claim unassigned leads for themselves.
* **Automated Quotation Generation:** Generate official client quotation PDFs on demand with dynamic cost calculations and site assignments.

### D. Media Operations & Inventory Management
* **Outdoor Media Sites:** View and query outdoor advertising sites/billboards, dimensions, locations, pricing, and availability.
* **Site Bookings & Campaigns:** Track which client has booked which site across specific date ranges.
* **Vendor Management:** Maintain vendor contacts, rates, and supply contracts.
* **Purchase Orders (POs):** Generate formal Purchase Order PDFs for media vendors.

### E. Tasks & System Escalations
* **Task Management:** Query assigned tasks, update task statuses (Pending, In Progress, Completed), and enforce proof-of-work submission.
* **Escalations:** Alert managers to operational bottlenecks and allow managers to formally acknowledge escalations.

### F. Governance, Role Permissions & Audit Trails
* **Role & Permission Inspection (`get_role_access`):** Explain what permissions and tool capabilities any role or specific employee possesses.
* **Database Activity & Audit Logs (`get_recent_activity`):** Query the MongoDB `auditlogs` collection to see who made recent updates, creations, deletions, or logins across the company.

---

## 3. Architectural Approaches & Engineering Solutions

The project uses a **multi-tier, zero-trust architecture** designed for data privacy, reliability, and token efficiency:

```
                  +-----------------------------------+
                  |         User Prompt (CLI)         |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |      Session & Identity Layer     |
                  |     (Logged-in User & Role)       |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |      Layer 1: RBAC Filtering      |
                  | (Prunes 33 tools to allowed tools)|
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |    Layer 2: Agent Router Engine   |
                  | (Extracts Domain: HR/SALES/OPS..) |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  | Multi-Provider LLM Fallback Chain |
                  |   Gemini 3.8 -> Groq -> Ollama    |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |     Layer 3: Tool Execution &     |
                  |        Data-Scoping Guard         |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |    MongoDB Live Database Layer    |
                  +-----------------------------------+
```

### 1. Multi-Tier Role-Based Access Control (RBAC)
Security is never left to the discretion of the LLM:
* **Tool Visibility Enforcement:** If an employee is logged in with the `sales_agent` role, the assistant will never receive schemas for HR management tools or administrative commands.
* **Backend Interceptor:** If an LLM hallucinates a tool call outside the user's permission set, Python execution code intercepts and blocks the call with a `permission_denied` error.
* **Data Scoping:** Even if a manager calls `get_employee`, backend filters automatically redact sensitive salary data and hide employees who are not in the manager's reporting hierarchy.

### 2. Intelligent Agent Router (Dynamic Tool Pruning)
* **The Challenge:** Providing all 33 tool schemas simultaneously consumed ~4,000 tokens on every prompt, rapidly exceeding free-tier rate limits (such as Groq's 7,000 Input Tokens Per Minute limit).
* **The Fix:** An **Agent Router** (`assistant/router.py`) classifies incoming queries into specific operational domains:
  - **HR Domain:** ~12 tools (employee management, leaves, attendance)
  - **SALES Domain:** ~8 tools (leads, quotations)
  - **OPS Domain:** ~8 tools (sites, bookings, vendors, purchase orders)
  - **TASKS Domain:** ~5 tools (tasks, escalations)
  - **GENERAL Domain:** ~8 tools (permissions, audit logs, overview)
* **Result:** Token consumption dropped by **65%**, providing fast responses without token overflow errors.

### 3. Multi-Provider LLM Failover Chain
To ensure maximum availability, the application features an automatic fallback chain configured in `config/settings.py`:
1. **Primary Provider: Google Gemini** (`gemini-3.6-flash`)
2. **Secondary Failover: Groq** (`llama3-70b-8192` / `qwen-2.5-32b`)
3. **Local Offline Failover: Ollama** (`llama3.1`)
* If a provider returns a 429 quota error or experiences a network failure, the application seamlessly delegates the prompt to the next provider in the chain without terminating the user session.

### 4. Direct MongoDB Database Integration
All dummy JSON storage (`db.json`) has been replaced with live database operations via `pymongo`:
* Live collections: `employees`, `users`, `leaverequests`, `leavebalances`, `attendances`, `tasks`, `escalations`, `auditlogs`, `sites`, `leads`, `quotations`, `purchaseorders`, `vendors`.
* Real-time read and write operations ensure updates made via chat are immediately reflected across the company.

### 5. Multi-Turn Conversational Memory & Disambiguation
* **Context Preservation:** Remembers the active employee in the conversation. When a user asks *"What is his attendance?"* after discussing Rohit Menon, the assistant resolves `"his"` to Rohit Menon's ID.
* **Disambiguation Guard:** If a search matches multiple individuals with the same first name, the assistant prompts the user for clarification rather than making assumptions.

---

## 4. Complete Inventory of Implemented Tools (36 Total)

| Domain | Tool Name | Description |
|---|---|---|
| **System & Audit** | `get_role_access` | Query permissions, scopes, and tool access for any role or member |
| | `get_recent_activity` | Inspect recent database updates, creations, logins, and audit logs |
| **Employee & HR** | `get_employee` | Search employee directory by name, ID, manager, or department |
| | `get_employee_performance_summary` | Deterministic performance reports, highest/lowest rankings, task/leave metrics |
| | `update_employee` | Update employee profile, contact details, or role |
| | `add_employee` | Onboard a new employee into the system |
| | `remove_employee` | Remove an employee and reassign direct reports |
| | `get_salary_details` | Retrieve base salary, currency, and daily rate (restricted) |
| | `update_salary` | Update or increase employee salary/annual CTC (Admin/Finance only) |
| **Leaves** | `get_leave_balance` | Check paid, sick, or casual leave balances |
| | `update_leave_balance` | Adjust or credit employee leave balances |
| | `apply_for_leave` | Submit a personal leave application |
| | `get_pending_leave_requests`| List pending leave applications for team members |
| | `approve_leave_request` | Approve a leave request and deduct balances |
| | `reject_leave_request` | Reject a leave request |
| **Attendance** | `get_attendance_status` | Check attendance for an employee on a given date |
| | `update_attendance_status` | Mark or alter attendance (Present, Absent, Half-day) |
| **Sales** | `add_lead` | Record a new client sales lead |
| | `get_leads` | View and filter sales leads |
| | `update_lead` | Update lead status, contact details, or notes |
| | `claim_lead` | Assign an unassigned lead to oneself |
| **Quotations** | `generate_quotation_pdf` | Generate formal client quotation PDF |
| | `get_quotations` | List existing quotations |
| | `update_quotation` | Update quotation pricing or status |
| **Operations** | `get_sites` | Query available outdoor advertising sites and locations |
| | `get_bookings` | Review site booking schedules and reservations |
| | `book_site` | Book a site for dates with double-booking prevention |
| | `get_vendors` | View vendor contact information and contracts |
| | `get_campaigns` | Track live advertising campaigns |
| | `generate_po_pdf` | Create Purchase Order PDFs for media vendors |
| | `get_purchase_orders` | List issued purchase orders |
| | `get_company_finance_summary`| Summarize operational and company finances |
| **Tasks** | `get_my_tasks` | Fetch tasks assigned to the active user |
| | `update_task_status` | Update task progress or submit work proof |
| **Escalations** | `get_escalations` | View escalated issues requiring managerial attention |
| | `acknowledge_escalation` | Manager acknowledgment of an escalation ticket |

---

## 5. Summary of System Roles & Access Levels

* **Admin (`admin`):** Unrestricted access (`*`) to all 33 tools, company finances, audit logs, and employee hierarchy changes.
* **Human Resources (`hr`):** Full control over employee profiles, salary visibility, candidate pipelines, leave approvals, and attendance management. Locked out of sales and media operations.
* **Manager (`manager`):** Oversight of direct reports, approval of team leaves, team attendance visibility, sales lead management, campaign tracking, and task escalations.
* **Sales Agent (`sales_agent`):** Lead generation, lead claiming, client quotation creation, campaign viewing, and personal attendance/leave management.
* **Operations (`ops`):** Management of billboard sites, bookings, vendor relationships, purchase order generation, work proof review, and task execution.
* **Finance (`finance`):** Quotation reviews, vendor payouts, PO approvals, sensitive salary oversight, and system audit log access.
* **Employee (`employee`):** Self-service portal for personal attendance, personal leave balance, leave requests, and assigned tasks.
