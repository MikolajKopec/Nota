---
name: todoist
description: Manage Todoist tasks. Use when the user mentions "todoist", "my tasks", "task list", "add a task", "complete task", or wants to interact with their Todoist account.
---

# Todoist Integration

Manage tasks via `td` CLI (@doist/todoist-cli, installed as npm dependency).

`td` is available in PATH (added via node_modules/.bin).

## Common Operations

### List Tasks

```bash
# Today's agenda (includes overdue)
td today

# Upcoming 7 days
td upcoming

# All tasks
td task list

# By project
td task list --project "Work"

# By priority
td task list --priority p1

# By label
td task list --label "urgent"

# By due date
td task list --due today

# Raw Todoist filter query
td task list --filter "p1 & (today | overdue)"

# Inbox only
td inbox
```

### Add Tasks

Quick add (natural language — handles dates, projects, priorities, labels):
```bash
td add "Buy milk tomorrow p1 #Shopping"
td add "Review PR #Work @urgent"
td add "Call mom next Monday"
```

Structured add:
```bash
td task add --content "Prepare quarterly report" \
  --project "Work" \
  --priority p1 \
  --due "friday" \
  --description "Include sales metrics and customer feedback summary" \
  --labels "urgent,reports"
```

Options for `task add`:
- `--content` - task title (required)
- `--project` - project name or id:xxx
- `--priority` - p1 (highest) to p4 (lowest)
- `--due` - due date (natural language or YYYY-MM-DD)
- `--deadline` - hard deadline (YYYY-MM-DD)
- `--labels` - comma-separated labels
- `--description` - task notes
- `--section` - section ID
- `--parent` - parent task ref (creates subtask)
- `--duration` - estimated duration (30m, 1h, 2h15m)
- `--assignee` - assign to user (name, email, id:xxx, or "me")

### Complete Tasks

```bash
td task complete <ref>
td task complete <ref> --forever    # End recurring task permanently
```

### Update Tasks

```bash
td task update <ref> --content "New title"
td task update <ref> --due "tomorrow"
td task update <ref> --priority p1
td task update <ref> --labels "urgent,work"
td task update <ref> --description "Updated notes"
```

### View Task Details

```bash
td task view <ref>
```

### Delete Tasks

```bash
td task delete <ref>
```

### Reopen Completed Tasks

```bash
td task uncomplete <ref>
```

### Move Tasks

```bash
td task move <ref> --project "Work"
td task move <ref> --section <id>
td task move <ref> --parent <ref>
```

## Projects & Labels

```bash
# Projects
td project list
td project create --name "New Project"
td project view <ref>
td project delete <ref>

# Labels
td label list
td label create --name "urgent"
td label delete <name>
```

## Other Commands

```bash
td completed                 # Show completed tasks
td stats                     # Productivity stats & karma
td activity                  # Activity log
td reminder list             # List reminders
td auth status               # Check auth status
```

## Output Flags

Use on any read command for machine-readable output:
- `--json` - JSON output (essential fields)
- `--ndjson` - newline-delimited JSON
- `--full` - include all fields in JSON
- `--raw` - disable markdown rendering
- `--show-urls` - show web app URLs

## Filter Syntax

Use with `td task list --filter "..."`:
- `today`, `tomorrow`, `overdue`, `no date`, `7 days`
- `p1`, `p2`, `p3`, `p4`
- `#Project`, `@label`
- `&` (AND), `|` (OR), `!` (NOT), `()` (grouping)

Examples:
- `"p1 & (today | overdue)"` — urgent + due/overdue
- `"@work & 7 days"` — work tasks due in 7 days
- `"!#Inbox"` — tasks not in Inbox

## Workflow Tips

1. **Morning review**: `td today`
2. **Quick capture**: `td add "thing to do"`
3. **Weekly view**: `td upcoming 7`
4. **Completed review**: `td completed`
