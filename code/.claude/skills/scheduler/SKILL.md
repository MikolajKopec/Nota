---
name: scheduler
description: "Manage Windows scheduled tasks for bot reminders/notifications. Use ONLY for: (1) Reminders via Telegram ('przypomnij mi', 'remind me'), (2) Scheduled bot messages ('daily briefing', 'cotygodniowy status'), (3) Managing task list ('/tasks' command). DO NOT use for Google Calendar events - those use google-calendar-skill. This creates Windows Task Scheduler tasks that send Telegram messages, NOT calendar events."
---

# Scheduler Skill

Manage Windows scheduled tasks that trigger intelligent bot responses using `trigger-bot-prompt.ps1`.

## Core Workflow

When the user requests a scheduled task:

1. **Parse the request** to extract:
   - Schedule timing (natural language or specific)
   - The actual task/reminder content
   - Task management action (create/list/delete/enable/disable/history)

2. **For creating tasks**:
   - Use `scripts/create_task.py` to generate the schtasks command
   - Generate an **intelligent prompt** for `trigger-bot-prompt.ps1` based on user's request
   - Save metadata to brain vault using schema from `references/metadata-schema.md`

3. **For managing tasks**:
   - Use appropriate script: `list_tasks.py`, `delete_task.py`, `enable_task.py`, `disable_task.py`, or `get_task_history.py`
   - Update brain vault metadata status when needed

## Creating Scheduled Tasks

### Step 1: Parse Natural Language Schedule

Use `scripts/create_task.py` which understands:

**Relative timing:**
- "in 2 minutes" → once, 2 minutes from now
- "in 3 hours" → once, 3 hours from now

**Recurring schedules:**
- "daily at 09:00" → daily at 09:00
- "weekly on Sunday at 20:00" → weekly on SUN at 20:00

**Specific date/time:**
- "tomorrow at 15:00" → once, tomorrow at 15:00
- "on 15/02/2026 at 10:00" → once, specific date

### Step 2: Generate Intelligent Prompt

The prompt passed to `trigger-bot-prompt.ps1` should be:
- **Contextual** - include what the user wants the bot to do
- **Underscores for spaces** - "Check_weather_and_send_morning_briefing"
- **Actionable** - clear instruction for the spawned claude instance

**Examples:**

User request: "Remind me in 2 minutes to call John"
→ Prompt: `"Remind_user_to_call_John"`

User request: "Send me a daily briefing at 09:00 with weather and my tasks"
→ Prompt: `"Send_daily_briefing_with_weather_and_tasks_from_user-notes"`

User request: "Weekly summary every Sunday at 20:00"
→ Prompt: `"Generate_weekly_summary_from_user-notes_and_send_to_user"`

### Step 3: Create Task with Python Script

Run the script with natural language:

```bash
python scripts/create_task.py \
  --name "Daily_Morning_Brief_0900" \
  --prompt "Send_daily_briefing_with_weather_and_tasks" \
  --schedule "daily at 09:00"
```

The script:
- Parses natural language to schtasks format
- Handles DD/MM/YYYY date formatting (Polish Windows)
- Generates correct PowerShell command with proper escaping
- Outputs the full schtasks command to run

### Step 4: Save Metadata to Brain Vault

After creating the task, update `brain/Asystent/scheduled-tasks.md` following the schema in `references/metadata-schema.md`:

```markdown
### Daily_Morning_Brief_0900
- **Prompt**: Send_daily_briefing_with_weather_and_tasks
- **Schedule**: Daily at 09:00
- **Created**: 2026-02-10
- **Status**: Active
- **Task Name**: Daily_Morning_Brief_0900
- **Description**: Morning briefing with weather and task summary
```

**Important:** Read the metadata file first to see existing tasks before adding new entries.

## Listing Scheduled Tasks

Use `scripts/list_tasks.py` to show all Asystent-related tasks:

