// Package content implements the ContentService Connect handler.
// It manages feature documentation including products, features, and
// versioned markdown documents with locale support.
package content

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"connectrpc.com/connect"
	"github.com/yuin/goldmark"

	contentpb "github.com/glassa-work/featuredocs/api/gen/featuredocs/v1"
)

// FileSystem abstracts filesystem operations for testability.
type FileSystem interface {
	ReadFile(name string) ([]byte, error)
	WriteFile(name string, data []byte, perm os.FileMode) error
	ReadDir(name string) ([]os.DirEntry, error)
	MkdirAll(path string, perm os.FileMode) error
	Stat(name string) (os.FileInfo, error)
}

// OSFileSystem implements FileSystem using the real operating system.
type OSFileSystem struct{}

func (OSFileSystem) ReadFile(name string) ([]byte, error)                 { return os.ReadFile(name) }
func (OSFileSystem) WriteFile(name string, data []byte, perm os.FileMode) error { return os.WriteFile(name, data, perm) }
func (OSFileSystem) ReadDir(name string) ([]os.DirEntry, error)           { return os.ReadDir(name) }
func (OSFileSystem) MkdirAll(path string, perm os.FileMode) error         { return os.MkdirAll(path, perm) }
func (OSFileSystem) Stat(name string) (os.FileInfo, error)                { return os.Stat(name) }

// productConfig is the on-disk representation of a product's configuration.
type productConfig struct {
	Slug          string   `json:"slug"`
	Name          string   `json:"name"`
	Tagline       string   `json:"tagline"`
	Locales       []string `json:"locales"`
	DefaultLocale string   `json:"default_locale"`
	Versions      []string `json:"versions"`
	Latest        string   `json:"latest"`
}

// featureConfig is the on-disk representation of a feature within features.json.
type featureConfig struct {
	Slug        string            `json:"slug"`
	Title       map[string]string `json:"title"`
	Summary     map[string]string `json:"summary"`
	Device      string            `json:"device"`
	Orientation string            `json:"orientation"`
	Video       string            `json:"video"`
	Status      string            `json:"status"`
}

// featuresFile is the top-level structure of features.json.
type featuresFile struct {
	Status   string          `json:"status"`
	Features []featureConfig `json:"features"`
}

// Service implements the ContentService Connect handler.
type Service struct {
	contentDir string
	fileSystem FileSystem
	markdown   goldmark.Markdown
	logger     *slog.Logger
}

// NewService creates a new ContentService that reads content from the given directory.
func NewService(contentDir string, fileSystem FileSystem, logger *slog.Logger) *Service {
	if fileSystem == nil {
		fileSystem = OSFileSystem{}
	}
	return &Service{
		contentDir: contentDir,
		fileSystem: fileSystem,
		markdown:   goldmark.New(),
		logger:     logger,
	}
}

// ListProducts returns all products found in the content directory.
func (s *Service) ListProducts(
	ctx context.Context,
	req *connect.Request[contentpb.ListProductsRequest],
) (*connect.Response[contentpb.ListProductsResponse], error) {
	entries, err := s.fileSystem.ReadDir(s.contentDir)
	if err != nil {
		s.logger.Error("failed to read content directory", "error", err, "dir", s.contentDir)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to list products"))
	}

	var products []*contentpb.Product
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		product, err := s.loadProduct(entry.Name())
		if err != nil {
			s.logger.Warn("skipping invalid product directory",
				"dir", entry.Name(),
				"error", err,
			)
			continue
		}
		products = append(products, product)
	}

	return connect.NewResponse(&contentpb.ListProductsResponse{
		Products: products,
	}), nil
}

// GetProduct returns details for a specific product identified by slug.
func (s *Service) GetProduct(
	ctx context.Context,
	req *connect.Request[contentpb.GetProductRequest],
) (*connect.Response[contentpb.GetProductResponse], error) {
	if req.Msg.Slug == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("slug is required"))
	}

	product, err := s.loadProduct(req.Msg.Slug)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("product %q not found", req.Msg.Slug))
	}

	return connect.NewResponse(&contentpb.GetProductResponse{
		Product: product,
	}), nil
}

// ListFeatures returns all features for a product version.
func (s *Service) ListFeatures(
	ctx context.Context,
	req *connect.Request[contentpb.ListFeaturesRequest],
) (*connect.Response[contentpb.ListFeaturesResponse], error) {
	msg := req.Msg

	if msg.Product == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("product is required"))
	}

	version := msg.Version
	if version == "" {
		// Default to the latest version.
		product, err := s.loadProduct(msg.Product)
		if err != nil {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("product %q not found", msg.Product))
		}
		version = product.Latest
	}

	featFile, err := s.loadFeaturesFile(msg.Product, version)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("features not found for %s/%s", msg.Product, version))
	}

	var features []*contentpb.Feature
	for _, fc := range featFile.Features {
		if !msg.IncludeDrafts && fc.Status == "draft" {
			continue
		}
		features = append(features, featureConfigToProto(fc))
	}

	return connect.NewResponse(&contentpb.ListFeaturesResponse{
		Features:      features,
		VersionStatus: featFile.Status,
	}), nil
}

