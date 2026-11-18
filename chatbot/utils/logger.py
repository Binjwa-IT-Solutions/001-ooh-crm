import os
import json
from datetime import datetime
from config.settings import LOG_FILE_PATH

def init_logger():
    # Ensure logs directory exists
    os.makedirs(os.path.dirname(LOG_FILE_PATH), exist_ok=True)

def log_interaction(user_id, role, question, tool_calls=None, blocked=False, response=None, provider=None):
    """
    Logs an interaction to the session logs JSON Lines file.
    """
    init_logger()
    
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "user_id": user_id,
        "role": role,
        "question": question,
        "tool_calls": tool_calls or [],
        "blocked": blocked,
        "response": response,
        "provider": provider
    }
    
    try:
        with open(LOG_FILE_PATH, "a") as f:
            f.write(json.dumps(log_entry) + "\n")
    except Exception as e:
        print(f"[Logger Error] Could not write to log: {e}")
