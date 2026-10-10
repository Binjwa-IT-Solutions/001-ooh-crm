# app.py - Media Octus CRM AI Assistant Web Application Server
import os
import sys
from flask import Flask, request, jsonify, send_from_directory
from assistant.assistant import ask_employee_assistant
from assistant.session import Session
from assistant.permissions import get_allowed_tools
from data.db_client import employees_collection, users_collection
from config.settings import MONGO_URI, GEMINI_MODEL, GROQ_MODEL

app = Flask(__name__, static_folder="static")

# In-memory sessions: session_id -> Session object
active_sessions = {}

def get_or_create_session(user_id, role="employee", name="User", session_id=None):
    clean_session_id = str(session_id) if session_id else "default"
    session_key = f"{user_id}:{clean_session_id}"
    if session_key not in active_sessions:
        active_sessions[session_key] = Session(
            user_id=user_id or "user",
            name=name,
            role=role
        )
    else:
        sess = active_sessions[session_key]
        if str(sess.user_id) != str(user_id):
            active_sessions[session_key] = Session(
                user_id=user_id or "user",
                name=name,
                role=role
            )
        else:
            if name and name != "User":
                sess.name = name
            if role:
                sess.role = role
    return active_sessions[session_key]

@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("static", path)

@app.route("/api/users", methods=["GET"])
def get_users():
    """Fetch all active employees with their mapped CRM roles."""
    try:
        all_employees = list(employees_collection.find({}, sort=[("fullName", 1)]))
        users_list = []
        
        for emp in all_employees:
            user_doc = users_collection.find_one({"_id": emp.get("userId")}) if emp.get("userId") else None
            role = user_doc.get("role") if user_doc else None
            
            if not role or role.lower() == "unknown":
                desig = emp.get("designation", "").lower()
                dept = emp.get("department", "").lower()
                if "sale" in desig or "sale" in dept or "account executive" in desig:
                    role = "sales_agent"
                elif "op" in desig or "op" in dept or "supervisor" in desig:
                    role = "ops"
                elif "hr" in desig or "hr" in dept:
                    role = "hr"
                elif "finance" in desig or "finance" in dept or "account" in desig:
                    role = "finance"
                elif "manage" in dept or "director" in desig:
                    role = "manager"
                elif "admin" in dept or "admin" in desig:
                    role = "admin"
                else:
                    role = "employee"
            
            allowed = get_allowed_tools(role)
            users_list.append({
                "id": str(emp["_id"]),
                "name": emp.get("fullName", "Unknown"),
                "email": emp.get("workEmail", ""),
                "department": emp.get("department", "Unknown"),
                "designation": emp.get("designation", role.capitalize()),
                "role": role,
                "tool_count": len(allowed)
            })
            
        return jsonify({"status": "success", "users": users_list})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/tools", methods=["GET"])
def get_tools_for_role():
    """Get list of allowed tools for a specific role."""
    role = request.args.get("role", "employee")
    allowed = get_allowed_tools(role)
    return jsonify({
        "status": "success",
        "role": role,
        "tools": allowed,
        "count": len(allowed)
    })

