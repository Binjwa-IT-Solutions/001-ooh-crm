import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Database
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")

# Models
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek/deepseek-chat")

# Fallback Configuration
# Order in which models should be attempted
LLM_PROVIDER_FALLBACK_CHAIN = ["gemini", "groq", "ollama"]

# Timeouts (in seconds)
LLM_REQUEST_TIMEOUT = 10
LLM_MAX_RETRIES = 1

# Rate Limiter
RATE_LIMIT_MAX_REQUESTS = 20
RATE_LIMIT_WINDOW_SECONDS = 60

# Session
SESSION_TIMEOUT_MINUTES = 30

# Logging
LOG_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs", "session_logs.jsonl")
