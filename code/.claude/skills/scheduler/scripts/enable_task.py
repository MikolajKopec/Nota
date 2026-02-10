#!/usr/bin/env python3
"""
Enable (activate) a Windows scheduled task.

Usage:
    python enable_task.py --name "TaskName"
"""

import argparse
import subprocess
import sys


def enable_task(task_name):
    """Enable a scheduled task."""

    cmd = f'powershell -Command "schtasks /change /tn {task_name} /enable"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    if result.returncode == 0:
        print(f"SUCCESS: Task '{task_name}' enabled")
        return True
    else:
        print(f"ERROR: {result.stderr}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description='Enable Windows scheduled task')
    parser.add_argument('--name', required=True, help='Task name to enable')

    args = parser.parse_args()

    success = enable_task(args.name)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
