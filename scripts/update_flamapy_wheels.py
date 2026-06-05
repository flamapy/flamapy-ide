#!/usr/bin/env python3
"""Generate the served plugins.conf.json from wheels + the tracked template.

The browser loader (``public/flamapy/flamapy.js``) fetches ``plugins.conf.json`` and
``micropip.install``s the exact wheel filenames it lists. Those filenames embed
versions, so they are build artifacts -- not source. The repo therefore tracks only
``plugins.conf.template.json`` (the same structure, but each wheel listed by bare
distribution name, e.g. ``flamapy_fw``); the versioned ``plugins.conf.json`` and the
``flamapy_*`` wheels themselves are gitignored and produced at build time.

This script has two entry points, both of which end by resolving the template
against the wheels on disk and writing ``plugins.conf.json``:

  --sync-local   regenerate the manifest from wheels already in the wheels dir.
                 Run by ``make build-wheels`` right after it downloads the wheels
                 pinned in ``./flamapy.version``; this is the normal build path.

  (default)      download the ``flamapy-wheels-<tag>.zip`` asset attached to a
                 flamapy GitHub release (tag from ``./flamapy.version``, or the
                 latest stable when that file says ``latest``), drop its wheels
                 into the wheels dir, regenerate the manifest and prune stale
                 wheels. A manual convenience (``make update-flamapy-wheels``).

Third-party deps (uvlparser, dd, ply, …), the vendored ``flamapy-configurator``
wheel and the ``z3_solver`` wasm wheel must also appear in the template (by name)
to be loaded; ``make build-wheels`` / the vendored files provide them on disk.

Usage:
    python scripts/update_flamapy_wheels.py --sync-local # build path (from wheels on disk)
    python scripts/update_flamapy_wheels.py              # download the pinned release bundle
    python scripts/update_flamapy_wheels.py --zip b.zip  # use a local bundle (testing)

Environment:
    FLAMAPY_REPO          owner/name of the flamapy repo (default: flamapy/flamapy)
    FLAMAPY_WHEELS_DIR    wheels directory (default: public/flamapy)
    FLAMAPY_VERSION       overrides ./flamapy.version (e.g. "2.5.0" or "latest")
    FLAMAPY_VERSION_FILE  path to the pinned-version file (default: flamapy.version)
    GITHUB_TOKEN          optional; raises the GitHub API rate limit
"""
import argparse
import io
import json
import os
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

REPO = os.environ.get("FLAMAPY_REPO", "flamapy/flamapy")
WHEELS_DIR = Path(os.environ.get("FLAMAPY_WHEELS_DIR", "public/flamapy"))
VERSION_FILE = Path(os.environ.get("FLAMAPY_VERSION_FILE", "flamapy.version"))
USER_AGENT = "flamapy-ide-wheel-updater"

# The tracked template lists wheels by distribution name only (no versions); the
# served manifest with resolved, versioned filenames is generated and gitignored.
TEMPLATE_PATH = WHEELS_DIR / "plugins.conf.template.json"
CONF_PATH = WHEELS_DIR / "plugins.conf.json"


def resolve_version() -> str:
    """The flamapy version to pull, from $FLAMAPY_VERSION or ./flamapy.version.

    Returns a version string (e.g. "2.5.0") or the sentinel "latest". Blank
    lines and ``#`` comments in the file are ignored; the first real line wins.
    """
    env = os.environ.get("FLAMAPY_VERSION")
    if env and env.strip():
        return env.strip()
    if VERSION_FILE.is_file():
        for raw in VERSION_FILE.read_text().splitlines():
            line = raw.split("#", 1)[0].strip()
            if line:
                return line
    return "latest"


def _request(url: str, accept: str | None = None) -> urllib.request.Request:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    if accept:
        req.add_header("Accept", accept)
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    return req


def _get_release(version: str) -> dict:
    """Fetch the GitHub release JSON for ``version`` ("latest" or e.g. "2.5.0").

    For a pinned version the release tag may be spelled ``2.5.0`` or ``v2.5.0``;
    both are tried before giving up.
    """
    accept = "application/vnd.github+json"
    if version == "latest":
        api = f"https://api.github.com/repos/{REPO}/releases/latest"
        with urllib.request.urlopen(_request(api, accept)) as resp:
            return json.load(resp)

    last_error: Exception | None = None
    for tag in (version, f"v{version}"):
        api = f"https://api.github.com/repos/{REPO}/releases/tags/{tag}"
        try:
            with urllib.request.urlopen(_request(api, accept)) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as exc:  # 404 -> try the next spelling
            last_error = exc
            if exc.code != 404:
                raise
    raise SystemExit(
        f"No release of {REPO} found for version '{version}' "
        f"(tried tags '{version}' and 'v{version}'). {last_error}"
    )


