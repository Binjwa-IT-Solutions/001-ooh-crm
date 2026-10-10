from langchain_core.tools import tool
import adapters.po_adapter as po_adapter

@tool
def generate_po_pdf(po_number: str) -> dict:
    """
    Generate a professional PDF for a Purchase Order (PO).
    You must provide the exact 'po_number' (e.g., 'MO-PO-2026-0001').
    Returns the status and file path.
    """
    return po_adapter.generate_po_pdf(po_number)

@tool
def get_purchase_orders(vendor_name: str = None, status: str = None, po_number: str = None) -> dict:
    """
    Get a list of purchase orders from the database. Returns the count and details of each PO.
    Optionally filter by 'vendor_name', 'status' (Draft, Issued, Cancelled), or 'po_number'.
    """
    return po_adapter.get_purchase_orders(vendor_name, status, po_number)
