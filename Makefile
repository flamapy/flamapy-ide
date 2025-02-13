# Default output directory for wheels
WHEELS_DIR = assets

# Define the package (can be overridden in the command)
PACKAGE ?=

.PHONY: help
help:
	@echo "Makefile for managing Python dependencies"
	@echo ""
	@echo "Usage:"
	@echo "  make dependencies PACKAGE=<package_name>  Download and build wheels for a package"
	@echo "  make clean                                Remove all downloaded files in $(WHEELS_DIR)"
	@echo "  make clean-tar                            Remove only source tarballs (.tar.gz, .zip)"
	@echo "  make help                                 Show this help message"

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
