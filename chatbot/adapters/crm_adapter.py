from data.db_client import employees_collection, leave_balances_collection, leave_requests_collection, attendance_collection, users_collection, audit_logs_collection
from datetime import datetime
from bson.objectid import ObjectId

def _clean_mongo_doc(doc):
    """Removes the MongoDB _id field from documents before returning to LLM."""
    if doc and "_id" in doc:
        del doc["_id"]
    return doc

def _map_to_old_employee(emp_doc, user_doc):
    return {
        "id": str(emp_doc["_id"]),
        "name": emp_doc.get("fullName", "Unknown"),
        "role": user_doc.get("role", "unknown") if user_doc else "unknown",
        "department": emp_doc.get("department", "Unknown"),
        "manager_id": str(emp_doc.get("reportingManagerId")) if emp_doc.get("reportingManagerId") else None,
        "contact": {
            "email": emp_doc.get("workEmail", ""),
            "phone": emp_doc.get("mobile", "")
        },
        "salary": {
            "annual_ctc": emp_doc.get("annualCtc", 0) if emp_doc.get("annualCtc") else 0,
            "base_monthly": emp_doc.get("annualCtc", 0) / 12 if emp_doc.get("annualCtc") else 0,
            "currency": "INR",
            "per_day_rate": (emp_doc.get("annualCtc", 0) / 12 / 30) if emp_doc.get("annualCtc") else 0
        }
    }

def get_employee(name=None, employee_id=None, manager_id=None, department=None, role=None, has_direct_reports=None):
    query = {}
    if employee_id is not None:
        try:
            oid = ObjectId(employee_id)
            query["$or"] = [{"_id": oid}, {"userId": oid}]
        except:
            query["$or"] = [{"_id": employee_id}, {"userId": employee_id}]
    elif name:
        import re
        raw_name = name.strip()
        escaped_name = re.escape(raw_name)
        flexible_name = r"\s*".join(list(escaped_name.replace(r"\ ", "")))
        query["$or"] = [
            {"fullName": {"$regex": escaped_name, "$options": "i"}},
            {"fullName": {"$regex": flexible_name, "$options": "i"}},
            {"workEmail": {"$regex": escaped_name, "$options": "i"}}
        ]
    elif manager_id is not None:
        try:
            query["reportingManagerId"] = ObjectId(manager_id)
        except:
            pass
    elif department is not None:
        query["department"] = {"$regex": f"^{department.strip()}$", "$options": "i"}
        
    if has_direct_reports is not None:
        active_manager_ids = employees_collection.distinct("reportingManagerId")
        active_manager_ids = [m for m in active_manager_ids if m is not None]
        
        if has_direct_reports:
            query["_id"] = {"$in": active_manager_ids}
        else:
            query["_id"] = {"$nin": active_manager_ids}

    if role is not None:
        role_users = list(users_collection.find({"role": {"$regex": f"^{role.strip()}$", "$options": "i"}}))
        role_user_ids = [u["_id"] for u in role_users]
        query["userId"] = {"$in": role_user_ids}

    matches = list(employees_collection.find(query))
    mapped_employees = []
    for emp in matches:
        user_doc = users_collection.find_one({"_id": emp.get("userId")})
        mapped_employees.append(_map_to_old_employee(emp, user_doc))

    from utils.id_mapper import resolve_agent_ids
    mapped_employees = resolve_agent_ids(mapped_employees, ["manager_id"])

    return {
        "found": len(mapped_employees) > 0,
        "count": len(mapped_employees),
        "employees": mapped_employees
    }

def update_employee(employee_id, department=None, manager_id=None, role=None, phone=None, email=None):
    try:
        emp_oid = ObjectId(employee_id)
    except:
        return {"status": "error", "message": "Invalid employee ID format."}
        
    employee = employees_collection.find_one({"_id": emp_oid})
    if not employee:
        return {"status": "error", "message": "Employee not found."}
    
    update_data = {}
    if department is not None:
        update_data["department"] = department
    if manager_id is not None:
        try:
            update_data["reportingManagerId"] = ObjectId(manager_id)
        except:
            pass
    if phone is not None:
        update_data["mobile"] = phone
    if email is not None:
        update_data["workEmail"] = email

    if update_data:
        employees_collection.update_one({"_id": emp_oid}, {"$set": update_data})
        
    if role is not None and employee.get("userId"):
        users_collection.update_one({"_id": employee["userId"]}, {"$set": {"role": role}})

    if not update_data and role is None:
        return {"status": "error", "message": "No fields provided to update."}

    return {
        "status": "success",
        "message": f"Successfully updated employee {employee_id}.",
        "updated_fields": update_data
    }

def add_employee(
    name,
    role,
    department,
    manager_id,
    email,
    phone,
    annual_ctc=None,
    leave_allocated=3,
    leave_used=0,
    initial_task=None
):
    import re
    # Resolve manager_id if given as a name (e.g. 'rohit')
    resolved_mgr_id = None
    if manager_id:
        try:
            resolved_mgr_id = ObjectId(manager_id)
        except Exception:
            raw_m = str(manager_id).strip()
            mgr_emp = employees_collection.find_one({
                "$or": [
                    {"fullName": {"$regex": re.escape(raw_m), "$options": "i"}},
                    {"workEmail": {"$regex": re.escape(raw_m), "$options": "i"}}
                ]
            })
            if mgr_emp:
                resolved_mgr_id = mgr_emp["_id"]

    # Generate next sequential employeeCode
    highest = 0
    for e in employees_collection.find({"employeeCode": {"$regex": r"^MO-EMP-\d+"}}, {"employeeCode": 1}):
        c = e.get("employeeCode", "")
        m = re.search(r"MO-EMP-(\d+)", c)
        if m:
            val = int(m.group(1))
            if val > highest:
                highest = val
    next_emp_code = f"MO-EMP-{highest + 1:04d}"

    user_email = email.strip().lower() if email else f"{name.replace(' ', '').lower()}@mediaoctus.local"
    existing_user = users_collection.find_one({"email": user_email})
    if existing_user:
        user_id = existing_user["_id"]
    else:
        user_res = users_collection.insert_one({
            "name": name,
            "email": user_email,
            "username": user_email.split("@")[0],
            "role": role.lower().strip() if role else "employee",
            "status": "Active",
            "createdAt": datetime.utcnow()
        })
        user_id = user_res.inserted_id
    
    emp_doc = {
        "userId": user_id,
        "employeeCode": next_emp_code,
        "fullName": name,
        "department": department,
        "designation": role.capitalize() if role else "Employee",
        "employmentType": "Full-time",
        "reportingManagerId": resolved_mgr_id,
        "workEmail": email,
        "mobile": phone,
        "status": "Active",
        "createdAt": datetime.utcnow()
    }
    if annual_ctc is not None:
        try:
            emp_doc["annualCtc"] = float(annual_ctc)
        except Exception:
            pass
            
    emp_res = employees_collection.insert_one(emp_doc)
    emp_id = str(emp_res.inserted_id)
    
    from data.db_client import leave_balances_collection, tasks_collection
    alloc = int(leave_allocated) if leave_allocated is not None else 3
    usd = int(leave_used) if leave_used is not None else 0
    leave_balances_collection.insert_one({
        "employeeId": emp_id,
        "allocated": alloc,
        "used": usd,
        "createdAt": datetime.utcnow()
    })
    
    task_info = None
    if initial_task:
        task_res = tasks_collection.insert_one({
            "title": initial_task,
            "type": "Custom",
            "assignedTo": emp_id,
            "status": "Pending",
            "proofRequired": False,
            "proofId": None,
            "completedAt": None,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        })
        task_info = {"id": str(task_res.inserted_id), "title": initial_task}
    
    msg = f"Successfully added {name} as {role} in {department}."
    if annual_ctc:
        msg += f" Annual CTC set to INR {float(annual_ctc):,.2f}."
    msg += f" Monthly Paid Leaves: {alloc} allocated, {usd} used."
    if task_info:
        msg += f" Initial task '{initial_task}' assigned."
        
    return {
        "status": "success",
        "message": msg,
        "employee_id": emp_id,
        "annual_ctc": float(annual_ctc) if annual_ctc else None,
        "leave_balance": {
            "allocated": alloc,
            "used": usd,
            "remaining": alloc - usd
        },
        "task": task_info
    }

