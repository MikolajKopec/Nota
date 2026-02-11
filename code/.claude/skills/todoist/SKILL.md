---
name: todoist
description: Manage Todoist tasks. Use when the user mentions "todoist", "my tasks", "task list", "add a task", "complete task", or wants to interact with their Todoist account.
---

# Todoist Integration

Manage tasks via `td` CLI (@doist/todoist-cli, installed as npm dependency).

**IMPORTANT:** Always use `npx td` (not bare `td`) — the CLI is a local npm dependency.

## Common Operations

### List Tasks

```bash
# Today's agenda (includes overdue)
npx td today

# Upcoming 7 days
npx td upcoming

# All tasks
npx td task list

# By project
npx td task list --project "Work"

# By priority
npx td task list --priority p1

# By label
npx td task list --label "urgent"

# By due date
npx td task list --due today

# Raw Todoist filter query
npx td task list --filter "p1 & (today | overdue)"

# Inbox only
npx td inbox
```

### Add Tasks

Quick add (natural language — handles dates, projects, priorities, labels):
```bash
npx td add "Buy milk tomorrow p1 #Shopping"
npx td add "Review PR #Work @urgent"
npx td add "Call mom next Monday"
```

Structured add:
```bash
npx td task add --content "Prepare quarterly report" \
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
npx td task complete <ref>
npx td task complete <ref> --forever    # End recurring task permanently
```

### Update Tasks

```bash
npx td task update <ref> --content "New title"
npx td task update <ref> --due "tomorrow"
npx td task update <ref> --priority p1
npx td task update <ref> --labels "urgent,work"
npx td task update <ref> --description "Updated notes"
```

### View Task Details

```bash
npx td task view <ref>
```

### Delete Tasks

```bash
npx td task delete <ref>
```

### Reopen Completed Tasks

```bash
npx td task uncomplete <ref>
```

### Move Tasks

```bash
npx td task move <ref> --project "Work"
npx td task move <ref> --section <id>
npx td task move <ref> --parent <ref>
```

## Projects & Labels

```bash
# Projects
npx td project list
npx td project create --name "New Project"
npx td project view <ref>
npx td project delete <ref>

# Labels
npx td label list
npx td label create --name "urgent"
npx td label delete <name>
```

## Other Commands

```bash
npx td completed                 # Show completed tasks
npx td stats                     # Productivity stats & karma
npx td activity                  # Activity log
npx td reminder list             # List reminders
npx td auth status               # Check auth status
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

1. **Morning review**: `npx td today`
2. **Quick capture**: `npx td add "thing to do"`
3. **Weekly view**: `npx td upcoming 7`
4. **Completed review**: `npx td completed`
