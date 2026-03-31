// Package feedback implements the FeedbackService Connect handler.
// It bridges user feedback submissions with GitHub Issues for tracking.
package feedback

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"connectrpc.com/connect"

	feedbackpb "github.com/glassa-work/featuredocs/api/gen/featuredocs/v1"
	"github.com/glassa-work/featuredocs/api/internal/github"
	"github.com/glassa-work/featuredocs/api/internal/ratelimit"
	"github.com/glassa-work/featuredocs/api/internal/turnstile"
)

// Service implements the FeedbackService Connect handler.
type Service struct {
	githubClient       github.IssueClient
	turnstileVerifier  turnstile.Verifier
	rateLimiter        ratelimit.Limiter
	logger             *slog.Logger
}

// NewService creates a new FeedbackService with all dependencies injected.
func NewService(
	githubClient github.IssueClient,
	turnstileVerifier turnstile.Verifier,
	rateLimiter ratelimit.Limiter,
	logger *slog.Logger,
) *Service {
	return &Service{
		githubClient:      githubClient,
		turnstileVerifier: turnstileVerifier,
		rateLimiter:       rateLimiter,
		logger:            logger,
	}
}

// SubmitFeedback validates input, verifies the Turnstile token, checks the
// rate limit, and creates a GitHub issue for the feedback.
func (s *Service) SubmitFeedback(
	ctx context.Context,
	req *connect.Request[feedbackpb.SubmitFeedbackRequest],
) (*connect.Response[feedbackpb.SubmitFeedbackResponse], error) {
	msg := req.Msg

	if err := validateSubmitRequest(msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	// Honeypot check: if the email field contains a known honeypot pattern,
	// silently accept but do not create an issue. The "email" field in the
	// proto is intentionally left available for honeypot detection.
	if isHoneypot(msg.Email) {
		s.logger.Info("honeypot triggered, silently discarding feedback",
			"product", msg.Product,
			"feature", msg.Feature,
		)
		return connect.NewResponse(&feedbackpb.SubmitFeedbackResponse{
			Success: true,
			Message: "Thank you for your feedback!",
		}), nil
	}

	// Extract the client IP from the request headers.
	clientIP := extractClientIP(req.Header())

	// Verify Turnstile token for anti-spam.
	valid, err := s.turnstileVerifier.Verify(ctx, msg.TurnstileToken, clientIP)
	if err != nil {
		s.logger.Error("turnstile verification failed", "error", err)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to verify captcha"))
	}
	if !valid {
		return nil, connect.NewError(connect.CodePermissionDenied, fmt.Errorf("invalid captcha token"))
	}

	// Check rate limit for this IP.
	if !s.rateLimiter.Allow(clientIP) {
		return nil, connect.NewError(connect.CodeResourceExhausted, fmt.Errorf("rate limit exceeded, please try again later"))
	}

	// Build the GitHub issue.
	title := buildIssueTitle(msg)
	body := buildIssueBody(msg)
	labels := buildIssueLabels(msg)

	issueNumber, issueURL, err := s.githubClient.CreateIssue(ctx, title, body, labels)
	if err != nil {
		s.logger.Error("failed to create github issue",
			"error", err,
			"product", msg.Product,
			"feature", msg.Feature,
		)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to create feedback issue"))
	}

	s.logger.Info("feedback submitted",
		"issue_number", issueNumber,
		"product", msg.Product,
		"feature", msg.Feature,
		"type", msg.Type.String(),
	)

	return connect.NewResponse(&feedbackpb.SubmitFeedbackResponse{
		Success:        true,
		Message:        "Thank you for your feedback!",
		GithubIssueUrl: issueURL,
	}), nil
}

// ListFeedback retrieves feedback items from GitHub Issues with optional filters.
func (s *Service) ListFeedback(
	ctx context.Context,
	req *connect.Request[feedbackpb.ListFeedbackRequest],
) (*connect.Response[feedbackpb.ListFeedbackResponse], error) {
	msg := req.Msg

	labels := []string{"feedback"}
	if msg.Product != "" {
		labels = append(labels, "product:"+msg.Product)
	}
	if msg.Feature != "" {
		labels = append(labels, "feature:"+msg.Feature)
	}
	if msg.Status != feedbackpb.FeedbackStatus_FEEDBACK_STATUS_UNSPECIFIED {
		labels = append(labels, "status:"+statusToLabel(msg.Status))
	}

	limit := int(msg.Limit)
	if limit <= 0 {
		limit = 50
	}
	offset := int(msg.Offset)

	state := "all"
	if msg.Status == feedbackpb.FeedbackStatus_FEEDBACK_STATUS_OPEN {
		state = "open"
	} else if msg.Status == feedbackpb.FeedbackStatus_FEEDBACK_STATUS_FIXED ||
		msg.Status == feedbackpb.FeedbackStatus_FEEDBACK_STATUS_DISMISSED {
		state = "closed"
	}

	issues, total, err := s.githubClient.ListIssues(ctx, labels, state, limit, offset)
	if err != nil {
		s.logger.Error("failed to list github issues", "error", err)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to list feedback"))
	}

	items := make([]*feedbackpb.FeedbackItem, 0, len(issues))
	for _, issue := range issues {
		items = append(items, issueToFeedbackItem(issue))
	}

	return connect.NewResponse(&feedbackpb.ListFeedbackResponse{
		Items: items,
		Total: int32(total),
	}), nil
}

// UpdateFeedbackStatus changes the status labels on a feedback GitHub issue.
func (s *Service) UpdateFeedbackStatus(
	ctx context.Context,
	req *connect.Request[feedbackpb.UpdateFeedbackStatusRequest],
) (*connect.Response[feedbackpb.UpdateFeedbackStatusResponse], error) {
	msg := req.Msg

	if msg.Id <= 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("id must be positive"))
	}
	if msg.Status == feedbackpb.FeedbackStatus_FEEDBACK_STATUS_UNSPECIFIED {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("status must be specified"))
	}

	// Build the new label set. We keep the "feedback" label and update the status label.
	newLabels := []string{"feedback", "status:" + statusToLabel(msg.Status)}

	if err := s.githubClient.UpdateIssueLabels(ctx, int(msg.Id), newLabels); err != nil {
		s.logger.Error("failed to update issue labels",
			"error", err,
			"issue_number", msg.Id,
		)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to update feedback status"))
	}

	s.logger.Info("feedback status updated",
		"issue_number", msg.Id,
		"new_status", msg.Status.String(),
	)

	return connect.NewResponse(&feedbackpb.UpdateFeedbackStatusResponse{
		Success: true,
		Item: &feedbackpb.FeedbackItem{
			Id:     msg.Id,
			Status: msg.Status,
		},
	}), nil
}

