from fastapi.testclient import TestClient

from app.main import app


def test_health_and_library(monkeypatch, tmp_path):
    (tmp_path / "session.mp3").write_bytes(b"audio")
    monkeypatch.setenv("INNER_SIGNAL_MEDIA_ROOT", str(tmp_path))
    client = TestClient(app)
    assert client.get("/api/health").json()["available"] is True
    response = client.get("/api/library")
    assert response.status_code == 200
    assert response.json()["counts"]["audio"] == 1


def test_media_endpoint_does_not_expose_paths(monkeypatch, tmp_path):
    (tmp_path / "session.mp3").write_bytes(b"audio")
    monkeypatch.setenv("INNER_SIGNAL_MEDIA_ROOT", str(tmp_path))
    client = TestClient(app)
    item_id = client.get("/api/library").json()["items"][0]["id"]
    assert client.get(f"/api/media/{item_id}").content == b"audio"
    assert client.get("/api/media/not-real").status_code == 404


def test_recommendations_build_a_local_queue(monkeypatch, tmp_path):
    (tmp_path / "Calm Sleep.mp3").write_bytes(b"audio")
    monkeypatch.setenv("INNER_SIGNAL_MEDIA_ROOT", str(tmp_path))
    client = TestClient(app)
    response = client.post(
        "/api/recommendations", json={"mood": "anxious and tired", "mode": "nap"}
    )
    assert response.status_code == 200
    assert response.json()["matched_tags"] == ["calm", "sleep"]


def test_reindex_reports_assigned_collection_covers(monkeypatch, tmp_path):
    album = tmp_path / "Sleep Album"
    album.mkdir()
    (album / "session.mp3").write_bytes(b"audio")
    (album / "cover.png").write_bytes(b"image")
    monkeypatch.setenv("INNER_SIGNAL_MEDIA_ROOT", str(tmp_path))

    response = TestClient(app).post("/api/reindex")

    assert response.status_code == 200
    assert response.json()["covers"] == 1
