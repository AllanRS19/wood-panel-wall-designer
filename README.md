# Wood Panel Wall Designer

A full-stack web application that allows customers to design wood-panel wall layouts using their own photos, while enabling operators to manage production workflows, generate dimensionally-accurate drilling templates, and export print-ready assets.

---

# Live Demo

* Live App: ``*

---

# Repository

```bash
git clone https://github.com/allanrs19/wood-panel-wall-designer.git
```

---

# Overview

Wood Panel Wall Designer is a production-oriented wall layout platform built for a wood-panel printing company.

The system allows customers to:

* Upload personal photos
* Arrange panels on a virtual wall editor
* Customize layouts using real-world millimetre measurements
* Submit jobs for review
* Approve proofs
* Download accurate hanging templates

Operators can:

* Manage customer jobs through a production pipeline
* Refine layouts
* Configure panel catalogs and drilling-hole positions
* Generate high-resolution print exports
* Produce dimensionally accurate PDF templates for installation

The project was designed around manufacturing accuracy, geometry correctness, and real-world printing constraints rather than visual approximation.

---

# Core Features

## Customer Features

* Email/password authentication
* Customer dashboard
* Job creation
* Drag-and-drop photo uploads
* Direct browser uploads to object storage
* Virtual wall editor
* Panel rotation and resizing
* Undo/Redo system
* Auto-save
* Proof review flow
* Hanging template downloads
* Reference sheet downloads

---

## Operator Features

* Operator authentication
* Job pipeline management
* Shared wall editor
* Proof generation
* Production status management
* Canvas catalog management
* Interactive hole-position editor
* Print-master ZIP exports

---

## Wall Editor Features

* True-to-scale wall rendering
* Millimetre-based coordinate system
* Grid snapping (10 mm)
* Drag-and-drop interactions
* Panel rotation
* Dynamic aspect-ratio fitting
* Photo swapping
* Auto-save on every mutation
* Read-only proof mode
* Undo/Redo history stack

---

# Technical Requirements Solved

## Measurement Accuracy

One of the most important engineering constraints of the project was ensuring end-to-end dimensional correctness.

The application uses millimetres as the canonical unit across:

* Database models
* Geometry calculations
* Rendering logic
* PDF generation
* Hole-position calculations
* Export pipelines

Pixels are treated only as viewport rendering artifacts and never as business-domain measurements.

---

## PDF Precision

The generated hanging templates were designed to remain dimensionally accurate within ±2 mm across a 2-meter span when printed at 100% scale.

Implemented features include:

* 1:1 tiled PDF generation
* Crop marks
* Calibration square
* Panel outlines
* Drill-point transformations
* Rotation-aware hole rendering
* Multi-page assembly guidance
* Exact print instructions

---

## Geometry System

A dedicated geometry transformation layer handles:

1. Panel-local coordinates
2. Rotation transforms
3. Wall-space transforms
4. PDF-space transforms

All drilling coordinates are calculated mathematically instead of visually approximated.

Critical geometry functions are covered with unit tests due to the safety-critical nature of drilling placement.

---

# Architecture

## Frontend

The frontend is built using a modern React-based architecture optimized for highly interactive editing experiences.

### Responsibilities

* Drag-and-drop interactions
* Wall rendering
* Real-time editing
* Undo/Redo history
* Optimistic UI updates
* Auto-save synchronization
* Authentication state
* PDF preview workflows

---

## Backend

The backend exposes secure APIs for:

* Authentication
* Job management
* Asset storage
* PDF generation
* Status transitions
* Print exports
* Canvas catalog management

The backend also validates:

* Permissions
* Status transition rules
* Geometry integrity
* Upload ownership

---

# Tech Stack

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui
* React DnD / dnd-kit
* Zustand
* React Hook Form

---

## Backend

* Next.js Route Handlers
* Prisma ORM
* PostgreSQL
* NextAuth/Auth.js

---

## Storage & Infrastructure

* AWS S3 / compatible object storage
* Presigned PUT uploads
* Vercel / Railway / Render deployment

---

## PDF & Image Processing

* pdf-lib / PDFKit
* Sharp
* JSZip

---

## Testing

* Vitest / Jest
* React Testing Library

---

# Important Technical Decisions

## Why Millimetres Instead of Pixels?

The application is fundamentally a manufacturing system, not a purely visual editor.

Using millimetres as the canonical unit guarantees:

* Consistent PDF scaling
* Accurate drilling coordinates
* Correct print sizing
* Real-world dimensional reliability

---

## Why Direct-to-Storage Uploads?

Uploads bypass the application server and go directly to object storage using presigned URLs.

Benefits:

* Lower backend memory usage
* Better scalability
* Faster uploads
* Reduced server bandwidth costs

---

## Why Geometry Unit Tests Were Critical

Incorrect hole transformations could cause customers to drill into incorrect wall positions.

The project therefore includes dedicated tests for:

* Rotation transforms
* Coordinate conversion
* PDF scaling
* Hole-position accuracy

This was treated as a safety-critical system.

---

# Job Status Pipeline

The application enforces strict workflow transitions:

```text
DRAFT
→ UPLOADED
→ ARRANGING
→ PROOFING
→ APPROVED
→ PRINTED
→ SHIPPED
```

Invalid transitions are rejected at the API layer.

---

# Folder Structure

```bash
src/
├── app/
├── components/
├── lib/
├── hooks/
├── types/
```

---

# Environment Variables

Create a `.env` file:

```env
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=

S3_BUCKET_NAME=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=

APP_BASE_URL=
```

---

# Local Development Setup

## 1. Clone the repository

```bash
git clone https://github.com/your-username/wood-panel-wall-designer.git
```

---

## 2. Install dependencies

```bash
npm install
```

---

## 3. Configure environment variables

Create:

```bash
.env.local
```

Add all required environment variables.

---

## 4. Run database migrations

```bash
npx prisma migrate dev
```

---

## 5. Seed the database

```bash
npx prisma db seed
```

---

## 6. Start the development server

```bash
npm run dev
```

---

# Running Tests

## Unit Tests

```bash
npm run test
```

---

## Geometry Validation Tests

```bash
npm run test:geometry
```

---

# PDF Validation Procedure

Before production deployment, templates were physically verified by:

1. Printing tiled PDFs at 100%
2. Measuring calibration squares
3. Verifying crop-mark alignment
4. Measuring hole distances
5. Comparing real-world drill locations

This validation step was essential due to the physical manufacturing requirements of the system.

---

# Security & Permissions

## Customers

* Can only access their own jobs
* Cannot access operator routes
* Cannot modify approved proofs

---

## Operators

* Can manage all jobs
* Can edit catalog configurations
* Can generate production exports

---

# Performance Optimizations

* Debounced auto-save
* Memoized geometry calculations
* Optimistic UI updates
* Lazy-loaded editor modules
* Direct browser uploads
* Cached image previews

---

# Accessibility

The application includes:

* Keyboard-accessible interactions
* Semantic HTML
* Focus management
* ARIA labels
* Screen-reader friendly forms

---

# Future Improvements

* Real-time collaboration
* WebSocket synchronization
* AI-assisted layout suggestions
* Multi-room projects
* Mobile editor support
* Advanced print calibration tools

---

# Challenges Faced

## Accurate Geometry Transformations

One of the hardest parts of the project was ensuring hole coordinates remained accurate after:

* Rotation
* Scaling
* Coordinate translation
* PDF tiling

---

## PDF Tiling Accuracy

Generating tiled PDFs while preserving exact physical measurements across multiple printed pages required careful handling of:

* DPI conversions
* Page margins
* Browser print inconsistencies
* Unit conversions