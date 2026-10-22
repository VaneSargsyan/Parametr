# Staging recovery failure investigation — 2026-10-13

## Finding and evidence limits

User-reported sequence: POST /recover 200, then GET /verify 403 with
“One-time token not found”, followed by the application's invalid-link page.
No live logs, email URLs, hosted settings or staging endpoints were accessed.
This identifies Supabase email-token verification as the observed failing stage,
not a failed browser password-update call. The exact reason the token cannot be
found is not established. Public upstream Auth code is not proof of the exact
version deployed to this project; it confirms the general verify-before-redirect
flow. Auth may log an underlying 403 while redirecting the browser with an error;
inspect the redirect chain, not just one status field.

The chain is:

1. Application sends resetPasswordForEmail with same-origin /admin/reset-password.
2. Default email ConfirmationURL points to Supabase /auth/v1/verify.
3. Supabase validates/consumes the one-time email token and issues session tokens.
4. Only after successful verification does the app receive a recovery fragment.
5. Isolated memory-only client verifies identity and permits updateUser.

Step 3 fails in the reported incident. The app does not call verifyOtp, follow the
ConfirmationURL, or retry /verify. Its setSession/getUser calls process already
issued session tokens, not the email verification token. URL cleanup happens after
redirect to the application and cannot delete a token inside Supabase. React's
repeated effect setup reuses the same verification promise; it does not send a
second email verification request. Global URL session detection remains disabled.
No client runtime fix for this upstream 403 was identified, and no authentication
architecture, token validation or email template was changed.

POST /recover 200 by itself is not evidence of token validity or of delivery for
that particular request: Auth intentionally avoids account enumeration. In this
case an email did arrive, but it still must be correlated with the exact request.
The default /verify confirmation URL is expected, not a configuration mistake.
The stated localhost Site URL and localhost:5173/** allowlist cover the explicit
callback; a redirect setting cannot recreate a missing one-time token.

## Hypotheses to distinguish

- Earlier consumption/reuse: an earlier successful verification for the same link
  can explain a later failure. That earlier request might be a human, a preview,
  or a security scanner. The single failure supplied does not prove any of them.
- Link scanning: an unsolicited verification before the user's click, especially
  with matching request context and scanner-like timing/user agent, supports this
  possibility. A lone generic user agent or IP is not conclusive evidence.
- Stale/replaced request: using an older email, multiple reset requests, or another
  account flow may change which token is current. Inspect the complete chronology.
- Wrong/altered link: verify host/project, type=recovery, full link integrity and
  actual target of any tracking/security wrapper privately. Truncation, rewriting,
  or a token for another project/type can fail before the app is reached.
- Hosted Auth state/version issue: if the first unaltered fresh link fails without
  earlier consumption or replacement evidence, gather sanitized details for support.
  Missing earlier logs does not prove no earlier request occurred.

## Safest minimal next steps — retain default template

1. Keep the current ConfirmationURL template, isolated client, Site URL and redirect
   settings. Start the app on exactly http://localhost:5173. Use a dedicated verified
   staging test employee, not production accounts.
2. Record UTC time and request ID for ONE request from
   http://localhost:5173/admin/forgot-password. Wait for that email; do not request
   another reset while testing. Respect rate limits and inspect the request's
   success/error without copying its payload or credentials into reports.
3. In staging Auth logs, inspect /verify events before deliberately opening the
   email link, if possible. Then follow the newest link once promptly and record
   the exact human-click time. Avoid previewing, forwarding, repeated clicks,
   automated URL testing, curl, HEAD requests, or link-checking tools: those may
   themselves consume the one-time link.
4. Privately inspect the email target's project host, type=recovery and
   redirect_to=http://localhost:5173/admin/reset-password. Dashboard-initiated
   resets may fall back to Site URL /, which this app also handles. Verify that
   the frontend's public Supabase URL belongs to the same staging project.
   Preserve the original URL; do not manually edit or re-encode token parameters.
5. Correlate Auth request IDs/timestamps, event status/error, user agent and
   request origin/IP where available. Look for an earlier successful verification,
   repeated recovery requests, or a request before human interaction. Compare
   privately against the browser's navigation chain. Do not export/share raw
   verification URLs, redirect Location headers with fragments, HAR files,
   access/refresh/one-time tokens or screenshots containing them. Report only
   sanitized event metadata and route names. Logs may be incomplete.
6. A successful /verify must redirect to the app with a recovery session fragment;
   the app scrubs it, enables the new-password form after server verification,
   and requires normal admin login after update. A provider rejection must show
   the localized error without setSession/password updates/admin authentication.
7. If needed, repeat ONE fresh request with a separately approved controlled test
   mailbox/client whose scanning behavior can be observed. Do not disable
   organization-wide email security or change production. A different outcome is
   supporting evidence, not proof of the mechanism.
8. If an untouched newest link's first observed verification still fails, supply
   Supabase support with staging project reference, UTC window, request IDs and
   sanitized errors. Do not attempt SQL edits of Auth tokens or a privileged
   password-update bypass. Resolve the provider failure before changing the client.

## When a design change would be justified

No custom SMTP or template is currently established as necessary. Successful
email delivery followed by token lookup failure does not demonstrate an SMTP
problem. Custom SMTP is relevant for delivery/sender restrictions, observability
or link tracking; changing sender alone does not stop recipient-side scanning.

Supabase documents that security prefetch can consume default ConfirmationURL
links. If that cause is substantiated and unavoidable, a callback-only client
change cannot prevent it: the email points directly to the consuming /verify
endpoint before any app confirmation button exists. A separately reviewed custom
recovery template would then be necessary. Prefer a human-entered OTP and explicit
recovery verification, or an app confirmation page that verifies only after an
explicit user action. Neither is implemented here; token-bearing interstitial
URLs need their own redaction, leak prevention and scanner review. Do not silently
switch to PKCE, automatically verify a token_hash on page load, or add service keys.
Retain the isolated recovery session and existing staff/RLS authorization in any
future design. Custom SMTP is not inherently required for a template change.

## Local verification

Added provider-rejection regression cases for root/callback hash errors, query
errors and mixed error-plus-plausible-token redirects. They assert no SDK session
establishment or password update, including when the update method is called.
Existing parsing/expiry, password validation, identity and localized-render tests
remain. SDK doubles/SSR do not reproduce hosted /verify, delivery or scanning.
No live recovery email was requested and no real link was opened by this audit.

References:

- [Supabase email template, prefetch and tracking guidance](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Auth verification implementation](https://github.com/supabase/auth/blob/master/internal/api/verify.go)
- [Auth recovery request implementation](https://github.com/supabase/auth/blob/master/internal/api/recover.go)
