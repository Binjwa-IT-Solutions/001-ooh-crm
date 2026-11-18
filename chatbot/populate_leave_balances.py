from data.db_client import employees_collection, leave_balances_collection

def populate():
    employees = employees_collection.find()
    added = 0
    for emp in employees:
        emp_id_str = str(emp["_id"])
        
        # Check if leave balance already exists
        exists = leave_balances_collection.find_one({"employeeId": emp_id_str})
        
        if not exists:
            # Insert default leave balance of 0
            leave_balances_collection.insert_one({
                "employeeId": emp_id_str,
                "allocated": 0,
                "used": 0
            })
            added += 1
            print(f"Added default leave balance for {emp.get('fullName', emp_id_str)}")
            
    print(f"Finished. Added {added} leave balance records.")

if __name__ == "__main__":
    populate()
