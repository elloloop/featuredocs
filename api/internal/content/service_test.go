package content

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"connectrpc.com/connect"

	contentpb "github.com/glassa-work/featuredocs/api/gen/featuredocs/v1"
)

// --- Mock filesystem ---

type mockFileSystem struct {
	files map[string][]byte
	dirs  map[string][]mockDirEntry
}

type mockDirEntry struct {
	name  string
	isDir bool
}

func (e mockDirEntry) Name() string               { return e.name }
func (e mockDirEntry) IsDir() bool                 { return e.isDir }
func (e mockDirEntry) Type() fs.FileMode           { return 0 }
func (e mockDirEntry) Info() (fs.FileInfo, error)  { return mockFileInfo{name: e.name, isDir: e.isDir}, nil }

type mockFileInfo struct {
	name  string
	isDir bool
}

func (fi mockFileInfo) Name() string      { return fi.name }
func (fi mockFileInfo) Size() int64       { return 0 }
func (fi mockFileInfo) Mode() fs.FileMode { return 0 }
func (fi mockFileInfo) ModTime() time.Time { return time.Time{} }
func (fi mockFileInfo) IsDir() bool       { return fi.isDir }
func (fi mockFileInfo) Sys() any          { return nil }

func newMockFS() *mockFileSystem {
	return &mockFileSystem{
		files: make(map[string][]byte),
		dirs:  make(map[string][]mockDirEntry),
	}
}

func (m *mockFileSystem) ReadFile(name string) ([]byte, error) {
	data, ok := m.files[name]
	if !ok {
		return nil, fmt.Errorf("file not found: %s", name)
	}
	return data, nil
}

func (m *mockFileSystem) WriteFile(name string, data []byte, perm os.FileMode) error {
	m.files[name] = data
	return nil
}

func (m *mockFileSystem) ReadDir(name string) ([]os.DirEntry, error) {
	entries, ok := m.dirs[name]
	if !ok {
		return nil, fmt.Errorf("directory not found: %s", name)
	}
	result := make([]os.DirEntry, len(entries))
	for i, e := range entries {
		result[i] = e
	}
	return result, nil
}

func (m *mockFileSystem) MkdirAll(path string, perm os.FileMode) error {
	return nil
}

func (m *mockFileSystem) Stat(name string) (os.FileInfo, error) {
	if _, ok := m.files[name]; ok {
		return mockFileInfo{name: name}, nil
	}
	return nil, fmt.Errorf("not found: %s", name)
}

// --- Test helpers ---

func setupTestContent(mockFS *mockFileSystem) {
	productJSON, _ := json.Marshal(productConfig{
		Slug:          "myapp",
		Name:          "My App",
		Tagline:       "A great app",
		Locales:       []string{"en", "es"},
		DefaultLocale: "en",
		Versions:      []string{"1.0.0", "1.1.0"},
		Latest:        "1.1.0",
	})
	mockFS.files["/content/myapp/product.json"] = productJSON

	featuresJSON, _ := json.Marshal(featuresFile{
		Status: "draft",
		Features: []featureConfig{
			{
				Slug:        "dark-mode",
				Title:       map[string]string{"en": "Dark Mode", "es": "Modo Oscuro"},
				Summary:     map[string]string{"en": "Enable dark mode", "es": "Activar modo oscuro"},
				Device:      "mobile",
				Orientation: "portrait",
				Video:       "https://cdn.example.com/dark-mode.mp4",
				Status:      "published",
			},
			{
				Slug:   "notifications",
				Title:  map[string]string{"en": "Notifications"},
				Status: "draft",
			},
		},
	})
	mockFS.files["/content/myapp/1.1.0/features.json"] = featuresJSON

	mockFS.files["/content/myapp/1.1.0/en/dark-mode.md"] = []byte("# Dark Mode\n\nEnable dark theme for your app.")
	mockFS.files["/content/myapp/1.1.0/es/dark-mode.md"] = []byte("# Modo Oscuro\n\nActiva el tema oscuro para tu app.")

	mockFS.dirs["/content"] = []mockDirEntry{
		{name: "myapp", isDir: true},
	}
	mockFS.dirs["/content/myapp"] = []mockDirEntry{
		{name: "product.json", isDir: false},
		{name: "1.0.0", isDir: true},
		{name: "1.1.0", isDir: true},
	}
}

