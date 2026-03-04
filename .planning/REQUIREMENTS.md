# Requirements: Whop CRM

**Defined:** 2026-03-04
**Core Value:** Account managers can efficiently track, manage, and grow their portfolio of Whop creators through a unified CRM interface.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### User Management

- [ ] **USER-01**: Admin can view list of all CRM team members with avatar, name, email, role, and status
- [ ] **USER-02**: Admin can change a team member's role (admin, manager, account_manager, ae, enterprise_sales)
- [ ] **USER-03**: Admin can deactivate/reactivate a team member
- [ ] **USER-04**: Settings page displays a note explaining that new users auto-create on Clerk sign-in
- [ ] **USER-05**: User picker component shows searchable dropdown of active team members with avatars

### Contact Editing

- [ ] **CONT-01**: User can open edit dialog from contact detail page via "Edit" button
- [ ] **CONT-02**: User can open edit dialog from contacts list via row dropdown menu
- [ ] **CONT-03**: Edit form pre-fills all current contact values
- [ ] **CONT-04**: Edit form exposes all fields: firstName, lastName, email, phone, status, tier, twitterUrl, websiteUrl, ownerId (user picker), healthScore, whopUsername
- [ ] **CONT-05**: Edit form uses PATCH API to update contact

### Deal Editing

- [ ] **DEAL-01**: User can open edit dialog from deal detail page via "Edit" button
- [ ] **DEAL-02**: User can open edit dialog from deals list via row dropdown menu
- [ ] **DEAL-03**: Edit form pre-fills all current deal values
- [ ] **DEAL-04**: Edit form exposes all fields: title, contactId, stageId, priority, value, expectedCloseDate, description, companyId, expectedMrr, lostReason (shown when stage isLost)
- [ ] **DEAL-05**: Edit form uses PATCH API to update deal

### Task Editing

- [ ] **TASK-01**: User can create tasks via a reusable TaskForm component
- [ ] **TASK-02**: User can edit tasks via the same TaskForm component
- [ ] **TASK-03**: TaskForm exposes all fields: title, description, status, priority, dueDate, assigneeId (user picker), contactId (contact picker), dealId (deal picker)
- [ ] **TASK-04**: Edit form pre-fills all current task values
- [ ] **TASK-05**: GET endpoint exists for single task (`/api/tasks/[id]`)

### Contact Detail Tabs

- [ ] **CTAB-01**: Contact detail Deals tab shows actual deals where contactId matches
- [ ] **CTAB-02**: Deals tab displays as mini table: title, stage, value, priority, expected close date
- [ ] **CTAB-03**: Each deal row links to deal detail page
- [ ] **CTAB-04**: Deals tab has "Add Deal" button that opens DealForm pre-filled with contactId
- [ ] **CTAB-05**: Contact detail Tasks tab shows actual tasks where contactId matches
- [ ] **CTAB-06**: Tasks tab displays: title, status, priority, due date, assignee
- [ ] **CTAB-07**: Tasks tab has status toggle checkbox (same as tasks page)
- [ ] **CTAB-08**: Tasks tab has "Add Task" button that opens TaskForm pre-filled with contactId

### Pipeline Management

- [ ] **PIPE-01**: User can create a new pipeline with name, description, and type
- [ ] **PIPE-02**: User can edit a pipeline's name, description, and type
- [ ] **PIPE-03**: User can delete a pipeline (only if no deals exist in it)
- [ ] **PIPE-04**: User can create a new stage within a pipeline with name, color, probability, isWon, isLost, position
- [ ] **PIPE-05**: User can edit a stage's properties (name, color, probability, isWon, isLost)
- [ ] **PIPE-06**: User can delete a stage (only if no deals exist in that stage)
- [ ] **PIPE-07**: User can drag-to-reorder stages within a pipeline
- [ ] **PIPE-08**: Pipeline management UI replaces read-only pipeline tab in Settings

### Company CRUD

- [ ] **COMP-01**: User can view paginated list of companies with search and filters (industry, size, owner)
- [ ] **COMP-02**: User can create a company with name, domain, industry, size, description, linkedinUrl, websiteUrl, ownerId
- [ ] **COMP-03**: User can view company detail page with profile card, related contacts, related deals, activity timeline, custom fields
- [ ] **COMP-04**: User can edit a company's details
- [ ] **COMP-05**: User can delete a company
- [ ] **COMP-06**: "Companies" link appears in sidebar between Contacts and Pipeline

### Contact-Company Linking

- [ ] **LINK-01**: Contact detail page shows "Companies" section with linked companies and role
- [ ] **LINK-02**: User can link a company to a contact via picker dialog with company search + role field
- [ ] **LINK-03**: User can unlink a company from a contact
- [ ] **LINK-04**: Company detail page shows "Contacts" section with linked contacts

### Deal Detail Enhancement

