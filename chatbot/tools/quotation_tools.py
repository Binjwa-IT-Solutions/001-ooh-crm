from langchain_core.tools import tool
import adapters.quotation_adapter as quotation_adapter

@tool
def generate_quotation_pdf(quote_number: str) -> dict:
    """
    Generate a professional PDF for a quotation.
    You must provide the exact 'quote_number' (e.g., 'MO-Q-2026-0001').
    The function returns the status and the file path / download URL to the PDF.
    Whenever a user asks to generate, print, or create a PDF for a quotation, use this tool.
    """
    return quotation_adapter.generate_quotation_pdf(quote_number)

@tool
def get_quotations(client_name: str = None, status: str = None, quote_number: str = None) -> dict:
    """
    Get a list of quotations from the database. Returns the count and details of each quotation.
    Optionally filter by 'client_name', 'status' (Draft, Sent, Accepted, Rejected), or 'quote_number'.
    """
    return quotation_adapter.get_quotations(client_name, status, quote_number)

@tool
def update_quotation(quote_number: str, status: str) -> dict:
    """
    Update the status of a quotation.
    You must provide the 'quote_number' (e.g. 'MO-Q-2026-0001') and the new 'status' (Draft, Sent, Accepted, Rejected).
    """
    return quotation_adapter.update_quotation(quote_number, status)
