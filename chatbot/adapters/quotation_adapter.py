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

quotations_collection = db["quotations"]
sites_collection = db["sites"]

class PDF(FPDF):
    def header(self):
        self.set_font("helvetica", "B", 20)
        self.set_text_color(41, 128, 185) # Blue
        self.cell(0, 10, "MEDIA OCTUS CRM", align="L", ln=True)
        self.set_font("helvetica", "", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, "Marketing & Hoarding Solutions", align="L", ln=True)
        self.cell(0, 5, "Email: contact@mediaoctus.com | Phone: +91-9876543210", align="L", ln=True)
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font("helvetica", "I", 8)
        self.set_text_color(128)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

def generate_quotation_pdf(quote_number: str):
    quote = quotations_collection.find_one({"quoteNumber": {"$regex": f"^{quote_number.strip()}$", "$options": "i"}})
    
    if not quote:
        return {"status": "error", "message": f"Quotation {quote_number} not found."}
        
    pdf = PDF()
    pdf.add_page()
    
    # Title
    pdf.set_font("helvetica", "B", 16)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 10, "QUOTATION", align="C", ln=True)
    pdf.ln(5)
    
    # Details
    pdf.set_font("helvetica", "", 11)
    pdf.cell(100, 6, f"Quote No: {quote.get('quoteNumber')}", ln=False)
    created_at = quote.get("createdAt")
    if isinstance(created_at, datetime):
        date_str = created_at.strftime("%Y-%m-%d")
    elif isinstance(created_at, str):
        date_str = created_at.split(" ")[0]
    else:
        date_str = "N/A"
    pdf.cell(0, 6, f"Date: {date_str}", align="R", ln=True)
    
    pdf.cell(100, 6, f"Client: {quote.get('clientName', 'Unknown')}", ln=False)
    valid_until = quote.get("validUntil")
    if isinstance(valid_until, datetime):
        valid_str = valid_until.strftime("%Y-%m-%d")
    elif isinstance(valid_until, str):
        valid_str = valid_until.split(" ")[0]
    else:
        valid_str = "N/A"
    pdf.cell(0, 6, f"Valid Until: {valid_str}", align="R", ln=True)
    
    pdf.cell(0, 6, f"Email: {quote.get('clientEmail', '')}", ln=True)
    pdf.cell(0, 6, f"Phone: {quote.get('clientPhone', '')}", ln=True)
    pdf.ln(10)
    
    # Table Header (Total width 190)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_fill_color(230, 230, 230)
    pdf.cell(38, 10, "Site Code", border=1, fill=True)
    pdf.cell(42, 10, "City & Type", border=1, fill=True)
    pdf.cell(25, 10, "Duration", border=1, fill=True)
    pdf.cell(42, 10, "Rate/Day (INR)", border=1, fill=True)
    pdf.cell(43, 10, "Amount (INR)", border=1, fill=True, ln=True)
    
    # Table Body
    pdf.set_font("helvetica", "", 10)
    for site_item in quote.get("sites", []):
        site_doc = sites_collection.find_one({"_id": site_item.get("siteId")}) if site_item.get("siteId") else None
        
        site_code = site_doc.get("code", "Unknown") if site_doc else "Unknown"
        city_type = f"{site_doc.get('city', '')} {site_doc.get('type', '')}" if site_doc else "Custom"
        
        pdf.cell(38, 10, site_code, border=1)
        pdf.cell(42, 10, city_type, border=1)
        pdf.cell(25, 10, f"{site_item.get('days', 0)} days", border=1)
        
        rate_inr = float(site_item.get('ratePerDay', 0))
        amount_inr = float(site_item.get('amount', 0))
        
        pdf.cell(42, 10, f"{rate_inr:,.2f}", border=1)
        pdf.cell(43, 10, f"{amount_inr:,.2f}", border=1, ln=True)
        
    pdf.ln(5)
    
    # Totals
    pdf.set_font("helvetica", "B", 10)
    subtotal_inr = float(quote.get('subtotal', 0))
    tax_inr = float(quote.get('taxAmount', 0))
    total_inr = float(quote.get('total', 0))
    
    pdf.cell(147, 10, "Subtotal (INR):", align="R")
    pdf.cell(43, 10, f"{subtotal_inr:,.2f}", border=1, ln=True)
    
    pdf.cell(147, 10, f"Tax ({quote.get('taxPercent', 18)}%):", align="R")
    pdf.cell(43, 10, f"{tax_inr:,.2f}", border=1, ln=True)
    
    pdf.cell(147, 10, "Total (INR):", align="R")
    pdf.cell(43, 10, f"{total_inr:,.2f}", border=1, ln=True)
    
    # Output
    output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "generated")
    os.makedirs(output_dir, exist_ok=True)
    
    file_name = f"{quote_number}.pdf"
    file_path = os.path.join(output_dir, file_name)
    
    try:
        pdf.output(file_path)
    except Exception as e:
        return {"status": "error", "message": f"Failed to generate PDF: {str(e)}"}
        
    return {
        "status": "success",
        "message": f"Quotation {quote_number} generated successfully.",
        "file_path": file_path,
        "download_url": f"/files/generated/{file_name}"
    }

def get_quotations(client_name: str = None, status: str = None, quote_number: str = None):
    query = {"deletedAt": None}
    if client_name:
        query["clientName"] = {"$regex": client_name, "$options": "i"}
    if status:
        query["status"] = {"$regex": f"^{status.strip()}$", "$options": "i"}
    if quote_number:
        query["quoteNumber"] = {"$regex": quote_number, "$options": "i"}
    
    results = list(quotations_collection.find(query))
    results = [_serialize(r) for r in results]
    from utils.id_mapper import resolve_agent_ids
    results = resolve_agent_ids(results, ["createdBy", "assignedTo", "approvedBy", "managerId"])
    
    return {
        "status": "success",
        "found": len(results) > 0,
        "count": len(results),
        "quotations": results
    }

def update_quotation(quote_number: str, status: str = None):
    quote = quotations_collection.find_one({"quoteNumber": {"$regex": f"^{quote_number.strip()}$", "$options": "i"}})
    if not quote:
        return {"status": "error", "message": f"Quotation {quote_number} not found."}
    
    update_fields = {"updatedAt": datetime.now()}
    if status:
        update_fields["status"] = status
    
    result = quotations_collection.update_one({"_id": quote["_id"]}, {"$set": update_fields})
    if result.modified_count > 0:
        return {"status": "success", "message": f"Quotation {quote_number} updated to status '{status}'."}
    return {"status": "error", "message": f"No changes made to quotation {quote_number}."}