```bash
python scripts/list_tasks.py --json
```

Cross-reference with brain vault metadata to show user-friendly descriptions.

## Managing Task Lifecycle

### Delete a Task

1. Run: `python scripts/delete_task.py --name "TaskName"`
2. Update brain vault: change Status to `Deleted` (keep for history)

### Disable a Task

1. Run: `python scripts/disable_task.py --name "TaskName"`
2. Update brain vault: change Status to `Disabled`

### Enable a Task

1. Run: `python scripts/enable_task.py --name "TaskName"`
2. Update brain vault: change Status to `Active`

### View Execution History

Run: `python scripts/get_task_history.py --name "TaskName" --limit 10`

Shows Event Viewer logs:
- Event 100: Task started
- Event 102: Task completed successfully
- Event 103: Task failed to start
- Event 201: Task execution failed

## Natural Language Processing

When the user asks:

**"Remind me in 5 minutes to check the oven"**
→ Action: Create
→ Schedule: "in 5 minutes"
→ Prompt: "Remind_user_to_check_the_oven"
→ Task name: "Reminder_Check_Oven_HHMM" (with current time)

**"Show my reminders" / "What tasks are scheduled?"**
→ Action: List
→ Run list_tasks.py and read brain vault metadata

**"Delete the morning briefing task"**
→ Action: Delete
→ Identify task name from brain vault metadata
→ Run delete_task.py and update metadata

**"Disable daily summary" / "Turn off the weekly report"**
→ Action: Disable
→ Run disable_task.py and update metadata status

**"When did the morning briefing last run?"**
→ Action: History
→ Run get_task_history.py for the task

## Date Format Requirements

**Critical:** Polish Windows requires DD/MM/YYYY format for schtasks.

The `create_task.py` script handles this automatically using Python's datetime:

```python
date_str = target.strftime('%d/%m/%Y')  # DD/MM/YYYY
time_str = target.strftime('%H:%M')    # 24-hour format
```

**Never** manually format dates in bash or use system locale commands - always use the Python script.

## Task Naming Convention

Generate descriptive task names that include:
- Purpose/type (Reminder, Daily, Weekly)
- Brief content identifier
- Time component (HHMM for one-time, time for recurring)

Examples:
- `Reminder_Call_John_1430`
- `Daily_Morning_Brief_0900`
- `Weekly_Summary_SUN_2000`

## Metadata Schema

See `references/metadata-schema.md` for complete schema details.

**Status values:**
- `Active` - Task is running
- `Disabled` - Task exists but is disabled
- `Deleted` - Task was deleted (kept for history)
- `Completed` - One-time task that has run

## Testing Tasks

To test a scheduled task immediately without waiting:

```bash
schtasks /run /tn "TaskName"
```

Check logs with: `Get-Content bot.log -Wait -Tail 20`

## Troubleshooting

If a task doesn't run:

1. **Check Event Viewer** using `get_task_history.py`
2. **Verify task exists** with `list_tasks.py`
3. **Check task details**: `schtasks /query /tn "TaskName" /v /fo list`
4. **Review bot logs** for trigger-bot-prompt.ps1 execution
5. **Verify date format** - ensure DD/MM/YYYY was used (script handles this)

Common issues:
- Task scheduled in future due to MM/DD vs DD/MM confusion (use script!)
- Wrong PowerShell script path in task command
- Missing CLAUDE_CODE_GIT_BASH_PATH environment variable
- Prompt string not properly escaped (use script!)

## Script Reference

All scripts are in `scripts/` directory:

- `create_task.py` - Parse schedule and generate schtasks command
- `list_tasks.py` - List all Asystent scheduled tasks
- `delete_task.py` - Delete a task
- `enable_task.py` - Enable/activate a task
- `disable_task.py` - Disable/deactivate a task
- `get_task_history.py` - Query Event Viewer for execution history

All scripts support `--help` for detailed usage.
