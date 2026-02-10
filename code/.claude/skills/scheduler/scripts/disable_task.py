#!/usr/bin/env python3
"""
Disable (deactivate) a Windows scheduled task.

Usage:
    python disable_task.py --name "TaskName"
"""

import argparse
import subprocess
import sys


def disable_task(task_name):
    """Disable a scheduled task."""

    cmd = f'powershell -Command "schtasks /change /tn {task_name} /disable"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    if result.returncode == 0:
        print(f"SUCCESS: Task '{task_name}' disabled")
        return True
    else:
        print(f"ERROR: {result.stderr}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description='Disable Windows scheduled task')
    parser.add_argument('--name', required=True, help='Task name to disable')

    args = parser.parse_args()

    success = disable_task(args.name)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
