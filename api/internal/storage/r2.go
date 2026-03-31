// Package storage provides an abstraction over R2/S3-compatible object storage.
package storage

import (
	"context"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// ObjectStore defines the interface for object storage operations.
type ObjectStore interface {
	Upload(ctx context.Context, key string, body io.Reader, contentType string) error
	GetURL(key string) string
}

// R2Client implements ObjectStore using Cloudflare R2 (S3-compatible).
type R2Client struct {
	s3Client  *s3.Client
	bucket    string
	publicURL string
}

// R2Config holds the configuration for connecting to a Cloudflare R2 bucket.
type R2Config struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	PublicURL       string // Public URL prefix for the bucket (e.g., "https://cdn.example.com")
}

// NewR2Client creates a new R2 storage client.
func NewR2Client(config R2Config) *R2Client {
	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", config.AccountID)

	s3Client := s3.New(s3.Options{
		BaseEndpoint: aws.String(endpoint),
		Region:       "auto",
		Credentials:  credentials.NewStaticCredentialsProvider(config.AccessKeyID, config.SecretAccessKey, ""),
	})

	return &R2Client{
		s3Client:  s3Client,
		bucket:    config.Bucket,
		publicURL: config.PublicURL,
	}
}

// Upload stores an object in the R2 bucket with the given key and content type.
func (c *R2Client) Upload(ctx context.Context, key string, body io.Reader, contentType string) error {
	_, err := c.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(c.bucket),
		Key:         aws.String(key),
		Body:        body,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return fmt.Errorf("uploading to R2 bucket %q key %q: %w", c.bucket, key, err)
	}
	return nil
}

// GetURL returns the public URL for the given object key.
func (c *R2Client) GetURL(key string) string {
	return fmt.Sprintf("%s/%s", c.publicURL, key)
}
