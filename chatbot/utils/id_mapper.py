from data.db_client import db

def resolve_agent_ids(data_list, fields_to_map):
    """
    Scans data_list for fields in fields_to_map, extracts all unique ObjectIds/strings,
    fetches their corresponding names from employees and users collections,
    and replaces the IDs with the names in the data_list.
    Modifies data_list in-place.
    """
    try:
        employees_collection = db["employees"]
        users_collection = db["users"]
        agent_map = {}
        
        # Collect all unique IDs from the data list
        ids_to_map = set()
        for doc in data_list:
            if not isinstance(doc, dict):
                continue
            for field in fields_to_map:
                val = doc.get(field)
                if val:
                    # If it's a list of IDs (e.g., array of assignees), we handle single values for now
                    if isinstance(val, list):
                        for v in val:
                            if v: ids_to_map.add(v)
                    else:
                        ids_to_map.add(val)
                
        # Look up in employees first
        from bson.objectid import ObjectId
        for raw_id in ids_to_map:
            if not raw_id: continue
            
            try:
                oid = ObjectId(raw_id)
            except:
                oid = raw_id
                
            emp = employees_collection.find_one({"_id": oid}) or employees_collection.find_one({"userId": oid})
            if emp and emp.get("fullName"):
                agent_map[raw_id] = emp["fullName"]
            else:
                usr = users_collection.find_one({"_id": oid})
                if usr and usr.get("name"):
                    agent_map[raw_id] = usr["name"]
                else:
                    agent_map[raw_id] = f"Unknown Agent ({str(raw_id)[:6]})"

        # Apply mapping
        for doc in data_list:
            if not isinstance(doc, dict):
                continue
            for field in fields_to_map:
                val = doc.get(field)
                if val:
                    if isinstance(val, list):
                        mapped_list = []
                        for v in val:
                            if v in agent_map:
                                mapped_list.append(agent_map[v])
                            else:
                                mapped_list.append(v)
                        doc[field] = mapped_list
                    else:
                        if val in agent_map:
                            doc[field] = agent_map[val]

        return data_list
    except Exception as e:
        # If mapping fails for some reason, return the original data gracefully
        import traceback
        traceback.print_exc()
        return data_list
