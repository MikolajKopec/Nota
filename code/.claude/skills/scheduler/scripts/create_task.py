#!/usr/bin/env python3
"""
Create a scheduled task for the Asystent bot (cross-platform: Windows/macOS/Linux).

Usage:
    python create_task.py --name "TaskName" --prompt "Your prompt" --schedule "daily 09:00"
    python create_task.py --name "TaskName" --prompt "Your prompt" --schedule "in 2 minutes"
    python create_task.py --name "TaskName" --prompt "Your prompt" --schedule "weekly SUN 20:00"
"""

import argparse
import subprocess
import sys
import platform
from datetime import datetime, timedelta
from pathlib import Path
import re
import os

PLATFORM = platform.system()  # 'Windows', 'Darwin' (macOS), 'Linux'


def parse_natural_schedule(schedule_str):
    """
    Parse natural language schedule into structured format.

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

        return {
            'type': 'once',
            'time': target.strftime('%H:%M'),
            'date': target.strftime('%d/%m/%Y'),  # Windows format
            'datetime': target  # Full datetime for macOS
        }

    # "daily HH:MM" or "daily at HH:MM"
    if match := re.match(r'daily(?: at)? (\d{1,2}):?(\d{2})', schedule_str):
        hour = int(match.group(1))
        minute = int(match.group(2))
        return {
            'type': 'daily',
            'time': f'{hour:02d}:{minute:02d}',
            'hour': hour,
            'minute': minute
        }

    # "weekly DAY HH:MM" or "weekly DAY,DAY HH:MM"
    if match := re.match(r'weekly ([a-z,]+) (\d{1,2}):?(\d{2})', schedule_str):
        days_str = match.group(1).upper()
        hour = int(match.group(2))
        minute = int(match.group(3))

        # Convert day names to abbreviated format
        day_map = {
            'MON': 1, 'MONDAY': 1,
            'TUE': 2, 'TUESDAY': 2,
            'WED': 3, 'WEDNESDAY': 3,
            'THU': 4, 'THURSDAY': 4,
            'FRI': 5, 'FRIDAY': 5,
            'SAT': 6, 'SATURDAY': 6,
            'SUN': 0, 'SUNDAY': 0  # Sunday = 0 in launchd
        }

        days_abbrev = []
        days_weekday = []
        for day in days_str.split(','):
            day = day.strip()
            if day in day_map:
                days_abbrev.append(day[:3])
                days_weekday.append(day_map[day])

        return {
            'type': 'weekly',
            'time': f'{hour:02d}:{minute:02d}',
            'hour': hour,
            'minute': minute,
            'days': ','.join(days_abbrev),  # For Windows: "MON,WED,FRI"
            'weekdays': days_weekday  # For macOS: [1, 3, 5]
        }

    # "monthly day HH:MM"
    if match := re.match(r'monthly (\d{1,2}) (\d{1,2}):?(\d{2})', schedule_str):
        day = int(match.group(1))
        hour = int(match.group(2))
        minute = int(match.group(3))

        return {
            'type': 'monthly',
            'time': f'{hour:02d}:{minute:02d}',
            'hour': hour,
            'minute': minute,
            'day': day
        }

    raise ValueError(f"Could not parse schedule: {schedule_str}")


def create_windows_task(task_name, prompt, schedule_info, trigger_script):
    """Create Windows Task Scheduler task using schtasks."""

    # Escape prompt for PowerShell
    safe_prompt = prompt.replace(' ', '_').replace('"', '').replace("'", '')

    tr_path = f"powershell -File {trigger_script} \\\"{safe_prompt}\\\""

    # Get current username for task context
    import getpass
    username = getpass.getuser()

    # Build schtasks command
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

    # Run as current user with highest privileges
    parts.append(f'/ru {username} /rl HIGHEST')

    # Force overwrite
    parts.append('/f"')

    cmd = ' '.join(parts)

    # Execute
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    if result.returncode == 0:
        return True, f"Task '{task_name}' created successfully"
    else:
        return False, result.stderr


def create_macos_task(task_name, prompt, schedule_info, trigger_script):
    """Create macOS launchd task using .plist file."""

    # LaunchAgents directory
    launch_agents_dir = Path.home() / "Library" / "LaunchAgents"
    launch_agents_dir.mkdir(parents=True, exist_ok=True)

    # Plist filename
    plist_name = f"com.asystent.{task_name}.plist"
    plist_path = launch_agents_dir / plist_name

    # Build StartCalendarInterval based on schedule type
    if schedule_info['type'] == 'once':
        # For one-time tasks, use StartCalendarInterval with specific date/time
        dt = schedule_info['datetime']
        calendar_interval = f"""
        <key>Month</key>
        <integer>{dt.month}</integer>
        <key>Day</key>
        <integer>{dt.day}</integer>
        <key>Hour</key>
        <integer>{dt.hour}</integer>
        <key>Minute</key>
        <integer>{dt.minute}</integer>
