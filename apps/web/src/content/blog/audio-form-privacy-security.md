# Audio form privacy and security: a practical launch checklist

An audio form can process more than a conventional text field. The browser handles microphone permission, a realtime provider may receive audio, a transcript may contain unplanned personal information, structured extraction creates a durable record, and exports can spread that record into other systems. A privacy notice alone does not control those paths.

Launch readiness begins with a data map and ends with verified technical controls. The product must explain the experience before collection, minimize what it requests, authenticate every sensitive route, limit vendor and employee access, define retention, support correction and deletion, and recover from incidents. Legal requirements vary by jurisdiction and use case, so this guide is an engineering and product checklist, not legal advice.

## Map every data flow

Draw the sequence from the landing page to deletion. Include configuration, microphone permission, browser audio, realtime transport, provider processing, partial and final transcripts, structured answers, summaries, analytics, application logs, error monitoring, databases, backups, exports, support tools, and downstream integrations.

For each element record purpose, data category, source, destination, owner, lawful basis or business justification, encryption, access roles, retention, deletion mechanism, and vendor. Mark whether the data is required, optional, generated, or inferred. Voice-derived emotion or demographic inference should not appear merely because a model can attempt it.

The UK Information Commissioner's Office [data minimisation guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/data-minimisation/) recommends collecting data that is adequate, relevant, and limited to what is necessary. Apply that test field by field and log by log. Removing unnecessary collection is more reliable than promising to protect it forever.

## Explain the exchange before microphone access

The pre-call screen should name the organization or form owner, purpose, expected duration, categories of information, whether audio is retained, whether a transcript is stored, how the result will be used, and where to read privacy and terms. Present voice and typing as equal options.

Trigger the browser prompt only after the person deliberately selects voice. The [MDN getUserMedia reference](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) explains secure-context and permission requirements. Do not repeatedly prompt after denial. Continue in text and provide settings help only for users who want it.

Separate consents. Agreement to participate is not necessarily agreement to marketing, recording, public quotation, or model training. Avoid bundled or preselected choices. Record the notice version and specific choices associated with the session.

## Minimize audio and transcript retention

Ask whether raw audio must be stored. For many intake workflows, audio can be processed in transit and discarded, while structured answers are shown for review. If audio supports research review, quality assurance, or dispute resolution, define the narrower access group and a short retention period.

Transcripts are not harmless substitutes. They can contain names, health details, account information, or unrelated speech from people nearby. Keep partial transcripts out of analytics and ordinary logs. Label generated summaries, retain source evidence only as needed, and allow exact fields to be corrected directly.

Deletion must reach primary storage, derived records, search indexes, and downstream systems within a documented process. Define how backups expire and what happens when immediate removal is technically impossible. Test the process with a real sample record before publishing the promise.

## Authenticate and authorize every sensitive operation

Session creation, listing, reading, updating, completion, and export must require an authenticated principal or a deliberately scoped capability. Check tenant and form ownership on the server. A random-looking session ID is not authorization.

Use least privilege for employees and services. Separate product access from administrative support, log privileged actions, and review roles. Protect exports because JSON and Markdown files can be copied outside the application. Add expiration or reauthentication for sensitive downloads where appropriate.

Realtime client credentials need their own control plane. The backend should verify user, origin, form ownership, quota, and rate limits before issuing a short-lived credential. Monitor concurrent sessions and spend. Never expose the long-lived OpenAI API key to browser code.

The [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/) provides a broad verification framework covering authentication, session management, access control, validation, data protection, logging, and APIs. Select a target level appropriate to risk and turn it into testable acceptance criteria.

## Harden imports and external content

Importing an arbitrary URL creates server-side request forgery and parser risks. Allow only HTTP and HTTPS, resolve DNS, block loopback, link-local, private, metadata, and internal ranges, and recheck after every redirect. Limit response size, content type, redirects, and total time. Rate-limit requests and isolate browser fallbacks.

