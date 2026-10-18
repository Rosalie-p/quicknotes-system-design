# QuickNotes System Design

QuickNotes is moving from a browser-only app to an online service for 1 million users. This repository has two parts:

1. **A small API client** (`index.html`, `api.js`, `style.css`) that proves the front end can talk to an API. It uses the practice API [JSONPlaceholder](https://jsonplaceholder.typicode.com/) to load, create and delete notes.
2. **Design documents** for the real QuickNotes backend: the API, the data model and the architecture.

## How to run the API client

1. Download or clone the repository.
2. Open `index.html` in a web browser (double-click it). You need an internet connection.
3. Click **Load notes** to fetch 10 notes (GET).
4. Fill in the form and click **Add note** to create a note (POST). The title is required and can be at most 100 characters.
5. Click **Delete** on a note to remove it (DELETE).

If the page does not work from a double-click, start a local server in the project folder with `python -m http.server 8000` and open `http://localhost:8000`.

Note: JSONPlaceholder does not really save data, so the page keeps its own list of notes in memory. The explanation is in a comment in `api.js`.

## Documents

- [API design](docs/api-design.md): endpoints, JSON examples and error codes
- [Data model](docs/data-model.md): tables, relationships, SQL, index and the SQL vs NoSQL decision
- [Architecture](docs/architecture.md): requirements, load estimates, diagram, request flows and trade-offs

## What I learned

- How to use `fetch` with `async`/`await`, check `response.ok`, and handle errors with `try`/`catch`/`finally`.
- Good UI feedback needs loading, success, error and empty states, and buttons should be disabled while a request runs.
- User text must be inserted with `textContent` (never `innerHTML`) to avoid injecting HTML or scripts.
- A real API should use clear REST paths, correct status codes (201, 204, 400, 401, 403, 404, 500) and a consistent error format.
- A many-to-many relationship, like notes and tags, needs a join table.
- Back-of-the-envelope estimates show whether a system is read-heavy, which decides where to add caches and replicas.
- Every design choice has a trade-off, and redundancy removes single points of failure.
