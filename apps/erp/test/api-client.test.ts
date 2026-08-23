import { afterEach, describe, expect, test, vi } from "vitest"

import {
  getInventory,
  getSuppliers,
  openCase,
  supplyOsCaseUrl,
} from "@/lib/api/client"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ERP API client", () => {
  test("reads inventory from the canonical API", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }))
    vi.stubGlobal("fetch", fetch)

    await expect(getInventory()).resolves.toEqual([])
    expect(fetch).toHaveBeenCalledWith("http://localhost:8010/inventory", {
      cache: "no-store",
    })
  })

  test("encodes a part id when reading its supplier records", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }))
    vi.stubGlobal("fetch", fetch)

    await getSuppliers("PRT / 1")
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8010/tools/suppliers?part_id=PRT%20%2F%201",
      { cache: "no-store" }
    )
  })

  test("opens a case through FastAPI", async () => {
    const body = { case_id: "CASE-123" }
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 201,
        headers: { "content-type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetch)

    await expect(openCase("PRT-1")).resolves.toEqual(body)
    expect(fetch).toHaveBeenCalledWith("http://localhost:8010/cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ part_id: "PRT-1" }),
      cache: "no-store",
    })
  })

  test("preserves the API detail when a request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "no part PRT-404" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        })
      )
    )

    await expect(openCase("PRT-404")).rejects.toThrow("no part PRT-404")
  })
})

test("builds the external SupplyOS case handoff URL", () => {
  expect(supplyOsCaseUrl("CASE / 1", "https://supply.example/base/")).toBe(
    "https://supply.example/chat?case=CASE+%2F+1"
  )
})
