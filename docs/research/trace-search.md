# Trace search for Even

Research date: November 16, 2026. Tested against Eve `1.0.0-rc.6`, the version supported by Even, on Node `24.20.0`.

Even can make search useful by finding an operation inside a trace and taking the user directly to the evidence. Keep Eve's trace files as the source of truth and build a local, disposable search index alongside them. Reuse Eve's parsing and operation helpers; no Eve patch is required.

The important product decision is what a match means. A trace containing a tool and an error does not necessarily contain a failed call to that tool. Likewise, text repeated in a later model prompt is different from the tool result that originally produced it.

## What Eve already provides

The installed package contains useful building blocks:

| Capability | Existing Eve behavior | Work for Even |
| --- | --- | --- |
| Reading traces | OTLP JSON reader, segment discovery, assembled traces | Reuse through the version checked adapter |
| Structural filters | Agent, session, tool, and presence of error spans | Expose with clear scope |
| Sorting | Start time, elapsed duration, error span count, step input tokens | Reuse definitions and label them accurately |
| Operations | Groups tool action wrappers and execution spans into canonical operations | Reuse to avoid counting one call twice |
| Existing disk index | Marks conversation membership | Add search fields and captured text |
| Diagnostic search tool | `search_traces` searches summaries in the invoking conversation, with bounded coverage | Offer workspace search, text search, facets, and direct navigation |

`queryLocalTraceSummaries` explicitly filters whole traces. Its `failedOnly` filter means a trace contains error spans; it does not establish that the activation ultimately failed. Its totals remain trace wide after filtering.

Even's current `src/traces.js` reads assembled traces through Eve's TUI store. That remains useful for inspecting one trace. For indexing history, use Eve's lower level reader helpers with bounded batches: the TUI store retains assembled spans in memory without an eviction bound.

## Findings from actual sessions

Two isolated projects each ran five turns across four sessions, including a session started with `npx --no-install eve remote connect --print`. Each project produced five traces and 28 spans. The first session had two turns and produced two trace IDs sharing a session ID.

These used the real Eve runtime, tool execution, session streaming, and trace exporter with a deterministic local model. The model made scripted tool choices; it did not call an external model provider. The tools returned synthetic log data or threw local errors. No release was published.

| Case | Tool behavior | Observed errors |
| --- | --- | --- |
| Read logs | `read_logs` returns a log object | None |
| Mixed tools | `read_logs` succeeds; `publish_release` throws | One recorded tool error |
| Failed read | `read_logs` throws | One recorded tool error |
| Reply only | No tool call | None |
| CLI session | `read_logs` succeeds | None |

The whole trace filter for `read_logs` plus errors returned **two traces**. Requiring the error on the same canonical `read_logs` operation returned **one**. Both runs reproduced this distinction. A final agent reply was delivered even in the cases containing a tool error.

The first user message appeared as original channel input in **one trace**, but also appeared in model input snapshots in **two traces**, because the next turn included conversation history. Flattening every attribute into one searchable string would lose that distinction.

### Captured text has identifiable sources

| Meaning | Observed field | Search treatment |
| --- | --- | --- |
| Incoming user message | `agent.channel.delivery.input` | Original input when present |
| Complete model prompt | `gen_ai.input.messages` | Context, including repeated history |
| Tool arguments | `gen_ai.tool.call.arguments` | Arguments on that tool operation |
| Tool result | `gen_ai.tool.call.result` | Original tool output |
| Model reply | `gen_ai.output.messages` | Reply on that model operation |
| Error details | Span status message and exception event attributes | Error evidence; deduplicate equivalent displays |

Some fields contain serialized JSON. Parse supported message structures for readable excerpts and preserve the original field and nested location. Avoid indexing JSON keys as though they were user content. Avoid counting legacy aliases such as `ai.response.text` as additional replies.

Canonical operation helpers can merge a wrapper's error into an execution span. Preserve both the operation identity and the underlying source span/field so the inspector can explain inherited error status correctly.

### Content capture changes what can be searched

The second project ran with `EVE_TRACES_CONTENT=off`. It still produced five traces and 28 spans, with tool names, model names, timings, and error status. None of the test content markers appeared in captured fields, and detailed status messages were removed.

Metadata search must continue to work in this case. Text search should explain that content was not recorded, rather than imply that an operation never happened. Do not recover omitted content from unrelated debug logs. Development capture behavior is not a promise that production traces include the same content; respect the source trace policy.

