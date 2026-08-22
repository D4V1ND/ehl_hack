"""One FastAPI process: the Devin tool endpoints and the cockpit read API.

No service mesh, no second process. The seed data is parsed once at startup and
served from memory, because a session sitting on a slow endpoint costs money for
nothing.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.deps import erp, settings
from backend.api.routers import calle, cases, meta, tools


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Parse and validate the seed data now, so bad data fails at boot rather than
    # in front of a judge.
    erp()
    yield


def create_app() -> FastAPI:
    config = settings()
    app = FastAPI(
        title="SupplyGuard core API",
        version="0.1.0",
        description=(
            "Slice B — the system of record, the case store and the tool endpoints a "
            "Devin session calls. Phone numbers are masked in every response; the raw "
            "number exists only inside the outbound call request."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=config.cors_origin_regex,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(meta.router)
    app.include_router(tools.router)
    app.include_router(cases.router)
    # Where finished calls come back. Registered on the same app the cockpit
    # talks to, because that is the process holding the live quote store.
    app.include_router(calle.router)

    return app


app = create_app()
