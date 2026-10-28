# LedgerClean browser check

Build and run the application locally, then create a fresh isolated browser:

```sh
playwright-cli -s=ledgerclean-rules-final open http://127.0.0.1:5173/tools/ledgerclean --browser=chrome
playwright-cli -s=ledgerclean-rules-final run-code --filename=scripts/ledgerclean-rules/check-browser.js
```

The script refuses an existing imported workspace. It uses ten public synthetic transactions to verify starters, one-transaction exceptions, merchant references and account scopes, regex errors, overlapping rules, ordering, disabling/deleting starters, reload, backup/restore, portable rule import, stale-preview protection, offline editing, and mobile page width. It writes synthetic JSON downloads and desktop/mobile screenshots under `/private/tmp/ledgerclean-rules-*` for inspection. Close the isolated session and remove those temporary artifacts after review.

Unit tests cover pure matching and previews, corrupt file rejection, legacy migration, IndexedDB save ordering, and portable custom rules. This browser check exercises the production interface without real financial data or provider credentials.