func newTestService(mockFS *mockFileSystem) *Service {
	return NewService("/content", mockFS, slog.Default())
}

// --- Tests ---

func TestListProducts(t *testing.T) {
	mockFS := newMockFS()
	setupTestContent(mockFS)
	svc := newTestService(mockFS)

	resp, err := svc.ListProducts(context.Background(), connect.NewRequest(&contentpb.ListProductsRequest{}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Msg.Products) != 1 {
		t.Fatalf("expected 1 product, got %d", len(resp.Msg.Products))
	}
	if resp.Msg.Products[0].Slug != "myapp" {
		t.Errorf("expected slug 'myapp', got %q", resp.Msg.Products[0].Slug)
	}
	if resp.Msg.Products[0].Name != "My App" {
		t.Errorf("expected name 'My App', got %q", resp.Msg.Products[0].Name)
	}
}

func TestGetProduct(t *testing.T) {
	mockFS := newMockFS()
	setupTestContent(mockFS)
	svc := newTestService(mockFS)

	resp, err := svc.GetProduct(context.Background(), connect.NewRequest(&contentpb.GetProductRequest{
		Slug: "myapp",
	}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	p := resp.Msg.Product
	if p.Slug != "myapp" {
		t.Errorf("expected slug 'myapp', got %q", p.Slug)
	}
	if p.Latest != "1.1.0" {
		t.Errorf("expected latest '1.1.0', got %q", p.Latest)
	}
	if len(p.Locales) != 2 {
		t.Errorf("expected 2 locales, got %d", len(p.Locales))
	}
}

func TestGetProductNotFound(t *testing.T) {
	mockFS := newMockFS()
	setupTestContent(mockFS)
	svc := newTestService(mockFS)

	_, err := svc.GetProduct(context.Background(), connect.NewRequest(&contentpb.GetProductRequest{
		Slug: "nonexistent",
	}))
	if err == nil {
		t.Fatal("expected error for nonexistent product")
	}
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Errorf("expected CodeNotFound, got %v", connect.CodeOf(err))
	}
}

func TestGetProductEmptySlug(t *testing.T) {
	mockFS := newMockFS()
	svc := newTestService(mockFS)

	_, err := svc.GetProduct(context.Background(), connect.NewRequest(&contentpb.GetProductRequest{}))
	if err == nil {
		t.Fatal("expected error for empty slug")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected CodeInvalidArgument, got %v", connect.CodeOf(err))
	}
}

func TestListFeaturesFiltersDrafts(t *testing.T) {
	mockFS := newMockFS()
	setupTestContent(mockFS)
	svc := newTestService(mockFS)

	// Without drafts
	resp, err := svc.ListFeatures(context.Background(), connect.NewRequest(&contentpb.ListFeaturesRequest{
		Product:       "myapp",
		Version:       "1.1.0",
		IncludeDrafts: false,
	}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Msg.Features) != 1 {
		t.Fatalf("expected 1 published feature, got %d", len(resp.Msg.Features))
	}
	if resp.Msg.Features[0].Slug != "dark-mode" {
		t.Errorf("expected 'dark-mode', got %q", resp.Msg.Features[0].Slug)
	}

	// With drafts
	resp, err = svc.ListFeatures(context.Background(), connect.NewRequest(&contentpb.ListFeaturesRequest{
		Product:       "myapp",
		Version:       "1.1.0",
		IncludeDrafts: true,
	}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Msg.Features) != 2 {
		t.Fatalf("expected 2 features with drafts, got %d", len(resp.Msg.Features))
	}
}

func TestListFeaturesDefaultVersion(t *testing.T) {
	mockFS := newMockFS()
	setupTestContent(mockFS)
	svc := newTestService(mockFS)

	resp, err := svc.ListFeatures(context.Background(), connect.NewRequest(&contentpb.ListFeaturesRequest{
		Product: "myapp",
		// Version intentionally empty - should default to latest
	}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Msg.VersionStatus != "draft" {
		t.Errorf("expected version status 'draft', got %q", resp.Msg.VersionStatus)
	}
}

func TestGetDocument(t *testing.T) {
	mockFS := newMockFS()
	setupTestContent(mockFS)
	svc := newTestService(mockFS)

	resp, err := svc.GetDocument(context.Background(), connect.NewRequest(&contentpb.GetDocumentRequest{
		Product:     "myapp",
		Version:     "1.1.0",
		Locale:      "en",
		FeatureSlug: "dark-mode",
	}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Msg.Content != "# Dark Mode\n\nEnable dark theme for your app." {
		t.Errorf("unexpected content: %q", resp.Msg.Content)
	}
	if !strings.Contains(resp.Msg.RenderedHtml, "<h1>Dark Mode</h1>") {
		t.Errorf("expected rendered HTML to contain <h1>, got: %q", resp.Msg.RenderedHtml)
	}
	if resp.Msg.Feature.Slug != "dark-mode" {
		t.Errorf("expected feature slug 'dark-mode', got %q", resp.Msg.Feature.Slug)
	}
}

func TestGetDocumentLocaleFallback(t *testing.T) {
	mockFS := newMockFS()
	setupTestContent(mockFS)
	svc := newTestService(mockFS)

	// Request French, which doesn't exist - should fall back to English (default).
	resp, err := svc.GetDocument(context.Background(), connect.NewRequest(&contentpb.GetDocumentRequest{
		Product:     "myapp",
		Version:     "1.1.0",
		Locale:      "fr",
		FeatureSlug: "dark-mode",
	}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(resp.Msg.Content, "Dark Mode") {
		t.Error("expected English fallback content")
	}
}

func TestGetDocumentDefaultLocale(t *testing.T) {
	mockFS := newMockFS()
	setupTestContent(mockFS)
	svc := newTestService(mockFS)

	// Request without locale - should use product default (en).
	resp, err := svc.GetDocument(context.Background(), connect.NewRequest(&contentpb.GetDocumentRequest{
		Product:     "myapp",
		Version:     "1.1.0",
		FeatureSlug: "dark-mode",
	}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(resp.Msg.Content, "Dark Mode") {
		t.Error("expected English content when no locale specified")
	}
}

func TestGetDocumentSpanishLocale(t *testing.T) {
	mockFS := newMockFS()
	setupTestContent(mockFS)
	svc := newTestService(mockFS)

	resp, err := svc.GetDocument(context.Background(), connect.NewRequest(&contentpb.GetDocumentRequest{
		Product:     "myapp",
		Version:     "1.1.0",
		Locale:      "es",
		FeatureSlug: "dark-mode",
	}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(resp.Msg.Content, "Modo Oscuro") {
		t.Errorf("expected Spanish content, got: %q", resp.Msg.Content)
	}
}

func TestGetDocumentNotFound(t *testing.T) {
	mockFS := newMockFS()
	setupTestContent(mockFS)
	svc := newTestService(mockFS)

	_, err := svc.GetDocument(context.Background(), connect.NewRequest(&contentpb.GetDocumentRequest{
		Product:     "myapp",
		Version:     "1.1.0",
		Locale:      "en",
		FeatureSlug: "nonexistent",
	}))
	if err == nil {
		t.Fatal("expected error for nonexistent feature")
	}
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Errorf("expected CodeNotFound, got %v", connect.CodeOf(err))
	}
}

func TestSaveDocument(t *testing.T) {
	mockFS := newMockFS()
	setupTestContent(mockFS)
	svc := newTestService(mockFS)

	resp, err := svc.SaveDocument(context.Background(), connect.NewRequest(&contentpb.SaveDocumentRequest{
		Product:     "myapp",
		Version:     "1.1.0",
		Locale:      "en",
		FeatureSlug: "new-feature",
		Content:     "# New Feature\n\nThis is a new feature.",
		EditMessage: "Added new feature documentation",
	}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Msg.Success {
		t.Error("expected success to be true")
	}

	// Verify the file was written.
	savedData, ok := mockFS.files["/content/myapp/1.1.0/en/new-feature.md"]
	if !ok {
		t.Fatal("expected file to be written")
	}
	if string(savedData) != "# New Feature\n\nThis is a new feature." {
		t.Errorf("unexpected saved content: %q", string(savedData))
	}
}

func TestSaveDocumentMissingFields(t *testing.T) {
	mockFS := newMockFS()
	svc := newTestService(mockFS)

	_, err := svc.SaveDocument(context.Background(), connect.NewRequest(&contentpb.SaveDocumentRequest{
		Product: "myapp",
		// Missing version, locale, feature_slug
		Content: "some content",
	}))
	if err == nil {
		t.Fatal("expected error for missing fields")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected CodeInvalidArgument, got %v", connect.CodeOf(err))
	}
}

func TestSaveDocumentEmptyContent(t *testing.T) {
	mockFS := newMockFS()
	svc := newTestService(mockFS)

	_, err := svc.SaveDocument(context.Background(), connect.NewRequest(&contentpb.SaveDocumentRequest{
		Product:     "myapp",
		Version:     "1.0.0",
		Locale:      "en",
		FeatureSlug: "feat",
		Content:     "",
	}))
	if err == nil {
		t.Fatal("expected error for empty content")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected CodeInvalidArgument, got %v", connect.CodeOf(err))
	}
}

func TestSaveDocumentDirectoryTraversal(t *testing.T) {
	mockFS := newMockFS()
	svc := newTestService(mockFS)

	_, err := svc.SaveDocument(context.Background(), connect.NewRequest(&contentpb.SaveDocumentRequest{
		Product:     "../etc",
		Version:     "1.0.0",
		Locale:      "en",
		FeatureSlug: "passwd",
		Content:     "malicious",
	}))
	if err == nil {
		t.Fatal("expected error for directory traversal attempt")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected CodeInvalidArgument, got %v", connect.CodeOf(err))
	}
}

func TestPublishVersion(t *testing.T) {
	mockFS := newMockFS()
	setupTestContent(mockFS)
	svc := newTestService(mockFS)

	resp, err := svc.PublishVersion(context.Background(), connect.NewRequest(&contentpb.PublishVersionRequest{
		Product: "myapp",
		Version: "1.1.0",
	}))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Msg.Success {
		t.Error("expected success to be true")
	}

	// Verify the features.json was updated.
	data := mockFS.files["/content/myapp/1.1.0/features.json"]
	var featFile featuresFile
	if err := json.Unmarshal(data, &featFile); err != nil {
		t.Fatalf("failed to parse updated features.json: %v", err)
	}
	if featFile.Status != "published" {
		t.Errorf("expected version status 'published', got %q", featFile.Status)
	}
	for _, f := range featFile.Features {
		if f.Status != "published" {
			t.Errorf("feature %q status should be 'published', got %q", f.Slug, f.Status)
		}
	}
}

func TestPublishVersionNotFound(t *testing.T) {
	mockFS := newMockFS()
	setupTestContent(mockFS)
	svc := newTestService(mockFS)

	_, err := svc.PublishVersion(context.Background(), connect.NewRequest(&contentpb.PublishVersionRequest{
		Product: "myapp",
		Version: "9.9.9",
	}))
	if err == nil {
		t.Fatal("expected error for nonexistent version")
	}
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Errorf("expected CodeNotFound, got %v", connect.CodeOf(err))
	}
}

func TestPublishVersionMissingFields(t *testing.T) {
	mockFS := newMockFS()
	svc := newTestService(mockFS)

	_, err := svc.PublishVersion(context.Background(), connect.NewRequest(&contentpb.PublishVersionRequest{
		Product: "myapp",
	}))
	if err == nil {
		t.Fatal("expected error for missing version")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected CodeInvalidArgument, got %v", connect.CodeOf(err))
	}
}

func TestIsVersionDirectory(t *testing.T) {
	tests := []struct {
		name     string
		expected bool
	}{
		{"1.0.0", true},
		{"1.0", true},
		{"10.20.30", true},
		{"en", false},
		{"product.json", false},
		{"v1.0.0", false},
		{".hidden", false},
	}

	for _, tt := range tests {
		result := isVersionDirectory(tt.name)
		if result != tt.expected {
			t.Errorf("isVersionDirectory(%q) = %v, want %v", tt.name, result, tt.expected)
		}
	}
}
