import re
from pathlib import Path

ASSAM_DISTRICTS = [
    "Kokrajhar", "Dhubri", "South Salmara", "Goalpara", "Barpeta",
    "Morigaon", "Nagaon", "Hojai", "Sonitpur", "Biswanath",
    "Lakhimpur", "Dhemaji", "Tinsukia", "Dibrugarh", "Sivasagar",
    "Charaideo", "Jorhat", "Majuli", "Golaghat", "Karbi Anglong",
    "West Karbi Anglong", "Dima Hasao", "Cachar", "Karimganj",
    "Hailakandi", "Bongaigaon", "Chirang", "Kamrup",
    "Kamrup (M)", "Kamrup Metropolitan", "Nalbari", "Baksa",
    "Darrang", "Udalguri", "Tamulpur", "Bajali", "Sribhumi"
]

def norm_district(x: str) -> str:
    x = x.strip()
    aliases = {
        "Kamrup (M)": "Kamrup Metropolitan",
        "Kamrup(M)": "Kamrup Metropolitan",
        "Kamrup M": "Kamrup Metropolitan",
        "Kamrup Metropolitan": "Kamrup Metropolitan",
        "Bongaigao n": "Bongaigaon",
        "Bongaigao": "Bongaigaon",
        "Dima-Hasao": "Dima Hasao",
        "Karimganj": "Karimganj",
    }
    return aliases.get(x, x)

def report_type_from_name(path: Path) -> str:
    name = path.name.lower()
    if "landslide" in name:
        return "landslide"
    if "flood" in name:
        return "flood"
    return "unknown"

def extract_date(text: str):
    patterns = [
        r"Report as on\s+(\d{2}-\d{2}-\d{4})",
        r"Report as on\s+(\d{4}-\d{2}-\d{2})",
        r"as on\s+(\d{2}-\d{2}-\d{4})",
        r"as on\s+(\d{4}-\d{2}-\d{2})",
    ]
    for p in patterns:
        m = re.search(p, text, flags=re.I)
        if m:
            return m.group(1)
    return None

def to_number(s):
    try:
        return float(str(s).replace(",", "").strip())
    except Exception:
        return 0.0