def remove_employee(employee_id=None, name=None, reassign_tasks_to=None, reassign_leads_to=None):
    import re
    from data.db_client import (
        employees_collection,
        users_collection,
        leave_balances_collection,
        leave_requests_collection,
        attendance_collection,
        tasks_collection,
        leads_collection
    )
    
    emp = None
    if employee_id:
        try:
            emp = employees_collection.find_one({"_id": ObjectId(employee_id)})
        except Exception:
            pass
        if not emp:
            emp = employees_collection.find_one({"_id": employee_id})
            
    if not emp and name:
        raw_name = name.strip()
        escaped_name = re.escape(raw_name)
        flexible_name = r"\s*".join(list(escaped_name.replace(r"\ ", "")))
        emp = employees_collection.find_one({
            "$or": [
                {"fullName": {"$regex": escaped_name, "$options": "i"}},
                {"fullName": {"$regex": flexible_name, "$options": "i"}},
                {"workEmail": {"$regex": escaped_name, "$options": "i"}}
            ]
        })
        
    if not emp:
        return {"status": "error", "message": f"Employee '{name or employee_id}' not found."}
        
    target_id = emp["_id"]
    target_id_str = str(target_id)
    target_name = emp.get("fullName", name or "Employee")
    target_user_id = emp.get("userId")
    
    # Reassign tasks if requested
    tasks_reassigned = 0
    task_assignee_name = None
    if reassign_tasks_to:
        to_emp = None
        try:
            to_emp = employees_collection.find_one({"_id": ObjectId(reassign_tasks_to)})
        except Exception:
            pass
        if not to_emp:
            raw_to = reassign_tasks_to.strip()
            esc_to = re.escape(raw_to)
            flex_to = r"\s*".join(list(esc_to.replace(r"\ ", "")))
            to_emp = employees_collection.find_one({
                "$or": [
                    {"fullName": {"$regex": esc_to, "$options": "i"}},
                    {"fullName": {"$regex": flex_to, "$options": "i"}},
                    {"workEmail": {"$regex": esc_to, "$options": "i"}}
                ]
            })
        if to_emp:
            to_emp_id_str = str(to_emp["_id"])
            task_assignee_name = to_emp.get("fullName", reassign_tasks_to)
            res = tasks_collection.update_many(
                {"$or": [{"assignedTo": target_id_str}, {"assignedTo": target_id}]},
                {"$set": {"assignedTo": to_emp_id_str, "updatedAt": datetime.utcnow()}}
            )
            tasks_reassigned = res.modified_count
            
    # Reassign leads if requested
    leads_reassigned = 0
    lead_assignee_name = None
    if reassign_leads_to:
        lead_to_emp = None
        try:
            lead_to_emp = employees_collection.find_one({"_id": ObjectId(reassign_leads_to)})
        except Exception:
            pass
        if not lead_to_emp:
            raw_lto = reassign_leads_to.strip()
            esc_lto = re.escape(raw_lto)
            flex_lto = r"\s*".join(list(esc_lto.replace(r"\ ", "")))
            lead_to_emp = employees_collection.find_one({
                "$or": [
                    {"fullName": {"$regex": esc_lto, "$options": "i"}},
                    {"fullName": {"$regex": flex_lto, "$options": "i"}},
                    {"workEmail": {"$regex": esc_lto, "$options": "i"}}
                ]
            })
        if lead_to_emp:
            lead_to_id_str = str(lead_to_emp["_id"])
            lead_assignee_name = lead_to_emp.get("fullName", reassign_leads_to)
            res_l = leads_collection.update_many(
                {"$or": [{"assignedTo": target_id_str}, {"assignedTo": target_id}]},
                {"$set": {"assignedTo": lead_to_id_str, "updatedAt": datetime.utcnow()}}
            )
            leads_reassigned = res_l.modified_count

    # Reassign direct reports
    admin_emp = employees_collection.find_one({"department": "Management"})
    fallback_mgr = admin_emp["_id"] if admin_emp else None
    new_manager_id = emp.get("reportingManagerId") or fallback_mgr
    rep_res = employees_collection.update_many(
        {"reportingManagerId": target_id},
        {"$set": {"reportingManagerId": new_manager_id}}
    )
    direct_reports_reassigned = rep_res.modified_count
    
    # Delete employee records from collections
    employees_collection.delete_one({"_id": target_id})
    if target_user_id:
        users_collection.delete_one({"_id": target_user_id})
    leave_balances_collection.delete_many({"employeeId": target_id_str})
    leave_requests_collection.delete_many({"employeeId": target_id_str})
    attendance_collection.delete_many({"employeeId": target_id_str})
    
    summary_parts = [f"Successfully removed employee '{target_name}' (ID: {target_id_str}) from the company directory."]
    if task_assignee_name:
        summary_parts.append(f"Reassigned {tasks_reassigned} open task(s) to {task_assignee_name}.")
    if lead_assignee_name:
        summary_parts.append(f"Reassigned {leads_reassigned} lead(s) to {lead_assignee_name}.")
    if direct_reports_reassigned > 0:
        summary_parts.append(f"Reassigned {direct_reports_reassigned} direct report(s) to management.")
        
    return {
        "status": "success",
        "message": " ".join(summary_parts),
        "removed_employee": {
            "id": target_id_str,
            "name": target_name
        },
        "tasks_reassigned": tasks_reassigned,
        "task_assignee": task_assignee_name,
        "leads_reassigned": leads_reassigned,
        "lead_assignee": lead_assignee_name,
        "direct_reports_reassigned": direct_reports_reassigned
    }

def get_leave_balance(employee_id=None, name=None):
    if name and not employee_id:
        emp = employees_collection.find_one({"fullName": {"$regex": name.strip(), "$options": "i"}})
        if not emp:
            return {"found": False, "message": f"No employee found matching '{name}'."}
        employee_id = str(emp["_id"])
        
    emp_targets = []
    if employee_id:
        emp_targets.append(str(employee_id))
        try:
            oid = ObjectId(employee_id)
            emp_targets.append(oid)
            emp = employees_collection.find_one({"$or": [{"_id": oid}, {"userId": oid}]})
            if emp:
                emp_targets.extend([emp["_id"], str(emp["_id"])])
        except Exception:
            pass

    balance = leave_balances_collection.find_one({"employeeId": {"$in": emp_targets}})
    if not balance:
        return {"found": False, "employee_id": employee_id, "message": "No leave data found for this employee."}
    
    allocated = balance.get("allocated", 0)
    used = balance.get("used", 0)
    remaining = allocated - used
    
    return {
        "found": True,
        "employee_id": employee_id,
        "leave_policy": "Monthly Paid Leave",
        "paid_leaves": {
            "monthly": allocated,
            "allocated_monthly": allocated,
            "used": used,
            "remaining": remaining
        },
        "unpaid_leaves_taken": 0,
        "current_salary_deduction": 0,
        "note": "Company leave policy is MONTHLY (e.g. 3 paid leaves per month), NOT annual."
    }

def update_leave_balance(employee_id=None, name=None, used_paid=None, monthly_paid=None, annual_paid=None, unpaid_taken=None):
    if not employee_id and name:
        import re
        raw_n = name.strip()
        emp = employees_collection.find_one({
            "$or": [
                {"fullName": {"$regex": re.escape(raw_n), "$options": "i"}},
                {"workEmail": {"$regex": re.escape(raw_n), "$options": "i"}}
            ]
        })
        if emp:
            employee_id = str(emp["_id"])
            
    if not employee_id:
        return {"status": "error", "message": "employee_id or name is required."}

    balance = leave_balances_collection.find_one({"employeeId": employee_id})
    if not balance:
        return {"status": "error", "message": "Leave data not found for this employee."}
        
    update_data = {}
    if used_paid is not None:
        update_data["used"] = used_paid
    if monthly_paid is not None:
        update_data["allocated"] = monthly_paid
    elif annual_paid is not None:
        update_data["allocated"] = annual_paid
        
    if not update_data:
        return {"status": "error", "message": "No valid fields provided to update."}
        
    leave_balances_collection.update_one({"employeeId": employee_id}, {"$set": update_data})
    
    return {
        "status": "success",
        "message": f"Successfully updated leave balance for employee {employee_id}",
        "updated_fields": update_data
    }

