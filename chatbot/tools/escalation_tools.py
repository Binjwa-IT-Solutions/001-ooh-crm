from langchain_core.tools import tool
from adapters import crm_adapter

@tool
def get_escalations(manager_id: str = None) -> dict:
    """
    Allows managers to view escalations.
    """
    return crm_adapter.get_escalations(manager_id=manager_id)

@tool
def acknowledge_escalation(escalation_id: str, manager_id: str) -> dict:
    """
    Allows managers to mark an escalation as acknowledged.
    """
    return crm_adapter.acknowledge_escalation(escalation_id=escalation_id, manager_id=manager_id)
