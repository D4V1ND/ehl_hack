# Slice C — CALL-E Outreach & Negotiation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn an `OutreachTask` into a `Quote` — first with a deterministic fake that ships in hour 1 to unblock Slices B and D, then with real CALL-E phone calls behind the same interface.

**Architecture:** One `OutreachProvider` interface with two implementations (`FakeOutreachProvider`, `CalleOutreachProvider`). Both are **asynchronous**: `dispatch()` returns a receipt immediately, and quotes arrive later at `POST /calle/webhook`. The fake calls that same webhook after a random delay, so B and D build against the real async shape from hour 1 and nothing is rewritten when live calling lands. Swapping fake → real changes one environment variable.

**Tech Stack:** Python 3.13, Pydantic v2, FastAPI, httpx, pytest

**Spec:** `test/sourcing_agent_plan_v3.md` (Slice C in §6, contracts in §4, CALL-E details in §2.1)

## Global Constraints

Copied verbatim from `CLAUDE.md` and v3. Every task's requirements implicitly include this section.

- **Money uses `Decimal`, never `float`.** No float arithmetic anywhere near a price.
- **Phone numbers**: validate to E.164 on entry; mask (`+1******0199`) everywhere displayed, logged, or printed. The *only* place a raw number may appear is inside the literal outbound CALL-E request body.
- **No real phone numbers in the repo.** Demo/test numbers come from officially reserved fictional ranges (UK `+44 7700 900xxx`, US `+1 555 01xx`, DE `+49 30 23125xxx`).
- **AI disclosure is mandatory and unskippable.** Every call brief opens by stating it is an AI assistant and that the call is recorded (German §201 StGB + EU AI Act).
- **"unknown" is a first-class answer.** A garbled call result becomes a `Quote` with fields defaulted and `confidence=0.0`, never an exception.
- **Rehearsal is the default.** `FAKE_CALLS=1` is the default in every environment. Real calls require an explicit opt-in. No test may touch the network.
- **20 free CALL-E calls per account.** One account is reserved untouched for the live demo.
- **Contracts are frozen once merged.** Adding a *new* model to `packages/contracts/models.py` is fine; editing an existing one needs a group ping.

## File Structure

| File | Responsibility |
|---|---|
| `packages/contracts/__init__.py` | Package marker |
| `packages/contracts/models.py` | Shared Pydantic models. This plan adds `PriceBreak`, `ExpediteOption`, `OutreachBrief`, `OutreachTask`, `Quote`, `Currency`, `Channel`. Other slices append their own models to this same file. |
| `packages/contracts/schemas.py` | Exports `quote_result_schema()` — the JSON Schema handed to CALL-E as `recipient_result_schema` |
| `backend/outreach/protocol.py` | `OutreachProvider` interface + `DispatchReceipt` |
| `backend/outreach/fake.py` | `FakeOutreachProvider` — deterministic quote generation |
| `backend/outreach/scenarios.py` | Named demo scenarios that force interesting quote shapes |
| `backend/outreach/normalize.py` | CALL-E `structured_result` → `Quote`, never raises |
| `backend/outreach/brief.py` | Builds the CALL-E `task` text, disclosure first |
| `backend/outreach/calle.py` | `CalleOutreachProvider` — real `POST /v1/calls` |
| `backend/outreach/router.py` | Picks the channel per supplier |
| `backend/store.py` | In-memory quote store + append-only event log |
| `backend/main.py` | FastAPI app. Owns `POST /tools/outreach`, `GET /tools/quotes`, `POST /calle/webhook`. Other slices add their routers here. |
| `backend/settings.py` | Environment configuration |
| `test/test_contracts.py` … `test/test_router.py` | One test module per unit |

**Task 1–4 are the hour-1 unblock set.** After Task 4, Slices B and D have a working async outreach loop and never need to wait for you again.

---

### Task 1: Contracts — `OutreachTask`, `Quote`, `PriceBreak`

**Files:**
- Create: `packages/__init__.py`
- Create: `packages/contracts/__init__.py`
- Create: `packages/contracts/models.py`
- Create: `requirements.txt`
- Modify: `pytest.ini`
- Test: `test/test_contracts.py`

**Interfaces:**
- Consumes: nothing
- Produces: `Currency`, `Channel`, `PriceBreak`, `ExpediteOption`, `OutreachBrief`, `OutreachTask`, `Quote` — all importable from `packages.contracts.models`

- [x] **Step 1: Create the dependency file**

Create `requirements.txt`:

```
pydantic>=2.9
fastapi>=0.115
uvicorn[standard]>=0.32
httpx>=0.27
pytest>=8.0
```

Install:

```bash
python -m pip install -r requirements.txt
```

- [x] **Step 2: Make repo-root imports work**

Without this, every `from packages.contracts.models import ...` fails with
`ModuleNotFoundError` and you will lose twenty minutes to it.

Replace `pytest.ini` with:

```ini
[pytest]
pythonpath = .
markers =
    live: places a real phone call via CALL-E and spends a real credit. Skipped by default unless CALLE_API_KEY, TEST_CALL_DESTINATION_NUMBER, and CALLE_LIVE_TEST_CONFIRM are all set in .env.
```

- [x] **Step 3: Write the failing test**

Create `test/test_contracts.py`:

```python
from datetime import date
from decimal import Decimal

from packages.contracts.models import (
    Channel,
    Currency,
    OutreachBrief,
    OutreachTask,
    PriceBreak,
    Quote,
)


def _task() -> OutreachTask:
    return OutreachTask(
        task_id="T-001",
        case_id="CASE-001",
        supplier_ref="SUP-ATLAS",
        channel=Channel.VOICE,
        brief=OutreachBrief(
            part_spec="Deep groove ball bearing 6204-2RS (DIN 625)",
            qty=5000,
            needed_by=date(2026, 9, 3),
            target_price=Decimal("1.85"),
            floor_price=Decimal("2.40"),
        ),
    )


def test_outreach_task_defaults_the_must_ask_list():
    assert _task().brief.must_ask == [
        "price_breaks",
        "moq",
        "lead_time",
        "incoterm",
        "cert",
    ]


def test_a_garbled_call_still_produces_a_valid_quote():
    """A quote with nothing known must construct, not raise."""
    q = Quote(task_id="T-001", case_id="CASE-001", supplier_ref="SUP-ATLAS")
    assert q.available is False
    assert q.qty_offered == 0
    assert q.unit_price is None
    assert q.currency is Currency.UNKNOWN
    assert q.price_breaks == []
    assert q.confidence == 0.0


def test_money_fields_are_decimal_not_float():
    pb = PriceBreak(min_qty=1000, unit_price="2.15")
    assert isinstance(pb.unit_price, Decimal)
    assert pb.unit_price == Decimal("2.15")


def test_price_breaks_must_be_sorted_by_min_qty():
    q = Quote(
        task_id="T-001",
        case_id="CASE-001",
        supplier_ref="SUP-ATLAS",
        price_breaks=[
            PriceBreak(min_qty=5000, unit_price="1.90"),
            PriceBreak(min_qty=100, unit_price="2.40"),
        ],
    )
    assert [pb.min_qty for pb in q.price_breaks] == [100, 5000]
```

