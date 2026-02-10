#!/usr/bin/env python3
"""
Delete a scheduled task (cross-platform).

Usage:
    python delete_task.py --name "TaskName"
"""

import argparse
import subprocess
import sys
import platform
from pathlib import Path

PLATFORM = platform.system()


def delete_windows_task(task_name):
    """Delete Windows Task Scheduler task."""
    cmd = f'powershell -Command "schtasks /delete /tn {task_name} /f"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    if result.returncode == 0:
        return True, f"Task '{task_name}' deleted"
    else:
        return False, result.stderr


def delete_macos_task(task_name):
    """Delete macOS launchd task."""
    label = f"com.asystent.{task_name}"
    plist_path = Path.home() / "Library" / "LaunchAgents" / f"{label}.plist"

    if not plist_path.exists():
        return False, f"Task '{task_name}' not found"

    # Unload first
    subprocess.run(['launchctl', 'unload', str(plist_path)], capture_output=True)

    # Delete plist file
    try:
        plist_path.unlink()
        return True, f"Task '{task_name}' deleted"
    except Exception as e:
        return False, f"Failed to delete plist: {e}"


def main():
    parser = argparse.ArgumentParser(description='Delete scheduled task')
    parser.add_argument('--name', required=True, help='Task name to delete')

    args = parser.parse_args()

    if PLATFORM == 'Windows':
        success, message = delete_windows_task(args.name)
    elif PLATFORM == 'Darwin':
        success, message = delete_macos_task(args.name)
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
