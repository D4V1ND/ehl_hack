import json
from decimal import Decimal

import pytest

from backend import persistence, settings
from packages.contracts.models import Currency, PriceBreak, Quote


@pytest.fixture(autouse=True)
def quotes_dir(tmp_path, monkeypatch):
    """Never write into the real data/ directory from a test."""
    monkeypatch.setattr(settings, "QUOTES_DIR", tmp_path / "quotes")
    return tmp_path / "quotes"


def _quote(**overrides) -> Quote:
    defaults = dict(
        task_id="T-001",
        case_id="CASE-001",
        supplier_ref="SUP-ATLAS",
        available=True,
        qty_offered=100,
        unit_price=Decimal("5"),
        price_breaks=[PriceBreak(min_qty=80, unit_price=Decimal("4"))],
        currency=Currency.EUR,
        lead_time_days=19,
        confidence=0.82,
        raw={"transcript_turns": [{"speaker": "bot", "text": "Guten Tag"}]},
    )
    defaults.update(overrides)
    return Quote(**defaults)


def test_a_saved_quote_can_be_read_back():
    path = persistence.save_quote(_quote())
    written = json.loads(path.read_text(encoding="utf-8"))
    assert written["unit_price"] == "5"
    assert written["lead_time_days"] == 19
    assert written["price_breaks"][0]["min_qty"] == 80


def test_the_transcript_survives_so_the_evidence_is_not_lost():
    path = persistence.save_quote(_quote())
    written = json.loads(path.read_text(encoding="utf-8"))
    assert written["raw"]["transcript_turns"][0]["text"] == "Guten Tag"


def test_one_file_per_task_under_its_case():
    path = persistence.save_quote(_quote())
    assert path.name == "T-001.json"
    assert path.parent.name == "CASE-001"


def test_rerunning_a_task_overwrites_rather_than_duplicating():
    persistence.save_quote(_quote(confidence=0.1))
    path = persistence.save_quote(_quote(confidence=0.9))
    assert json.loads(path.read_text(encoding="utf-8"))["confidence"] == 0.9
    assert len(list(path.parent.glob("*.json"))) == 1


def test_ids_cannot_escape_the_quotes_directory(quotes_dir):
    path = persistence.save_quote(_quote(case_id="../../etc", task_id="../passwd"))
    assert quotes_dir.resolve() in path.resolve().parents


def test_a_blank_id_still_lands_somewhere_readable():
    # normalize_result defaults an unidentifiable call to "UNKNOWN", but a
    # blank string must not produce a nameless file either.
    path = persistence.save_quote(_quote(case_id="", task_id=""))
    assert path.name == "UNKNOWN.json"
    assert path.parent.name == "UNKNOWN"
