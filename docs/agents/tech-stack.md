# Tech stack

- **[Entire](https://docs.entire.io/)** — Agent context capture, session history, and review tooling integrated with this repo's agent workflows.
- **[Vinext](https://vinext.dev/)** — Vite plugin that re-implements the Next.js 16 API surface (App Router, RSC, server actions) and targets Cloudflare Workers.
- **[React 19](https://react.dev/)** — Component library for the UI.
- **[Vite](https://vitejs.dev/)** — Build tool and dev server.
- **[@cloudflare/vite-plugin](https://developers.cloudflare.com/workers/vite-plugin/)** — Vite plugin that provides local Cloudflare Workers bindings (D1, R2, ASSETS, IMAGES).
- **[Wrangler](https://developers.cloudflare.com/workers/wrangler/)** — CLI for local Cloudflare Workers development and deployment.
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** — Serverless SQLite database used by the worker `DB` binding.
- **[Drizzle ORM / Drizzle Kit](https://orm.drizzle.team/)** — Type-safe SQL-like ORM and migration tooling (see `db/schema.ts` and `drizzle.config.ts`).
- **[Tailwind CSS v4](https://tailwindcss.com/docs/)** — Utility-first CSS framework.
- **[TypeScript](https://www.typescriptlang.org/docs/)** — Typed JavaScript.
- **[ESLint](https://eslint.org/docs/latest/)** — Linting and code quality.
- **[Node.js test runner](https://nodejs.org/api/test.html)** — Built-in test runner used in `npm test`.
