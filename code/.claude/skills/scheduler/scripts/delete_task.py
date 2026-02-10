#!/usr/bin/env python3
"""
Delete a Windows scheduled task.

Usage:
    python delete_task.py --name "TaskName"
"""

import argparse
import subprocess
import sys


def delete_task(task_name):
    """Delete a scheduled task."""

    cmd = f'powershell -Command "schtasks /delete /tn {task_name} /f"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

    if result.returncode == 0:
        print(f"SUCCESS: Task '{task_name}' deleted")
        return True
    else:
        print(f"ERROR: {result.stderr}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description='Delete Windows scheduled task')
    parser.add_argument('--name', required=True, help='Task name to delete')

    args = parser.parse_args()

    success = delete_task(args.name)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
