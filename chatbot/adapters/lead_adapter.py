from data.db_client import db
from datetime import datetime
import json

leads_collection = db["leads"]

def add_lead(name: str, email: str, phone: str, city: str, budget: float):
    # Determine the status
    status = "New"
    
    # Simple incremental lead code (e.g. MO-L-2026-0005)
    # Ideally, we should fetch the last sequence, but let's just count and pad for now
    count = leads_collection.count_documents({})
    lead_code = f"MO-L-{datetime.now().year}-{str(count + 1).zfill(4)}"
    
    lead_doc = {
        "leadCode": lead_code,
        "clientName": name,
        "email": email,
        "phone": phone,
        "city": city,
        "budget": budget,
        "status": status,
        "source": "Chatbot",
        "createdAt": datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat()
    }
    
    result = leads_collection.insert_one(lead_doc)
    
    if result.inserted_id:
        return {
            "status": "success",
            "message": f"Successfully recorded new lead {lead_code} for {name}.",
            "lead_id": lead_code
        }
    return {"status": "error", "message": "Failed to insert lead into database."}

def _serialize(obj):
    """Recursively convert ObjectId and datetime objects to strings."""
    from bson import ObjectId as OID
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_serialize(item) for item in obj]
    elif isinstance(obj, OID):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    return obj

def _slim_lead(lead):
    """Extract only the fields the LLM needs — strip verbose history/logs."""
    slim = {
        "_id": lead.get("_id"),
        "companyName": lead.get("companyName") or lead.get("clientName"),
        "contactPerson": lead.get("contactPerson") or lead.get("clientName"),
        "mobile": lead.get("mobile") or lead.get("phone"),
        "email": lead.get("email"),
        "city": lead.get("city"),
        "source": lead.get("source"),
        "status": lead.get("status"),
        "assignedTo": lead.get("assignedTo"),
        "claimedBy": lead.get("claimedBy"),
        "nextActionDate": lead.get("nextActionDate"),
        "createdAt": lead.get("createdAt"),
    }
    # Include budget from qualification if available
    qual = lead.get("qualification")
    if qual and isinstance(qual, dict):
        slim["budget"] = qual.get("budget")
        slim["campaignDuration"] = qual.get("campaignDuration")
    elif lead.get("budget") is not None:
        slim["budget"] = lead.get("budget")
    # Remove None values to save tokens
    return {k: v for k, v in slim.items() if v is not None}


def get_leads(assigned_to: str = None, status: str = None):
    query = {}
    if assigned_to:
        query["assignedTo"] = assigned_to
    if status:
        query["status"] = status
        
    results = list(leads_collection.find(query))
    results = [_serialize(r) for r in results]
    
    # Return slimmed-down leads to avoid token overflow in LLM
    slim_results = [_slim_lead(r) for r in results]
    
    # Resolve IDs to agent names
    from utils.id_mapper import resolve_agent_ids
    slim_results = resolve_agent_ids(slim_results, ["assignedTo", "claimedBy"])
    
    return {
        "status": "success",
        "found": len(results) > 0,
        "count": len(results),
        "leads": slim_results
    }

def update_lead(lead_id: str, status: str = None, city: str = None, budget: float = None):
    from bson.objectid import ObjectId
    try:
        oid = ObjectId(lead_id)
    except:
        return {"status": "error", "message": f"Invalid lead_id: {lead_id}"}
    
    update_fields = {"updatedAt": datetime.now().isoformat()}
    if status:
        update_fields["status"] = status
    if city:
        update_fields["city"] = city
    if budget is not None:
        update_fields["budget"] = budget
    
    result = leads_collection.update_one({"_id": oid}, {"$set": update_fields})
    if result.modified_count > 0:
        return {"status": "success", "message": f"Lead {lead_id} updated successfully."}
    return {"status": "error", "message": f"Lead {lead_id} not found or no changes made."}

def claim_lead(lead_id: str, user_id: str):
    from bson.objectid import ObjectId
    try:
        oid = ObjectId(lead_id)
    except:
        return {"status": "error", "message": f"Invalid lead_id: {lead_id}"}
    
    lead = leads_collection.find_one({"_id": oid})
    if not lead:
        return {"status": "error", "message": f"Lead {lead_id} not found."}
    if lead.get("claimedBy"):
        return {"status": "error", "message": f"Lead {lead_id} is already claimed."}
    
    result = leads_collection.update_one({"_id": oid}, {"$set": {
        "claimedBy": ObjectId(user_id),
        "claimedAt": datetime.now().isoformat(),
        "updatedAt": datetime.now().isoformat()
    }})
    if result.modified_count > 0:
        return {"status": "success", "message": f"Lead {lead_id} claimed successfully."}
    return {"status": "error", "message": "Failed to claim lead."}
