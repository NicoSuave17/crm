# Google Workspace backend feasibility

**Assessed:** 2026-10-26  
**Status:** Research and architecture options; no migration decision or implementation approved.  
**Scope:** Static inspection of the current working tree and current official Google documentation. No application build, live data migration, account changes, or load tests were performed.

## Answer

A custom internal CRM can use Google Workspace as its backend, with Apps Script executing application logic and Sheets storing CRM records. Gmail, Calendar, Drive, and other Workspace APIs can supply their native capabilities. These APIs do not provide a ready-made CRM domain model or replace arbitrary business logic.

For this project's full existing behavior, a strict Workspace implementation would be a substantial backend rewrite. A Google Cloud application/database layer plus Workspace integrations is the stronger default recommendation for preserving the existing relational behavior. That recommendation is an engineering judgment, not a hard Google limit on CRM size. The user's preference between strict Workspace and the broader Google platform remains unresolved, as do record volume and simultaneous-user requirements.

## Verified local architecture

- `.planning/PROJECT.md` defines a single-company internal CRM for creator success and sales. Multi-org is explicitly outside its scope. This makes an organization-restricted Workspace integration plausible.
- `src/lib/db/schema.ts` currently defines **40 PostgreSQL tables**. Older descriptions of 18 or 30+ tables are stale. `src/lib/db/index.ts` initializes Drizzle with the PostgreSQL driver.
- `src/lib/hooks/use-contacts.ts` and other hooks call internal JSON APIs. Most UI components can potentially survive a backend rewrite if response contracts are preserved. Replacing Next.js routes with Apps Script requires a transport and authentication redesign, not just a new database driver.
- `src/proxy.ts`, `src/app/layout.tsx`, and `src/lib/auth/helpers.ts` depend on Clerk; user profiles and CRM roles live in PostgreSQL. Google sign-in can supply identity, while ownership, role, team, and field policies remain application responsibilities.
- `src/lib/auth/with-permission.ts` and `permissions.ts` implement application permission checks. The current code includes field restrictions on contact PATCH; older audit documents describing all field checks as absent should not be treated as current evidence.
- `src/lib/api/contacts.ts` uses SQL filtering, joins, related company lookups, ordering, pagination, and counts. Sheets would require replacement query logic or maintained projections.
- `src/app/api/contacts/merge/route.ts` uses a SQL transaction to relink activities, tasks, deals, tags, and company associations before deleting a duplicate. `src/lib/api/pipelines.ts` transactionally reorders stages. `src/lib/db/crm-id.ts` atomically allocates CRM identifiers.
- `src/lib/admin/report-engine.ts` builds SQL reports with joins, grouping, filters, aggregates, and calculated fields. This execution layer would need replacement.
- `src/app/api/import-jobs/route.ts` and `src/lib/api/import-processor.ts` implement persisted import work, deduplication, ownership resolution, related records, custom fields, and review handling.
- `src/lib/ai/openrouter.ts` calls OpenRouter. Preserving that exact dependency would violate a strict Workspace-only requirement. Any replacement must be evaluated explicitly; it must not be silently removed.
- Email templates and activity logging exist, but the inspected application has no Gmail/Calendar integration. Whop marketplace synchronization remains planned; schema tables do not establish a functioning sync. Live Whop data would still need an authorized source such as Whop's API.

Representative contact write: authenticated request → CRM permission checks → validation → AI gatekeeper → normalization/validation → identifier allocation → database write → audit → JSON response. All these steps need an owner in any replacement architecture.

## Capability mapping

| CRM responsibility | Strict Workspace implementation | Additional application work |
|---|---|---|
| Login and staff identity | Google identity and organization-restricted access | Approved-user provisioning, CRM role mapping, verified caller identity |
| Contacts, companies, deals, stages, tags, custom fields | Sheets records with stable IDs | Validation, relationships, indexes/projections, search, conflict handling |
| Address book integration | People API | Sync and conflict rules; the user's address book is not the entire shared CRM |
| Email and threads | Gmail API | Record matching, synchronization state, consent, retries, access policies |
| Meetings | Calendar API | CRM links, synchronization, ownership and conflict rules |
| Files and proposals | Drive and Docs APIs | CRM associations, access policy, generation templates |
| Follow-up tasks | Custom CRM task records; optional Google Tasks sync | Assignees, priority, CRM relationships, custom states and detailed deadlines |
| Rules, alerts, imports and scheduled sync | Apps Script web apps and scheduled triggers | Resumable jobs, explicit rule execution, retry/idempotency and failure tracking |
| Reports, merges and history | Custom Apps Script logic over stored records | Replacement query engine, coordinated writes and CRM audit records |

