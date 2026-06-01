#!/usr/bin/env python3
"""Update the committed flamapy-authored wheels from the latest flamapy release.

The flamapy release pipeline attaches a ``flamapy-wheels-<tag>.zip`` asset to each
GitHub release, containing the pure-python wheels of the flamapy-authored
packages (flamapy + flamapy-fw/fm/sat/bdd/z3). This script:

  1. resolves the latest *stable* release of ``flamapy/flamapy`` (prereleases and
     drafts are ignored),
  2. downloads its wheels bundle,
  3. drops the new ``flamapy_*`` wheels into ``public/flamapy/`` and removes the
     superseded ones, and
  4. rewrites the matching versioned filenames inside ``plugins.conf.json``,
     preserving its curated grouping, ``enabled`` flags and ``pyodide_packages``.

Third-party dependencies (uvlparser, dd, ply, …), the vendored
``flamapy-configurator`` wheel and the ``z3_solver`` wasm wheel are left
untouched -- they are not part of the flamapy release bundle.

The script is idempotent: re-running it when already up to date leaves the tree
unchanged (so a CI job can simply open a PR when ``git`` reports a diff).

Usage:
    python scripts/update_flamapy_wheels.py            # fetch the latest release
    python scripts/update_flamapy_wheels.py --zip b.zip # use a local bundle (testing)

Environment:
    FLAMAPY_REPO        owner/name of the flamapy repo (default: flamapy/flamapy)
    FLAMAPY_WHEELS_DIR  wheels directory (default: public/flamapy)
    GITHUB_TOKEN        optional; raises the GitHub API rate limit
"""
import argparse
import io
import json
import os
import sys
import urllib.request
import zipfile
from pathlib import Path

REPO = os.environ.get("FLAMAPY_REPO", "flamapy/flamapy")
WHEELS_DIR = Path(os.environ.get("FLAMAPY_WHEELS_DIR", "public/flamapy"))
USER_AGENT = "flamapy-ide-wheel-updater"


def _request(url: str, accept: str | None = None) -> urllib.request.Request:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    if accept:
        req.add_header("Accept", accept)
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    return req


def fetch_latest_bundle() -> tuple[str, bytes]:
    """Return (tag, zip_bytes) for the latest stable flamapy release bundle."""
    api = f"https://api.github.com/repos/{REPO}/releases/latest"
    with urllib.request.urlopen(_request(api, "application/vnd.github+json")) as resp:
        release = json.load(resp)
    tag = release["tag_name"]

    assets = release.get("assets", [])
    asset = next((a for a in assets if a["name"] == f"flamapy-wheels-{tag}.zip"), None)
    if asset is None:  # be lenient about the exact tag spelling in the filename
        asset = next(
            (a for a in assets if a["name"].startswith("flamapy-wheels-")
             and a["name"].endswith(".zip")),
            None,
        )
    if asset is None:
        raise SystemExit(
            f"Release {tag} of {REPO} has no 'flamapy-wheels-*.zip' asset. "
            "Nothing to update."
        )

    with urllib.request.urlopen(_request(asset["browser_download_url"])) as resp:
        return tag, resp.read()


def package_key(wheel_filename: str) -> str:
    """The distribution name part of a wheel filename (e.g. 'flamapy_bdd')."""
    return wheel_filename.split("-", 1)[0]


def update(zip_bytes: bytes) -> bool:
    """Apply the bundle to WHEELS_DIR + plugins.conf.json. Returns True if the
    bundle contained wheels (regardless of whether anything changed on disk)."""
    conf_path = WHEELS_DIR / "plugins.conf.json"
    conf = json.loads(conf_path.read_text())

    # Collect the wheel lists referenced by the manifest.
    wheel_lists = [conf["core"]["wheels"]]
    wheel_lists += [plugin["wheels"] for plugin in conf["plugins"].values()]

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as bundle:
        bundle_wheels = [os.path.basename(n) for n in bundle.namelist() if n.endswith(".whl")]
        if not bundle_wheels:
            print("Bundle contains no wheels.", file=sys.stderr)
            return False

        new_by_key = {package_key(name): name for name in bundle_wheels}

        # Rewrite the manifest filenames in place, tracking replacements.
        replaced: dict[str, str] = {}   # old filename -> new filename
        matched_keys: set[str] = set()
        for wheels in wheel_lists:
            for i, filename in enumerate(wheels):
                key = package_key(filename)
                new_name = new_by_key.get(key)
                if new_name is None:
                    continue  # third-party dep / not in bundle -> leave it
                matched_keys.add(key)
                if new_name != filename:
                    wheels[i] = new_name
                    replaced[filename] = new_name

        unreferenced = sorted(set(new_by_key) - matched_keys)
        if unreferenced:
            print(
                "WARNING: bundle wheels not referenced in plugins.conf.json "
                "(add them to the manifest manually if they should load): "
                + ", ".join(new_by_key[k] for k in unreferenced),
                file=sys.stderr,
            )

        # Write every bundle wheel into the wheels directory.
        WHEELS_DIR.mkdir(parents=True, exist_ok=True)
        for member in bundle.namelist():
            if not member.endswith(".whl"):
                continue
            target = WHEELS_DIR / os.path.basename(member)
            with bundle.open(member) as src:
                target.write_bytes(src.read())

    # Persist the manifest (2-space indent + trailing newline, matching the repo).
    conf_path.write_text(json.dumps(conf, indent=2) + "\n")

    # Remove superseded wheel files that are no longer referenced anywhere.
    still_referenced = {fn for wheels in wheel_lists for fn in wheels}
    for old_name in replaced:
        if old_name not in still_referenced:
            stale = WHEELS_DIR / old_name
            if stale.exists():
                stale.unlink()

    if replaced:
        print("Updated wheels:")
        for old, new in sorted(replaced.items()):
            print(f"  {old}  ->  {new}")
    else:
        print("Already up to date; no wheel filenames changed.")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--zip",
        dest="zip_path",
        help="Use a local wheels bundle instead of downloading the latest release.",
    )
    args = parser.parse_args()

    if args.zip_path:
        print(f"Using local bundle: {args.zip_path}")
        zip_bytes = Path(args.zip_path).read_bytes()
    else:
        tag, zip_bytes = fetch_latest_bundle()
        print(f"Latest flamapy release: {tag}")

    update(zip_bytes)
    return 0


if __name__ == "__main__":
    sys.exit(main())
