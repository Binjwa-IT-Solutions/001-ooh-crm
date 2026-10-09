import json

# Define the logical tool domains
# get_employee is included in every domain since many tools require an employee ID
TOOL_DOMAINS = {
    "HR": [
        "get_employee", "update_employee", "add_employee", "remove_employee",
        "get_leave_balance", "update_leave_balance", "apply_for_leave",
        "get_pending_leave_requests", "approve_leave_request", "reject_leave_request",
        "generate_leave_image",
        "get_attendance_status", "update_attendance_status", "get_salary_details",
        "get_role_access", "get_employee_performance_summary",
        "generate_analytical_image"
    ],
    "SALES": [
        "get_employee", "add_lead", "get_leads", "update_lead", "claim_lead",
        "generate_quotation_pdf", "get_quotations", "update_quotation"
    ],
    "OPS": [
        "get_employee", "generate_po_pdf", "get_purchase_orders",
        "get_sites", "get_bookings", "book_site", "get_vendors", "get_campaigns",
        "get_company_finance_summary", "get_recent_activity"
    ],
    "TASKS": [
        "get_employee", "get_my_tasks", "update_task_status", "reassign_tasks", "create_task",
        "get_escalations", "acknowledge_escalation", "get_employee_performance_summary"
    ],
    "GENERAL": [
        "get_role_access", "get_recent_activity", "get_employee",
        "remove_employee", "add_employee", "update_employee",
        "get_leave_balance", "update_leave_balance", "apply_for_leave", "get_attendance_status", 
        "get_my_tasks", "reassign_tasks", "create_task", "get_leads", "get_purchase_orders", "get_sites",
        "get_bookings", "book_site", "get_escalations", "get_employee_performance_summary",
        "get_salary_details", "update_salary", "generate_analytical_image"
    ]
}

def route_intent(question):
    """
    Uses a lightweight LLM call or fast keyword heuristic to classify the user's intent.
    This saves massive amounts of tokens by avoiding sending all 33 tools to the main LLM.
    """
    q_lower = question.lower()
    
    # Fast keyword shortcuts
    if any(w in q_lower for w in ["access", "permission", "permissions", "privilege", "audit", "recent update", "recent activity", "who updated", "who made", "who did", "who changed"]):
        return "GENERAL"
    if any(w in q_lower for w in ["image", "graph", "chart", "analytical image", "generate image", "visualize", "visualization"]):
        return "GENERAL"
        
    from assistant.assistant import call_llm
    
    prompt = f"""
You are an intent router for a corporate CRM assistant.
Your job is to read the user's request and classify it into exactly ONE of the following tool categories:

- HR: leave, attendance, salary, adding/removing employees, role changes.
- SALES: leads, quotations, prospects.
- OPS: purchase orders, sites, vendors, bookings, campaigns, finances.
- TASKS: tasks, escalations, tickets.
- GENERAL: Use this for questions about permissions, access levels, roles, audit logs/recent updates, questions spanning multiple categories (e.g. PO and tasks), or general CRM inquiries.

User Request: "{question}"

Reply ONLY with the exact category name (HR, SALES, OPS, TASKS, or GENERAL). Do not add any punctuation or explanation.
"""

    messages = [{"role": "user", "content": prompt}]
    
    try:
        response, provider = call_llm(messages, tools=[])
        category = response.get("content", "").strip().upper()
        
        # Clean up possible LLM noise
        for valid in ["HR", "SALES", "OPS", "TASKS", "GENERAL"]:
            if valid in category:
                return valid
                
        return "GENERAL"
    except Exception as e:
        print(f"[Router Error] Falling back to GENERAL due to: {e}")
        return "GENERAL"

def filter_tools_by_domain(allowed_tools, domain, question=""):
    """
    Intersects the user's allowed tools with the domain's tools, while ensuring
    any explicitly requested entities (e.g. POs or tasks in hybrid queries) retain their tools.
    """
    domain_tool_names = set(TOOL_DOMAINS.get(domain, TOOL_DOMAINS["GENERAL"]))
    
    q_lower = (question or "").lower()
    # Hybrid query retention: ensure explicitly mentioned items are kept if allowed
    if any(k in q_lower for k in ["remove", "delete", "fire", "terminate", "offboard", "dismiss", "sompany", "company"]):
        domain_tool_names.add("remove_employee")
        domain_tool_names.add("get_employee")
    if any(k in q_lower for k in ["assign", "reassign", "stask", "task", "tasks"]):
        domain_tool_names.add("create_task")
        domain_tool_names.add("reassign_tasks")
        domain_tool_names.add("get_my_tasks")
        domain_tool_names.add("get_employee")
    if any(k in q_lower for k in ["add employee", "onboard", "hire", "new employee"]):
        domain_tool_names.add("add_employee")
        domain_tool_names.add("create_task")
        domain_tool_names.add("get_employee")
    if any(k in q_lower for k in ["update employee", "change role", "change department", "promote"]):
        domain_tool_names.add("update_employee")
        domain_tool_names.add("get_employee")
    if any(k in q_lower for k in ["po", "po-", "purchase order", "purchase orders"]):
        domain_tool_names.add("get_purchase_orders")
    if any(k in q_lower for k in ["leave", "leaves", "apply", "allocated", "attendance"]):
        domain_tool_names.add("apply_for_leave")
        domain_tool_names.add("get_leave_balance")
        domain_tool_names.add("update_leave_balance")
        if any(k in q_lower for k in ["image", "graph", "chart", "analytical", "visualize"]):
            domain_tool_names.add("generate_leave_image")
    if any(k in q_lower for k in ["book", "booking", "double-booking", "overlapping", "site", "hoarding"]):
        domain_tool_names.add("book_site")
        domain_tool_names.add("get_bookings")
        domain_tool_names.add("get_sites")
    if any(k in q_lower for k in ["performance", "performer", "performers", "lowest", "highest", "poor", "kpi", "rating", "rank"]):
        domain_tool_names.add("get_employee_performance_summary")
        domain_tool_names.add("get_employee")
        domain_tool_names.add("get_my_tasks")
    if any(k in q_lower for k in ["salary", "ctc", "pay", "compensation", "increase", "raise", "increment"]):
        domain_tool_names.add("update_salary")
        domain_tool_names.add("get_salary_details")
        domain_tool_names.add("get_employee")
        if any(k in q_lower for k in ["image", "graph", "chart", "analytical", "visualize", "visualization"]):
            domain_tool_names.add("generate_salary_image")
    if any(k in q_lower for k in ["image", "graph", "chart", "analytical", "visualize", "visualization", "generate image", "show image", "visual"]):
        domain_tool_names.add("generate_analytical_image")
        domain_tool_names.add("generate_salary_image")
        domain_tool_names.add("generate_leave_image")
        domain_tool_names.add("generate_lead_source_image")
        domain_tool_names.add("get_employee_performance_summary")

    
    filtered = []
    for tool in allowed_tools:
        if getattr(tool, "name", None) in domain_tool_names:
            filtered.append(tool)
            
    # If for some reason filtering left them with no tools, fallback to a minimal safe set
    if not filtered:
        return [t for t in allowed_tools if getattr(t, "name", None) == "get_employee"] or allowed_tools[:5]
        
    return filtered

