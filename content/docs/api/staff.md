---
title: Staff administration
description: Administrative staff roles and site deletion
---

These routes use staff authorization across teams. They are relative to the API host root and are separate from customer team-management routes. Support staff can read user details and resources; the mutations below require `super_admin`. Impersonation sessions cannot use admin routes.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/admin/users/{id}` | User details and owned teams |
| GET | `/admin/users/{id}/sites` | Sites across the user's owned teams |
| PATCH | `/admin/users/{id}/staff-role` | Change platform staff access |
| DELETE | `/admin/users/{id}` | Delete an eligible user |
| DELETE | `/admin/sites/{id}` | Request site cleanup |

## Change staff access

Send an explicit `staff_role` field to `PATCH /admin/users/{id}/staff-role`:

```json
{"staff_role": null}
```

`null` removes staff access. The other accepted values are `"support"` and `"super_admin"`. Omitting the field or sending another value returns `422`. A successful response contains `data.id` and `data.staff_role` with the saved role, including an explicit `null` for regular users.

Self role changes and demotion of the last super administrator return `409`. Missing users return `404`; insufficient staff access returns `403`. The actor's current role is checked again inside the update transaction. The audit record includes the actor, target, and previous and new roles. Existing sessions lose admin access on their next admin request after demotion.

Removing staff access does not delete the user or change team permissions. `DELETE /admin/users/{id}` still refuses self-deletion, staff users, and users whose owned teams have paid orders or current or past non-trial subscriptions.

## Delete a site

Send the site's exact current domain to `DELETE /admin/sites/{id}`:

```json
{"confirmation_domain": "app.example.com"}
```

The API resolves the owning server and team from the site. A successful response contains:

```json
{"data": {"site_id": "SITE_ID", "status": "deletion_requested"}}
```

This is an asynchronous request. Cleanup removes the site's files and configuration; it does not delete the server. A pending site remains in `GET /admin/users/{id}/sites` with `uninstallation_requested_at` set. Re-fetch that list to verify completion; the dashboard does this automatically when resource notifications arrive and after reconnecting. Queue submission failure restores the previous state. Remote cleanup failure retains the record and clears the pending flag for a later retry. Duplicate pending requests are rejected.

See [admin user management](/docs/application/account#admin-user-management), [site deletion](/docs/application/sites#delete-a-site-as-an-administrator), and [admin server deletion](/docs/api/servers#admin-server-deletion) for dashboard workflows.

## Live resource notifications

An active staff session can subscribe to the WebSocket channel `admin.resources`. The `admin.resource.changed` event carries a resource family, an action, and optional `team_id`, `user_id`, `server_id`, and `site_id` fields. It contains identifiers rather than full resource models, logs, or credentials. Staff access and session expiry are checked for subscriptions and subsequent delivery.

Treat notifications as a reason to re-fetch the relevant authorized REST views, not as authoritative state or proof of successful cleanup. Reconcile again after reconnecting to recover changes missed while disconnected. The dashboard coalesces notifications and refreshes the affected lists, loaded resource tabs, counts, and server deletion eligibility without requiring a page reload.

## CLI access

There are no dedicated staff commands. Authorized staff can use `lctl api` with the historical `/api` prefix, such as `lctl api GET /api/admin/users/USER_ID/sites`. Raw mutations have no built-in confirmation; inspect the target and use only an explicitly authorized role change or deletion. See [feature coverage](/docs/cli/feature-coverage).
