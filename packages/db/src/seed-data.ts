/** Fictional Pigeon API documentation for deterministic RAG demos. */

export type SeedDoc = { title: string; filename: string; content: string };

export const PIGEON_DOCS: SeedDoc[] = [
  {
    title: "Quickstart",
    filename: "quickstart.md",
    content: `# Pigeon Quickstart

Pigeon is a message-delivery API for transactional and marketing email, SMS, and push notifications.

## Create an account

Sign up at dashboard.pigeon.dev. Free tier includes 1,000 messages per month.

## Install the SDK

\`\`\`bash
npm install @pigeon/sdk@2.4.1
\`\`\`

## Send your first message

\`\`\`javascript
import { Pigeon } from "@pigeon/sdk";
const client = new Pigeon({ apiKey: process.env.PIGEON_API_KEY });
await client.messages.send({
  channel: "email",
  to: "user@example.com",
  template: "welcome-v3",
});
\`\`\`

The API base URL is https://api.pigeon.dev/v2. All requests require a Bearer token.

New accounts receive a sandbox API key (prefix \`pk_test_\`) that does not deliver to real inboxes.`,
  },
  {
    title: "Authentication",
    filename: "authentication.md",
    content: `# Authentication

Pigeon uses API keys sent in the Authorization header as Bearer tokens.

## Key types

- **Sandbox keys** (\`pk_test_...\`): simulate delivery, no real sends.
- **Live keys** (\`pk_live_...\`): billable production sends.

Rotate keys from Dashboard > Settings > API Keys. Old keys remain valid for 24 hours after rotation.

## Scopes

Keys can be scoped: \`messages:send\`, \`messages:read\`, \`templates:write\`, \`webhooks:manage\`.

Restricted keys cannot access billing endpoints.

## IP allowlisting

Enterprise plans can restrict keys to CIDR blocks. Default: no restriction.`,
  },
  {
    title: "Webhooks",
    filename: "webhooks.md",
    content: `# Webhooks

Pigeon signs webhook payloads with HMAC-SHA256 using your webhook secret.

## Events

Supported events: \`message.delivered\`, \`message.bounced\`, \`message.opened\`, \`message.clicked\`, \`message.failed\`.

Verify the \`Pigeon-Signature\` header. Timestamp tolerance is 5 minutes.

## Retries

Failed deliveries (non-2xx) retry with exponential backoff: 1 min, 5 min, 30 min, 2 hours, 24 hours. After 5 attempts, the event is marked dead-letter.

Configure endpoint URL per environment in Dashboard > Webhooks.

## Payload size

Maximum webhook body is 256 KB.`,
  },
  {
    title: "Rate Limits",
    filename: "rate-limits.md",
    content: `# Rate Limits

Default limits apply per API key:

| Tier | Requests/min | Burst |
|------|-------------|-------|
| Free | 60 | 10 |
| Growth | 600 | 50 |
| Enterprise | 6000 | 200 |

The \`X-RateLimit-Remaining\` header shows remaining quota.

Exceeding limits returns HTTP 429 with \`Retry-After\` in seconds.

Message send endpoints have a separate cap: 100 concurrent in-flight sends on Free, 1,000 on Growth.

Batch send (\`/v2/messages/batch\`) counts as one request but may include up to 500 recipients.`,
  },
  {
    title: "SDK Reference",
    filename: "sdks.md",
    content: `# SDKs

Official SDKs:

- **Node.js**: \`@pigeon/sdk\` (current 2.4.1)
- **Python**: \`pigeon-python\` (1.8.0)
- **Go**: \`github.com/pigeon-dev/go-pigeon\` (0.9.2)

Community SDKs for Ruby and PHP are listed on pigeon.dev/community.

All SDKs support automatic retries on 429 and 5xx with jitter.

TypeScript types ship with the Node SDK. Python uses Pydantic models for request validation.

Minimum Node version: 18. Minimum Python: 3.10.`,
  },
  {
    title: "Pricing",
    filename: "pricing.md",
    content: `# Pricing

## Email

- Free: 1,000 emails/month included
- Growth: $0.0012 per email after 50,000/month base ($49/mo)
- Enterprise: custom volume pricing

## SMS

- US/CA: $0.0075 per segment
- EU: $0.0095 per segment

## Push

- $0.0002 per notification on all paid plans

## Overage

Free tier hard-stops at 1,000 messages. Growth allows overage at 1.5x list rate.

Invoices are monthly. Usage dashboard updates every 15 minutes.`,
  },
  {
    title: "Changelog",
    filename: "changelog.md",
    content: `# Changelog

## 2.4.1 (2025-11-14)

- Fixed retry logic for webhook dead-letter queue
- Added \`message.spam_reported\` event

## 2.4.0 (2025-10-01)

- Batch send endpoint GA
- New template variable syntax \`{{user.name}}\`

## 2.3.0 (2025-08-12)

- Deprecated v1 API (sunset 2026-03-01)
- SMS unicode segment counting fix

## 2.2.0 (2025-06-01)

- Push notification channel beta

Breaking: \`template_id\` renamed to \`template\` in send payload.`,
  },
  {
    title: "Troubleshooting",
    filename: "troubleshooting.md",
    content: `# Troubleshooting

## 401 Unauthorized

Check that your key prefix matches the environment (test vs live). Ensure no trailing whitespace in the Authorization header.

## 422 Validation Error

Common causes: missing \`to\` field, invalid email format, template not found.

## Messages stuck in queued

Usually indicates rate limit or provider outage. Check status.pigeon.dev.

## Webhook not firing

Confirm endpoint returns 2xx within 10 seconds. TLS 1.2+ required.

## Sandbox vs live

Sandbox keys never hit real carriers. Switch to \`pk_live_\` for production.`,
  },
  {
    title: "Templates Guide",
    filename: "templates-guide.md",
    content: `# Templates Guide

Templates live in Dashboard > Templates or via API \`POST /v2/templates\`.

## Variables

Use \`{{variable}}\` syntax. Nested objects supported: \`{{order.total}}\`.

## Channels

One template definition can target email, SMS (text fallback), and push (title/body fields).

## Versioning

Each publish creates a version. Send requests pin \`template\` slug; latest published version is used unless \`template_version\` is set.

Draft templates cannot be used in production sends.

Maximum template body: 512 KB for email HTML.`,
  },
  {
    title: "Batch Sending Guide",
    filename: "batch-guide.md",
    content: `# Batch Sending

\`POST /v2/messages/batch\` accepts up to 500 recipients per request.

Each item can override template variables per recipient.

Response includes \`batch_id\` for status polling via \`GET /v2/batches/{id}\`.

Partial failures return HTTP 207 with per-item error details.

Batch jobs complete within 5 minutes for 500 recipients under normal load.

Idempotency key header \`Idempotency-Key\` prevents duplicate batches for 24 hours.`,
  },
  {
    title: "FAQ",
    filename: "faq.md",
    content: `# FAQ

**Q: Does Pigeon support attachments?**
A: Email attachments up to 10 MB total per message on Growth and Enterprise.

**Q: Can I send from my domain?**
A: Yes. Add SPF, DKIM, and DMARC records. Verification usually completes within 48 hours.

**Q: Is there a EU data region?**
A: Enterprise plans can pin data to \`eu-west\`. Default region is \`us-east\`.

**Q: What SLA does Enterprise get?**
A: 99.95% uptime SLA with credit policy documented in the enterprise agreement.

**Q: How long are logs retained?**
A: 30 days on Free, 90 days on Growth, 1 year on Enterprise.`,
  },
  {
    title: "Glossary",
    filename: "glossary.md",
    content: `# Glossary

**Message**: A single delivery attempt on a channel (email, SMS, or push).

**Segment**: SMS billing unit. GSM-7: 160 chars; Unicode: 70 chars per segment.

**Template**: Reusable content definition with variable placeholders.

**Webhook**: HTTP callback for delivery events.

**Sandbox**: Test mode with simulated delivery and no carrier charges.

**Batch**: Group send operation with shared template and per-recipient data.

**Dead letter**: Webhook event that exhausted all retry attempts.

**DLQ**: Dead-letter queue storing failed webhook payloads for 7 days.`,
  },
];

