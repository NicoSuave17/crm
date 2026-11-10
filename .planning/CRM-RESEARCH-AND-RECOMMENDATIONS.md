# CRM Research Findings & Recommended Improvements

**Generated:** 2026-03-05
**Sources:** EspoCRM, SuiteCRM, Twenty CRM, Salesforce, Zoho, HubSpot, Dynamics 365, NocoBase, Krayin, and 30+ industry resources

---

## Part 1: Industry Research — What Best-in-Class CRMs Do

### 1. Permission Systems (Gold Standard: EspoCRM + Salesforce)

**4-Layer Permission Model** (most mature CRMs use all 4):
```
Layer 1: ROLE-LEVEL      → What entities can this role access?
Layer 2: RECORD-LEVEL    → Which specific records? (all / team / own / none)
Layer 3: FIELD-LEVEL     → Which fields can be read / edited?
Layer 4: ACTION-LEVEL    → Which actions? (create / read / edit / delete / export / import / mass-update)
```

**Key Patterns:**
- **Deny-by-default** — users start with zero access, roles grant permissions
- **Most permissive wins** — when multiple roles apply, the broadest grant takes effect
- **Field-level is SEPARATE from record-level** — a user might see a record but have specific fields hidden or read-only
- **Record scope hierarchy**: `all` > `team` > `own` > `none`
- **Salesforce uses OWD** (Org-Wide Defaults) as the baseline, then opens up via role hierarchy + sharing rules

**Whop CRM Gap:** We have Layers 1-2 working, Layer 3 configured but NOT enforced, Layer 4 partially implemented.

### 2. Audit Logging (Gold Standard: Salesforce Field Audit Trail)

**Industry-Standard Schema:**
```
entity_type, entity_id, action, field_name, old_value, new_value,
user_id, source (ui/api/import/automation), ip_address, metadata, created_at
```

**Two Design Approaches:**
- **Row-per-field**: One row per changed field (SugarCRM, Dynamics 365) — easy to query per-field history
- **Row-per-operation with JSONB changeset**: One row per save with all changes in JSONB (modern approach) — fewer rows

