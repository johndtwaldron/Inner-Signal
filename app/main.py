from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .config import media_root
from .library import scan_library

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="Inner Signal", version="0.1.0")
_library_cache: dict[str, list[dict]] = {}


def current_items(refresh: bool = False) -> list[dict]:
    root = media_root()
    key = str(root)
    if refresh or key not in _library_cache:
        _library_cache[key] = scan_library(root)
    return _library_cache[key]


def resolve_item(item_id: str) -> tuple[dict, Path]:
    root = media_root()
    item = next((entry for entry in current_items() if entry["id"] == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Media item not found")
    path = root / item["relative_path"]
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Media item not found")
    return item, path


@app.get("/api/health")
def health() -> dict:
    root = media_root()
    return {"status": "ok", "media_root": str(root), "available": root.is_dir()}


@app.get("/api/library")
def library() -> dict:
    items = current_items()
    return {
        "items": items,
        "counts": {
            "audio": sum(item["kind"] == "audio" for item in items),
            "video": sum(item["kind"] == "video" for item in items),
            "image": sum(item["kind"] == "image" for item in items),
        },
    }


@app.get("/api/media/{item_id}")
def media(item_id: str) -> FileResponse:
    item, path = resolve_item(item_id)
    return FileResponse(path, media_type=item["mime_type"], filename=None)


@app.post("/api/reindex")
def reindex() -> dict:
    items = current_items(refresh=True)
    covered_collections = {
        item["collection"] for item in items if item.get("cover_id")
    }
    return {
        "indexed": len(items),
        "aliases": sum(item["is_alias"] for item in items),
        "covers": len(covered_collections),
    }


class RecommendationRequest(BaseModel):
    mood: str = ""
    mode: str = "nap"


@app.post("/api/recommendations")
def recommendations(request: RecommendationRequest) -> dict:
    targets = {"nap": 30 * 60, "session": 60 * 60, "overnight": 8 * 60 * 60}
    target = targets.get(request.mode, targets["nap"])
    mood = request.mood.lower()
    desired = set()
    for tag, words in {
        "sleep": ("sleep", "tired", "nap", "night"),
        "calm": ("anxious", "stress", "worried", "overthinking", "calm"),
        "confidence": ("confidence", "interview", "doubt", "esteem"),
        "healing": ("hurt", "sad", "abandon", "rejected", "healing"),
        "love": ("lonely", "love", "connected"),
    }.items():
        if any(word in mood for word in words):
            desired.add(tag)
    if request.mode in {"nap", "overnight"}:
        desired.update({"sleep", "calm"})

    candidates = [item for item in current_items() if item["kind"] in {"audio", "video"}]
    candidates.sort(
        key=lambda item: (
            -len(desired.intersection(item["tags"])),
            (
                "long" not in item["tags"]
                if request.mode == "overnight"
                else "short" not in item["tags"]
            ),
            item["title"],
        )
    )
    queue, total, index = [], 0.0, 0
    usable = [item for item in candidates if item["duration_seconds"]]
    while usable and total < target and index < len(usable) * 8:
        item = usable[index % len(usable)]
        queue.append(item["id"])
        total += item["duration_seconds"]
        index += 1
    return {
        "track_ids": queue,
        "duration_seconds": round(total),
        "matched_tags": sorted(desired),
        "explanation": f"Built locally from automatic tags for a {request.mode} session.",
    }


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
