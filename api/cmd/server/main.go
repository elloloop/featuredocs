// Package main is the entry point for the featuredocs API server.
// It creates Connect handlers for both FeedbackService and ContentService,
// wires up CORS middleware, request logging, and serves over HTTP/2 with h2c.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"connectrpc.com/connect"
	"github.com/rs/cors"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	"github.com/glassa-work/featuredocs/api/gen/featuredocs/v1/featuredocsv1connect"
	"github.com/glassa-work/featuredocs/api/internal/content"
	"github.com/glassa-work/featuredocs/api/internal/feedback"
	"github.com/glassa-work/featuredocs/api/internal/github"
	"github.com/glassa-work/featuredocs/api/internal/ratelimit"
	"github.com/glassa-work/featuredocs/api/internal/turnstile"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	config := loadConfig()

	// Build dependencies.
	githubClient := github.NewClient(
		config.githubOwner,
		config.githubRepo,
		config.githubToken,
		nil,
	)
	turnstileVerifier := turnstile.NewCloudflareVerifier(config.turnstileSecretKey, nil)
	rateLimiter := ratelimit.NewInMemoryLimiter(config.rateLimitMax, config.rateLimitWindow)

	// Start periodic rate limiter cleanup.
	go startRateLimiterCleanup(rateLimiter, 5*time.Minute)

	// Build services.
	feedbackService := feedback.NewService(githubClient, turnstileVerifier, rateLimiter, logger)
	contentService := content.NewService(config.contentDir, nil, logger)

	// Build the HTTP mux with Connect handlers.
	mux := http.NewServeMux()

	interceptors := connect.WithInterceptors(newLoggingInterceptor(logger))

	feedbackPath, feedbackHandler := featuredocsv1connect.NewFeedbackServiceHandler(
		feedbackService,
		interceptors,
	)
	mux.Handle(feedbackPath, feedbackHandler)

	contentPath, contentHandler := featuredocsv1connect.NewContentServiceHandler(
		contentService,
		interceptors,
	)
	mux.Handle(contentPath, contentHandler)

	// Health check endpoint.
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// Wrap with CORS middleware for browser access.
	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   config.corsOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Connect-Protocol-Version", "Connect-Timeout-Ms", "Grpc-Timeout", "X-Grpc-Web", "X-User-Agent"},
		ExposedHeaders:   []string{"Grpc-Status", "Grpc-Message", "Grpc-Status-Details-Bin"},
		AllowCredentials: true,
		MaxAge:           7200,
	}).Handler(mux)

	// Use h2c so we can serve HTTP/2 without TLS (for development and
	// environments where TLS is terminated at the load balancer).
	handler := h2c.NewHandler(corsHandler, &http2.Server{})

	server := &http.Server{
		Addr:              ":" + config.port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Graceful shutdown.
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		sig := <-sigChan
		logger.Info("received shutdown signal", "signal", sig)

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			logger.Error("server shutdown error", "error", err)
		}
	}()

	logger.Info("starting featuredocs API server",
		"port", config.port,
		"content_dir", config.contentDir,
	)

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("server listen error", "error", err)
		os.Exit(1)
	}

	logger.Info("server stopped")
}

// serverConfig holds all configuration loaded from environment variables.
type serverConfig struct {
	port               string
	githubToken        string
	githubOwner        string
	githubRepo         string
	turnstileSecretKey string
	contentDir         string
	corsOrigins        []string
	rateLimitMax       int
	rateLimitWindow    time.Duration
}

// loadConfig reads configuration from environment variables with sensible defaults.
func loadConfig() serverConfig {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	contentDir := os.Getenv("CONTENT_DIR")
	if contentDir == "" {
		contentDir = "./content"
	}

	corsOrigins := []string{"http://localhost:3000", "http://localhost:5173"}
	if origins := os.Getenv("CORS_ORIGINS"); origins != "" {
		corsOrigins = splitAndTrim(origins, ",")
	}

	return serverConfig{
		port:               port,
		githubToken:        os.Getenv("GITHUB_TOKEN"),
		githubOwner:        os.Getenv("GITHUB_OWNER"),
		githubRepo:         os.Getenv("GITHUB_REPO"),
		turnstileSecretKey: os.Getenv("TURNSTILE_SECRET_KEY"),
		contentDir:         contentDir,
		corsOrigins:        corsOrigins,
		rateLimitMax:       10,
		rateLimitWindow:    time.Minute,
	}
}

// splitAndTrim splits a string by separator and trims whitespace from each part.
func splitAndTrim(s, sep string) []string {
	parts := make([]string, 0)
	for _, part := range splitString(s, sep) {
		trimmed := trimSpace(part)
		if trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return parts
}

// splitString splits s by separator (avoiding import of "strings" in main for clarity).
func splitString(s, sep string) []string {
	var result []string
	for {
		i := indexOf(s, sep)
		if i < 0 {
			result = append(result, s)
			break
		}
		result = append(result, s[:i])
		s = s[i+len(sep):]
	}
	return result
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

func trimSpace(s string) string {
	start, end := 0, len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}
	return s[start:end]
}

// startRateLimiterCleanup periodically removes expired entries from the rate limiter.
func startRateLimiterCleanup(limiter *ratelimit.InMemoryLimiter, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for range ticker.C {
		limiter.Cleanup()
	}
}

// loggingInterceptor logs Connect RPC calls with timing information.
type loggingInterceptor struct {
	logger *slog.Logger
}

func newLoggingInterceptor(logger *slog.Logger) *loggingInterceptor {
	return &loggingInterceptor{logger: logger}
}

func (i *loggingInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		start := time.Now()
		resp, err := next(ctx, req)
		duration := time.Since(start)

		level := slog.LevelInfo
		if err != nil {
			level = slog.LevelError
		}

		i.logger.Log(ctx, level, "rpc call",
			"procedure", req.Spec().Procedure,
			"duration_ms", duration.Milliseconds(),
			"peer", req.Peer().Addr,
			"error", err,
		)

		return resp, err
	}
}

func (i *loggingInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return next
}

func (i *loggingInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return next
}

func init() {
	// Ensure the loggingInterceptor implements the connect.Interceptor interface.
	var _ connect.Interceptor = (*loggingInterceptor)(nil)
}

// formatDuration formats a duration in a human-readable way.
func formatDuration(d time.Duration) string {
	if d < time.Millisecond {
		return fmt.Sprintf("%dus", d.Microseconds())
	}
	return fmt.Sprintf("%dms", d.Milliseconds())
}
