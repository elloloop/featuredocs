package feedback

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"testing"

	"connectrpc.com/connect"

	feedbackpb "github.com/glassa-work/featuredocs/api/gen/featuredocs/v1"
	"github.com/glassa-work/featuredocs/api/internal/github"
)

// --- Mock implementations ---

type mockGitHubClient struct {
	createIssueFunc      func(ctx context.Context, title, body string, labels []string) (int, string, error)
	listIssuesFunc       func(ctx context.Context, labels []string, state string, limit, offset int) ([]github.Issue, int, error)
	updateIssueLabelsFunc func(ctx context.Context, number int, labels []string) error
}

func (m *mockGitHubClient) CreateIssue(ctx context.Context, title, body string, labels []string) (int, string, error) {
	if m.createIssueFunc != nil {
		return m.createIssueFunc(ctx, title, body, labels)
	}
	return 1, "https://github.com/o/r/issues/1", nil
}

func (m *mockGitHubClient) ListIssues(ctx context.Context, labels []string, state string, limit, offset int) ([]github.Issue, int, error) {
	if m.listIssuesFunc != nil {
		return m.listIssuesFunc(ctx, labels, state, limit, offset)
	}
	return nil, 0, nil
}

func (m *mockGitHubClient) UpdateIssueLabels(ctx context.Context, number int, labels []string) error {
	if m.updateIssueLabelsFunc != nil {
		return m.updateIssueLabelsFunc(ctx, number, labels)
	}
	return nil
}

type mockTurnstileVerifier struct {
	verifyFunc func(ctx context.Context, token, remoteIP string) (bool, error)
}

func (m *mockTurnstileVerifier) Verify(ctx context.Context, token, remoteIP string) (bool, error) {
	if m.verifyFunc != nil {
		return m.verifyFunc(ctx, token, remoteIP)
	}
	return true, nil
}

type mockRateLimiter struct {
	allowFunc func(key string) bool
}

func (m *mockRateLimiter) Allow(key string) bool {
	if m.allowFunc != nil {
		return m.allowFunc(key)
	}
	return true
}

// --- Helper ---

func newTestService(
	gh *mockGitHubClient,
	ts *mockTurnstileVerifier,
	rl *mockRateLimiter,
) *Service {
	if gh == nil {
		gh = &mockGitHubClient{}
	}
	if ts == nil {
		ts = &mockTurnstileVerifier{}
	}
	if rl == nil {
		rl = &mockRateLimiter{}
	}
	return NewService(gh, ts, rl, slog.Default())
}

func newSubmitRequest(product, feature, comment, token string) *connect.Request[feedbackpb.SubmitFeedbackRequest] {
	req := connect.NewRequest(&feedbackpb.SubmitFeedbackRequest{
		Product:        product,
		Feature:        feature,
		Comment:        comment,
		TurnstileToken: token,
		Type:           feedbackpb.FeedbackType_FEEDBACK_TYPE_TEXT,
	})
	req.Header().Set("X-Forwarded-For", "1.2.3.4")
	return req
}

// --- Tests ---

func TestSubmitFeedbackSuccess(t *testing.T) {
	var capturedTitle string
	var capturedLabels []string

	gh := &mockGitHubClient{
		createIssueFunc: func(ctx context.Context, title, body string, labels []string) (int, string, error) {
			capturedTitle = title
			capturedLabels = labels
			return 42, "https://github.com/o/r/issues/42", nil
		},
	}

	svc := newTestService(gh, nil, nil)

	resp, err := svc.SubmitFeedback(context.Background(), newSubmitRequest("myapp", "dark-mode", "Great feature!", "valid-token"))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Msg.Success {
		t.Error("expected success to be true")
	}
	if resp.Msg.GithubIssueUrl != "https://github.com/o/r/issues/42" {
		t.Errorf("unexpected issue URL: %s", resp.Msg.GithubIssueUrl)
	}
	if capturedTitle != "[Text Feedback] myapp/dark-mode" {
		t.Errorf("unexpected issue title: %s", capturedTitle)
	}
	if len(capturedLabels) < 3 {
		t.Errorf("expected at least 3 labels, got %d: %v", len(capturedLabels), capturedLabels)
	}
}

