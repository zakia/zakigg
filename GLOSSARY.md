# LedgerClean

LedgerClean organizes imported financial transactions using reusable rules and explicit exceptions.

## Language

**Transaction**:
A single imported financial event. Identical-looking purchases can still be separate transactions.

**Merchant**:
The payee identified by a transaction description. A merchant can have many transactions with different reference numbers.

**Merchant rule**:
A reusable category and tag assignment for one exact description or a stable merchant prefix. It applies to matching current and future transactions.

**Pattern rule**:
A reusable category and tag assignment based on words, a substring, or a regular expression. It can match several merchants.

**Transaction exception**:
An explicit category assignment for one transaction that takes precedence over reusable categorization rules. It does not change future transactions.

**Starter rule**:
A shipped merchant or pattern rule that is enabled initially and can be edited, disabled, or removed.

**Rule order**:
The user-controlled order for choosing among matching rules of the same specificity. Transaction exceptions take precedence over merchant rules, which take precedence over pattern rules.
