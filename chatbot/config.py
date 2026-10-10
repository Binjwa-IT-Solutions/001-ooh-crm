# config.py

import os

from dotenv import load_dotenv


load_dotenv()


GROQ_API_KEY = os.getenv(
    "GROQ_API_KEY"
)

GROQ_MODEL = (
    "llama-3.3-70b-versatile"
)

OLLAMA_MODEL = (
    "llama3.1"
)