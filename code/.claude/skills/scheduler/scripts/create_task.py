#!/usr/bin/env python3
"""
Create a Windows scheduled task for the Asystent bot.

Usage:
    python create_task.py --name "TaskName" --prompt "Your prompt" --schedule "daily 09:00"
    python create_task.py --name "TaskName" --prompt "Your prompt" --schedule "in 2 minutes"
    python create_task.py --name "TaskName" --prompt "Your prompt" --schedule "weekly SUN 20:00"
"""

import argparse
import subprocess
import sys
from datetime import datetime, timedelta
import re


def parse_natural_schedule(schedule_str):
    """
    Parse natural language schedule into schtasks format.

    Returns: dict with keys: type, time, date (optional), days (optional)
    """
    schedule_str = schedule_str.lower().strip()

    # "in X minutes/hours"
    if match := re.match(r'in (\d+) (minute|minutes|hour|hours)', schedule_str):
        amount = int(match.group(1))
        unit = match.group(2)

        if unit.startswith('minute'):
            delta = timedelta(minutes=amount)
        else:  # hour
            delta = timedelta(hours=amount)

        target = datetime.now() + delta
        time_str = target.strftime('%H:%M')
        date_str = target.strftime('%d/%m/%Y')

        return {
            'type': 'once',
            'time': time_str,
            'date': date_str
        }

    # "daily HH:MM" or "daily at HH:MM"
    if match := re.match(r'daily(?: at)? (\d{1,2}):?(\d{2})', schedule_str):
        hour = match.group(1).zfill(2)
        minute = match.group(2)
        return {
            'type': 'daily',
            'time': f'{hour}:{minute}'
        }

    # "weekly DAY HH:MM" or "weekly DAY,DAY HH:MM"
    if match := re.match(r'weekly ([a-z,]+) (\d{1,2}):?(\d{2})', schedule_str):
        days_str = match.group(1).upper()
        hour = match.group(2).zfill(2)
        minute = match.group(3)

        # Convert day names to schtasks format
        day_map = {
            'MON': 'MON', 'MONDAY': 'MON',
            'TUE': 'TUE', 'TUESDAY': 'TUE',
            'WED': 'WED', 'WEDNESDAY': 'WED',
            'THU': 'THU', 'THURSDAY': 'THU',
            'FRI': 'FRI', 'FRIDAY': 'FRI',
            'SAT': 'SAT', 'SATURDAY': 'SAT',
            'SUN': 'SUN', 'SUNDAY': 'SUN'
        }

        days = []
        for day in days_str.split(','):
            day = day.strip()
            if day in day_map:
                days.append(day_map[day])

        return {
            'type': 'weekly',
            'time': f'{hour}:{minute}',
            'days': ','.join(days)
        }

    # "monthly day HH:MM"
    if match := re.match(r'monthly (\d{1,2}) (\d{1,2}):?(\d{2})', schedule_str):
        day = match.group(1)
        hour = match.group(2).zfill(2)
        minute = match.group(3)

        return {
            'type': 'monthly',
            'time': f'{hour}:{minute}',
            'day': day
        }

    raise ValueError(f"Could not parse schedule: {schedule_str}")


def create_schtasks_command(task_name, prompt, schedule_info, trigger_script):
    """Build schtasks command."""

    # Escape prompt for PowerShell (replace spaces with underscores, escape quotes)
    safe_prompt = prompt.replace(' ', '_').replace('"', '').replace("'", '')

    tr_path = f"powershell -File {trigger_script} \\\"{safe_prompt}\\\""

    # Base command
    parts = [
        'powershell', '-Command',
        f'"schtasks /create /tn {task_name} /tr \'{tr_path}\''
    ]

    # Add schedule type
    if schedule_info['type'] == 'once':
        parts.append(f"/sc once /st {schedule_info['time']} /sd {schedule_info['date']}")
    elif schedule_info['type'] == 'daily':
        parts.append(f"/sc daily /st {schedule_info['time']}")
    elif schedule_info['type'] == 'weekly':
        parts.append(f"/sc weekly /d {schedule_info['days']} /st {schedule_info['time']}")
    elif schedule_info['type'] == 'monthly':
        parts.append(f"/sc monthly /d {schedule_info['day']} /st {schedule_info['time']}")

    # Force overwrite
    parts.append('/f"')

    return ' '.join(parts)


def main():
    parser = argparse.ArgumentParser(description='Create Windows scheduled task for Asystent bot')
    parser.add_argument('--name', required=True, help='Task name (e.g., Daily_Plan_0900)')
    parser.add_argument('--prompt', required=True, help='Prompt for trigger-bot-prompt.ps1')
    parser.add_argument('--schedule', required=True, help='Schedule in natural language')
    parser.add_argument('--trigger-script', default='C:\\Users\\mikol\\Desktop\\Dev\\asystent\\code\\scripts\\trigger-bot-prompt.ps1',
                        help='Path to trigger-bot-prompt.ps1')

    args = parser.parse_args()

    try:
        # Parse schedule
        schedule_info = parse_natural_schedule(args.schedule)

        # Build command
        cmd = create_schtasks_command(args.name, args.prompt, schedule_info, args.trigger_script)

        # Execute
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

        if result.returncode == 0:
            print(f"SUCCESS: Task '{args.name}' created")
            print(f"Schedule: {schedule_info}")
            sys.exit(0)
        else:
            print(f"ERROR: {result.stderr}", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