- [ ] **DDET-01**: Deal detail page shows activity timeline (activities where dealId matches)
- [ ] **DDET-02**: Deal detail page shows stage history (progression through pipeline stages with timestamps)
- [ ] **DDET-03**: Deal detail page has "Edit" button that opens deal edit form
- [ ] **DDET-04**: Deal detail page has "Log Activity" button pre-filled with dealId
- [ ] **DDET-05**: Deal detail page shows associated contact and company as clickable cards
- [ ] **DDET-06**: Deal detail page supports custom fields display
- [ ] **DDET-07**: Deal detail page supports tags (using deal_tags junction table)

### Entity Pickers

- [ ] **PICK-01**: Contact picker — searchable select showing contacts by name/email with avatar + type badge
- [ ] **PICK-02**: Company picker — searchable select showing companies by name/domain
- [ ] **PICK-03**: User picker — searchable select showing active team members with avatar + name
- [ ] **PICK-04**: Deal picker — searchable select showing deals by title
- [ ] **PICK-05**: All pickers use Popover + Command (combobox) pattern from shadcn/ui

### Bulk Operations

- [ ] **BULK-01**: Contacts list has row selection checkboxes
- [ ] **BULK-02**: Bulk action bar appears when rows are selected with: Reassign, Change Status, Add Tag, Delete
- [ ] **BULK-03**: Deals list has row selection checkboxes
- [ ] **BULK-04**: Deals bulk action bar includes "Move to stage" action
- [ ] **BULK-05**: CSV import dialog with file upload, column mapping preview, and confirm

### Activity CRUD

- [ ] **ACTV-01**: User can edit an activity they created (PATCH API + UI)
- [ ] **ACTV-02**: User can delete an activity they created (DELETE API + UI)
- [ ] **ACTV-03**: Edit/delete buttons appear only on activities created by the current user

### Saved Views

- [ ] **VIEW-01**: Saved views work on deals list page (save/load view bar)
- [ ] **VIEW-02**: Saved views work on tasks list page
- [ ] **VIEW-03**: Saved views work on companies list page
- [ ] **VIEW-04**: Saved views store entity type, filters, sort, and column visibility
- [ ] **VIEW-05**: Saved view delete button exists in the saved views bar

### Custom Fields

- [ ] **CFLD-01**: When creating/editing a custom field with type "select" or "multi_select", user can define option values
- [ ] **CFLD-02**: Options editor shows list of values with add/remove capability
- [ ] **CFLD-03**: Select-type custom fields render as dropdown with defined options on entity detail pages
- [ ] **CFLD-04**: Multi-select type is available in the settings UI (currently excluded)

### Audit Log

- [ ] **AUDT-01**: Audit log page exists in settings showing: timestamp, user, action, entity type, entity name, details
- [ ] **AUDT-02**: Audit log has filters: date range, user, entity type

### Notifications

- [ ] **NOTF-01**: Bell icon in top nav shows unread alert count
- [ ] **NOTF-02**: Clicking bell opens dropdown with recent alerts
- [ ] **NOTF-03**: Dropdown links to full alerts page

### Dashboard

- [ ] **DASH-01**: User can rearrange/hide KPI cards on dashboard
- [ ] **DASH-02**: Date range selector filters dashboard metrics
- [ ] **DASH-03**: Pipeline selector filters dashboard to specific pipeline

### Import Wizard

- [ ] **IMPT-01**: Import wizard: Step 1 — Upload CSV file
- [ ] **IMPT-02**: Import wizard: Step 2 — Map columns to fields with auto-detect
- [ ] **IMPT-03**: Import wizard: Step 3 — Preview first 5 rows
- [ ] **IMPT-04**: Import wizard: Step 4 — Import with progress bar
- [ ] **IMPT-05**: Import wizard: Step 5 — Summary (created, skipped, errors)

### Email Templates

- [ ] **EMTL-01**: User can create/edit/delete email templates in settings
- [ ] **EMTL-02**: Templates support variable interpolation ({{firstName}}, {{companyName}}, etc.)
- [ ] **EMTL-03**: Templates can be used when logging email activities

### Advanced Search

- [ ] **SRCH-01**: Command palette searches deals, companies, tasks, and settings pages (not just contacts)
- [ ] **SRCH-02**: Command palette shows recent items
- [ ] **SRCH-03**: Command palette offers quick actions: "Create contact", "Create deal", etc.

## v2 Requirements

Deferred to future milestone. Not in current roadmap.