func TestSubmitFeedbackEmptyComment(t *testing.T) {
	svc := newTestService(nil, nil, nil)

	req := connect.NewRequest(&feedbackpb.SubmitFeedbackRequest{
		Product:        "myapp",
		Feature:        "dark-mode",
		Comment:        "",
		TurnstileToken: "valid-token",
		Type:           feedbackpb.FeedbackType_FEEDBACK_TYPE_TEXT,
	})
	req.Header().Set("X-Forwarded-For", "1.2.3.4")

	_, err := svc.SubmitFeedback(context.Background(), req)
	if err == nil {
		t.Fatal("expected error for empty comment with no selected_text or video_reference")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected CodeInvalidArgument, got %v", connect.CodeOf(err))
	}
}

func TestSubmitFeedbackMissingProduct(t *testing.T) {
	svc := newTestService(nil, nil, nil)

	req := newSubmitRequest("", "dark-mode", "comment", "token")
	_, err := svc.SubmitFeedback(context.Background(), req)
	if err == nil {
		t.Fatal("expected error for missing product")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected CodeInvalidArgument, got %v", connect.CodeOf(err))
	}
}

func TestSubmitFeedbackInvalidTurnstileToken(t *testing.T) {
	ts := &mockTurnstileVerifier{
		verifyFunc: func(ctx context.Context, token, remoteIP string) (bool, error) {
			return false, nil
		},
	}
	svc := newTestService(nil, ts, nil)

	_, err := svc.SubmitFeedback(context.Background(), newSubmitRequest("myapp", "dark-mode", "comment", "invalid"))
	if err == nil {
		t.Fatal("expected error for invalid turnstile token")
	}
	if connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Errorf("expected CodePermissionDenied, got %v", connect.CodeOf(err))
	}
}

func TestSubmitFeedbackRateLimited(t *testing.T) {
	rl := &mockRateLimiter{
		allowFunc: func(key string) bool {
			return false
		},
	}
	svc := newTestService(nil, nil, rl)

	_, err := svc.SubmitFeedback(context.Background(), newSubmitRequest("myapp", "dark-mode", "comment", "valid-token"))
	if err == nil {
		t.Fatal("expected error when rate limited")
	}
	if connect.CodeOf(err) != connect.CodeResourceExhausted {
		t.Errorf("expected CodeResourceExhausted, got %v", connect.CodeOf(err))
	}
}

func TestSubmitFeedbackHoneypot(t *testing.T) {
	gh := &mockGitHubClient{
		createIssueFunc: func(ctx context.Context, title, body string, labels []string) (int, string, error) {
			t.Error("CreateIssue should not be called for honeypot submissions")
			return 0, "", nil
		},
	}
	svc := newTestService(gh, nil, nil)

	req := connect.NewRequest(&feedbackpb.SubmitFeedbackRequest{
		Product:        "myapp",
		Feature:        "dark-mode",
		Comment:        "Buy cheap stuff!",
		Email:          "hp:bot@spam.com",
		TurnstileToken: "valid-token",
		Type:           feedbackpb.FeedbackType_FEEDBACK_TYPE_TEXT,
	})
	req.Header().Set("X-Forwarded-For", "1.2.3.4")

	resp, err := svc.SubmitFeedback(context.Background(), req)
	if err != nil {
		t.Fatalf("honeypot should return success, not error: %v", err)
	}
	if !resp.Msg.Success {
		t.Error("honeypot should return success=true")
	}
	if resp.Msg.GithubIssueUrl != "" {
		t.Error("honeypot should not return a GitHub issue URL")
	}
}

