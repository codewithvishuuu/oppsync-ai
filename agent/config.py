import os
from pathlib import Path
from dotenv import load_dotenv

_project_root = Path(__file__).parent.parent
load_dotenv(_project_root / ".env")
load_dotenv(_project_root / ".env.local")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

NOTION_DATABASE_ID = "3dd69b6f-e76d-808e-9ec4-d72dc3e1d494"
NOTION_DATA_SOURCE_ID = "3dd69b6f-e76d-80ff-8d92-000b4498f5ec"

SWYTCHCODE_CWD = str(_project_root)

DEFAULT_SCAN_LIMIT = 10

VALID_OPPORTUNITY_TYPES = [
    "internship",
    "hackathon",
    "scholarship",
    "competition",
    "job",
    "workshop",
    "certification",
    "fellowship",
]
