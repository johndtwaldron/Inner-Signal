from __future__ import annotations

import hashlib
import mimetypes
import os
import re
from pathlib import Path

from mutagen import File as MutagenFile

AUDIO_EXTENSIONS = {".mp3", ".m4a", ".aac", ".wav", ".flac", ".ogg"}
VIDEO_EXTENSIONS = {".mp4", ".m4v", ".mov", ".webm"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".heic"}

# Prefer the broadly compatible duplicate when the same artwork is supplied in
# several formats. AVIF remains indexed and can still appear in slideshows.
COVER_FORMAT_PRIORITY = {
    ".png": 0,
    ".jpg": 1,
    ".jpeg": 1,
    ".webp": 2,
    ".avif": 3,
    ".heic": 4,
    ".gif": 5,
}


def stable_id(relative_path: str) -> str:
    return hashlib.sha256(relative_path.encode()).hexdigest()[:16]


def clean_title(path: Path) -> str:
    title = path.stem.replace("-", " ").replace("_", " ")
    return " ".join(title.split())


def duration_seconds(path: Path) -> float | None:
    try:
        media = MutagenFile(path)
        return round(float(media.info.length), 1) if media and media.info else None
    except Exception:
        return None


TAG_RULES = {
    "sleep": ("sleep", "dream", "night", "rest"),
    "calm": ("calm", "anxiety", "worry", "safe", "reiki", "sound bath"),
    "confidence": ("confidence", "self esteem", "worthy", "enough", "strong", "smart"),
    "healing": ("heal", "core wound", "abandon", "unloved", "rejected", "connected"),
    "affirmations": ("affirmation", "i am ", "subconscious", "self image"),
    "morning": ("morning", "activate", "success"),
    "love": ("love", "accepted", "matter", "seen", "heard"),
    "hypnosis": ("hypnosis",),
}


def infer_tags(title: str, collection: str, duration: float | None) -> list[str]:
    searchable = f"{title} {collection}".lower()
    tags = [
        tag
        for tag, words in TAG_RULES.items()
        if any(re.search(rf"\b{re.escape(word.strip())}\b", searchable) for word in words)
    ]
    if duration:
        if duration <= 900:
            tags.append("short")
        elif duration >= 3600:
            tags.append("long")
    return sorted(set(tags or ["general"]))


def infer_root_collection(path: Path) -> str:
    searchable = f"{clean_title(path)} {path.resolve()}".lower()
    rules = (
        (
            "Confidence & Self-Worth",
            ("confidence", "self esteem", "self image", "worthy", "canvd"),
        ),
        (
            "Mindfulness & Calm",
            ("meditation", "mindfulness", "anxiety", "acceptance", "being still"),
        ),
        (
            "Motivation & Reprogramming",
            ("motivational", "brainwashing", "reprogram", "best you"),
        ),
        (
            "Hypnosis & Sleep",
            ("hypnosis", "hypnotic", "sleep", "asmr", "healthy eating"),
        ),
        (
            "Healing & Integration",
            ("heal", "neuroscience", "gabriele", "aaron", "merge higher"),
        ),
        ("Personal Recordings", ("replay", "recording", "voice memo")),
    )
    for collection, words in rules:
        if any(word in searchable for word in words):
            return collection
    return "Other Meditations"


def display_folder_name(name: str) -> str:
    """Turn folder-style separators into a readable creator or album label."""
    return " ".join(name.replace(".", " ").replace("_", " ").split())


def hierarchy(relative: str, path: Path) -> tuple[str, str | None, str]:
    """Return album, optional creator, and the exact folder used for artwork."""
    parts = relative.split("/")
    folders = parts[:-1]
    if len(folders) >= 2:
        return display_folder_name(folders[-1]), display_folder_name(folders[0]), "/".join(folders)
    if folders:
        return folders[0], None, folders[0]
    return infer_root_collection(path), None, ""


def scan_library(root: Path) -> list[dict]:
    if not root.is_dir():
        return []

    items = []
    allowed = AUDIO_EXTENSIONS | VIDEO_EXTENSIONS | IMAGE_EXTENSIONS
    paths = []
    for directory, _, filenames in os.walk(root, followlinks=True):
        paths.extend(Path(directory) / filename for filename in filenames)
    for path in sorted(paths, key=lambda item: str(item).lower()):
        if path.suffix.lower() not in allowed or not path.exists():
            continue
        relative = path.relative_to(root).as_posix()
        suffix = path.suffix.lower()
        if suffix in IMAGE_EXTENSIONS:
            kind = "image"
        elif suffix in VIDEO_EXTENSIONS:
            kind = "video"
        else:
            kind = "audio"
        stat = path.stat()
        duration = duration_seconds(path) if kind != "image" else None
        collection, creator, artwork_group = hierarchy(relative, path)
        alias_parent = any(
            parent.is_symlink() for parent in path.parents if parent != root.parent
        )
        items.append(
            {
                "id": stable_id(relative),
                "title": clean_title(path),
                "filename": path.name,
                "relative_path": relative,
                "collection": collection,
                "creator": creator,
                "artwork_group": artwork_group,
                "kind": kind,
                "mime_type": mimetypes.guess_type(path.name)[0] or "application/octet-stream",
                "size_bytes": stat.st_size,
                "duration_seconds": duration,
                "modified_at": int(stat.st_mtime),
                "is_alias": path.is_symlink() or alias_parent,
                "tags": sorted(
                    set(
                        infer_tags(clean_title(path), collection, duration)
                        + ([creator] if creator else [])
                    )
                ),
            }
        )
    images_by_collection: dict[str, list[dict]] = {}
    for item in items:
        if item["kind"] == "image":
            images_by_collection.setdefault(item["artwork_group"], []).append(item)
    for collection_images in images_by_collection.values():
        collection_images.sort(
            key=lambda item: (
                not any(
                    word in item["title"].lower()
                    for word in ("cover", "artwork", "folder", "front")
                ),
                COVER_FORMAT_PRIORITY.get(Path(item["filename"]).suffix.lower(), 99),
                item["title"],
            )
        )
    for item in items:
        covers = images_by_collection.get(item["artwork_group"], [])
        item["cover_id"] = covers[0]["id"] if covers else None
    return items