- [x] **Step 4: Run test to verify it fails**

```bash
python -m pytest test/test_contracts.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'packages'`

- [x] **Step 5: Write the implementation**

Create `packages/__init__.py` and `packages/contracts/__init__.py` (both empty).

Create `packages/contracts/models.py`:

```python
"""Shared data shapes. Frozen in hour 1 — see sourcing_agent_plan_v3.md §4.

Adding a NEW model to this file is fine. Editing an existing one needs a
group ping, because every slice builds against these.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class Currency(str, Enum):
    EUR = "EUR"
    USD = "USD"
    GBP = "GBP"
    UNKNOWN = "unknown"


class Channel(str, Enum):
    VOICE = "voice"
    EMAIL = "email"
    MARKETPLACE = "marketplace"


class PriceBreak(BaseModel):
    """Buy at least `min_qty` and each unit costs `unit_price`."""

    min_qty: int
    unit_price: Decimal


class ExpediteOption(BaseModel):
    """Pay `surcharge` total to pull delivery in by `days`."""

    days: int
    surcharge: Decimal


class OutreachBrief(BaseModel):
    part_spec: str
    qty: int
    needed_by: date
    target_price: Decimal | None = None
    floor_price: Decimal | None = None
    must_ask: list[str] = Field(
        default_factory=lambda: [
            "price_breaks",
            "moq",
            "lead_time",
            "incoterm",
            "cert",
        ]
    )


class OutreachTask(BaseModel):
    task_id: str
    case_id: str
    supplier_ref: str
    channel: Channel
    brief: OutreachBrief


class Quote(BaseModel):
    """What one supplier said. Every judgement field may be unknown.

    A garbled or missing call result becomes a Quote with these defaults
    and confidence 0.0 — never an exception.
    """

    task_id: str
    case_id: str
    supplier_ref: str

    available: bool = False
    qty_offered: int = 0
    unit_price: Decimal | None = None
    price_breaks: list[PriceBreak] = Field(default_factory=list)
    currency: Currency = Currency.UNKNOWN
    moq: int | None = None
    lead_time_days: int | None = None
    expedite_option: ExpediteOption | None = None
    incoterm: str | None = None
    certs_claimed: list[str] = Field(default_factory=list)
    payment_terms: str | None = None
    notes: str = ""

    transcript_url: str | None = None
    recording_url: str | None = None
    confidence: float = 0.0
    raw: dict = Field(default_factory=dict)

    @field_validator("price_breaks")
    @classmethod
    def _sorted_by_qty(cls, v: list[PriceBreak]) -> list[PriceBreak]:
        return sorted(v, key=lambda pb: pb.min_qty)
```

- [x] **Step 6: Run test to verify it passes**

```bash
python -m pytest test/test_contracts.py -v
```

Expected: 4 passed

- [x] **Step 7: Commit**

```bash
git add requirements.txt pytest.ini packages/ test/test_contracts.py
git commit -m "slice-c(contracts): add OutreachTask, Quote, PriceBreak"
```

---

### Task 2: The `Quote` JSON Schema for CALL-E

**Files:**
- Create: `packages/contracts/schemas.py`
- Test: `test/test_schemas.py`

**Interfaces:**
- Consumes: `Quote` from Task 1
- Produces: `quote_result_schema() -> dict` — pass directly as CALL-E's `recipient_result_schema`

- [ ] **Step 1: Write the failing test**

Create `test/test_schemas.py`:

```python
from packages.contracts.schemas import quote_result_schema


def test_schema_forbids_unexpected_fields():
    schema = quote_result_schema()
    assert schema["additionalProperties"] is False


def test_schema_describes_the_fields_the_call_must_collect():
    props = quote_result_schema()["properties"]
    for field in (
        "available",
        "qty_offered",
        "unit_price",
        "price_breaks",
        "currency",
        "moq",
        "lead_time_days",
        "incoterm",
        "certs_claimed",
    ):
        assert field in props, f"{field} missing from the answer sheet"


def test_schema_omits_fields_the_supplier_cannot_know():
    """task_id/case_id are ours, not theirs. Never ask the phone for them."""
    props = quote_result_schema()["properties"]
    for field in ("task_id", "case_id", "supplier_ref", "raw", "confidence"):
        assert field not in props
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest test/test_schemas.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'packages.contracts.schemas'`

- [ ] **Step 3: Write the implementation**

Create `packages/contracts/schemas.py`:

```python
"""JSON Schema export for CALL-E's `recipient_result_schema`.

One source of truth: the Quote model in models.py. We strip the fields
that belong to us rather than to the supplier, so the voice agent is only
ever asked for things a person on a phone could actually answer.
"""

from __future__ import annotations

from packages.contracts.models import Quote

# Fields we own. The supplier is never asked for these.
_OURS = {"task_id", "case_id", "supplier_ref", "raw", "confidence",
         "transcript_url", "recording_url", "notes"}


def quote_result_schema() -> dict:
    schema = Quote.model_json_schema()

    properties = {
        name: spec
        for name, spec in schema["properties"].items()
        if name not in _OURS
    }

    return {
        "type": "object",
        "properties": properties,
        "required": ["available", "qty_offered", "lead_time_days"],
        "additionalProperties": False,
        "$defs": schema.get("$defs", {}),
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest test/test_schemas.py -v
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/schemas.py test/test_schemas.py
git commit -m "slice-c(contracts): export Quote as CALL-E result schema"
```

---

### Task 3: The fake quote generator — deterministic and interesting

**Files:**
- Create: `backend/__init__.py`
- Create: `backend/outreach/__init__.py`
- Create: `backend/outreach/fake.py`
- Test: `test/test_fake_quotes.py`

**Interfaces:**
- Consumes: `OutreachTask`, `Quote`, `PriceBreak`, `Currency`, `ExpediteOption` from Task 1
- Produces: `make_fake_quote(task: OutreachTask) -> Quote` — pure, deterministic, seeded from `task.task_id`

**Why deterministic:** v3 requires `make demo` to run 50× on Saturday with the same result. Seeding from `task_id` means the same task always yields the same quote, so rehearsals are reproducible and the demo scenario can be tuned.

**Why "interesting":** v3 §5 says *"seed the data so the naive answer is wrong."* The generator must produce quotes where the cheapest unit price is **not** the cheapest landed cost, so Slice D's cost model has something real to chew on.

- [x] **Step 1: Write the failing test**

Create `test/test_fake_quotes.py`:

```python
from datetime import date
from decimal import Decimal

from backend.outreach.fake import make_fake_quote
from packages.contracts.models import Channel, OutreachBrief, OutreachTask


def _task(task_id: str = "T-001", supplier: str = "SUP-ATLAS") -> OutreachTask:
    return OutreachTask(
        task_id=task_id,
        case_id="CASE-001",
        supplier_ref=supplier,
        channel=Channel.VOICE,
        brief=OutreachBrief(
            part_spec="Deep groove ball bearing 6204-2RS (DIN 625)",
            qty=5000,
            needed_by=date(2026, 9, 3),
            target_price=Decimal("1.85"),
            floor_price=Decimal("2.40"),
        ),
    )


def test_same_task_id_always_gives_the_same_quote():
    assert make_fake_quote(_task()) == make_fake_quote(_task())


def test_different_task_ids_give_different_quotes():
    a = make_fake_quote(_task("T-001"))
    b = make_fake_quote(_task("T-002"))
    assert (a.unit_price, a.lead_time_days) != (b.unit_price, b.lead_time_days)


def test_an_available_quote_has_usable_numbers():
    q = make_fake_quote(_task("T-AVAILABLE"))
    if q.available:
        assert q.unit_price is not None and q.unit_price > 0
        assert q.qty_offered > 0
        assert q.lead_time_days is not None and q.lead_time_days > 0
        assert q.moq is not None


def test_price_breaks_get_cheaper_as_quantity_rises():
    q = make_fake_quote(_task("T-BREAKS"))
    if q.price_breaks:
        prices = [pb.unit_price for pb in q.price_breaks]
        assert prices == sorted(prices, reverse=True)


def test_all_money_is_decimal():
    q = make_fake_quote(_task())
    if q.unit_price is not None:
        assert isinstance(q.unit_price, Decimal)
    for pb in q.price_breaks:
        assert isinstance(pb.unit_price, Decimal)


def test_some_suppliers_are_unavailable():
    """The cost model must handle a 'no' — make sure fakes produce them."""
    results = [make_fake_quote(_task(f"T-{i:03d}")).available for i in range(40)]
    assert False in results, "no unavailable quote in 40 tries"
    assert True in results, "no available quote in 40 tries"


def test_confidence_is_between_zero_and_one():
    q = make_fake_quote(_task())
    assert 0.0 <= q.confidence <= 1.0
```

- [x] **Step 2: Run test to verify it fails**

```bash
python -m pytest test/test_fake_quotes.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'backend'`

- [x] **Step 3: Write the implementation**

Create `backend/__init__.py` (empty) and `backend/outreach/__init__.py` (empty).

Create `backend/outreach/fake.py`:

```python
"""Deterministic fake quotes.

Seeded from task_id, so the same task always produces the same quote and
`make demo` is reproducible. Tuned so the cheapest unit price is NOT
always the cheapest landed cost — the cost model needs a real problem.

No network. No delay. This is a pure function; the delay lives in the
provider (Task 5).
"""

from __future__ import annotations

import random
from decimal import Decimal

from packages.contracts.models import (
    Currency,
    ExpediteOption,
    OutreachTask,
    PriceBreak,
    Quote,
)

_INCOTERMS = ["EXW", "FCA", "DAP", "DDP"]
_CERTS = ["ISO 9001", "IATF 16949", "DIN 625"]
_PAYMENT = ["30 days net", "60 days net", "prepayment"]


def make_fake_quote(task: OutreachTask) -> Quote:
    rng = random.Random(task.task_id)

    # 1 in 5 suppliers cannot help at all.
    if rng.random() < 0.20:
        return Quote(
            task_id=task.task_id,
            case_id=task.case_id,
            supplier_ref=task.supplier_ref,
            available=False,
            notes="Cannot supply this part in the requested window.",
            confidence=round(rng.uniform(0.80, 0.98), 2),
            raw={"source": "fake"},
        )

    qty = task.brief.qty
    floor = task.brief.floor_price or Decimal("2.50")

    # Base price spreads widely around the floor: OEM vs generic is ~10x
    # in the bearing market, so make the ranking genuinely non-obvious.
    multiplier = Decimal(str(round(rng.uniform(0.72, 1.45), 3)))
    base = (floor * multiplier).quantize(Decimal("0.01"))

    price_breaks = _make_breaks(rng, base, qty)

    # Some suppliers cannot cover the full requirement.
    qty_offered = qty if rng.random() < 0.65 else int(qty * rng.uniform(0.35, 0.85))

    lead_time = rng.choice([7, 10, 14, 18, 21, 28, 35, 45])

    expedite = None
    if rng.random() < 0.55:
        expedite = ExpediteOption(
            days=rng.choice([3, 5, 7]),
            surcharge=(base * qty_offered * Decimal("0.08")).quantize(Decimal("0.01")),
        )

    return Quote(
        task_id=task.task_id,
        case_id=task.case_id,
        supplier_ref=task.supplier_ref,
        available=True,
        qty_offered=qty_offered,
        unit_price=base,
        price_breaks=price_breaks,
        currency=Currency.EUR,
        moq=rng.choice([100, 250, 500, 1000, 2500]),
        lead_time_days=lead_time,
        expedite_option=expedite,
        incoterm=rng.choice(_INCOTERMS),
        certs_claimed=rng.sample(_CERTS, k=rng.randint(1, len(_CERTS))),
        payment_terms=rng.choice(_PAYMENT),
        notes="Fake quote. FAKE_CALLS=1.",
        confidence=round(rng.uniform(0.72, 0.97), 2),
        raw={"source": "fake", "seed": task.task_id},
    )


def _make_breaks(rng: random.Random, base: Decimal, qty: int) -> list[PriceBreak]:
    """Quantity breaks that straddle the requested qty, so buying MORE than
    needed can legitimately be cheaper — that's the trade-off the cost
    model has to resolve against carrying cost."""
    tiers = [1, max(100, qty // 10), max(500, qty // 2), qty, qty * 2]
    breaks: list[PriceBreak] = []
    discount = Decimal("1.00")
    for tier in sorted(set(tiers)):
        breaks.append(
            PriceBreak(
                min_qty=tier,
                unit_price=(base * discount).quantize(Decimal("0.001")),
            )
        )
        discount -= Decimal(str(round(rng.uniform(0.04, 0.11), 3)))
        discount = max(discount, Decimal("0.55"))
    return breaks
```

- [x] **Step 4: Run test to verify it passes**

```bash
python -m pytest test/test_fake_quotes.py -v
```

Expected: 7 passed

- [x] **Step 5: Commit**

```bash
git add backend/ test/test_fake_quotes.py
git commit -m "slice-c(fake): deterministic quote generator seeded by task_id"
```

---

### Task 4: The provider seam + the outreach endpoint — **this is what unblocks B and D**

**Files:**
- Create: `backend/settings.py`
- Create: `backend/store.py`
- Create: `backend/outreach/protocol.py`
- Create: `backend/outreach/provider.py`
- Create: `backend/main.py`
- Test: `test/test_outreach_endpoint.py`

**Interfaces:**
- Consumes: `make_fake_quote` (Task 3), `OutreachTask`/`Quote` (Task 1)
- Produces:
  - `POST /tools/outreach` — body `{"tasks": [OutreachTask, ...]}` → `{"case_id": str, "task_ids": [str], "provider": "fake"|"calle"}`
  - `GET /tools/quotes?case_id=...` → `{"quotes": [Quote, ...]}`
  - `GET /cases/{case_id}/events` → `{"events": [Event, ...]}`
  - `backend.store.STORE` — module-level singleton with `add_quote`, `quotes_for`, `append_event`, `events_for`, `reset`