Treat fetched HTML and scripts as untrusted. Prefer parsing inert markup to executing page code. If a browser renderer is required, run it in a constrained environment with outbound network controls, resource budgets, and no access to application credentials. Never evaluate imported scripts in the application process.

Disclose import limitations. Public visibility does not prove ownership or permission to reuse content. The operator should confirm they control the form and review the extracted draft. Do not bypass private forms, authentication, anti-bot controls, or platform restrictions.

## Validate input and output boundaries

Models and clients are untrusted inputs to the server. Validate every tool call against the versioned form schema, active field, allowed type, and size. Reject unknown fields and options. Normalize data using deterministic code and show the result for user confirmation.

Escape rendered content and sanitize any supported Markdown or HTML. Prevent spreadsheet formula injection if CSV export is added. Use safe content dispositions for downloads and restrict webhook destinations if outbound integrations are introduced.

Do not put secrets, passwords, payment card data, government IDs, or medical details into a general-purpose voice workflow unless the system is explicitly designed and reviewed for that risk. Provide a separate secure channel when such data is genuinely required.

## Know what providers do with data

List each subprocessor with purpose, data category, location considerations, and a link to its privacy or security information. Review contracts and account settings. OpenAI's [API data controls guidance](https://developers.openai.com/api/docs/guides/your-data) is a starting point for understanding provider handling, but your implementation, logs, and agreement determine the actual posture.

Keep vendor configuration in deployment environments, rotate secrets, and restrict who can read production values. Monitor changes to provider terms and models. If regional processing or zero-retention controls matter, verify eligibility and configuration rather than repeating a generic marketing statement.

Publish a subprocessor change process and contact channel. A support address such as support@talkform.ai must be monitored before it is named as a privacy or incident route. Do not fabricate a company address, privacy officer, certification, or response time.

## Write an honest privacy and security surface

The privacy notice should describe categories collected, sources, purposes, sharing, retention approach, choices, rights, security summary, children's policy, international processing where relevant, changes, and contact. The terms should cover service scope, acceptable use, user content, third-party services, disclaimers, termination, and contact without claiming features that do not exist.

The California Department of Justice provides a [CCPA overview](https://oag.ca.gov/privacy/ccpa), and the Federal Trade Commission publishes [privacy and security guidance](https://www.ftc.gov/business-guidance/privacy-security). Legal counsel should determine which rules apply to the operator, customers, and specific workflows.

A security page can describe verified practices and current limitations. State that no Internet service is perfectly secure. Provide a responsible disclosure channel. Do not display SOC 2, HIPAA, GDPR-compliant, encrypted-everywhere, or zero-retention claims unless the precise scope is documented and supported.

## Prepare detection and response

Log authentication outcomes, authorization denials, session creation, export, administrative access, retention jobs, and security-relevant configuration changes. Avoid transcript or answer content in these logs. Protect log access and retention.

Alert on unusual secret issuance, session volume, import targets, export volume, access denials, provider errors, and cost. Maintain an emergency switch that stops new voice sessions or URL imports while preserving a safe text or support path.

Write an incident plan with roles, evidence preservation, containment, vendor escalation, legal assessment, customer communication, and post-incident review. Run a tabletop exercise. The first time a team decides who owns provider revocation should not be during an active incident.

## Verify privacy operations, not just pages

Create a test account and session, then exercise access, correction, export, and deletion. Confirm that another tenant cannot retrieve it. Verify retention jobs, backup behavior, analytics redaction, and support procedures. Test rate limits and spending controls.

Review the public notice against the data map. Every collection and vendor should have a corresponding statement, and every published user choice should have a working operational path. Revisit the map when a model, analytics tool, storage system, or integration changes.

A launch is not ready when session routes are public, storage is process-local, URL imports can reach private networks, microphone consent is absent, text depends on audio connection, or privacy links return 404. It is ready for controlled use when the full path is minimized, authorized, testable, documented, monitored, and owned.

Privacy and security are qualities of the operating system around the interview. The clearest notice cannot compensate for open exports, and strong encryption cannot justify unnecessary collection. Build the smallest useful data flow, give people control, and prove the controls before asking them to trust the microphone.
