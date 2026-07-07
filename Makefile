# Default output directory for wheels
WHEELS_DIR = assets

# Output directory for flamapy plugin wheels served by the IDE
FLAMAPY_WHEELS_DIR = public/flamapy

# The flamapy-authored wheels (flamapy_fw/fm/sat/bdd/z3 + umbrella flamapy) are NOT
# downloaded here: scripts/update_flamapy_wheels.py pulls them from the flamapy GitHub
# release bundle for the version pinned in ./flamapy.version (that script resolves the
# version itself, so no FLAMAPY_VERSION is needed in this Makefile).
# Note: flamapy-configurator has no release bundle; its wheel is vendored in
# public/flamapy/ and must be updated manually when a release is made.

# Third-party pure-python deps required by flamapy plugins. These are not part of the
# flamapy release bundle, so they are fetched from PyPI (binary first, else built from
# source into a py3-none-any wheel compatible with Pyodide/WASM).
FLAMAPY_DEPS = \
	dd==0.6.0 \
	ply==3.11 \
	astutils==0.0.6 \
	graphviz==0.20 \
	uvlparser==2.5.0 \
	afmparser==1.0.3 \
	antlr4-python3-runtime==4.13.1

# Define the package (can be overridden in the command)
PACKAGE ?=

.PHONY: help
help:
	@echo "Makefile for managing Python dependencies"
	@echo ""
	@echo "Usage:"
	@echo "  make build-wheels                         Fetch flamapy wheels from the GitHub release bundle (+ deps from PyPI) into $(FLAMAPY_WHEELS_DIR)"
	@echo "  make clean-old-wheels                     Remove wheels in $(FLAMAPY_WHEELS_DIR) not listed in plugins.conf.json"
	@echo "  make dependencies PACKAGE=<package_name>  Download and build wheels for a package"
	@echo "  make clean                                Remove all downloaded files in $(WHEELS_DIR)"
	@echo "  make clean-tar                            Remove only source tarballs (.tar.gz, .zip)"
	@echo "  make help                                 Show this help message"

# Assemble the wheels served to the browser into public/flamapy/:
#   1. flamapy-authored wheels come from the flamapy GitHub *release bundle*
#      (scripts/update_flamapy_wheels.py), not PyPI.
#   2. third-party deps come from PyPI: a pre-built pure-python binary wheel first;
#      if none exists, the source is built into a wheel in an isolated venv (no
#      Cython) to guarantee a py3-none-any result compatible with Pyodide/WASM.
# --no-deps is used throughout; dependency resolution is expressed in plugins.conf.json.
.PHONY: build-wheels
build-wheels:
	@mkdir -p $(FLAMAPY_WHEELS_DIR)
	@echo "Fetching flamapy wheels from the GitHub release bundle..."
	@FLAMAPY_WHEELS_DIR=$(FLAMAPY_WHEELS_DIR) python3 scripts/update_flamapy_wheels.py
	@echo "Downloading third-party dependency wheels from PyPI..."
	@tmpdir=$$(mktemp -d); \
	mkdir -p $$tmpdir/src; \
	python3 -m venv $$tmpdir/build-env; \
	$$tmpdir/build-env/bin/pip install --quiet setuptools wheel; \
	ok=0; fail=0; \
	for pkg in $(FLAMAPY_DEPS); do \
		printf "  %-55s" "$$pkg"; \
		if python3 -m pip download --no-deps --only-binary=:all: --platform none \
				--python-version 3.11 --abi none \
				--dest $(FLAMAPY_WHEELS_DIR) "$$pkg" -q 2>/dev/null; then \
			echo "[binary]"; ok=$$((ok+1)); \
		else \
			echo "[building from source]"; \
			rm -f $$tmpdir/src/*; \
			if python3 -m pip download --no-deps --no-binary=:all: \
					--dest $$tmpdir/src "$$pkg" -q 2>/dev/null && \
			   $$tmpdir/build-env/bin/pip wheel --no-deps \
					--wheel-dir $(FLAMAPY_WHEELS_DIR) $$tmpdir/src/* -q 2>/dev/null; then \
				ok=$$((ok+1)); \
			else \
				echo "    ERROR: could not build $$pkg"; fail=$$((fail+1)); \
			fi; \
		fi; \
	done; \
	rm -rf $$tmpdir; \
	echo ""; \
	echo "Done: $$ok succeeded, $$fail failed."; \
	[ $$fail -eq 0 ]
	@echo "Generating plugins.conf.json from the template + downloaded wheels..."
	@FLAMAPY_WHEELS_DIR=$(FLAMAPY_WHEELS_DIR) python3 scripts/generate_plugins_manifest.py
	@$(MAKE) --no-print-directory clean-old-wheels
	@echo "Wheels in $(FLAMAPY_WHEELS_DIR):"; \
	ls $(FLAMAPY_WHEELS_DIR)/*.whl

# Remove any .whl files in FLAMAPY_WHEELS_DIR that are not listed in plugins.conf.json.
# This cleans up old versions left behind after upgrading packages.
.PHONY: clean-old-wheels
clean-old-wheels:
	@echo "Removing wheels not listed in $(FLAMAPY_WHEELS_DIR)/plugins.conf.json..."
	@python3 -c "import json, os, glob; \
conf = json.load(open('$(FLAMAPY_WHEELS_DIR)/plugins.conf.json')); \
needed = set(conf['core']['wheels']); \
[needed.update(p['wheels']) for p in conf['plugins'].values()]; \
stale = [f for f in sorted(glob.glob('$(FLAMAPY_WHEELS_DIR)/*.whl')) if os.path.basename(f) not in needed]; \
[print('  Removed: ' + os.path.basename(f)) or os.remove(f) for f in stale]; \
print('Done: ' + str(len(stale)) + ' wheel(s) removed.')"

.PHONY: dependencies
dependencies:
	@mkdir -p $(WHEELS_DIR)
	@echo "Downloading wheels and source distributions for $(PACKAGE)..."
	@pip download --dest $(WHEELS_DIR) $(PACKAGE) || true
	@echo "Checking for missing wheels..."
	@pip install --no-cache-dir --find-links=$(WHEELS_DIR) $(PACKAGE) || true
	@echo "Building missing wheels for $(PACKAGE)..."
	@pip wheel --find-links=$(WHEELS_DIR) --wheel-dir $(WHEELS_DIR) $(PACKAGE) || true
	@echo "All dependencies for $(PACKAGE) have been downloaded and built in $(WHEELS_DIR)"
	@$(MAKE) clean-tar  # Automatically clean tar files after building

.PHONY: clean
clean:
	@rm -rf $(WHEELS_DIR)
	@echo "Cleaned up $(WHEELS_DIR)"

.PHONY: clean-tar
clean-tar:
	@find $(WHEELS_DIR) -type f \( -name "*.tar.gz" -o -name "*.zip" \) -delete
	@echo "Removed source distributions (.tar.gz, .zip) from $(WHEELS_DIR)"
