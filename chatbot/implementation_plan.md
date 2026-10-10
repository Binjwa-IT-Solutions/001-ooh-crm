# Image Generation Data Scoping & Role Restricting

We need to restrict all image generation tools exclusively to Admin and Manager roles, and critically, enforce data scoping so that Managers only see data for their direct reports/assignments in the generated visuals.

## User Review Required
> [!IMPORTANT]
> The current image generation tools fetch all company records without filtering. I will update all four image tools to accept a manager_id parameter to scope the data appropriately for managers. Do you want Managers to see ALL company leads in the lead chart, or ONLY leads assigned to them/their team? I will default to scoping it to their team.

## Proposed Changes

### ssistant/permissions.py
- Modify TOOL_PERMISSIONS for generate_analytical_image, generate_salary_image, generate_leave_image, and generate_lead_source_image to explicitly require ['admin', 'manager'] specific permissions (e.g. creating a new permission or just checking roles directly).

### ssistant/assistant.py
- Update the tool execution interceptor (execute_tool) to automatically inject manager_id=session.user_id into all image generation tool calls if the user is a Manager.

### 	ools/system_tools.py
- **[MODIFY]** generate_analytical_image: Update the MongoDB query to filter employees where 
eportingManagerId == manager_id if manager_id is provided.

### 	ools/salary_tools.py
- **[MODIFY]** generate_salary_image: Update the MongoDB query to filter employees where 
eportingManagerId == manager_id if manager_id is provided.

### 	ools/leave_tools.py
- **[MODIFY]** generate_leave_image: Update the MongoDB query to filter employees where 
eportingManagerId == manager_id if manager_id is provided.

### 	ools/lead_tools.py
- **[MODIFY]** generate_lead_source_image: Update the MongoDB query to filter leads where ssignedTo is the manager or one of their direct reports.

## Verification Plan
1. Call the chart generator as an Admin -> verify company-wide data is shown.
2. Call the chart generator as a Manager -> verify only subordinate data is shown.
3. Call the chart generator as HR -> verify it returns a clean Permission Denied error instead of rate limit.
