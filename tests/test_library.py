from pathlib import Path

from app.library import infer_root_collection, infer_tags, scan_library, stable_id


def test_scan_library_filters_and_indexes_supported_media(tmp_path: Path):
    (tmp_path / "Calm Practice.mp3").write_bytes(b"not-real-audio")
    (tmp_path / "Root Recording.MP4").write_bytes(b"not-real-video")
    (tmp_path / "vision.jpg").write_bytes(b"not-real-image")
    (tmp_path / "notes.pdf").write_bytes(b"ignored")
    items = scan_library(tmp_path)
    assert [item["kind"] for item in items] == ["audio", "video", "image"]
    assert items[0]["title"] == "Calm Practice"
    assert items[0]["duration_seconds"] is None
    assert items[1]["collection"] == "Personal Recordings"
    assert items[0]["cover_id"] == items[2]["id"]


def test_stable_id_is_repeatable():
    assert stable_id("folder/file.mp3") == stable_id("folder/file.mp3")
    assert len(stable_id("folder/file.mp3")) == 16


def test_tag_matching_does_not_treat_knight_as_night():
    assert "sleep" not in infer_tags("General practice", "STASYA KNIGHT RELAXATION", 600)


def test_root_files_are_grouped_from_filename(tmp_path: Path):
    assert (
        infer_root_collection(tmp_path / "Confidence Hypnosis.mp4")
        == "Confidence & Self-Worth"
    )
    assert infer_root_collection(tmp_path / "canVD.mod1.1.file.mp3") == "Confidence & Self-Worth"
    assert infer_root_collection(tmp_path / "RPReplay_Final.mp4") == "Personal Recordings"
    assert infer_root_collection(tmp_path / "Being Still Meditation.mp3") == "Mindfulness & Calm"


def test_scan_follows_file_and_folder_shortcuts(tmp_path: Path):
    source = tmp_path / "source"
    source.mkdir()
    (source / "healing.mp3").write_bytes(b"audio")
    library = tmp_path / "library"
    library.mkdir()
    (library / "direct-shortcut.mp3").symlink_to(source / "healing.mp3")
    (library / "Shortcut Collection").symlink_to(source, target_is_directory=True)
    items = scan_library(library)
    assert len(items) == 2
    assert all(item["is_alias"] for item in items)
    assert {item["collection"] for item in items} == {
        "Healing & Integration",
        "Shortcut Collection",
    }


def test_subfolder_png_is_preferred_over_duplicate_avif_cover(tmp_path: Path):
    album = tmp_path / "STASYA.KNIGHT.RELAXATION."
    album.mkdir()
    (album / "Sleep Mermaid.mp3").write_bytes(b"audio")
    (album / "Sleep Mermaid.avif").write_bytes(b"avif")
    (album / "Sleep Mermaid.png").write_bytes(b"png")

    items = scan_library(tmp_path)
    audio = next(item for item in items if item["kind"] == "audio")
    png = next(item for item in items if item["filename"].endswith(".png"))

    assert {item["kind"] for item in items} == {"audio", "image"}
    assert audio["collection"] == "STASYA.KNIGHT.RELAXATION."
    assert audio["cover_id"] == png["id"]
