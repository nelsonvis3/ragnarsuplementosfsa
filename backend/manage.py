#!/usr/bin/env python
import os
import sys


def main():
    # Evita que el directorio TypeScript store/ oculte la app durante discovery.
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
