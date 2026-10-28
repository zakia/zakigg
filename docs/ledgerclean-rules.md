# LedgerClean rules

Agreed product behavior:

- Remove AI categorization, model downloads, suggestions, and confidence controls.
- Categorize transactions locally using rules. Specific transaction exceptions win over exact-description/merchant-prefix rules, which win over general word, substring, and regex patterns. Within each specificity group, visible rule order decides the winner.
- Preserve transfer/exclusion handling, existing manual rules, historical approved assignments, stable transaction identities, category editing, tags, merchant grouping, and import behavior.
- Ship a conservative, enabled, versioned starter set with known merchants and word patterns. Unknown merchants remain Uncategorized. Starter rules are editable, disableable, and removable without resurrecting on reload.
- Provide an approachable editor with category/tag assignment, matching scopes, matching transaction previews, changed assignments, protected exceptions, and overlapping-rule explanations before saving.
- Keep personal workspaces in the browser, with full workspace backup/restore and portable rule export/import. Rules shipped with the application live in repository files. No server database or account is required.
- Changing a ledger category explicitly offers this transaction versus a reusable merchant rule; choosing one transaction must never modify all merchants caught by a broad pattern.

Verification focuses on matcher precedence and word boundaries, persistent starter customization, legacy workspace migration, portable import validation, protected transaction exceptions and financial activity, and the complete browser editing/backup flow. User data and unrelated workspace changes must remain intact.
