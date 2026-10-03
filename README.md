# Daily Update Website

A web app where employees log the work they did each day, and managers log in to see every employee and read an AI-written summary of what each person has been working on. No email involved: everything happens on the website.

![Login page with the 3D scene](docs/login.png)

| Employee view | Manager view |
|---|---|
| ![Employee logging daily work](docs/employee.png) | ![Manager reading an AI summary](docs/manager.png) |

## Features

**Employees**
- Sign up and log in
- Write a daily update: what they worked on, hours (optional), blockers (optional)
- Pick a past date to edit that day's entry; delete their own entries
- See their streak, days logged and hours this week, and recent history

**Managers**
- See team stats and a searchable list of all employees, with a status dot for how recently each person posted
- Open any employee to read their daily updates for the last 30 days
- Generate an AI summary for the last 7, 14 or 30 days (overview, key accomplishments, blockers and risks, time, suggested follow-ups)
- Create employee or manager accounts

## Project layout

```
daily-update-website/
├── frontend/   React + Vite website (three.js 3D scenes) and the nginx gateway
├── backend/    Java 21 / Spring Boot microservices (Maven multi-module)
│   ├── common/           shared JWT security, error handling, rate limiting
│   ├── auth-service/     users, passwords, login tokens
│   ├── worklog-service/  daily work logs
│   └── summary-service/  AI summaries (calls Claude)
├── config/     docker-compose.yml and .env.example
└── docs/       Screenshots
```

## Architecture

```
Browser ──► frontend (nginx: React build + API gateway, :8080)
              ├── /api/auth, /api/users ──► auth-service     (Spring Boot, :4001)
              ├── /api/logs             ──► worklog-service  (Spring Boot, :4002)
              └── /api/summaries        ──► summary-service  (Spring Boot, :4003) ──► Claude API
                                                │
                     all services ──────────────┴──► PostgreSQL 17
```

| Service | Owns | Notes |
|---|---|---|
| frontend | React app | nginx serves the build, routes `/api/*` to the right service and sets security headers |
| auth-service | `users` table | Sign-up, login, roles, employee list, first manager seeded from `.env` |
| worklog-service | `work_logs` table | One entry per employee per day |
| summary-service | `summaries` table | Fetches logs from worklog-service, asks Claude to summarize, saves the result |
| db | PostgreSQL | Each service creates its own tables on start (`schema.sql`) |

The backend is Spring Boot 4.1 on Java 21 with Spring Security, JDBC (`JdbcClient`) and Bean Validation. The summary-service calls the other services with the manager's own login token, so every service checks permissions itself. AI summaries use the official Anthropic Java SDK with model `claude-opus-5-5` by default.

The frontend is React 19 built with Vite. The 3D visuals use three.js through `@react-three/fiber` and `@react-three/drei`: an animated scene on the login page and a 3D "thinking" orb while a summary is written. The 3D code loads in its own chunk, pauses for people who prefer reduced motion, and uses no external assets at runtime.

### Using a Blender model

Export your model from Blender as **glTF Binary** (`.glb`, no Draco compression), save it as `frontend/public/models/hero.glb`, and rebuild. The login page shows it in place of the built-in shape.

## Security

- Passwords hashed with BCrypt (cost 12). Login gives the same error, in the same time, for an unknown email and a wrong password.
- Signed JWT login tokens (HS256, 8 hour expiry) checked by Spring Security in every service; stateless, no cookies.
- Role rules: employees can only read and change their own logs; only managers can list employees, read other people's logs, and generate summaries. Self sign-up always creates an employee.
- Rate limits on login and sign-up (20 per 15 minutes per IP) and on AI summaries (30 per hour per manager).
- All SQL is parameterized; requests are validated and errors never expose internals.
- nginx sends a strict Content Security Policy, `X-Frame-Options: DENY` and `nosniff`. React escapes all user text.
- Employee text sent to the AI is wrapped as data and the model is told never to follow instructions inside it.
- Containers run as non-root users. Only the frontend port is published; the database and services sit on a private Docker network. Secrets come from `config/.env`, which is git-ignored.