Native capability sources: [People API](https://developers.google.com/people), [Calendar overview](https://developers.google.com/workspace/calendar/api/guides/overview), [Drive overview](https://developers.google.com/workspace/drive/api/guides/about-sdk), [Google Tasks resource](https://developers.google.com/workspace/tasks/reference/rest/v1/tasks), [Workspace authorization](https://developers.google.com/workspace/guides/auth-overview). Tasks has a narrower model than this CRM; its API discards the time portion of the `due` field.

## Constraints that affect the design

1. **Sheets capacity is not database semantics.** Default API quotas list 300 reads and 300 writes per minute per project, with 60 of each per user per project. Service-account calls count as one account. Batching and caching matter; existing UI polling must be budgeted. Quota adjustments are possible and account-specific. Sheets supports atomic batch updates, but these are not relational transactions across files and services. [Limits](https://developers.google.com/workspace/sheets/api/limits), [batch updates](https://developers.google.com/workspace/sheets/api/guides/batchupdate).
2. **Permissions need an explicit trust boundary.** Sheets OAuth scopes apply to spreadsheet files, not individual tabs or CRM records. Do not grant users direct access to a master sheet containing data the CRM hides from them. Keep that storage restricted and enforce every read/write through verified application identity and authorization. Deployer-run Apps Script needs a proven caller-identity design. [Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes), [web apps](https://developers.google.com/apps-script/guides/web), [Session identity](https://developers.google.com/apps-script/reference/base/session).
3. **Apps Script is a bounded runtime.** Published limits include six minutes per execution, 30 simultaneous executions per user, and six hours of trigger runtime per day for Workspace users. Imports and syncs need checkpoints and resumable batches. Script locks can coordinate cooperating callers; they do not cover manual edits or create transactions across Gmail, Sheets, and Drive. [Quotas](https://developers.google.com/apps-script/guides/services/quotas), [LockService](https://developers.google.com/apps-script/reference/lock/lock-service).
4. **Sheet edit triggers do not observe every write.** Script/API changes do not fire installable edit triggers. CRM write logic must explicitly run validation, audit, and automation steps. [Installable triggers](https://developers.google.com/apps-script/guides/triggers/installable).
5. **Gmail push expands the boundary.** Push notifications require Google Cloud Pub/Sub and watch renewal at least every seven days; Google recommends daily renewal. Delivery gaps still need history reconciliation. A strict Workspace design can poll instead, with delay and quota implications. [Gmail push](https://developers.google.com/workspace/gmail/api/guides/push).
6. **Mailbox authorization depends on distribution.** Full inbox access uses restricted scopes; organization-owned, internal-only applications can qualify for verification exceptions. Public/external distribution changes the requirements. Gmail API sending remains subject to normal sending limits. [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [internal-use exception](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification#internal-use-only), [sending limits](https://developers.google.com/workspace/gmail/api/guides/handle-errors#mail-sending-limits).

## Architecture options

| Option | Shape | Assessment |
|---|---|---|
| Strict Workspace | Custom UI → authenticated Apps Script application → restricted Sheets storage plus Gmail/Calendar/Drive | Feasible for an internal CRM if representative load, permissions, and consistency requirements are proven. Rebuilds most backend behavior. No performance promise without measurement. |
| Broader Google platform | Existing UI → Google Cloud application/runtime and database → Workspace integrations | Recommended direction for full existing scope if the requirement permits Google Cloud. Cloud hosting, database, and Pub/Sub are separate services rather than benefits automatically supplied by a Workspace subscription. |
| Keep existing persistence | Existing Next.js/PostgreSQL application with Google identity and Workspace integrations | Preserves current relational implementation while making communications and files Workspace-native. Does not meet a strict Workspace-only backend requirement. |

All options still require custom business logic. Strict Workspace does not mean direct browser access to every shared storage file. Retaining the current Next.js server as an API bridge would also retain a backend runtime outside Apps Script; that must be named honestly.

## Required evidence before committing to a migration

- Establish whether Google Cloud is permitted, expected contact/activity volumes, active users and concurrent writers, import sizes, sync freshness, and access/audit requirements.
- Prove one vertical slice preserving the current UI/API behavior: contact create/edit/search, deal stage movement with history, role-restricted reads/writes, and one representative joined report.
- Exercise concurrent edits, duplicate creation/merge, bulk imports, partial external-service failure, and retry recovery. Verify no silent overwrites, duplicate side effects, or leaked fields/records.
- Measure latency, API calls, script runtime, and growth using representative data. Determine acceptable limits from evidence rather than assigning an unsupported user-count threshold.
- Define a migration/backfill/reconciliation and rollback plan before moving live records. No migration or scope reduction has been authorized by this assessment.

No application code was changed. This note records findings and recommendations, not proof that the proposed backend has been built or load-tested.
