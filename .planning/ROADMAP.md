# Roadmap: Whop CRM

**Created:** 2026-03-04
**Phases:** 12
**Requirements:** 84 mapped

## Overview

| # | Phase | Goal | Requirements | Dependencies |
|---|-------|------|--------------|--------------|
| 1 | 3/3 | Complete    | 2026-03-04 | None |
| 2 | 4/4 | Complete    | 2026-03-04 | Phase 1 |
| 3 | 1/1 | Complete    | 2026-03-04 | Phase 2 |
| 4 | Edit Deal + Deal Detail Enhancement | Add the deal edit dialog and enrich the deal detail page with activity timeline, stage history, tags, and custom fields | DEAL-01–05, DDET-01–07 | Phase 2 |
| 5 | Task Form | Build a reusable TaskForm used for both create and edit, exposing all fields including assignee, contact, and deal links | TASK-01–05 | Phase 2 |
| 6 | Contact Detail Tabs | Replace empty Deals and Tasks tab placeholders with real data, inline status toggle, and contextual create buttons | CTAB-01–08 | Phase 4, Phase 5 |
| 7 | Company CRUD + Contact-Company Linking | Stand up the full Company entity (list, detail, create, edit, delete) and activate the contact_companies junction table UI | COMP-01–06, LINK-01–04 | Phase 2 |
| 8 | Pipeline Management | Replace the read-only pipeline settings tab with full CRUD for pipelines and stages including drag-to-reorder | PIPE-01–08 | None |
| 9 | Bulk Operations | Add row selection and a bulk action bar to contacts and deals lists, plus a CSV import wizard | BULK-01–05 | Phase 3, Phase 4 |
| 10 | Activity CRUD + Saved Views + Custom Fields | Add edit/delete to activity timeline items, extend saved views to all list entities, and add select-options UI to custom field definitions | ACTV-01–03, VIEW-01–05, CFLD-01–04 | Phase 3, Phase 4, Phase 7 |
| 11 | Audit Log + Notifications + Dashboard | Surface the audit log as a settings page, add a notification bell to the top nav, and make dashboard cards interactive | AUDT-01–02, NOTF-01–03, DASH-01–03 | Phase 3 |
| 12 | Import Wizard + Email Templates + Advanced Search | Multi-step CSV import, email template CRUD with variable interpolation, and full Cmd+K expansion across all entities | IMPT-01–05, EMTL-01–03, SRCH-01–03 | Phase 9, Phase 3 |

---

## Phase Details

### Phase 1: User Management
**Goal:** Give admins full visibility into team members and produce the shared UserPicker component that every subsequent edit form depends on.
**Requirements:** USER-01, USER-02, USER-03, USER-04, USER-05
**Dependencies:** None

**Plans:** 3/3 plans complete

**Success Criteria:**
1. An admin navigating to Settings > Team sees a table listing every CRM user with their avatar, name, email, role badge, and active/inactive status.
2. An admin can change any team member's role using an inline select; the change persists on page reload.
3. An admin can deactivate a team member; the row shows an "Inactive" badge and the user no longer appears in pickers.
4. A non-admin user sees their own row with the role field locked (read-only).
5. The UserPicker component renders a searchable popover of active users and returns the selected user's ID.

---

### Phase 2: Entity Pickers
**Goal:** Deliver four reusable Popover+Command combobox components (contact, company, user, deal) that all edit forms in subsequent phases will import.
**Requirements:** PICK-01, PICK-02, PICK-03, PICK-04, PICK-05
**Dependencies:** Phase 1

**Plans:** 4/4 plans complete

**Success Criteria:**
1. Typing a name into the ContactPicker filters results in real time and shows avatar, name, and type badge; selecting a contact closes the popover and returns the contact's ID.
2. The CompanyPicker searches by company name and domain and returns the company's ID on selection.
3. The UserPicker (produced in Phase 1 and promoted to the shared pickers pattern) renders all active team members with avatar and name.
4. The DealPicker searches deals by title and returns the deal's ID on selection.
5. All four pickers accept a `value` prop to show the currently selected item when the form is opened in edit mode.

