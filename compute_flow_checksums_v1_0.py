import hashlib
import sys
from pathlib import Path

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
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