def get_attendance_status(employee_id=None, name=None, date=None):
    if name and not employee_id:
        emp = employees_collection.find_one({"fullName": {"$regex": name.strip(), "$options": "i"}})
        if not emp:
            return {"found": False, "message": "No matching employee found."}
        employee_id = str(emp["_id"])
        
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")

    from datetime import datetime as dt_cls, timedelta
    date_clean = str(date).strip()[:10]
    
    # Build date queries for both datetime objects (ISODate) and regex strings
    date_queries = [{"date": {"$regex": f"^{date_clean}"}}]
    try:
        start_day = dt_cls.strptime(date_clean, "%Y-%m-%d")
        end_day = start_day + timedelta(days=1)
        date_queries.append({"date": {"$gte": start_day, "$lt": end_day}})
        date_queries.append({"date": start_day})
    except:
        pass

    emp_queries = [{"employeeId": str(employee_id)}]
    try:
        emp_queries.append({"employeeId": ObjectId(employee_id)})
    except:
        pass

    query = {
        "$and": [
            {"$or": emp_queries},
            {"$or": date_queries}
        ]
    }
        
    attendance = attendance_collection.find_one(query)
    if not attendance:
        return {"found": False, "employee_id": str(employee_id), "date": date_clean, "message": "No attendance data found for this date."}
    
    return {
        "found": True,
        "employee_id": str(employee_id),
        "date": date_clean,
        "status": attendance.get("status", "Unknown"),
        "work_type": attendance.get("workType", "Office"),
        "check_in": attendance.get("checkInTime").strftime("%H:%M:%S") if isinstance(attendance.get("checkInTime"), dt_cls) else str(attendance.get("checkInTime") or "N/A"),
        "check_out": attendance.get("checkOutTime").strftime("%H:%M:%S") if isinstance(attendance.get("checkOutTime"), dt_cls) else str(attendance.get("checkOutTime") or "N/A")
    }

def update_attendance_status(employee_id, status, date=None):
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")
        
    if status.lower() not in ["present", "absent", "leave", "half-day"]:
        return {"status": "error", "message": f"Invalid status: {status}. Must be Present, Absent, Leave, or Half-Day."}

    from datetime import datetime as dt_cls, timedelta
    date_clean = str(date).strip()[:10]
    
    date_queries = [{"date": {"$regex": f"^{date_clean}"}}]
    try:
        start_day = dt_cls.strptime(date_clean, "%Y-%m-%d")
        end_day = start_day + timedelta(days=1)
        date_queries.append({"date": {"$gte": start_day, "$lt": end_day}})
        date_queries.append({"date": start_day})
    except:
        pass

    emp_queries = [{"employeeId": str(employee_id)}]
    try:
        emp_queries.append({"employeeId": ObjectId(employee_id)})
    except:
        pass

    query = {
        "$and": [
            {"$or": emp_queries},
            {"$or": date_queries}
        ]
    }
        
    attendance = attendance_collection.find_one(query)
    
    if attendance:
        attendance_collection.update_one(
            {"_id": attendance["_id"]},
            {"$set": {
                "status": status.title(),
                "updatedAt": datetime.utcnow()
            }}
        )
    else:
        try:
            start_day = dt_cls.strptime(date_clean, "%Y-%m-%d")
            emp_obj_id = ObjectId(employee_id)
        except:
            start_day = f"{date_clean} 18:30:00"
            emp_obj_id = str(employee_id)

        attendance_collection.insert_one({
            "employeeId": emp_obj_id,
            "date": start_day,
            "status": status.title(),
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        })
    
    return {
        "status": "success",
        "message": f"Successfully updated attendance for employee {employee_id} on {date_clean} to {status.title()}"
    }

def get_salary_details(employee_id=None, name=None):
    import re
    emp = None
    if employee_id:
        try:
            oid = ObjectId(employee_id)
            emp = employees_collection.find_one({"$or": [{"_id": oid}, {"userId": oid}]})
        except:
            emp = employees_collection.find_one({"$or": [{"_id": employee_id}, {"userId": employee_id}]})
    if not emp and name:
        raw_n = name.strip()
        esc_n = re.escape(raw_n)
        flex_n = r"\s*".join(list(esc_n.replace(r"\ ", "")))
        emp = employees_collection.find_one({
            "$or": [
                {"fullName": {"$regex": esc_n, "$options": "i"}},
                {"fullName": {"$regex": flex_n, "$options": "i"}},
                {"workEmail": {"$regex": esc_n, "$options": "i"}}
            ]
        })
        if emp:
            employee_id = str(emp["_id"])
            
    if not emp:
        return {"found": False, "message": f"Employee '{name or employee_id}' not found."}
        
    annual_ctc = emp.get("annualCtc", 0) if emp.get("annualCtc") else 0
    monthly = annual_ctc / 12
    per_day = monthly / 30 if monthly else 0
    return {
        "found": True,
        "employee_id": employee_id,
        "name": emp.get("fullName", "Unknown"),
        "annual_ctc": annual_ctc,
        "base_monthly": monthly,
        "per_day_rate": per_day,
        "currency": "INR",
        "unpaid_leaves_taken": 0,
        "net_payable_monthly": monthly,
        "note": "annual_ctc is the primary salary figure stored in the database. base_monthly and per_day_rate are derived values."
    }

def update_salary(name=None, employee_id=None, new_salary=None, salary_type="annual"):
    """
    Updates the salary/CTC of an employee in MongoDB.
    Supports resolving by name or employee_id.
    """
    if new_salary is None:
        return {"status": "error", "message": "No salary amount provided."}
        
    try:
        new_salary = float(new_salary)
    except (ValueError, TypeError):
        return {"status": "error", "message": f"Invalid salary amount: {new_salary}"}
        
    emp = None
    if name and not employee_id:
        emp = employees_collection.find_one({"fullName": {"$regex": f"^{name.strip()}$", "$options": "i"}})
        if not emp:
            emp = employees_collection.find_one({"fullName": {"$regex": name.strip(), "$options": "i"}})
        if not emp:
            return {"status": "error", "message": f"Employee '{name}' not found."}
        employee_id = str(emp["_id"])
    elif employee_id:
        try:
            emp = employees_collection.find_one({"_id": ObjectId(employee_id)})
        except:
            return {"status": "error", "message": f"Invalid employee ID: {employee_id}"}
    else:
        return {"status": "error", "message": "Please specify either employee name or employee_id."}
        
    if not emp:
        return {"status": "error", "message": "Employee not found."}
        
    emp_name = emp.get("fullName", "Unknown")
    
    # Calculate annual CTC and monthly
    if salary_type.lower() == "monthly" or (salary_type.lower() != "annual" and new_salary < 100000):
        annual_ctc = new_salary * 12
        monthly = new_salary
    else:
        annual_ctc = new_salary
        monthly = new_salary / 12
        
    per_day_rate = monthly / 30
    
    employees_collection.update_one(
        {"_id": ObjectId(employee_id)},
        {"$set": {
            "annualCtc": annual_ctc,
            "updatedAt": datetime.utcnow()
        }}
    )
    
    return {
        "status": "success",
        "message": f"Successfully updated salary for {emp_name}. New Annual CTC: INR {annual_ctc:,.2f} (Monthly Base: INR {monthly:,.2f}, Per-day: INR {per_day_rate:,.2f}).",
        "employee_id": employee_id,
        "name": emp_name,
        "annual_ctc": annual_ctc,
        "base_monthly": monthly,
        "per_day_rate": per_day_rate
    }


# ============================================================
# LEAVE REQUESTS
# ============================================================

from data.db_client import leave_requests_collection

def _normalize_leave_record(r):
    """
    Normalize a leave request record to a consistent schema regardless of
    whether it was created by the CRM frontend (fromDate/toDate + approverId)
    or by the assistant adapter (startDate/endDate + approvedBy).
    Returns a plain dict safe for JSON serialization.
    """
    out = {}
    for key, val in r.items():
        if isinstance(val, ObjectId):
            out[key] = str(val)
        elif isinstance(val, datetime):
            out[key] = val.strftime("%Y-%m-%d")
        elif isinstance(val, str):
            out[key] = val.strip()  # strips trailing \r\n etc.
        else:
            out[key] = val

    # Normalize date fields: always expose startDate / endDate
    if "fromDate" in out and "startDate" not in out:
        out["startDate"] = out["fromDate"]
    if "toDate" in out and "endDate" not in out:
        out["endDate"] = out["toDate"]

    # Normalize approver field: always expose approvedBy
    if "approverId" in out and "approvedBy" not in out:
        out["approvedBy"] = out["approverId"]

    # Clean up reason
    if "reason" in out and isinstance(out["reason"], str):
        out["reason"] = out["reason"].strip().strip("\r\n").strip()

    return out