---

### Phase 3: Edit Contact
**Goal:** Allow users to edit any contact's full field set from both the contact detail page and the contacts list row menu, using the existing PATCH API.
**Requirements:** CONT-01, CONT-02, CONT-03, CONT-04, CONT-05
**Dependencies:** Phase 2

**Plans:** 1/1 plans complete

**Success Criteria:**
1. An "Edit" button on the contact detail page opens a dialog pre-filled with all current contact values.
2. A "Edit" option in the contacts list row dropdown opens the same pre-filled dialog.
3. The dialog exposes all fields: firstName, lastName, email, phone, status, tier, twitterUrl, websiteUrl, ownerId (UserPicker), healthScore (0–100 number input), and whopUsername.
4. Submitting the dialog sends a PATCH request; success closes the dialog, shows a toast, and the list/detail page reflects the new values immediately (React Query invalidation).
5. Validation errors (e.g. invalid URL format) surface inline under the relevant field without closing the dialog.

---

### Phase 4: Edit Deal + Deal Detail Enhancement
**Goal:** Add a full deal edit dialog and enrich the deal detail page with an activity timeline, stage history, tags, custom fields, and contextual action buttons.
**Requirements:** DEAL-01, DEAL-02, DEAL-03, DEAL-04, DEAL-05, DDET-01, DDET-02, DDET-03, DDET-04, DDET-05, DDET-06, DDET-07
**Dependencies:** Phase 2

**Plans:** DEAL-01, DEAL-02, DEAL-03, DEAL-04, DEAL-05, DDET-01, DDET-02, DDET-03, DDET-04, DDET-05, DDET-06, DDET-07

**Success Criteria:**
1. An "Edit" button on the deal detail page opens a dialog pre-filled with all deal fields including companyId (CompanyPicker), expectedMrr, and description; a lostReason field appears only when the selected stage has isLost=true.
2. An "Edit" option in the deals list row dropdown opens the same dialog.
3. The deal detail page shows a live activity timeline (notes, calls, emails) filtered to that deal.
4. The deal detail page shows a stage history list with stage name and timestamp for each progression event.
5. The deal detail page displays the associated contact and company as clickable cards that navigate to their respective detail pages.
6. Deal tags can be added and removed on the detail page using the deal_tags junction table.
7. Custom field values are displayed and editable on the deal detail page.

---

### Phase 5: Task Form
**Goal:** Build a reusable TaskForm component used for both creating and editing tasks, exposing all fields including assignee, linked contact, and linked deal.
**Requirements:** TASK-01, TASK-02, TASK-03, TASK-04, TASK-05
**Dependencies:** Phase 2

**Plans:** TASK-01, TASK-02, TASK-03, TASK-04, TASK-05

**Success Criteria:**
1. The tasks list page create dialog uses the new TaskForm and exposes all fields: title, description, status, priority, dueDate, assigneeId (UserPicker), contactId (ContactPicker), dealId (DealPicker).
2. Clicking an edit action on a task row opens the same TaskForm pre-filled with all current values.
3. A GET endpoint exists at `/api/tasks/[id]` and returns a single task record.
4. Submitting the edit form sends a PATCH request; the task list updates immediately with no page reload.
5. The TaskForm can be rendered in a dialog with an optional `contactId` or `dealId` pre-filled (used by contact detail tabs in Phase 6).

---

### Phase 6: Contact Detail Tabs
**Goal:** Replace the empty Deals and Tasks tab placeholders on the contact detail page with live data, status controls, and contextual create buttons.
**Requirements:** CTAB-01, CTAB-02, CTAB-03, CTAB-04, CTAB-05, CTAB-06, CTAB-07, CTAB-08
**Dependencies:** Phase 4, Phase 5

**Plans:** CTAB-01, CTAB-02, CTAB-03, CTAB-04, CTAB-05, CTAB-06, CTAB-07, CTAB-08

