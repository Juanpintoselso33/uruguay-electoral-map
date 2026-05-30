#!/usr/bin/env node
/**
 * Claude PR Review Script
 *
 * This script automates PR reviews using Claude API.
 * It fetches PR details, sends them to Claude, and posts review comments.
 *
 * Environment Variables:
 * - ANTHROPIC_API_KEY: Claude API key (required)
 * - GITHUB_TOKEN: GitHub token for API access (required)
 * - PR_NUMBER: Pull request number to review (required)
 * - EVENT_ACTION: GitHub event action (optional)
 *
 * Usage:
 *   node claude-pr-review.js
 */

const https = require("https");

// Configuration
const CONFIG = {
  MODEL_ID: "claude-sonnet-4-5-20250514",
  API_URL: "https://api.anthropic.com/v1/messages",
  MAX_TOKENS: 4096,
  MAX_PATCH_CHARS: 50000,
};

// Get environment variables
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const PR_NUMBER = process.env.PR_NUMBER;
const REPO = process.env.GITHUB_REPOSITORY;

async function main() {
  console.log("=== Claude PR Review ===");
  console.log(`PR: #${PR_NUMBER}`);
  console.log(`Repo: ${REPO}`);

  // Validate environment
  if (!ANTHROPIC_API_KEY) {
    console.error("ERROR: ANTHROPIC_API_KEY not set");
    process.exit(1);
  }
  if (!GITHUB_TOKEN) {
    console.error("ERROR: GITHUB_TOKEN not set");
    process.exit(1);
  }
  if (!PR_NUMBER) {
    console.error("ERROR: PR_NUMBER not set");
    process.exit(1);
  }

  try {
    // 1. Fetch PR details
    console.log("\n1. Fetching PR details...");
    const pr = await fetchPR();
    console.log(`   Title: ${pr.title}`);
    console.log(`   Base: ${pr.base.ref} <- Head: ${pr.head.ref}`);

    // 2. Fetch PR files
    console.log("\n2. Fetching PR files...");
    const files = await fetchPRFiles();
    console.log(`   Files changed: ${files.length}`);

    // 3. Build review prompt
    console.log("\n3. Building review prompt...");
    const prompt = buildReviewPrompt(pr, files);

    // 4. Call Claude API
    console.log("\n4. Calling Claude API...");
    const review = await callClaude(prompt);

    // 5. Post review comment
    console.log("\n5. Posting review comment...");
    await postComment(review);

    console.log("\n=== Review Complete ===");
  } catch (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
  }
}

async function fetchPR() {
  const [owner, repo] = REPO.split("/");
  const response = await githubAPI(
    `/repos/${owner}/${repo}/pulls/${PR_NUMBER}`
  );
  return response;
}

async function fetchPRFiles() {
  const [owner, repo] = REPO.split("/");
  const response = await githubAPI(
    `/repos/${owner}/${repo}/pulls/${PR_NUMBER}/files`
  );
  return response;
}

function buildReviewPrompt(pr, files) {
  // Truncate patches if too large
  let patchContent = "";
  let totalChars = 0;

  for (const file of files) {
    if (file.patch) {
      if (totalChars + file.patch.length > CONFIG.MAX_PATCH_CHARS) {
        patchContent += `\n### ${file.filename} (truncated)\n`;
        break;
      }
      patchContent += `\n### ${file.filename}\n\`\`\`diff\n${file.patch}\n\`\`\`\n`;
      totalChars += file.patch.length;
    }
  }

  return `You are a code reviewer. Review this pull request and provide feedback.

## Pull Request
- **Title**: ${pr.title}
- **Description**: ${pr.body || "No description provided"}
- **Base**: ${pr.base.ref}
- **Head**: ${pr.head.ref}
- **Files Changed**: ${files.length}

## Changes
${patchContent}

## Review Guidelines
1. Check for bugs and logic errors
2. Look for security issues
3. Consider performance implications
4. Verify tests are adequate
5. Check code style and readability

## Output Format
Provide your review in the following format:

### Summary
[2-3 sentence summary of the changes]

### Verdict
[APPROVE / REQUEST_CHANGES / COMMENT]

### Feedback
[Detailed feedback organized by category]

#### Bugs
- [Bug findings or "None found"]

#### Security
- [Security concerns or "No issues"]

#### Performance
- [Performance notes or "No concerns"]

#### Style
- [Style suggestions or "Looks good"]

### Recommendation
[Final recommendation: merge, needs changes, or needs discussion]
`;
}

async function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: CONFIG.MODEL_ID,
      max_tokens: CONFIG.MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    const options = {
      hostname: "api.anthropic.com",
      port: 443,
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Claude API error: ${res.statusCode} - ${body}`));
          return;
        }
        try {
          const response = JSON.parse(body);
          const text = response.content[0].text;
          resolve(text);
        } catch (e) {
          reject(new Error(`Failed to parse Claude response: ${e.message}`));
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function postComment(review) {
  const [owner, repo] = REPO.split("/");

  // Format the comment
  const comment = `## Claude PR Review

<!-- claude-pr-review-v1 -->

${review}

---
*Automated review by Claude*
`;

  await githubAPI(`/repos/${owner}/${repo}/issues/${PR_NUMBER}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: comment }),
  });

  console.log("   Comment posted successfully");
}

async function githubAPI(path, options = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: "api.github.com",
      port: 443,
      path: path,
      method: options.method || "GET",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "claude-pr-review",
        ...(options.body && { "Content-Type": "application/json" }),
      },
    };

    const req = https.request(reqOptions, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`GitHub API error: ${res.statusCode} - ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

main();