// GetDocument returns a feature document with both raw markdown and rendered HTML.
func (s *Service) GetDocument(
	ctx context.Context,
	req *connect.Request[contentpb.GetDocumentRequest],
) (*connect.Response[contentpb.GetDocumentResponse], error) {
	msg := req.Msg

	if msg.Product == "" || msg.FeatureSlug == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("product and feature_slug are required"))
	}

	version := msg.Version
	if version == "" {
		product, err := s.loadProduct(msg.Product)
		if err != nil {
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("product %q not found", msg.Product))
		}
		version = product.Latest
	}

	// Load the features file to find the feature metadata.
	featFile, err := s.loadFeaturesFile(msg.Product, version)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("version %q not found for product %q", version, msg.Product))
	}

	var feature *featureConfig
	for i := range featFile.Features {
		if featFile.Features[i].Slug == msg.FeatureSlug {
			feature = &featFile.Features[i]
			break
		}
	}
	if feature == nil {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("feature %q not found", msg.FeatureSlug))
	}

	// Determine locale with fallback.
	locale := msg.Locale
	if locale == "" {
		product, err := s.loadProduct(msg.Product)
		if err == nil && product.DefaultLocale != "" {
			locale = product.DefaultLocale
		} else {
			locale = "en"
		}
	}

	// Try the requested locale first, then fall back to default locale.
	content, err := s.readDocumentWithFallback(msg.Product, version, locale, msg.FeatureSlug)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("document not found for %s/%s/%s/%s", msg.Product, version, locale, msg.FeatureSlug))
	}

	// Render markdown to HTML.
	renderedHTML, err := s.renderMarkdown(content)
	if err != nil {
		s.logger.Error("failed to render markdown",
			"error", err,
			"product", msg.Product,
			"feature", msg.FeatureSlug,
		)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to render document"))
	}

	return connect.NewResponse(&contentpb.GetDocumentResponse{
		Content:      content,
		RenderedHtml: renderedHTML,
		Feature:      featureConfigToProto(*feature),
	}), nil
}

// SaveDocument writes a markdown document to the content directory.
func (s *Service) SaveDocument(
	ctx context.Context,
	req *connect.Request[contentpb.SaveDocumentRequest],
) (*connect.Response[contentpb.SaveDocumentResponse], error) {
	msg := req.Msg

	if msg.Product == "" || msg.Version == "" || msg.Locale == "" || msg.FeatureSlug == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("product, version, locale, and feature_slug are required"))
	}
	if msg.Content == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("content must not be empty"))
	}

	// Validate the path components to prevent directory traversal.
	for _, component := range []string{msg.Product, msg.Version, msg.Locale, msg.FeatureSlug} {
		if strings.Contains(component, "..") || strings.Contains(component, "/") {
			return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid path component: %q", component))
		}
	}

	docDir := filepath.Join(s.contentDir, msg.Product, msg.Version, msg.Locale)
	if err := s.fileSystem.MkdirAll(docDir, 0o755); err != nil {
		s.logger.Error("failed to create document directory", "error", err, "dir", docDir)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to save document"))
	}

	docPath := filepath.Join(docDir, msg.FeatureSlug+".md")
	if err := s.fileSystem.WriteFile(docPath, []byte(msg.Content), 0o644); err != nil {
		s.logger.Error("failed to write document", "error", err, "path", docPath)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to save document"))
	}

	s.logger.Info("document saved",
		"product", msg.Product,
		"version", msg.Version,
		"locale", msg.Locale,
		"feature", msg.FeatureSlug,
		"message", msg.EditMessage,
	)

	return connect.NewResponse(&contentpb.SaveDocumentResponse{
		Success: true,
		Message: fmt.Sprintf("Document saved: %s/%s/%s/%s", msg.Product, msg.Version, msg.Locale, msg.FeatureSlug),
	}), nil
}

// PublishVersion updates the status of all features in a version to "published".
func (s *Service) PublishVersion(
	ctx context.Context,
	req *connect.Request[contentpb.PublishVersionRequest],
) (*connect.Response[contentpb.PublishVersionResponse], error) {
	msg := req.Msg

	if msg.Product == "" || msg.Version == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("product and version are required"))
	}

	featuresPath := filepath.Join(s.contentDir, msg.Product, msg.Version, "features.json")

	data, err := s.fileSystem.ReadFile(featuresPath)
	if err != nil {
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("features.json not found for %s/%s", msg.Product, msg.Version))
	}

	var featFile featuresFile
	if err := json.Unmarshal(data, &featFile); err != nil {
		s.logger.Error("failed to parse features.json", "error", err, "path", featuresPath)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to read features configuration"))
	}

	// Update the version status and all feature statuses.
	featFile.Status = "published"
	for i := range featFile.Features {
		featFile.Features[i].Status = "published"
	}

	updatedData, err := json.MarshalIndent(featFile, "", "  ")
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to serialize features configuration"))
	}

	if err := s.fileSystem.WriteFile(featuresPath, updatedData, 0o644); err != nil {
		s.logger.Error("failed to write features.json", "error", err, "path", featuresPath)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to publish version"))
	}

	s.logger.Info("version published",
		"product", msg.Product,
		"version", msg.Version,
		"features_count", len(featFile.Features),
	)

	return connect.NewResponse(&contentpb.PublishVersionResponse{
		Success: true,
		Message: fmt.Sprintf("Published %s v%s (%d features)", msg.Product, msg.Version, len(featFile.Features)),
	}), nil
}