**The critical design point:** `dispatch()` returns a receipt immediately; quotes arrive **later**. Slices B and D must poll `GET /tools/quotes`. This mirrors the real CALL-E webhook flow exactly, so nothing gets rewritten at H14.

- [x] **Step 1: Write the failing test**

Create `test/test_outreach_endpoint.py`:

```python
import time
from datetime import date

from fastapi.testclient import TestClient

from backend.main import app
from backend.store import STORE

client = TestClient(app)


def _payload(n: int = 3) -> dict:
    return {
        "tasks": [
            {
                "task_id": f"T-{i:03d}",
                "case_id": "CASE-001",
                "supplier_ref": f"SUP-{i:03d}",
                "channel": "voice",
                "brief": {
                    "part_spec": "Deep groove ball bearing 6204-2RS",
                    "qty": 5000,
                    "needed_by": str(date(2026, 9, 3)),
                    "target_price": "1.85",
                    "floor_price": "2.40",
                },
            }
            for i in range(n)
        ]
    }


def setup_function():
    STORE.reset()


def test_dispatch_returns_immediately_with_a_receipt():
    r = client.post("/tools/outreach", json=_payload(3))
    assert r.status_code == 200
    body = r.json()
    assert body["task_ids"] == ["T-000", "T-001", "T-002"]
    assert body["provider"] == "fake"


def test_quotes_are_not_ready_instantly():
    """Async by design. If this ever passes instantly, the seam is wrong."""
    client.post("/tools/outreach", json=_payload(3))
    immediate = client.get("/tools/quotes", params={"case_id": "CASE-001"})
    assert len(immediate.json()["quotes"]) < 3


def test_all_quotes_arrive_eventually():
    client.post("/tools/outreach", json=_payload(3))
    for _ in range(100):
        got = client.get("/tools/quotes", params={"case_id": "CASE-001"}).json()
        if len(got["quotes"]) == 3:
            break
        time.sleep(0.1)
    assert len(got["quotes"]) == 3
    assert {q["task_id"] for q in got["quotes"]} == {"T-000", "T-001", "T-002"}


def test_dispatch_writes_events():
    client.post("/tools/outreach", json=_payload(2))
    events = client.get("/cases/CASE-001/events").json()["events"]
    assert any(e["stage"] == "outreach_dispatched" for e in events)


def test_unknown_case_returns_empty_not_an_error():
    r = client.get("/tools/quotes", params={"case_id": "CASE-NOPE"})
    assert r.status_code == 200
    assert r.json()["quotes"] == []
```

- [x] **Step 2: Run test to verify it fails**

```bash
python -m pytest test/test_outreach_endpoint.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'backend.main'`

- [x] **Step 3: Write the settings module**

Create `backend/settings.py`:

```python
"""Environment configuration. Rehearsal is the default everywhere."""

from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv(REPO_ROOT / ".env")

# Rehearsal is the default. Live calling is an explicit opt-in, never a
# fallback and never triggered by a merely-unset variable.
FAKE_CALLS: bool = os.environ.get("FAKE_CALLS", "1") == "1"

CALLE_API_KEY: str | None = os.environ.get("CALLE_API_KEY")
CALLE_BASE_URL: str = os.environ.get("CALLE_BASE_URL", "https://api.heycall-e.com")
PUBLIC_BASE_URL: str = os.environ.get("PUBLIC_BASE_URL", "http://localhost:8000")

# Seconds. The fake waits this long before delivering each quote, so
# consumers are forced to build against the async shape.
FAKE_MIN_DELAY: float = float(os.environ.get("FAKE_MIN_DELAY", "0.4"))
FAKE_MAX_DELAY: float = float(os.environ.get("FAKE_MAX_DELAY", "2.5"))
```

- [x] **Step 4: Write the store**

Create `backend/store.py`:

```python
"""In-memory quote store and append-only event log.

v3 deletes the database: the case files in git are the real datastore.
This is the live working set for one process.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from typing import Any

from packages.contracts.models import Quote


class Store:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._quotes: dict[str, dict[str, Quote]] = {}
        self._events: dict[str, list[dict[str, Any]]] = {}

    def add_quote(self, quote: Quote) -> None:
        with self._lock:
            self._quotes.setdefault(quote.case_id, {})[quote.task_id] = quote

    def quotes_for(self, case_id: str) -> list[Quote]:
        with self._lock:
            return list(self._quotes.get(case_id, {}).values())

    def append_event(
        self,
        case_id: str,
        actor: str,
        stage: str,
        message: str,
        level: str = "info",
        payload: dict | None = None,
    ) -> None:
        event = {
            "case_id": case_id,
            "ts": datetime.now(timezone.utc).isoformat(),
            "actor": actor,
            "stage": stage,
            "level": level,
            "message": message,
            "payload": payload or {},
        }
        with self._lock:
            self._events.setdefault(case_id, []).append(event)

    def events_for(self, case_id: str) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._events.get(case_id, []))

    def reset(self) -> None:
        with self._lock:
            self._quotes.clear()
            self._events.clear()


STORE = Store()
```

- [x] **Step 5: Write the provider seam**

Create `backend/outreach/protocol.py`:

```python
"""The seam between fake and real outreach.

Both implementations are ASYNCHRONOUS: dispatch() returns a receipt, and
quotes land later via the store. Consumers poll GET /tools/quotes. This is
the whole point — swapping fake for real changes one env var, not any
consumer code.
"""

from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel

from packages.contracts.models import OutreachTask


class DispatchReceipt(BaseModel):
    case_id: str
    task_ids: list[str]
    provider: str


class OutreachProvider(Protocol):
    name: str

    def dispatch(self, tasks: list[OutreachTask]) -> DispatchReceipt:
        """Start outreach. Returns immediately. Quotes arrive later."""
        ...
```

Create `backend/outreach/provider.py`:

```python
"""FakeOutreachProvider + provider selection."""

from __future__ import annotations

import random
import threading

from backend import settings
from backend.outreach.fake import make_fake_quote
from backend.outreach.protocol import DispatchReceipt, OutreachProvider
from backend.store import STORE
from packages.contracts.models import OutreachTask


class FakeOutreachProvider:
    """Delivers each quote after a random delay, exactly like a real call."""

    name = "fake"

    def dispatch(self, tasks: list[OutreachTask]) -> DispatchReceipt:
        case_id = tasks[0].case_id if tasks else ""
        STORE.append_event(
            case_id,
            actor="system",
            stage="outreach_dispatched",
            message=f"Dispatched {len(tasks)} outreach task(s) via fake provider",
            payload={"task_ids": [t.task_id for t in tasks]},
        )
        for task in tasks:
            rng = random.Random(task.task_id)
            delay = rng.uniform(settings.FAKE_MIN_DELAY, settings.FAKE_MAX_DELAY)
            threading.Timer(delay, self._deliver, args=(task,)).start()

        return DispatchReceipt(
            case_id=case_id,
            task_ids=[t.task_id for t in tasks],
            provider=self.name,
        )

    @staticmethod
    def _deliver(task: OutreachTask) -> None:
        quote = make_fake_quote(task)
        STORE.add_quote(quote)
        STORE.append_event(
            task.case_id,
            actor="calle",
            stage="quote_received",
            message=(
                f"{task.supplier_ref}: "
                + ("quoted" if quote.available else "cannot supply")
            ),
            payload={"task_id": task.task_id, "available": quote.available},
        )


def get_provider() -> OutreachProvider:
    """Rehearsal is the default. Live calling is an explicit opt-in."""
    if settings.FAKE_CALLS:
        return FakeOutreachProvider()

    from backend.outreach.calle import CalleOutreachProvider

    return CalleOutreachProvider()
```

