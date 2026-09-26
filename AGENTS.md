# Working in this project

A reviewed Next.js App Router starter. It builds and runs as-is; `app/page.tsx` is a placeholder
meant to be replaced by the product you are asked for.

Read this instead of exploring. It is the whole setup.

## What this project is for

A single-page web app that saves its data in the visitor's browser.

Good for: trackers and planners; calculators and converters; dashboards over data you bring; small tools and games.

Not built for: sharing data between people or devices (data stays in one browser); accounts or sign-in; calling outside services or APIs.

A request that needs one of these is outside what this project can deliver as it stands: plan the closest thing it can, and say plainly what was left out.

## Stack

Next.js App Router · TypeScript · Tailwind CSS · shadcn/ui · 14 shadcn/ui components pre-installed (dialog, select, table, card, form inputs, tabs, alert) · Dexie (browser database, device-local) · TanStack Query · TanStack Table.

## Layout

```
app/layout.tsx              root layout — <html>/<body> and <Providers>. Set metadata here.
app/page.tsx                the placeholder. Replace it.
app/globals.css             Tailwind entry, the design tokens, and the two base rules.
app/providers.tsx           "use client" — composed from this project's modules. Already wired into layout.
types/webgpu.d.ts           WebGPU type reference. See "Graphics" below.
template.capabilities.json  what this template ships, declared for the planner. Keep it accurate.
components/ui/              the shadcn components, already themed. See docs/components.md.
lib/utils.ts                cn() — the className merge helper every shadcn component expects.
components.json             shadcn config: new-york, neutral, rsc, aliases @/components and @/lib.
lib/storage/                the shared storage package, vendored in. Do NOT edit; see docs/storage.md.
lib/db.ts                   THIS app's database schema. Tables, indexes, versions. Edit this.
lib/data/<name>.ts          THIS app's queries. Components call these, never Dexie directly. Create it.
```

`@/*` resolves to the project root (`tsconfig.json` paths). Import as `@/components/ui/button`.

**That list is the entire project.** There is nothing else to discover, so do not spend steps
exploring for it. If you want to see the conventions before writing, the ones worth opening are
`app/layout.tsx`, `app/page.tsx`, `app/globals.css` and `package.json`.

## What this project ships

Each of these is already installed and already wired up. **Read the document before building on
one** — it carries the worked code, so you do not have to derive it, and it says what the thing
cannot do as well as what it can.

- **Component kit.** 14 shadcn/ui components, the design tokens they need, and the cn() helper. Read `docs/components.md` before building on it.
- **Browser storage.** Dexie over IndexedDB, already set up: schemas, seeding, live queries and export/import. Data lives in one browser on one device — no sync, no sharing between visitors, no server copy. Read `docs/storage.md` before building on it.

Nothing outside the stack above is set up. In particular, unless a document above says otherwise,
there is no backend datastore, no authentication and no external API.

## Conventions

**Server components by default.** Add `"use client"` only to files that need state, effects,
event handlers or browser APIs. Keep the client boundary as low in the tree as you can — a page
can stay a server component with an interactive child island.

**Tailwind v4 has no `tailwind.config.js`.** Configuration lives in CSS. Add design tokens with
`@theme` in `app/globals.css`; there is no JS config file to edit and creating one does nothing.

**Dependencies.** `npm install <pkg>` works — there is a real shell with network access. Install
what the task genuinely needs rather than reimplementing it, and prefer a package that ships its
own types. A large fixed dataset still belongs in its own module under `lib/`, separate from the
component that renders it.

## Graphics

`types/webgpu.d.ts` provides WebGPU types. If *What this project ships* above lists Canvas and 3D,
use `CanvasStage` and `three` as `docs/graphics.md` says; otherwise no graphics library is
installed, Canvas 2D and WebGL work, and `npm install three` if you want a scene graph.

**The browser used to verify your work runs headless with no GPU** — but it does have WebGL.
Measured there: WebGL 1 and WebGL 2 both give a real context and real pixels, through a software
rasteriser that is roughly an order of magnitude slower than hardware, so budget a few thousand
triangles rather than a million. `navigator.gpu` is **absent**, so nothing may require WebGPU.

Anything gated behind a context that might fail must still degrade to something visible rather
than a blank canvas, or verification sees an empty page: give it a static fallback frame and a
readable message, rendered on the server so the route has text either way.

## How this is checked

After you finish, in this order:

```
npm install
npm test --if-present
npm run lint --if-present
npm run build
```

Then a headless Chromium opens the built app and records console errors, uncaught exceptions,
failed requests and the rendered text of each route it finds. A page that renders nothing, or
throws on mount, fails the run even when `npm run build` passed.

**It then uses the app, it does not only look at it.** On every route it presses the primary
action — the button whose label starts with "add", "new", "create" or "+", falling back to the
first button that is not destructive — fills whatever dialog or form that opens, submits it, and
reloads the page. **An error thrown while the app is being used fails the run**, reported
separately from an error on load, because the two live in different files. The reload is the
storage check: what the probe added is looked for again afterwards.

Nothing labelled "delete", "clear", "reset", "export", "import" or "sign out" is ever pressed, so
the probe cannot empty the list it is inspecting. That has one consequence for you: **the way into
your main flow must be a plain, visible, enabled button with an honest label.** A primary action
that is an icon with no `aria-label`, or that only appears after some other interaction, is a flow
the check cannot reach — it will not fail you for that, but nothing behind it gets verified either.

`npm run build` passing is not evidence the product works — the untouched starter passes all four
checks. Neither is a page that renders: a tracker whose "Add" button throws renders perfectly.
What is judged is the running application, being used.

## Do not

- **Do not scaffold a new application over this one.** No `create-next-app`, no second `app/`
  directory. Build on what is here.
- **Do not run a dev server.** `next dev` / `npm run dev` are blocked. Use `npm run build` to
  check your work compiles.
- **Do not install Playwright, Puppeteer or Selenium.** Browser automation is blocked; the
  verification step above is how the page gets opened.
- **Do not reimplement something this project already ships.** Every item under "What this project
  ships" is installed, wired up and documented; a second library doing the same job is wasted
  steps and a second source of truth.
- **Do not promise anything the documents above say is impossible.** A screen offering sharing or
  cross-device sync on a device-local database is a screen that lies to the person using it.
- **Do not delete this file**, any document named above, or `template.capabilities.json`. The
  first two are the briefing for every later task on this repository; the third is how the planner
  knows what this project can do before it writes a single criterion.