// loadProduct reads and parses a product's product.json configuration.
func (s *Service) loadProduct(slug string) (*contentpb.Product, error) {
	productPath := filepath.Join(s.contentDir, slug, "product.json")
	data, err := s.fileSystem.ReadFile(productPath)
	if err != nil {
		return nil, fmt.Errorf("reading product.json: %w", err)
	}

	var config productConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("parsing product.json: %w", err)
	}

	// If versions not in config, scan subdirectories for version folders.
	if len(config.Versions) == 0 {
		config.Versions, _ = s.scanVersionDirectories(slug)
	}

	// Sort versions in reverse order so newest is first.
	sort.Sort(sort.Reverse(sort.StringSlice(config.Versions)))

	if config.Latest == "" && len(config.Versions) > 0 {
		config.Latest = config.Versions[0]
	}

	return &contentpb.Product{
		Slug:          config.Slug,
		Name:          config.Name,
		Tagline:       config.Tagline,
		Locales:       config.Locales,
		DefaultLocale: config.DefaultLocale,
		Versions:      config.Versions,
		Latest:        config.Latest,
	}, nil
}

// scanVersionDirectories finds version-like subdirectories for a product.
func (s *Service) scanVersionDirectories(slug string) ([]string, error) {
	productDir := filepath.Join(s.contentDir, slug)
	entries, err := s.fileSystem.ReadDir(productDir)
	if err != nil {
		return nil, err
	}

	var versions []string
	for _, entry := range entries {
		if entry.IsDir() && isVersionDirectory(entry.Name()) {
			versions = append(versions, entry.Name())
		}
	}
	return versions, nil
}

// isVersionDirectory checks if a directory name looks like a semantic version.
func isVersionDirectory(name string) bool {
	parts := strings.Split(name, ".")
	if len(parts) < 2 {
		return false
	}
	for _, part := range parts {
		for _, r := range part {
			if r < '0' || r > '9' {
				return false
			}
		}
	}
	return true
}

// loadFeaturesFile reads and parses the features.json for a product version.
func (s *Service) loadFeaturesFile(product, version string) (*featuresFile, error) {
	featuresPath := filepath.Join(s.contentDir, product, version, "features.json")
	data, err := s.fileSystem.ReadFile(featuresPath)
	if err != nil {
		return nil, fmt.Errorf("reading features.json: %w", err)
	}

	var ff featuresFile
	if err := json.Unmarshal(data, &ff); err != nil {
		return nil, fmt.Errorf("parsing features.json: %w", err)
	}

	return &ff, nil
}

// readDocumentWithFallback tries to read a markdown document in the requested
// locale, falling back to the product's default locale if not found.
func (s *Service) readDocumentWithFallback(product, version, locale, featureSlug string) (string, error) {
	// Try the requested locale first.
	docPath := filepath.Join(s.contentDir, product, version, locale, featureSlug+".md")
	data, err := s.fileSystem.ReadFile(docPath)
	if err == nil {
		return string(data), nil
	}

	// Fall back to the default locale.
	productProto, err := s.loadProduct(product)
	if err != nil {
		return "", fmt.Errorf("loading product for locale fallback: %w", err)
	}

	if productProto.DefaultLocale != "" && productProto.DefaultLocale != locale {
		fallbackPath := filepath.Join(s.contentDir, product, version, productProto.DefaultLocale, featureSlug+".md")
		data, err = s.fileSystem.ReadFile(fallbackPath)
		if err == nil {
			return string(data), nil
		}
	}

	return "", fmt.Errorf("document not found in any locale")
}

// renderMarkdown converts markdown content to HTML.
func (s *Service) renderMarkdown(content string) (string, error) {
	var buf bytes.Buffer
	if err := s.markdown.Convert([]byte(content), &buf); err != nil {
		return "", fmt.Errorf("rendering markdown: %w", err)
	}
	return buf.String(), nil
}

// featureConfigToProto converts an internal featureConfig to the proto representation.
func featureConfigToProto(fc featureConfig) *contentpb.Feature {
	return &contentpb.Feature{
		Slug:        fc.Slug,
		Title:       fc.Title,
		Summary:     fc.Summary,
		Device:      fc.Device,
		Orientation: fc.Orientation,
		Video:       fc.Video,
		Status:      fc.Status,
	}
}
