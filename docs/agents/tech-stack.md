# Tech stack

Use these links when a task touches the corresponding area. Application
versions are pinned in each app's manifest; the manifests are authoritative.

## API and contracts

- [Python](https://docs.python.org/3/) 3.11+
- [FastAPI](https://fastapi.tiangolo.com/) and
  [Uvicorn](https://www.uvicorn.org/) for `supplyos_api.main:app`
- [Pydantic](https://docs.pydantic.dev/) and `Decimal` for shared domain models
- SQLite and [PyYAML](https://pyyaml.org/wiki/PyYAMLDocumentation) for the mock
  system of record
- [pytest](https://docs.pytest.org/) for the offline API suite
- [setuptools](https://setuptools.pypa.io/) for the separate contracts and API
  distributions; [uv](https://docs.astral.sh/uv/) for the API lockfile
- CALL-E for outbound voice, behind the explicit live-call gate

## ERP and SupplyOS

- [Next.js](https://nextjs.org/docs) 16 and [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/docs/) and
  [Tailwind CSS](https://tailwindcss.com/docs) 4
- [Vitest](https://vitest.dev/) for ERP tests
- [ESLint](https://eslint.org/docs/latest/) and
  [Prettier](https://prettier.io/docs/) for frontend quality

Next.js 16 may differ from remembered APIs. Read the relevant locally-installed
guide under the application's `node_modules/next/dist/docs/` before editing
Next.js code.

## Agent workflow

- [Entire](https://docs.entire.io/) for checkpoint history and review context
- GitHub issues through `gh`; repository label policy is documented beside this
  file
