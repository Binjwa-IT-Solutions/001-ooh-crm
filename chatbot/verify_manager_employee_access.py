import sys
from bson.objectid import ObjectId
from assistant.session import Session
from assistant.permissions import get_allowed_tools, can_remove_employee, can_add_employee, get_employee_by_id
from assistant.assistant import execute_tool
from tools import ALL_TOOLS
from data.db_client import employees_collection, users_collection

print("=" * 60)
print("1. CHECKING ALLOWED TOOLS ACROSS ROLES")
print("=" * 60)

roles = ["admin", "manager", "hr", "finance", "ops", "sales_agent", "employee"]
for r in roles:
    tools = get_allowed_tools(r)
    has_add = "add_employee" in tools
    has_rem = "remove_employee" in tools
    print(f"Role '{r:12}': total_tools={len(tools):2d} | add_employee={has_add} | remove_employee={has_rem}")
    
    if r == "admin":
        assert has_add and has_rem, "Admin must have both add_employee and remove_employee"
    elif r == "manager":
        assert has_add and has_rem, "Manager must have BOTH add_employee and remove_employee"
        assert len(tools) == 32, f"Manager expected 32 tools, got {len(tools)}"
    elif r == "hr":
        assert has_add, "HR should have add_employee"
        assert not has_rem, "HR must NOT have remove_employee"
    else:
        assert not has_add, f"{r} must NOT have add_employee"
        assert not has_rem, f"{r} must NOT have remove_employee"

print(">>> Role-based tool access: ALL PASSED!\n")

print("=" * 60)
print("2. CHECKING MANAGER EXECUTION & SAFETY GUARDRAILS")
print("=" * 60)

# Rohit Menon (Manager)
mgr_emp = employees_collection.find_one({"fullName": {"$regex": "Rohit Menon", "$options": "i"}})
assert mgr_emp is not None, "Manager Rohit Menon not found in database"
mgr_id = str(mgr_emp["_id"])
mgr_session = Session(user_id=mgr_id, name="Rohit Menon", role="manager")

# Admin (Aditi Rao)
admin_emp = employees_collection.find_one({"fullName": {"$regex": "Aditi Rao", "$options": "i"}})
assert admin_emp is not None, "Admin Aditi Rao not found in database"
admin_id = str(admin_emp["_id"])

# A. Manager adds a test employee
test_emp_name = "QA Auto Test Agent"
test_emp_email = "qa.autotest@mediaoctus.local"

# Cleanup any previous test run leftovers
existing = employees_collection.find_one({"workEmail": test_emp_email})
if existing:
    employees_collection.delete_one({"_id": existing["_id"]})
    users_collection.delete_one({"email": test_emp_email})

add_res = execute_tool(
    mgr_session,
    "add_employee",
    ALL_TOOLS["add_employee"],
    {
        "name": test_emp_name,
        "role": "sales_agent",
        "department": "Sales",
        "manager_id": mgr_id,
        "email": test_emp_email,
        "phone": "9876543299"
    }
)
print(f"Manager add_employee result: status={add_res.get('status')}, id={add_res.get('employee_id')}")
assert add_res.get("status") == "success", f"Manager failed to add employee: {add_res}"
created_emp_id = add_res["employee_id"]

# B. Manager tries to remove Admin -> Must be BLOCKED
rem_admin_res = execute_tool(
    mgr_session,
    "remove_employee",
    ALL_TOOLS["remove_employee"],
    {"employee_id": admin_id}
)
print(f"Manager removing Admin result: status={rem_admin_res.get('status')}, msg={rem_admin_res.get('message')}")
assert rem_admin_res.get("status") == "permission_denied", "Manager should NOT be able to remove Admin"

# C. Manager tries to remove SELF -> Must be BLOCKED
rem_self_res = execute_tool(
    mgr_session,
    "remove_employee",
    ALL_TOOLS["remove_employee"],
    {"employee_id": mgr_id}
)
print(f"Manager removing self result: status={rem_self_res.get('status')}, msg={rem_self_res.get('message')}")
assert rem_self_res.get("status") == "permission_denied", "Manager should NOT be able to remove own account"

# D. Manager removes the newly created test employee -> Must SUCCEED
rem_test_res = execute_tool(
    mgr_session,
    "remove_employee",
    ALL_TOOLS["remove_employee"],
    {"employee_id": created_emp_id}
)
print(f"Manager removing test employee result: status={rem_test_res.get('status')}, msg={rem_test_res.get('message')}")
assert rem_test_res.get("status") == "success", f"Manager failed to remove test employee: {rem_test_res}"

print(">>> Manager safety guardrails & execution: ALL PASSED!\n")

print("=" * 60)
print("3. CHECKING UNAUTHORIZED ROLES REMAIN BLOCKED FROM REMOVE_EMPLOYEE")
print("=" * 60)

# HR Session (Imran Shaikh)
hr_emp = employees_collection.find_one({"fullName": {"$regex": "Imran Shaikh", "$options": "i"}})
hr_id = str(hr_emp["_id"]) if hr_emp else "hr_dummy_id"
hr_session = Session(user_id=hr_id, name="Imran Shaikh", role="hr")

hr_rem = execute_tool(hr_session, "remove_employee", ALL_TOOLS["remove_employee"], {"employee_id": "dummy_id"})
print(f"HR remove_employee execution: status={hr_rem.get('status')}")
assert hr_rem.get("status") == "permission_denied", "HR must be blocked from remove_employee"

# Employee Session (Meera Krishnan)
emp_session = Session(user_id="dummy_emp_id", name="Meera Krishnan", role="employee")
emp_rem = execute_tool(emp_session, "remove_employee", ALL_TOOLS["remove_employee"], {"employee_id": "dummy_id"})
print(f"Employee remove_employee execution: status={emp_rem.get('status')}")
assert emp_rem.get("status") == "permission_denied", "Employee must be blocked from remove_employee"

emp_add = execute_tool(emp_session, "add_employee", ALL_TOOLS["add_employee"], {
    "name": "Should Fail", "role": "sales_agent", "department": "Sales", "manager_id": "none", "email": "fail@test.com", "phone": "123"
})
print(f"Employee add_employee execution: status={emp_add.get('status')}")
assert emp_add.get("status") == "permission_denied", "Employee must be blocked from add_employee"

print(">>> Unauthorized roles blocked: ALL PASSED!\n")
print("=" * 60)
print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY!")
print("=" * 60)