Successful spans in these experiments commonly had status code `0` (`UNSET`). Do not treat only status code `1` as successful, or infer a finished successful trace from the absence of errors. Ended spans arrive before the entire operation lifecycle necessarily finishes.

## Five searches to design around

These are proposed product semantics, not implemented syntax. Explicit names distinguish an operation condition from a trace condition.

| Question | Example | Match rule |
| --- | --- | --- |
| Which reads failed? | `tool:read_logs tool.status:error` | Tool name and error belong to one canonical tool operation |
| Which traces used reads and encountered any error? | `tool:read_logs has:error` | Tool membership and error may belong to different operations |
| Which tools returned this error text? | `output:"ECONNRESET"` | Search original tool results; return source operation and excerpt |
| Where did I ask for this? | `input:"deploy preview"` | Search original incoming input when recorded; do not silently include model history |
| Which runs of this agent were slow? | `agent:researcher duration:>3s` | Agent membership plus elapsed trace duration |

Also expose exact trace and session identifiers. A session can return multiple traces. Distinguish the configured workspace agent identity from agent names recorded by child spans; names alone are not stable workspace keys.

Use `context:` for an explicit search of model prompts, including history, and a separate reply field if needed. Bare text can search original input, arguments, output, replies, and errors, with source labels. Avoid silently broadening it to complete prompt snapshots.

Elapsed trace duration differs from the sum of tool or model durations: parallel calls overlap. Any future operation duration filter should have its own name.

## A local search index

The proposed data path is:

```text
Eve span files
  → Eve reader and canonical operation helpers
  → Even search projection in SQLite
  → paginated matches with source span and excerpt
  → existing trace inspector focused on the match
```