- [x] **Step 6: Write the FastAPI app**

Create `backend/main.py`:

```python
"""The one FastAPI process. Slice C owns the routes below; other slices
add their own routers to this app.
"""

from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel

from backend.outreach.protocol import DispatchReceipt
from backend.outreach.provider import get_provider
from backend.store import STORE
from packages.contracts.models import OutreachTask, Quote

app = FastAPI(title="Autonomous Sourcing Agent")


class OutreachRequest(BaseModel):
    tasks: list[OutreachTask]


class QuotesResponse(BaseModel):
    quotes: list[Quote]


@app.post("/tools/outreach", response_model=DispatchReceipt)
def dispatch_outreach(request: OutreachRequest) -> DispatchReceipt:
    """Start contacting suppliers. Returns immediately — poll /tools/quotes."""
    return get_provider().dispatch(request.tasks)


@app.get("/tools/quotes", response_model=QuotesResponse)
def get_quotes(case_id: str) -> QuotesResponse:
    """Quotes collected so far. An unknown case is an empty list, not an error."""
    return QuotesResponse(quotes=STORE.quotes_for(case_id))


@app.get("/cases/{case_id}/events")
def get_events(case_id: str) -> dict:
    return {"events": STORE.events_for(case_id)}


@app.get("/health")
def health() -> dict:
    from backend import settings

    return {"ok": True, "fake_calls": settings.FAKE_CALLS}
```

- [x] **Step 7: Run test to verify it passes**

```bash
python -m pytest test/test_outreach_endpoint.py -v
```

Expected: 5 passed

- [x] **Step 8: Run the whole suite and start the server**

```bash
python -m pytest test/ -v -m "not live"
python -m uvicorn backend.main:app --reload --port 8000
```

Verify by hand:

```bash
curl -X POST http://localhost:8000/tools/outreach \
  -H "Content-Type: application/json" \
  -d '{"tasks":[{"task_id":"T-001","case_id":"CASE-001","supplier_ref":"SUP-ATLAS","channel":"voice","brief":{"part_spec":"6204-2RS","qty":5000,"needed_by":"2026-09-03","floor_price":"2.40"}}]}'

sleep 3
curl "http://localhost:8000/tools/quotes?case_id=CASE-001"
```

- [x] **Step 9: Commit and tell the team**

```bash
git add backend/ test/test_outreach_endpoint.py
git commit -m "slice-c(outreach): async provider seam + POST /tools/outreach"
```

**Post this in the team channel — B and D are now unblocked:**

> `POST /tools/outreach` with `{"tasks":[OutreachTask]}` → receipt.
> Then poll `GET /tools/quotes?case_id=...` until you have what you need.
> Quotes take 0.4–2.5s each, on purpose — real calls take minutes.
> Deterministic: same `task_id` → same quote, every run.
> `FAKE_CALLS=1` is the default. Nothing touches the network.

---

### Task 5: The normalizer — a garbled call still produces a Quote

**Files:**
- Create: `backend/outreach/normalize.py`
- Test: `test/test_normalize.py`

**Interfaces:**
- Consumes: `Quote`, `Currency`, `PriceBreak`, `ExpediteOption` (Task 1)
- Produces: `normalize_result(task_id: str, case_id: str, supplier_ref: str, payload: dict) -> Quote` — never raises

- [ ] **Step 1: Write the failing test**

Create `test/test_normalize.py`:

```python
from decimal import Decimal

from backend.outreach.normalize import normalize_result
from packages.contracts.models import Currency


def _norm(payload: dict):
    return normalize_result("T-001", "CASE-001", "SUP-ATLAS", payload)


def test_a_clean_result_maps_across():
    q = _norm(
        {
            "structured_result": {
                "available": True,
                "qty_offered": 5000,
                "unit_price": "2.15",
                "currency": "EUR",
                "moq": 500,
                "lead_time_days": 14,
                "incoterm": "DAP",
                "certs_claimed": ["ISO 9001"],
                "price_breaks": [{"min_qty": 1000, "unit_price": "2.30"}],
            },
            "completion_confidence": 0.91,
        }
    )
    assert q.available is True
    assert q.unit_price == Decimal("2.15")
    assert q.currency is Currency.EUR
    assert q.confidence == 0.91
    assert q.price_breaks[0].min_qty == 1000


def test_an_empty_payload_gives_an_unknown_quote_with_zero_confidence():
    q = _norm({})
    assert q.available is False
    assert q.unit_price is None
    assert q.currency is Currency.UNKNOWN
    assert q.confidence == 0.0


def test_garbage_types_do_not_raise():
    q = _norm({"structured_result": {"qty_offered": "not a number",
                                     "lead_time_days": None,
                                     "unit_price": "banana"}})
    assert q.qty_offered == 0
    assert q.lead_time_days is None
    assert q.unit_price is None
    assert q.confidence == 0.0


def test_an_unknown_currency_becomes_unknown_not_an_error():
    q = _norm({"structured_result": {"currency": "XYZ"}})
    assert q.currency is Currency.UNKNOWN


def test_the_raw_payload_is_always_kept():
    payload = {"structured_result": {"available": True}, "anything": "else"}
    assert _norm(payload).raw == payload
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest test/test_normalize.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'backend.outreach.normalize'`

- [ ] **Step 3: Write the implementation**

Create `backend/outreach/normalize.py`:

```python
"""CALL-E result -> Quote. This function is never allowed to raise.

A missing, partial, or garbled call result becomes a valid Quote with
fields defaulted to unknown and confidence 0.0. A later phase distrusts
any claim below a confidence threshold, so a broken call flows naturally
into "we couldn't verify this one" rather than halting the run.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from packages.contracts.models import (
    Currency,
    ExpediteOption,
    PriceBreak,
    Quote,
)


def _decimal(value: Any) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def _int(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _currency(value: Any) -> Currency:
    try:
        return Currency(str(value).upper())
    except (ValueError, AttributeError):
        return Currency.UNKNOWN


def _price_breaks(value: Any) -> list[PriceBreak]:
    if not isinstance(value, list):
        return []
    out: list[PriceBreak] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        qty = _int(item.get("min_qty"))
        price = _decimal(item.get("unit_price"))
        if qty is not None and price is not None:
            out.append(PriceBreak(min_qty=qty, unit_price=price))
    return out


def _expedite(value: Any) -> ExpediteOption | None:
    if not isinstance(value, dict):
        return None
    days = _int(value.get("days"))
    surcharge = _decimal(value.get("surcharge"))
    if days is None or surcharge is None:
        return None
    return ExpediteOption(days=days, surcharge=surcharge)


def _confidence(value: Any) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (ValueError, TypeError):
        return 0.0


def normalize_result(
    task_id: str,
    case_id: str,
    supplier_ref: str,
    payload: dict,
) -> Quote:
    result: dict = {}
    if isinstance(payload, dict) and isinstance(payload.get("structured_result"), dict):
        result = payload["structured_result"]

    certs = result.get("certs_claimed")
    if not isinstance(certs, list):
        certs = []

    return Quote(
        task_id=task_id,
        case_id=case_id,
        supplier_ref=supplier_ref,
        available=bool(result.get("available", False)),
        qty_offered=_int(result.get("qty_offered")) or 0,
        unit_price=_decimal(result.get("unit_price")),
        price_breaks=_price_breaks(result.get("price_breaks")),
        currency=_currency(result.get("currency")),
        moq=_int(result.get("moq")),
        lead_time_days=_int(result.get("lead_time_days")),
        expedite_option=_expedite(result.get("expedite_option")),
        incoterm=result.get("incoterm") if isinstance(result.get("incoterm"), str) else None,
        certs_claimed=[str(c) for c in certs],
        payment_terms=(
            result.get("payment_terms")
            if isinstance(result.get("payment_terms"), str)
            else None
        ),
        transcript_url=payload.get("transcript_url") if isinstance(payload, dict) else None,
        recording_url=payload.get("recording_url") if isinstance(payload, dict) else None,
        confidence=_confidence(payload.get("completion_confidence") if isinstance(payload, dict) else 0.0),
        raw=payload if isinstance(payload, dict) else {},
    )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest test/test_normalize.py -v
```

Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/outreach/normalize.py test/test_normalize.py
git commit -m "slice-c(normalize): CALL-E result to Quote, never raises"
```

---

### Task 6: The negotiation brief — disclosure first, always

**Files:**
- Create: `backend/outreach/brief.py`
- Test: `test/test_brief.py`

**Interfaces:**
- Consumes: `OutreachTask` (Task 1)
- Produces: `build_task_text(task: OutreachTask, buyer_name: str) -> str`

**Legal:** German §201 StGB makes recording without consent criminal, and the EU AI Act requires the callee know they are talking to an AI. The disclosure is baked into the builder — there is no parameter that removes it.

- [x] **Step 1: Write the failing test**

Create `test/test_brief.py`:

```python
from datetime import date
from decimal import Decimal

import pytest

from backend.outreach.brief import build_task_text
from packages.contracts.models import Channel, OutreachBrief, OutreachTask


def _task(**overrides) -> OutreachTask:
    brief = OutreachBrief(
        part_spec="Deep groove ball bearing 6204-2RS (DIN 625)",
        qty=5000,
        needed_by=date(2026, 9, 3),
        target_price=Decimal("1.85"),
        floor_price=Decimal("2.40"),
        **overrides,
    )
    return OutreachTask(
        task_id="T-001",
        case_id="CASE-001",
        supplier_ref="SUP-ATLAS",
        channel=Channel.VOICE,
        brief=brief,
    )


def test_disclosure_is_the_first_thing_said():
    text = build_task_text(_task(), buyer_name="Meridian Motors")
    first = text.split("\n")[0]
    assert "AI" in first
    assert "Meridian Motors" in first


def test_recording_is_disclosed():
    text = build_task_text(_task(), buyer_name="Meridian Motors")
    assert "recorded" in text.lower()


def test_it_offers_a_human_and_stops_when_asked():
    text = build_task_text(_task(), buyer_name="Meridian Motors")
    assert "human" in text.lower()
    assert "end the call" in text.lower()


def test_every_must_ask_item_appears():
    text = build_task_text(_task(), buyer_name="Meridian Motors").lower()
    assert "price break" in text
    assert "minimum order" in text
    assert "lead time" in text
    assert "incoterm" in text
    assert "certif" in text


def test_the_floor_price_is_never_spoken_to_the_supplier():
    """Our walk-away number is ours. Saying it destroys the negotiation."""
    text = build_task_text(_task(), buyer_name="Meridian Motors")
    assert "2.40" not in text


def test_the_target_price_guides_but_is_not_quoted_as_our_contract_price():
    text = build_task_text(_task(), buyer_name="Meridian Motors")
    assert "1.85" in text


def test_a_missing_target_price_is_allowed():
    task = _task()
    task.brief.target_price = None
    text = build_task_text(task, buyer_name="Meridian Motors")
    assert "AI" in text.split("\n")[0]


def test_the_suppliers_phone_number_never_appears_in_the_script():
    text = build_task_text(_task(), buyer_name="Meridian Motors")
    assert "+" not in text
```

- [x] **Step 2: Run test to verify it fails**

```bash
python -m pytest test/test_brief.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'backend.outreach.brief'`

- [x] **Step 3: Write the implementation**

Create `backend/outreach/brief.py`:

```python
"""Builds what the voice agent says.

The disclosure is not a parameter. There is no way to call this function
and get a script without it.

The supplier's phone number never appears here — it travels separately in
the recipients[] array of the CALL-E request.
"""

from __future__ import annotations

from packages.contracts.models import OutreachTask

_DISCLOSURE = (
    "You are an AI procurement assistant calling on behalf of {buyer_name}. "
    "Say this clearly in your first two sentences: that you are an AI "
    "assistant, who you are calling for, and that this call is recorded. "
    "If the person asks to speak to a human, or asks you to stop, thank "
    "them and end the call without pursuing the request. Do not agree to "
    "any price, quantity, delivery commitment, or contract change on this "
    "call — you are gathering information only, and a human buyer makes "
    "every decision."
)

_MUST_ASK = (
    "Ask for all of the following, and confirm the numbers back to them "
    "before you hang up:\n"
    "  - the unit price for this quantity\n"
    "  - quantity price breaks (what the unit price becomes at higher "
    "volumes, and at which quantities the price changes)\n"
    "  - the minimum order quantity\n"
    "  - the lead time in days\n"
    "  - the incoterm (who pays freight and insurance)\n"
    "  - whether their quality certification for this part is currently "
    "valid, and which certification it is\n"
    "  - whether any units they mention are physically in stock and free, "
    "or already promised to another customer"
)


def build_task_text(task: OutreachTask, buyer_name: str) -> str:
    brief = task.brief

    lines = [
        _DISCLOSURE.format(buyer_name=buyer_name),
        "",
        f"You are sourcing: {brief.part_spec}.",
        f"Quantity required: {brief.qty} units.",
        f"Needed by: {brief.needed_by.isoformat()}.",
        "",
        _MUST_ASK,
    ]

    if brief.target_price is not None:
        lines += [
            "",
            f"Negotiate toward {brief.target_price} per unit. If they open "
            "higher, ask what volume would bring the price down. Never state "
            "our own contract price or our walk-away price. If they cannot "
            "reach the target, record their best offer and move on politely.",
        ]

    return "\n".join(lines)