def fetch_bundle(version: str) -> tuple[str, bytes]:
    """Return (tag, zip_bytes) for the requested flamapy release bundle."""
    release = _get_release(version)
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


def _wheel_lists(conf: dict) -> list[list]:
    """Every wheel list referenced by the manifest (core + plugins)."""
    lists = [conf["core"]["wheels"]]
    lists += [plugin["wheels"] for plugin in conf["plugins"].values()]
    return lists


def generate_manifest(wheel_filenames: list[str]) -> None:
    """Generate the served plugins.conf.json from the tracked template.

    The template lists each wheel by *distribution name* only (e.g. ``flamapy_fw``),
    so the repo never tracks versioned, build-produced filenames. This resolves each
    name against the wheels actually present and writes the runtime manifest that the
    browser loader fetches. Raises SystemExit if a templated package has no wheel.
    """
    template = json.loads(TEMPLATE_PATH.read_text())
    by_key = {package_key(name): name for name in wheel_filenames}

    missing: list[str] = []
    resolved_keys: set[str] = set()
    for wheels in _wheel_lists(template):
        for i, key in enumerate(wheels):  # template entries are bare distribution names
            resolved = by_key.get(key)
            if resolved is None:
                missing.append(key)
                continue
            wheels[i] = resolved
            resolved_keys.add(key)

    if missing:
        raise SystemExit(
            f"No wheel found in {WHEELS_DIR} for templated package(s): "
            + ", ".join(sorted(set(missing)))
            + "\nRun `make build-wheels` to fetch them."
        )

    unused = sorted(set(by_key) - resolved_keys)
    if unused:
        print(
            "WARNING: wheels present but not listed in plugins.conf.template.json "
            "(add them there if the browser should load them): "
            + ", ".join(by_key[k] for k in unused),
            file=sys.stderr,
        )

    # Write the generated manifest (2-space indent + trailing newline, matching the repo).
    CONF_PATH.write_text(json.dumps(template, indent=2) + "\n")
    print(f"Generated {CONF_PATH} ({len(resolved_keys)} wheels resolved).")


def _prune_unreferenced() -> None:
    """Delete wheels in WHEELS_DIR not referenced by the generated manifest."""
    conf = json.loads(CONF_PATH.read_text())
    referenced = {fn for wheels in _wheel_lists(conf) for fn in wheels}
    for whl in sorted(WHEELS_DIR.glob("*.whl")):
        if whl.name not in referenced:
            whl.unlink()
            print(f"  Removed stale wheel: {whl.name}")


def update(zip_bytes: bytes) -> bool:
    """Extract the release bundle into WHEELS_DIR and regenerate the manifest.

    Returns True if the bundle contained wheels."""
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as bundle:
        bundle_wheels = [os.path.basename(n) for n in bundle.namelist() if n.endswith(".whl")]
        if not bundle_wheels:
            print("Bundle contains no wheels.", file=sys.stderr)
            return False

        # Write every bundle wheel into the wheels directory.
        WHEELS_DIR.mkdir(parents=True, exist_ok=True)
        for member in bundle.namelist():
            if not member.endswith(".whl"):
                continue
            target = WHEELS_DIR / os.path.basename(member)
            with bundle.open(member) as src:
                target.write_bytes(src.read())

    generate_manifest(sorted(p.name for p in WHEELS_DIR.glob("*.whl")))
    _prune_unreferenced()
    return True


def sync_local() -> bool:
    """Generate plugins.conf.json from the wheels already present in WHEELS_DIR.

    Used at build time (``make build-wheels``): the wheels are freshly downloaded at
    the pinned ``flamapy.version``, and this resolves the tracked template against
    them. The served manifest is thus a build artifact, never committed. Returns True
    if any wheels were found.
    """
    local = sorted(p.name for p in WHEELS_DIR.glob("*.whl"))
    if not local:
        print(f"No wheels found in {WHEELS_DIR}; nothing to generate.", file=sys.stderr)
        return False
    generate_manifest(local)
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--zip",
        dest="zip_path",
        help="Use a local wheels bundle instead of downloading the latest release.",
    )
    parser.add_argument(
        "--sync-local",
        action="store_true",
        help="Don't download anything; just rewrite plugins.conf.json to match the "
             "wheels already present in the wheels directory (used by build-wheels).",
    )
    args = parser.parse_args()

    if args.sync_local:
        return 0 if sync_local() else 1

    if args.zip_path:
        print(f"Using local bundle: {args.zip_path}")
        zip_bytes = Path(args.zip_path).read_bytes()
    else:
        version = resolve_version()
        print(f"Pinned flamapy version: {version}")
        tag, zip_bytes = fetch_bundle(version)
        print(f"Using flamapy release: {tag}")

    update(zip_bytes)
    return 0


if __name__ == "__main__":
    sys.exit(main())
