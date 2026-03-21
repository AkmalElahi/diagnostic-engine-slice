import hashlib
import json
import sys
from pathlib import Path

def sha256_file(path: Path) -> str:
    # Load JSON file
    with path.open("r", encoding="utf-8") as f:         # Text mode
        flow_data = json.load(f)                        # Parse JSON
    
    # Re-serialize to match JSON.stringify()
    flow_json_string = json.dumps(
        flow_data,
        separators=(',', ':'),
        ensure_ascii=False
    )
    
    # Hash the compact JSON string
    h = hashlib.sha256()
    h.update(flow_json_string.encode('utf-8'))
    return h.hexdigest()

def main():
    if len(sys.argv) < 2:
        print("Usage: python compute_flow_checksums_v1_0.py <flow_json_file> [more_files...]")
        sys.exit(2)

    for fp in sys.argv[1:]:
        p = Path(fp)
        digest = sha256_file(p)
        out = p.with_suffix(p.suffix + ".sha256")
        out.write_text(digest + "\n", encoding="utf-8")
        print(f"{p.name} :: {digest}")

if __name__ == "__main__":
    main()
