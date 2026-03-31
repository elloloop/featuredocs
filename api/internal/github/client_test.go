package github

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreateIssueSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.URL.Path != "/repos/test-owner/test-repo/issues" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Errorf("unexpected auth header: %s", r.Header.Get("Authorization"))
		}

		var req createIssueRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decoding request body: %v", err)
		}
		if req.Title != "Bug: incorrect rendering" {
			t.Errorf("unexpected title: %s", req.Title)
		}
		if len(req.Labels) != 2 || req.Labels[0] != "feedback" {
			t.Errorf("unexpected labels: %v", req.Labels)
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(Issue{
			Number:  42,
			HTMLURL: "https://github.com/test-owner/test-repo/issues/42",
		})
	}))
	defer server.Close()

	client := &Client{
		httpClient: server.Client(),
		owner:      "test-owner",
		repo:       "test-repo",
		token:      "test-token",
		baseURL:    server.URL,
	}

	number, htmlURL, err := client.CreateIssue(
		context.Background(),
		"Bug: incorrect rendering",
		"The text is displayed wrong.",
		[]string{"feedback", "bug"},
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if number != 42 {
		t.Errorf("expected issue number 42, got %d", number)
	}
	if htmlURL != "https://github.com/test-owner/test-repo/issues/42" {
		t.Errorf("unexpected HTML URL: %s", htmlURL)
	}
}

func TestCreateIssueAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnprocessableEntity)
		w.Write([]byte(`{"message": "Validation Failed"}`))
	}))
	defer server.Close()

	client := &Client{
		httpClient: server.Client(),
		owner:      "test-owner",
		repo:       "test-repo",
		token:      "test-token",
		baseURL:    server.URL,
	}

	_, _, err := client.CreateIssue(context.Background(), "title", "body", nil)
	if err == nil {
		t.Error("expected error for API failure")
	}
}

func TestListIssuesSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("expected GET, got %s", r.Method)
		}

		query := r.URL.Query()
		if query.Get("labels") != "feedback,bug" {
			t.Errorf("unexpected labels filter: %s", query.Get("labels"))
		}
		if query.Get("state") != "open" {
			t.Errorf("unexpected state: %s", query.Get("state"))
		}
		if query.Get("per_page") != "10" {
			t.Errorf("unexpected per_page: %s", query.Get("per_page"))
		}

		issues := []Issue{
			{Number: 1, Title: "First issue", HTMLURL: "https://github.com/o/r/issues/1"},
			{Number: 2, Title: "Second issue", HTMLURL: "https://github.com/o/r/issues/2"},
		}
		json.NewEncoder(w).Encode(issues)
	}))
	defer server.Close()

	client := &Client{
		httpClient: server.Client(),
		owner:      "test-owner",
		repo:       "test-repo",
		token:      "test-token",
		baseURL:    server.URL,
	}

	issues, total, err := client.ListIssues(
		context.Background(),
		[]string{"feedback", "bug"},
		"open",
		10,
		0,
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(issues) != 2 {
		t.Errorf("expected 2 issues, got %d", len(issues))
	}
	if total != 2 {
		t.Errorf("expected total 2, got %d", total)
	}
	if issues[0].Title != "First issue" {
		t.Errorf("unexpected title: %s", issues[0].Title)
	}
}

func TestListIssuesDefaultState(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("state") != "all" {
			t.Errorf("expected default state 'all', got %s", r.URL.Query().Get("state"))
		}
		json.NewEncoder(w).Encode([]Issue{})
	}))
	defer server.Close()

	client := &Client{
		httpClient: server.Client(),
		owner:      "test-owner",
		repo:       "test-repo",
		token:      "test-token",
		baseURL:    server.URL,
	}

	_, _, err := client.ListIssues(context.Background(), nil, "", 0, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestUpdateIssueLabelsSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			t.Errorf("expected PUT, got %s", r.Method)
		}
		if r.URL.Path != "/repos/test-owner/test-repo/issues/42/labels" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}

		var req updateLabelsRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decoding request body: %v", err)
		}
		if len(req.Labels) != 2 {
			t.Errorf("expected 2 labels, got %d", len(req.Labels))
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode([]Label{{Name: "feedback"}, {Name: "fixed"}})
	}))
	defer server.Close()

	client := &Client{
		httpClient: server.Client(),
		owner:      "test-owner",
		repo:       "test-repo",
		token:      "test-token",
		baseURL:    server.URL,
	}

	err := client.UpdateIssueLabels(context.Background(), 42, []string{"feedback", "fixed"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestUpdateIssueLabelsAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"message": "Not Found"}`))
	}))
	defer server.Close()

	client := &Client{
		httpClient: server.Client(),
		owner:      "test-owner",
		repo:       "test-repo",
		token:      "test-token",
		baseURL:    server.URL,
	}

	err := client.UpdateIssueLabels(context.Background(), 999, []string{"label"})
	if err == nil {
		t.Error("expected error for not found issue")
	}
}
