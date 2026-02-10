#!/usr/bin/env python3
"""
Enable (activate) a scheduled task (cross-platform).

Usage:
    python enable_task.py --name "TaskName"
"""

import argparse
import subprocess
import sys
import platform
from pathlib import Path

PLATFORM = platform.system()


def enable_windows_task(task_name):
    """Enable Windows Task Scheduler task."""
    cmd = f'powershell -Command "schtasks /change /tn {task_name} /enable"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    if result.returncode == 0:
        return True, f"Task '{task_name}' enabled"
    else:
        return False, result.stderr


def enable_macos_task(task_name):
    """Enable macOS launchd task by loading it."""
    label = f"com.asystent.{task_name}"
    plist_path = Path.home() / "Library" / "LaunchAgents" / f"{label}.plist"

    if not plist_path.exists():
        return False, f"Task '{task_name}' not found"

    result = subprocess.run(
        ['launchctl', 'load', str(plist_path)],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        return True, f"Task '{task_name}' enabled (loaded)"
    else:
        return False, f"Failed to enable: {result.stderr}"


def main():
    parser = argparse.ArgumentParser(description='Enable scheduled task')
    parser.add_argument('--name', required=True, help='Task name to enable')

    args = parser.parse_args()

    if PLATFORM == 'Windows':
        success, message = enable_windows_task(args.name)
    elif PLATFORM == 'Darwin':
        success, message = enable_macos_task(args.name)
    else:
        print("ERROR: Linux not yet supported", file=sys.stderr)
        sys.exit(1)

    if success:
        print(f"SUCCESS: {message}")
        sys.exit(0)
    else:
        print(f"ERROR: {message}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
