import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ArrowRight,
  Bot,
  Calculator,
  Check,
  GitPullRequest,
  Phone,
  Search,
  ShieldCheck,
} from "lucide-react"

const steps = [
  { label: "Shortage", color: "bg-chart-1", icon: Search },
  { label: "Thinking", color: "bg-chart-2", icon: Bot },
  { label: "Calling", color: "bg-chart-3", icon: Phone },
  { label: "Costing", color: "bg-chart-4", icon: Calculator },
  { label: "Done", color: "bg-chart-5", icon: Check },
]

const features = [
  {
    title: "Find alternatives in seconds",
    description:
      "Devin reads the mock ERP, identifies what is missing, and surfaces approved suppliers with alternatives for the exact spec.",
    icon: Search,
  },
  {
    title: "CALL-E negotiates for you",
    description:
      "Our voice agent calls distributors in parallel, asks for price breaks, MOQ, lead time and certs, and returns a structured quote.",
    icon: Phone,
  },
  {
    title: "Cost model you can audit",
    description:
      "Landed cost, freight, duty, carrying cost and split-order strategies are pure functions with passing pytest suites.",
    icon: Calculator,
  },
  {
    title: "Compliance as code",
    description:
      "Blocked origins, missing certifications and audit gaps are rejected by name, with the rule that failed them.",
    icon: ShieldCheck,
  },
  {
    title: "Decision as a pull request",
    description:
      "The case, quotes, cost report and PO draft ship as a GitHub PR — reviewable, diffable and mergeable.",
    icon: GitPullRequest,
  },
  {
    title: "No human in the loop",
    description:
      "A reorder-point scanner or a single button launches the whole run. The agent checks its own work before it opens the PR.",
    icon: Bot,
  },
]

const code = `shortage:
  part: 6204-2RS
  qty_needed: 5000
  needed_by: 2026-09-02

candidates:
  - skf_germany:    compliance: PASS
  - fag_italy:      compliance: PASS
  - ntn_china:      compliance: FAIL (blocked_origin)
  - generic_turkey: compliance: FAIL (missing_cert)

recommended:
  split:
    - air 20% from SKF to cover line-stop
    - sea 80% from FAG for unit economy
`

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6 lg:px-20">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground">stockout</span>
            <Badge className="bg-primary text-primary-foreground uppercase text-[11px] font-semibold tracking-[0.88px]">
              Demo
            </Badge>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <a href="#docs" className="hover:text-foreground">Docs</a>
          </nav>
          <Button
            size="default"
            className="h-8 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Request a demo
          </Button>
        </div>
      </header>

      <main>
        <section className="bg-background px-6 pb-20 pt-32 lg:px-20">
          <div className="mx-auto max-w-[1200px] text-center">
            <h1 className="font-sans text-4xl font-normal leading-[1.1] tracking-[-2.16px] text-foreground sm:text-5xl lg:text-7xl">
              Procurement is an engineering problem.
              <br />
              <span className="text-primary">Give it an engineer.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              A production line is 12 days from standing still. Stockout reads the ERP,
              finds suppliers, dispatches voice agents, runs a landed-cost model, checks
              compliance, and ships the decision as a pull request.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                nativeButton={false}
                render={<Link href="/dashboard" />}
              >
                Launch a case
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button
                variant="secondary"
                size="default"
                className="h-10 rounded-md border border-border bg-card px-[18px] text-sm font-medium text-foreground hover:bg-muted"
              >
                View a sample PR
              </Button>
            </div>

            <Card className="mx-auto mt-16 max-w-4xl border border-border bg-card ring-0">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <div className="size-3 rounded-full bg-chart-1" />
                <div className="size-3 rounded-full bg-chart-2" />
                <div className="size-3 rounded-full bg-chart-3" />
                <span className="ml-2 text-xs text-muted-foreground">sourcing_case.yaml</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed text-foreground">
                {code}
              </pre>
            </Card>
          </div>
        </section>

        <Separator className="bg-border" />

        <section id="features" className="bg-background px-6 py-20 lg:px-20">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-center text-3xl font-normal tracking-[-0.72px] text-foreground sm:text-4xl">
              One autonomous workflow, end to end
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              From shortage detection to a recommended purchase order, every stage is
              observable, testable and reviewable.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon
                return (
                  <Card
                    key={feature.title}
                    className="border border-border bg-card ring-0"
                  >
                    <CardContent className="flex flex-col gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                        <Icon data-icon="inline-start" />
                      </div>
                      <CardTitle className="text-lg font-semibold leading-snug text-foreground">
                        {feature.title}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        <Separator className="bg-border" />

        <section id="how-it-works" className="bg-background px-6 py-20 lg:px-20">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-center text-3xl font-normal tracking-[-0.72px] text-foreground sm:text-4xl">
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              Each stage is a color in the agent timeline. The cockpit shows it live; the
              repo preserves it forever.
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {steps.map((step, index) => {
                const Icon = step.icon
                return (
                  <Card
                    key={step.label}
                    className="border border-border bg-card ring-0"
                  >
                    <CardContent className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.88px] text-foreground ${step.color}`}
                        >
                          {step.label}
                        </span>
                        <span className="text-xs text-muted-foreground">0{index + 1}</span>
                      </div>
                      <Icon className="mt-2 text-foreground" data-icon="inline-start" />
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        <section className="bg-background px-6 py-24 text-center lg:px-20">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-3xl font-normal tracking-[-0.72px] text-foreground sm:text-4xl">
              See the whole run in under 90 seconds.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Fixture-first, replayable, and built for the stage. Run the demo command and
              watch a shortage become a pull request.
            </p>
            <div className="mx-auto mt-10 inline-block rounded-xl border border-border bg-card p-5 text-left font-mono text-sm text-foreground">
              <span className="text-muted-foreground">$</span> make demo
            </div>
            <div className="mt-10">
              <Button
                size="default"
                className="h-10 rounded-md bg-primary px-[18px] text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Get early access
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background px-6 py-16 lg:px-20">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <span className="text-lg font-semibold text-foreground">stockout</span>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                Autonomous sourcing for engineering teams. Built for the EHL Game Jam
                Munich · Cognition track.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Product</h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="/dashboard" className="hover:text-foreground">Cockpit</a></li>
                <li><a href="#" className="hover:text-foreground">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Engineering</h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">API</a></li>
                <li><a href="#" className="hover:text-foreground">Contracts</a></li>
                <li><a href="#" className="hover:text-foreground">GitHub</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Legal</h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms</a></li>
              </ul>
            </div>
          </div>
          <p className="mt-12 text-xs text-muted-foreground">
            © 2026 stockout. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  )
}
