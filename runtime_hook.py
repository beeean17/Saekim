import os
import sys

# Set Playwright browsers path to the internal MEIPASS directory
if getattr(sys, 'frozen', False):
    os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.join(sys._MEIPASS, 'ms-playwright')
