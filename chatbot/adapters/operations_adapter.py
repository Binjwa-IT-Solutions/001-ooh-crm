from data.db_client import db
from bson.objectid import ObjectId
from datetime import datetime

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

sites_collection = db["sites"]
bookings_collection = db["sitebookings"]
vendors_collection = db["vendors"]
campaigns_collection = db["campaigns"]

def get_sites(city: str = None, status: str = None, site_type: str = None):
    query = {"deletedAt": None}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if status:
        query["status"] = {"$regex": f"^{status.strip()}$", "$options": "i"}
    if site_type:
        query["type"] = {"$regex": site_type, "$options": "i"}
    
    results = list(sites_collection.find(query))
    results = [_serialize(r) for r in results]
    from utils.id_mapper import resolve_agent_ids
    results = resolve_agent_ids(results, ["createdBy", "managerId"])
    return {
        "status": "success",
        "found": len(results) > 0,
        "count": len(results),
        "sites": results
    }

def get_bookings(site_id: str = None, campaign_id: str = None):
    query = {}
    if site_id:
        try:
            query["siteId"] = ObjectId(site_id)
        except:
            return {"status": "error", "message": f"Invalid site_id: {site_id}"}
    if campaign_id:
        try:
            query["campaignId"] = ObjectId(campaign_id)
        except:
            return {"status": "error", "message": f"Invalid campaign_id: {campaign_id}"}
    
    results = list(bookings_collection.find(query))
    # Enrich with site codes before serializing
    for r in results:
        if r.get("siteId"):
            site = sites_collection.find_one({"_id": r["siteId"]})
            r["siteCode"] = site.get("code", "Unknown") if site else "Unknown"
    results = [_serialize(r) for r in results]
    from utils.id_mapper import resolve_agent_ids
    results = resolve_agent_ids(results, ["createdBy", "assignedTo"])
    return {
        "status": "success",
        "found": len(results) > 0,
        "count": len(results),
        "bookings": results
    }

def get_vendors(name: str = None, city: str = None, status: str = None):
    query = {"deletedAt": None}
    if name:
        query["name"] = {"$regex": name, "$options": "i"}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if status:
        query["status"] = {"$regex": f"^{status.strip()}$", "$options": "i"}
    
    results = list(vendors_collection.find(query))
    results = [_serialize(r) for r in results]
    return {
        "status": "success",
        "found": len(results) > 0,
        "count": len(results),
        "vendors": results
    }

def get_campaigns(name: str = None, city: str = None, status: str = None):
    query = {"deletedAt": None}
    if name:
        query["name"] = {"$regex": name, "$options": "i"}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if status:
        query["status"] = {"$regex": f"^{status.strip()}$", "$options": "i"}
    
    results = list(campaigns_collection.find(query))
    results = [_serialize(r) for r in results]
    from utils.id_mapper import resolve_agent_ids
    results = resolve_agent_ids(results, ["createdBy", "managerId"])
    return {
        "status": "success",
        "found": len(results) > 0,
        "count": len(results),
        "campaigns": results
    }

def book_site(site_code_or_id: str, start_date: str, end_date: str = None, campaign_name_or_id: str = None):
    """
    Books a site for the specified date range.
    Enforces double-booking validation: if the site is already booked for any date
    within the requested range, the booking is rejected and overlapping dates are reported.
    """
    if not end_date:
        end_date = start_date

    try:
        start_dt = datetime.strptime(start_date.strip(), "%Y-%m-%d")
        end_dt = datetime.strptime(end_date.strip(), "%Y-%m-%d")
    except Exception as e:
        return {
            "status": "error",
            "message": f"Invalid date format. Expected YYYY-MM-DD. Error: {str(e)}"
        }

    if end_dt < start_dt:
        return {
            "status": "error",
            "message": f"End date ({end_date}) cannot be earlier than start date ({start_date})."
        }

    # 1. Resolve site
    site = None
    try:
        site = sites_collection.find_one({"_id": ObjectId(site_code_or_id)})
    except Exception:
        pass

    if not site:
        site = sites_collection.find_one({
            "$or": [
                {"code": {"$regex": f"^{site_code_or_id.strip()}$", "$options": "i"}},
                {"name": {"$regex": f"^{site_code_or_id.strip()}$", "$options": "i"}}
            ]
        })

    if not site:
        return {
            "status": "error",
            "message": f"Site '{site_code_or_id}' not found. Please provide a valid site code (e.g. IND-HIGHWAY-001, BHO-MALL-001)."
        }

    site_id = site["_id"]
    site_code = site.get("code", str(site_id))

    # 2. Resolve campaign (optional, default to first active campaign)
    campaign = None
    if campaign_name_or_id:
        try:
            campaign = campaigns_collection.find_one({"_id": ObjectId(campaign_name_or_id)})
        except Exception:
            pass
        if not campaign:
            campaign = campaigns_collection.find_one({
                "name": {"$regex": campaign_name_or_id.strip(), "$options": "i"}
            })

    if not campaign:
        campaign = campaigns_collection.find_one({"status": "Active"}) or campaigns_collection.find_one({})

    campaign_id = campaign["_id"] if campaign else None
    campaign_name = campaign.get("name", "Standard Campaign") if campaign else "Standard Campaign"

    # 3. Generate all dates in range
    from datetime import timedelta
    requested_dates = []
    curr = start_dt
    while curr <= end_dt:
        requested_dates.append(curr)
        curr += timedelta(days=1)

    # 4. Check for double-booking conflicts
    conflicts = list(bookings_collection.find({
        "siteId": site_id,
        "date": {"$in": requested_dates}
    }))

    if conflicts:
        overlapping = sorted([c["date"].strftime("%Y-%m-%d") for c in conflicts])
        return {
            "status": "error",
            "blocked": True,
            "reason": "Double-booking prevented",
            "message": (
                f"Double-booking blocked! Site '{site_code}' is already booked on the following "
                f"overlapping date(s): {', '.join(overlapping)}. Booking request rejected."
            ),
            "overlapping_dates": overlapping,
            "site_code": site_code
        }

    # 5. Insert booking records
    now = datetime.utcnow()
    new_docs = [
        {
            "siteId": site_id,
            "campaignId": campaign_id,
            "date": d,
            "createdAt": now,
            "updatedAt": now,
            "__v": 0
        }
        for d in requested_dates
    ]
    bookings_collection.insert_many(new_docs)

    return {
        "status": "success",
        "message": f"Successfully booked site '{site_code}' from {start_date} to {end_date} ({len(requested_dates)} days) for campaign '{campaign_name}'.",
        "site_code": site_code,
        "days_booked": len(requested_dates),
        "campaign": campaign_name
    }

