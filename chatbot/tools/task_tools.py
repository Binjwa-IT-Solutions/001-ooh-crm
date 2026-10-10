from langchain_core.tools import tool
from adapters import crm_adapter

@tool
def get_my_tasks(employee_id: str, campaign_id: str = None) -> dict:
    """
    Retrieves tasks assigned to the employee or for a specific campaign.
    Use this to list tasks, check pending tasks, or find overdue tasks.
    """
    return crm_adapter.get_my_tasks(employee_id=employee_id, campaign_id=campaign_id)

@tool
def update_task_status(task_id: str, status: str, proof_id: str = None) -> dict:
    """
    Allows ops/agents to mark tasks as Completed, In Progress, Cancelled, or Pending.
    """
    return crm_adapter.update_task_status(task_id=task_id, status=status, proof_id=proof_id)

@tool
def reassign_tasks(from_employee: str, to_employee: str, task_ids: list = None) -> dict:
    """
    Reassign all or specific tasks from one employee to another employee.
    Provide from_employee (employee name or ID) and to_employee (employee name or ID).
    Optionally provide task_ids list to reassign only specific tasks.
    """
    return crm_adapter.reassign_tasks(from_employee=from_employee, to_employee=to_employee, task_ids=task_ids)

@tool
def create_task(
    title: str,
    assigned_to: str = None,
    deadline: str = None,
    campaign_id: str = None,
    site_id: str = None,
    task_type: str = "Custom"
) -> dict:
    """
    Create a new task in the CRM and assign it to an employee.
    - title: The task description or goal (e.g. 'find leads from dewas').
    - assigned_to: The name or employee ID of the person assigned to this task (e.g. 'Sakshi').
    - deadline: Optional deadline formatted as YYYY-MM-DD.
    - task_type: Optional type (Installation, Printing, Verification, Removal, Custom).
    """
    return crm_adapter.create_task(
        title=title,
        assigned_to=assigned_to,
        deadline=deadline,
        campaign_id=campaign_id,
        site_id=site_id,
        task_type=task_type
    )
