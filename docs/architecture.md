# QuickNotes Architecture

## Requirements

**Functional**
- Users can register and log in.
- Users can create, read, update and delete their own notes.
- Users can add tags to notes and filter notes by tag.
- Users see only their own notes, newest first, with pagination.

**Non-functional**
- **Scale:** support 1 million registered users.
- **Availability:** about 99.9% uptime; no single point of failure.
- **Latency:** listing notes in under 200 ms for most requests.
- **Durability:** a saved note must never be lost (backups and replication).
- **Security:** HTTPS everywhere, hashed passwords, users can only access their own data.
- **Consistency:** a user should see their own new note immediately; other delays of a few seconds are acceptable.

## Load estimate (1 million users)

Assumptions: 1,000,000 registered users, 20% active per day (200,000), each active user views their notes 20 times and creates 2 notes per day. One day ≈ 100,000 seconds. Peak = 5× average. An average note with metadata ≈ 2 KB.

| Measure | Calculation | Result |
|---------|-------------|--------|
| Reads per day | 200,000 × 20 | 4,000,000 |
| **Reads per second** | 4,000,000 ÷ 100,000 | **40 average, 200 peak** |
| Writes per day | 200,000 × 2 | 400,000 |
| **Writes per second** | 400,000 ÷ 100,000 | **4 average, 20 peak** |
| **Storage per year** | 400,000 × 2 KB = 0.8 GB/day × 365 | **about 300 GB** |

The system is **read-heavy** (about 10 reads for each write), so caching and read replicas matter most. These numbers are small enough for one primary database, but the design adds redundancy for reliability and room to grow.

## Architecture diagram

```
                         +----------------+
                         |     Client     |
                         | (browser/app)  |
                         +--------+-------+
                                  |
                         +--------v-------+
                         |      DNS       |
                         +--------+-------+
                                  |
                         +--------v-------+
                         |      CDN       |  (static files: HTML, CSS, JS)
                         +--------+-------+
                                  | API requests
                         +--------v-------+
                         | Load Balancer  |
                         +----+------+----+
                              |      |
                 +------------+      +-------------+
                 |                                 |
          +------v------+                   +------v------+
          | App Server 1|                   | App Server 2|   (... more as needed)
          +--+---+---+--+                   +--+---+---+--+
             |   |   |                         |   |   |
     +-------+   |   +-----------+     +-------+   |   +-----------+
     |           |               |     |           |               |
+----v----+  +---v---------+  +--v-----v--+   +----v------+  +-----v-----+
|  Cache  |  |  Database   |  |   Queue   |   |  (same)   |  |  (same)   |
| (Redis) |  |  (Primary)  |  +-----+-----+   +-----------+  +-----------+
+---------+  +------+------+        |
                    | replication   v
             +------v------+   +-----------+
             | Read Replica|   |  Worker   |  (emails, search index, exports)
             +-------------+   +-----------+
```

Writes go to the primary database; reads go to the cache first and then the read replica. Both app servers use the same cache, database and queue.

## What each component does

- **Client:** it gives users the interface to read and write notes, and calls the API over HTTPS.
- **DNS:** it solves finding the service by translating the name `quicknotes.example` into the address of the CDN or load balancer.
- **CDN:** it solves slow loading of static files by serving HTML, CSS and JavaScript from servers close to the user, which reduces load on our servers.
- **Load balancer:** it solves a single server being a bottleneck or point of failure by spreading requests across app servers and skipping any that are unhealthy.
- **App servers (two or more):** they run the API logic (authentication, validation, reading and writing notes) and are stateless, so we can add more as traffic grows.
- **Cache:** it solves repeated identical database reads by keeping recent note lists in fast memory, which cuts latency and database load.
- **Primary database:** it solves reliable, consistent storage of users, notes and tags, and it is the single place that accepts writes.
- **Read replica:** it solves read traffic overloading the primary by serving a copy of the data for reads, and it can be promoted if the primary fails.
- **Queue:** it solves slow or unreliable background work holding up requests by letting the app server hand off a job and reply immediately.
- **Worker:** it solves running that background work (welcome emails, search indexing, data exports) by processing jobs from the queue independently of the app servers.

## Request flows

### GET /notes
1. The client sends `GET /api/v1/notes?page=1` with its token.
2. DNS resolves the name and the request reaches the **load balancer**.
3. The load balancer picks a healthy **app server**.
4. The app server checks the token (401 if invalid).
5. It looks for the key `notes:user:{id}:page:1` in the **cache**.
6. **Cache hit:** it returns the cached list straight away (200 OK).
7. **Cache miss:** it queries the **read replica** for that user's notes, newest first, with the page limit.
8. It stores the result in the cache with a short expiry (for example 60 seconds).
9. It returns the JSON list with 200 OK.

### POST /notes
1. The client sends `POST /api/v1/notes` with the JSON note and its token.
2. The request goes through the **load balancer** to an **app server**.
3. The app server checks the token and validates the input (400 if the title is missing or over 100 characters).
4. It inserts the note (and any tag links) in the **primary database** in one transaction.
5. It deletes that user's cached note lists so the next read is fresh.
6. It puts a job on the **queue** (for example "update search index").
7. It returns `201 Created` with the new note as JSON.
8. A **worker** later takes the job from the queue and completes it, retrying if it fails.

## Trade-offs

1. **Cache speed vs freshness.** The cache makes reads fast and protects the database, but a cached list can be briefly out of date. We reduce this by clearing the user's cache on every write and using short expiry times, accepting some extra complexity.
2. **Read replica lag.** The replica copies data a moment after the primary, so a read straight after a write could miss the new note. We gain read capacity but lose strict consistency. For the user's own list right after a write, the app can read from the primary or the cache that was just cleared and refilled.
3. **Asynchronous queue vs simplicity.** Doing background work through a queue and worker keeps requests fast and survives spikes, but adds more components to run and monitor, and results appear slightly later.
4. **SQL consistency vs horizontal scaling.** A single primary database is simple and consistent but limits write scaling. At 20 writes per second at peak this is not a problem; if it became one, we could partition (shard) by user id.

## Avoiding single points of failure

- **DNS and CDN:** use managed providers that are already distributed across many locations.
- **Load balancer:** run a redundant pair (or a managed cloud load balancer) in different zones.
- **App servers:** at least two, in different availability zones; they are stateless, so any one can fail and the load balancer routes around it.
- **Cache:** run a replicated cache cluster; if it fails, requests fall back to the database, which is slower but still works.
- **Database:** the primary has a read replica that can be promoted automatically if the primary fails, plus regular backups stored separately.
- **Queue and worker:** use a replicated queue and run several workers; unfinished jobs return to the queue and are retried.
