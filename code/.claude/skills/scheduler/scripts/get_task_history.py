#!/usr/bin/env python3
"""
Get execution history for a Windows scheduled task from Event Viewer.

Usage:
    python get_task_history.py --name "TaskName" [--limit 10]
"""

import argparse
import subprocess
import sys
import json
from datetime import datetime


def get_task_history(task_name, limit=10):
    """
    Get task execution history from Windows Event Viewer.

    Event IDs:
    - 100: Task started
    - 102: Task completed successfully
    - 103: Task failed to start
    - 201: Task execution failed
    """

    # PowerShell command to query Task Scheduler event log
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
        # No events found or error
        return []

    try:
        events = json.loads(result.stdout)
        if not isinstance(events, list):
            events = [events]

        history = []
        for event in events:
            event_id = event['Id']
            time_created = event['TimeCreated']
            message = event['Message']

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
                'event_id': event_id,
                'message': message[:200]  # First 200 chars
            })

        return history

    except json.JSONDecodeError:
        return []


def main():
    parser = argparse.ArgumentParser(description='Get scheduled task execution history')
    parser.add_argument('--name', required=True, help='Task name')
    parser.add_argument('--limit', type=int, default=10, help='Number of events to retrieve')
    parser.add_argument('--json', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    history = get_task_history(args.name, args.limit)

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