**Best Practices:**
- Mark fields as "auditable" rather than tracking everything (prevents data bloat)
- Capture `source` (UI, API, import, automation, webhook) on every change
- Append-only / immutable — audit logs should never be editable
- Separate read pool for audit queries (don't impact OLTP)
- Retention: 90 days hot, 3-7 years cold storage

**Whop CRM Gap:** We have basic field tracking but miss: creates, deletes, bulk ops, tags, custom fields, source tracking, IP capture.

### 3. Approval Workflows (Reference: Zoho CRM)

**How Enterprise CRMs Handle It:**
1. **Entry Criteria** — define which changes trigger approval (e.g., deal value > $100K)
2. **Record Locking** — record is LOCKED during pending approval
3. **Approver Chain** — by role, user, manager, or group
4. **On Approve** — apply changes, notify, create audit entry
5. **On Reject** — revert, notify, log reason
6. Store PROPOSED changes separately from the actual record

**Whop CRM Gap:** No approval workflows exist. All changes are immediate.

### 4. Record Locking (Reference: Zoho CRM)

**Types:**
- **Manual** — user locks a record to prevent edits
- **Automatic** — based on criteria (e.g., deal is closed-won → lock)
- **Restricted actions**: edit, tags, convert, delete, change_owner
- **Field exclusions**: some fields can remain editable even when locked

**Whop CRM Gap:** No record locking exists.

### 5. Data Integrity Features

| Feature | Industry Standard | Whop CRM |
|---------|------------------|----------|
| Soft deletes / trash | Yes (30-day recovery) | **No** — hard deletes only |
| Merge audit trail | Keep record of which records merged | **No** — original data lost |
| Duplicate detection on create | Warning dialog before save | **Just added** |
| Scheduled deduplication | Monthly/quarterly batch scan | **No** |
| Data masking by role | Hide PII for certain roles | **No** |
| Required field enforcement | Block save if missing | Zod validation only |
| Cross-field validation | Custom rules (if X then Y required) | **No** |

### 6. Workflow Automation

**Trigger → Condition → Action Pattern:**
- **Triggers**: record create, update, delete, field change, time-based
- **Conditions**: if/else logic on field values
- **Actions**: update fields, create tasks, send notifications, assign owner, create activities

**Common Workflows:**
- Auto-assign new leads via round-robin
- Create follow-up task when deal stage changes
- Send alert when health score drops below threshold
- Auto-close stale deals after N days
- Welcome sequence for new contacts

**Whop CRM Gap:** No workflow engine. Alerts are scaffolded but have no trigger logic.

### 7. Reporting & Analytics

**Essential CRM Reports:**
1. Pipeline health (value by stage, velocity, conversion rates)
2. Sales forecasting (weighted pipeline, probability-based projections)
3. Activity monitoring (calls, emails, meetings per rep)
4. Win/loss analysis (reasons, competitor tracking)
5. Revenue attribution (by source, channel, campaign)
6. Team performance scorecards

**Role-Specific Dashboards:**
- **Reps**: personal pipeline, upcoming tasks, activity targets
- **Managers**: team pipeline, conversion rates by rep, forecast
- **Execs**: revenue metrics, lead source ROI, trend lines

**Whop CRM Gap:** Report engine exists but limited report types. Dashboard is basic.

### 8. Integration & Events

**Webhook/Event Best Practices:**
- Events are immutable facts ("Contact Updated", not "Send Welcome Email")
- Include idempotency keys for deduplication
- Retry with exponential backoff + DLQ
- Capture: event_type, entity_type, entity_id, changes, actor, timestamp

**Whop CRM Gap:** No webhook/event system. No external integrations beyond Clerk.

---

## Part 2: Recommended Improvements — Priority Ordered

### CRITICAL (Must-Have for Data Integrity)

#### C1. Enforce Field-Level Permissions in PATCH Handlers
**Problem:** `fieldOverrides` are configured in admin but never checked when processing PATCH requests. A user with `readonly` on a field can still update it via API.

**Solution:**
- In `withDetailPermission()`, after scope check, load `fieldOverrides` for (role, entityType)
- Strip any `readonly` or `hidden` fields from the update payload before passing to the data layer
- Return 403 with field name if a `hidden` field is submitted
- Frontend: already uses `getFieldAccess()` to hide/disable fields — just needs backend enforcement

**Effort:** Small (modify `with-permission.ts` + each PATCH handler)

#### C2. Comprehensive Change Tracking
**Problem:** Only PATCH operations tracked. Bulk ops, creates, deletes, tags, custom fields, merges all untracked.

**Solution:**
- Create a unified `auditLog` table (dedicated, not reusing activities):
  ```sql
  audit_log: id, entityType, entityId, action (create/update/delete/merge/assign/tag/import),
  changes (JSONB), userId, source (ui/api/import/bulk), ipAddress, correlationId, createdAt
  ```
- Create `recordAudit()` helper called from every mutation path
- Add `source` parameter to all API handlers
- Track: creates (snapshot all fields), updates (old/new diff), deletes (snapshot), bulk ops (per-record with correlationId), tag changes, custom field changes, merges (both source records)
- Make audit log **immutable** — no UPDATE or DELETE on this table

**Effort:** Medium (new table, new helper, update all mutation paths)

#### C3. Audit Log Visibility by Permission
**Problem:** Audit log is admin/manager only. No configurable visibility.

**Solution:**
- Add `auditLog` as a permission dimension in `adminPermissions` with scope: `all` / `own` / `none`
- `all` = can see all audit entries
- `own` = can see audit entries for records they own
- `none` = no audit log access
- Add "Audit" permission to the admin permissions UI

**Effort:** Small (add column + filter in audit API)

#### C4. Track Task Changes in History
**Problem:** Task status/priority/assignee changes not recorded.

**Solution:** Add `recordFieldChanges()` call in the PATCH /api/tasks/[id] handler (same pattern as contacts/deals/companies).

**Effort:** Tiny

### HIGH PRIORITY (Expected Enterprise Features)

#### H1. Soft Deletes + Trash/Recycle Bin
**Problem:** All deletes are permanent. No recovery possible.

**Solution:**
- Add `deletedAt` timestamp column to contacts, companies, deals, tasks
- Change DELETE handlers to SET `deletedAt = NOW()` instead of hard delete
- Filter out soft-deleted records in all list queries
- Add `/api/{entity}/trash` endpoint to list deleted records
- Add restore endpoint: PATCH `/api/{entity}/{id}/restore`
- Hard delete after 30 days (scheduled job or manual admin action)
- Track deletion and restoration in audit log

**Effort:** Medium

#### H2. Complete Team-Based Permissions
**Problem:** Team scope exists in code but is untested and has inefficient queries.

**Solution:**
- Fix `getTeamMemberIds()` to use a single efficient query
- Add team management UI (currently tables exist but no admin page)
- Test team-scope filtering end-to-end for all entity types
- Add team assignment to user profile

**Effort:** Medium

#### H3. Record Locking
**Problem:** No way to prevent edits on specific records.

**Solution:**
- Add `isLocked` boolean + `lockedBy` + `lockedAt` + `lockReason` to core entity tables
- Add lock/unlock endpoints
- In PATCH handlers: if `isLocked` and user != admin, return 423 Locked
- Support automatic locking rules (configurable): e.g., "lock deals when stage is closed-won"
- Admin can always override locks

**Effort:** Medium

#### H4. Approval Workflows (Phase 1: Simple)
**Problem:** No change approval mechanism.

**Solution:**
- New `approvalRequests` table: entityType, entityId, requestedBy, status, approverId, changes (JSONB), reason
- Configurable rules: "deal value changes > $X require manager approval"
- On trigger: create approval request, lock the record
- On approve: apply changes, unlock, audit
- On reject: discard changes, unlock, audit, notify
- Admin UI to configure approval rules

**Effort:** Large

### MEDIUM PRIORITY (Valuable Additions)

#### M1. Audit Source Tracking
**Problem:** Can't distinguish UI changes from API/import/bulk changes.

**Solution:** Pass `source` through all mutation paths. Values: `ui`, `api`, `import`, `bulk`, `automation`, `merge`.

**Effort:** Small

#### M2. CSV Export for All Entities
**Problem:** Only contacts can be exported.

**Solution:** Extend GET /api/bulk to support entityType=company, entityType=deal, entityType=task with the same custom-field-aware CSV generation.

**Effort:** Small

#### M3. Activity Edit Endpoint
**Problem:** `updateActivity()` exists but no PATCH route is exposed.

**Solution:** Add PATCH /api/activities/[id] route, restricted to activity creator or admin.

**Effort:** Tiny

#### M4. Email Template Rendering
**Problem:** Templates exist but placeholders aren't rendered.

**Solution:** Build template engine that replaces `{{contact.firstName}}`, `{{deal.title}}`, etc. Apply in activity form preview.

**Effort:** Small

#### M5. Data Masking by Role
**Problem:** All users with read access see all field values including PII.

**Solution:** Extend `fieldOverrides` to include `masked` option. Masked fields show `•••` in UI, full value only on click/hover for permitted roles.

**Effort:** Medium

#### M6. Login / Session Tracking
**Problem:** No visibility into who logged in when, from where.

**Solution:** Clerk webhooks already fire on sign-in. Capture to a `loginHistory` table: userId, timestamp, ipAddress, userAgent. Show in admin panel.

**Effort:** Small

### FUTURE PRIORITY (Advanced Capabilities)

#### F1. Workflow Automation Engine
- Configurable trigger → condition → action rules
- Event-based: field change, record create, time-based
- Actions: update fields, create tasks, send alerts, assign owner
- Admin UI for workflow builder

#### F2. Webhook / Event System
- Emit events on all record mutations
- Configurable webhook subscriptions
- Retry with exponential backoff
- Event replay for missed deliveries

#### F3. Advanced Search
- Full-text search with pg_trgm or ElasticSearch
- Saved search queries
- Cross-entity search ("contacts with deals in stage X")
- Field-specific search syntax

#### F4. Scheduled Jobs
- Alert trigger evaluation (GMV drops, churn risk, stale deals)
- Scheduled deduplication scans
- Data retention cleanup
- Report scheduling / email delivery

#### F5. Territory Management
- Territory definition (rules-based assignment)
- Territory hierarchy
- Record auto-assignment by territory rules
- Territory-scoped visibility

---

## Part 3: Implementation Roadmap

### Phase 1: Data Integrity & Permissions (Immediate)
1. **C1** — Enforce field-level permissions in PATCH handlers
2. **C2** — Comprehensive audit log (new dedicated table + universal tracking)
3. **C3** — Audit log visibility by role permission
4. **C4** — Track task changes

### Phase 2: Enterprise Safety (Next)
5. **H1** — Soft deletes + trash/recycle bin
6. **H2** — Complete team permissions
7. **H3** — Record locking (manual + automatic rules)
8. **M1** — Source tracking on all changes

### Phase 3: Approval & Governance
9. **H4** — Approval workflows (configurable rules)
10. **M5** — Data masking by role
11. **M6** — Login/session tracking

### Phase 4: Quality of Life
12. **M2** — CSV export for all entities
13. **M3** — Activity edit endpoint
14. **M4** — Email template rendering

### Phase 5: Automation & Integration
15. **F1** — Workflow automation engine
16. **F2** — Webhook/event system
17. **F4** — Scheduled jobs (alerts, dedup, retention)

### Phase 6: Advanced
18. **F3** — Advanced search
19. **F5** — Territory management

---

## Sources

### Open Source CRMs Analyzed
- [Twenty CRM](https://github.com/twentyhq/twenty) — Modern Salesforce alternative
- [EspoCRM](https://docs.espocrm.com/administration/roles-management/) — Gold standard RBAC
- [SuiteCRM](https://docs.suitecrm.com/admin/administration-panel/roles-and-security-groups/) — Security Groups + Roles
- [NocoBase](https://www.nocobase.com/en/blog/how-to-design-rbac-role-based-access-control-system) — Plugin-based RBAC
- [Krayin CRM](https://devdocs.krayincrm.com/2.0/packages/create-acl.html) — ACL-based

### Enterprise CRM References
- [Salesforce Field Audit Trail](https://developer.salesforce.com/docs/atlas.en-us.field_history_retention.meta/field_history_retention/field_audit_trail.htm)
- [Salesforce Data Security Model](https://developer.salesforce.com/blogs/developer-relations/2017/04/salesforce-data-security-model-explained-visually)
- [Zoho CRM Approval Process](https://www.zoho.com/crm/tutorials/approval-process/overview.html)
- [Zoho Record Locking](https://help.zoho.com/portal/en/kb/crm/customize-crm-account/record-level-customization/articles/record-locking-configuration-and-usage)
- [Dynamics 365 Security Roles](https://dynamics-chronicles.com/article/deep-dive-security-roles-dynamics-365)
- [SugarCRM Audit Trail](https://www.sugarcrm.com/blog/field-auditing-in-sugar/)

### Architecture & Patterns
- [Database Audit Log Design](https://nestcode.co/en/blog/database-design-audit-log-tracking-changes-to-column-data-value-in-postgresql-part-1)
- [Debezium CDC for Audit Logs](https://debezium.io/blog/2019/10/01/audit-logs-with-change-data-capture-and-stream-processing/)
- [Webhook Best Practices](https://hookdeck.com/blog/webhooks-at-scale)
