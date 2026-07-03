#!/usr/bin/env python3
"""Generate the served plugins.conf.json from the tracked template + built wheels.

The browser loader (``public/flamapy/flamapy.js``) fetches ``plugins.conf.json`` and
``micropip.install``s the exact wheel filenames it lists. Those filenames embed
versions, so they are build artifacts -- not source. The repo therefore tracks only
``plugins.conf.template.json`` (same structure, but each wheel listed by bare
distribution name, e.g. ``flamapy_fw``); this script resolves those names against the
wheels present in the wheels dir and writes the versioned ``plugins.conf.json``.

Run by ``make build-wheels`` right after it downloads the wheels pinned in
``./flamapy.version``; ``plugins.conf.json`` is gitignored.

Environment:
    FLAMAPY_WHEELS_DIR   wheels directory (default: public/flamapy)
"""
import json
import os
import sys
from pathlib import Path

WHEELS_DIR = Path(os.environ.get("FLAMAPY_WHEELS_DIR", "public/flamapy"))
TEMPLATE_PATH = WHEELS_DIR / "plugins.conf.template.json"
CONF_PATH = WHEELS_DIR / "plugins.conf.json"


def package_key(wheel_filename: str) -> str:
    """The distribution name part of a wheel filename (e.g. 'flamapy_bdd')."""
    return wheel_filename.split("-", 1)[0]


def wheel_lists(conf: dict) -> list[list]:
    """Every wheel list referenced by the manifest (core + plugins)."""
    return [conf["core"]["wheels"], *(p["wheels"] for p in conf["plugins"].values())]


def main() -> int:
    # Map each distribution name to its wheel on disk. Sorted so that, if several
    # versions linger, the lexically-greatest (newest) wins; clean-old-wheels then
    # prunes the rest.
    by_name = {package_key(p.name): p.name for p in sorted(WHEELS_DIR.glob("*.whl"))}
    if not by_name:
        raise SystemExit(f"No wheels in {WHEELS_DIR}; run `make build-wheels` first.")

    template = json.loads(TEMPLATE_PATH.read_text())
    missing: list[str] = []
    resolved: set[str] = set()
    for wheels in wheel_lists(template):  # template entries are bare distribution names
        for i, name in enumerate(wheels):
            if name in by_name:
                wheels[i] = by_name[name]
                resolved.add(name)
            else:
                missing.append(name)

    if missing:
        raise SystemExit(
            f"No wheel in {WHEELS_DIR} for templated package(s): "
            + ", ".join(sorted(set(missing))) + "\nRun `make build-wheels` to fetch them."
        )

    unused = sorted(set(by_name) - resolved)
    if unused:
        print(
            "WARNING: wheels present but not listed in plugins.conf.template.json "
            "(they won't load in the browser): " + ", ".join(by_name[k] for k in unused),
            file=sys.stderr,
        )

    # plugins.conf.json: 2-space indent + trailing newline, matching the template.
    CONF_PATH.write_text(json.dumps(template, indent=2) + "\n")
    print(f"Generated {CONF_PATH} ({len(resolved)} wheels resolved).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
