# main.py
import sys
sys.stdout.reconfigure(encoding='utf-8')

from assistant.assistant import (
    ask_employee_assistant
)

from assistant.session import (
    Session
)

from data.db_client import employees_collection, users_collection

# ============================================================
# MAIN
# ============================================================

def main():

    print(
        "=" * 60
    )

    print(
        "        MEDIA OCTUS CRM AI ASSISTANT"
    )

    print(
        "=" * 60
    )

    print(
        "\nFetching active employees from database..."
    )
    
    # Dynamically fetch employees
    all_employees = list(employees_collection.find({}, sort=[("fullName", 1)]))
    
    USERS = {}
    for i, emp in enumerate(all_employees, start=1):
        user_doc = users_collection.find_one({"_id": emp.get("userId")}) if emp.get("userId") else None
        role = user_doc.get("role") if user_doc else None
        if not role or role.lower() == "unknown":
            desig = emp.get("designation", "").lower()
            dept = emp.get("department", "").lower()
            if "sale" in desig or "sale" in dept or "account executive" in desig:
                role = "sales agent"
            elif "op" in desig or "op" in dept or "supervisor" in desig:
                role = "ops"
            elif "hr" in desig or "hr" in dept:
                role = "hr"
            elif "finance" in desig or "finance" in dept or "account" in desig:
                role = "finance"
            elif "manage" in dept or "director" in desig:
                role = "manager"
            else:
                role = "employee"
        USERS[i] = {
            "id": str(emp["_id"]),
            "name": emp.get("fullName", "Unknown"),
            "role": role
        }

    print(
        "\nSelect user:"
    )

    for idx, user in USERS.items():
        print(f"{idx}. {user['name']} ({user['role'].capitalize()})")

    try:

        choice = int(
            input(
                "\nEnter choice: "
            )
        )

    except ValueError:

        print(
            "Invalid choice."
        )

        return

    user = USERS.get(
        choice
    )

    if user is None:

        print(
            "Invalid choice."
        )

        return

    # --------------------------------------------------------
    # Create session
    # --------------------------------------------------------

    session = Session(

        user_id=user["id"],

        name=user["name"],

        role=user["role"]
    )

    print(
        f"\nLogged in as: "
        f"{session.name}"
    )

    print(
        f"Role: {session.role}"
    )

    print(
        f"User ID: {session.user_id}"
    )

    print(
        "\nAssistant ready."
    )

    print(
        "Type 'exit' to quit."
    )

    # --------------------------------------------------------
    # Conversation loop
    # --------------------------------------------------------

    while True:

        try:

            question = input(
                "\nYou: "
            )

        except KeyboardInterrupt:

            print(
                "\nGoodbye."
            )

            break

        if not question.strip():

            continue

        if question.lower().strip() == "exit":

            print(
                "Goodbye."
            )

            break
            
        # ----------------------------------------------------
        # Rate Limiting & Session Timeout
        # ----------------------------------------------------
        
        import time
        from utils.rate_limiter import check_rate_limit
        from config.settings import SESSION_TIMEOUT_MINUTES
        
        # Check rate limit
        allowed, retry_after = check_rate_limit(session.user_id, getattr(session, 'role', None))
        if not allowed:
            print(f"\nAssistant: Rate limit exceeded. Please wait {int(retry_after)} seconds before asking another question.")
            continue
            
        # Check session timeout
        current_time = time.time()
        if hasattr(session, 'last_activity'):
            elapsed_minutes = (current_time - session.last_activity) / 60.0
            if elapsed_minutes > SESSION_TIMEOUT_MINUTES:
                print("\n[System: Session expired due to inactivity. Clearing context.]")
                session.messages = []
                session.current_employee = None
        
        session.last_activity = current_time

        try:

            answer = (
                ask_employee_assistant(
                    session,
                    question
                )
            )

            # Sanitize Unicode for Windows console (charmap codec)
            try:
                safe_answer = answer.encode(
                    'cp1252', errors='replace'
                ).decode('cp1252')
            except Exception:
                safe_answer = answer.encode(
                    'ascii', errors='replace'
                ).decode('ascii')

            print(
                f"\nAssistant: {safe_answer}"
            )

        except Exception as e:

            print(
                f"\nError: {e}"
            )


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    main()