SQLite offers ordinary indexed columns for exact metadata and FTS5 for text, prefixes, ranking, and excerpts. This keeps the first implementation local to the backend. [SQLite FTS5 documentation](https://www.sqlite.org/fts5.html)

| Approach | Good fit | Limitation for Even |
| --- | --- | --- |
| Scan files for every query | Early format investigation and manual debugging | Repeated parsing, growing query cost, difficult pagination |
| Keep a projection in memory | Small staging fixtures and query parser experiments | Rebuilds on restart; retained payloads grow with history |
| Persist a SQLite projection | Local metadata and text search with repeat queries | Requires ingestion, reconciliation, schema versioning, and bounded work |

Start with three logical groups of records:

- **Traces:** source workspace/agent key, trace ID, time bounds, elapsed duration, summary counts, session membership, and content availability.
- **Operations:** canonical operation ID, source span IDs, category, tool/model, status, and duration. Model multiple agents, sessions, and tools as relationships rather than comma separated strings.
- **Searchable fields:** operation and source span, field kind, attribute/event location, readable text, and content availability. Keep source provenance through snippet extraction.

Do not persist a second complete span tree. Load full trace detail through the adapter when opening a result. Results should include the trace summary, matched operation/span, field, and excerpt, so users can see why a result matched before opening it.

### Text matching needs an explicit contract

FTS word matching and substring matching behave differently. In the prototype, the default word tokenizer found `ECONNRESET` but not its middle substring `CONNRESET`. A trigram tokenizer found the middle substring, but its `MATCH` query did not find a two character search. FTS5 documents the same minimum length behavior for trigram searches. [Tokenizer documentation](https://www.sqlite.org/fts5.html#the_trigram_tokenizer)

Start with documented word and prefix search plus exact metadata filters. Test error codes, underscores, paths, Unicode, and quoted phrases before finalizing syntax. If partial path or identifier search is central to the intended workflow, add an explicit substring mode with a minimum length and query limits, rather than quietly changing word search semantics.

Parse the user query into an internal representation with known fields and validated values. Compile parameterized database queries and escaped text expressions. Do not pass the search bar directly to SQL or expose FTS operators accidentally. The input, suggestions, and any filter controls should edit one shared query state.

### Incremental ingestion and retention

Eve writes finished spans to `.eve/traces/v1/<traceId>/segments/<spanId>.otlp.json`. A trace gains new segments over time. Indexing the first segment is not sufficient to mark the entire trace finished.

1. Discover sources through the existing workspace catalog. Scope every identity by source as well as trace/span ID.
2. Enumerate trace IDs and segment filenames using Eve's reader helpers. Directory activity time can reduce polling work, but periodic enumeration must reconcile missed changes and deletions.
3. Read new segments in bounded batches. Upsert spans' derived fields idempotently and recompute affected canonical operations and trace summaries. Later spans can alter wrapper/execution pairing.
4. Commit fields, summaries, and segment checkpoints together. A crash or failed parse must not permanently mark data as indexed. Retry unreadable segments with bounds and expose incomplete coverage.
5. Remove index records when source traces are pruned or a workspace source is removed. Purge or rebuild affected records when content changes, including replacement/redaction; a filename alone is not enough to detect replacement.
6. Version the projection and rebuild it when adapter/schema rules change. Surface indexing progress, remaining work, and read failures.

The current local retention defaults are seven days, 512 MiB, and a floor of the newest 20 traces. Active and recently changed traces also receive protection, so the byte target is not a strict universal cap. The search index should follow source retention rather than become a hidden archive of removed payloads.

Node's built in SQLite worked in the tested runtime, but its `DatabaseSync` calls are synchronous and the module is release candidate status in Node 24.20.0. Put substantial ingestion/search work in a worker and verify the chosen driver against supported Node versions before adopting it. [Node 24 SQLite documentation](https://nodejs.org/download/release/v24.20.0/docs/api/sqlite.html)

## Prototype measurements

The SQLite proof reproduced the real five trace results, including the two versus one failed tool distinction, three original matching tool outputs, and one original user input versus two traces containing copied prompt context.

A separate bulk test repeated those five trace templates to create **10,000 traces, 28,000 canonical operations, and 86,000 searchable fields**. Its database occupied approximately **36.3 MiB**. On this machine, median warm query times across 50 measured runs were:

| Query | Median | Result |
| --- | --- | --- |
| Count failed `read_logs` operations' distinct traces | 0.045 ms | 2,000 traces |
| Count distinct traces with `ECONNRESET` in original tool output | 7.21 ms | 6,000 traces |
| First 50 matching output fields with excerpts | 0.109 ms | 50 fields |

The single transaction bulk build took about 221 ms. These measurements use short, repeated synthetic payloads and a warm cache; they exclude filesystem discovery, OTLP parsing, network/API work, and UI rendering. They establish that this approach is plausible, not a production capacity or latency guarantee. The first page query used insertion order rather than final recency/relevance ordering, and returned fields rather than a fully deduplicated trace page.

Aggregate results are preserved in [trace-search-evidence.json](trace-search-evidence.json). Raw synthetic traces and runnable experiment scripts remain in temporary directories; they are not application fixtures or runtime code.

## Suggested build order

1. Agree on the five search meanings above. Prototype suggestions and match explanations against staging fixtures, including the mixed tool error and repeated history cases.
2. Build the backend projection and query contract using Eve helpers. Verify restart/rebuild, duplicate ingestion, later segments, missing content, malformed files, and retention deletion.
3. Connect the search bar to paginated summaries with match provenance. Open the inspector at the relevant span and field.
4. Add query dependent facets, recent searches, and shareable query URLs. Consider substring or semantic search only after actual queries expose the need.

The defining interaction should be: **ask a precise question, understand why a trace matched, and land on the relevant operation immediately.**

## Primary implementation references

Eve source findings refer to the installed `eve@1.0.0-rc.6` distribution, not the latest online release:

- `dist/src/tracing/local/trace-reader.{js,d.ts}` — segment discovery, parsing, timestamps, attributes, events.
- `dist/src/tracing/local/trace-summary.{js,d.ts}` and `trace-query.{js,d.ts}` — summary definitions and whole trace filter semantics.
- `dist/src/tracing/local/trace-operations.{js,d.ts}` — canonical operations and session/tool/model lookup.
- `dist/src/tracing/local/trace-span-processor.js`, `trace-discovery-index.js`, and `trace-retention.js` — writing, conversation markers, pruning.
- `dist/src/cli/dev/tui/traces/trace-store.js` — assembled trace cache.
- `dist/src/self-modification/extension/subagents/agent/tools/search_traces.js` — conversation scoped diagnostic search and coverage limits.
- `docs/guides/instrumentation/instrumentation.mdx` and `dist/src/tracing/local/traces.js` — content policy and local capture override.

The installed package identifies its source repository as [vercel/eve](https://github.com/vercel/eve).
