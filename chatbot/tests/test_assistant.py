import sys
import os

# Ensure stdout handles UTF-8 for Windows console (Rupee symbol, etc.)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure the root directory is in the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from assistant.assistant import ask_employee_assistant
from assistant.session import Session

def test_assistant():
    print("--- Running Test Suite ---")
    
    # 1. Successful Query (Admin querying active employee in MongoDB)
    admin_session = Session(user_id="6abb572c00ffae9c4c208bda", name="Aditi Rao", role="admin")
    resp = ask_employee_assistant(admin_session, "What is Sana Qureshi's phone number?")
    print(f"\nTest 1 (Admin Query) Response:\n{resp}\n")
    assert "9800000002" in resp or "phone" in resp.lower() or "sana" in resp.lower(), "Failed to get Sana's phone number."
    
    # 2. RBAC Protection (Sales Agent attempting unauthorized write)
    agent_session = Session(user_id="6abb572c00ffae9c4c208bdc", name="Sana Qureshi", role="sales_agent")
    resp = ask_employee_assistant(agent_session, "Update Rohit Menon's salary to 2000000")
    print(f"\nTest 2 (Agent RBAC Protection) Response:\n{resp}\n")
    assert "permission" in resp.lower() or "not have permission" in resp.lower() or "cannot" in resp.lower() or "denied" in resp.lower() or "restricted" in resp.lower(), "Agent was not blocked from updating salary."
    
    # 3. Multi-turn Pronoun Resolution
    admin_session.messages.clear()
    admin_session.current_employee = None
    
    resp1 = ask_employee_assistant(admin_session, "Who is Rohit Menon?")
    print(f"\nTest 3a (Pronoun context setup) Response:\n{resp1}\n")
    
    resp2 = ask_employee_assistant(admin_session, "What is his email?")
    print(f"\nTest 3b (Pronoun resolution) Response:\n{resp2}\n")
    assert "manager@mediaoctus.test" in resp2.lower() or "rohit" in resp2.lower() or "email" in resp2.lower(), "Failed to resolve pronoun 'his' to Rohit Menon."
    
    print("--- All Tests Passed Successfully ---")

if __name__ == "__main__":
    test_assistant()
