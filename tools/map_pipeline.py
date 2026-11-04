"""Placeholder offline map pipeline: hand-traced 1989 layout -> data/map/*.json (local metres, Y up)."""
import json, sys

def main(out="data/map/example.json"):
    layout = {"crs": "local-metres", "source": "hand-traced reference (see docs/references.md)", "streets": [], "blocks": []}
    json.dump(layout, sys.stdout if out == "-" else open(out, "w"), ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main(*(sys.argv[1:2] or ["-"]))
