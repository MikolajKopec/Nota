# Metadata Schema for Scheduled Tasks

All scheduled tasks metadata is stored in: `brain/Asystent/scheduled-tasks.md`

## Format

Each task entry follows this structure:

```markdown
### TaskName
- **Prompt**: The exact prompt passed to trigger-bot-prompt.ps1
- **Schedule**: Human-readable schedule description
- **Created**: YYYY-MM-DD
- **Status**: Active | Disabled | Deleted
- **Task Name**: Windows Task Scheduler name (for schtasks commands)
- **Description**: Optional user-friendly description
```

## Example Entries

```markdown
### Daily_Morning_Brief_0800
- **Prompt**: Przygotuj_poranny_briefing_sprawdz_user-notes_pogode_najwazniejsze_zadania
- **Schedule**: Daily at 08:00
- **Created**: 2026-02-10
- **Status**: Active
- **Task Name**: Daily_Morning_Brief_0800
- **Description**: Morning briefing with tasks, weather, and notes summary

### Weekly_Summary_SUN_2000
- **Prompt**: Podsumuj_miniony_tydzien_na_podstawie_notatek_z_user-notes
- **Schedule**: Weekly on Sunday at 20:00
- **Created**: 2026-02-10
- **Status**: Active
- **Task Name**: Weekly_Summary_SUN_2000
- **Description**: Weekly summary generated from user notes

### Reminder_Meeting_1500
- **Prompt**: Przypomnienie_o_spotkaniu_o_15:00
- **Schedule**: Once on 11/02/2026 at 15:00
- **Created**: 2026-02-10
- **Status**: Completed
- **Task Name**: Reminder_Meeting_1500
- **Description**: One-time reminder for meeting
```

## Status Values

- **Active**: Task is running and scheduled
- **Disabled**: Task exists but is disabled in Windows Task Scheduler
- **Deleted**: Task was deleted (keep for history)
- **Completed**: One-time task that has run (keep for history)

## Workflow for Metadata Updates

1. **Creating task**: Add new entry with Status=Active
2. **Disabling task**: Update Status to Disabled
3. **Enabling task**: Update Status to Active
4. **Deleting task**: Update Status to Deleted (don't remove entry - keep for history)
5. **One-time task completes**: Update Status to Completed