For production, put the site behind HTTPS (for example a reverse proxy or load balancer with a TLS certificate).

## Run it with Docker

You need [Docker](https://docs.docker.com/get-docker/) with Docker Compose.

```bash
git clone https://github.com/aithalvishwas/daily-update-website.git
cd daily-update-website
./config/setup.sh
```

`setup.sh` creates `config/.env` and fills in random values for `POSTGRES_PASSWORD`, `JWT_SECRET` and the first manager's password, then prints the manager login. Running it again never overwrites values you've set.

Optionally, edit `config/.env`:

- `MANAGER_EMAIL` / `MANAGER_PASSWORD`: the first manager account, created on first start
- `ANTHROPIC_API_KEY`: your Anthropic API key for AI summaries (get one at [console.anthropic.com](https://console.anthropic.com)). Without it the app still works and shows a basic, non-AI summary.

If you prefer to do it by hand, copy `config/.env.example` to `config/.env` and set `POSTGRES_PASSWORD` and `JWT_SECRET` (at least 32 characters, e.g. `openssl rand -hex 32`); the app won't start without them.

Then build and start everything (the first build downloads Maven and npm packages, so it takes a few minutes):

```bash
docker compose -f config/docker-compose.yml up -d --build
```

Open http://localhost:8080. Log in as the manager from `config/.env`, or use **Sign up** to create employee accounts.

Stop with `docker compose -f config/docker-compose.yml down` (add `-v` to also delete the database).

## Develop without Docker

Requirements: Java 21, Maven 3.9, Node 22, and a PostgreSQL database.

```bash
# Backend: build all services
cd backend && mvn package -DskipTests

# Run each service in its own terminal (same env vars as config/.env)
export JWT_SECRET=... DATABASE_URL=jdbc:postgresql://localhost:5432/dailyupdate DATABASE_USER=... DATABASE_PASSWORD=...
java -jar auth-service/target/app.jar
java -jar worklog-service/target/app.jar
java -jar summary-service/target/app.jar   # add AUTH_SERVICE_URL=http://localhost:4001 WORKLOG_SERVICE_URL=http://localhost:4002

# Frontend with hot reload (proxies /api to the services)
cd frontend && npm install && npm run dev
```

## API

All endpoints except sign-up and login need `Authorization: Bearer <token>`. Errors come back as `{"error": "..."}`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | anyone | Create an employee account, returns a token |
| POST | `/api/auth/login` | anyone | Log in, returns a token |
| GET | `/api/auth/me` | any user | Current user |
| GET | `/api/users` | manager | List employees |
| GET | `/api/users/{id}` | manager | One user |
| POST | `/api/users` | manager | Create an employee or manager |
| POST | `/api/logs` | any user | Create or update the caller's log for a date |
| GET | `/api/logs/me?from=&to=` | any user | Caller's logs (default last 30 days) |
| DELETE | `/api/logs/{id}` | owner | Delete own log |
| GET | `/api/logs/overview` | manager | Last log date and 7-day count per employee |
| GET | `/api/logs/user/{userId}?from=&to=` | manager | An employee's logs |
| GET | `/api/summaries/{userId}` | manager | Latest saved summary |
| POST | `/api/summaries/{userId}` `{ "days": 7 }` | manager | Generate a new summary (7, 14 or 30 days) |

## Configuration

| Variable | Default | Used by |
|---|---|---|
| `APP_PORT` | `8080` | Port the website is published on |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `dailyupdate` / required / `dailyupdate` | Database |
| `JWT_SECRET` | required | All services |
| `MANAGER_NAME` / `MANAGER_EMAIL` / `MANAGER_PASSWORD` | unset | auth-service, first-run manager |
| `ANTHROPIC_API_KEY` | unset | summary-service |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | summary-service |
| `AUTH_RATE_LIMIT` | `20` | Login/sign-up attempts per 15 min per IP |
| `SUMMARY_RATE_LIMIT` | `30` | Summaries per hour per manager |
