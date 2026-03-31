package ratelimit

import (
	"sync"
	"testing"
	"time"
)

func TestAllowFirstRequest(t *testing.T) {
	limiter := NewInMemoryLimiter(5, time.Minute)

	if !limiter.Allow("192.168.1.1") {
		t.Error("expected first request to be allowed")
	}
}

func TestAllowUpToLimit(t *testing.T) {
	limiter := NewInMemoryLimiter(3, time.Minute)

	for i := 0; i < 3; i++ {
		if !limiter.Allow("192.168.1.1") {
			t.Errorf("request %d should be allowed", i+1)
		}
	}

	if limiter.Allow("192.168.1.1") {
		t.Error("request beyond limit should be denied")
	}
}

func TestAllowAfterWindowExpires(t *testing.T) {
	limiter := NewInMemoryLimiter(1, time.Minute)

	now := time.Now()
	limiter.nowFunc = func() time.Time { return now }

	if !limiter.Allow("192.168.1.1") {
		t.Error("first request should be allowed")
	}

	if limiter.Allow("192.168.1.1") {
		t.Error("second request within window should be denied")
	}

	// Advance time past the window.
	limiter.nowFunc = func() time.Time { return now.Add(2 * time.Minute) }

	if !limiter.Allow("192.168.1.1") {
		t.Error("request after window expired should be allowed")
	}
}

func TestAllowDifferentIPsTrackedIndependently(t *testing.T) {
	limiter := NewInMemoryLimiter(1, time.Minute)

	if !limiter.Allow("192.168.1.1") {
		t.Error("first IP first request should be allowed")
	}

	if limiter.Allow("192.168.1.1") {
		t.Error("first IP second request should be denied")
	}

	if !limiter.Allow("192.168.1.2") {
		t.Error("second IP first request should be allowed")
	}
}

func TestConcurrentAccess(t *testing.T) {
	limiter := NewInMemoryLimiter(100, time.Minute)

	var wg sync.WaitGroup
	allowed := make(chan bool, 200)

	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			allowed <- limiter.Allow("192.168.1.1")
		}()
	}

	wg.Wait()
	close(allowed)

	allowedCount := 0
	for result := range allowed {
		if result {
			allowedCount++
		}
	}

	if allowedCount != 100 {
		t.Errorf("expected exactly 100 allowed requests, got %d", allowedCount)
	}
}

func TestCleanup(t *testing.T) {
	limiter := NewInMemoryLimiter(1, time.Minute)

	now := time.Now()
	limiter.nowFunc = func() time.Time { return now }

	limiter.Allow("192.168.1.1")
	limiter.Allow("192.168.1.2")

	// Advance time past the window.
	limiter.nowFunc = func() time.Time { return now.Add(2 * time.Minute) }

	limiter.Cleanup()

	limiter.mu.Lock()
	count := len(limiter.requests)
	limiter.mu.Unlock()

	if count != 0 {
		t.Errorf("expected 0 entries after cleanup, got %d", count)
	}
}
