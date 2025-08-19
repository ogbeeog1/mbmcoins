import sqlite3

conn = sqlite3.connect('users.db')
c = conn.cursor()

c.execute("SELECT username, coins, click_level, autoclickers FROM users")
users = c.fetchall()

print("Баланс пользователей:")
for user in users:
    username, coins, click_level, autoclickers = user
    print(f"{username}: {coins} калабанкоинов, клик {click_level}, автокликеров {autoclickers}")

conn.close()