def auto_format_table(text):
    """Ensure any multi-record list with attributes is rendered in proper Markdown tabular form."""
    if not text or '| ---' in text or '|:---' in text:
        return text
    import re
    # Clean technical MongoDB ObjectIDs and disclaimers from intro
    text = re.sub(r'It looks like you are logged in as \(or comparing against\) the manager with ID [a-f0-9]{24}\.?\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\(ID:?\s*[a-f0-9]{24}\)', '', text)
    
    # Bail out if this doesn't look like CRM data (prevents recipes from becoming employee tables!)
    crm_keywords = ['employee', 'lead', 'task', 'attendance', 'leave', 'site', 'booking', 'quotation', 'vendor', 'purchase order', 'performance']
    if not any(kw in text.lower() for kw in crm_keywords):
        return text
    
    # Match numbered items: e.g. 1. **Name** or 1. Name
    parts = re.split(r'\n(?=\d+\.\s+)', text)
    if len(parts) < 3: # at least intro + 2 items
        return text
    
    intro = parts[0].strip()
    items = parts[1:]
    
    rows = []
    all_keys = ['Name']
    preferred_order = ['Name', 'Designation', 'Role', 'Department', 'Email', 'Phone', 'Status', 'Date', 'Leaves', 'Ctc', 'Salary']
    
    for item in items:
        lines = [l.strip() for l in item.strip().split('\n') if l.strip()]
        if not lines:
            continue
        name_line = re.sub(r'^\d+\.\s*', '', lines[0])
        name_clean = name_line.strip('* :-')
        row = {'Name': f'**{name_clean}**'}
        
        # Check if first line has inline attributes like: Name (Marketing / Sales Agent) or Name (Sales)
        if '(' in name_line and ')' in name_line:
            m_paren = re.search(r'^(.*?)\s*\(([^)]+)\)', name_line)
            if m_paren:
                clean_n = m_paren.group(1).strip('* :-')
                details = m_paren.group(2).strip()
                row['Name'] = f'**{clean_n}**'
                if '/' in details:
                    parts_p = [p.strip() for p in details.split('/', 1)]
                    if 'Department' not in all_keys: all_keys.append('Department')
                    if 'Designation' not in all_keys: all_keys.append('Designation')
                    row['Department'] = parts_p[0]
                    row['Designation'] = parts_p[1]
                elif '-' in details:
                    parts_p = [p.strip() for p in details.split('-', 1)]
                    if 'Department' not in all_keys: all_keys.append('Department')
                    if 'Designation' not in all_keys: all_keys.append('Designation')
                    row['Department'] = parts_p[0]
                    row['Designation'] = parts_p[1]
                else:
                    if 'Department' not in all_keys: all_keys.append('Department')
                    row['Department'] = details
        elif '-' in name_line:
            parts_dash = [p.strip() for p in name_line.split('-', 1)]
            clean_n = parts_dash[0].strip('* :-')
            row['Name'] = f'**{clean_n}**'
            if 'Designation' not in all_keys: all_keys.append('Designation')
            row['Designation'] = parts_dash[1].strip('* ')
            
        # Parse subsequent lines for key-value pairs
        for l in lines[1:]:
            m = re.match(r'^[-*•]?\s*(?:\*\*)?([A-Za-z\s]+?)(?:\*\*)?\s*:\s*(.+)$', l)
            if m:
                k = m.group(1).strip().title()
                v = m.group(2).strip().strip('*')
                if k not in all_keys:
                    all_keys.append(k)
                row[k] = v
        rows.append(row)
        
    if len(rows) < 2 or len(all_keys) < 2:
        return text
        
    sorted_headers = [h for h in preferred_order if h in all_keys]
    for h in all_keys:
        if h not in sorted_headers:
            sorted_headers.append(h)
            
    header_row = '| ' + ' | '.join(sorted_headers) + ' |'
    sep_row = '| ' + ' | '.join([':---'] * len(sorted_headers)) + ' |'
    data_rows = ['| ' + ' | '.join([r.get(h, '-') for h in sorted_headers]) + ' |' for r in rows]
    
    table_md = '\n'.join([header_row, sep_row] + data_rows)
    return (intro + '\n\n' + table_md).strip()

@app.route("/charts/<path:filename>")
def serve_chart(filename):
    return send_from_directory("static/charts", filename)

