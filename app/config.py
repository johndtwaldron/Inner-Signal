import os
from pathlib import Path

DEFAULT_MEDIA_ROOT = Path(
    "/Users/jdw/Library/CloudStorage/GoogleDrive-johndtwaldron@gmail.com/"
    "My Drive/hlp&meditation"
)


def media_root() -> Path:
    return Path(os.getenv("INNER_SIGNAL_MEDIA_ROOT", DEFAULT_MEDIA_ROOT)).expanduser().resolve()
