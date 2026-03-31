// Package github provides a client for the GitHub Issues API, used to create
// and manage feedback issues in a GitHub repository.
package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// Issue represents a GitHub issue with the fields we care about.
type Issue struct {
	Number   int      `json:"number"`
	Title    string   `json:"title"`
	Body     string   `json:"body"`
	HTMLURL  string   `json:"html_url"`
	State    string   `json:"state"`
	Labels   []Label  `json:"labels"`
	CreateAt string   `json:"created_at"`
	ClosedAt string   `json:"closed_at"`
}

// Label represents a GitHub issue label.
type Label struct {
	Name string `json:"name"`
}

// IssueClient defines the interface for GitHub issue operations.
// Implementations include the real API client and test mocks.
type IssueClient interface {
	CreateIssue(ctx context.Context, title, body string, labels []string) (int, string, error)
	ListIssues(ctx context.Context, labels []string, state string, limit, offset int) ([]Issue, int, error)
	UpdateIssueLabels(ctx context.Context, number int, labels []string) error
}

// Client communicates with the GitHub REST API v3 for issue management.
type Client struct {
	httpClient *http.Client
	owner      string
	repo       string
	token      string
	baseURL    string
}

// NewClient creates a GitHub client targeting the given owner/repo.
func NewClient(owner, repo, token string, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{
		httpClient: httpClient,
		owner:      owner,
		repo:       repo,
		token:      token,
		baseURL:    "https://api.github.com",
	}
}

// createIssueRequest is the JSON body sent to the GitHub Create Issue endpoint.
type createIssueRequest struct {
	Title  string   `json:"title"`
	Body   string   `json:"body"`
	Labels []string `json:"labels"`
}

// CreateIssue creates a new issue in the configured repository.
// Returns the issue number, HTML URL, and any error.
func (c *Client) CreateIssue(ctx context.Context, title, body string, labels []string) (int, string, error) {
	reqBody := createIssueRequest{
		Title:  title,
		Body:   body,
		Labels: labels,
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return 0, "", fmt.Errorf("marshaling issue request: %w", err)
	}

	apiURL := fmt.Sprintf("%s/repos/%s/%s/issues", c.baseURL, c.owner, c.repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(data))
	if err != nil {
		return 0, "", fmt.Errorf("creating request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, "", fmt.Errorf("sending create issue request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return 0, "", fmt.Errorf("github API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var issue Issue
	if err := json.NewDecoder(resp.Body).Decode(&issue); err != nil {
		return 0, "", fmt.Errorf("decoding issue response: %w", err)
	}

	return issue.Number, issue.HTMLURL, nil
}

// ListIssues retrieves issues from the repository, filtered by labels and state.
// state should be "open", "closed", or "all". Returns issues and total count.
func (c *Client) ListIssues(ctx context.Context, labels []string, state string, limit, offset int) ([]Issue, int, error) {
	if limit <= 0 {
		limit = 50
	}
	if state == "" {
		state = "all"
	}

	// GitHub API uses page-based pagination, so convert offset to page number.
	page := (offset / limit) + 1

	params := url.Values{
		"state":    {state},
		"per_page": {strconv.Itoa(limit)},
		"page":     {strconv.Itoa(page)},
	}
	if len(labels) > 0 {
		params.Set("labels", strings.Join(labels, ","))
	}

	apiURL := fmt.Sprintf("%s/repos/%s/%s/issues?%s", c.baseURL, c.owner, c.repo, params.Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("creating request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("sending list issues request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, 0, fmt.Errorf("github API returned %d: %s", resp.StatusCode, string(respBody))
	}

	var issues []Issue
	if err := json.NewDecoder(resp.Body).Decode(&issues); err != nil {
		return nil, 0, fmt.Errorf("decoding issues response: %w", err)
	}

	// GitHub API doesn't directly return total count for issues.
	// We use the length of results as an approximation.
	total := len(issues)

	return issues, total, nil
}

// updateLabelsRequest is the JSON body for the GitHub Set Labels endpoint.
type updateLabelsRequest struct {
	Labels []string `json:"labels"`
}

// UpdateIssueLabels replaces all labels on the given issue.
func (c *Client) UpdateIssueLabels(ctx context.Context, number int, labels []string) error {
	reqBody := updateLabelsRequest{Labels: labels}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("marshaling labels request: %w", err)
	}

	apiURL := fmt.Sprintf("%s/repos/%s/%s/issues/%d/labels", c.baseURL, c.owner, c.repo, number)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, apiURL, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("sending update labels request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("github API returned %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// setHeaders applies common headers (auth, content type, API version).
func (c *Client) setHeaders(req *http.Request) {
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
}