export const PIGEON_QUESTIONS = [
  {
    text: "What is the current version of the Node.js Pigeon SDK?",
    referenceAnswer:
      "The current Node.js SDK version is 2.4.1, installed via npm as @pigeon/sdk.",
  },
  {
    text: "How many emails are included in the Free tier per month?",
    referenceAnswer: "The Free tier includes 1,000 emails per month.",
  },
  {
    text: "What HTTP status code does Pigeon return when rate limits are exceeded?",
    referenceAnswer: "Pigeon returns HTTP 429 when rate limits are exceeded, with a Retry-After header.",
  },
  {
    text: "How many webhook retry attempts does Pigeon make before dead-lettering?",
    referenceAnswer:
      "Pigeon retries failed webhook deliveries 5 times with exponential backoff before marking the event as dead-letter.",
  },
  {
    text: "What is the maximum number of recipients per batch send request?",
    referenceAnswer: "Batch send accepts up to 500 recipients per request.",
  },
  {
    text: "When is the v1 API scheduled to be sunset?",
    referenceAnswer: "The v1 API is scheduled for sunset on 2026-03-01.",
  },
  {
    text: "What prefix do sandbox API keys use?",
    referenceAnswer: "Sandbox API keys use the pk_test_ prefix.",
  },
  {
    text: "What is the US/CA SMS price per segment on paid plans?",
    referenceAnswer: "US/CA SMS costs $0.0075 per segment.",
  },
  {
    text: "How long do sandbox keys remain valid after rotation?",
    referenceAnswer:
      "Old API keys remain valid for 24 hours after rotation.",
  },
  {
    text: "What is the maximum webhook body size?",
    referenceAnswer: "The maximum webhook body size is 256 KB.",
  },
  {
    text: "What template variable syntax does Pigeon use?",
    referenceAnswer:
      "Pigeon uses double-brace syntax like {{variable}} or {{order.total}} for nested objects.",
  },
  {
    text: "Does Pigeon support sending fax messages?",
    referenceAnswer:
      "The provided documentation does not cover fax messaging. Pigeon supports email, SMS, and push notifications only.",
  },
];
