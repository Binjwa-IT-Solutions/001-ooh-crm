# tools/__init__.py

from tools.employee_tools import (
    get_employee,
    update_employee,
    add_employee,
    remove_employee,
    get_employee_performance_summary
)

from tools.leave_tools import (
    get_leave_balance,
    update_leave_balance
)

from tools.attendance_tools import (
    get_attendance_status,
    update_attendance_status
)

from tools.salary_tools import (
    get_salary_details,
    update_salary,
    generate_salary_image
)

from tools.finance_tools import (
    get_company_finance_summary
)

from tools.lead_tools import (
    add_lead,
    get_leads,
    update_lead,
    claim_lead,
    generate_lead_source_image
)

from tools.quotation_tools import (
    generate_quotation_pdf,
    get_quotations,
    update_quotation
)

from tools.po_tools import (
    generate_po_pdf,
    get_purchase_orders
)

from tools.operations_tools import (
    get_sites,
    get_bookings,
    book_site,
    get_vendors,
    get_campaigns
)

from tools.leave_tools import (
    apply_for_leave,
    get_pending_leave_requests,
    approve_leave_request,
    reject_leave_request,
    generate_leave_image
)

from tools.task_tools import (
    get_my_tasks,
    update_task_status,
    reassign_tasks,
    create_task
)

from tools.escalation_tools import (
    get_escalations,
    acknowledge_escalation
)

from tools.system_tools import (
    get_role_access,
    get_recent_activity,
    generate_analytical_image
)


ALL_TOOLS = {
    # System & Permissions
    "get_role_access": get_role_access,
    "get_recent_activity": get_recent_activity,
    "generate_analytical_image": generate_analytical_image,

    # Employee
    "get_employee": get_employee,
    "update_employee": update_employee,
    "add_employee": add_employee,
    "remove_employee": remove_employee,
    "get_employee_performance_summary": get_employee_performance_summary,

    # Leave
    "get_leave_balance": get_leave_balance,
    "update_leave_balance": update_leave_balance,
    "apply_for_leave": apply_for_leave,
    "get_pending_leave_requests": get_pending_leave_requests,
    "approve_leave_request": approve_leave_request,
    "reject_leave_request": reject_leave_request,
    "generate_leave_image": generate_leave_image,

    # Attendance
    "get_attendance_status": get_attendance_status,
    "update_attendance_status": update_attendance_status,

    # Salary / Finance
    "get_salary_details": get_salary_details,
    "update_salary": update_salary,
    "get_company_finance_summary": get_company_finance_summary,
    "generate_salary_image": generate_salary_image,

    # Leads
    "add_lead": add_lead,
    "get_leads": get_leads,
    "update_lead": update_lead,
    "claim_lead": claim_lead,
    "generate_lead_source_image": generate_lead_source_image,

    # Quotations
    "generate_quotation_pdf": generate_quotation_pdf,
    "get_quotations": get_quotations,
    "update_quotation": update_quotation,

    # Purchase Orders
    "generate_po_pdf": generate_po_pdf,
    "get_purchase_orders": get_purchase_orders,

    # Operations
    "get_sites": get_sites,
    "get_bookings": get_bookings,
    "book_site": book_site,
    "get_vendors": get_vendors,
    "get_campaigns": get_campaigns,

    # Tasks
    "get_my_tasks": get_my_tasks,
    "update_task_status": update_task_status,
    "reassign_tasks": reassign_tasks,
    "create_task": create_task,

    # Escalations
    "get_escalations": get_escalations,
    "acknowledge_escalation": acknowledge_escalation,
}