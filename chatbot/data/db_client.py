from pymongo import MongoClient
import os
from config.settings import MONGO_URI

# Initialize MongoClient
client = MongoClient(MONGO_URI)

# Select the database
db = client["media-octus-crm"]

# Collections
users_collection = db["users"]
employees_collection = db["employees"]
leave_balances_collection = db["leavebalances"]
leave_requests_collection = db["leaverequests"]
attendance_collection = db["attendances"]
tasks_collection = db["tasks"]
escalations_collection = db["escalations"]
audit_logs_collection = db["auditlogs"]
leads_collection = db["leads"]
quotations_collection = db["quotations"]
sites_collection = db["sites"]

def get_db():
    return db

