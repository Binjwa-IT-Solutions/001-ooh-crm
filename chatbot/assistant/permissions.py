# assistant/permissions.py

from data.db_client import employees_collection

# ============================================================
# RBAC ROLE-PERMISSION MATRIX
# ============================================================

ROLE_PERMISSIONS = {
    "admin": [
        "*"  # Special wildcard for admin
    ],
    "manager": [
        "users.view", "users.create", "users.delete",
        "leads.view", "leads.create", "leads.update", "leads.assign", "leads.log_call",
        "quotations.view", "quotations.create", "quotations.update",
        "sites.view",
        "bookings.view",
        "vendors.view",
        "purchase_orders.view",
        "campaigns.view", "campaigns.manage",
        "tasks.view", "tasks.manage",
        "proofs.view", "proofs.approve",
        "employees.view", "employees.manage", "employees.self",
        "attendance.self", "attendance.view_team",
        "leave.self", "leave.manage",
        "reports.view", "reports.generate",
        "candidates.view", "candidates.manage"
    ],
    "sales_agent": [
        "leads.view", "leads.create", "leads.claim", "leads.update", "leads.log_call",
        "quotations.view", "quotations.create", "quotations.update",
        "sites.view",
        "bookings.view",
        "campaigns.view",
        "tasks.view",
        "proofs.view",
        "finance.view",
        "employees.self",
        "attendance.self",
        "leave.self"
    ],
    "ops": [
        "sites.view", "sites.manage",
        "bookings.view", "bookings.manage",
        "vendors.view", "vendors.manage",
        "purchase_orders.view", "purchase_orders.manage",
        "campaigns.view", "campaigns.manage",
        "tasks.view", "tasks.manage",
        "proofs.view", "proofs.manage", "proofs.upload",
        "employees.self",
        "attendance.self",
        "leave.self"
    ],
    "finance": [
        "quotations.view",
        "vendors.view",
        "purchase_orders.view",
        "campaigns.view",
        "finance.view", "finance.manage", "finance.bank_details",
        "employees.view", "employees.sensitive",
        "audit.view",
        "employees.self",
        "attendance.self",
        "leave.self"
    ],
    "hr": [
        "users.view",
        "employees.view", "employees.manage", "employees.sensitive",
        "attendance.self", "attendance.view_team",
        "leave.self", "leave.manage",
        "reports.view",
        "candidates.view", "candidates.manage"
    ],
    "employee": [
        "tasks.view",
        "employees.self",
        "attendance.self",
        "leave.self"
    ]
}

# ============================================================
# TOOL-PERMISSION MAPPING
# ============================================================
# Maps a langchain tool name to the set of required permissions.
# The user must have AT LEAST ONE of the permissions in the list.

TOOL_PERMISSIONS = {
    # System & Audit
    "get_role_access": ["users.view", "employees.view", "employees.self"],
    "get_recent_activity": ["audit.view"],
    "generate_analytical_image": ["reports.generate"],

    # Employee
    "get_employee": ["employees.view", "employees.self"],
    "get_employee_performance_summary": ["reports.view"],

    "update_employee": ["users.update", "employees.manage"],
    "add_employee": ["users.create", "employees.manage"],
    "remove_employee": ["users.delete"],

    # Leave
    "get_leave_balance": ["leave.manage", "leave.self"],
    "update_leave_balance": ["leave.manage", "holiday.manage"],
    "apply_for_leave": ["leave.self"],
    "get_pending_leave_requests": ["leave.manage"],
    "approve_leave_request": ["leave.manage"],
    "reject_leave_request": ["leave.manage"],
    "generate_leave_image": ["reports.generate"],

    # Attendance
    "get_attendance_status": ["attendance.view_team", "attendance.self"],
    "update_attendance_status": ["attendance.view_team", "holiday.manage"],

    # Salary / Finance
    "get_salary_details": ["employees.sensitive", "finance.manage", "employees.self", "employees.manage"],
    "update_salary": ["finance.manage"],
    "get_company_finance_summary": ["finance.view"],
    "generate_salary_image": ["reports.generate"],

    # Leads
    "add_lead": ["leads.create"],
    "get_leads": ["leads.view"],
    "update_lead": ["leads.update"],
    "claim_lead": ["leads.claim"],
    "generate_lead_source_image": ["reports.generate"],

    # Quotations
    "generate_quotation_pdf": ["quotations.create"],
    "get_quotations": ["quotations.view"],
    "update_quotation": ["quotations.update"],

    # Purchase Orders
    "generate_po_pdf": ["purchase_orders.manage"],
    "get_purchase_orders": ["purchase_orders.view"],

    # Operations
    "get_sites": ["sites.view"],
    "get_bookings": ["bookings.view"],
    "book_site": ["bookings.manage", "sites.manage"],
    "get_vendors": ["vendors.view"],
    "get_campaigns": ["campaigns.view"],

    # Tasks
    "get_my_tasks": ["tasks.view"],
    "update_task_status": ["tasks.manage"],
    "reassign_tasks": ["tasks.manage"],
    "create_task": ["tasks.manage"],

    # Escalations
    "get_escalations": ["tasks.manage", "escalations.view"],
    "acknowledge_escalation": ["tasks.manage", "escalations.manage"],
}