def _get_leave_days(req):
    """Extract number of leave days from a record using either schema."""
    if req.get("days"):
        try:
            return int(req["days"])
        except:
            pass
    # Calculate from dates
    start_str = req.get("startDate") or req.get("fromDate")
    end_str   = req.get("endDate")   or req.get("toDate")
    if start_str and end_str:
        try:
            if isinstance(start_str, datetime):
                start = start_str
            else:
                start = datetime.strptime(str(start_str)[:10], "%Y-%m-%d")
            if isinstance(end_str, datetime):
                end = end_str
            else:
                end = datetime.strptime(str(end_str)[:10], "%Y-%m-%d")
            return max(1, (end - start).days + 1)
        except:
            pass
    return 1

def _emp_id_matches(emp_id_in_record, manager_id):
    """Safe string comparison for employeeId (handles ObjectId or str)."""
    return str(emp_id_in_record) == str(manager_id)

def apply_for_leave(employee_id, start_date, end_date, reason):
    try:
        from data.db_client import employees_collection
        from datetime import datetime
        from bson import ObjectId

        # Convert strings to datetime
        s_date = datetime.strptime(start_date[:10], "%Y-%m-%d")
        e_date = datetime.strptime(end_date[:10], "%Y-%m-%d")
        days = max(1, (e_date - s_date).days + 1)
        
        emp_oid = ObjectId(str(employee_id))
        
        # Look up employee to get reportingManagerId
        emp = employees_collection.find_one({"_id": emp_oid})
        approver_id = emp.get("reportingManagerId") if emp else None

        # Create record in new CRM schema
        new_request = {
            "employeeId": emp_oid,
            "leaveTypeId": ObjectId("6aa9365d50ee4883b0d35a1b"), # Default to Casual Leave
            "fromDate": s_date,
            "toDate": e_date,
            "days": days,
            "reason": reason.strip() if reason else "",
            "status": "Pending",
            "approverId": approver_id,
            "approvedAt": None,
            "createdBy": emp_oid,
            "updatedBy": emp_oid,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
            "__v": 0
        }
        res = leave_requests_collection.insert_one(new_request)
        return {
            "status": "success",
            "message": "Leave application submitted successfully.",
            "request_id": str(res.inserted_id)
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

def _get_role_for_employee_id(employee_id):
    """
    Given an employee _id (ObjectId or str), return the user's role string.
    Joins: employees._id -> employees.userId -> users._id -> users.role
    """
    try:
        from data.db_client import users_collection as _users_coll
        emp_doc = employees_collection.find_one({"_id": ObjectId(str(employee_id))})
        if not emp_doc:
            return None
        user_id = emp_doc.get("userId")
        if not user_id:
            return None
        user_doc = _users_coll.find_one({"_id": user_id})
        if not user_doc:
            return None
        return user_doc.get("role", "").lower()
    except Exception:
        return None

def _is_manager_scoped(manager_id, emp_id_in_record, approverId_in_record=None):
    """
    Return True if a manager should be able to see this leave record.
    Checks both:
      1. is the employee in the manager's reporting chain
      2. is the manager explicitly set as the approverId
    """
    from assistant.permissions import is_in_reporting_chain
    emp_id_str = str(emp_id_in_record)
    mgr_id_str = str(manager_id)

    # Direct match (employee is the manager themselves — self-leave view)
    if emp_id_str == mgr_id_str:
        return True

    # Reporting chain check
    try:
        if is_in_reporting_chain(manager_id, emp_id_str):
            return True
    except:
        pass

    # approverId explicit match (CRM schema)
    if approverId_in_record and str(approverId_in_record) == mgr_id_str:
        return True

    return False

def get_pending_leave_requests(manager_id=None):
    try:
        # Determine role of requester
        is_admin_or_hr = False
        if manager_id:
            role = _get_role_for_employee_id(manager_id)
            if role in ["admin", "hr"]:
                is_admin_or_hr = True

        reqs = list(leave_requests_collection.find({"status": "Pending"}))
        formatted = []

        for r in reqs:
            emp_id = r.get("employeeId")
            approver_id = r.get("approverId")  # only in new CRM schema

            # Scoping: admin/HR see all; managers only see their reporting chain or assigned approvals
            if manager_id and not is_admin_or_hr:
                if not _is_manager_scoped(manager_id, emp_id, approver_id):
                    continue

            formatted.append(_normalize_leave_record(r))

        from utils.id_mapper import resolve_agent_ids
        formatted = resolve_agent_ids(formatted, ["employeeId"])
        return {"status": "success", "requests": formatted}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def update_leave_request_status(request_id, status, manager_id):
    if status not in ["Approved", "Rejected"]:
        return {"status": "error", "message": "Status must be Approved or Rejected"}

    try:
        req = leave_requests_collection.find_one({"_id": ObjectId(request_id)})
        if not req:
            return {"status": "error", "message": "Leave request not found"}

        # Role check
        is_admin_or_hr = False
        if manager_id:
            role = _get_role_for_employee_id(manager_id)
            if role in ["admin", "hr"]:
                is_admin_or_hr = True

        emp_id = req.get("employeeId")
        approver_id = req.get("approverId")

        if manager_id and not is_admin_or_hr:
            if not _is_manager_scoped(manager_id, emp_id, approver_id):
                return {"status": "permission_denied", "message": "You do not have permission to manage this leave request."}

        leave_requests_collection.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {
                "status": status,
                "approvedBy": manager_id,
                "approvedAt": datetime.utcnow() if status == "Approved" else None,
                "updatedAt": datetime.utcnow()
            }}
        )

        if status == "Approved":
            try:
                days = _get_leave_days(req)
                if days > 0 and emp_id:
                    # Match by either str or ObjectId form
                    leave_balances_collection.update_one(
                        {"$or": [
                            {"employeeId": str(emp_id)},
                            {"employeeId": emp_id}
                        ]},
                        {"$inc": {"used": days}}
                    )
            except Exception:
                pass  # Don't fail approval if balance update fails

        return {
            "status": "success",
            "message": f"Leave request {request_id} has been {status}."
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ============================================================
# TASKS & ESCALATIONS
# ============================================================


from data.db_client import tasks_collection, escalations_collection

def get_my_tasks(employee_id, campaign_id=None):
    try:
        query = {"$or": [{"assignedTo": employee_id}, {"assignedTo": ObjectId(employee_id)}]}
        if campaign_id:
            query["campaignId"] = campaign_id
            
        tasks = list(tasks_collection.find(query).sort("deadline", 1))
        formatted = []
        for t in tasks:
            t["_id"] = str(t["_id"])
            if "campaignId" in t and t["campaignId"]: t["campaignId"] = str(t["campaignId"])
            if "siteId" in t and t["siteId"]: t["siteId"] = str(t["siteId"])
            if "completedAt" in t and isinstance(t["completedAt"], datetime): t["completedAt"] = str(t["completedAt"])
            if "createdAt" in t and isinstance(t["createdAt"], datetime): t["createdAt"] = str(t["createdAt"])
            if "updatedAt" in t and isinstance(t["updatedAt"], datetime): t["updatedAt"] = str(t["updatedAt"])
            if isinstance(t.get("deadline"), datetime):
                t["deadline"] = t["deadline"].strftime("%Y-%m-%d")
            formatted.append(t)
        from utils.id_mapper import resolve_agent_ids
        formatted = resolve_agent_ids(formatted, ["assignedTo", "createdBy"])
        return {"status": "success", "tasks": formatted}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def update_task_status(task_id, status, proof_id=None):
    valid_statuses = ["Pending", "In Progress", "Completed", "Cancelled"]
    if status not in valid_statuses:
        return {"status": "error", "message": f"Status must be one of {valid_statuses}"}
        
    try:
        task = tasks_collection.find_one({"_id": ObjectId(task_id)})
        if not task:
            return {"status": "error", "message": "Task not found"}
            
        if status == "Completed" and task.get("proofRequired") and not proof_id:
            pass # We will allow it for now
            
        update_data = {
            "status": status,
            "updatedAt": datetime.utcnow()
        }
        
        if status == "Completed":
            update_data["completedAt"] = datetime.utcnow()
            if proof_id:
                update_data["proofId"] = proof_id
                
        tasks_collection.update_one({"_id": ObjectId(task_id)}, {"$set": update_data})
        return {"status": "success", "message": f"Task {task_id} updated to {status}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def reassign_tasks(from_employee, to_employee, task_ids=None):
    import re
    from data.db_client import employees_collection, tasks_collection
    
    # Resolve from_employee
    from_emp = None
    try:
        from_emp = employees_collection.find_one({"_id": ObjectId(from_employee)})
    except Exception:
        pass
    if not from_emp:
        raw_f = from_employee.strip()
        esc_f = re.escape(raw_f)
        flex_f = r"\s*".join(list(esc_f.replace(r"\ ", "")))
        from_emp = employees_collection.find_one({
            "$or": [
                {"fullName": {"$regex": esc_f, "$options": "i"}},
                {"fullName": {"$regex": flex_f, "$options": "i"}},
                {"workEmail": {"$regex": esc_f, "$options": "i"}}
            ]
        })
    if not from_emp:
        return {"status": "error", "message": f"Source employee '{from_employee}' not found."}
        
    # Resolve to_employee
    to_emp = None
    try:
        to_emp = employees_collection.find_one({"_id": ObjectId(to_employee)})
    except Exception:
        pass
    if not to_emp:
        raw_t = to_employee.strip()
        esc_t = re.escape(raw_t)
        flex_t = r"\s*".join(list(esc_t.replace(r"\ ", "")))
        to_emp = employees_collection.find_one({
            "$or": [
                {"fullName": {"$regex": esc_t, "$options": "i"}},
                {"fullName": {"$regex": flex_t, "$options": "i"}},
                {"workEmail": {"$regex": esc_t, "$options": "i"}}
            ]
        })
    if not to_emp:
        return {"status": "error", "message": f"Target employee '{to_employee}' not found."}
        
    from_id = from_emp["_id"]
    from_id_str = str(from_id)
    to_id_str = str(to_emp["_id"])
    
    query = {"$or": [{"assignedTo": from_id_str}, {"assignedTo": from_id}]}
    if task_ids:
        t_oids = []
        for tid in task_ids:
            try: t_oids.append(ObjectId(tid))
            except: t_oids.append(tid)
        query["_id"] = {"$in": t_oids}
        
    res = tasks_collection.update_many(
        query,
        {"$set": {"assignedTo": to_id_str, "updatedAt": datetime.utcnow()}}
    )
    return {
        "status": "success",
        "message": f"Successfully reassigned {res.modified_count} task(s) from {from_emp.get('fullName')} to {to_emp.get('fullName')}.",
        "reassigned_count": res.modified_count,
        "from_employee": from_emp.get("fullName"),
        "to_employee": to_emp.get("fullName")
    }

def create_task(title, assigned_to=None, deadline=None, campaign_id=None, site_id=None, task_type="Custom"):
    import re
    from data.db_client import tasks_collection, employees_collection
    
    assigned_emp_id = None
    assigned_emp_name = None
    if assigned_to:
        try:
            emp = employees_collection.find_one({"_id": ObjectId(assigned_to)})
        except Exception:
            emp = None
        if not emp:
            raw_a = str(assigned_to).strip()
            esc_a = re.escape(raw_a)
            flex_a = r"\s*".join(list(esc_a.replace(r"\ ", "")))
            emp = employees_collection.find_one({
                "$or": [
                    {"fullName": {"$regex": esc_a, "$options": "i"}},
                    {"fullName": {"$regex": flex_a, "$options": "i"}},
                    {"workEmail": {"$regex": esc_a, "$options": "i"}}
                ]
            })
        if emp:
            assigned_emp_id = str(emp["_id"])
            assigned_emp_name = emp.get("fullName")
        else:
            assigned_emp_id = str(assigned_to)
            
    deadline_dt = None
    if deadline:
        try:
            deadline_dt = datetime.strptime(deadline, "%Y-%m-%d")
        except Exception:
            deadline_dt = deadline

    task_doc = {
        "title": title,
        "type": task_type or "Custom",
        "assignedTo": assigned_emp_id,
        "deadline": deadline_dt,
        "status": "Pending",
        "proofRequired": False,
        "proofId": None,
        "completedAt": None,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    if campaign_id:
        try: task_doc["campaignId"] = ObjectId(campaign_id)
        except: task_doc["campaignId"] = campaign_id
    if site_id:
        try: task_doc["siteId"] = ObjectId(site_id)
        except: task_doc["siteId"] = site_id
        
    res = tasks_collection.insert_one(task_doc)
    task_id = str(res.inserted_id)
    
    msg = f"Task '{title}' created successfully (ID: {task_id})."
    if assigned_emp_name:
        msg += f" Assigned to {assigned_emp_name}."
    elif assigned_emp_id:
        msg += f" Assigned to {assigned_emp_id}."
        
    return {
        "status": "success",
        "message": msg,
        "task_id": task_id,
        "title": title,
        "assigned_to": assigned_emp_name or assigned_emp_id
    }

def _serialize_doc(doc):
    if isinstance(doc, dict):
        return {k: _serialize_doc(v) for k, v in doc.items()}
    elif isinstance(doc, list):
        return [_serialize_doc(v) for v in doc]
    elif isinstance(doc, ObjectId):
        return str(doc)
    elif isinstance(doc, datetime):
        return doc.isoformat()
    return doc

def get_escalations(manager_id=None):
    try:
        escs = list(escalations_collection.find().sort("createdAt", -1))
        formatted = [_serialize_doc(e) for e in escs]
        from utils.id_mapper import resolve_agent_ids
        formatted = resolve_agent_ids(formatted, ["escalatedBy", "escalatedTo", "resolvedBy"])
        return {"status": "success", "escalations": formatted}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def acknowledge_escalation(escalation_id, manager_id):
    try:
        escalations_collection.update_one(
            {"_id": ObjectId(escalation_id)},
            {"$set": {"acknowledgedBy": manager_id, "acknowledgedAt": datetime.utcnow()}}
        )
        return {"status": "success", "message": "Escalation acknowledged."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def get_company_finance_summary():
    """Returns an explicit message that company finances are not stored in the DB."""
    return {
        "status": "error",
        "message": "Company finance data is currently not tracked in the CRM database."
    }

def get_role_access(role=None, employee_name_or_id=None):
    """
    Returns the permissions, data access scope, and capabilities for a role or specific employee.
    """
    from assistant.permissions import ROLE_PERMISSIONS, TOOL_PERMISSIONS
    
    role_descriptions = {
        "admin": {
            "title": "System Administrator",
            "scope": "Full system-wide unrestricted access (*).",
            "capabilities": [
                "Manage all employee profiles, roles, and hierarchy (add, update, remove)",
                "Full access to sensitive salary details and company finances",
                "Full leave management (view, approve, reject, adjust balances)",
                "Full attendance tracking and updates",
                "Sales & Operations management (leads, quotations, purchase orders, campaigns, sites, vendors)",
                "Task management and system escalations",
                "View and audit system activity logs"
            ]
        },
        "hr": {
            "title": "Human Resources (HR)",
            "scope": "Company-wide employee directory, leaves, attendance, and candidate management.",
            "capabilities": [
                "View, create, and update employee profiles",
                "View sensitive salary/CTC details for all employees (read-only; cannot edit salary)",
                "Manage leaves: view pending leave requests, approve or reject leave requests, adjust leave balances",
                "View team-wide attendance and update attendance records",
                "Candidate and hiring pipeline management",
                "Generate HR and employee reports",
                "Strictly restricted: No access to sales leads, client quotations, purchase orders, bookings, sites, vendors, campaigns, operational tasks, or company finances"
            ]
        },
        "manager": {
            "title": "Manager",
            "scope": "Department and reporting-chain management, sales pipeline, campaigns, and team oversight.",
            "capabilities": [
                "View and update direct reports and team members",
                "Approve and manage team leave requests",
                "View team attendance records",
                "Sales management: view, create, and update leads, quotations, and assign leads",
                "Manage campaigns, review sites, bookings, vendors, and purchase orders",
                "Task oversight: create/assign tasks, approve proof of work, acknowledge escalations"
            ]
        },
        "sales_agent": {
            "title": "Sales Agent",
            "scope": "Sales opportunities, client quotations, and personal records.",
            "capabilities": [
                "View, create, claim, and update leads and log client calls",
                "Generate and update client quotation PDFs",
                "View sites, bookings, and active campaigns for client proposals",
                "View personal tasks and upload work proofs",
                "Access own attendance, leave balances, and apply for leave"
            ]
        },
        "ops": {
            "title": "Operations (Ops)",
            "scope": "Sites, vendors, physical inventory, bookings, and purchase orders.",
            "capabilities": [
                "Manage outdoor sites and locations",
                "Manage site bookings and vendor contracts",
                "Create and manage purchase order (PO) PDFs",
                "Oversee campaign executions and upload proof of display/installation",
                "Manage operations tasks, personal attendance, and leave"
            ]
        },
        "finance": {
            "title": "Finance Department",
            "scope": "Company financial accounts, bank details, employee salaries, audit logs, and view-only access to commercial records.",
            "capabilities": [
                "Quotations, Vendors, Purchase Orders, Campaigns: View only (cannot create, edit, or delete)",
                "Finance: View, can edit/manage, bank_details (full control over financial summaries and employee salaries/CTC)",
                "Employees: View directory and sensitive salary records",
                "Audit: View recent activity and audit logs (only non-Admin role with audit view)",
                "Self-service only: View personal profile, personal attendance, personal leave balance, and apply for personal leave only",
                "Strictly restricted: No access to sales leads, site bookings, task creation/reassignment, or team leave/attendance approvals"
            ]
        },
        "employee": {
            "title": "Standard Employee",
            "scope": "Self-service employee portal (strictly self-service and view-only tasks).",
            "capabilities": [
                "Tasks: View only (view tasks assigned to oneself; cannot update task status, reassign, or create tasks)",
                "Self-service only: View personal profile (employees.self), personal attendance (attendance.self), personal leave balance, and apply for personal leave (leave.self)",
                "Strictly restricted: No access to any management, operational, or financial module (leads, quotations, purchase orders, sites, bookings, vendors, campaigns, salary of others, company finances, or escalations)"
            ]
        }
    }
    
    # Check if specific employee was requested
    target_emp = None
    if employee_name_or_id:
        emps = get_employee(name=employee_name_or_id) if not employee_name_or_id.isalnum() or len(employee_name_or_id) != 24 else get_employee(employee_id=employee_name_or_id)
        if emps and emps.get("found"):
            emp_list = emps.get("employees", [])
            if emp_list:
                target_emp = emp_list[0]
                role = target_emp.get("role", "").lower().strip()
            
    if role:
        normalized_role = role.lower().strip().replace(" ", "_")
        if normalized_role in ["sales", "salesagent", "sales_agent", "agent"]:
            normalized_role = "sales_agent"
            
        info = role_descriptions.get(normalized_role)
        if not info:
            return {"status": "error", "message": f"Role '{role}' is not recognized in the system."}
            
        allowed_tools = [t for t, perms in TOOL_PERMISSIONS.items() if any(p in ROLE_PERMISSIONS.get(normalized_role, []) or "*" in ROLE_PERMISSIONS.get(normalized_role, []) for p in perms)]
        
        result = {
            "status": "success",
            "role": normalized_role,
            "role_title": info["title"],
            "scope": info["scope"],
            "capabilities": info["capabilities"],
            "allowed_tools": allowed_tools
        }
        if target_emp:
            result["employee_name"] = target_emp.get("name")
            result["employee_id"] = target_emp.get("id")
            result["department"] = target_emp.get("department")
        return result
        
    # If no role or employee specified, return overview of all roles
    return {
        "status": "success",
        "roles_overview": {k: {"title": v["title"], "scope": v["scope"], "capabilities": v["capabilities"]} for k, v in role_descriptions.items()}
    }

def get_recent_activity(limit=10, action=None, actor_email=None, entity=None, include_auth=False):
    """
    Fetches recent activity and audit logs from the database with rich, human-readable business context.
    Allows admins to see who made what updates, creations, deletions, or logins.
    """
    try:
        from data.db_client import (
            leads_collection,
            tasks_collection,
            quotations_collection,
            employees_collection
        )
        query = {}
        if action:
            query["action"] = {"$regex": f"^{action.strip()}$", "$options": "i"}
        if actor_email:
            query["actorEmail"] = {"$regex": actor_email.strip(), "$options": "i"}
        if entity:
            query["entity"] = {"$regex": f"^{entity.strip()}$", "$options": "i"}
        elif not include_auth and not action:
            # Default to meaningful business operations (leads, tasks, quotations, employees, leaves, etc.)
            query["entity"] = {"$nin": ["Auth", "auth", "notifications"]}
            
        limit = max(1, min(int(limit), 25))
        cursor = audit_logs_collection.find(query).sort([("createdAt", -1), ("_id", -1)]).limit(limit * 2)
        
        db_activities = []
        for doc in cursor:
            created_at = doc.get("createdAt")
            if isinstance(created_at, datetime):
                time_str = created_at.strftime("%Y-%m-%d %H:%M:%S UTC")
                dt = created_at
            else:
                time_str = str(created_at)
                try:
                    dt = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
                except:
                    dt = datetime.min
                
            actor = doc.get("actorEmail") or str(doc.get("actorId") or "System")
            role = doc.get("actorRole") or "Unknown"
            action_name = doc.get("action") or "action"
            entity_name = doc.get("entity") or "record"
            eid = doc.get("entityId")
            payload = doc.get("payload") or {}
            channel = doc.get("channel")
            source = "Chatbot (AI Assistant)" if channel == "ai_assistant" else "Web App / DB"
            
            description = f"{actor} ({role}) performed '{action_name}' on {entity_name}"
            details = None

            if entity_name == "leads":
                company = payload.get("companyName") if isinstance(payload, dict) else None
                if not company and eid:
                    try:
                        l_doc = leads_collection.find_one({"_id": ObjectId(eid)})
                        if l_doc: company = l_doc.get("companyName")
                    except: pass
                company_str = f"'{company}'" if company else "lead"
                if action_name == "create":
                    description = f"Added new lead {company_str}"
                elif action_name == "update":
                    st = payload.get("status") if isinstance(payload, dict) else None
                    description = f"Updated lead {company_str}" + (f" -> Status: {st}" if st else "")
                if isinstance(payload, dict):
                    clean_items = [f"{k}: {v}" for k, v in payload.items() if k not in ["__v", "photos", "gps", "assignedTo", "claimedBy"] and v][:3]
                    if clean_items:
                        details = ", ".join(clean_items)

            elif entity_name == "tasks":
                task_title = None
                if eid:
                    try:
                        t_doc = tasks_collection.find_one({"_id": ObjectId(eid)})
                        if t_doc: task_title = t_doc.get("title")
                    except: pass
                title_str = f"'{task_title}'" if task_title else "task"
                st = payload.get("status") if isinstance(payload, dict) else None
                if st:
                    description = f"Updated task {title_str} to '{st}'"
                else:
                    description = f"Updated task {title_str}"

            elif entity_name == "quotations":
                client = payload.get("clientName") if isinstance(payload, dict) else None
                q_num = payload.get("quoteNumber") if isinstance(payload, dict) else None
                if (not client or not q_num) and eid:
                    try:
                        q_doc = quotations_collection.find_one({"_id": ObjectId(eid)})
                        if q_doc:
                            client = client or q_doc.get("clientName")
                            q_num = q_num or q_doc.get("quoteNumber")
                    except: pass
                description = f"Generated/Updated quotation {q_num or ''} for client '{client or 'Unknown'}'"
                if isinstance(payload, dict) and "total" in payload:
                    details = f"Total Amount: INR {payload.get('total')}"

            elif entity_name in ["employees", "employee"]:
                emp_name = payload.get("fullName") if isinstance(payload, dict) else None
                if not emp_name and eid:
                    try:
                        e_doc = employees_collection.find_one({"_id": ObjectId(eid)})
                        if e_doc: emp_name = e_doc.get("fullName")
                    except: pass
                name_str = f"'{emp_name}'" if emp_name else "employee profile"
                if action_name == "delete":
                    description = f"Removed employee {name_str}"
                elif action_name == "create":
                    dept = payload.get('department', '') if isinstance(payload, dict) else ''
                    description = f"Onboarded new employee {name_str} ({dept})"
                else:
                    description = f"Updated employee {name_str}"
                    if isinstance(payload, dict):
                        changed_keys = [k for k in payload.keys() if k not in ["__v", "updatedAt"]]
                        details = f"Changed fields: {', '.join(changed_keys)}"

            elif entity_name in ["leaverequests", "leave"]:
                description = f"Leave request {action_name}"
                if isinstance(payload, dict) and "status" in payload:
                    description = f"Leave request marked as '{payload.get('status')}'"

            elif entity_name in ["purchase-orders", "purchaseorders"]:
                description = f"Purchase Order {action_name}d for vendor"
                if isinstance(payload, dict) and "poNumber" in payload:
                    description = f"Purchase Order {payload.get('poNumber')} {action_name}d"

            elif entity_name in ["sitebookings", "bookings"]:
                site_code = payload.get("site") or payload.get("siteCode")
                dates = payload.get("dates")
                description = f"Booked site '{site_code or 'hoarding'}'" + (f" for {dates}" if dates else "")

            elif entity_name in ["Auth", "auth"]:
                if action_name == "login":
                    description = f"User logged in successfully"
                elif action_name == "login_failed":
                    description = f"Failed login attempt"
                elif action_name == "logout":
                    description = f"User logged out"
                
            db_activities.append({
                "time": time_str,
                "sort_key": dt,
                "actor": actor,
                "role": role,
                "action": action_name,
                "entity": entity_name,
                "source": source,
                "summary": description,
                "details": details
            })

        # Also parse chatbot interaction logs from session_logs.jsonl
        session_activities = _get_session_log_activities()
        
        # Merge both activity sources
        combined = db_activities + session_activities
        
        # Sort chronologically by sort_key descending
        combined.sort(key=lambda x: x.get("sort_key") or datetime.min, reverse=True)
        
        # Filter by action/actor if requested
        if action:
            combined = [c for c in combined if action.lower() in c["action"].lower()]
        if actor_email:
            combined = [c for c in combined if actor_email.lower() in c["actor"].lower()]
        if entity:
            combined = [c for c in combined if entity.lower() in c["entity"].lower()]
            
        final_list = combined[:limit]
        for a in final_list:
            a.pop("sort_key", None)
            
        from utils.id_mapper import resolve_agent_ids
        final_list = resolve_agent_ids(final_list, ["actorId", "targetId"])
        return {
            "status": "success",
            "total_found": len(final_list),
            "activities": final_list
        }
    except Exception as e:
        return {"status": "error", "message": f"Failed to retrieve activity logs: {str(e)}"}

def _get_session_log_activities():
    """Extracts operational mutations and chatbot actions directly from session_logs.jsonl."""
    import os, json
    from config.settings import LOG_FILE_PATH
    
    if not os.path.exists(LOG_FILE_PATH):
        return []
        
    user_map = {}
    try:
        for u in users_collection.find({}, {"_id": 1, "name": 1, "email": 1}):
            user_map[str(u["_id"])] = u.get("name") or u.get("email")
        for e in employees_collection.find({}, {"_id": 1, "fullName": 1}):
            user_map[str(e["_id"])] = e.get("fullName")
    except Exception:
        pass

    session_activities = []
    mutations = {
        "book_site", "apply_for_leave", "approve_leave_request", "reject_leave_request",
        "update_leave_balance", "add_lead", "update_lead", "claim_lead",
        "generate_quotation_pdf", "generate_po_pdf", "update_task_status",
        "add_employee", "update_employee", "remove_employee", "update_attendance_status"
    }

    try:
        with open(LOG_FILE_PATH, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                except Exception:
                    continue

                tool_calls = data.get("tool_calls", [])
                if not tool_calls:
                    continue

                ts_str = data.get("timestamp", "")
                try:
                    dt = datetime.fromisoformat(ts_str)
                    time_str = dt.strftime("%Y-%m-%d %H:%M:%S UTC")
                except Exception:
                    time_str = ts_str
                    dt = datetime.min

                uid = str(data.get("user_id") or "")
                actor = user_map.get(uid) or f"User ({uid[:6]})" if uid else "Chatbot User"
                role = data.get("role", "user")

                for tc in tool_calls:
                    tname = tc.get("name", "")
                    if tname not in mutations:
                        continue

                    args = tc.get("args", {})
                    res = tc.get("result", {})
                    status = res.get("status") if isinstance(res, dict) else "success"
                    blocked = (status == "permission_denied") or data.get("blocked", False) or (isinstance(res, dict) and res.get("blocked", False))

                    action_type = "action"
                    entity_type = "system"
                    summary = None
                    details = None

                    if tname == "book_site":
                        site_code = args.get("site_code", "Unknown")
                        s_date = args.get("start_date", "")
                        e_date = args.get("end_date", s_date)
                        camp = args.get("campaign_name", "")
                        camp_str = f" for campaign '{camp}'" if camp else ""
                        action_type = "book"
                        entity_type = "sitebookings"
                        if status == "success":
                            summary = f"Booked site '{site_code}' from {s_date} to {e_date}{camp_str}"
                        else:
                            summary = f"Attempted booking for site '{site_code}' ({s_date} to {e_date}) — Blocked (Double-Booking)"
                            details = res.get("message") if isinstance(res, dict) else None

                    elif tname == "apply_for_leave":
                        s_date = args.get("start_date", "")
                        e_date = args.get("end_date", s_date)
                        reason = args.get("reason", "Personal")
                        action_type = "create"
                        entity_type = "leaverequests"
                        summary = f"Submitted leave request for {s_date} to {e_date} ('{reason}')"

                    elif tname == "approve_leave_request":
                        req_id = args.get("request_id", "")
                        action_type = "approve"
                        entity_type = "leaverequests"
                        summary = f"Approved leave request (ID: {req_id})"

                    elif tname == "reject_leave_request":
                        req_id = args.get("request_id", "")
                        action_type = "reject"
                        entity_type = "leaverequests"
                        summary = f"Rejected leave request (ID: {req_id})"

                    elif tname == "update_leave_balance":
                        action_type = "update"
                        entity_type = "leavebalances"
                        summary = f"Updated leave balance for employee ({args.get('employee_id', '')})"
                        details = ", ".join([f"{k}: {v}" for k, v in args.items() if k != "employee_id"])

                    elif tname == "add_lead":
                        company = args.get("company_name", args.get("company", "New Lead"))
                        action_type = "create"
                        entity_type = "leads"
                        summary = f"Added new lead for '{company}'"

                    elif tname == "update_lead":
                        action_type = "update"
                        entity_type = "leads"
                        st = args.get("status")
                        budget = args.get("budget")
                        info = f"Status: {st}" if st else (f"Budget: INR {budget:,}" if budget else "lead details")
                        summary = f"Updated lead ({info})"

                    elif tname == "claim_lead":
                        action_type = "claim"
                        entity_type = "leads"
                        summary = f"Claimed lead (ID: {args.get('lead_id', '')})"

                    elif tname == "generate_quotation_pdf":
                        q_num = args.get("quote_number") or (res.get("quote_number") if isinstance(res, dict) else "")
                        client = args.get("client_name", "")
                        action_type = "generate_pdf"
                        entity_type = "quotations"
                        summary = f"Generated quotation PDF {q_num} for client '{client or 'Lead'}'"

                    elif tname == "generate_po_pdf":
                        po_num = args.get("po_number") or args.get("po_id") or ""
                        action_type = "generate_pdf"
                        entity_type = "purchase-orders"
                        summary = f"Generated Purchase Order PDF {po_num}"

                    elif tname == "update_task_status":
                        st = args.get("status", "")
                        action_type = "update"
                        entity_type = "tasks"
                        summary = f"Updated task status to '{st}'"

                    elif tname == "add_employee":
                        name = args.get("name", "New Employee")
                        dept = args.get("department", "")
                        role_str = args.get("role", "")
                        action_type = "create"
                        entity_type = "employees"
                        summary = f"Onboarded new employee '{name}' ({role_str} - {dept})"

                    elif tname == "update_employee":
                        action_type = "update"
                        entity_type = "employees"
                        summary = f"Updated employee profile ({args.get('name') or args.get('employee_id')})"

                    elif tname == "remove_employee":
                        action_type = "delete"
                        entity_type = "employees"
                        summary = f"Removed employee ({args.get('employee_id')})"

                    elif tname == "update_attendance_status":
                        action_type = "update"
                        entity_type = "attendance"
                        summary = f"Updated attendance for {args.get('date', 'today')} to '{args.get('status')}'"

                    session_activities.append({
                        "time": time_str,
                        "sort_key": dt,
                        "actor": actor,
                        "role": role,
                        "action": action_type,
                        "entity": entity_type,
                        "source": "Chatbot (AI Assistant)",
                        "summary": summary,
                        "details": details
                    })
    except Exception as e:
        print(f"[Session Log Parse Error] {e}")

    return session_activities

def log_audit_event(actor_id, actor_name, actor_role, action, entity, entity_id=None, payload=None):
    """Logs a mutation event triggered by the AI chatbot to MongoDB auditlogs."""
    try:
        doc = {
            "actorId": ObjectId(actor_id) if actor_id and len(str(actor_id)) == 24 else None,
            "actorEmail": actor_name,
            "actorRole": actor_role,
            "action": action,
            "entity": entity,
            "entityId": ObjectId(entity_id) if entity_id and len(str(entity_id)) == 24 else entity_id,
            "payload": payload or {},
            "channel": "ai_assistant",
            "createdAt": datetime.utcnow()
        }
        audit_logs_collection.insert_one(doc)
    except Exception as e:
        print(f"[Audit Log Warning] Could not write chatbot audit entry: {e}")

def get_employee_performance_summary(department=None, employee_name=None, manager_id=None):
    """
    Evaluates and generates a structured employee performance summary.
    Aggregates operational activity: tasks completed, leads won/handled, quotations generated,
    site bookings, attendance consistency, and leave adherence.
    """
    try:
        from data.db_client import (
            employees_collection,
            tasks_collection,
            leads_collection,
            quotations_collection,
            leave_balances_collection,
            db
        )
        query = {}
        if department:
            query["department"] = {"$regex": f"^{department.strip()}$", "$options": "i"}
        if employee_name:
            query["fullName"] = {"$regex": employee_name.strip(), "$options": "i"}
        if manager_id:
            from bson import ObjectId
            # Manager can see themselves and their direct reports
            query["$or"] = [
                {"reportingManagerId": ObjectId(manager_id) if len(manager_id)==24 else manager_id},
                {"_id": ObjectId(manager_id) if len(manager_id)==24 else manager_id}
            ]
            
        employees = list(employees_collection.find(query))
        if not employees:
            return {"status": "error", "message": f"No employees found matching criteria (department={department}, name={employee_name})."}
            
        evaluated = []
        for emp in employees:
            eid = str(emp["_id"])
            name = emp.get("fullName", "Unknown")
            dept = emp.get("department", "General")
            desig = emp.get("designation", "Staff")
            
            # 1. Leave & Discipline
            leave = leave_balances_collection.find_one({"employeeId": eid}) or {}
            allocated = leave.get("allocated", 10)
            used = leave.get("used", 0)
            remaining = max(0, allocated - used)
            unpaid = leave.get("unpaid_leaves_taken", 0)
            
            # 2. Tasks
            tasks_comp = tasks_collection.count_documents({"assignedTo": eid, "status": "Completed"})
            tasks_pend = tasks_collection.count_documents({"assignedTo": eid, "status": "Pending"})
            
            # 3. Department-specific metrics
            highlights = []
            score = 80 # Baseline satisfactory score
            
            if "sale" in dept.lower() or "sale" in desig.lower():
                leads_count = leads_collection.count_documents({"$or": [{"assignedTo": eid}, {"claimedBy": name}]})
                quotes_count = quotations_collection.count_documents({"$or": [{"createdBy": eid}, {"clientName": {"$regex": name, "$options": "i"}}]})
                if leads_count > 0 or quotes_count > 0:
                    score += 15
                    highlights.append(f"Active sales pipeline ({leads_count} leads, {quotes_count} quotes)")
                else:
                    score += 5
                    highlights.append("Managing client accounts & sales leads")
                    
            elif "op" in dept.lower() or "op" in desig.lower():
                highlights.append("Overseeing outdoor site bookings and field execution")
                score += 10
                
            elif "hr" in dept.lower():
                highlights.append("Active HR compliance, leave processing, and employee records management")
                score += 10
                
            elif "manage" in dept.lower():
                highlights.append("Executive leadership, strategy, and operational approvals")
                score += 15

            # Leave impact
            if used == 0:
                highlights.append(f"100% attendance adherence (0 leaves taken, {remaining} remaining)")
                score += 5
            elif used <= 2:
                highlights.append(f"Normal leave utilization ({used} days used, {remaining} remaining)")
            else:
                highlights.append(f"Higher leave utilization ({used} days used)")
                score -= 5
                
            if unpaid > 0:
                score -= 15
                highlights.append(f"Warning: {unpaid} unpaid leaves recorded")

            if tasks_comp > 0:
                score += (tasks_comp * 5)
                highlights.append(f"Completed {tasks_comp} assigned tasks")
            if tasks_pend > 2:
                score -= 10
                highlights.append(f"{tasks_pend} tasks currently pending")

            evaluated.append({
                "employee_id": eid,
                "name": name,
                "department": dept,
                "designation": desig,
                "score": min(100, max(40, score)),
                "leave_status": f"{used} used / {remaining} remaining",
                "completed_tasks": tasks_comp,
                "pending_tasks": tasks_pend,
                "highlights": "; ".join(highlights)
            })
            
        # Sort deterministically by score descending, then by name
        evaluated.sort(key=lambda x: (x["score"], x["name"]), reverse=True)
        
        highest = [e for e in evaluated if e["score"] >= 90]
        if not highest and evaluated:
            highest = evaluated[:2]

        lowest = [e for e in evaluated if e["score"] <= 75]
        if not lowest and len(evaluated) > 2:
            lowest = evaluated[-2:]
            
        return {
            "status": "success",
            "total_evaluated": len(evaluated),
            "department": department or "All Departments",
            "highest_performers": [
                {
                    "name": h["name"],
                    "department": h["department"],
                    "designation": h["designation"],
                    "performance_rating": "Top Performer",
                    "score": f"{h['score']}/100",
                    "key_achievements": h["highlights"]
                }
                for h in highest
            ],
            "lowest_performers": [
                {
                    "name": l["name"],
                    "department": l["department"],
                    "designation": l["designation"],
                    "performance_rating": "Needs Attention",
                    "score": f"{l['score']}/100",
                    "areas_for_improvement": l["highlights"]
                }
                for l in lowest
            ] if lowest else [],
            "all_employee_rankings": [
                {
                    "name": e["name"],
                    "department": e["department"],
                    "score": f"{e['score']}/100",
                    "leave_record": e["leave_status"],
                    "operational_notes": e["highlights"]
                }
                for e in evaluated
            ]
        }
    except Exception as e:
        return {"status": "error", "message": f"Failed to compute performance summary: {str(e)}"}

def get_hiring_and_firing_metrics(year: int = None, month: int = None):
    try:
        now = datetime.now()
        if year is None: year = now.year
        if month is None: month = now.month
        
        hired = []
        fired = []
        
        # Check all employees for dateOfJoining
        for emp in employees_collection.find({"dateOfJoining": {"$ne": None}}):
            try:
                doj_str = str(emp.get("dateOfJoining", ""))
                # Handle possible isoformat or YYYY-MM-DD
                if "T" in doj_str:
                    doj = datetime.fromisoformat(doj_str.replace("Z", "+00:00"))
                else:
                    doj = datetime.strptime(doj_str[:10], "%Y-%m-%d")
                
                if doj.year == year and doj.month == month:
                    hired.append({
                        "name": emp.get("fullName", "Unknown"),
                        "department": emp.get("department", "Unknown"),
                        "designation": emp.get("designation", "Unknown")
                    })
            except Exception as e:
                pass
                
        # Check all inactive employees for dateOfExit or updated_at if exit is null
        for emp in employees_collection.find({"status": {"$in": ["inactive", "terminated", "offboarded"]}}):
            try:
                doe_str = str(emp.get("dateOfExit", ""))
                if not doe_str or doe_str == "None":
                    # Fallback to updatedAt if no explicit dateOfExit but status is inactive
                    doe_str = str(emp.get("updatedAt", ""))
                    
                if doe_str and doe_str != "None":
                    if "T" in doe_str:
                        doe = datetime.fromisoformat(doe_str.replace("Z", "+00:00"))
                    else:
                        doe = datetime.strptime(doe_str[:10], "%Y-%m-%d")
                    
                    if doe.year == year and doe.month == month:
                        fired.append({
                            "name": emp.get("fullName", "Unknown"),
                            "department": emp.get("department", "Unknown"),
                            "designation": emp.get("designation", "Unknown")
                        })
            except Exception as e:
                pass

        return {
            "status": "success",
            "year": year,
            "month": month,
            "hiring_count": len(hired),
            "firing_count": len(fired),
            "hired_employees": hired,
            "fired_employees": fired
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
