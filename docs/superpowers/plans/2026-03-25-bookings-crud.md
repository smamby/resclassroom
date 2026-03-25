# Bookings CRUD Implementation Plan

> I'm using the writing-plans skill to create the implementation plan.

**Goal:** Build a bookings CRUD under the existing component structure, mounting under /bookings with a parent route in routes.js, and a booking module (network.js, controller.js, store.js) using date + time atomization. Enforce authentication/authorization and solape checks; add actividad attribute to the booking model; use MongoDB (Mongo-like) as data store; avoid migrations.

**Architecture:** Routes.js exposes only the parent; a dedicated Booking module handles REST endpoints with business logic in the controller and DB access in the store. Solape verification is performed in the controller. Workspace existence is validated in the controller by querying the workspaces collection. User association is derived from the authenticated user. All business logic and filters reuse existing filtering concepts (workspace, actividad, day-of-week) to align with existing UI filters.

**Tech Stack:** Node.js, Express, MongoDB (via the existing db helper), plain JS modules, date + time atomization.
---

## Files touched / added
- Update: `src/routes.js` – mount bookings router under /bookings (already done by patch).
- Add: `src/components/booking/network.js` – REST routes for bookings.
- Add: `src/components/bookings/network.js` – wrapper to align with existing import path.
- Add: `src/components/booking/controller.js` – business logic and validations (auth, workspace existence, solapes).
- Add: `src/components/booking/store.js` – DB interactions for bookings.
- Add: `src/components/booking/models/Booking.js` – booking data model with fields: workspaceId, date, startTime, endTime, userId, actividad, notes, status, createdAt, updatedAt.
- Add: `src/components/booking` (structure of files as described).

---

## Task Breakdown
- Task 1: Implement network layer
- Task 2: Implement controller with auth + solape logic
- Task 3: Implement store with DB access and helper for solape checks
- Task 4: Extend Booking model with actividad; atomize date/time usage
- Task 5: Wire routes.js and ensure /bookings mounting works
- Task 6: Validate workspace existence in controller via workspaces collection
- Task 7: Implement filters (workspace, actividad, dayOfWeek) in getAllBookings
- Task 8: Basic error messaging for solapes (user-friendly)
- Task 9: Documentation and API surface notes

Each task should be implemented as a small, testable unit with minimal coupling and clear commits.

**Execution approach:** Subagent-Driven (recommended). Each task is its own subagent task with review checkpoints between steps.

**Plan location:** docs/superpowers/plans/2026-03-25-bookings-crud.md

**Next steps:** Tell me to begin execution in Subagent-Driven mode or Inline mode. I will start creating the subagents for each task and verify after each step.
