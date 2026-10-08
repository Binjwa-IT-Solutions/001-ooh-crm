# tools/attendance_tools.py

from langchain_core.tools import tool
import adapters.crm_adapter as crm_adapter

@tool
def get_attendance_status(name: str = None, employee_id: str = None, date: str = None) -> dict:
    """
    Get the attendance status of an employee.
    You must provide EITHER their 'name' OR their 'employee_id'.
    You can optionally provide a 'date' in YYYY-MM-DD format to check historical attendance. If omitted, checks today's attendance.
    """
    return crm_adapter.get_attendance_status(
        employee_id=employee_id,
        name=name,
        date=date
    )

@tool
def update_attendance_status(employee_id: str, status: str, date: str = None) -> dict:
    """
    Update an employee's attendance status.
    You must provide the 'employee_id' and the new 'status' (Present, Absent, Leave, Half-Day).
    You can optionally provide a 'date' in YYYY-MM-DD format. If omitted, updates today's attendance.
    """
    return crm_adapter.update_attendance_status(
        employee_id=employee_id,
        status=status,
        date=date
    )