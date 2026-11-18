# tools/employee_tools.py

from langchain_core.tools import tool

from adapters import crm_adapter

# ============================================================
# GET EMPLOYEE
# ============================================================

@tool
def get_employee(
    name: str = None,
    employee_id: str = None,
    manager_id: str = None,
    department: str = None,
    role: str = None,
    has_direct_reports: bool = None
):
    """
    Search the company employee directory.

    Use name when the user provides an employee name.

    Use employee_id when the user provides a specific
    employee ID.

    Use manager_id to find all employees managed by a specific manager.

    Use department to find all employees in a specific department.
    
    Use role to find employees with a specific role (e.g. 'manager', 'agent', 'admin').
    
    Use has_direct_reports=True to find employees who manage someone else (i.e., have direct reports, or "have someone under them"). If a user asks for people who have employees under them, you MUST use this argument.

    Returns all matching employees.
    """
    return crm_adapter.get_employee(
        name=name,
        employee_id=employee_id,
        manager_id=manager_id,
        department=department,
        role=role,
        has_direct_reports=has_direct_reports
    )


# ============================================================
# UPDATE EMPLOYEE
# ============================================================

@tool
def update_employee(
    employee_id: str,
    department: str = None,
    manager_id: str = None,
    role: str = None,
    phone: str = None,
    email: str = None
):
    """
    Update an employee's profile information.
    You must specify the employee_id.
    You can update department, manager_id, role, phone, or email.
    """
    return crm_adapter.update_employee(
        employee_id=employee_id,
        department=department,
        manager_id=manager_id,
        role=role,
        phone=phone,
        email=email
    )


# ============================================================
# ADD EMPLOYEE
# ============================================================

@tool
def add_employee(
    name: str,
    role: str,
    department: str,
    manager_id: str,
    email: str,
    phone: str,
    annual_ctc: float = None,
    leave_allocated: int = 3,
    leave_used: int = 0,
    initial_task: str = None
):
    """
    Add a new employee to the company directory.
    - name, role, department, manager_id (or manager name like 'Rohit'), email, phone are required.
    - annual_ctc: Optional annual CTC salary figure (e.g. 6000000).
    - leave_allocated: Optional monthly allocated paid leaves (defaults to 3).
    - leave_used: Optional monthly paid leaves already used (defaults to 0).
    - initial_task: Optional initial task to immediately assign to this new employee (e.g. 'find leads from dewas').
    """
    return crm_adapter.add_employee(
        name=name,
        role=role,
        department=department,
        manager_id=manager_id,
        email=email,
        phone=phone,
        annual_ctc=annual_ctc,
        leave_allocated=leave_allocated,
        leave_used=leave_used,
        initial_task=initial_task
    )


# ============================================================
# REMOVE EMPLOYEE
# ============================================================

@tool
def remove_employee(
    name: str = None,
    employee_id: str = None,
    reassign_tasks_to: str = None,
    reassign_leads_to: str = None
):
    """
    Remove or offboard an employee from the company directory (Admin and Manager).
    
    Use name (e.g. 'Test User', 'testuser') or employee_id to specify the employee to remove.
    Optionally provide reassign_tasks_to (name or ID of employee to receive their open tasks, e.g. 'tarun').
    Optionally provide reassign_leads_to (name or ID of employee to receive their active leads).
    
    This will also delete their leave balances and attendance records, and automatically reassign their direct reports to management.
    """
    return crm_adapter.remove_employee(
        name=name,
        employee_id=employee_id,
        reassign_tasks_to=reassign_tasks_to,
        reassign_leads_to=reassign_leads_to
    )


# ============================================================
# PERFORMANCE SUMMARY TOOL
# ============================================================

@tool
def get_employee_performance_summary(
    department: str = None,
    employee_name: str = None
) -> dict:
    """
    Retrieve deterministic, objective employee performance ratings and reports.
    Evaluates completed tasks, active sales leads, quotation generation, site bookings,
    leave utilization, and attendance consistency across employees and departments.
    Use this whenever the user asks for:
    - 'performance report' or 'employee performance'
    - 'highest performer' or 'top performance'
    - 'lowest performance' or 'poor performance' or 'who needs attention'
    - 'department performance' (e.g. HR performance, sales performance)
    """
    return crm_adapter.get_employee_performance_summary(
        department=department,
        employee_name=employee_name
    )

# ============================================================
# HIRING AND FIRING METRICS
# ============================================================

@tool
def get_hiring_and_firing_metrics(
    year: int = None,
    month: int = None
) -> dict:
    """
    Retrieve deterministic, exact metrics and names of employees who were hired (onboarded)
    and fired (offboarded) within a specific month and year.
    Use this whenever the user asks for:
    - 'hiring metrics', 'how many hired', 'who was onboarded'
    - 'firing metrics', 'how many fired', 'who was offboarded'
    Returns exact counts and lists of employees.
    """
    return crm_adapter.get_hiring_and_firing_metrics(year=year, month=month)
