# data/dummy_data.py

# ============================================================
# EMPLOYEE / PEOPLE DIRECTORY
# ============================================================

EMPLOYEES = [

    # --------------------------------------------------------
    # ADMINS
    # --------------------------------------------------------

    {
        "id": 1,
        "name": "Admin User",
        "role": "admin",
        "department": "Management",
        "manager_id": None,
        "email": "admin@mediaoctus.com",
        "phone": "9000000001"
    },

    # --------------------------------------------------------
    # MANAGERS
    # --------------------------------------------------------

    {
        "id": 201,
        "name": "Suresh Kumar",
        "role": "manager",
        "department": "Sales",
        "manager_id": 1,
        "email": "suresh@mediaoctus.com",
        "phone": "9000000201"
    },

    {
        "id": 202,
        "name": "Neha Sharma",
        "role": "manager",
        "department": "Engineering",
        "manager_id": 1,
        "email": "neha@mediaoctus.com",
        "phone": "9000000202"
    },

    # --------------------------------------------------------
    # AGENTS
    # --------------------------------------------------------

    {
        "id": 101,
        "name": "Rahul Sharma",
        "role": "agent",
        "department": "Engineering",
        "manager_id": 202,
        "email": "rahul@example.com",
        "phone": "9876543210"
    },

    {
        "id": 102,
        "name": "Priya Singh",
        "role": "agent",
        "department": "Engineering",
        "manager_id": 202,
        "email": "priya@example.com",
        "phone": "9876543211"
    },

    {
        "id": 103,
        "name": "Aman Verma",
        "role": "agent",
        "department": "Sales",
        "manager_id": 201,
        "email": "aman@example.com",
        "phone": "9876543212"
    },

    # --------------------------------------------------------
    # TWO VIKASH PATEL RECORDS
    #
    # Vikash 105 -> Neha's team
    # Vikash 106 -> Suresh's team
    # --------------------------------------------------------

    {
        "id": 105,
        "name": "Vikash Patel",
        "role": "agent",
        "department": "Engineering",
        "manager_id": 202,
        "email": "vikash@example.com",
        "phone": "9876543214"
    },

    {
        "id": 106,
        "name": "Vikash Patel",
        "role": "agent",
        "department": "Sales",
        "manager_id": 201,
        "email": "vikash1025@example.com",
        "phone": "9876543684"
    },

    {
        "id": 107,
        "name": "Mohit",
        "role": "agent",
        "department": "Sales",
        "manager_id": 201,
        "email": "mohit@example.com",
        "phone": "9876543212"
    },

]


# ============================================================
# LEAVE DATA
# ============================================================

LEAVE_BALANCES = {

    1: {
        "annual": 30,
        "used": 5,
        "remaining": 25
    },

    201: {
        "annual": 30,
        "used": 6,
        "remaining": 24
    },

    202: {
        "annual": 30,
        "used": 4,
        "remaining": 26
    },

    101: {
        "annual": 20,
        "used": 5,
        "remaining": 15
    },

    102: {
        "annual": 20,
        "used": 3,
        "remaining": 17
    },

    103: {
        "annual": 20,
        "used": 7,
        "remaining": 13
    },

    105: {
        "annual": 20,
        "used": 2,
        "remaining": 18
    },

    106: {
        "annual": 20,
        "used": 6,
        "remaining": 14
    }
    ,

    107: {
        "annual": 20,
        "used": 6,
        "remaining": 14
    }
}


# ============================================================
# ATTENDANCE DATA
# ============================================================

ATTENDANCE = {

    1: {
        "status": "Present"
    },

    201: {
        "status": "Present"
    },

    202: {
        "status": "Present"
    },

    101: {
        "status": "Present"
    },

    102: {
        "status": "Present"
    },

    103: {
        "status": "Absent"
    },

    105: {
        "status": "Present"
    },

    106: {
        "status": "Present"
    },

    107: {
        "status": "Absent"
    }
}


# ============================================================
# PERSISTENCE LAYER
# ============================================================

import json
import os

DB_FILE = os.path.join(os.path.dirname(__file__), "db.json")

def load_db():
    global EMPLOYEES, LEAVE_BALANCES, ATTENDANCE
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r") as f:
                data = json.load(f)
                
                if "EMPLOYEES" in data:
                    EMPLOYEES.clear()
                    EMPLOYEES.extend(data["EMPLOYEES"])
                    
                if "LEAVE_BALANCES" in data:
                    # Convert string keys back to int
                    LEAVE_BALANCES.clear()
                    for k, v in data["LEAVE_BALANCES"].items():
                        LEAVE_BALANCES[int(k)] = v
                        
                if "ATTENDANCE" in data:
                    # Convert string keys back to int
                    ATTENDANCE.clear()
                    for k, v in data["ATTENDANCE"].items():
                        ATTENDANCE[int(k)] = v
        except Exception as e:
            print(f"Error loading database: {e}")

def save_db():
    try:
        data = {
            "EMPLOYEES": EMPLOYEES,
            "LEAVE_BALANCES": LEAVE_BALANCES,
            "ATTENDANCE": ATTENDANCE
        }
        with open(DB_FILE, "w") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"Error saving database: {e}")

# Automatically load the database on startup
load_db()