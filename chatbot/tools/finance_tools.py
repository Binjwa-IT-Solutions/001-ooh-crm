from langchain_core.tools import tool
import adapters.crm_adapter as crm_adapter

@tool
def get_company_finance_summary() -> dict:
    """
    Get a high-level summary of the company's overall finances.
    Includes total revenue, expenses, net profit, cash reserves, and outstanding invoices.
    """
    return crm_adapter.get_company_finance_summary()
