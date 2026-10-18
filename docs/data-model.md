# QuickNotes Data Model

## Entities

### users
| Column | Type | Key / constraint |
|--------|------|------------------|
| id | INTEGER | Primary key |
| email | TEXT | NOT NULL, UNIQUE |
| name | TEXT | NOT NULL |
| password_hash | TEXT | NOT NULL |
| created_at | TEXT (timestamp) | NOT NULL |

### notes
| Column | Type | Key / constraint |
|--------|------|------------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key → users(id), NOT NULL |
| title | TEXT | NOT NULL (max 100 chars) |
| body | TEXT | Optional |
| created_at | TEXT (timestamp) | NOT NULL |
| updated_at | TEXT (timestamp) | NOT NULL |

### tags
| Column | Type | Key / constraint |
|--------|------|------------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key → users(id), NOT NULL |
| name | TEXT | NOT NULL, UNIQUE per user |

### note_tags (join table)
| Column | Type | Key / constraint |
|--------|------|------------------|
| note_id | INTEGER | Foreign key → notes(id) |
| tag_id | INTEGER | Foreign key → tags(id) |
| | | Primary key (note_id, tag_id) |

## Relationships

- **users → notes is one-to-many:** one user owns many notes; each note belongs to exactly one user (`notes.user_id`).
- **users → tags is one-to-many:** one user creates many tags; each tag belongs to one user.
- **notes ↔ tags is many-to-many:** a note can have many tags and a tag can be on many notes. A table cannot hold a list of values in one column, so the `note_tags` join table stores one row per note-and-tag pair. Its composite primary key also stops the same tag being attached to the same note twice. In effect it turns the many-to-many into two one-to-many relationships.

## CREATE TABLE statements

```sql
CREATE TABLE users (
    id            INTEGER PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
    id         INTEGER PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    title      TEXT NOT NULL CHECK (length(title) <= 100),
    body       TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE tags (
    id      INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name    TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
    note_id INTEGER NOT NULL,
    tag_id  INTEGER NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)  REFERENCES tags (id)  ON DELETE CASCADE
);
```

## Example queries

```sql
-- 1. A user's 10 newest notes (powers GET /notes)
SELECT id, title, body, created_at
FROM notes
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 10;

-- 2. All notes with a given tag, using JOINs (powers GET /notes?tag=work)
SELECT n.id, n.title, t.name AS tag
FROM notes n
JOIN note_tags nt ON nt.note_id = n.id
JOIN tags t       ON t.id = nt.tag_id
WHERE n.user_id = 1 AND t.name = 'work';

-- 3. Number of notes per tag, including tags with none
SELECT t.name, COUNT(nt.note_id) AS note_count
FROM tags t
LEFT JOIN note_tags nt ON nt.tag_id = t.id
WHERE t.user_id = 1
GROUP BY t.id, t.name;

-- 4. Delete a note (only if it belongs to the user)
DELETE FROM notes WHERE id = 42 AND user_id = 1;
```

## Index

```sql
CREATE INDEX idx_notes_user_created ON notes (user_id, created_at DESC);
```

Almost every request asks for "this user's notes, newest first". Without the index the database would scan every note of every user; with it, the database jumps straight to one user's notes already in date order. The cost is slightly slower inserts, which is fine because reads far outnumber writes. (An index on `note_tags(tag_id)` would also help the tag queries, because the primary key only covers lookups starting from `note_id`.)

## SQL or NoSQL?

I would choose **SQL** (for example PostgreSQL). The data is clearly structured and related: users own notes, and notes and tags form a many-to-many relationship, which joins handle naturally. Foreign keys, unique emails and the composite key on `note_tags` enforce correctness in the database rather than in application code, and transactions keep multi-step changes (such as creating a note and its tags) consistent. A document database could store a note with its tags embedded and scale writes horizontally, but queries such as "all notes with this tag" and "notes per tag" would be harder and tags would be duplicated. At 1 million users the data (about 0.3 TB a year) fits comfortably on a single primary with read replicas, so SQL's strengths outweigh NoSQL's scaling advantage.
