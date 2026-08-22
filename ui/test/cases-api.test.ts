import { beforeEach, expect, test } from "vitest"

import { GET as getEvents } from "@/app/api/cases/[caseId]/events/route"
import { POST as postCase } from "@/app/api/cases/route"
import { resetStore } from "@/lib/cases/store"
import type { CaseEvent } from "@/lib/cases/types"

// Slice 1 must never call the real Devin API from a test run.
beforeEach(() => {
  delete process.env.DEVIN_API_KEY
  resetStore()
})

function postRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function events(caseId: string) {
  const response = await getEvents(
    new Request(`http://localhost:3000/api/cases/${caseId}/events`),
    { params: Promise.resolve({ caseId }) }
  )
  const body = (await response.json()) as { events: CaseEvent[] }
  return { status: response.status, ...body }
}

test("POST /api/cases creates CASE-001 from the fixture and logs events", async () => {
  const response = await postCase(postRequest({ case_id: "CASE-001" }))
  expect(response.status).toBe(201)

  const created = (await response.json()) as {
    case_id: string
    session_id: string
    session_url: string
    stubbed: boolean
  }
  expect(created.case_id).toBe("CASE-001")
  expect(created.stubbed).toBe(true)
  expect(created.session_id).toContain("stub")

  const log = await events("CASE-001")
  expect(log.status).toBe(200)
  expect(log.events.map((event) => event.stage)).toEqual([
    "created",
    "session_started",
  ])

  const createdEvent = log.events[0]
  expect(createdEvent.actor).toBe("system")
  const incident = createdEvent.payload.incident as Record<string, unknown>
  expect(incident.part_id).toBe("6204-2RS")
  // Money stays a decimal string: no float ever enters the event log.
  expect(typeof incident.expedite_fee).toBe("string")
  expect(createdEvent.payload.shortfall).toBe(
    (incident.qty_required as number) - (incident.qty_on_hand as number)
  )
  expect(log.events[1].payload.session_id).toBe(created.session_id)
})

test("an unknown case has no fixture and no events", async () => {
  const response = await postCase(postRequest({ case_id: "CASE-999" }))
  expect(response.status).toBe(404)
  expect((await events("CASE-999")).status).toBe(404)
})

test("POST /api/cases accepts an inline incident and rejects float money", async () => {
  const incident = {
    case_id: "CASE-002",
    part_id: "6205-2RS",
    qty_required: 900,
    qty_on_hand: 100,
    line_stop_at: "2026-03-20T06:00:00Z",
    line_stop_cost_per_hour: "12000.00",
    expedite_fee: "1500.00",
    currency: "EUR",
  }
  const ok = await postCase(postRequest({ case_id: "CASE-002", incident }))
  expect(ok.status).toBe(201)
  expect((await events("CASE-002")).events[0].stage).toBe("created")

  const bad = await postCase(
    postRequest({
      case_id: "CASE-003",
      incident: { ...incident, case_id: "CASE-003", expedite_fee: 1500.5 },
    })
  )
  expect(bad.status).toBe(400)
})
