from langchain_core.tools import tool
import adapters.crm_adapter as crm_adapter

@tool
def get_salary_details(name: str = None, employee_id: str = None) -> dict:
    """
    Get the salary and deduction details for an employee.
    You must provide EITHER their 'name' OR their 'employee_id'.
    IMPORTANT: The primary salary field in the database is 'annual_ctc' (Annual CTC / Cost to Company).
    The 'base_monthly' and 'per_day_rate' fields are derived values calculated from annual_ctc.
    When presenting salary to the user, ALWAYS lead with Annual CTC. Do NOT label or describe 'annual_ctc' as a monthly figure.
    """
    return crm_adapter.get_salary_details(
        employee_id=employee_id,
        name=name
    )

@tool
def update_salary(name: str = None, employee_id: str = None, amount: float = None, salary_type: str = "annual") -> dict:
    """
    Update or increase an employee's salary/CTC.
    Admin and Finance roles are authorized to execute this tool.
    Provide either 'name' (e.g. 'tarun singh', 'Tarun') OR 'employee_id'.
    'amount': The new salary number (e.g. 650000).
    'salary_type': 'annual' (default) or 'monthly'.
    """
    return crm_adapter.update_salary(
        name=name,
        employee_id=employee_id,
        new_salary=amount,
        salary_type=salary_type
    )

@tool
def generate_salary_image(manager_id: str = None) -> dict:
    """
    Generate an analytical tabular image summarizing employee salaries and compensation data.
    This dynamically creates a styled data table image of all employees and their salaries.
    """
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import os
        import uuid
        from datetime import datetime
        from data.db_client import employees_collection
        
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
            name = emp.get('fullName', 'Unknown')
            dept = emp.get('department', 'Unknown')
            role = emp.get('role', 'Unknown').capitalize()
            annual = emp.get('annualCtc', 0)
            monthly = annual / 12 if annual else 0
            
            data.append([
                name,
                dept,
                role,
                f"INR {annual:,.2f}",
                f"INR {monthly:,.2f}"
            ])
            
        # Sort by Annual CTC descending
        data.sort(key=lambda x: float(x[3].replace('INR', '').replace(',', '').strip()), reverse=True)
            
        fig, ax = plt.subplots(figsize=(14, len(data) * 0.4 + 2), facecolor='#ffffff')
        ax.axis('tight')
        ax.axis('off')
        
        # Add title
        fig.suptitle('MEDIA OCTUS — Employee Salary Directory', 
                     fontsize=18, fontweight='bold', color='#1e293b', y=0.98)
        fig.text(0.5, 0.94, f"Generated on {datetime.now().strftime('%d %b %Y, %I:%M %p')}  |  Total Employees: {len(data)}",
                ha='center', fontsize=11, color='#64748b')

        columns = ['Employee Name', 'Department', 'Role', 'Annual CTC', 'Monthly Base']
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
                
        # Save to static/charts/ directory
        charts_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "charts")
        os.makedirs(charts_dir, exist_ok=True)
        
        filename = f"salary_report_{uuid.uuid4().hex[:8]}.png"
        filepath = os.path.join(charts_dir, filename)
        fig.savefig(filepath, dpi=150, bbox_inches='tight', facecolor=fig.get_facecolor())
        plt.close(fig)

        image_url = f"/charts/{filename}"
        
        return {
            "status": "success",
            "message": f"Salary analytical image generated successfully for {len(data)} employees.",
            "image_url": image_url,
            "total_employees": len(data)
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "message": f"Failed to generate salary analytical image: {str(e)}"
        }
