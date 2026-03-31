// Package turnstile provides Cloudflare Turnstile token verification.
package turnstile

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

const verifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

// Verifier defines the interface for Turnstile token verification.
type Verifier interface {
	Verify(ctx context.Context, token, remoteIP string) (bool, error)
}

// CloudflareVerifier verifies tokens against the Cloudflare Turnstile API.
type CloudflareVerifier struct {
	secretKey  string
	httpClient *http.Client
	verifyURL  string
}

// NewCloudflareVerifier creates a new Turnstile verifier with the given secret key.
func NewCloudflareVerifier(secretKey string, httpClient *http.Client) *CloudflareVerifier {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &CloudflareVerifier{
		secretKey:  secretKey,
		httpClient: httpClient,
		verifyURL:  verifyURL,
	}
}

// verifyResponse represents the Cloudflare Turnstile API response.
type verifyResponse struct {
	Success    bool     `json:"success"`
	ErrorCodes []string `json:"error-codes"`
}

// Verify checks whether the given Turnstile token is valid.
// It returns true if the token is valid, false otherwise.
func (v *CloudflareVerifier) Verify(ctx context.Context, token, remoteIP string) (bool, error) {
	if token == "" {
		return false, nil
	}

	form := url.Values{
		"secret":   {v.secretKey},
		"response": {token},
	}
	if remoteIP != "" {
		form.Set("remoteip", remoteIP)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.verifyURL, strings.NewReader(form.Encode()))
	if err != nil {
		return false, fmt.Errorf("creating turnstile request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("sending turnstile request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Errorf("reading turnstile response: %w", err)
	}

	var result verifyResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return false, fmt.Errorf("parsing turnstile response: %w", err)
	}

	return result.Success, nil
}
