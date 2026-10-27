---
name: debriefs
description: Check, answer, create or ingest HiON debriefs on the Monday.com "Debriefs" board (HFG HQ). Use on /debriefs, "check my debriefs", "any debriefs for me", "answer my debriefs", "new debrief for <person>", "ingest debriefs", or when the daily debriefs-check scheduled task runs. Needs the monday.com connector.
---

# Debriefs (Monday board 18437343225)

A debrief is a short multiple-choice questionnaire from Will (drafted with Claude) to one person,
answered in two minutes, then ingested into the 2nd Brain. The Monday doc **Debriefs · Protocol**
(doc object id 18437346093, https://hionev-company.monday.com/docs/18437346093) is the authority;
this skill is its Claude Code shortcut. If the two disagree, the doc wins. Read the doc with the
Monday `read_docs` tool (type `object_ids`) when anything here looks stale.

## Modes

| Said | Do |
|---|---|
| `/debriefs`, `/debriefs check`, "check my debriefs" | **check**: list my open debriefs, write the badge file (the daily routine does only this) |
| `/debriefs answer`, "answer my debriefs", "let's knock them out" | **check**, then **answer** |
| `/debriefs new <person>`, "new debrief for Tony" | **new** (the asker's mode, normally Will) |
| `/debriefs ingest`, "ingest debriefs" | **ingest** (Will's mode) |

## Board facts

- Board **18437343225** (Debriefs), workspace HFG HQ 14122741. Groups are stages: Open `topics` · Answered `group_mm8h43qe` · Ingested `group_mm8h8drj`.
- Debrief (item) columns: `name` · `person` (people) · `stage` (status; label ids Open = 0, Answered = 7, Ingested = 1) · `due_on` (date) · `why` (long text) · `source` (text) · Questions (subitems column `subtasks_mm8ht4ka`, subitem board 18437345719) · `answered_on` · `ingested_on` · `brain_note` (link) · `asked` (creation log).
- Question (subitem) columns: `name` = the question · `order` (number) · `why` (Why it matters) · `options` (long text, one per line `A) Label — description`) · `answer` (status: A · B · C · D · Other · Don't know · Wrong person) · `note` (long text) · `answered_on` (date) · `via` (status: Claude · Monday) · `keep_out` (checkbox).
- The subitem board id is **18437345719** (also in `get_board_info` → the Questions column's `settings.boardIds`). Writes to questions go to that board id.
- People: Tony Cuomo 56801059 · Jim Frank 45141180 · Joe Frank 56308036 · Joe Lewis 113017808 · Will Frank 55790832.
- Automations already handle: notify the person when a debrief lands; stamp dates, move groups and notify Will when Stage changes; remind on the due date. Never duplicate those by hand.

## check

1. `get_board_items_page` boardId 18437343225, `includeColumns` true, `includeSubItems` true, `subItemLimit` 50, filters:
   `[{"columnId":"person","operator":"any_of","compareValue":["assigned_to_me"]},{"columnId":"stage","operator":"any_of","compareValue":[0]}]`.
2. An open question is a subitem whose `answer` is empty. Count open debriefs and open questions.
3. Write `~/.claude/debriefs/state.json` (create the folder):
   `{"checked_at":"<ISO now>","open_debriefs":N,"open_questions":M,"items":[{"id":"<item id>","name":"<name>","due":"<YYYY-MM-DD or null>","open":<open questions>}]}`.
   The band above the prompt reads this file; zero means no band.
4. Say one line: "N open debriefs, M questions waiting" or "No open debriefs."

## answer

For each open debrief, earliest Due first:

1. One line: its name · why this debrief · due. Once per session: "Type keep out in any answer to keep it out of the brain."
2. Ask the open questions in `order`, up to four per `AskUserQuestion` call: header `Q<n> of <total>`; question = the subitem name, then `Why: <why it matters>`; options = the lines of `options` (label = text before the dash, description = text after it; two to four); `multiSelect` false. The built-in free-text answer is where Other, Don't know, Wrong person and keep-out arrive.
3. Map a free-text answer: a letter or an option's label → that letter · "don't know", "dk", "no idea" → **Don't know** · "ask <name>", "wrong person", "<name> should answer" → **Wrong person**, Note = the name · text containing "keep out", "private" or "off the record" → tick `keep_out` and use the rest of the text for the Answer · anything else → **Other**, Note = the text.
4. After every batch, write with `update_items` (boardId = the subitem board): `{"answer":{"label":"B"},"note":{"text":"..."},"answered_on":{"date":"YYYY-MM-DD"},"via":{"label":"Claude"}}` plus `"keep_out":{"checked":"true"}` when asked. **Never overwrite a non-empty `answer`.**
5. When every question of a debrief has an Answer: `change_item_column_values` on the debrief: `{"stage":{"label":"Answered"}}`. The automations stamp the date, move the row and notify Will.
6. Finish: "N answers logged in Monday; Will is notified." Then run **check** again so the badge file goes to zero.

Idempotent by construction: running twice asks nothing new, because the key is each question's own id and its empty Answer, never its position in the list.

## new <person>

Draft with the asker, then show the whole draft and get a tap of approval before creating anything.

- Name: the topic, Title Case, under 80 characters, no period. Why this debrief: 1 to 3 sentences. Source: the vault note path(s) it came from, or blank; several go in question order separated by ` · ` (a bare filename sits in the previous entry's folder; a `(q4, q5)` suffix names the questions an entry serves when it is not one-per-question). Due: today + 3 days unless told otherwise.
- As many questions as the topic needs (Will's ruling 2026-10-27: no cap; they are asked four per screen). Each: ONE sentence ending in `?`, under 200 characters (the briefing goes in Why it matters, never in the question); Why it matters: 1 to 2 sentences; two to four options, **never invented**: only choices the question itself names, or yes/no. Options cell = one per line, `A) Label — description`.
- Create: `create_items` on 18437343225, one item in group `topics` with `person`, `stage` Open, `due_on`, `why`, `source`; then the questions as subitems (`parentItemId`) with `name`, `order`, `why`, `options`. Monday notifies the person on creation.
- Tone: facts, the ask, why it matters. Never a characterization of a colleague.

## ingest (Will)

1. `get_board_items_page` filter `stage` any_of [7] with subitems and columns.
2. Resolve each question's source first: when Source holds several ` · `-separated entries, a `(q…)` suffix names the questions an entry serves, otherwise entries map by order, and on a count mismatch every question takes the first entry (a bare filename sits in the previous entry's folder). Then for every question with an Answer of A, B, C, D or Other and `keep_out` unticked, write one vault note to `~/Projects/HiON/2nd Brain/sources/debriefs/YYYY-MM-DD-monday-<item id>-q<order>.md` with this contract (the hion-os publisher's):

   ```
   ---
   source_type: debrief
   date: YYYY-MM-DD
   submitted_by: <Person's name>
   tag: monday-<item id>-q<order>
   gap: <the question's source entry if set, else the debrief name>
   answer_id: monday-<subitem id>
   answer_kind: human
   source_note: <the question's source entry when it is a vault-relative path>
   ---
   # <the question>

   > <why it matters>

   ## Answer

   **<option label, or Other>**

   <note text>

   Answer in Monday: <item url>

   Answers the open question in [[<source note path without .md>]]
   ```
   Skip Don't know and Wrong person and any `keep_out` question; list them in the report. For Wrong person with a name, **create the follow-up debrief for that person automatically** (Will's ruling 2026-10-27): same question, same why it matters, same Source, due today + 3, and say so in the report.
3. In the vault: `git add sources/debriefs && git commit -m "Debriefs: ingest <debrief name>"` (the vault also auto-syncs).
4. Set `brain_note` `{"url":"<GitHub blob URL of the first note>","text":"<file name>"}` and `stage` Ingested on the debrief. A debrief whose every answer was kept out still becomes Ingested, with `brain_note` blank.
