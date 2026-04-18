# Security Specification - UXDR System

## Data Invariants
1.  **Identity Integrity**: Every document representing a user-action (Project, Review, Feedback) must have an `authorId` or `requestorId` matching the `request.auth.uid`.
2.  **State Terminality**: Projects and Reviews marked as `Approved` or `Completed` cannot be further modified except by Admins or Facilitators.
3.  **Disclosure Control**: Projects with `disclosureRequired: true` are invisible to all users except Admins, Facilitators, and explicit members (verified via `project_members` collection).
4.  **Role Verification**: User roles are derived from a trusted Source of Truth (`/users/{userId}`). Hardcoded Admin exists for bootstrapping.

## The "Dirty Dozen" Payloads (Deny Table)

| Payload # | Collection | Action | Payload Description | Rule Triggered |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `users` | `update` | Changing own role to "Admin" | Role Immutability |
| 2 | `projects` | `create` | Setting `requestorId` to someone else's UID | Identity Integrity |
| 3 | `projects` | `update` | Modifying `requestorId` after creation | Field Immutability |
| 4 | `projects` | `update` | Overriding terminal status `Approved` as a Requestor | Terminal State Lock |
| 5 | `reviews` | `create` | Creating a review for a non-existent project (checked via `exists`) | Global Consistency |
| 6 | `reviews` | `update` | Modifying `stageType` (immutable field) | Immortality Rule |
| 7 | `feedback` | `create` | Submitting feedback with 1MB notes string | Denial of Wallet Guard |
| 8 | `feedback` | `delete` | Deleting feedback as a non-owner/non-admin | Ownership Check |
| 9 | `project_members`| `create` | Self-joining a project as "Facilitator" | Role-based Write Access |
| 10 | `projects` | `list` | Listing all projects without Admin role or involved member status | Secure List Query |
| 11 | `users` | `get` | Reading someone else's PII (e.g. email) as a Guest | PII Isolation |
| 12 | `projects` | `create` | Creating a project document with shadow fields (not in schema) | Validation Blueprint |

## The Test Runner Plan
I will generate `firestore.rules.test.ts` to verify these invariants.
