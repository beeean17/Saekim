import os
import sys
from pathlib import Path

# Prefer user cache for Playwright browsers; fall back to bundled copy if present
if getattr(sys, 'frozen', False):
    user_cache = Path.home() / '.cache' / 'ms-playwright'
    bundled = Path(getattr(sys, '_MEIPASS', '')) / 'ms-playwright'

    if 'PLAYWRIGHT_BROWSERS_PATH' not in os.environ:
        if user_cache.exists():
            os.environ['PLAYWRIGHT_BROWSERS_PATH'] = str(user_cache)
        elif bundled.exists():
            os.environ['PLAYWRIGHT_BROWSERS_PATH'] = str(bundled)
    # else: respect explicitly provided env var
else:
    os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', str(Path.home() / '.cache' / 'ms-playwright'))
