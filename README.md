# HM Construction Staffing App (HMCS)

## Overview
**HMCS** is a comprehensive workforce management application designed for construction staffing agencies. It streamlines the process of managing workers, clients, projects, time entries, invoicing, and payroll — all in one unified platform.

## Tech Stack
- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** PostgreSQL + Sequelize ORM
- **Auth:** JWT (JSON Web Tokens)
- **i18n:** Spanish (default) + English

## Corporate Colors
| Color | Hex |
|---|---|
| Azul Corporativo | `#2A6C95` |
| Verde Corporativo | `#08543D` |
| Gris Corporativo | `#D9D9D9` |

## Entity Naming
All code uses these exact entity names:
`Worker`, `Client`, `Project`, `TimeEntry`, `Invoice`, `Payroll`

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Installation
```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
npm install
npm run dev
```

## Project Structure
```
HMCS 0.01.5/
├── frontend/    # React + Vite application
├── backend/     # Node.js + Express API
├── docs/        # Project documentation
└── README.md
```

## Language Rules
- **UI texts:** Spanish (default) + English
- **Code, variables, functions, comments:** English
- **Database fields and tables:** English