**Success Criteria:**
1. The Deals tab on a contact detail page shows a table of all deals where contactId matches, with columns: title, stage badge, value, priority, expected close date.
2. Each deal row in the tab is a link that navigates to the deal detail page.
3. An "Add Deal" button in the Deals tab opens the DealForm with contactId pre-filled.
4. The Tasks tab shows all tasks where contactId matches, with columns: title, status checkbox, priority, due date, assignee avatar.
5. Toggling the status checkbox on a task row in the tab updates the task immediately (same behavior as the main tasks page).
6. An "Add Task" button in the Tasks tab opens the TaskForm with contactId pre-filled.

---

### Phase 7: Company CRUD + Contact-Company Linking
**Goal:** Stand up the complete Company entity with full CRUD pages and activate the contact_companies junction table so contacts and companies can be linked with a role.
**Requirements:** COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, LINK-01, LINK-02, LINK-03, LINK-04
**Dependencies:** Phase 2

**Plans:** COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, LINK-01, LINK-02, LINK-03, LINK-04

**Success Criteria:**
1. A "Companies" link appears in the sidebar between Contacts and Pipeline and routes to a paginated company list with search and industry/size/owner filters.
2. A "Create Company" dialog exposes all fields: name, domain, industry, size, description, linkedinUrl, websiteUrl, ownerId (UserPicker).
3. A company detail page shows a profile card plus related contacts list, related deals list, activity timeline, and custom fields.
4. Editing and deleting a company work end-to-end; delete shows a confirmation dialog.
5. The contact detail page shows a "Companies" section listing linked companies with role; a "Link Company" button opens a CompanyPicker + role input and writes to contact_companies.
6. Unlinking a company from a contact removes the junction row and the company disappears from the section immediately.
7. The company detail page shows a "Contacts" section listing all contacts linked to that company.

---

### Phase 8: Pipeline Management
**Goal:** Replace the read-only pipeline settings tab with interactive CRUD for pipelines and stages, including drag-to-reorder stages within a pipeline.
**Requirements:** PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08
**Dependencies:** None

**Plans:** PIPE-01, PIPE-02, PIPE-03, PIPE-04, PIPE-05, PIPE-06, PIPE-07, PIPE-08

**Success Criteria:**
1. Settings > Pipeline tab shows a list of all pipelines with an expand/collapse toggle to reveal their stages.
2. An "Add Pipeline" button opens a dialog with name, description, and type fields; the new pipeline appears in the list on success.
3. Editing a pipeline name/description/type persists and reflects in the Kanban board selector.
4. Deleting a pipeline is blocked with a clear error message if any deals exist in it; otherwise the pipeline is removed.
5. Each pipeline's stage list can be reordered via drag-and-drop (@dnd-kit); the new order persists on reload.
6. Adding, editing (name, color, probability, isWon, isLost), and deleting stages works; delete is blocked if deals exist in the stage.

---

### Phase 9: Bulk Operations
**Goal:** Add row-level selection and a bulk action bar to the contacts and deals lists, plus a multi-step CSV import dialog for batch data entry.
**Requirements:** BULK-01, BULK-02, BULK-03, BULK-04, BULK-05
**Dependencies:** Phase 3, Phase 4

**Plans:** BULK-01, BULK-02, BULK-03, BULK-04, BULK-05

**Success Criteria:**
1. The contacts list has a checkbox column; selecting one or more rows reveals a bulk action bar with: Reassign (UserPicker), Change Status (select), Add Tag (tag picker), Delete.
2. Executing a bulk reassign on 5 selected contacts updates all five ownerId values and refreshes the list.
3. The deals list has the same checkbox selection; its bulk action bar includes "Move to stage" in addition to the shared actions.
4. A "Import CSV" button opens a step-by-step wizard: upload file → map columns → preview 5 rows → confirm import → summary showing created/skipped/error counts.
5. A CSV with valid contact rows results in those contacts appearing in the contacts list after import.

---

