.PHONY: build run clean tidy

# Binary output
BINARY=bin/server

# Load environment variables from .env file if it exists
ifneq (,$(wildcard ./.env))
	include .env
	export
endif

build:
	@echo "Building server..."
	@go build -o $(BINARY) ./cmd/server/

run: build
	@echo "Starting server..."
	@./$(BINARY)

clean:
	@echo "Cleaning..."
	@rm -rf bin/

tidy:
	@echo "Tidying dependencies..."
	@go mod tidy
