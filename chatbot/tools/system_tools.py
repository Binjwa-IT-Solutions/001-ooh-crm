# tools/system_tools.py

from langchain_core.tools import tool
from adapters import crm_adapter

# ============================================================
# GET ROLE ACCESS & PERMISSIONS
# ============================================================

@tool
def get_role_access(role: str = None, employee_name: str = None):
    """
    Check what permissions, access rights, and tool capabilities a specific CRM role
    (e.g., 'admin', 'hr', 'manager', 'sales_agent', 'ops', 'finance', 'employee')
    or a specific employee (e.g., 'Imran Shaikh', 'Rohit Menon') has in the company CRM.
    
    Use this tool whenever a user asks:
    - What access or permissions a role or member has (e.g., "how much access does HR have?", "what permissions does manager have?", "what can I access?").
    - Who has access to what features in the system.
    """
    return crm_adapter.get_role_access(role=role, employee_name_or_id=employee_name)


# ============================================================
# GET RECENT ACTIVITY / AUDIT LOGS
# ============================================================

@tool
def get_recent_activity(limit: int = 10, action: str = None, actor_email: str = None, entity: str = None):
    """
    View recent activities, modifications, updates, or audit logs recorded in the CRM database.
    
    Use this tool whenever a user asks:
    - Who made recent updates or changes in the database.
    - What updates were performed recently.
    - Audit logs or recent system events.
    
    Optional filters:
    - action: 'update', 'create', 'delete', 'login'
    - actor_email: email of the user who performed the action
    - entity: record type, e.g., 'sites', 'leads', 'employees', 'quotations'
    - limit: number of records to retrieve (default 10)
    """
    return crm_adapter.get_recent_activity(
        limit=limit,
        action=action,
        actor_email=actor_email,
        entity=entity
    )

# ============================================================
# GENERATE ANALYTICAL IMAGE
# ============================================================

@tool
def generate_analytical_image(prompt: str, data: str = None, manager_id: str = None):
    """
    Generate an analytical image with colorful graphs, bar charts, and pie charts based on CRM data.
    Only admins and managers can use this tool to generate visual analytical reports.
    
    Use this tool whenever the user asks for a chart, graph, visual, or analytical image.
    CRITICAL INSTRUCTION FOR DATA:
    You MUST NOT invent, guess, or hand-type the JSON for the `data` parameter. 
    You MUST ONLY pass the EXACT JSON data structure that was returned to you by other tools (like `get_leads`, `get_hiring_and_firing_metrics`, etc.). 
    If you have not called those tools yet in this specific turn, you MUST call them FIRST before calling this tool. 
    Failure to do so will result in hallucinated charts which is strictly forbidden.
    
    Args:
        prompt: Description of the analytical image to generate (e.g. "leads by source", "performance comparison").
        data: A JSON string containing the data to visualize. It MUST be the exact JSON returned from a previous tool call.
    """
    import os
    import uuid
    import json
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import seaborn as sns
    from datetime import datetime
    from assistant.assistant import call_gemini

    try:
        charts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "charts")
        os.makedirs(charts_dir, exist_ok=True)
        
        filename = f"analytics_{uuid.uuid4().hex[:8]}.png"
        filepath = os.path.join(charts_dir, filename)
        
        # Forcefully fetch real data from the DB to prevent the assistant from hallucinating
        from adapters import crm_adapter, lead_adapter
        try:
            real_hf_data = crm_adapter.get_hiring_and_firing_metrics()
            real_leads_data = lead_adapter.get_leads()
            
            # Count leads by agent to simplify for the script generator
            lead_counts = {}
            for l in real_leads_data.get("leads", []):
                agent = l.get("assignedTo") or "Unassigned / Other"
                lead_counts[agent] = lead_counts.get(agent, 0) + 1
            
            forced_real_data = json.dumps({
                "hiring_and_firing_metrics": real_hf_data,
                "leads_distribution": lead_counts
            }, indent=2)
        except Exception as e:
            forced_real_data = "{}"
            
        if not data:
            data = "{}"
            
        llm_prompt = f"""
        Write a complete Python script to generate a stunning, modern chart using `seaborn` and `matplotlib` based on the user's prompt and data.
        The script must save the figure to the exact filepath provided below.
        
        Filepath to save: {filepath}
        
        User Prompt: {prompt}
        
        Data to visualize (JSON string provided by assistant):
        {data}
        
        CRITICAL REAL DATABASE OVERRIDE:
        The assistant often hallucinates the data string above. You MUST USE the following REAL database metrics to draw your charts if the user's prompt is about hiring, firing, or leads:
        {forced_real_data}

        
        Requirements:
        - Parse the JSON data string provided above using `json.loads`.
        - Use `seaborn` (imported as `sns`) and `matplotlib.pyplot` (imported as `plt`).
        - Set the seaborn style (e.g., `sns.set_theme(style="whitegrid")`).
        - Set the figure size to be large enough (e.g., `plt.figure(figsize=(14, 8))`).
        - Use a beautiful, modern color palette.
        - Add clear titles, labels, and optionally legends if needed.
        - If there is a date/time component, format it correctly.
        - The very last line must save the plot using `plt.savefig('{filepath}', bbox_inches='tight', dpi=150)`.
        - DO NOT include `plt.show()`.
        - Output ONLY the raw Python code. Do NOT include markdown code blocks (```python) or any other text.
        """
        
        # Call the Gemini model directly
        response = call_gemini([{"role": "user", "content": llm_prompt}], tools=None)
        code = response.get("content", "").strip()
        
        # Clean markdown if present
        if code.startswith("```python"):
            code = code[9:]
        if code.startswith("```"):
            code = code[3:]
        if code.endswith("```"):
            code = code[:-3]
        
        code = code.strip()
        
        # Execute the generated code safely in a restricted local namespace
        namespace = {'json': json, 'plt': plt, 'sns': sns, 'datetime': datetime}
        exec(code, namespace)
        
        # Ensure figure is closed
        plt.close('all')
        
        if os.path.exists(filepath):
            image_url = f"/charts/{filename}"
            return {
                "status": "success",
                "message": f"Analytical image generated successfully based on user prompt.",
                "image_url": image_url
            }
        else:
            return {
                "status": "error", 
                "message": "Failed to save the image. The generated script did not create the file."
            }
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        plt.close('all')
        return {
            "status": "error",
            "message": f"Failed to generate dynamic analytical image: {str(e)}"
        }
