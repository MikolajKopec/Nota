#!/usr/bin/env python3
"""
List all scheduled tasks created by Asystent bot.

Usage:
    python list_tasks.py [--prefix Asystent_]
"""

import argparse
import subprocess
import sys
import json


def list_tasks(prefix=''):
    """List all scheduled tasks, optionally filtered by prefix."""

    # Query all tasks
    cmd = 'powershell -Command "schtasks /query /fo CSV /v"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"ERROR: {result.stderr}", file=sys.stderr)
        sys.exit(1)

    # Parse CSV output
    lines = result.stdout.strip().split('\n')
    if len(lines) < 2:
        return []

    # First line is headers
    headers = lines[0].split('","')
    headers[0] = headers[0].lstrip('"')
    headers[-1] = headers[-1].rstrip('"')

    tasks = []
    for line in lines[1:]:
        if not line.strip():
            continue

        values = line.split('","')
        values[0] = values[0].lstrip('"')
        values[-1] = values[-1].rstrip('"')

        task_dict = dict(zip(headers, values))

        # Filter by prefix and by trigger script path
        task_name = task_dict.get('TaskName', '').strip('\\')

        # Check if it's an Asystent task (either by prefix or by trigger-bot-prompt.ps1 in Task To Run)
        task_to_run = task_dict.get('Task To Run', '')
        is_asystent_task = (
            (prefix and task_name.startswith(prefix)) or
            'trigger-bot-prompt.ps1' in task_to_run
        )

        if is_asystent_task:
            tasks.append({
                'name': task_name,
                'status': task_dict.get('Status', ''),
                'next_run': task_dict.get('Next Run Time', ''),
                'last_run': task_dict.get('Last Run Time', ''),
                'schedule': task_dict.get('Schedule', ''),
                'task_to_run': task_to_run
            })

    return tasks


def main():
    parser = argparse.ArgumentParser(description='List Asystent scheduled tasks')
    parser.add_argument('--prefix', default='', help='Filter tasks by name prefix')
    parser.add_argument('--json', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    tasks = list_tasks(args.prefix)

    if args.json:
        print(json.dumps(tasks, indent=2))
    else:
        if not tasks:
            print("No scheduled tasks found.")
        else:
            for task in tasks:
                print(f"\nTask: {task['name']}")
                print(f"  Status: {task['status']}")
                print(f"  Next Run: {task['next_run']}")
                print(f"  Last Run: {task['last_run']}")
                print(f"  Schedule: {task['schedule']}")


if __name__ == '__main__':
    main()
