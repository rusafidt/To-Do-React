'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function safeUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now()) + Math.random().toString(16).slice(2);
}

const STORAGE_KEY = 'next_todo_tasks_v2'; // bump version due to new fields

export default function HomePage() {
  const [tasks, setTasks] = useState([]);
  const [text, setText] = useState('');
  const [priority, setPriority] = useState('medium'); // low | medium | high
  const [due, setDue] = useState('');                 // yyyy-mm-dd
  const [filter, setFilter] = useState('all');        // all | active | done
  const [sortIncompleteFirst, setSortIncompleteFirst] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [q, setQ] = useState('');

  const addRef = useRef(null);
  const searchRef = useRef(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTasks(JSON.parse(raw));
    } catch {}
  }, []);

  // Save to localStorage whenever tasks change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {}
  }, [tasks]);

  // Keyboard shortcuts: Ctrl+N (new), Ctrl+K (search)
  useEffect(() => {
    function onKey(e) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        addRef.current?.focus();
      }
      if (ctrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const activeCount = useMemo(() => tasks.filter(t => !t.done).length, [tasks]);
  const doneCount = tasks.length - activeCount;
  const completionPct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  // helpers
  function isOverdue(t) {
    if (!t.due || t.done) return false;
    try { return new Date(t.due) < new Date(new Date().toDateString()); } catch { return false; }
  }

  // Filter + search + sort
  const filtered = useMemo(() => {
    let list = tasks;

    if (filter === 'active') list = list.filter(t => !t.done);
    if (filter === 'done') list = list.filter(t => t.done);

    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter(t => t.text.toLowerCase().includes(needle));

    // Sort: incomplete first, then by due date (earliest), then priority, then createdAt desc
    function prioRank(p) { return p === 'high' ? 0 : p === 'medium' ? 1 : 2; }
    list = [...list].sort((a, b) => {
      if (sortIncompleteFirst) {
        if (a.done !== b.done) return a.done ? 1 : -1;
      }
      // earliest due first (empty due goes last)
      if (a.due || b.due) {
        if (!a.due) return 1;
        if (!b.due) return -1;
        const ad = a.due.localeCompare(b.due);
        if (ad !== 0) return ad;
      }
      // higher priority first
      const ap = prioRank(a.priority || 'medium') - prioRank(b.priority || 'medium');
      if (ap !== 0) return ap;

      // newest first
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    return list;
  }, [tasks, filter, q, sortIncompleteFirst]);

  function addTask() {
    const t = text.trim();
    if (!t) return;
    const newTask = {
      id: safeUUID(),
      text: t,
      done: false,
      priority,
      due: due || '',         // yyyy-mm-dd
      createdAt: Date.now()
    };
    setTasks(prev => [newTask, ...prev]);
    setText('');
    setDue('');
    setPriority('medium');
    addRef.current?.focus();
  }

  function toggleTask(id) {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function removeTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  function beginEdit(task) {
    setEditingId(task.id);
    setEditText(task.text);
  }

  function commitEdit() {
    const t = editText.trim();
    if (!t) { setEditingId(null); return; }
    setTasks(prev => prev.map(x => x.id === editingId ? { ...x, text: t } : x));
    setEditingId(null);
    setEditText('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText('');
  }

  function clearCompleted() {
    setTasks(prev => prev.filter(t => !t.done));
  }

  function clearAll() {
    if (!confirm('Clear ALL tasks? This cannot be undone.')) return;
    setTasks([]);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') addTask();
  }

  // Export / Import
  function exportJSON() {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'tasks-export.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data)) throw new Error('Invalid file');
        // Basic shape check
        const sanitized = data.map(t => ({
          id: t.id || safeUUID(),
          text: String(t.text || '').slice(0, 500),
          done: !!t.done,
          priority: ['low','medium','high'].includes(t.priority) ? t.priority : 'medium',
          due: t.due || '',
          createdAt: Number(t.createdAt) || Date.now()
        }));
        setTasks(sanitized);
      } catch {
        alert('Invalid JSON file.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <div className="title">Next To-Do</div>
        <div className="badge">{activeCount} active • {doneCount} done</div>
      </div>

      {/* Add row */}
      <div className="row" aria-label="Add task">
        <input
          ref={addRef}
          className="input"
          placeholder="Add a task… (Enter)"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Task text"
        />

        <select
          className="select"
          value={priority}
          onChange={e => setPriority(e.target.value)}
          aria-label="Priority"
        >
          <option value="low">Low ⬇</option>
          <option value="medium">Medium •</option>
          <option value="high">High ⬆</option>
        </select>

        <input
          type="date"
          className="date"
          value={due}
          onChange={e => setDue(e.target.value)}
          aria-label="Due date"
        />

        <button className="btn" onClick={addTask}>Add</button>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="filters" role="tablist" aria-label="Filters">
          {['all','active','done'].map(f => (
            <button
              key={f}
              className={`filter ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
              role="tab"
              aria-selected={filter === f}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button
            className={`filter ${sortIncompleteFirst ? 'active' : ''}`}
            onClick={() => setSortIncompleteFirst(s => !s)}
            title="Toggle sort: incomplete first"
          >
            Sort: Incomplete first
          </button>
        </div>

        <div className="tools">
          <input
            ref={searchRef}
            className="search"
            placeholder="Search tasks… (Ctrl+K)"
            value={q}
            onChange={e => setQ(e.target.value)}
            aria-label="Search tasks"
          />
          <button className="btn ghost small" onClick={clearCompleted} disabled={doneCount === 0}>
            Clear completed
          </button>
          <button className="btn ghost small" onClick={clearAll} disabled={tasks.length === 0}>
            Clear all
          </button>
          <button className="btn ghost small" onClick={exportJSON} disabled={tasks.length === 0}>
            Export JSON
          </button>
          <label className="btn ghost small" style={{ cursor: 'pointer' }}>
            Import JSON
            <input type="file" accept="application/json" onChange={importJSON} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* List */}
      <div className="list">
        {filtered.length === 0 ? (
          <div className="muted">No matching tasks — try a different search or add one above.</div>
        ) : filtered.map(task => (
          <div className="item" key={task.id}>
            <input
              type="checkbox"
              className="checkbox"
              checked={task.done}
              onChange={() => toggleTask(task.id)}
              aria-label={task.done ? 'Mark as not done' : 'Mark as done'}
            />

            {editingId === task.id ? (
              <input
                className="input"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                autoFocus
                aria-label="Edit task text"
              />
            ) : (
              <div>
                <div className={`text ${task.done ? 'done' : ''}`}>
                  {task.text}
                </div>
                <div className="meta">
                  <span className={`pill ${task.priority}`}>{task.priority}</span>
                  {task.due && (
                    <span className={`pill ${isOverdue(task) ? 'overdue' : ''}`}>
                      Due: {task.due}{isOverdue(task) ? ' • overdue' : ''}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="itemActions">
              {editingId === task.id ? (
                <>
                  <button className="btn small" onClick={commitEdit}>Save</button>
                  <button className="btn ghost small" onClick={cancelEdit}>Cancel</button>
                </>
              ) : (
                <>
                  <button className="btn ghost small" onClick={() => beginEdit(task)}>Edit</button>
                  <button className="btn ghost small" onClick={() => removeTask(task.id)}>Delete</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Stats */}
      <div className="footer">
        <span className="muted">
          {tasks.length} total • Saved locally • Shortcuts: <span className="kbd">Ctrl+N</span> add, <span className="kbd">Ctrl+K</span> search
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="muted">Done {completionPct}%</span>
          <div className="progressWrap" aria-hidden="true">
            <div className="progressBar" style={{ width: `${completionPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
