# School Attendance Tracker — Backend API

Node.js + Express + MongoDB REST API with **separate Teacher and Student portals**.

---

## Folder Structure

```
attendance-backend/
├── src/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js          # Teacher + Student auth
│   │   ├── studentController.js       # Teacher CRUD for students
│   │   ├── studentPortalController.js # Student's own data (NEW)
│   │   ├── attendanceController.js    # Mark/edit/reports (teacher)
│   │   └── dashboardController.js     # Teacher dashboard
│   ├── middleware/
│   │   ├── auth.js          # protect + requireTeacher + requireStudent
│   │   ├── validate.js
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── Teacher.js       # Teacher login model
│   │   ├── Student.js       # Student model + optional login credentials
│   │   └── Attendance.js
│   ├── routes/
│   │   ├── authRoutes.js            # /api/auth/teacher/* + /api/auth/student/*
│   │   ├── studentRoutes.js         # /api/students (teacher-only)
│   │   ├── studentPortalRoutes.js   # /api/student (student-only) (NEW)
│   │   ├── attendanceRoutes.js      # /api/attendance (teacher-only)
│   │   └── dashboardRoutes.js       # /api/dashboard (teacher-only)
│   ├── utils/
│   │   └── token.js   # generateToken(id, role) + sendTeacherTokenResponse + sendStudentTokenResponse
│   ├── app.js
│   └── server.js
├── tests/
│   ├── auth.test.js
│   ├── student.test.js
│   └── studentPortal.test.js   (NEW)
├── .env.example
└── package.json
```

---

## Setup

```bash
cp .env.example .env    # set MONGO_URI + JWT_SECRET
npm install
npm run dev
```

## Docker

Run the API and MongoDB together with Docker Compose:

```bash
docker compose up --build
```

The app listens on `http://localhost:5000` and MongoDB is available on `localhost:27017`. The compose file uses `mongodb://mongo:27017/attendance_db` inside the container network, so you do not need a local MongoDB install when running Docker.

If you want to override the default JWT settings, create a local `.env` file with `JWT_SECRET` and `JWT_EXPIRES_IN` before starting Compose.

## GitHub CI/CD

This repository includes a GitHub Actions workflow at `.github/workflows/ci-cd.yml`.

- **CI (pull requests + pushes to `main`/`master`)**
  - Uses Node.js 20
  - Starts MongoDB as a service container
  - Runs `npm ci` and `npm test`

- **CD (push to `main`/`master`)**
  - Runs only after CI passes
  - Builds the Docker image
  - Pushes image tags to GitHub Container Registry (GHCR): `ghcr.io/<owner>/<repo>`

No extra secret is required for GHCR publishing in the same repository; the workflow uses GitHub's built-in `GITHUB_TOKEN` with `packages: write` permission.

---

## How Student Login Works

**Two-step flow:**

1. **Teacher creates the student record** (name, roll number, class, section) via `POST /api/students`.
2. **Student self-registers** via `POST /api/auth/student/register` by providing their roll number, class, section, and their **teacher's email** — the system matches them to the existing record and lets them set an email + password.
3. From then on, students log in via `POST /api/auth/student/login` and can view all their own attendance data.

If a student forgets their credentials, the teacher can reset them via `PATCH /api/students/:id/reset-credentials`, allowing the student to re-register.

---

## API Reference

All protected routes require: `Authorization: Bearer <token>`

### Auth — `/api/auth`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/teacher/register` | Public | Register teacher |
| POST | `/teacher/login` | Public | Teacher login → JWT |
| GET  | `/teacher/me` | Teacher | Current teacher |
| POST | `/student/register` | Public | Student self-registers against existing record |
| POST | `/student/login` | Public | Student login → JWT |
| GET  | `/student/me` | Student | Current student |

**Student register body:**
```json
{
  "rollNumber": "101",
  "class": "10",
  "section": "A",
  "teacherEmail": "teacher@school.com",
  "email": "alice@student.com",
  "password": "secret123"
}
```

---

### Students — `/api/students` (Teacher only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/`      | List students (filter: `?class=&section=&search=`) |
| POST   | `/`      | Create student |
| GET    | `/:id`   | Get student |
| PUT    | `/:id`   | Update student |
| DELETE | `/:id`   | Soft-delete student |
| PATCH  | `/:id/reset-credentials` | Clear student login so they can re-register |

---

### Attendance — `/api/attendance` (Teacher only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Mark attendance |
| PUT  | `/:id` | Edit attendance |
| GET  | `/` | Fetch by date (`?date=&class=&section=`) |
| GET  | `/report/daily` | Daily report (`?date=&class=&section=`) |
| GET  | `/report/student/:studentId` | Student report (`?from=&to=`) |

---

### Student Portal — `/api/student` (Student only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET   | `/profile` | Own profile (includes teacher info) |
| PATCH | `/profile` | Update own email or password |
| GET   | `/attendance` | Full attendance history + stats (`?from=&to=`) |
| GET   | `/attendance/today` | Today's present/absent/not_marked status |
| GET   | `/attendance/trend` | Last 7 days breakdown |
| GET   | `/attendance/monthly` | Monthly summary (`?year=&month=`) |
| GET   | `/attendance/class-summary` | Class-level stats for a date (`?date=`) |

---

### Dashboard — `/api/dashboard` (Teacher only)

Returns total students, present/absent today, today's percentage, and 7-day trend.

---

## JWT Token Structure

Tokens carry a `role` field (`"teacher"` or `"student"`). The middleware uses this to enforce access:

- `protect` — verifies the token, populates `req.user` + `req.role`
- `requireTeacher` — 403 if `req.role !== "teacher"`
- `requireStudent` — 403 if `req.role !== "student"`
