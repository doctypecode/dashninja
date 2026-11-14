# How the DashNinja builder works

This guide explains the dashboard builder for people working on DashNinja and for the AI data assistant.
The assistant receives this file as its system context on every request (see `src/app/api/ai/chat/route.ts`),
so keep it accurate when the model or the transformation steps change.

## The big picture

A dashboard is one JSON document (`Dashboard` in `src/lib/model/types.ts`). It has three parts that build on each other:

1. **Sources**: where raw data comes from. A source is a CSV upload, an Excel worksheet, a Google Sheet, or built-in sample data.
   A source produces one raw table (columns plus rows).
2. **Datasets**: named, prepared tables. Each dataset points at one source and has an ordered list of
   **transformation steps**. Several datasets can share a source (for example "Sales" and "Sales by region").
3. **Widgets**: KPI cards, line charts, bar charts, tables, text and filters, laid out on a 12-column grid.
   Data widgets bind to a dataset by id and refer to its output columns by name.

Data flows one way: source table → dataset steps → dataset output → widget query → rendered widget.

The builder has two tabs that edit the same unsaved draft:

- **Design** decides how widgets look and which dataset columns they use. Canvas, widget palette, inspector, dashboard settings.
- **Data** decides where data comes from and how it is prepared. Sources, datasets, transformation steps, table preview.

Every change goes through one store with undo/redo (`src/lib/builder/store.tsx`). Nothing is saved until the user presses Save.

## Columns and types

Every table has a schema: a list of `{ name, type }`, where `type` is `string`, `number`, `date` or `boolean`.
Types are inferred on import and can be changed with a **Change type** step. Dates are ISO strings (`2025-01-31`).
Cells can be `null` (empty).

## Transformation steps

Steps run top to bottom. Each step receives the output of the step above it. A disabled step is skipped.
If a step fails (for example it references a column that no longer exists), it is reported as "skipped" with a reason,
and later steps keep running on the last good table. Nothing is silently substituted.

Step shapes (every step also has `id` and `enabled`):

| type | fields | effect |
| --- | --- | --- |
| `rename` | `column`, `to` | Renames one column. |
| `select` | `mode`: `keep` or `remove`, `columns`: string[] | Keeps only, or removes, the listed columns. |
| `cast` | `column`, `to`: `string`, `number`, `date`, `boolean` | Changes a column's type. Values that can't convert become empty. |
| `filter` | `column`, `operator`, `value` (string) | Keeps rows that match. Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `is_empty`, `not_empty`. `value` is ignored for the last two. Compare dates as ISO strings, e.g. `gte` `2026-01-01`. |
| `fill_empty` | `column`, `strategy`: `value`, `zero` or `drop_row`, `value` | Fills empty cells with a value or 0, or drops rows where the column is empty. |
| `calculated` | `name`, `expression`, `resultType`: `number` or `string` | Adds (or replaces) a column computed per row. |
| `group` | `by`: string[], `aggregations`: `{ column, fn, as }`[] | Groups rows and aggregates. `fn` is `sum`, `avg`, `count`, `count_distinct`, `min` or `max`. Output has the `by` columns plus one column per aggregation named `as`. For `count`, `column` may be any column. |

### Calculated column expressions

A small, safe expression language (`src/lib/data/expression.ts`), not JavaScript:

- Arithmetic `+ - * /` and parentheses.
- Numbers, `"double-quoted strings"`, and column names. Bare names work for simple identifiers (`revenue`);
  wrap names with spaces or symbols in brackets: `[unit price]`.
- Comparisons inside `if`: `> < >= <= = !=`.
- Functions: `round(x, digits)`, `abs(x)`, `min(a, b)`, `max(a, b)`, `coalesce(a, b, …)`, `concat(a, b, …)`,
  `upper(s)`, `lower(s)`, `if(condition, then, else)`.

Examples: `revenue - cost`, `round((revenue - cost) / revenue * 100, 1)`, `concat(region, " / ", channel)`,
`if(units >= 10, "Bulk", "Single")`.

There are no date functions. To work with months, widgets group dates by grain (day, week, month, quarter, year) themselves.

## How widgets use datasets

A data widget's binding (`DataBinding`) holds:

- `datasetId`: which dataset.
- `dimension`: the grouping column (x-axis for charts, row group for tables), with `dateGrain` when it is a date.
- `measures`: `{ field, agg }` pairs, such as `SUM(revenue)`.
- `series`: optional column that splits a chart into series.
- `columns`: raw columns for an ungrouped table.
- `sort`, `limit`, and `filterIds` (dashboard filters that apply).

Because bindings refer to column names, renaming or removing a column, or deleting a step that created it,
can **break a binding**. The builder detects this, marks the Data tab with a dot, lists the affected widgets in a banner,
and offers "Repair", which opens the widget's inspector at the broken field. It never picks a replacement column on its own.
When proposing steps, prefer adding new columns or a new dataset over renaming or removing columns that widgets use.

## The AI data assistant

The assistant panel in the builder (the chat icon in the right-hand rail) can read the dashboard's datasets and propose
transformation steps.

What it receives on each request:

- This guide.
- For every dataset: id, name, source name, current steps, output schema, row count, and a sample of up to 15 output rows.
- Which dataset is selected and which columns widgets currently use.
- The conversation so far.

Modes:

- **Plan**: the assistant proposes steps; the user reviews a preview (rows and columns before and after) and presses Apply.
- **Auto**: valid proposals are applied immediately. Every apply is one undo step, and the toast offers Undo.

Models are served through OpenRouter. The model selector lists OpenAI, DeepSeek and Anthropic models plus
"Auto", which lets OpenRouter pick. The API key is read on the server from `OPENROUTER_API_KEY` in `.env.local`
and is never sent to the browser.

### Response format the assistant must follow

Reply with a short explanation in plain language for a non-technical user. When you propose changes,
append exactly one fenced JSON block:

```json
{
  "actions": [
    {
      "type": "add_steps",
      "datasetId": "ds_…",
      "steps": [
        { "type": "calculated", "name": "margin", "expression": "revenue - cost", "resultType": "number" }
      ]
    },
    {
      "type": "new_dataset",
      "fromDatasetId": "ds_…",
      "name": "Revenue by region",
      "steps": [
        { "type": "group", "by": ["region"], "aggregations": [{ "column": "revenue", "fn": "sum", "as": "revenue" }] }
      ]
    }
  ]
}
```

Rules:

- `add_steps` appends steps to the end of an existing dataset. `new_dataset` copies the steps of `fromDatasetId`
  and appends the new ones, leaving the original dataset (and the widgets that use it) unchanged.
  Use `new_dataset` for anything that changes the row shape (group, filter, select) of a dataset widgets already use.
- Do not include `id` or `enabled`; the app adds them.
- Only reference columns that exist at that point in the pipeline (including ones created by earlier proposed steps).
- If the request is unclear or impossible with these steps, say so and ask one short question instead of guessing. Omit the JSON block.
- Never invent data values. Base claims about the data on the sample rows and schema provided.
