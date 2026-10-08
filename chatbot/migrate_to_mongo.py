import random
from datetime import datetime, timedelta
from data.dummy_data import EMPLOYEES, LEAVE_BALANCES, ATTENDANCE
from data.db_client import db, employees_collection, leave_balances_collection, attendance_collection

def migrate():
    # Clear existing data
    employees_collection.delete_many({})
    leave_balances_collection.delete_many({})
    attendance_collection.delete_many({})
    print("Cleared existing collections.")

    # 1. Migrate Employees
    new_employees = []
    for emp in EMPLOYEES:
        # Generate some dummy enterprise data
        base_salary = random.choice([50000, 80000, 120000, 150000, 200000])
        per_day_rate = int(base_salary / 30)
        
        new_emp = {
            "id": emp["id"],
            "name": emp["name"],
            "role": emp["role"],
            "department": emp["department"],
            "manager_id": emp["manager_id"],
            "contact": {
                "email": emp.get("email", f"{emp['name'].split()[0].lower()}@example.com"),
                "phone": emp.get("phone", f"9{random.randint(100000000, 999999999)}")
            },
            "personal_details": {
                "date_of_birth": f"{random.randint(1980, 2000)}-0{random.randint(1,9)}-1{random.randint(0,9)}",
                "address": f"{random.randint(10, 999)} Tech Park, Bangalore",
                "emergency_contact": f"999888{random.randint(1000, 9999)}"
            },
            "salary": {
                "base_monthly": base_salary,
                "currency": "INR",
                "per_day_rate": per_day_rate
            }
        }
        new_employees.append(new_emp)
    
    if new_employees:
        employees_collection.insert_many(new_employees)
        print(f"Inserted {len(new_employees)} employees.")

    # 2. Migrate Leave Balances
    new_leaves = []
    for emp_id, balance in LEAVE_BALANCES.items():
        # Get the employee to calculate salary deduction
        emp = next((e for e in new_employees if e["id"] == emp_id), None)
        per_day_rate = emp["salary"]["per_day_rate"] if emp else 0
        
        unpaid_taken = random.randint(0, 3)
        deduction = unpaid_taken * per_day_rate
        
        new_leaves.append({
            "employee_id": emp_id,
            "paid_leaves": {
                "annual": balance.get("annual", 20),
                "used": balance.get("used", 0),
                "remaining": balance.get("remaining", 20)
            },
            "unpaid_leaves_taken": unpaid_taken,
            "current_salary_deduction": deduction
        })
        
    if new_leaves:
        leave_balances_collection.insert_many(new_leaves)
        print(f"Inserted {len(new_leaves)} leave balances.")

    # 3. Migrate Attendance (Create 30-day history)
    new_attendance = []
    today = datetime.now()
    
    for emp_id, att in ATTENDANCE.items():
        # Add today's status from dummy_data
        new_attendance.append({
            "employee_id": emp_id,
            "date": today.strftime("%Y-%m-%d"),
            "status": att.get("status", "Present")
        })
        
        # Add 29 days of past history
        for i in range(1, 30):
            past_date = today - timedelta(days=i)
            # Skip weekends (simplified: just random chance of being present)
            status = random.choices(["Present", "Absent", "Leave"], weights=[85, 5, 10])[0]
            new_attendance.append({
                "employee_id": emp_id,
                "date": past_date.strftime("%Y-%m-%d"),
                "status": status
            })
            
    if new_attendance:
        attendance_collection.insert_many(new_attendance)
        print(f"Inserted {len(new_attendance)} historical attendance records.")

    print("Migration complete!")

if __name__ == "__main__":
    migrate()
