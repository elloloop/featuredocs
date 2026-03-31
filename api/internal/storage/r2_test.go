package storage

import (
	"testing"
)

func TestGetURL(t *testing.T) {
	client := &R2Client{
		publicURL: "https://cdn.example.com",
		bucket:    "test-bucket",
	}

	url := client.GetURL("videos/feedback-123.mp4")
	expected := "https://cdn.example.com/videos/feedback-123.mp4"

	if url != expected {
		t.Errorf("expected %q, got %q", expected, url)
	}
}

func TestGetURLNoTrailingSlash(t *testing.T) {
	client := &R2Client{
		publicURL: "https://cdn.example.com",
		bucket:    "test-bucket",
	}

	url := client.GetURL("file.txt")
	expected := "https://cdn.example.com/file.txt"

	if url != expected {
		t.Errorf("expected %q, got %q", expected, url)
	}
}

func TestNewR2Client(t *testing.T) {
	config := R2Config{
		AccountID:       "test-account-id",
		AccessKeyID:     "test-key",
		SecretAccessKey: "test-secret",
		Bucket:          "test-bucket",
		PublicURL:       "https://cdn.example.com",
	}

	client := NewR2Client(config)

	if client.bucket != "test-bucket" {
		t.Errorf("expected bucket 'test-bucket', got %q", client.bucket)
	}
	if client.publicURL != "https://cdn.example.com" {
		t.Errorf("expected publicURL 'https://cdn.example.com', got %q", client.publicURL)
	}
	if client.s3Client == nil {
		t.Error("expected s3Client to be initialized")
	}
}
