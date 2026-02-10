#!/usr/bin/env python3
"""
Get execution history for a scheduled task (cross-platform).

Usage:
    python get_task_history.py --name "TaskName" [--limit 10]
"""

import argparse
import subprocess
import sys
import platform
import json
from datetime import datetime, timedelta

PLATFORM = platform.system()


def get_windows_history(task_name, limit=10):
    """
    Get task execution history from Windows Event Viewer.

    Event IDs:
    - 100: Task started
    - 102: Task completed successfully
    - 103: Task failed to start
    - 201: Task execution failed
    """

    ps_cmd = f"""
    Get-WinEvent -FilterHashtable @{{
        LogName='Microsoft-Windows-TaskScheduler/Operational';
        ID=100,102,103,201
    }} -MaxEvents {limit * 4} | Where-Object {{
        $_.Message -like '*{task_name}*'
    }} | Select-Object -First {limit} TimeCreated, Id, Message | ConvertTo-Json
    """

    cmd = ['powershell', '-Command', ps_cmd]
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        return []

    try:
        events = json.loads(result.stdout)
        if not isinstance(events, list):
            events = [events]

        history = []
        for event in events:
            event_id = event['Id']
            time_created = event['TimeCreated']

            # Determine status
            if event_id == 100:
                status = 'Started'
            elif event_id == 102:
                status = 'Completed'
            elif event_id == 103:
                status = 'Failed to start'
            elif event_id == 201:
                status = 'Failed'
            else:
                status = 'Unknown'

            history.append({
                'time': time_created,
                'status': status,
                'event_id': event_id
            })

        return history

    except json.JSONDecodeError:
        return []


def get_macos_history(task_name, limit=10):
    """
    Get task execution history from macOS system log.
    """
    label = f"com.asystent.{task_name}"

    # Query logs from last 7 days
    since = (datetime.now() - timedelta(days=7)).isoformat()

    # Use 'log show' to query system logs
    cmd = [
        'log', 'show',
        '--predicate', f'process == "launchd" AND eventMessage CONTAINS "{label}"',
        '--style', 'json',
        '--start', since,
        '--last', str(limit * 2)  # Get more than needed, filter later
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        return []

    history = []

    try:
        # Parse JSON output
        for line in result.stdout.splitlines():
            if not line.strip():
                continue
            try:
                event = json.loads(line)
                message = event.get('eventMessage', '')

                # Filter for relevant events
                if label in message:
                    timestamp = event.get('timestamp', '')

                    # Determine status from message
                    if 'start' in message.lower():
                        status = 'Started'
                    elif 'exited' in message.lower():
                        if 'code 0' in message or 'successfully' in message.lower():
                            status = 'Completed'
                        else:
                            status = 'Failed'
                    else:
                        status = 'Info'

                    history.append({
                        'time': timestamp,
                        'status': status,
                        'message': message[:200]
                    })

            except json.JSONDecodeError:
                continue

        return history[:limit]

    except Exception:
        return []


def main():
    parser = argparse.ArgumentParser(description='Get scheduled task execution history')
    parser.add_argument('--name', required=True, help='Task name')
    parser.add_argument('--limit', type=int, default=10, help='Number of events to retrieve')
    parser.add_argument('--json', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    if PLATFORM == 'Windows':
        history = get_windows_history(args.name, args.limit)
    elif PLATFORM == 'Darwin':
        history = get_macos_history(args.name, args.limit)
    else:
        print("ERROR: Linux not yet supported", file=sys.stderr)
        sys.exit(1)

    if args.json:
        print(json.dumps(history, indent=2))
    else:
        if not history:
            print(f"No execution history found for task '{args.name}'")
        else:
            print(f"\nExecution history for '{args.name}':\n")
            for event in history:
                print(f"  {event['time']} - {event['status']}")


if __name__ == '__main__':
    main()
