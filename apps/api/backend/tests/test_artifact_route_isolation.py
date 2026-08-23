"""Legacy Case artifacts are not reachable through the running FastAPI app."""

from __future__ import annotations

from fastapi.testclient import TestClient

from backend.api.main import create_app


def test_artifact_paths_are_absent_from_openapi_and_return_404() -> None:
    app = create_app()

    with TestClient(app) as client:
        paths = client.get("/openapi.json").json()["paths"]
        listing = client.get("/cases/CASE-001/artifacts")
        file_body = client.get("/cases/CASE-001/artifacts/sourcing_case.yaml")

    assert "/cases/{case_id}/artifacts" not in paths
    assert "/cases/{case_id}/artifacts/{name}" not in paths
    assert listing.status_code == 404
    assert file_body.status_code == 404
