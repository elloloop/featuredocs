// Package ratelimit provides an IP-based in-memory rate limiter using a
// sliding window bucket algorithm.
package ratelimit

import (
	"sync"
	"time"
)

// Limiter defines the interface for rate limiting by key (typically IP address).
type Limiter interface {
	Allow(key string) bool
}

// bucket tracks request counts within a time window for a single key.
type bucket struct {
	count     int
	expiresAt time.Time
}

// InMemoryLimiter is a thread-safe, IP-based rate limiter that allows a
// configurable number of requests per time window.
type InMemoryLimiter struct {
	mu       sync.Mutex
	requests map[string]*bucket
	limit    int
	window   time.Duration
	nowFunc  func() time.Time // injectable clock for testing
}

// NewInMemoryLimiter creates a rate limiter that allows at most limit requests
// per window duration per key.
func NewInMemoryLimiter(limit int, window time.Duration) *InMemoryLimiter {
	return &InMemoryLimiter{
		requests: make(map[string]*bucket),
		limit:    limit,
		window:   window,
		nowFunc:  time.Now,
	}
}

// Allow checks whether a request from the given key (typically an IP address)
// should be allowed. Returns true if the request is within the rate limit.
func (l *InMemoryLimiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.nowFunc()

	b, exists := l.requests[key]
	if !exists || now.After(b.expiresAt) {
		// Window expired or first request: start a new window.
		l.requests[key] = &bucket{
			count:     1,
			expiresAt: now.Add(l.window),
		}
		return true
	}

	if b.count >= l.limit {
		return false
	}

	b.count++
	return true
}

// Cleanup removes expired entries from the limiter. Call periodically to
// prevent unbounded memory growth in long-running servers.
func (l *InMemoryLimiter) Cleanup() {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.nowFunc()
	for key, b := range l.requests {
		if now.After(b.expiresAt) {
			delete(l.requests, key)
		}
	}
}
