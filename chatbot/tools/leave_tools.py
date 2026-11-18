# tools/leave_tools.py

from langchain_core.tools import tool

from adapters import crm_adapter

@tool
def get_leave_balance(
    name: str = None,
    employee_id: str = None
) -> dict:
    """
    Get the leave balance for an employee.
    Provide EITHER the employee's 'name' (e.g. 'Imran', 'Sana', 'Sakshi') OR their 'employee_id'.
    CRITICAL: In this organization, leave allocations are strictly MONTHLY (e.g. 3 monthly paid leaves per month), NOT annual.
    Always describe the balance as Monthly Paid Leave, never annual leave.
    You MUST call this tool and use ONLY the data it returns. Never state any leave numbers from memory or prior context.
    Always present the tool result fields (paid_leaves.monthly, paid_leaves.used, paid_leaves.remaining) verbatim.
    """
    return crm_adapter.get_leave_balance(employee_id=employee_id, name=name)


@tool
def update_leave_balance(
    name: str = None,
    employee_id: str = None,
    used_paid: int = None,
    monthly_paid: int = None,
    annual_paid: int = None,
    unpaid_taken: int = None
) -> dict:
    """
    Updates the leave balance for an employee. Provide 'name' (e.g. 'Sakshi') or 'employee_id'.
    Leave allocations are strictly MONTHLY (e.g. 3 days per month).
    'used_paid': Number of paid leaves used this month.
    'monthly_paid': Allocated monthly paid leaves (e.g. 3).
    Only pass the fields that need to be updated.
    """
    return crm_adapter.update_leave_balance(
        name=name,
        employee_id=employee_id,
        used_paid=used_paid,
        monthly_paid=monthly_paid,
        annual_paid=annual_paid,
        unpaid_taken=unpaid_taken
    )

@tool
def apply_for_leave(employee_id: str, start_date: str, end_date: str, reason: str) -> dict:
    """
    Submit a leave application for an employee.
    Use the user's own employee ID when they say 'my leave' or apply for themselves.
    Format dates as YYYY-MM-DD.
    """
    return crm_adapter.apply_for_leave(
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        reason=reason
    )

@tool
def get_pending_leave_requests(manager_id: str = None) -> dict:
    """
    Fetch all pending leave requests that require approval.
    """
    return crm_adapter.get_pending_leave_requests(manager_id=manager_id)

@tool
def approve_leave_request(request_id: str, manager_id: str) -> dict:
    """
    Approve a pending leave request.
    """
    return crm_adapter.update_leave_request_status(
        request_id=request_id,
        status="Approved",
        manager_id=manager_id
    )

@tool
def reject_leave_request(request_id: str, manager_id: str) -> dict:
    """
    Reject a pending leave request.
    """
    return crm_adapter.update_leave_request_status(
        request_id=request_id,
        status="Rejected",
        manager_id=manager_id
    )

@tool
def generate_leave_image(manager_id: str = None) -> dict:
    """
    Generate an analytical tabular image summarizing employee leave balances.
    """
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import os
        import uuid
        from datetime import datetime
        from data.db_client import employees_collection, leave_balances_collection
        
        query = {}
        if manager_id:
            from bson import ObjectId
            query["$or"] = [
                {"reportingManagerId": ObjectId(manager_id) if len(manager_id)==24 else manager_id},
                {"_id": ObjectId(manager_id) if len(manager_id)==24 else manager_id}
            ]
        
        emps = list(employees_collection.find(query))
        
        data = []
        for emp in emps:
            emp_id = str(emp['_id'])
            name = emp.get('fullName', 'Unknown')
            dept = emp.get('department', 'Unknown')
            
            # Get leave balance
            lb = leave_balances_collection.find_one({"employeeId": emp_id})
            if lb:
                allocated = lb.get("allocated", 0)
                used = lb.get("used", 0)
                remaining = allocated - used
            else:
                allocated = 0
                used = 0
                remaining = 0
            
            data.append([
                name,
                dept,
                f"{allocated}",
                f"{used}",
                f"{remaining}"
            ])
            
        # Sort by remaining descending
        data.sort(key=lambda x: int(x[4]), reverse=True)
            
        fig, ax = plt.subplots(figsize=(12, len(data) * 0.4 + 2), facecolor='#ffffff')
        ax.axis('tight')
        ax.axis('off')
        
        # Add title
        fig.suptitle('MEDIA OCTUS — Employee Leave Directory', 
                     fontsize=18, fontweight='bold', color='#1e293b', y=0.98)
        fig.text(0.5, 0.94, f"Generated on {datetime.now().strftime('%d %b %Y, %I:%M %p')}  |  Total Employees: {len(data)}",
                ha='center', fontsize=11, color='#64748b')

        columns = ['Employee Name', 'Department', 'Monthly Allocated', 'Used Leaves', 'Remaining Leaves']
        table = ax.table(cellText=data, colLabels=columns, loc='center', cellLoc='center')
        
        table.auto_set_font_size(False)
        table.set_fontsize(10)
        table.scale(1, 1.8)
        
        # Style table
        for (row, col), cell in table.get_celld().items():
            cell.set_edgecolor('#e2e8f0')
            if row == 0:
                cell.set_facecolor('#f8fafc')
                cell.set_text_props(weight='bold', color='#0f172a', fontsize=11)
            else:
                cell.set_facecolor('#ffffff')
                cell.set_text_props(color='#334155')
                # Highlight remaining if 0
                if col == 4 and int(cell.get_text().get_text()) <= 0:
                    cell.set_text_props(color='#ef4444', weight='bold')
                
        # Save to static/charts/ directory
        charts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "charts")
        os.makedirs(charts_dir, exist_ok=True)
        
        filename = f"leave_report_{uuid.uuid4().hex[:8]}.png"
        filepath = os.path.join(charts_dir, filename)
        fig.savefig(filepath, dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
        plt.close(fig)

        return {
            "status": "success",
            "message": f"Leave analytical image generated successfully for {len(data)} employees.",
            "image_url": f"/charts/{filename}",
            "total_employees": len(data)
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "message": f"Failed to generate leave analytical image: {str(e)}"
        }