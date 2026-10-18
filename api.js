// QuickNotes API client (practice backend: JSONPlaceholder)
const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadBtn = document.getElementById("load-btn");
const statusEl = document.getElementById("status");
const notesList = document.getElementById("notes-list");
const form = document.getElementById("note-form");
const titleInput = document.getElementById("title-input");
const bodyInput = document.getElementById("body-input");
const submitBtn = document.getElementById("submit-btn");

/*
 * JSONPlaceholder does NOT really store anything: a POST returns a fake id (101)
 * but the note is never saved, and a later GET will not include it. DELETE also
 * only pretends to work. So the page keeps its own list of notes in memory
 * (the `notes` array) and treats it as the source of truth for what is on screen.
 * - After a successful POST we add the server's response to the top of `notes`.
 * - After a successful DELETE we remove that note from `notes` and the page.
 * - We do NOT re-fetch after POST/DELETE, because the server would bring back
 *   the original notes and "undo" our changes.
 * Because every created note gets id 101, each note also gets a local `key`
 * so the page can tell notes apart.
 */
let notes = [];
let nextKey = 1;

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type ? "status-" + type : "";
}

function setBusy(busy) {
  loadBtn.disabled = busy;
  submitBtn.disabled = busy;
  document.querySelectorAll(".delete-btn").forEach((b) => (b.disabled = busy));
}


// Reusable request: calls fetch, checks response.ok, throws on errors
async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error("Request failed with status " + response.status);
    error.status = response.status;
    throw error;
  }
  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }
  return { status: response.status, data };
}

function friendlyError(error, action) {
  if (error.status) {
    return "Could not " + action + " (server returned status " + error.status + "). Please try again.";
  }
  return "Could not " + action + ". Please check your internet connection and try again.";
}

function renderNotes() {
  notesList.textContent = "";
  if (notes.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No notes yet. Add one above or load notes from the server.";
    notesList.appendChild(li);
    return;
  }
  notes.forEach((note) => {
    const li = document.createElement("li");
    li.className = "note";

    const title = document.createElement("h2");
    title.textContent = note.title;

    const body = document.createElement("p");
    body.textContent = note.body || "";

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-btn";
    del.textContent = "Delete";
    del.addEventListener("click", () => handleDelete(note));

    li.append(title, body, del);
    notesList.appendChild(li);
  });
}

function getNotes() {
  return request(API_URL + "?_limit=10");
}

function createNote(note) {
  return request(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(note),
  });

}
function deleteNote(id) {
  return request(API_URL + "/" + id, { method: "DELETE" });
}

async function handleLoad() {
  setBusy(true);
  setStatus("Loading notes...", "loading");
  try {
    const { data } = await getNotes();
    notes = data.map((n) => ({ ...n, key: nextKey++ }));
    renderNotes();
    setStatus(
      notes.length === 0 ? "The server returned no notes." : "Loaded " + notes.length + " notes from the server.",
      "success"
    );
  } catch (error) {
    setStatus(friendlyError(error, "load notes"), "error");
  } finally {
    setBusy(false);
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (title === "") {
    setStatus("Please enter a title.", "error");
    return;
  }
  if (title.length > 100) {
    setStatus("The title must be 100 characters or fewer (currently " + title.length + ").", "error");
    return;
  }

  setBusy(true);
  setStatus("Creating note...", "loading");
  try {
    const { status, data } = await createNote({ title, body, userId: 1 });
    notes.unshift({ ...data, key: nextKey++ });
    renderNotes();
    form.reset();
    setStatus("Note created (status " + status + ", id " + data.id + ").", "success");
  } catch (error) {
    setStatus(friendlyError(error, "create the note"), "error");
  } finally {
    setBusy(false);
  }
}
async function handleDelete(note) {
  setBusy(true);
  setStatus("Deleting note...", "loading");
  try {
    await deleteNote(note.id);
    notes = notes.filter((n) => n.key !== note.key);
    renderNotes();
    setStatus("Note deleted.", "success");
  } catch (error) {
    setStatus(friendlyError(error, "delete the note"), "error");
  } finally {
    setBusy(false);
  }
}

loadBtn.addEventListener("click", handleLoad);
form.addEventListener("submit", handleSubmit);