### Phase 10: Activity CRUD + Saved Views + Custom Fields
**Goal:** Complete the activity timeline with edit and delete, extend saved views from contacts-only to all list pages, and add an options editor for select-type custom fields.
**Requirements:** ACTV-01, ACTV-02, ACTV-03, VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, CFLD-01, CFLD-02, CFLD-03, CFLD-04
**Dependencies:** Phase 3, Phase 4, Phase 7

**Plans:** ACTV-01, ACTV-02, ACTV-03, VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, CFLD-01, CFLD-02, CFLD-03, CFLD-04

**Success Criteria:**
1. Edit and delete buttons appear on activity timeline items only when the activity's userId matches the current user; clicking edit opens an inline or dialog form pre-filled with the activity content.
2. Deleting an activity removes it from the timeline immediately.
3. The deals list, tasks list, and companies list each have a saved views bar (save current filters/sort/columns, load a saved view, delete a saved view) with the same behavior as the contacts list.
4. Saved views correctly persist entity type, active filters, sort column/direction, and visible columns.
5. When defining or editing a custom field with type "select" or "multi_select" in Settings, an options editor appears allowing the user to add, reorder, and remove option values; those options render as a dropdown on entity detail pages.
6. The "multi_select" type is available in the custom field type selector (previously excluded).

---

### Phase 11: Audit Log + Notifications + Dashboard
**Goal:** Surface the existing audit log data in a settings UI, add a notification bell to the top nav, and make dashboard KPI cards configurable.
**Requirements:** AUDT-01, AUDT-02, NOTF-01, NOTF-02, NOTF-03, DASH-01, DASH-02, DASH-03
**Dependencies:** Phase 3

**Plans:** AUDT-01, AUDT-02, NOTF-01, NOTF-02, NOTF-03, DASH-01, DASH-02, DASH-03

**Success Criteria:**
1. A Settings > Audit Log page shows a paginated table with columns: timestamp, user name, action, entity type, entity name, and details.
2. The audit log has working filters for date range, user, and entity type; the table updates without a page reload.
3. A bell icon in the top nav shows a badge with the count of unread alerts; the badge disappears when all are read.
4. Clicking the bell opens a dropdown listing the 5 most recent alerts with type, message, and a "View all" link to the alerts page.
5. Dashboard KPI cards can be hidden and the visible cards can be reordered; the layout persists across sessions (localStorage or user preference).
6. A date range selector on the dashboard filters all metrics; a pipeline selector narrows metrics to a single pipeline.

---

### Phase 12: Import Wizard + Email Templates + Advanced Search
**Goal:** Deliver a full multi-step CSV import flow, an email template library with variable interpolation, and an expanded Cmd+K that covers all entities and offers quick actions.
**Requirements:** IMPT-01, IMPT-02, IMPT-03, IMPT-04, IMPT-05, EMTL-01, EMTL-02, EMTL-03, SRCH-01, SRCH-02, SRCH-03
**Dependencies:** Phase 9, Phase 3

**Plans:** IMPT-01, IMPT-02, IMPT-03, IMPT-04, IMPT-05, EMTL-01, EMTL-02, EMTL-03, SRCH-01, SRCH-02, SRCH-03

**Success Criteria:**
1. The import wizard (also reachable from a Settings > Import page) walks through: upload CSV → auto-detect and manually map columns → preview first 5 rows → import with a visible progress bar → summary screen showing created count, skipped count, and any row-level errors.
2. Settings > Email Templates lists all templates with create, edit, and delete; the editor accepts `{{firstName}}`, `{{companyName}}`, and other defined variables with live preview.
3. When logging an email activity, a "Use template" button opens a template picker and inserts the rendered content into the activity body.
4. Pressing Cmd+K and typing returns results from contacts, deals, companies, and tasks simultaneously, with entity-type badges distinguishing result types.
5. The command palette shows a "Recent" section with the last 5 items visited when opened with no query text.
6. Quick action items "Create contact", "Create deal", "Create task", and "Create company" are always visible in the command palette and open the corresponding create dialog.

---

*Last updated: 2026-03-04 after roadmap creation*