func TestListFeedbackSuccess(t *testing.T) {
	gh := &mockGitHubClient{
		listIssuesFunc: func(ctx context.Context, labels []string, state string, limit, offset int) ([]github.Issue, int, error) {
			return []github.Issue{
				{
					Number:  1,
					Title:   "[Text Feedback] myapp/dark-mode",
					Body:    "A comment",
					HTMLURL: "https://github.com/o/r/issues/1",
					State:   "open",
					Labels: []github.Label{
						{Name: "feedback"},
						{Name: "product:myapp"},
						{Name: "feature:dark-mode"},
						{Name: "status:open"},
						{Name: "type:text"},
					},
					CreateAt: "2024-01-01T00:00:00Z",
				},
			}, 1, nil
		},
	}
	svc := newTestService(gh, nil, nil)

	req := connect.NewRequest(&feedbackpb.ListFeedbackRequest{
		Product: "myapp",
	})

	resp, err := svc.ListFeedback(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Msg.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Msg.Items))
	}
	item := resp.Msg.Items[0]
	if item.Product != "myapp" {
		t.Errorf("expected product 'myapp', got %q", item.Product)
	}
	if item.Feature != "dark-mode" {
		t.Errorf("expected feature 'dark-mode', got %q", item.Feature)
	}
	if item.Status != feedbackpb.FeedbackStatus_FEEDBACK_STATUS_OPEN {
		t.Errorf("unexpected status: %v", item.Status)
	}
	if item.Type != feedbackpb.FeedbackType_FEEDBACK_TYPE_TEXT {
		t.Errorf("unexpected type: %v", item.Type)
	}
}

