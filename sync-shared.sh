#!/bin/bash
# Sync shared code to all services

echo "Syncing shared code to all services..."

# Services that need shared code
services=("backend" "frontend" "data-refresh" "data-analysis")

# Copy shared directory to each service
for service in "${services[@]}"; do
    echo "Syncing to $service..."
    rm -rf "services/$service/shared"
    cp -r "services/shared" "services/$service/"
done

echo "Shared code sync completed!"