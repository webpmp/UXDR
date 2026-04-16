# App Instruction and Configuration

## Calendar System Requirements
The calendar must serve two distinct functions and both must be fully implemented:

### 1. Availability Management (All Roles)
The calendar page must allow users to:
- Specify which days they are available to participate in design reviews
- Specify time-of-day availability blocks (not just full-day availability)
- Mark time blocks as:
  - Available
  - Not Available
- Set availability up to 4 weeks in advance
- Copy previous week's availability forward for faster setup
- Update availability at any time

This applies to Reviewers, Facilitators, Requestors, Participants (if applicable), and Admins based on role permissions.

### 2. Scheduled Review Calendar (System-Wide Visibility)
The calendar must also display all scheduled UXDR review meetings.
This includes:
- All scheduled design review events (Discovery, Design, Follow-up, Fit & Finish)
- Events must be grouped and displayed by day
- Events must be ordered chronologically within each day (earlier time -> later time)
- Each event must clearly show:
  - Project name (required in event title)
  - Review type (Discovery / Design / Follow-up / Fit & Finish)
  - Scheduled time range
  - Assigned Facilitator
  - Assigned Reviewers
  - Status indicator

### 3. Calendar Interaction Requirements
- Clicking a calendar event opens the full project details page
- Calendar must support weekly navigation view (default)
- Admins, Facilitators, and Reviewers can view scheduled reviews
- Requestors can view scheduled reviews only for their own projects
- Availability and scheduled reviews must appear in the same calendar interface but visually separated:
  - Availability = editable blocks
  - Scheduled reviews = locked event entries

### 4. Scheduling Constraint
Scheduled review events must:
- Only be created when sufficient Reviewer and Requestor availability overlaps
- Respect Reviewer assignments per review stage
- Update dynamically if Reviewer availability changes
- Trigger reassignment if conflicts occur, with Facilitator notification

### Summary
The system must not treat the calendar as availability-only.
It must function as a dual-purpose system:
1. Availability planning tool
2. Execution timeline for all scheduled UXDR review meetings
Both must coexist in a unified calendar experience.
