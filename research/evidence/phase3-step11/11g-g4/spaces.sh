#!/bin/sh
# Counts of macOS Spaces by type (0 desktop, 4 full screen) from com.apple.spaces, read only; nothing else kept.
defaults export com.apple.spaces - 2>/dev/null | plutil -convert json -o - - 2>/dev/null | python3 -I -c "
import json, sys
from collections import Counter
d = json.load(sys.stdin)
out = []
def walk(o):
    if isinstance(o, dict):
        if 'ManagedSpaceID' in o and 'type' in o: out.append(o['type'])
        for v in o.values(): walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
walk(d.get('SpacesDisplayConfiguration', {}).get('Management Data', {}))
print(json.dumps(dict(sorted(Counter(out).items()))))
"
