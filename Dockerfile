# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Go backend
FROM golang:1.22-alpine AS backend-builder
WORKDIR /app/backend
RUN apk add --no-cache git
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
# Build statically linked binary (CGO_ENABLED=0 since glebarez/sqlite does not require CGO)
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/api

# Stage 3: Runner
FROM alpine:3.18
WORKDIR /app

# Install ca-certificates and sqlite for security and utility
RUN apk add --no-cache ca-certificates sqlite

# Copy built frontend assets
COPY --from=frontend-builder /app/frontend/dist ./dist

COPY --from=backend-builder /app/backend/main ./main

# Create database directory for volume mounting and set permissions
RUN mkdir -p /app/data

# Copy default database to be used on first run
COPY backend/pagos.db ./pagos_default.db

# Set environment variables
ENV PORT=8080
ENV DB_PATH=/app/data/pagos.db
ENV GIN_MODE=release

# Expose port
EXPOSE 8080

# Run
CMD ["./main"]
