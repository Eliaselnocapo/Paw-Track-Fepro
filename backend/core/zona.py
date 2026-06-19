import os

def compute_zona_key(lat: float, lng: float, precision: int = None) -> str:
    p = precision or int(os.environ.get('ZONA_PRECISION', 2))
    return f"{round(lat, p)}_{round(lng, p)}"
