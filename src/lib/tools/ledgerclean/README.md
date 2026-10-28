# LedgerClean

Local budgeting workspace at `/tools/ledgerclean`. CSV imports, categorization, categories, rules, tags, charts, and backups run in the browser. There is no AI runtime, model download, account, server categorization, or external API.

## Categorization

Categories are derived from reusable rules and explicit transaction exceptions:

1. Declared transfers retain their financial treatment; excluded rows remain outside budget totals.
2. A transaction exception assigns a category to one transaction.
3. Merchant rules match an exact description or a stable merchant prefix at a word boundary.
4. Pattern rules match whole words/phrases, text substrings, RE2 regular expressions, or bank-category labels.
5. Without a match, money out remains Uncategorized, ordinary money in defaults to Income, and card credits offset spending.

Within each specificity group, the first matching enabled rule wins. The same ordering drives the Rules table, editor previews, and actual categorization. Regex length and historical rule source never determine priority. Bank-category label rules belong to the general pattern group. Tags are inherited from the winning rule and combined with transaction tag overrides.

`starter-rules.ts` contains versioned, conservative, enabled defaults: known merchants and words such as coffee/café, restaurant/bar, pharmacy, dental, and grocery. Whole-word matching uses Unicode letter/number boundaries, so BAR does not match BARBER. Multiword phrases are literal; commas separate alternatives. Unknown merchants remain Uncategorized. Starter edits, ordering, disabled state, and deletions persist; defaults are never reinserted during an ordinary reload.

## Product flow

Recognized CSVs import immediately. A focused exception screen asks only for unresolved columns, amount signs, numeric date order, or account identity. Confirmed profiles are remembered per header layout. Invalid rows are reported, duplicate imports preserve the largest observed occurrence count, and imports have Undo. Transaction IDs, original descriptions, account/currency, signed integer amounts, and transaction multiplicity remain stable.

**Overview** combines monthly/yearly spending charts, KPIs, filters, and the searchable ledger. Every row explains its assignment. Changing a category creates a transaction exception and offers **Make merchant rule…** and Undo. Making a merchant rule opens a preview and releases only that transaction's exception on save; other exceptions stay intact. **Use rules** removes a transaction exception.

**Merchants & rules** separates actual merchant groups from reusable predicates. Merchants group only stable prefixes supported by differing observed reference codes; generic processors stay exact. Selecting merchants creates a shared rule; changing a merchant category opens the same editor. The Rules tab exposes saved order, enabled state, starter/personal origin, match counts, category/tags, editing, deletion, and priority controls. Tables paginate and transaction details render lazily.

The editor supports whole words/phrases, merchant prefixes, exact descriptions, text substrings, and case-insensitive RE2 regex. Category and tag defaults share the existing pickers. Matching scopes include description versus bank category, account type, money direction, and spending/card refunds only. Previews show matching rows, resulting categories, overlapping predicates and the winning rule, changed assignments, and protected exceptions/transfers. New rules start first in their specificity group; editing retains position. Enabling, disabling, deleting, and reordering also require a preview.

**Settings** owns categories, tags, local workspace backup/restore, portable rules, starter reset, and imported statements. Workspace restore replaces data only after validation and an explicit summary; exporting the current workspace remains available first. Rule imports merge after preview, replacing identical predicates and preserving unrelated rules. Starter reset previews the result, preserves personal rules and transaction exceptions, and resets only shipped-rule customizations.

## Storage and migration

`workspace-db.ts` stores version 5 workspaces in IndexedDB (`ledgerclean`, store `workspace`, key `current`). Saves are serialized in order so an older asynchronous write cannot overwrite a later edit. Rule actions wait for the write before reporting completion; the workspace shows saving status and protects navigation while changes remain unsaved. Raw transaction facts and explicit exceptions are persisted; computed categories are rederived using the same matcher. No data is sent to a server.

On first load, `workspace-storage.ts` validates and upgrades version 1–4 workspaces from the old `ledgerclean:workspace:v1` localStorage key. It preserves category/tag IDs, import profiles, manual rules, historical approved rules and transaction exceptions. Legacy AI settings are discarded. Old unversioned presets are replaced once with the current starter set. A starter that would displace an existing categorization is initially disabled. Legacy rule order is migrated from the old precedence; where the new merchant-versus-pattern policy would still change a historical assignment, that assignment is preserved as a transaction exception. The legacy key is removed only after the database save succeeds. Invalid saved data is preserved and persistence remains blocked until the user explicitly replaces it. Retired model cache entries are removed by URL without touching other models or the app shell.

Full JSON workspace backups include facts, categories, rules, tags, profiles, imports, and transaction exceptions. Portable rule JSON includes categories, tags, rule order, scopes, and enabled state, omitting transaction IDs and exceptions. Imported files are strictly validated before changing data. Browser data can be cleared or evicted, so backups are part of the local workflow.

## Ownership

- `processing.ts`: CSV parsing, normalization, deterministic matcher, projection, filtering, totals, and CSV export.
- `rule-pattern.ts`: shared RE2 validation, Unicode word/phrase matching, and linear-time regex execution. Lookaround and backreferences are unsupported.
- `starter-rules.ts`: shipped rule definitions and version.
- `rules.ts`: explicit ordering, rule editing/movement, assignment explanations, and change previews.
- `RuleWorkspace.svelte` / `RuleEditor.svelte` / `RulePreview.svelte`: merchant/rule organization, the shared editor, and preview presentation.
- `merchants.ts` / `merchant-workspace.ts`: reference-based merchant grouping, shared-pattern creation, spending summaries, and legacy grouping validation.
- `merchant-rules.ts` / `confidence.ts`: compatibility for historical approved rules during migration; no inference or confidence UI.
- `workspace-storage.ts`: strict schemas, raw-fact serialization, and legacy migration.
- `workspace-db.ts`: browser persistence and ordered writes.
- `workspace-files.ts` / `WorkspaceData.svelte`: portable files, validation, restore/merge previews, and backups.
- `activity.ts`: transfer detection, account activity, and budget inclusion.
- `category-model.ts` / `categories.ts`: stable category IDs and editable spending hierarchy.
- `tags.ts` / `recurring.ts`: independent purpose/context tags, transaction overrides, and conservative recurring-series detection.
- `identity.ts` / `import-inference.ts`: stable import identity, overlap multiplicity, import proposals, and remembered profiles.
- `index.svelte`: workspace ownership, navigation, imports, overview, rule application, transaction exceptions, and settings.

## Verification

Run targeted tests while changing matching, storage, or import behavior, then `bun run test`, `bun run check`, targeted ESLint/Prettier, and `bun run build`. Verify browser flows using an isolated synthetic workspace, including merchant rules, one-transaction exceptions, overlapping patterns, invalid regex, ordering, starter customization, reload, portable files, legacy migration, and responsive layout. No real transaction data or provider credentials are used in verification.
