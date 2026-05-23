# ==========================================
# BUILD STAGE
# ==========================================
FROM golang:alpine AS builder

# Install build dependencies
RUN apk add --no-cache git gcc musl-dev

WORKDIR /app

# Copy dependency files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -buildvcs=false -ldflags="-w -s" -o ftth-be main.go

# ==========================================
# RUN STAGE
# ==========================================
FROM alpine:latest

# Install runtime dependencies (certificates for Telegram API + timezone data)
RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/ftth-be .

# Copy environment template if needed, though Docker Compose will supply it
COPY --from=builder /app/.env* ./

# Set local timezone (default to Jakarta, can be overridden by environment)
ENV TZ=Asia/Jakarta

EXPOSE 8080

CMD ["./ftth-be"]