// validateSubmitRequest checks that all required fields are present in a submission.
func validateSubmitRequest(msg *feedbackpb.SubmitFeedbackRequest) error {
	if msg.Product == "" {
		return fmt.Errorf("product is required")
	}
	if msg.Feature == "" {
		return fmt.Errorf("feature is required")
	}
	if msg.Comment == "" && msg.SelectedText == "" && msg.VideoReference == "" {
		return fmt.Errorf("at least one of comment, selected_text, or video_reference is required")
	}
	if msg.TurnstileToken == "" {
		return fmt.Errorf("turnstile_token is required")
	}
	if msg.Type == feedbackpb.FeedbackType_FEEDBACK_TYPE_UNSPECIFIED {
		return fmt.Errorf("feedback type must be specified")
	}
	return nil
}

// isHoneypot detects honeypot submissions. The honeypot field is a hidden form
// field that legitimate users leave empty. Bots tend to fill every field.
func isHoneypot(email string) bool {
	// If the email contains a honeypot marker prefix, it was filled by a bot.
	return strings.HasPrefix(email, "hp:")
}

// extractClientIP pulls the client IP from standard headers, falling back to
// the peer address if forwarding headers are not present.
func extractClientIP(headers interface{ Get(string) string }) string {
	if forwarded := headers.Get("X-Forwarded-For"); forwarded != "" {
		parts := strings.SplitN(forwarded, ",", 2)
		return strings.TrimSpace(parts[0])
	}
	if realIP := headers.Get("X-Real-Ip"); realIP != "" {
		return realIP
	}
	return "unknown"
}

// buildIssueTitle creates a descriptive GitHub issue title from feedback.
func buildIssueTitle(msg *feedbackpb.SubmitFeedbackRequest) string {
	typeStr := "Feedback"
	switch msg.Type {
	case feedbackpb.FeedbackType_FEEDBACK_TYPE_TEXT:
		typeStr = "Text Feedback"
	case feedbackpb.FeedbackType_FEEDBACK_TYPE_VIDEO:
		typeStr = "Video Feedback"
	case feedbackpb.FeedbackType_FEEDBACK_TYPE_GENERAL:
		typeStr = "General Feedback"
	}
	return fmt.Sprintf("[%s] %s/%s", typeStr, msg.Product, msg.Feature)
}

