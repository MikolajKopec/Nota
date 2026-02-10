#!/usr/bin/env python3
"""
Disable (deactivate) a scheduled task (cross-platform).

Usage:
    python disable_task.py --name "TaskName"
"""

import argparse
import subprocess
import sys
import platform
from pathlib import Path

PLATFORM = platform.system()


def disable_windows_task(task_name):
    """Disable Windows Task Scheduler task."""
    cmd = f'powershell -Command "schtasks /change /tn {task_name} /disable"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    if result.returncode == 0:
        return True, f"Task '{task_name}' disabled"
    else:
        return False, result.stderr


def disable_macos_task(task_name):
    """Disable macOS launchd task by unloading it."""
    label = f"com.asystent.{task_name}"
    plist_path = Path.home() / "Library" / "LaunchAgents" / f"{label}.plist"

    if not plist_path.exists():
        return False, f"Task '{task_name}' not found"

    result = subprocess.run(
        ['launchctl', 'unload', str(plist_path)],
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        return True, f"Task '{task_name}' disabled (unloaded)"
    else:
        return False, f"Failed to disable: {result.stderr}"


def main():
    parser = argparse.ArgumentParser(description='Disable scheduled task')
    parser.add_argument('--name', required=True, help='Task name to disable')

    args = parser.parse_args()

    if PLATFORM == 'Windows':
        success, message = disable_windows_task(args.name)
    elif PLATFORM == 'Darwin':
        success, message = disable_macos_task(args.name)
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
