# Default output directory for wheels
WHEELS_DIR = assets

# Output directory for flamapy plugin wheels served by the IDE
FLAMAPY_WHEELS_DIR = public/flamapy

# Flamapy package versions to download from PyPI
FLAMAPY_VERSION = 2.5.0

# Core flamapy packages (pure-python, work in Pyodide as-is)
FLAMAPY_CORE_PACKAGES = \
	flamapy-fw==$(FLAMAPY_VERSION) \
	flamapy-fm==$(FLAMAPY_VERSION) \
	flamapy-sat==$(FLAMAPY_VERSION) \
	flamapy-bdd==$(FLAMAPY_VERSION) \
	flamapy-z3==$(FLAMAPY_VERSION) \
	flamapy==$(FLAMAPY_VERSION) \
	flamapy-configurator==$(FLAMAPY_VERSION)

# Third-party pure-python deps required by flamapy plugins
FLAMAPY_DEPS = \
	dd==0.5.7 \
	ply==3.11 \
	astutils==0.0.6 \
	graphviz==0.20 \
	uvlparser==2.0.1 \
	afmparser==1.0.3 \
	antlr4-python3-runtime==4.13.1

# Define the package (can be overridden in the command)
PACKAGE ?=

.PHONY: help
help:
	@echo "Makefile for managing Python dependencies"
	@echo ""
	@echo "Usage:"
	@echo "  make build-wheels                         Download flamapy wheels from PyPI into $(FLAMAPY_WHEELS_DIR)"
	@echo "  make dependencies PACKAGE=<package_name>  Download and build wheels for a package"
	@echo "  make clean                                Remove all downloaded files in $(WHEELS_DIR)"
	@echo "  make clean-tar                            Remove only source tarballs (.tar.gz, .zip)"
	@echo "  make help                                 Show this help message"

# Download pure-python wheels from PyPI into public/flamapy/ so the IDE can
# serve them via Pyodide/micropip.  Uses --no-deps so only the requested
# packages are fetched; dependency resolution happens in plugins.conf.json.
# --python-version / --platform / --abi flags restrict to pure-python wheels
# (py3-none-any) that are compatible with Pyodide's WASM environment.
.PHONY: build-wheels
build-wheels:
	@mkdir -p $(FLAMAPY_WHEELS_DIR)
	@echo "Downloading flamapy wheels from PyPI into $(FLAMAPY_WHEELS_DIR)..."
	pip download \
		--no-deps \
		--only-binary=:all: \
		--platform none \
		--python-version 3 \
		--abi none \
		--dest $(FLAMAPY_WHEELS_DIR) \
		$(FLAMAPY_CORE_PACKAGES) $(FLAMAPY_DEPS)
	@echo "Done. Wheels in $(FLAMAPY_WHEELS_DIR):"
	@ls $(FLAMAPY_WHEELS_DIR)/*.whl

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
