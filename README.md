# Welcome to backend repo!

# FAQ

## This repo is now private so if you're not part of the Shitty List staff or dev team, report to Prometheus

---

### Backend structure

How does this backend work?

-- Tbh i (DuoFresh) wrote this during an internship at Gruppo Maggioli instead
of actually listening to the lessons, anyways this is entirely written in TypeScript
and it uses Express, if you ask me what any of this does just please read the documentation 
later in this file, in case you have any questions that will force me to read code i wrote a month ago
please reconsider or contact me on discord @duofresh.

---

### List FAQ

How long will my record take to get accepted?

- Be real, it'll probably take 3 months, please be patient

What do New record, update record, and fix record mean?

- new record is when your submitting a record for a level for the first time,
  update record is when you have a record on a level but you got a new best and
  it needs to be updated, fix record is when there is an issue with one of your
  records that needs to be fixed

What's an easy way to prove I don't hack?

- Show 2-5 seconds at the end of the previous attempt and the death of that
  attempt. This is the easiest way for us to verify you arent hacking/nocliping.
  However having click, fps counter or hand cam will help out a lot too

It's been like more than a week and my record still hasn't been added, what do i
do?

- You can ask us in
  [#list-support](https://discord.com/channels/713151800932433972/744151240765603951)
  , it was probably an accidentally deleted record(yes it happens), accidentally
  deleting the form, your name was mispelled or you were rejected for cheating

When will \_\_\_ be added to the list?

- With the way our current system works, the staff and relaibles play the
  levels, if the level gets enough positive opinions from us, it then goes into
  voting, where it is voted on if it will be added

Can i submit Multiple levels on 1 video?

- Yes

---

## More Coming Soon!

# List Staff Team

---

## Owners:

- Prometheus

---

## List Admins:

- DuoFresh
- sorrym8
- Homegrowntag

## Repo Maintainers:

- Prometheus
- Emonadeo
- DuoFresh

---

# API Documentation

## Overview

This API provides endpoints for user authentication, level management, record submissions, moderation, and user statistics for The Shitty List project. All endpoints are prefixed with `/api`.

---

## Table of Contents

- [Authentication](#authentication)
  - [POST /api/login](#post-apilogin)
  - [POST /api/register](#post-apiregister)
- [Levels](#levels)
  - [GET /api/ordered-levels](#get-apiordered-levels)
  - [GET /api/list-metadata](#get-apilist-metadata)
  - [GET /api/level/:entry](#get-apilevelentry)
  - [GET /api/editors](#get-apieditors)
  - [GET /api/ordered-ids](#get-apiordered-ids)
- [Submissions & Moderation](#submissions--moderation)
  - [GET /api/moderation-panel](#get-apimoderation-panel)
  - [POST /api/submit](#post-apisubmit)
  - [GET /api/pending](#get-apipending)
  - [POST /api/moderate](#post-apimoderate)
  - [POST /api/moderate-batch](#post-apimoderate-batch)
  - [GET /api/rejected](#get-apirejected)
  - [GET /api/download-data](#get-apidownload-data)
- [User](#user)
  - [GET /api/user/stats](#get-apiuserstats)
- [Utilities](#utilities)
  - [Authentication Middleware](#authentication-middleware)
  - [JSON Handler](#json-handler)
- [Error Handling](#error-handling)
- [Environment Variables](#environment-variables)

---

## Authentication

### POST /api/login

Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
- `200 OK`  
  ```json
  { "token": "jwt_token" }
  ```
- `401 Unauthorized`  
  `{ "error": "Invalid credentials" }`

**Notes:**
- The token is valid for 1 hour (10 years for the user `DuoFresh` for use of the GitHub workflow that allows the backend to push file updates directly to the main repo, documentation on how that system works will not be provides).

---

### POST /api/register

Register a new user.

**Request Body:**
```json
{
  "username": "string",
  "password": "string",
  "role": "string"
}
```

**Response:**
- `201 Created`  
  `{ "message": "User registered successfully." }`
- `400 Bad Request`  
  `{ "error": "Username, password, and role are required." }`  
  `{ "error": "Username already taken." }`

---

## Levels

### GET /api/ordered-levels

Returns all levels in the order specified by `_list.json`, including their full content.

**Response:**
```json
[
  {
    "filename": "level1.json",
    "content": { /* level data */ }
  },
  ...
]
```

---

### GET /api/list-metadata

Returns the contents of `_list.json`.

**Response:**
```json
{
  "list": [ "level1", "level2", ... ]
}
```

---

### GET /api/level/:entry

Returns the JSON content for a specific level.

**URL Params:**
- `entry`: The level's identifier (without `.json`).

**Response:**
- `200 OK`  
  `{ /* level data */ }`
- `404 Not Found`  
  `{ "error": "Level not found or invalid JSON" }`

---

### GET /api/editors

Returns the list of editors from `_editors.json`.

**Response:**
```json
[ "editor1", "editor2", ... ]
```

---

### GET /api/ordered-ids

Returns only the numeric IDs from the ordered level files.

**Response:**
```json
[ 1, 2, 3, ... ]
```

---

## Submissions & Moderation

### GET /api/moderation-panel

**Authentication:** Required (roles: `moderator`, `admin`, `owner`, `senior-list-mod`, `trial`)

Returns all pending submissions for moderation.

**Response:**
```json
[ { /* submission */ }, ... ]
```

---

### POST /api/submit

Submit a new record.

**Request Body:**
```json
{
  "user": "string",
  "level": "string",
  "link": "string"
}
```

**Response:**
- `200 OK`  
  `{ "message": "Submission received" }`
- `400 Bad Request`  
  `{ "error": "Missing fields" }`  
  `{ "error": "Invalid level" }`

---

### GET /api/pending

Returns all pending submissions.

**Response:**
```json
[ { /* submission */ }, ... ]
```

---

### POST /api/moderate

**Authentication:** Required (roles: `moderator`, `admin`, `owner`, `senior-list-mod`)

Moderate a single submission (accept or reject).

**Request Body:**
```json
{
  "index": 0,
  "action": "accept" | "reject",
  "reason": "string (optional, for rejection)"
}
```

**Response:**
- Redirects to `/api/moderation-panel`.

---

### POST /api/moderate-batch

**Authentication:** Required (roles: `moderator`, `admin`, `owner`, `senior-list-mod`)

Moderate multiple submissions in a batch.

**Request Body:**
```json
{
  "actions": [
    { "index": 0, "action": "accept" | "reject", "reason": "string (optional)" },
    ...
  ]
}
```

**Response:**
```json
{ "success": true }
```

---

### GET /api/rejected

Returns an HTML page listing all rejected submissions.

---

### GET /api/download-data

**Authentication:** Required (role: `owner`)

Downloads the entire `/data` directory as a ZIP file.

**Response:**
- `application/zip` file download.

---

## User

### GET /api/user/stats

**Authentication:** Required

Returns statistics for the authenticated user, including:
- Accepted, pending, and rejected submissions
- Points, rank, completed levels
- Creator points and rank

**Response:**
```json
{
  "username": "string",
  "role": "string",
  "stats": {
    "accepted": 0,
    "pending": 0,
    "rejected": 0,
    "totalPoints": 0,
    "rank": 0,
    "totalUsers": 0,
    "completedLevels": [ { "name": "string", "points": 0 }, ... ],
    "acceptedSubmissions": [ { "name": "string" }, ... ],
    "pendingSubmissions": [ { "level": "string", "link": "string", "queuePosition": 0 }, ... ],
    "rejectedSubmissions": [ { "level": "string", "link": "string", "reason": "string" }, ... ],
    "creatorPoints": 0,
    "creatorRank": 0,
    "totalCreators": 0,
    "createdLevels": [ { "rank": 0, "level": "string", "path": "string", "creatorpoints": 0 }, ... ]
  }
}
```

---

## Utilities

### Authentication Middleware

- `authenticate`: Verifies JWT token from the `Authorization` header (`Bearer <token>`). Adds `user` to the request object.
- `authorize(...roles)`: Ensures the authenticated user has one of the specified roles.

### JSON Handler

- `readJSON(path)`: Reads and parses a JSON file. Returns an empty array on error.
- `writeJSON(path, data)`: Writes data to a JSON file.
- `appendToJSON(path, item)`: Appends an item to a JSON array file.

---

## Error Handling

- Most endpoints return JSON error messages with appropriate HTTP status codes.
- Some endpoints (e.g., `/api/rejected`) return HTML for browser display.

---

## Environment Variables

- `JWT_SECRET`: Secret key for JWT signing (default: `"default_secret"`).
- `PORT`: Port for the server (default: `3000`).

---

## Example Usage

**Login and use token:**
```bash
curl -X POST http://localhost:3000/api/login -H "Content-Type: application/json" -d '{"username":"user","password":"pass"}'
# Use the returned token for authenticated requests:
curl http://localhost:3000/api/user/stats -H "Authorization: Bearer <token>"
```

---

**For further details, see the source code in the `src/routes/` directory.**