```

- [x] **Step 4: Run test to verify it passes**

```bash
python -m pytest test/test_brief.py -v
```

Expected: 8 passed

- [x] **Step 5: Commit**

```bash
git add backend/outreach/brief.py test/test_brief.py
git commit -m "slice-c(brief): call script with unskippable AI + recording disclosure"
```

---

### Task 7: The real CALL-E provider + webhook receiver

**Files:**
- Create: `backend/outreach/calle.py`
- Modify: `backend/main.py` (add the webhook route)
- Test: `test/test_calle_provider.py`

**Interfaces:**
- Consumes: `build_task_text` (Task 6), `normalize_result` (Task 5), `quote_result_schema` (Task 2), `STORE` (Task 4)
- Produces:
  - `CalleOutreachProvider` implementing `OutreachProvider`
  - `build_calle_payload(tasks, phones_by_supplier, buyer_name) -> dict`
  - `POST /calle/webhook` route

**Network safety:** `build_calle_payload` is a pure function and is the only thing tested. No test in this task makes a network call.

- [ ] **Step 1: Write the failing test**

Create `test/test_calle_provider.py`:

```python
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.outreach.calle import InvalidPhoneNumber, build_calle_payload, mask
from backend.store import STORE
from packages.contracts.models import Channel, OutreachBrief, OutreachTask

client = TestClient(app)


def _task(task_id="T-001", supplier="SUP-ATLAS") -> OutreachTask:
    return OutreachTask(
        task_id=task_id,
        case_id="CASE-001",
        supplier_ref=supplier,
        channel=Channel.VOICE,
        brief=OutreachBrief(
            part_spec="Deep groove ball bearing 6204-2RS",
            qty=5000,
            needed_by=date(2026, 9, 3),
            target_price=Decimal("1.85"),
            floor_price=Decimal("2.40"),
        ),
    )


def setup_function():
    STORE.reset()


def test_payload_carries_the_answer_sheet_and_the_case_id():
    payload = build_calle_payload(
        [_task()],
        phones_by_supplier={"SUP-ATLAS": "+447700900123"},
        buyer_name="Meridian Motors",
    )
    assert payload["recipient_result_schema"]["additionalProperties"] is False
    assert payload["metadata"]["case_id"] == "CASE-001"
    assert payload["task"].split("\n")[0].startswith("You are an AI")


def test_the_raw_number_appears_only_in_the_recipients_array():
    payload = build_calle_payload(
        [_task()],
        phones_by_supplier={"SUP-ATLAS": "+447700900123"},
        buyer_name="Meridian Motors",
    )
    assert payload["recipients"][0]["phones"] == ["+447700900123"]
    assert "+447700900123" not in payload["task"]


def test_a_malformed_number_is_refused_not_dialled():
    with pytest.raises(InvalidPhoneNumber):
        build_calle_payload(
            [_task()],
            phones_by_supplier={"SUP-ATLAS": "0770 090 0123"},
            buyer_name="Meridian Motors",
        )


def test_mask_hides_the_middle():
    assert mask("+447700900123") == "+4********0123"


def test_batching_puts_every_supplier_in_one_request():
    payload = build_calle_payload(
        [_task("T-001", "SUP-A"), _task("T-002", "SUP-B")],
        phones_by_supplier={"SUP-A": "+447700900123", "SUP-B": "+447700900124"},
        buyer_name="Meridian Motors",
    )
    assert len(payload["recipients"]) == 2


def test_webhook_turns_a_result_into_a_stored_quote():
    r = client.post(
        "/calle/webhook",
        json={
            "metadata": {"case_id": "CASE-001", "task_id": "T-001",
                         "supplier_ref": "SUP-ATLAS"},
            "structured_result": {"available": True, "qty_offered": 5000,
                                  "unit_price": "2.15", "currency": "EUR",
                                  "lead_time_days": 14},
            "completion_confidence": 0.9,
        },
    )
    assert r.status_code == 200
    quotes = STORE.quotes_for("CASE-001")
    assert len(quotes) == 1
    assert quotes[0].unit_price == Decimal("2.15")


def test_webhook_accepts_garbage_without_500ing():
    r = client.post("/calle/webhook", json={"metadata": {"case_id": "CASE-001",
                                                         "task_id": "T-002",
                                                         "supplier_ref": "SUP-X"}})
    assert r.status_code == 200
    assert STORE.quotes_for("CASE-001")[0].confidence == 0.0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest test/test_calle_provider.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'backend.outreach.calle'`

- [ ] **Step 3: Write the CALL-E provider**

Create `backend/outreach/calle.py`:

```python
"""Real CALL-E calling. Only reachable when FAKE_CALLS=0.

CALL-E's batch endpoint takes a recipients[] array, so CALL-E IS the
parallel dispatcher — we do not build one.
"""

from __future__ import annotations

import re

import httpx

from backend import settings
from backend.outreach.brief import build_task_text
from backend.outreach.protocol import DispatchReceipt
from backend.store import STORE
from packages.contracts.models import OutreachTask
from packages.contracts.schemas import quote_result_schema

_E164 = re.compile(r"^\+[1-9]\d{1,14}$")


class InvalidPhoneNumber(ValueError):
    pass


def validate_e164(number: str) -> str:
    if not _E164.match(number):
        raise InvalidPhoneNumber(f"not a valid E.164 phone number: {number!r}")
    return number


def mask(number: str) -> str:
    digits = number.lstrip("+")
    if len(digits) <= 4:
        return "+" + "*" * len(digits)
    return "+" + digits[0] + "*" * (len(digits) - 5) + digits[-4:]


def build_calle_payload(
    tasks: list[OutreachTask],
    phones_by_supplier: dict[str, str],
    buyer_name: str,
) -> dict:
    """Pure. The ONLY place a raw phone number is allowed to appear."""
    if not tasks:
        raise ValueError("no tasks to dispatch")

    recipients = []
    for task in tasks:
        raw = phones_by_supplier.get(task.supplier_ref)
        if raw is None:
            raise InvalidPhoneNumber(f"no phone number for {task.supplier_ref}")
        recipients.append(
            {
                "phones": [validate_e164(raw)],
                "region": "DE",
                "locale": "de-DE",
                "metadata": {
                    "task_id": task.task_id,
                    "supplier_ref": task.supplier_ref,
                },
            }
        )

    return {
        "task": build_task_text(tasks[0], buyer_name=buyer_name),
        "recipients": recipients,
        "recipient_result_schema": quote_result_schema(),
        "webhook_url": f"{settings.PUBLIC_BASE_URL}/calle/webhook",
        "metadata": {"case_id": tasks[0].case_id},
    }


