# QuickNotes API Design

This is the real API the backend team should build (not JSONPlaceholder). It is a REST API over HTTPS that sends and receives JSON. Base path: `/api/v1`. Every endpoint except `POST /auth/login` needs the header `Authorization: Bearer <token>`.

## Endpoints

| Method | Path | Description | Success status |
|--------|------|-------------|----------------|
| POST | `/auth/login` | Log in with email and password and receive a token | 200 OK |
| GET | `/notes` | List the logged-in user's notes (supports `?page=1&limit=10&tag=work`) | 200 OK |
| GET | `/notes/{id}` | Get one note | 200 OK |
| POST | `/notes` | Create a note | 201 Created |
| PUT | `/notes/{id}` | Replace a note's title and body | 200 OK |
| DELETE | `/notes/{id}` | Delete a note | 204 No Content |
| GET | `/tags` | List the user's tags | 200 OK |
| POST | `/notes/{id}/tags` | Attach a tag to a note | 201 Created |
| DELETE | `/notes/{id}/tags/{tagId}` | Remove a tag from a note | 204 No Content |

## Example: create a note

`POST /api/v1/notes`

Request:
```json
{
  "title": "Buy milk",
  "body": "Two litres, semi-skimmed",
  "tags": ["shopping"]
}
```

Response: `201 Created` with a `Location: /api/v1/notes/42` header
```json
{
  "id": 42,
  "userId": 1,
  "title": "Buy milk",
  "body": "Two litres, semi-skimmed",
  "tags": ["shopping"],
  "createdAt": "2026-10-18T09:30:00Z",
  "updatedAt": "2026-10-18T09:30:00Z"
}
```

## Example: list notes

`GET /api/v1/notes?page=1&limit=2`

Response: `200 OK`
```json
{
  "data": [
    {
      "id": 42,
      "title": "Buy milk",
      "body": "Two litres, semi-skimmed",
      "tags": ["shopping"],
      "createdAt": "2026-10-18T09:30:00Z"
    },
    {
      "id": 41,
      "title": "Call the bank",
      "body": "",
      "tags": [],
      "createdAt": "2026-10-17T16:05:00Z"
    }
  ],
  "page": 1,
  "limit": 2,
  "total": 37
}
```

## Error status codes

| Status | Meaning | When it happens |
|--------|---------|-----------------|
| 400 Bad Request | Invalid input | Missing title, title over 100 characters, malformed JSON |
| 401 Unauthorized | Not logged in | Missing, invalid or expired token |
| 403 Forbidden | Not allowed | Trying to read or change another user's note |
| 404 Not Found | Does not exist | No note with that id |
| 409 Conflict | Clash with existing data | Attaching a tag that is already on the note |
| 429 Too Many Requests | Rate limit exceeded | Too many requests from one user |
| 500 Internal Server Error | Server fault | Unexpected bug or database failure |

Example error body (the same shape is used for every error):

`400 Bad Request`
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required and must be 100 characters or fewer.",
    "status": 400
  }
}
```
