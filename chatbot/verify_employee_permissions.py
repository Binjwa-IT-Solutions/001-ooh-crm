import sys
from assistant.session import Session
from assistant.permissions import get_allowed_tools, TOOL_PERMISSIONS, ROLE_PERMISSIONS
from assistant.assistant import execute_tool, ask_employee_assistant
from tools import ALL_TOOLS

# Employee session
emp_id = "6a97e6a7437c8ae3d2ec0476"  # Meera Krishnan
session = Session(user_id=emp_id, name="Meera Krishnan", role="employee")

print("=" * 60)
print("1. CHECKING ALLOWED TOOLS FOR EMPLOYEE")
print("=" * 60)
allowed = get_allowed_tools("employee")
print(f"Total allowed tools: {len(allowed)}")
for t in allowed:
    print(f"  [ALLOWED] {t}")

expected_allowed = {
    "get_role_access",
    "get_employee",
    "get_leave_balance",
    "apply_for_leave",
    "get_attendance_status",
    "get_salary_details",
    "get_my_tasks"
}

assert set(allowed) == expected_allowed, f"Expected {expected_allowed}, got {set(allowed)}"
print(">>> Tool set verification: PASSED!\n")

print("=" * 60)
print("2. CHECKING PROHIBITED TOOLS ARE EXCLUDED FROM EMPLOYEE")
print("=" * 60)
prohibited_tools = [
    "update_task_status", "create_task", "reassign_tasks",
    "add_lead", "get_leads", "update_lead", "claim_lead",
    "generate_quotation_pdf", "get_quotations", "update_quotation",
    "generate_po_pdf", "get_purchase_orders",
    "get_sites", "get_bookings", "book_site",
    "get_vendors", "get_campaigns",
    "get_company_finance_summary", "update_salary",
    "get_escalations", "acknowledge_escalation",
    "get_recent_activity", "get_employee_performance_summary",
    "add_employee", "update_employee", "remove_employee",
    "get_pending_leave_requests", "approve_leave_request", "reject_leave_request",
    "update_leave_balance", "update_attendance_status"
]

for tool in prohibited_tools:
    assert tool not in allowed, f"Security violation: {tool} is in employee allowed tools!"
    print(f"  [BLOCKED AS EXPECTED] {tool}")

print(">>> Prohibited tools check: PASSED!\n")

print("=" * 60)
print("3. CHECKING PRE-LLM ACCESS GUARD FOR EMPLOYEE")
print("=" * 60)
restricted_prompts = [
    "Create a new task for printing banners",
    "Update task status of task 123 to Completed",
    "Show company leads",
    "Show client quotations",
    "Show purchase orders",
    "Show sites and hoardings",
    "Show vendors",
    "Show company financial accounts",
    "Update salary of Sana to 500000",
    "Add a new employee to our company",
    "Approve pending leave request",
    "Update attendance of Kabir"
]

for prompt in restricted_prompts:
    resp = ask_employee_assistant(session, prompt)
    assert "Access Restricted" in resp, f"Failed to restrict prompt: '{prompt}' -> {resp}"
    print(f"  [GUARD BLOCKED] '{prompt}'")
    print(f"    -> {resp}\n")

print(">>> Pre-LLM Guard check: PASSED!\n")

print("=" * 60)
print("4. CHECKING SELF-SERVICE SCOPING (OWN DATA vs OTHER DATA)")
print("=" * 60)

other_emp_id = "6a97e6a6437c8ae3d2ec0475"  # Sana Qureshi

# Salary check
own_salary = execute_tool(session, "get_salary_details", ALL_TOOLS["get_salary_details"], {"employee_id": emp_id})
print(f"Own salary check: found={own_salary.get('found', True)}, status={own_salary.get('status')}")
assert own_salary.get("status") != "permission_denied", "Employee should be able to view own salary"

other_salary = execute_tool(session, "get_salary_details", ALL_TOOLS["get_salary_details"], {"employee_id": other_emp_id})
print(f"Other salary check: status={other_salary.get('status')}, msg={other_salary.get('message')}")
assert other_salary.get("status") == "permission_denied", "Employee should NOT be able to view other's salary"

# Leave check
own_leave = execute_tool(session, "get_leave_balance", ALL_TOOLS["get_leave_balance"], {"employee_id": emp_id})
print(f"Own leave check: found={own_leave.get('found')}, status={own_leave.get('status')}")
assert own_leave.get("status") != "permission_denied", "Employee should be able to view own leave"

other_leave = execute_tool(session, "get_leave_balance", ALL_TOOLS["get_leave_balance"], {"employee_id": other_emp_id})
print(f"Other leave check: status={other_leave.get('status')}, msg={other_leave.get('message')}")
assert other_leave.get("status") == "permission_denied", "Employee should NOT be able to view other's leave"

# Attendance check
own_att = execute_tool(session, "get_attendance_status", ALL_TOOLS["get_attendance_status"], {"employee_id": emp_id})
print(f"Own attendance check: found={own_att.get('found')}, status={own_att.get('status')}")
assert own_att.get("status") != "permission_denied", "Employee should be able to view own attendance"

other_att = execute_tool(session, "get_attendance_status", ALL_TOOLS["get_attendance_status"], {"employee_id": other_emp_id})
print(f"Other attendance check: status={other_att.get('status')}, msg={other_att.get('message')}")
assert other_att.get("status") == "permission_denied", "Employee should NOT be able to view other's attendance"

# Tasks check
own_tasks = execute_tool(session, "get_my_tasks", ALL_TOOLS["get_my_tasks"], {"employee_id": emp_id})
print(f"Own tasks check: status={own_tasks.get('status')}, tasks_count={len(own_tasks.get('tasks', []))}")
assert own_tasks.get("status") == "success", "Employee should be able to view own tasks"

print("\n>>> Self-service scoping check: ALL PASSED!")
print("=" * 60)
print("ALL EMPLOYEE RBAC VERIFICATIONS COMPLETED SUCCESSFULLY!")
print("=" * 60)