@app.route("/chat", methods=["POST"])
@app.route("/api/chat", methods=["POST"])
def chat():
    """Handle chat queries with role session memory."""
    data = request.get_json() or {}
    message = data.get("message", "").strip()
    session_id = data.get("sessionId") or data.get("session_id")
    user_id = data.get("user_id") or data.get("userId") or session_id
    role = data.get("role", "employee")
    name = data.get("name", "User")

    if not message:
        return jsonify({"status": "error", "message": "Message cannot be empty."}), 400
    if not (user_id or session_id):
        return jsonify({"status": "error", "message": "user_id or sessionId is required."}), 400

    try:
        session = get_or_create_session(user_id=user_id, role=role, name=name, session_id=session_id)
        response_text = ask_employee_assistant(session, message)
        formatted_response = auto_format_table(response_text)
        
        # Auto-embed chart images: find any /charts/*.png reference and render as HTML img
        import re
        chart_match = re.search(r'(/charts/[a-zA-Z0-9_]+\.png)', formatted_response)
        if chart_match:
            chart_url = chart_match.group(1)
            # Remove the raw URL from text
            formatted_response = re.sub(
                r'\s*\[?[^\]]*\]?\s*\(?\s*/charts/[a-zA-Z0-9_]+\.png\s*\)?\s*',
                '',
                formatted_response
            ).strip()
            # Append the image as HTML at the end with Media Octus colors (#6E1D1D)
            formatted_response += f'\n\n<div style="text-align:center; margin-top:12px;"><img src="{chart_url}" alt="Analytical Report" style="max-width:100%;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15); display:block; margin: 0 auto;" /><br/><a href="{chart_url}" download="Media_Octus_Analytics.png" style="display:inline-block; margin-top:12px; padding:10px 20px; background-color:#6E1D1D; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:bold; font-size:14px; box-shadow:0 2px 8px rgba(110, 29, 29, 0.3);">⬇ Download Image</a></div>'        
        current_emp = session.current_employee.get("name") if session.current_employee else None

        return jsonify({
            "status": "success",
            "reply": formatted_response,
            "response": formatted_response,
            "sessionId": session_id or user_id,
            "role": session.role,
            "current_employee": current_emp
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Server encountered an error: {str(e)}"
        }), 500

@app.route("/reset", methods=["POST"])
@app.route("/api/reset", methods=["POST"])
def reset_session():
    """Reset conversation memory for a user session."""
    data = request.get_json() or {}
    session_id = data.get("sessionId") or data.get("session_id") or "default"
    user_id = data.get("user_id") or data.get("userId") or "user"
    role = data.get("role", "employee")
    name = data.get("name", "User")
    
    session_key = f"{user_id}:{session_id}"
    if session_key in active_sessions:
        active_sessions[session_key].messages = []
        active_sessions[session_key].clear_current_employee()
    else:
        active_sessions[session_key] = Session(user_id=user_id, name=name, role=role)
        
    return jsonify({"status": "success", "message": "Session context reset."})

@app.route("/tool", methods=["POST"])
@app.route("/api/tool", methods=["POST"])
def execute_direct_tool():
    """Directly execute a CRM tool with server-side authorization enforcement."""
    data = request.get_json() or {}
    tool_name = data.get("tool_name") or data.get("tool")
    tool_args = data.get("tool_args") or data.get("args") or {}
    user_id = data.get("user_id") or data.get("userId")
    role = data.get("role", "employee")
    name = data.get("name", "User")
    session_id = data.get("sessionId") or "direct_tool"

    if not tool_name:
        return jsonify({"status": "error", "message": "tool_name is required."}), 400
    if not user_id:
        return jsonify({"status": "error", "message": "user_id is required."}), 400

    # 1. Server-side tool authorization check
    allowed_tools = get_allowed_tools(role)
    if tool_name not in allowed_tools:
        return jsonify({
            "status": "permission_denied",
            "message": f"Role '{role}' is not authorized to execute tool '{tool_name}'."
        }), 403

    from tools import ALL_TOOLS
    from assistant.assistant import execute_tool

    if tool_name not in ALL_TOOLS:
        return jsonify({"status": "error", "message": f"Tool '{tool_name}' not found."}), 404

    session = get_or_create_session(user_id=user_id, role=role, name=name, session_id=session_id)
    tool = ALL_TOOLS[tool_name]
    result = execute_tool(session, tool_name, tool, tool_args)
    if isinstance(result, dict) and result.get("status") == "permission_denied":
        return jsonify(result), 403

    return jsonify({"status": "success", "tool": tool_name, "result": result}), 200

@app.route("/health", methods=["GET"])
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "database": "MongoDB Connected",
        "primary_model": GEMINI_MODEL,
        "fallback_model": GROQ_MODEL
    })

if __name__ == "__main__":
    os.makedirs("static", exist_ok=True)
    os.makedirs("static/charts", exist_ok=True)
    port = int(os.environ.get("PORT", os.environ.get("PYTHON_CHATBOT_PORT", 8000)))
    print(f"Starting Media Octus CRM AI Assistant Web Server on http://localhost:{port} ...")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
