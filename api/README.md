# featuredocs API

A gRPC/Connect API for managing feature documentation with feedback collection, content management, and multi-locale support.

## Architecture

The API uses [Connect](https://connectrpc.com/) to serve both gRPC and browser-compatible requests (Connect protocol and gRPC-Web) over a single HTTP/2 endpoint.

### Services

- **FeedbackService** -- collects user feedback on feature docs and videos, creates GitHub Issues for tracking, with Cloudflare Turnstile anti-spam and IP-based rate limiting.
- **ContentService** -- manages versioned, multi-locale feature documentation stored as markdown files on disk.

### Project Structure

```
api/
├── cmd/server/         Entry point with middleware stack
├── proto/              Protobuf service definitions
├── gen/                Generated Go code (buf)
├── internal/
│   ├── feedback/       FeedbackService implementation
│   ├── content/        ContentService implementation
│   ├── github/         GitHub Issues API client
│   ├── turnstile/      Cloudflare Turnstile verification
│   ├── ratelimit/      IP-based rate limiter
│   └── storage/        R2/S3 object storage client
├── buf.yaml            Buf module configuration
├── buf.gen.yaml        Buf code generation configuration
├── Dockerfile          Multi-stage Docker build
├── go.mod
└── go.sum
```

## Prerequisites

- Go 1.23+
- [Buf CLI](https://buf.build/docs/installation) (for proto code generation)

## Setup

```bash
# Install dependencies
go mod download

# Generate protobuf code (only needed if protos change)
buf generate

# Run tests
go test ./...

# Build
go build ./cmd/server

# Run
./server
```

## Configuration

All configuration is via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server listen port | `8080` |
| `GITHUB_TOKEN` | GitHub personal access token | (required for feedback) |
| `GITHUB_OWNER` | GitHub repository owner | (required for feedback) |
| `GITHUB_REPO` | GitHub repository name | (required for feedback) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key | (required for feedback) |
| `CONTENT_DIR` | Path to content directory | `./content` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000,http://localhost:5173` |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID | (optional) |
| `R2_ACCESS_KEY_ID` | R2 access key | (optional) |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | (optional) |
| `R2_BUCKET` | R2 bucket name | (optional) |
| `R2_PUBLIC_URL` | R2 public URL prefix | (optional) |

## Content Directory Structure

```
content/
├── myapp/
│   ├── product.json
│   ├── 1.0.0/
│   │   ├── features.json
│   │   ├── en/
│   │   │   ├── dark-mode.md
│   │   │   └── notifications.md
│   │   └── es/
│   │       ├── dark-mode.md
│   │       └── notifications.md
│   └── 1.1.0/
│       └── ...
```

### product.json

```json
{
  "slug": "myapp",
  "name": "My App",
  "tagline": "A great application",
  "locales": ["en", "es"],
  "default_locale": "en",
  "versions": ["1.0.0", "1.1.0"],
  "latest": "1.1.0"
}
```

### features.json

```json
{
  "status": "published",
  "features": [
    {
      "slug": "dark-mode",
      "title": { "en": "Dark Mode", "es": "Modo Oscuro" },
      "summary": { "en": "Enable dark theme", "es": "Activar tema oscuro" },
      "device": "mobile",
      "orientation": "portrait",
      "video": "https://cdn.example.com/dark-mode.mp4",
      "status": "published"
    }
  ]
}
```

## Docker

```bash
# Build
docker build -t featuredocs-api .

# Run
docker run -p 8080:8080 \
  -e GITHUB_TOKEN=ghp_... \
  -e GITHUB_OWNER=myorg \
  -e GITHUB_REPO=myrepo \
  -e TURNSTILE_SECRET_KEY=0x... \
  featuredocs-api
```

## API Examples

The Connect protocol supports JSON over HTTP, so you can test with curl:

```bash
# Submit feedback
curl -X POST http://localhost:8080/featuredocs.v1.FeedbackService/SubmitFeedback \
  -H "Content-Type: application/json" \
  -d '{
    "product": "myapp",
    "feature": "dark-mode",
    "comment": "The toggle is hard to find",
    "type": "FEEDBACK_TYPE_TEXT",
    "turnstileToken": "valid-token"
  }'

# List products
curl -X POST http://localhost:8080/featuredocs.v1.ContentService/ListProducts \
  -H "Content-Type: application/json" \
  -d '{}'

# Get a document
curl -X POST http://localhost:8080/featuredocs.v1.ContentService/GetDocument \
  -H "Content-Type: application/json" \
  -d '{
    "product": "myapp",
    "version": "1.1.0",
    "locale": "en",
    "featureSlug": "dark-mode"
  }'
```

## Testing

```bash
# Run all tests
go test ./...

# Run tests with verbose output
go test -v ./...

# Run tests with coverage
go test -cover ./...
```

## Design Decisions

- **Dependency injection**: All external dependencies (GitHub API, Turnstile, rate limiter, filesystem) are defined as interfaces and injected via constructors. Tests use mock implementations.
- **Connect protocol**: Serves both gRPC and HTTP/JSON from a single endpoint, making it accessible from browsers without a proxy.
- **Filesystem-based content**: Documents are stored as markdown files on disk, making them easy to version control and edit outside the API.
- **GitHub Issues as feedback store**: Avoids the need for a database while providing a familiar interface for triaging feedback.
- **Honeypot anti-spam**: In addition to Turnstile verification, the email field serves as a honeypot -- submissions with the `hp:` prefix are silently discarded.
