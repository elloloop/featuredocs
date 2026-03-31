package turnstile

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestVerifyValidToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/x-www-form-urlencoded" {
			t.Errorf("unexpected content type: %s", r.Header.Get("Content-Type"))
		}
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if r.FormValue("secret") != "test-secret" {
			t.Errorf("unexpected secret: %s", r.FormValue("secret"))
		}
		if r.FormValue("response") != "valid-token" {
			t.Errorf("unexpected response: %s", r.FormValue("response"))
		}
		if r.FormValue("remoteip") != "1.2.3.4" {
			t.Errorf("unexpected remoteip: %s", r.FormValue("remoteip"))
		}

		resp := verifyResponse{Success: true}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	verifier := &CloudflareVerifier{
		secretKey:  "test-secret",
		httpClient: server.Client(),
		verifyURL:  server.URL,
	}

	ok, err := verifier.Verify(context.Background(), "valid-token", "1.2.3.4")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("expected verification to succeed")
	}
}

func TestVerifyInvalidToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := verifyResponse{
			Success:    false,
			ErrorCodes: []string{"invalid-input-response"},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	verifier := &CloudflareVerifier{
		secretKey:  "test-secret",
		httpClient: server.Client(),
		verifyURL:  server.URL,
	}

	ok, err := verifier.Verify(context.Background(), "invalid-token", "1.2.3.4")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Error("expected verification to fail")
	}
}

func TestVerifyEmptyToken(t *testing.T) {
	verifier := NewCloudflareVerifier("test-secret", nil)

	ok, err := verifier.Verify(context.Background(), "", "1.2.3.4")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ok {
		t.Error("expected empty token to fail verification")
	}
}

func TestVerifyAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("not json"))
	}))
	defer server.Close()

	verifier := &CloudflareVerifier{
		secretKey:  "test-secret",
		httpClient: server.Client(),
		verifyURL:  server.URL,
	}

	_, err := verifier.Verify(context.Background(), "some-token", "1.2.3.4")
	if err == nil {
		t.Error("expected error for malformed API response")
	}
}

func TestVerifyWithoutRemoteIP(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if r.FormValue("remoteip") != "" {
			t.Errorf("expected no remoteip, got: %s", r.FormValue("remoteip"))
		}
		resp := verifyResponse{Success: true}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	verifier := &CloudflareVerifier{
		secretKey:  "test-secret",
		httpClient: server.Client(),
		verifyURL:  server.URL,
	}

	ok, err := verifier.Verify(context.Background(), "valid-token", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !ok {
		t.Error("expected verification to succeed")
	}
}
