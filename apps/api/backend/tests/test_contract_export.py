"""Generated contracts are reproducible outputs of the Pydantic source."""

from __future__ import annotations

import subprocess
from pathlib import Path

from packages.contracts.export import artifact_contents, stale_artifacts


API_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = API_ROOT.parents[1]


def test_generated_contracts_match_pydantic_and_target_the_erp_workspace():
    artifacts = artifact_contents()
    assert set(artifacts) == {
        API_ROOT / "packages/contracts/schema.json",
        API_ROOT / "packages/contracts/claim.schema.json",
        REPO_ROOT / "apps/erp/lib/contracts.ts",
    }
    typescript = artifacts[REPO_ROOT / "apps/erp/lib/contracts.ts"]
    assert "export interface PublicCaseSnapshot" in typescript
    assert "export interface OpenCaseResponse" in typescript
    assert "export interface InventoryRow" in typescript
    assert "export interface OpenedCase" in typescript
    assert "transcript?: TranscriptTurn[]" in typescript
    assert "summary?: string" in typescript
    assert typescript.endswith("\n") and not typescript.endswith("\n\n")
    assert stale_artifacts(artifacts) == []


def test_contract_check_command_does_not_rewrite_artifacts():
    before = artifact_contents()
    result = subprocess.run(
        [str(API_ROOT / ".venv/bin/python"), "-m", "packages.contracts.export", "--check"],
        cwd=API_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert artifact_contents() == before
