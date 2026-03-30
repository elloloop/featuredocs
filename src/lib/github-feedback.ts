export interface GitHubFeedbackConfig {
  owner: string;
  repo: string;
  token: string;
}

export interface GitHubFeedbackInput {
  product: string;
  feature: string;
  version: string;
  locale: string;
  type: "text" | "video" | "general";
  selectedText?: string;
  videoReference?: string;
  comment: string;
  email?: string;
}

export interface GitHubFeedbackResult {
  issueNumber: number;
  issueUrl: string;
}

function buildIssueTitle(input: GitHubFeedbackInput): string {
  const truncatedComment =
    input.comment.length > 50
      ? input.comment.slice(0, 50) + "..."
      : input.comment;
  return `[Feedback] ${input.product}/${input.feature} — ${truncatedComment}`;
}

function buildIssueBody(input: GitHubFeedbackInput): string {
  const sections: string[] = [];

  sections.push(`## Feedback Report\n`);
  sections.push(`| Field | Value |`);
  sections.push(`|-------|-------|`);
  sections.push(`| **Product** | ${input.product} |`);
  sections.push(`| **Feature** | ${input.feature} |`);
  sections.push(`| **Version** | ${input.version} |`);
  sections.push(`| **Locale** | ${input.locale} |`);
  sections.push(`| **Type** | ${input.type} |`);

  if (input.email) {
    sections.push(`| **Email** | ${input.email} |`);
  }

  sections.push("");

  if (input.selectedText) {
    sections.push(`### Selected Text\n`);
    sections.push(`> ${input.selectedText}\n`);
  }

  if (input.videoReference) {
    sections.push(`### Video Reference\n`);
    sections.push(`\`${input.videoReference}\`\n`);
  }

  sections.push(`### Comment\n`);
  sections.push(input.comment);

  return sections.join("\n");
}

function buildLabels(input: GitHubFeedbackInput): string[] {
  return [
    "feedback",
    `product:${input.product}`,
    `locale:${input.locale}`,
    `type:${input.type}`,
  ];
}

export async function createFeedbackIssue(
  config: GitHubFeedbackConfig,
  feedback: GitHubFeedbackInput
): Promise<GitHubFeedbackResult> {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/issues`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title: buildIssueTitle(feedback),
      body: buildIssueBody(feedback),
      labels: buildLabels(feedback),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `GitHub API error (${response.status}): ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    number: number;
    html_url: string;
  };

  return {
    issueNumber: data.number,
    issueUrl: data.html_url,
  };
}

/**
 * Returns a GitHubFeedbackConfig if GITHUB_TOKEN is set, otherwise null.
 * Owner and repo default to glassa-work/featuredocs if not configured.
 */
export function getGitHubFeedbackConfig(): GitHubFeedbackConfig | null {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  return {
    owner: process.env.GITHUB_FEEDBACK_OWNER ?? "glassa-work",
    repo: process.env.GITHUB_FEEDBACK_REPO ?? "featuredocs",
    token,
  };
}
