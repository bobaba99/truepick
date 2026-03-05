# Debt

`feat/[]`

- I could add something like '85% of the users chose skip and was satisfied with their skip.'
- Include community support from others right after receiving the verdicts.
- Include placeholders for social media accounts
- 

`fix/[]`

- [x] Add a loading bar during evaluation and regeneration, implement Claude-like words (e.g., fidgeting, coalescing)
- [x] Adapt for mobile web browswer size and layout
- [ ] Add guiding questions for writing justification
- [ ] Add warning modal dialog if the justification is too short

`feat/purchase-email-import-flow`

- [x] Outlook implementation
- [x] Reevaluate the strategy/architecture for filtering and parsing the emails (maybe consult Opus 4.6 before implementing)
- [x] ~~Generate test email sets according to vendor data~~
- [x] ~~Some emails are image-based instead of text-based, skipping lots of those ones~~ Not true

`feat/about`

- [ ] Write content for about page
- [ ] Update about page content

`feat/support`

- [ ] Write content for support page
- [ ] Update support page content

`feat/resource-page-seo-optimization`

- [ ] research on SEO optimization
- [ ] generate a SEO optimization rule/document
- [ ] implement SEO optimization for preset documents

`feat/settings-route-user-preferences`

- [x] Create modal dialog of user preferences
- [x] Generate a list of functions for user preferences
- [x] Implement the preference functions

`feat/verdict-share-capability`

- [x] Design the verdict share card UI
- [x] Add the verdict share card generation as a modal dialog
- [x] Implement social media sharing handles
- [x] Implement image saving and sending to text message or email

`feat/daily-limit`

- [ ] PaywallModal has no CSS — add `.paywall-modal`, `.paywall-modal-close`, `.paywall-cta-btn`, `.paywall-signup-link`, `.paywall-email-input` styles to App.css
- [ ] `user_tier` in `trackVerdictRequested` is hardcoded to `'free'` — wire real tier from API response once available
- [ ] `verdictsRemainingToday` is never populated from successful API responses (verdicts_remaining in response body not yet read back into state)
- [ ] Anonymous auth requires enabling in Supabase dashboard: Authentication > Providers > Anonymous
- [ ] Stripe webhook stub for `paywall_conversion_completed` not yet implemented
