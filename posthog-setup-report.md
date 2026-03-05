<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Truepick API server (`apps/api/src/index.ts`). The `posthog-node` SDK (already present as a dependency) was initialized with environment variables `POSTHOG_API_KEY` and `POSTHOG_HOST`, with `enableExceptionAutocapture: true` for automatic exception tracking. User identity is established on every authenticated request via `posthog.identify()` in the `requireAuth` middleware, linking all server-side events to the Supabase user ID and email. Twelve distinct events are now captured across all meaningful API actions, covering LLM usage, admin content management, image uploads, embeddings search, and rate limiting friction. Exception capture (`captureException`) is added to all catch blocks in LLM routes and a global Express error handler. Graceful shutdown via `posthog.shutdown()` is wired to `SIGINT`/`SIGTERM` signals to ensure queued events are flushed before the process exits.

| Event | Description | File |
|-------|-------------|------|
| `verdict_evaluated` | Fired when a verdict LLM evaluation completes successfully on the server. Captures the model used and response metadata. | `apps/api/src/index.ts` |
| `verdict_eval_failed` | Fired when a verdict LLM evaluation fails on the server (OpenAI error, timeout, or validation error). | `apps/api/src/index.ts` |
| `receipt_parsed` | Fired when an email receipt is successfully parsed by the LLM. Indicates a purchase was successfully extracted. | `apps/api/src/index.ts` |
| `receipt_parse_failed` | Fired when receipt parsing fails (OpenAI error or incomplete response). | `apps/api/src/index.ts` |
| `embeddings_searched` | Fired when a user performs an embeddings/semantic search. | `apps/api/src/index.ts` |
| `resource_created` | Fired when an admin creates a new resource article. | `apps/api/src/index.ts` |
| `resource_updated` | Fired when an admin updates an existing resource article. | `apps/api/src/index.ts` |
| `resource_published` | Fired when an admin publishes a resource article. | `apps/api/src/index.ts` |
| `resource_unpublished` | Fired when an admin unpublishes a resource article. | `apps/api/src/index.ts` |
| `resource_deleted` | Fired when an admin deletes a resource article. | `apps/api/src/index.ts` |
| `image_uploaded` | Fired when an admin uploads a cover image for a resource article. | `apps/api/src/index.ts` |
| `rate_limit_exceeded` | Fired when a user hits the LLM rate limit. Useful for tracking friction and capacity planning. | `apps/api/src/index.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics:** https://us.posthog.com/project/332148/dashboard/1332878
- **Receipt Parsing: Success vs Failure** — https://us.posthog.com/project/332148/insights/lIExbqEu
- **Verdict Evaluation: Success vs Failure** — https://us.posthog.com/project/332148/insights/oTDEi1SQ
- **Daily Active LLM Users** — https://us.posthog.com/project/332148/insights/aPVHPMUW
- **Resource Lifecycle Funnel** (created → published) — https://us.posthog.com/project/332148/insights/GDXACwJU
- **Rate Limit Exceeded** — https://us.posthog.com/project/332148/insights/D0s0ajYk

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
