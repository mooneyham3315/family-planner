# Family Appointment Planner

A shared, accessibility-first family appointment planner built with React, TypeScript, Tailwind CSS v4, and Supabase. Designed so multiple generations—including kids, parents, and grandparents—can view, filter, and manage upcoming appointments without calendar clutter.

## Why I Built It

Coordinating schedules across multiple family members often breaks down when tools are either overcomplicated or hard to read on a phone or tablet. I built **Family Appointment Planner** as a practical household web app and a portfolio project demonstrating full-stack CRUD state management, real-time database synchronization, and clean UI structure.

## Key Features

- **Individual Member Filtering:** Filter appointments across **Everyone** or drill down to a single person (**Tom**, **Kandi**, **Faith**, **Granger**, **Amy**, **Charlie**, **Betty**, and **Robert**) with distinct color badges and card accents.
- **Large Print Accessibility Mode:** One-click toggle that enlarges typography and button tap targets for easier reading on mobile and tablet screens.
- **Full CRUD Persistence:** Create, edit, and delete appointments backed by Supabase PostgreSQL.
- **Real-Time Updates:** Subscribes to `postgres_changes` on the `appointments` table so edits sync across active sessions without manual refreshes.

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Styling & Icons:** Tailwind CSS v4, Lucide React
- **Backend & Database:** Supabase (PostgreSQL + Realtime subscriptions)
- **Deployment:** Netlify

## Database Schema (`appointments`)

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | `uuid` / `bigint` | Primary key |
| `title` | `text` | Appointment name or purpose |
| `member` | `text` | Assigned family member (`Tom`, `Kandi`, `Faith`, `Granger`, `Amy`, `Charlie`, `Betty`, `Robert`) |
| `date` | `date` | Scheduled appointment date (`YYYY-MM-DD`) |
| `time` | `text` | Scheduled time (defaults to `All Day` if blank) |
| `location` | `text` | Clinic, school, address, or `TBD` |
| `notes` | `text` | Optional reminders or paperwork notes |
| `created_at` | `timestamptz` | Creation timestamp |

## Local Setup

1. **Clone the repository**
   ```bash
   git clone [https://github.com/mooneyham3315/family-planner.git](https://github.com/mooneyham3315/family-planner.git)
   cd family-planner