# FMIS Budget 2027

Online Submission of Budget Proposal Information System para sa paggawa, pagsusumite, pag-review, at consolidation ng budget proposals.

## Main Features

- Budget proposal management para sa Initial, NEP, at GAA.
- Review at approval workflow, kasama ang pag-return ng proposals.
- Tier 1 at Tier 2 management na may version history.
- BRD consolidation at budget reports.
- PDF at Excel export.
- Role-based access para sa users.

## Tech Stack

- Frontend: React, Vite, Material UI
- Backend: Node.js, Express
- Database: MongoDB
- Authentication: JWT / external authentication

## Project Structure

```text
FMIS-BUDGET-2027/
├── CLIENT/       # Frontend
├── SERVER/       # Backend API
├── .gitignore
└── README.md
```

## Requirements

- Node.js na compatible sa project dependencies
- npm
- MongoDB
- Access sa authentication service, kung ginagamit

## Setup

### 1. Clone the repository

```bash
git clone git@github.com:doriemon267/FMIS-BUDGET-2027.git
cd FMIS-BUDGET-2027
```

### 2. Install dependencies

```bash
cd CLIENT
npm install
cd ../SERVER
npm install
cd ..
```

### 3. Configure environment variables

Gumawa ng `.env` file sa `CLIENT` at `SERVER`. Kung may `.env.example`, gamitin ito bilang template.

I-configure ang:

- Server: database connection, application port, authentication settings, at allowed origins.
- Client: backend API URL at authentication URLs.

Huwag isama sa commits ang `.env` files, passwords, at credentials.

## Run the Application

Magbukas ng dalawang terminal mula sa project root.

### Backend

```bash
cd SERVER
npm start
```

### Frontend

```bash
cd CLIENT
npm start
```

Buksan sa browser ang URL na ipinapakita ng frontend terminal.

## Production Build

```bash
cd CLIENT
npm run build
```

Ang frontend build output ay nasa `CLIENT/dist`. I-deploy ito ayon sa server configuration ng project.
