import { afterEach, expect, test } from "vitest"

import { chatUrl, openChat } from "@/lib/web-app"

const originalPort = process.env.UI_PORT

afterEach(() => {
  if (originalPort === undefined) delete process.env.UI_PORT
  else process.env.UI_PORT = originalPort
})

test("the cockpit opens its current case on the UI port's chat route", () => {
  process.env.UI_PORT = "3000"

  const visited: string[] = []
  openChat("CASE-6204-2RS 2", "http://localhost:3001", (url) => {
    visited.push(url)
  })

  expect(visited).toEqual(["http://localhost:3000/chat?case=CASE-6204-2RS+2"])
})

test("the chat URL keeps the ERP hostname for access from another device", () => {
  process.env.UI_PORT = "4100"

  expect(chatUrl("CASE-001", "http://192.0.2.10:4101")).toBe(
    "http://192.0.2.10:4100/chat?case=CASE-001"
  )
})
