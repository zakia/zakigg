# Project glossary

## Markdown editor

**Document**:
A piece of authored content stored under a key, with complete Markdown source including any YAML frontmatter.

**Properties**:
The authored metadata in a document's YAML frontmatter. Other representations of those properties are derived from the source.

**Editing session**:
The ongoing work on one document, including its current source, unsaved changes, and explicit saves to the backing store.

**Attachment**:
A binary file referenced by a document, such as an image, video, audio clip, or downloadable file. Its content is stored separately from the document's Markdown.

## LedgerClean

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
