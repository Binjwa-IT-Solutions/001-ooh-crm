from collections import defaultdict
import time
from config.settings import RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_SECONDS

# Simple in-memory tracker: user_id -> list of timestamps
_request_history = defaultdict(list)

def check_rate_limit(user_id, role=None):
    """
    Checks if a user has exceeded their rate limit based on their role.
    Returns (is_allowed, retry_after_seconds)
    """
    if role == 'admin':
        return True, 0
        
    now = time.time()
    
    if role == 'manager':
        max_requests = 50
        window_seconds = 86400  # 1 day
    elif role == 'employee':
        max_requests = 20
        window_seconds = 86400  # 1 day
    else:
        max_requests = RATE_LIMIT_MAX_REQUESTS
        window_seconds = RATE_LIMIT_WINDOW_SECONDS
    
    # Clean up old timestamps outside the window
    _request_history[user_id] = [
        ts for ts in _request_history[user_id] 
        if now - ts <= window_seconds
    ]
    
    if len(_request_history[user_id]) >= max_requests:
        # Calculate when the oldest request in the window expires
        oldest_request = _request_history[user_id][0]
        retry_after = window_seconds - (now - oldest_request)
        return False, retry_after
        
    # Record the new request
    _request_history[user_id].append(now)
    return True, 0

_image_request_history = defaultdict(list)

def check_image_rate_limit(user_id, role=None):
    """
    Checks if an admin or manager has exceeded their image generation rate limit (5 per day).
    Returns (is_allowed, retry_after_seconds)
    """
    if role not in ['admin', 'manager']:
        return False, 0
        
    now = time.time()
    max_requests = 5
    window_seconds = 86400  # 1 day
    
    # Clean up old timestamps outside the window
    _image_request_history[user_id] = [
        ts for ts in _image_request_history[user_id] 
        if now - ts <= window_seconds
    ]
    
    if len(_image_request_history[user_id]) >= max_requests:
        oldest_request = _image_request_history[user_id][0]
        retry_after = window_seconds - (now - oldest_request)
        return False, retry_after
        
    _image_request_history[user_id].append(now)
    return True, 0
