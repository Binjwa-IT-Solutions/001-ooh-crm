from data.db_client import db
import os
from fpdf import FPDF
from datetime import datetime
from bson.objectid import ObjectId

def _serialize(obj):
    """Recursively convert ObjectId and datetime objects to strings."""
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_serialize(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    return obj

po_collection = db["purchaseorders"]
vendors_collection = db["vendors"]
sites_collection = db["sites"]

class PDF(FPDF):
    def header(self):
        self.set_font("helvetica", "B", 20)
        self.set_text_color(39, 174, 96) # Green
        self.cell(0, 10, "MEDIA OCTUS CRM", align="L", ln=True)
        self.set_font("helvetica", "", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, "Marketing & Hoarding Solutions", align="L", ln=True)
        self.cell(0, 5, "Email: finance@mediaoctus.com | Phone: +91-9876543210", align="L", ln=True)
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font("helvetica", "I", 8)
        self.set_text_color(128)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

def generate_po_pdf(po_number: str):
    po = po_collection.find_one({"poNumber": {"$regex": f"^{po_number.strip()}$", "$options": "i"}})
    
    if not po:
        return {"status": "error", "message": f"Purchase Order {po_number} not found."}
        
    vendor = vendors_collection.find_one({"_id": po.get("vendorId")}) if po.get("vendorId") else None
    
    pdf = PDF()
    pdf.add_page()
    
    # Title
    pdf.set_font("helvetica", "B", 16)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 10, "PURCHASE ORDER", align="C", ln=True)
    pdf.ln(5)
    
    # Details
    pdf.set_font("helvetica", "", 11)
    pdf.cell(100, 6, f"PO Number: {po.get('poNumber')}", ln=False)
    
    issued_at = po.get("issuedAt") or po.get("createdAt")
    if isinstance(issued_at, datetime):
        date_str = issued_at.strftime("%Y-%m-%d")
    elif isinstance(issued_at, str):
        date_str = issued_at.split(" ")[0]
    else:
        date_str = "N/A"
        
    pdf.cell(0, 6, f"Issue Date: {date_str}", align="R", ln=True)
    
    vendor_name = vendor.get('name', 'Unknown') if vendor else 'Unknown'
    pdf.cell(100, 6, f"Vendor: {vendor_name}", ln=False)
    pdf.cell(0, 6, f"Status: {po.get('status', 'Unknown')}", align="R", ln=True)
    
    if vendor:
        pdf.cell(0, 6, f"Vendor Email: {vendor.get('email', '')}", ln=True)
        pdf.cell(0, 6, f"Vendor Phone: {vendor.get('mobile', '')}", ln=True)
    pdf.ln(10)
    
    # Table Header
    pdf.set_font("helvetica", "B", 10)
    pdf.set_fill_color(230, 230, 230)
    pdf.cell(30, 10, "Site ID", border=1, fill=True)
    pdf.cell(60, 10, "Dates", border=1, fill=True)
    pdf.cell(20, 10, "Days", border=1, fill=True)
    pdf.cell(40, 10, "Rate/Day (INR)", border=1, fill=True)
    pdf.cell(40, 10, "Amount (INR)", border=1, fill=True, ln=True)
    
    # Table Body
    pdf.set_font("helvetica", "", 10)
    for item in po.get("lineItems", []):
        site_doc = sites_collection.find_one({"_id": item.get("siteId")}) if item.get("siteId") else None
        site_code = site_doc.get("code", "Unknown") if site_doc else "Unknown"
        
        from_date = item.get("from").strftime("%Y-%m-%d") if isinstance(item.get("from"), datetime) else ""
        to_date = item.get("to").strftime("%Y-%m-%d") if isinstance(item.get("to"), datetime) else ""
        date_range = f"{from_date} to {to_date}"
        
        pdf.cell(30, 10, site_code, border=1)
        pdf.cell(60, 10, date_range, border=1)
        pdf.cell(20, 10, str(item.get('days', 0)), border=1)
        
        rate_inr = float(item.get('negotiatedRatePerDay', 0))
        amount_inr = float(item.get('amount', 0))
        
        pdf.cell(40, 10, f"{rate_inr:,.2f}", border=1)
        pdf.cell(40, 10, f"{amount_inr:,.2f}", border=1, ln=True)
        
    pdf.ln(5)
    
    # Totals
    pdf.set_font("helvetica", "B", 10)
    total_inr = float(po.get('totalAmount', 0))
    
    pdf.cell(150, 10, "Total (INR):", align="R")
    pdf.cell(40, 10, f"{total_inr:,.2f}", border=1, ln=True)
    
    # Output
    output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "generated")
    os.makedirs(output_dir, exist_ok=True)
    
    file_name = f"{po_number}.pdf"
    file_path = os.path.join(output_dir, file_name)
    
    try:
        pdf.output(file_path)
    except Exception as e:
        return {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        
    return {
        "status": "success",
        "message": f"Purchase Order {po_number} generated successfully.",
        "file_path": file_path,
        "download_url": f"/files/generated/{file_name}"
    }

def get_purchase_orders(vendor_name: str = None, status: str = None, po_number: str = None):
    query = {"deletedAt": None}
    if po_number:
        query["poNumber"] = {"$regex": po_number, "$options": "i"}
    if status:
        query["status"] = {"$regex": f"^{status.strip()}$", "$options": "i"}
    
    results = list(po_collection.find(query))
    # Enrich with vendor names before serializing
    for r in results:
        if r.get("vendorId"):
            vendor = vendors_collection.find_one({"_id": r["vendorId"]})
            r["vendorName"] = vendor.get("name", "Unknown") if vendor else "Unknown"
    results = [_serialize(r) for r in results]
    
    # Filter by vendor name after lookup if specified
    if vendor_name:
        results = [r for r in results if vendor_name.lower() in r.get("vendorName", "").lower()]
    
    from utils.id_mapper import resolve_agent_ids
    results = resolve_agent_ids(results, ["createdBy", "approvedBy"])
    return {
        "status": "success",
        "found": len(results) > 0,
        "count": len(results),
        "purchase_orders": results
    }
