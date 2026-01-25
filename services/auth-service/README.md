# Auth Service - README

## Overview
Authentication service handling user registration, login, JWT tokens, and session management.

## Features
- User registration with bcrypt password hashing
- JWT-based authentication (Access + Refresh tokens)
- Redis session storage (7-day TTL)
- Token refresh mechanism
- Logout with session cleanup

## API Endpoints

### POST /register
Register new user account.

**Request:**
```json
{
  "email": "student@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "role": "student"
}
```

**Response:**
```json
{
  "success": true,
  "code": 201,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "student@example.com",
      "name": "John Doe",
      "role": "student"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  },
  "trace_id": "uuid"
}
```

### POST /login
Authenticate existing user.

**Request:**
```json
{
  "email": "student@example.com",
  "password": "SecurePass123"
}
```

**Response:** Same as /register

### POST /refresh
Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### POST /logout
Invalidate session and tokens.

**Headers:**
```
Authorization: Bearer <accessToken>
```

## Database Schema

### User Table
- id (UUID, PK)
- email (Unique)
- password (Hashed)
- name
- role (student | instructor | admin)
- created_at
- updated_at

### RefreshToken Table
- id (UUID, PK)
- token (Unique)
- user_id (FK → User)
- expires_at
- created_at

## Setup

1. Copy `.env.example` to `.env` and configure:
   - DATABASE_URL (Neon connection string)
   - REDIS_URL
   - JWT_SECRET (minimum 32 characters)

2. Install dependencies:
```bash
pnpm install
```

3. Run Prisma migrations:
```bash
pnpm prisma:migrate
```

4. Start development server:
```bash
pnpm dev
```

Server runs on http://localhost:3001
