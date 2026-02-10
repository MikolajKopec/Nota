#!/usr/bin/env python3
"""
List scheduled tasks created by Asystent bot (cross-platform).

Usage:
    python list_tasks.py [--prefix PREFIX] [--json]
"""

import argparse
import subprocess
import sys
import platform
import json
from pathlib import Path

PLATFORM = platform.system()


def list_windows_tasks(prefix=None):
    """List Windows Task Scheduler tasks."""
    cmd = 'powershell -Command "schtasks /query /fo CSV | ConvertFrom-Csv"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    if result.returncode != 0:
        return []

    tasks = []
    lines = result.stdout.strip().split('\n')

    for line in lines[1:]:  # Skip header
        if not line.strip():
            continue

        # Parse CSV-like output
        parts = line.split(',')
        if len(parts) >= 3:
            task_name = parts[0].strip('"').split('\\')[-1]  # Get name without path

            # Filter by trigger-bot-prompt or prefix
            if prefix and not task_name.startswith(prefix):
                continue

            # Check if it's an Asystent task (contains trigger-bot-prompt in command)
            detail_cmd = f'schtasks /query /tn "{parts[0].strip("\"")}" /fo LIST /v'
            detail_result = subprocess.run(
                f'powershell -Command "{detail_cmd}"',
                shell=True,
                capture_output=True,
                text=True
            )

            if 'trigger-bot-prompt' in detail_result.stdout:
                tasks.append({
                    'name': task_name,
                    'status': parts[2].strip('"'),
                    'next_run': parts[1].strip('"') if len(parts) > 1 else 'N/A'
                })

    return tasks


def list_macos_tasks(prefix=None):
    """List macOS launchd tasks."""
    # Get list of plist files in LaunchAgents
    launch_agents_dir = Path.home() / "Library" / "LaunchAgents"

    if not launch_agents_dir.exists():
        return []

    tasks = []

    for plist_file in launch_agents_dir.glob("com.asystent.*.plist"):
        task_name = plist_file.stem.replace("com.asystent.", "")

        if prefix and not task_name.startswith(prefix):
            continue

        # Check if task is loaded
        result = subprocess.run(
            ['launchctl', 'list'],
            capture_output=True,
            text=True
        )

        label = f"com.asystent.{task_name}"
        is_loaded = label in result.stdout

        tasks.append({
            'name': task_name,
            'status': 'Loaded' if is_loaded else 'Not loaded',
            'plist': str(plist_file)
        })

    return tasks


def main():
    parser = argparse.ArgumentParser(description='List Asystent scheduled tasks')
    parser.add_argument('--prefix', help='Filter tasks by name prefix')
    parser.add_argument('--json', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    # Get tasks based on platform
    if PLATFORM == 'Windows':
        tasks = list_windows_tasks(args.prefix)
    elif PLATFORM == 'Darwin':
        tasks = list_macos_tasks(args.prefix)
    else:
        print("ERROR: Linux not yet supported", file=sys.stderr)
        sys.exit(1)

    if args.json:
        print(json.dumps(tasks, indent=2))
    else:
        if not tasks:
            print("No Asystent tasks found")
        else:
            print(f"\nFound {len(tasks)} task(s):\n")
            for task in tasks:
                print(f"  • {task['name']}")
                print(f"    Status: {task['status']}")
                if 'next_run' in task:
                    print(f"    Next run: {task['next_run']}")
                if 'plist' in task:
                    print(f"    Plist: {task['plist']}")
                print()


if __name__ == '__main__':
    main()