- **Whop API integration** — Live GMV data sync, creator metrics
- **Email integration** — Send/receive emails, track opens
- **LinkedIn integration** — Profile enrichment, message tracking
- **Intercom integration** — Support ticket linking
- **WebSocket real-time notifications** — Live updates without polling
- **Test infrastructure** — Vitest + RTL + Playwright setup

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile native app | Web-responsive sufficient for internal tool |
| Multi-tenant / multi-org | Single org internal tool |
| Custom reporting builder | Analytics page covers current needs |
| Workflow automation engine | Over-engineering for current team size |
| AI-powered features | Not in current scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| USER-01 | Phase 1 | Pending |
| USER-02 | Phase 1 | Pending |
| USER-03 | Phase 1 | Pending |
| USER-04 | Phase 1 | Pending |
| USER-05 | Phase 1 | Pending |
| PICK-01 | Phase 2 | Pending |
| PICK-02 | Phase 2 | Pending |
| PICK-03 | Phase 2 | Pending |
| PICK-04 | Phase 2 | Pending |
| PICK-05 | Phase 2 | Pending |
| CONT-01 | Phase 3 | Pending |
| CONT-02 | Phase 3 | Pending |
| CONT-03 | Phase 3 | Pending |
| CONT-04 | Phase 3 | Pending |
| CONT-05 | Phase 3 | Pending |
| DEAL-01 | Phase 4 | Pending |
| DEAL-02 | Phase 4 | Pending |
| DEAL-03 | Phase 4 | Pending |
| DEAL-04 | Phase 4 | Pending |
| DEAL-05 | Phase 4 | Pending |
| DDET-01 | Phase 4 | Pending |
| DDET-02 | Phase 4 | Pending |
| DDET-03 | Phase 4 | Pending |
| DDET-04 | Phase 4 | Pending |
| DDET-05 | Phase 4 | Pending |
| DDET-06 | Phase 4 | Pending |
| DDET-07 | Phase 4 | Pending |
| TASK-01 | Phase 5 | Pending |
| TASK-02 | Phase 5 | Pending |
| TASK-03 | Phase 5 | Pending |
| TASK-04 | Phase 5 | Pending |
| TASK-05 | Phase 5 | Pending |
| CTAB-01 | Phase 6 | Pending |
| CTAB-02 | Phase 6 | Pending |
| CTAB-03 | Phase 6 | Pending |
| CTAB-04 | Phase 6 | Pending |
| CTAB-05 | Phase 6 | Pending |
| CTAB-06 | Phase 6 | Pending |
| CTAB-07 | Phase 6 | Pending |
| CTAB-08 | Phase 6 | Pending |
| COMP-01 | Phase 7 | Pending |
| COMP-02 | Phase 7 | Pending |
| COMP-03 | Phase 7 | Pending |
| COMP-04 | Phase 7 | Pending |
| COMP-05 | Phase 7 | Pending |
| COMP-06 | Phase 7 | Pending |
| LINK-01 | Phase 7 | Pending |
| LINK-02 | Phase 7 | Pending |
| LINK-03 | Phase 7 | Pending |
| LINK-04 | Phase 7 | Pending |
| PIPE-01 | Phase 8 | Pending |
| PIPE-02 | Phase 8 | Pending |
| PIPE-03 | Phase 8 | Pending |
| PIPE-04 | Phase 8 | Pending |
| PIPE-05 | Phase 8 | Pending |
| PIPE-06 | Phase 8 | Pending |
| PIPE-07 | Phase 8 | Pending |
| PIPE-08 | Phase 8 | Pending |
| BULK-01 | Phase 9 | Pending |
| BULK-02 | Phase 9 | Pending |
| BULK-03 | Phase 9 | Pending |
| BULK-04 | Phase 9 | Pending |
| BULK-05 | Phase 9 | Pending |
| ACTV-01 | Phase 10 | Pending |
| ACTV-02 | Phase 10 | Pending |
| ACTV-03 | Phase 10 | Pending |
| VIEW-01 | Phase 10 | Pending |
| VIEW-02 | Phase 10 | Pending |
| VIEW-03 | Phase 10 | Pending |
| VIEW-04 | Phase 10 | Pending |
| VIEW-05 | Phase 10 | Pending |
| CFLD-01 | Phase 10 | Pending |
| CFLD-02 | Phase 10 | Pending |
| CFLD-03 | Phase 10 | Pending |
| CFLD-04 | Phase 10 | Pending |
| AUDT-01 | Phase 11 | Pending |
| AUDT-02 | Phase 11 | Pending |
| NOTF-01 | Phase 11 | Pending |
| NOTF-02 | Phase 11 | Pending |
| NOTF-03 | Phase 11 | Pending |
| DASH-01 | Phase 11 | Pending |
| DASH-02 | Phase 11 | Pending |
| DASH-03 | Phase 11 | Pending |
| IMPT-01 | Phase 12 | Pending |
| IMPT-02 | Phase 12 | Pending |
| IMPT-03 | Phase 12 | Pending |
| IMPT-04 | Phase 12 | Pending |
| IMPT-05 | Phase 12 | Pending |
| EMTL-01 | Phase 12 | Pending |
| EMTL-02 | Phase 12 | Pending |
| EMTL-03 | Phase 12 | Pending |
| SRCH-01 | Phase 12 | Pending |
| SRCH-02 | Phase 12 | Pending |
| SRCH-03 | Phase 12 | Pending |

**Coverage:**
- v1 requirements: 84 total
- Mapped to phases: 84
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after initial definition*