"""
    elif schedule_info['type'] == 'daily':
        # Daily at specific time
        calendar_interval = f"""
        <key>Hour</key>
        <integer>{schedule_info['hour']}</integer>
        <key>Minute</key>
        <integer>{schedule_info['minute']}</integer>
"""
    elif schedule_info['type'] == 'weekly':
        # Weekly - need multiple intervals for each weekday
        intervals = []
        for weekday in schedule_info['weekdays']:
            intervals.append(f"""
        <dict>
            <key>Weekday</key>
            <integer>{weekday}</integer>
            <key>Hour</key>
            <integer>{schedule_info['hour']}</integer>
            <key>Minute</key>
            <integer>{schedule_info['minute']}</integer>
        </dict>""")
        calendar_interval = '\n'.join(intervals)
    elif schedule_info['type'] == 'monthly':
        # Monthly on specific day
        calendar_interval = f"""
        <key>Day</key>
        <integer>{schedule_info['day']}</integer>
        <key>Hour</key>
        <integer>{schedule_info['hour']}</integer>
        <key>Minute</key>
        <integer>{schedule_info['minute']}</integer>
"""

    # Create plist content
    if schedule_info['type'] == 'weekly':
        # Weekly needs array of intervals
        plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.asystent.{task_name}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{trigger_script}</string>
        <string>{prompt}</string>
    </array>
    <key>StartCalendarInterval</key>
    <array>{calendar_interval}
    </array>
</dict>
</plist>
"""
    else:
        plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.asystent.{task_name}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{trigger_script}</string>
        <string>{prompt}</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>{calendar_interval}
    </dict>
</dict>
</plist>
"""

    # Write plist file
    plist_path.write_text(plist_content)

    # Load into launchd
    result = subprocess.run(
        ['launchctl', 'load', str(plist_path)],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        return True, f"Task '{task_name}' created at {plist_path}"
    else:
        return False, f"Failed to load task: {result.stderr}"


def main():
    parser = argparse.ArgumentParser(description='Create scheduled task for Asystent bot (cross-platform)')
    parser.add_argument('--name', required=True, help='Task name (e.g., Daily_Plan_0900)')
    parser.add_argument('--prompt', required=True, help='Prompt for trigger script')
    parser.add_argument('--schedule', required=True, help='Schedule in natural language')
    parser.add_argument('--trigger-script', help='Path to trigger script (auto-detected if not provided)')

    args = parser.parse_args()

    # Auto-detect trigger script path if not provided
    if not args.trigger_script:
        script_dir = Path(__file__).parent.parent.parent.parent / "scripts"
        if PLATFORM == 'Windows':
            args.trigger_script = str(script_dir / "trigger-bot-prompt.ps1")
        else:
            args.trigger_script = str(script_dir / "trigger-bot-prompt.sh")

    try:
        # Parse schedule
        schedule_info = parse_natural_schedule(args.schedule)

        # Create task based on platform
        if PLATFORM == 'Windows':
            success, message = create_windows_task(args.name, args.prompt, schedule_info, args.trigger_script)
        elif PLATFORM == 'Darwin':  # macOS
            success, message = create_macos_task(args.name, args.prompt, schedule_info, args.trigger_script)
        else:  # Linux - use cron (future implementation)
            print("ERROR: Linux not yet supported. Please use cron manually.", file=sys.stderr)
            sys.exit(1)

        if success:
            print(f"SUCCESS: {message}")
            print(f"Schedule: {schedule_info}")
            sys.exit(0)
        else:
            print(f"ERROR: {message}", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
