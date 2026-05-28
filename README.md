# Wood Panel Wall Designer

This project is a full-stack web application for a hiring test, which takes a customer from "upload photos" to "tape a paper template to the wall and drill." Customers design their wood panel layouts in a virtual wall editor; an operator reviews, prints, and ships the panels; the customer downloads a dimensionally-accurate 1:1 PDF template and drills into the wall at the exact marked positions.

---

## Table of Contents

- [What It Does](#what-it-does)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Key Design Decisions](#key-design-decisions)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [Running the Project](#running-the-project)
- [Testing](#testing)
- [Job Status Pipeline](#job-status-pipeline)
- [PDF Accuracy](#pdf-accuracy)
- [API Reference](#api-reference)
- [Things Learned](#things-learned)

---

## What It Does

**Customer flow:**
1. Signs up and creates a job (title + wall dimensions in mm)
2. Uploads photos (JPEG/PNG/WebP) — files go directly from browser to S3, never through the server
3. Drags photos from a tray onto a virtual wall, repositions panels (snap-to-grid 10 mm), rotates, changes canvas sizes
4. Submits for review
5. Receives a proof, downloads PDFs, approves or requests changes
6. Prints the 1:1 hanging template, tapes tiles together, drills at every ✕ mark

**Operator flow:**
1. Sees all jobs in a pipeline grouped by status
2. Opens any job and edits the wall layout
3. Sends proof to customer
4. Downloads print-master ZIP (per-panel specs + source photo URLs at 300 dpi)
5. Marks jobs as printed and shipped
6. Manages canvas size catalog and configures hole positions per size

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server Components for SEO-friendly data-fetched pages; Client Islands for interactive canvas |
| Styling | Tailwind CSS | Utility-first; no stylesheet maintenance |
| Database | PostgreSQL + Prisma ORM | Relational model suits jobs/photos/panels; Prisma gives type-safe queries |
| Auth | NextAuth.js v4 (JWT, credentials) | Session persists across browser restarts (30-day JWT); role stored in token |
| File storage | AWS S3 (or MinIO for local dev) | Presigned PUT URLs — photos never pass through the server |
| PDF generation | pdf-lib | Pure JavaScript; no native dependencies; full control over coordinate math |
| ZIP export | JSZip | Browser and Node compatible; no native deps |
| Wall editor | SVG + React hooks | SVG scales naturally with `viewBox`; all coordinates stay in mm |
| Testing | Jest + ts-jest | Unit tests for the geometry module |

---

## Architecture

### Server vs Client split

The project uses Next.js App Router's Server/Client boundary deliberately:

```
Page (Server Component)
│   Fetches job data server-side (no loading state, SEO-friendly)
│   Computes derived booleans (isEditable, canSubmit, etc.)
│
├── JobActions (Client Island)
│       Handles status transitions; calls router.refresh() on change
│
├── PhotoSection (Client Island)
│       Drag-drop upload with progress; direct S3 presigned PUT
│
└── WallEditorIsland (Client Island)
        Wraps WallEditor with save handler + router.refresh() logic
        │
        └── WallEditor (Client)
                SVG canvas; all state in mm; useWallEditor hook
```

Server Components fetch data and pass it as props to Client Islands. When mutations happen (status change, panel save), `router.refresh()` re-runs the Server Component so the status badge and derived state update without a full page reload and without losing client-side editor state.

### Why `router.refresh()` instead of local state for status

The job status badge, submit button visibility, and `canSubmit` flag are all computed server-side. Rather than duplicating that logic client-side, we let the server re-compute after every relevant mutation. The WallEditorIsland doesn't remount on refresh (the `key` prop is based on photo IDs, which don't change during panel edits), so editor state is preserved.

### Presigned S3 uploads

The client requests a presigned PUT URL from the server (`POST /api/upload/presign`). The server creates a Photo record in the database, generates the S3 key, and returns the presigned URL. The browser uploads the file directly to S3 using `XMLHttpRequest` (for per-file progress events). The file never passes through the application server.

```
Browser → POST /api/upload/presign → Server creates Photo record, returns { photoId, presignedUrl }
Browser → PUT presignedUrl (direct to S3) → S3 stores file
Browser tells server upload is done (photo record already exists)
```

---

## Key Design Decisions

### All measurements in millimetres, end-to-end

There are no pixels or percentages in the data model. Every panel position, wall dimension, canvas size, and hole coordinate is stored and transmitted in millimetres. The display scale (pixels per mm) is computed at render time and never persisted. This means:

- PDF coordinates are computed by multiplying mm by `MM_TO_PT = 72/25.4`
- The SVG `viewBox` is `0 0 {wallWidthMm} {wallHeightMm}` — SVG units are mm
- Snap-to-grid operates in mm: `Math.round(xMm / 10) * 10`

### Hole position geometry

The geometry module (`src/lib/geometry.ts`) is the critical safety component. It transforms hole positions from panel-local coordinates through panel rotation to wall coordinates, then to PDF coordinates.

For a panel of natural size W×H at position (px, py) with rotation R:

| Rotation | Display size | Hole at (hx, hy) → wall |
|---|---|---|
| 0° | W × H | (px + hx, py + hy) |
| 90° CW | H × W | (px + H − hy, py + hx) |
| 180° | W × H | (px + W − hx, py + H − hy) |
| 270° CW | H × W | (px + hy, py + W − hx) |

These formulas are derived from the image rotation transformation (x,y) → (H−y, x) for 90° CW in a y-down coordinate system, and have 23 unit tests verifying correctness on all four corners and edge cases.

### Panel drag uses native window event listeners

React's synthetic event system batches state updates, which means there is a render-cycle gap between when `mousedown` fires (setting drag state) and when the `onMouseMove` handler sees the updated state. For drag-and-drop, this gap causes the first several mousemove events to be ignored.

The fix: in the panel `onMouseDown` handler, create native `window.addEventListener('mousemove', ...)` and `window.addEventListener('mouseup', ...)` listeners directly. These listeners close over the initial offset at mousedown time and are synchronous — no React batching, no stale closures.

### Status machine

Job status follows a strict directed graph with role-based permissions:

```
DRAFT → UPLOADED → ARRANGING → PROOFING → APPROVED → PRINTED → SHIPPED
```

Invalid transitions are rejected server-side. The allowed transitions per role are:

| Transition | Triggered by |
|---|---|
| DRAFT → UPLOADED | Auto: first photo uploaded |
| UPLOADED → ARRANGING | Auto: first panel placed on wall |
| ARRANGING → PROOFING | Customer: "Submit for Review" |
| PROOFING → ARRANGING | Customer: "Request Changes" |
| PROOFING → APPROVED | Customer: "Approve" |
| APPROVED → PRINTED | Operator |
| PRINTED → SHIPPED | Operator |

Reversal also happens:
- All panels removed → ARRANGING reverts to UPLOADED
- All photos deleted → any status reverts to DRAFT

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/                    # NextAuth + signup
│   │   ├── jobs/[id]/
│   │   │   ├── route.ts             # Job CRUD
│   │   │   ├── status/route.ts      # Status transitions (role-gated)
│   │   │   ├── panels/route.ts      # Panel bulk-replace + status sync
│   │   │   ├── pdf/route.ts         # PDF generation
│   │   │   └── export/route.ts      # Print-master ZIP (operator only)
│   │   ├── canvas-sizes/[id]/
│   │   │   ├── route.ts             # Canvas size CRUD
│   │   │   └── holes/route.ts       # Hole position CRUD
│   │   └── upload/presign/route.ts  # S3 presigned URL + photo record
│   ├── (auth)/                      # Login, signup
│   ├── (customer)/                  # Dashboard, job editor
│   └── (operator)/                  # Pipeline, job editor, settings
│
├── components/
│   ├── WallEditor.tsz               # All editor state (panels, history, save)
│   ├── HoleEditor.tsx               # Interactive hole-position editor with mm rulers
│   ├── PhotoUpload.tsx              # Drag-drop + direct S3 upload with progress
│   └── ui/                          # Button, Input, Dialog
│
├── lib/
│   ├── geometry.ts                  # ALL mm math — hole transforms, tile grid, PDF coords
│   ├── geometry.test.ts             # 23 unit tests for hole positions and PDF math
│   ├── pdf.ts                       # 1:1 tiled template + reference sheet generation
│   ├── zipExport.ts                 # Print-master ZIP builder
│   ├── auth.ts                      # NextAuth config (JWT, credentials, role in token)
|   ├── db/
|   ├───── prisma.ts                 # Prisma DB connection and setup
│   └── s3.ts                        # Presigned PUT/GET, key builder
│
├── types/                   
│   ├──── index.ts                   # Shared types + status machine + role constants
│
└── proxy.ts                         # Route protection by role
```

---

## Setup

### Prerequisites

- Next.js 16
- Node.js 18+
- PostgreSQL 14+
- AWS account
- Bun package installer

### 1. Clone and install

```bash
git clone 
cd wood-panel-designer
bun install
```

### 2. Configure environment

```bash
cp .env.
# Edit .env — see Environment Variables section below
```

### 3. Set up S3

1. Create an S3 bucket (block all public access — files are served via presigned URLs)
2. Add CORS policy to the bucket:

```json
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["PUT", "GET"],
  "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3000
}]
```

3. Create an IAM user with this policy (replace YOUR-BUCKET-NAME):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
  }]
}
```

4. Generate access keys for the IAM user and add to `.env`

### 4. Database

```bash
bunx --bun migrate --name {name}  # creates tables
```

### 5. Run

```bash
bun run dev
```

Visit http://localhost:3000 — redirects to login.

---

### Important when testing

To create a operator account, you just simply need to include "@woodpanel" in the email address when signing up and it will automatically create your profile as an operator.

Keep in mind that this approach is just to make the testing easier, but it's obviously not something that you would do in production.

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random secret — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | App URL (`http://localhost:3000` for dev) |
| `AWS_REGION` | S3 bucket region |
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `S3_BUCKET_NAME` | Bucket name |
| `S3_ENDPOINT` | Leave empty for AWS

### Local dev with MinIO (no AWS account needed)

```bash
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  quay.io/minio/minio server /data --console-address ":9001"
```

Then set `S3_ENDPOINT=http://localhost:9000` and use `minioadmin` for both key variables.
Create the bucket in the MinIO console at http://localhost:9001 and set CORS.

---

## Running the Project

```bash
bun run dev          # development server
```

---

## Testing

The geometry module has 23 unit tests covering:

- Hole transformation at all 4 rotations (0°, 90°, 180°, 270°)
- All 4 corners of each rotation (16 corner tests)
- Centre hole invariance under 180°
- Rotation inverse check (90° then 270° = identity)
- `wallMmToPdfPt` accuracy (±0.001mm across 2000mm span)
- `MM_TO_PT` constant precision (`25.4 * MM_TO_PT = 72.000...`)
- Grid snap behaviour
- Tile grid calculation
- Default hole fallback

```bash
npm test
```

Expected output:
```
PASS  src/lib/geometry.test.ts
  Tests: 23 passed, 23 total
```

---

## Job Status Pipeline

```
DRAFT
  ↓  (first photo uploaded — automatic)
UPLOADED
  ↓  (first panel placed — automatic)
ARRANGING
  ↓  (customer: Submit for Review)
PROOFING
  ↓  (customer: Approve)          ↓  (customer: Request Changes)
APPROVED                       ARRANGING
  ↓  (operator)
PRINTED
  ↓  (operator)
SHIPPED
```

Status changes happen through explicit UI actions. Invalid transitions are rejected by the API with a descriptive error. The `canTransition(from, to)` function in `src/types/index.ts` is the single source of truth for valid transitions.

---

## PDF Accuracy

The hanging template PDFs must be dimensionally correct to within ±2 mm across a 2 m span when printed at 100% scale. This is achieved through:

1. **Exact conversion constant**: `MM_TO_PT = 72 / 25.4 = 2.834645669...` — computed once and used everywhere. No rounding in intermediate steps.

2. **Direct coordinate math**: Wall position in mm → multiply by `MM_TO_PT` → PDF points. No intermediate pixel step.

3. **Tile clipping**: When a panel spans multiple pages, each page shows only the portion of the panel that falls within that tile's content area. The crop marks allow the customer to align and tape pages correctly, at which point the panel outlines join seamlessly.

4. **Calibration page**: Page 1 of every template contains a 100×100 mm reference square. The customer must measure this with a ruler before taping anything. If it's wrong, they reprint. This catches any "Fit to page" print scaling errors.

5. **Rotation-aware hole placement**: The `transformHoleToWall` function correctly computes where each drill mark appears on the wall accounting for panel rotation. Unit-tested against all rotations and corner positions.

**To verify before first production use:**
1. Create a test job: 500×400mm wall
2. Place a 200×150mm panel at exactly x=50mm, y=30mm
3. Configure a hole at x=100mm, y=25mm (relative to panel)
4. Generate and print the template at 100%
5. Verify calibration square = 100mm
6. Measure: drill mark should be at 150mm from left wall edge (50+100), 55mm from top (30+25)
7. Tolerance: ±2mm

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | None | Register new customer |
| GET | `/api/jobs` | Any | List jobs (customers: own only; operators: all) |
| POST | `/api/jobs` | Any | Create job |
| GET | `/api/jobs/:id` | Owner/Op | Get job with photos + panels |
| PATCH | `/api/jobs/:id` | Owner/Op | Update title, dimensions |
| DELETE | `/api/jobs/:id` | Owner(DRAFT)/Op | Delete job |
| POST | `/api/jobs/:id/status` | Role-gated | Transition job status |
| GET | `/api/jobs/:id/panels` | Owner/Op | List panels |
| POST | `/api/jobs/:id/panels` | Owner/Op | Bulk-replace panels |
| GET | `/api/jobs/:id/pdf?type=template\|reference` | Owner/Op | Download PDF |
| GET | `/api/jobs/:id/export` | Operator | Download print-master ZIP |
| GET | `/api/canvas-sizes` | Any | List canvas sizes |
| POST | `/api/canvas-sizes` | Operator | Create canvas size |
| PATCH | `/api/canvas-sizes/:id` | Operator | Update / toggle active |
| GET | `/api/canvas-sizes/:id/holes` | Any | List hole positions |
| POST | `/api/canvas-sizes/:id/holes` | Operator | Add hole |
| PUT | `/api/canvas-sizes/:id/holes` | Operator | Update hole |
| DELETE | `/api/canvas-sizes/:id/holes` | Operator | Delete hole |
| POST | `/api/upload/presign` | Any | Get presigned S3 PUT URL |
| DELETE | `/api/upload/presign` | Owner/Op | Delete photo + its panels |

---

## Things Learned

**Server Component + Client Island pattern is powerful but requires discipline.** The `router.refresh()` pattern for syncing server-computed state (like `canSubmit` and the status badge) with client-side mutations is elegant but non-obvious. The key insight: Server Components own derived read state; Client Islands own interaction state. Mutations call `router.refresh()` to re-sync.