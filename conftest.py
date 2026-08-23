"""Rehearsal is the default, including when the developer's .env is armed.

`backend/settings.py` loads `.env` at import and only fills variables that are
not already set, so a demo machine configured for a real CALL-E call would
otherwise carry `FAKE_CALLS=0` and `LIVE_CALLS=...` straight into the suite.
That turns "no test touches the network" into a property of one machine's dotenv
rather than of the tests. Setting the safe values here, before any backend module
is imported, makes it a property of the suite.

An explicit `-m live` run is left alone: that is the deliberate opt-in the
marker exists for.
"""

import os
import sys

REHEARSAL_ENV = {
    "FAKE_CALLS": "1",
    "LIVE_CALLS": "",
    "MAX_LIVE_CALLS": "0",
    # With a real key present the launch tests reach Devin's API for a session
    # instead of getting the stub they assert on.
    "DEVIN_API_KEY": "",
}


def _live_run_requested() -> bool:
    """True when the session explicitly selects the `live` marker."""
    argv = sys.argv
    for index, arg in enumerate(argv):
        if arg == "-m" and index + 1 < len(argv):
            if "live" in argv[index + 1] and "not live" not in argv[index + 1]:
                return True
        elif arg.startswith("-m") and len(arg) > 2:
            expression = arg[2:]
            if "live" in expression and "not live" not in expression:
                return True
    return False


if not _live_run_requested():
    for name, value in REHEARSAL_ENV.items():
        os.environ[name] = value
