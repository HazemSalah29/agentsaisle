# The inside view

`code-map.mjs` lets the page open one component into its functions, React components, hooks, Next.js route handlers and tRPC procedures. It reads JavaScript and TypeScript (`.js .jsx .ts .tsx .mjs .cjs`) as text with a parser bundled in `assets/vendor/`. It never runs or imports project code and never touches the network. Same input, same output.

## Run it

```
node <skill>/scripts/code-map.mjs --root . --model docs/architecture.json \
  --attach web=apps/web,api=packages/trpc --focus apps/web/components/Booking.tsx --depth 4 --max-symbols 60
```

- `--attach node=folder[,node=folder]` puts the symbols found under each folder on that node of the model, sets the model to version 3 and fills `edges[].via` with the calls that implement each connection. `--attach web` (no folder) puts everything on one node.
- `--dir a,b` adds folders to read without attaching them (so calls into them still resolve).
- `--focus file[,file]` keeps what those files reach through calls, renders, fetches and tRPC calls, nearest first. `file#name` focuses one symbol. `--depth` (1 to 8, default 4) limits how far. Without `--focus`, the most connected symbols are kept, which tends to be shared helpers: prefer a focus.
- `--max-symbols` (1 to 200, default 40) caps what is kept. Left-out links are counted as `hiddenCalls`, never drawn to nothing.
- `--out file` writes the same result to a file. Without `--attach` that is the only output.

Prints at most 40 lines. It reads at most 10,000 source files and skips tests, stories, `.d.ts`, `node_modules`, secret-named files and files over 2 MB.

## What it understands

| Found                                                      | Shown as                                           |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `function f`, `const f = () => ...`, `memo`/`forwardRef`   | function, or component when it returns JSX         |
| `useX`                                                     | hook                                               |
| Class methods                                              | method                                             |
| `app/**/route.ts` handlers, `pages/api/*`                  | route, with its path and method                    |
| `proc.input(...).query(...)`, `.mutation(...)` in a router | tRPC procedure, with a path taken from the folder  |
| `<Component />` with the import it came from               | a "renders" link to that file                      |
| `fetch("/api/x")`, `axios.get("/api/x")`                   | linked to the route that serves that path          |
| `trpc.a.b.useQuery()` / `.useMutation()`                   | linked to the procedure with the same path         |
| Calls in a `for`/`while` or a `.map()` callback            | `loop`; inside `if`, `?:`, `switch`, `catch`: `if` |

Imports resolve through relative paths, `tsconfig` `paths` (also through `extends`), workspace packages and barrel files, and `const { x } = await import("./y")`.

## Honest limits

- A call is linked only when its name resolves to a symbol in the folders read. Dynamic calls, callbacks passed around, `this` in unusual places and anything built at run time are missed. A missing link is shown as an "also uses" line, not guessed.
- tRPC and fetch links are matched by path and are marked as inferred (`sym.inferred`, "matched by name, not proved"). A tRPC path comes from the router file's folder layout, so a project that builds its router differently gets unlinked calls.
- Python, Go, Elixir, Haskell and other languages are not read: a node written in them gets no inside view.
- Workspace packages resolve by folder, not by their `exports` or `main` fields.
- A description is the first sentence of the comment above the symbol. A comment that looks like a credential is dropped. Without a comment there is no description; do not invent one for every symbol.

## Descriptions you write

At most 30 per component, only for symbols that matter and have no comment. One sentence, at most 160 characters, from what the code shows (never from guesses about intent). Set `"doc"` and `"docBy": "agent"` on the symbol; the page then says "Written by the agent from reading the code." The checker refuses more than 30, and it refuses a model with more than 600 symbols in all.

## What the page does with it

A component with an inside shows a count. Double-click it, press `Z`, or use **Zoom in** in the panel: the camera moves in while the system diagram fades out. Inside, a list on the left filters by name, file or description; the diagram shows call depth left to right with files as boxes; the table at the bottom lists the selected function's calls in order, with Step, Play and Back. `Esc` goes back one level. Export always saves the system diagram. The address keeps the open component and symbol (`#in=<node>&sym=<file>#<name>`).
