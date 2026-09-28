# List editing behavior

This is the keyboard contract for lists in both Live Preview and Markdown source mode. It follows
Obsidian's [list nesting](https://obsidian.md/help/syntax#Nesting%20lists),
[line break](https://obsidian.md/help/syntax#Line%20breaks), and
[smart list](https://obsidian.md/help/settings) conventions. The source remains ordinary Markdown.

| Cursor context                        | Enter                                                                                            | Shift+Enter                                                                      | Tab                                                                                           | Shift+Tab                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Item with text                        | Start a sibling at the same depth. Numbered markers advance; task checkboxes reset to `[ ]`.     | Add a hard line break inside this item and align the continuation with its text. | Move the whole item, its continuation lines, and its descendants under the preceding sibling. | Move the same subtree out one level.                  |
| Continuation line                     | Start a sibling of its owning item. On a blank continuation, remove unused hard break spaces.    | Add another break inside the same item.                                          | Move the owning item and its subtree.                                                         | Move the owning item and its subtree out.             |
| Empty item                            | Step out one level, or leave the list at the root. An empty parent with children stays in place. | Start a continuation within the item.                                            | Same item movement as above.                                                                  | Same item movement as above.                          |
| Selected sibling items                | Standard text replacement.                                                                       | Standard text replacement.                                                       | Move the selected items and each item's descendants together.                                 | Move the selected items and descendants out together. |
| Outside a list, including code blocks | Use CodeMirror's normal Markdown behavior.                                                       | Use normal text editing.                                                         | Use normal indentation.                                                                       | Use normal outdent.                                   |

Tab stops when an item has no preceding sibling at its current depth. Repeated Tab presses cannot
turn a list item or its continuation into an indented code block. Shift+Tab stops at the root.
Selections that mix items from different depths without selecting their common parent stay in place
so a partial subtree is never moved by surprise.
Indentation uses four spaces per level, or enough spaces to clear a wider ordered marker such as
`100. `. Numbered lists keep their top-level starting number, restart nested lists at `1.`, and
renumber siblings after structural edits.

In Live Preview, Left and Right cross the leading indentation of a list item or continuation line
in one step. The marker and its following space stay reachable for direct editing. Source mode keeps
character-by-character navigation.

The sequence `Shift+Enter → Tab → Tab → type → Enter` moves the complete item once, leaves the
second Tab as a no-op when there is no deeper parent, and creates a sibling at the nested depth.
The same rules apply when the item contains a task checkbox or nested children. Tests for these
transitions live in `src/lib/editor/features/list/commands.test.ts`.
