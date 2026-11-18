from data.db_client import employees_collection
for e in employees_collection.find({'fullName': {'$in': ['Tarun Singh', 'Aditi Rao', 'Vikram Iyer', 'Imran Shaikh', 'Sana Qureshi']}}):
    print(f"{e.get('fullName')}: designation='{e.get('designation')}', role='{e.get('role')}', dept='{e.get('department')}'")
