import sqlite3

conn = sqlite3.connect('users.db')
c = conn.cursor()

c.execute('''
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
)
''')
conn.commit()

# Добавляем колонку для КАЛАБАНКОИНОВ, если её ещё нет
c.execute("PRAGMA table_info(users)")
columns = [row[1] for row in c.fetchall()]
if 'coins' not in columns:
    c.execute("ALTER TABLE users ADD COLUMN coins INTEGER NOT NULL DEFAULT 0")
    conn.commit()

conn.close()
