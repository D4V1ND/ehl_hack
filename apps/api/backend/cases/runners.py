"""Execution port for deterministic and future external Case runners."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Protocol


@dataclass(frozen=True)
class RunnerReceipt:
    run_id: str
    url: str | None = None
    stubbed: bool = True
    error: str | None = None


@dataclass(frozen=True)
class CaseRunContext:
    case_id: str
    revision: int
    execute: Callable[[], None]


class CaseRunner(Protocol):
    def start(self, context: CaseRunContext) -> RunnerReceipt: ...


class DeterministicCaseRunner:
    """Run the pipeline inline. This adapter cannot contact an external system."""

    def start(self, context: CaseRunContext) -> RunnerReceipt:
        context.execute()
        return RunnerReceipt(run_id=f"deterministic:{context.case_id}:{context.revision}")