# ============================================================
# AUTHORIZATION LOGIC
# ============================================================

def has_permission(role, permission):
    """Check if a role has a specific permission string."""
    role = role.lower().strip()
    
    # Handle sales agent role alias
    if role == "sales agent":
        role = "sales_agent"

    perms = ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS["employee"])
    
    if "*" in perms:
        return True
    
    # E.g. finance.* grants all finance permissions
    namespace = permission.split('.')[0]
    if f"{namespace}.*" in perms:
        return True
        
    return permission in perms

def get_allowed_tools(role):
    """Return list of tool names the role is allowed to call."""
    allowed_tools = []
    for tool_name, required_perms in TOOL_PERMISSIONS.items():
        if any(has_permission(role, perm) for perm in required_perms):
            allowed_tools.append(tool_name)
    return allowed_tools

# ============================================================
# HIERARCHY LOGIC
# ============================================================

def get_employee_by_id(employee_id):
    from bson.objectid import ObjectId
    from data.db_client import users_collection
    emp = None
    try:
        emp = employees_collection.find_one({"_id": ObjectId(employee_id)})
    except Exception:
        pass
    if not emp:
        try:
            emp = employees_collection.find_one({"_id": employee_id})
        except Exception:
            pass
    if emp:
        emp["id"] = str(emp["_id"])
        emp["manager_id"] = str(emp["reportingManagerId"]) if emp.get("reportingManagerId") else None
        if not emp.get("role") and emp.get("userId"):
            try:
                user = users_collection.find_one({"_id": emp["userId"]})
                if user and user.get("role"):
                    emp["role"] = user.get("role")
            except Exception:
                pass
        del emp["_id"]
    return emp

def is_in_reporting_chain(superior_id, subordinate_id):
    """
    Returns True if subordinate_id is anywhere under superior_id in the org chart.
    """
    current_emp_id = subordinate_id
    visited = set()
    
    while current_emp_id:
        if current_emp_id in visited:
            break # prevent infinite loops
        visited.add(current_emp_id)
        
        emp = get_employee_by_id(current_emp_id)
        if not emp:
            break
            
        mgr_id = emp.get("manager_id")
        if str(mgr_id) == str(superior_id):
            return True
            
        current_emp_id = mgr_id
        
    return False

# ============================================================
# DATA SCOPING LOGIC
# ============================================================

def can_access_employee(session, target_employee_id):
    """Determine if session can access target employee's basic info."""
    # Global directory access is allowed for all employees.
    # The filter_accessible_employees function ensures sensitive data is scrubbed.
    return True

def can_view_sensitive_employee_data(session, target_employee_id):
    """Determine if session can view sensitive info (salary, email, phone) of target."""
    if str(session.user_id) == str(target_employee_id):
        return True
    if has_permission(session.role, "employees.sensitive"):
        return True
    # Managers can view sensitive details for their direct reports and subordinates
    if session.role.lower() == "manager" and is_in_reporting_chain(session.user_id, target_employee_id):
        return True
    return False

def filter_accessible_employees(session, employees):
    """Filter list of employees down to what the session can access."""
    accessible = []
    for emp in employees:
        emp_id = emp.get("id") or str(emp.get("_id"))
        if can_access_employee(session, emp_id):
            # Apply sensitive filter
            if not can_view_sensitive_employee_data(session, emp_id):
                # When an employee looks up their manager, or anyone looks up someone they can't see sensitive data for,
                # they should only see name, number, and email.
                safe_emp = {
                    "id": emp_id,
                    "name": emp.get("name") or emp.get("fullName"),
                    "role": emp.get("role", "unknown"),
                    "department": emp.get("department", "Unknown"),
                    "contact": emp.get("contact", {})
                }
                accessible.append(safe_emp)
            else:
                accessible.append(emp)
    return accessible

def can_edit_employee(session, target_employee_id):
    if session.user_id == target_employee_id:
        return False # Generally cannot edit own profile except maybe specific self-service fields, handled elsewhere
    if has_permission(session.role, "users.update"):
        return True # Admin
    if has_permission(session.role, "employees.manage"): # Manager and HR
        # Cannot edit admin, manager, hr
        target_emp = get_employee_by_id(target_employee_id)
        if target_emp:
            target_role = target_emp.get("role", "").lower().strip()
            if target_role in ["admin", "manager", "hr"]:
                return False
        return True
    return False

def can_add_employee(session, manager_id):
    if has_permission(session.role, "users.create"):
        return True
    if has_permission(session.role, "employees.manage"):
        return True
    return False

def can_remove_employee(session, employee_id):
    if str(session.user_id) == str(employee_id):
        return False
    if session.role.lower() == "admin":
        return True
    if session.role.lower() == "manager" or has_permission(session.role, "users.delete"):
        # Prevent removing admin or manager
        target_emp = get_employee_by_id(employee_id)
        if target_emp:
            target_role = (target_emp.get("role") or "").lower().strip()
            if target_role in ["admin", "manager"]:
                return False
        return True
    return False

def can_change_hierarchy(session):
    return has_permission(session.role, "users.update")