class CalleOutreachProvider:
    name = "calle"

    def dispatch(self, tasks: list[OutreachTask]) -> DispatchReceipt:
        if not settings.CALLE_API_KEY:
            raise RuntimeError(
                "live calling requested but CALLE_API_KEY is not set — "
                "refusing rather than falling back to rehearsal data"
            )

        case_id = tasks[0].case_id
        phones = _load_supplier_phones([t.supplier_ref for t in tasks])
        payload = build_calle_payload(tasks, phones, buyer_name="Meridian Motors")

        STORE.append_event(
            case_id,
            actor="calle",
            stage="outreach_dispatched",
            message="Dialling "
            + ", ".join(mask(r["phones"][0]) for r in payload["recipients"]),
            payload={"task_ids": [t.task_id for t in tasks]},
        )

        response = httpx.post(
            f"{settings.CALLE_BASE_URL}/v1/calls",
            headers={
                "Authorization": f"Bearer {settings.CALLE_API_KEY}",
                "Idempotency-Key": f"{case_id}:{'-'.join(t.task_id for t in tasks)}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=60.0,
        )
        response.raise_for_status()

        return DispatchReceipt(
            case_id=case_id,
            task_ids=[t.task_id for t in tasks],
            provider=self.name,
        )


def _load_supplier_phones(supplier_refs: list[str]) -> dict[str, str]:
    """Slice B owns supplier data. Until its adapter lands, read the demo
    fixture. Every number here is from a reserved fictional range."""
    import json
    from pathlib import Path

    fixture = settings.REPO_ROOT / "backend" / "fixtures" / "supplier_phones.json"
    if not fixture.exists():
        raise RuntimeError(f"no supplier phone fixture at {fixture}")

    data = json.loads(fixture.read_text(encoding="utf-8"))
    return {ref: data[ref] for ref in supplier_refs if ref in data}
```

- [ ] **Step 4: Create the demo fixture**

Create `backend/fixtures/supplier_phones.json`. **Every number is from the UK Ofcom reserved drama range `+44 7700 900xxx` — none can ring a real person.**

```json
{
  "SUP-ATLAS": "+447700900123",
  "SUP-BAVARIA": "+447700900124",
  "SUP-NORDIC": "+447700900125",
  "SUP-IBERIA": "+447700900126",
  "SUP-ALPINE": "+447700900127"
}
```

- [ ] **Step 5: Add the webhook route to `backend/main.py`**

Add these imports at the top of `backend/main.py`:

```python
from fastapi import Request

from backend.outreach.normalize import normalize_result
```

Add this route to `backend/main.py`:

```python
@app.post("/calle/webhook")
async def calle_webhook(request: Request) -> dict:
    """CALL-E pushes terminal results here. Always returns 200 — a webhook
    that 500s gets retried, and a garbled result is a valid low-confidence
    quote, not an error."""
    try:
        payload = await request.json()
    except Exception:
        return {"ok": True, "ignored": "unparseable body"}

    meta = payload.get("metadata", {}) if isinstance(payload, dict) else {}
    recipient_meta = {}
    if isinstance(payload, dict) and isinstance(payload.get("recipient"), dict):
        recipient_meta = payload["recipient"].get("metadata", {}) or {}

    case_id = meta.get("case_id", "UNKNOWN")
    task_id = recipient_meta.get("task_id") or meta.get("task_id", "UNKNOWN")
    supplier_ref = (
        recipient_meta.get("supplier_ref") or meta.get("supplier_ref", "UNKNOWN")
    )

    quote = normalize_result(task_id, case_id, supplier_ref, payload)
    STORE.add_quote(quote)
    STORE.append_event(
        case_id,
        actor="calle",
        stage="quote_received",
        message=f"{supplier_ref}: " + ("quoted" if quote.available else "no quote"),
        payload={"task_id": task_id, "confidence": quote.confidence},
    )
    return {"ok": True}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
python -m pytest test/test_calle_provider.py -v
```

Expected: 7 passed

- [ ] **Step 7: Run the whole suite**

```bash
python -m pytest test/ -v -m "not live"
```

Expected: all pass, `test_calle.py::test_place_one_real_call_and_get_a_structured_result` deselected

- [ ] **Step 8: Commit**

```bash
git add backend/outreach/calle.py backend/fixtures/ backend/main.py test/test_calle_provider.py
git commit -m "slice-c(calle): real provider + webhook receiver behind the same seam"
```

---

### Task 8: The channel router

**Files:**
- Create: `backend/outreach/router.py`
- Test: `test/test_router.py`

**Interfaces:**
- Consumes: `Channel` (Task 1)
- Produces: `route_channel(country_code: str) -> Channel`, `CALLE_REGIONS: frozenset[str]`

**Why:** CALL-E has no China region. v3 presents this as deliberate channel routing by supplier geography, not as a gap.

- [ ] **Step 1: Write the failing test**

Create `test/test_router.py`:

```python
from backend.outreach.router import route_channel
from packages.contracts.models import Channel


def test_german_suppliers_get_a_phone_call():
    assert route_channel("DE") is Channel.VOICE


def test_china_gets_the_marketplace_channel():
    assert route_channel("CN") is Channel.MARKETPLACE


def test_an_unsupported_region_falls_back_to_email_never_to_voice():
    assert route_channel("ZZ") is Channel.EMAIL


def test_the_country_code_is_case_insensitive():
    assert route_channel("de") is Channel.VOICE
```

- [ ] **Step 2: Run test to verify it fails**

```bash
python -m pytest test/test_router.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'backend.outreach.router'`

- [ ] **Step 3: Write the implementation**

Create `backend/outreach/router.py`:

```python
"""Which channel reaches which supplier.

CALL-E supports a fixed set of regions. China is not among them, so the
China leg goes by marketplace message. Anything else unsupported falls
back to email — never to voice, because dialling an unsupported region
fails at CALL-E and burns a credit.
"""

from __future__ import annotations

from packages.contracts.models import Channel

CALLE_REGIONS: frozenset[str] = frozenset({"DE", "AT", "CH", "GB", "US", "IE", "NL"})

MARKETPLACE_REGIONS: frozenset[str] = frozenset({"CN", "HK", "TW"})


def route_channel(country_code: str) -> Channel:
    code = (country_code or "").upper()
    if code in CALLE_REGIONS:
        return Channel.VOICE
    if code in MARKETPLACE_REGIONS:
        return Channel.MARKETPLACE
    return Channel.EMAIL
```

- [ ] **Step 4: Run test to verify it passes**

```bash
python -m pytest test/test_router.py -v
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/outreach/router.py test/test_router.py
git commit -m "slice-c(router): channel selection by supplier region"
```

---

## Definition of Done

Slice C is complete when:

- [ ] `python -m pytest test/ -v -m "not live"` is fully green
- [ ] `POST /tools/outreach` + polling `GET /tools/quotes` works with `FAKE_CALLS=1`, no network touched
- [ ] Setting `FAKE_CALLS=0` switches to real CALL-E with **zero changes** in Slice B or D code
- [ ] One real call to a teammate produces a schema-valid `Quote` end to end (v3's stated DoD)
- [ ] Every phone number in the repo is from a reserved fictional range
- [ ] The disclosure is present and cannot be turned off

## Deferred — not in this plan

- **C6 demo call fixtures** (teammate personas, printed scripts) — a rehearsal artifact, not code. Do it at H14 with the whole team.
- **Email channel implementation** — `route_channel` returns `Channel.EMAIL`, but no email sender exists. v3 deletes email from the MVP path; re-add if time allows.
- **Devin browser price research** — the H14–H18 stretch that would populate `target_price`/`floor_price` from published distributor pricing. Those fields exist in `OutreachBrief` and are currently caller-supplied.