// buildIssueBody creates markdown-formatted issue body content from feedback.
func buildIssueBody(msg *feedbackpb.SubmitFeedbackRequest) string {
	var b strings.Builder

	b.WriteString(fmt.Sprintf("**Product:** %s\n", msg.Product))
	b.WriteString(fmt.Sprintf("**Feature:** %s\n", msg.Feature))
	if msg.Version != "" {
		b.WriteString(fmt.Sprintf("**Version:** %s\n", msg.Version))
	}
	if msg.Locale != "" {
		b.WriteString(fmt.Sprintf("**Locale:** %s\n", msg.Locale))
	}
	b.WriteString(fmt.Sprintf("**Type:** %s\n", msg.Type.String()))
	b.WriteString("\n---\n\n")

	if msg.SelectedText != "" {
		b.WriteString(fmt.Sprintf("**Selected Text:**\n> %s\n\n", msg.SelectedText))
	}
	if msg.VideoReference != "" {
		b.WriteString(fmt.Sprintf("**Video Reference:** %s\n\n", msg.VideoReference))
	}
	if msg.Comment != "" {
		b.WriteString(fmt.Sprintf("**Comment:**\n%s\n", msg.Comment))
	}

	return b.String()
}

// buildIssueLabels creates the label set for a feedback GitHub issue.
func buildIssueLabels(msg *feedbackpb.SubmitFeedbackRequest) []string {
	labels := []string{"feedback", "status:open"}

	labels = append(labels, "product:"+msg.Product)
	labels = append(labels, "feature:"+msg.Feature)

	switch msg.Type {
	case feedbackpb.FeedbackType_FEEDBACK_TYPE_TEXT:
		labels = append(labels, "type:text")
	case feedbackpb.FeedbackType_FEEDBACK_TYPE_VIDEO:
		labels = append(labels, "type:video")
	case feedbackpb.FeedbackType_FEEDBACK_TYPE_GENERAL:
		labels = append(labels, "type:general")
	}

	return labels
}

// statusToLabel converts a FeedbackStatus enum to a label string.
func statusToLabel(status feedbackpb.FeedbackStatus) string {
	switch status {
	case feedbackpb.FeedbackStatus_FEEDBACK_STATUS_OPEN:
		return "open"
	case feedbackpb.FeedbackStatus_FEEDBACK_STATUS_ACKNOWLEDGED:
		return "acknowledged"
	case feedbackpb.FeedbackStatus_FEEDBACK_STATUS_FIXED:
		return "fixed"
	case feedbackpb.FeedbackStatus_FEEDBACK_STATUS_DISMISSED:
		return "dismissed"
	default:
		return "unknown"
	}
}

// issueToFeedbackItem converts a GitHub Issue into a FeedbackItem proto.
func issueToFeedbackItem(issue github.Issue) *feedbackpb.FeedbackItem {
	item := &feedbackpb.FeedbackItem{
		Id:             int64(issue.Number),
		GithubIssueUrl: issue.HTMLURL,
		Comment:        issue.Body,
		CreatedAt:      issue.CreateAt,
		Status:         feedbackpb.FeedbackStatus_FEEDBACK_STATUS_OPEN,
	}

	for _, label := range issue.Labels {
		switch {
		case strings.HasPrefix(label.Name, "product:"):
			item.Product = strings.TrimPrefix(label.Name, "product:")
		case strings.HasPrefix(label.Name, "feature:"):
			item.Feature = strings.TrimPrefix(label.Name, "feature:")
		case strings.HasPrefix(label.Name, "status:"):
			item.Status = labelToStatus(strings.TrimPrefix(label.Name, "status:"))
		case strings.HasPrefix(label.Name, "type:"):
			item.Type = labelToFeedbackType(strings.TrimPrefix(label.Name, "type:"))
		}
	}

	if issue.ClosedAt != "" {
		item.ResolvedAt = issue.ClosedAt
	}

	return item
}

// labelToStatus converts a status label string to a FeedbackStatus enum.
func labelToStatus(label string) feedbackpb.FeedbackStatus {
	switch label {
	case "open":
		return feedbackpb.FeedbackStatus_FEEDBACK_STATUS_OPEN
	case "acknowledged":
		return feedbackpb.FeedbackStatus_FEEDBACK_STATUS_ACKNOWLEDGED
	case "fixed":
		return feedbackpb.FeedbackStatus_FEEDBACK_STATUS_FIXED
	case "dismissed":
		return feedbackpb.FeedbackStatus_FEEDBACK_STATUS_DISMISSED
	default:
		return feedbackpb.FeedbackStatus_FEEDBACK_STATUS_UNSPECIFIED
	}
}

// labelToFeedbackType converts a type label string to a FeedbackType enum.
func labelToFeedbackType(label string) feedbackpb.FeedbackType {
	switch label {
	case "text":
		return feedbackpb.FeedbackType_FEEDBACK_TYPE_TEXT
	case "video":
		return feedbackpb.FeedbackType_FEEDBACK_TYPE_VIDEO
	case "general":
		return feedbackpb.FeedbackType_FEEDBACK_TYPE_GENERAL
	default:
		return feedbackpb.FeedbackType_FEEDBACK_TYPE_UNSPECIFIED
	}
}