func TestListFeedbackFiltersApplied(t *testing.T) {
	var capturedLabels []string
	var capturedState string

	gh := &mockGitHubClient{
		listIssuesFunc: func(ctx context.Context, labels []string, state string, limit, offset int) ([]github.Issue, int, error) {
			capturedLabels = labels
			capturedState = state
			return nil, 0, nil
		},
	}
	svc := newTestService(gh, nil, nil)

	req := connect.NewRequest(&feedbackpb.ListFeedbackRequest{
		Product: "myapp",
		Feature: "dark-mode",
		Status:  feedbackpb.FeedbackStatus_FEEDBACK_STATUS_FIXED,
	})

	_, err := svc.ListFeedback(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expectedLabels := []string{"feedback", "product:myapp", "feature:dark-mode", "status:fixed"}
	if len(capturedLabels) != len(expectedLabels) {
		t.Fatalf("expected %d labels, got %d: %v", len(expectedLabels), len(capturedLabels), capturedLabels)
	}
	for i, label := range expectedLabels {
		if capturedLabels[i] != label {
			t.Errorf("label[%d]: expected %q, got %q", i, label, capturedLabels[i])
		}
	}
	if capturedState != "closed" {
		t.Errorf("expected state 'closed' for FIXED status, got %q", capturedState)
	}
}

func TestUpdateFeedbackStatusSuccess(t *testing.T) {
	var capturedNumber int
	var capturedLabels []string

	gh := &mockGitHubClient{
		updateIssueLabelsFunc: func(ctx context.Context, number int, labels []string) error {
			capturedNumber = number
			capturedLabels = labels
			return nil
		},
	}
	svc := newTestService(gh, nil, nil)

	req := connect.NewRequest(&feedbackpb.UpdateFeedbackStatusRequest{
		Id:     42,
		Status: feedbackpb.FeedbackStatus_FEEDBACK_STATUS_ACKNOWLEDGED,
	})

	resp, err := svc.UpdateFeedbackStatus(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Msg.Success {
		t.Error("expected success to be true")
	}
	if capturedNumber != 42 {
		t.Errorf("expected issue number 42, got %d", capturedNumber)
	}
	if len(capturedLabels) != 2 || capturedLabels[1] != "status:acknowledged" {
		t.Errorf("unexpected labels: %v", capturedLabels)
	}
}

func TestUpdateFeedbackStatusInvalidID(t *testing.T) {
	svc := newTestService(nil, nil, nil)

	req := connect.NewRequest(&feedbackpb.UpdateFeedbackStatusRequest{
		Id:     0,
		Status: feedbackpb.FeedbackStatus_FEEDBACK_STATUS_FIXED,
	})

	_, err := svc.UpdateFeedbackStatus(context.Background(), req)
	if err == nil {
		t.Fatal("expected error for invalid ID")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected CodeInvalidArgument, got %v", connect.CodeOf(err))
	}
}

func TestUpdateFeedbackStatusUnspecified(t *testing.T) {
	svc := newTestService(nil, nil, nil)

	req := connect.NewRequest(&feedbackpb.UpdateFeedbackStatusRequest{
		Id:     42,
		Status: feedbackpb.FeedbackStatus_FEEDBACK_STATUS_UNSPECIFIED,
	})

	_, err := svc.UpdateFeedbackStatus(context.Background(), req)
	if err == nil {
		t.Fatal("expected error for unspecified status")
	}
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Errorf("expected CodeInvalidArgument, got %v", connect.CodeOf(err))
	}
}

func TestSubmitFeedbackGitHubError(t *testing.T) {
	gh := &mockGitHubClient{
		createIssueFunc: func(ctx context.Context, title, body string, labels []string) (int, string, error) {
			return 0, "", fmt.Errorf("github API error")
		},
	}
	svc := newTestService(gh, nil, nil)

	_, err := svc.SubmitFeedback(context.Background(), newSubmitRequest("myapp", "dark-mode", "comment", "valid-token"))
	if err == nil {
		t.Fatal("expected error when GitHub API fails")
	}
	if connect.CodeOf(err) != connect.CodeInternal {
		t.Errorf("expected CodeInternal, got %v", connect.CodeOf(err))
	}
}

func TestExtractClientIPFromXForwardedFor(t *testing.T) {
	header := http.Header{}
	header.Set("X-Forwarded-For", "10.0.0.1, 10.0.0.2")

	ip := extractClientIP(header)
	if ip != "10.0.0.1" {
		t.Errorf("expected '10.0.0.1', got %q", ip)
	}
}

func TestExtractClientIPFromXRealIP(t *testing.T) {
	header := http.Header{}
	header.Set("X-Real-Ip", "10.0.0.5")

	ip := extractClientIP(header)
	if ip != "10.0.0.5" {
		t.Errorf("expected '10.0.0.5', got %q", ip)
	}
}

func TestExtractClientIPFallback(t *testing.T) {
	header := http.Header{}

	ip := extractClientIP(header)
	if ip != "unknown" {
		t.Errorf("expected 'unknown', got %q", ip)
	}
}

func TestBuildIssueTitle(t *testing.T) {
	tests := []struct {
		feedbackType feedbackpb.FeedbackType
		expected     string
	}{
		{feedbackpb.FeedbackType_FEEDBACK_TYPE_TEXT, "[Text Feedback] app/feature"},
		{feedbackpb.FeedbackType_FEEDBACK_TYPE_VIDEO, "[Video Feedback] app/feature"},
		{feedbackpb.FeedbackType_FEEDBACK_TYPE_GENERAL, "[General Feedback] app/feature"},
		{feedbackpb.FeedbackType_FEEDBACK_TYPE_UNSPECIFIED, "[Feedback] app/feature"},
	}

	for _, tt := range tests {
		msg := &feedbackpb.SubmitFeedbackRequest{
			Product: "app",
			Feature: "feature",
			Type:    tt.feedbackType,
		}
		title := buildIssueTitle(msg)
		if title != tt.expected {
			t.Errorf("type %v: expected %q, got %q", tt.feedbackType, tt.expected, title)
		}
	}
}
