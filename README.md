<img src="https://github.com/webpmp/webpmp.github.io/blob/master/uxdr-cover-v2.png" alt="UXDR" style="max-width: 100%;"></a>

# UX Design Review (UXDR)

A web application for managing the UX Design Review (UXDR) lifecycle end to end. The system tracks projects across defined design phases, enforces role-based workflows, manages participant availability, and maintains a structured audit trail of decisions and milestones. Recent updates expand project visibility controls, improve user–project associations, and add admin tooling for testing and data seeding.

<table border="0">
  <tr>
    <td align="center" style="border: none;>
      <img src="https://raw.githubusercontent.com/webpmp/webpmp.github.io/master/dashboard.png" alt="Dashboard" width="150"><br>
      <sub>Dashboard</sub>
    </td>
    <td align="center" style="border: none;>
      <img src="https://raw.githubusercontent.com/webpmp/webpmp.github.io/master/calendar.png" alt="Calendar" width="150"><br>
      <sub>Calendar</sub>
    </td>
    <td align="center" style="border: none;>
      <img src="https://raw.githubusercontent.com/webpmp/webpmp.github.io/master/projects.png" alt="Projects" width="150"><br>
      <sub>Projects</sub>
    </td>
    <td align="center" style="border: none;>
      <img src="https://raw.githubusercontent.com/webpmp/webpmp.github.io/master/user-management.png" alt="User Management" width="150"><br>
      <sub>User Management</sub>
    </td>
    <td align="center" style="border: none;>
      <img src="https://raw.githubusercontent.com/webpmp/webpmp.github.io/master/settings.png" alt="System Settings" width="150"><br>
      <sub>System Settings</sub>
    </td>
  </tr>
</table>


## Key Features

### Intake & Project Creation
- Submit new projects with automatic role assignment based on access requirements  
- Confidential projects are restricted to explicitly assigned users and hidden from global listings  

### Role-Based Security Layer
- Access and actions enforced across roles: `Admin`, `Facilitator`, `Reviewer`, `Participant`, `Watcher`, `Guest`  
- Permissions applied consistently across views, search, and project data  

### User–Project Association Management
- Admins can assign users to projects directly  
- Bulk seeding support for fast environment setup and testing  

### User Role Switch (Testing Mode)
- Admin-only control to simulate different user roles within the UI  
- Enables validation of permissions, visibility, and workflows without separate accounts  

### In-App Task Lists
- Role-specific task queues tied to workflow responsibilities  
- Admins assign facilitators  
- Facilitators manage team composition  
- Reviewers maintain availability and complete review steps  

### Calendar System
- Tracks user availability and lifecycle events  
- Supports organizational holidays  
- Enforces valid scheduling windows  

### Project Visibility Controls
- Confidential project names and details hidden from unauthorized users  
- Applies across listings, search, and dashboards  

### Dashboard & System Pages
- **Dashboard:** Active projects, recent activity, role-specific priorities  
- **Projects:** Lifecycle tracking with phases, team members, and milestones  
- **Calendar:** Availability and scheduled sessions  
- **User Management:** Active Directory-style user table with roles and assignments  
- **Settings:** System configuration and environment controls  

### Search Matrix
- Cross-context search across users and projects  
- Results filtered by permission scope  

### Improved Data Integrity
- Fixes duplicate users during seeding  
- Reliable synchronization between users and project memberships  

### Refined UI Layout
- Consistent table spacing  
- Improved readability across key tables:
  - Active Directory (User Management)
  - Projects (Lifecycle)
  - Dashboard (Recent/Active Projects)
  - Team Members (Project Details)

## Architecture

The application uses a scalable frontend–backend separation:

- **Frontend:** React (Vite + TypeScript)  
- **Backend:** Firebase (Firestore + Authentication, serverless)

### Key Libraries & Tools
- React 18  
- React Router  
- Tailwind CSS  
- Lucide React (icons)  
- Firebase SDK  

## Deployment

To run locally or deploy:

1. Copy `.env.example` to `.env`
2. Configure environment variables for your Firebase project
3. Ensure Firestore and Authentication are enabled
4. Verify security rules align with the role-based permission model