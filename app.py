from flask import Flask, render_template, request, redirect, session, jsonify, url_for
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
import os
import random

app = Flask(__name__)
app.secret_key = 'secret_key_here'

DB_PATH = os.path.join(os.path.dirname(__file__), 'users.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Обеспечиваем наличие нужной схемы БД (таблица users и колонка coins)
def ensure_schema():
    conn = get_db_connection()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    # Проверяем наличие coins
    cur = conn.execute('PRAGMA table_info(users)')
    columns = [row['name'] for row in cur.fetchall()]
    if 'coins' not in columns:
        conn.execute('ALTER TABLE users ADD COLUMN coins INTEGER NOT NULL DEFAULT 0')
        conn.commit()
    if 'click_level' not in columns:
        conn.execute('ALTER TABLE users ADD COLUMN click_level INTEGER NOT NULL DEFAULT 0')
        conn.commit()
    if 'autoclickers' not in columns:
        conn.execute('ALTER TABLE users ADD COLUMN autoclickers INTEGER NOT NULL DEFAULT 0')
        conn.commit()
    conn.close()

ensure_schema()

# Главная страница
@app.route('/')
def index():
    conn = get_db_connection()

    top_users = conn.execute("""
        SELECT username, coins 
        FROM users 
        ORDER BY coins DESC 
        LIMIT 10
    """).fetchall()

    conn.close()

    return render_template(
        "index22.html",
        top_users=top_users,
        user=session.get("username")
    )


# Логин
@app.route('/login', methods=['GET', 'POST'])
def login():
    error = ''
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        conn.close()
        if user and check_password_hash(user['password'], password):
            session['username'] = username
            return redirect('/')
        else:
            error = 'Неверные данные'
    return render_template('login.html', error=error)

# Регистрация
@app.route('/register', methods=['POST'])
def register():
    username = request.form['username']
    password = request.form['password']
    hashed_pw = generate_password_hash(password)
    conn = get_db_connection()
    try:
        conn.execute('INSERT INTO users (username, password, coins, click_level, autoclickers) VALUES (?, ?, 0, 0, 0)', (username, hashed_pw))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return render_template('login.html', error='Пользователь уже существует')
    conn.close()
    return redirect('/login')

# Выход
@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect('/')

# Остальные страницы
@app.route('/roulette')
def roulette():
    username = session.get('username')
    coins = 0
    if username:
        conn = get_db_connection()
        row = conn.execute('SELECT coins FROM users WHERE username = ?', (username,)).fetchone()
        conn.close()
        coins = row['coins'] if row else 0
    return render_template('roulette.html', user=username, coins=coins)

@app.route('/click')
def click():
    username = session.get('username')
    coins = 0
    click_level = 0
    autoclickers = 0
    if username:
        conn = get_db_connection()
        row = conn.execute('SELECT coins, click_level, autoclickers FROM users WHERE username = ?', (username,)).fetchone()
        conn.close()
        if row:
            coins = row['coins']
            click_level = row['click_level']
            autoclickers = row['autoclickers']
    return render_template('click.html', user=username, coins=coins, click_level=click_level, autoclickers=autoclickers)

@app.route('/rozigryshi')
def rozigryshi():
    username = session.get('username')
    coins = 0
    if username:
        conn = get_db_connection()
        row = conn.execute('SELECT coins FROM users WHERE username = ?', (username,)).fetchone()
        conn.close()
        coins = row['coins'] if row else 0
    return render_template('Розыгрыши.html', user=username, coins=coins)

@app.route('/stati')
def stati():
    username = session.get('username')
    coins = 0
    if username:
        conn = get_db_connection()
        row = conn.execute('SELECT coins FROM users WHERE username = ?', (username,)).fetchone()
        conn.close()
        coins = row['coins'] if row else 0
    return render_template('статьи.html', user=username, coins=coins)

# API: получить текущий баланс
@app.route('/api/coins', methods=['GET'])
def get_coins():
    username = session.get('username')
    if not username:
        return jsonify({ 'ok': False, 'error': 'unauthorized' }), 401
    conn = get_db_connection()
    row = conn.execute('SELECT coins FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    return jsonify({ 'ok': True, 'coins': row['coins'] if row else 0 })

# API: добавить монеты за клик
@app.route('/api/click', methods=['POST'])
def api_click():
    username = session.get('username')
    if not username:
        return jsonify({ 'ok': False, 'error': 'unauthorized' }), 401
    try:
        amount = int(request.json.get('amount', 1))
    except Exception:
        return jsonify({ 'ok': False, 'error': 'invalid amount' }), 400
    # Ограничим размер одной операции, чтобы избежать злоупотребления
    if abs(amount) > 100000:
        return jsonify({ 'ok': False, 'error': 'amount_too_large' }), 400
    conn = get_db_connection()
    # Если списываем, проверим баланс
    if amount < 0:
        row = conn.execute('SELECT coins FROM users WHERE username = ?', (username,)).fetchone()
        current = row['coins'] if row else 0
        if current + amount < 0:
            conn.close()
            return jsonify({ 'ok': False, 'error': 'not_enough_coins' }), 400
    conn.execute('UPDATE users SET coins = coins + ? WHERE username = ?', (amount, username))
    conn.commit()
    row = conn.execute('SELECT coins FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    return jsonify({ 'ok': True, 'coins': row['coins'] })

SPIN_COST = 1000

# API: начать спин — сразу списать стоимость прокрута
@app.route('/api/spin_start', methods=['POST'])
def api_spin_start():
    username = session.get('username')
    if not username:
        return jsonify({ 'ok': False, 'error': 'unauthorized' }), 401
    # Цена прокрута
    conn = get_db_connection()
    row = conn.execute('SELECT coins FROM users WHERE username = ?', (username,)).fetchone()
    if not row or row['coins'] < SPIN_COST:
        conn.close()
        return jsonify({ 'ok': False, 'error': 'not_enough_coins' }), 400
    # Списываем стоимость
    conn.execute('UPDATE users SET coins = coins - ? WHERE username = ?', (SPIN_COST, username))
    conn.commit()
    new_row = conn.execute('SELECT coins FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    # Помечаем спин как начатый, чтобы засчитать только один finish
    session['spin_in_progress'] = True
    return jsonify({ 'ok': True, 'coins': new_row['coins'], 'cost': SPIN_COST })

# API: завершить спин — зачесть выигрыш (сервер проверит диапазон)
@app.route('/api/spin_finish', methods=['POST'])
def api_spin_finish():
    username = session.get('username')
    if not username:
        return jsonify({ 'ok': False, 'error': 'unauthorized' }), 401
    # Проверяем, что был вызван start
    if not session.pop('spin_in_progress', False):
        return jsonify({ 'ok': False, 'error': 'spin_not_started' }), 400
    try:
        win = int(request.json.get('win', 0))
    except Exception:
        return jsonify({ 'ok': False, 'error': 'invalid_win' }), 400
    # Допустимые пределы выигрыша
    if win < 0:
        win = 0
    if win > 12000:
        win = 12000
    conn = get_db_connection()
    conn.execute('UPDATE users SET coins = coins + ? WHERE username = ?', (win, username))
    conn.commit()
    new_row = conn.execute('SELECT coins FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    return jsonify({ 'ok': True, 'coins': new_row['coins'], 'win': win })

# API: покупка улучшения клика (+5 за клик)
@app.route('/api/buy_upgrade', methods=['POST'])
def api_buy_upgrade():
    username = session.get('username')
    if not username:
        return jsonify({ 'ok': False, 'error': 'unauthorized' }), 401
    UPGRADE_COST = 50
    conn = get_db_connection()
    row = conn.execute('SELECT coins, click_level FROM users WHERE username = ?', (username,)).fetchone()
    if not row or row['coins'] < UPGRADE_COST:
        conn.close()
        return jsonify({ 'ok': False, 'error': 'not_enough_coins' }), 400
    conn.execute('UPDATE users SET coins = coins - ?, click_level = click_level + 1 WHERE username = ?', (UPGRADE_COST, username))
    conn.commit()
    new_row = conn.execute('SELECT coins, click_level FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    return jsonify({ 'ok': True, 'coins': new_row['coins'], 'click_level': new_row['click_level'] })

# API: покупка автокликера (+1/сек)
@app.route('/api/buy_autoclicker', methods=['POST'])
def api_buy_autoclicker():
    username = session.get('username')
    if not username:
        return jsonify({ 'ok': False, 'error': 'unauthorized' }), 401
    AUTOCLICK_COST = 100
    conn = get_db_connection()
    row = conn.execute('SELECT coins, autoclickers FROM users WHERE username = ?', (username,)).fetchone()
    if not row or row['coins'] < AUTOCLICK_COST:
        conn.close()
        return jsonify({ 'ok': False, 'error': 'not_enough_coins' }), 400
    conn.execute('UPDATE users SET coins = coins - ?, autoclickers = autoclickers + 1 WHERE username = ?', (AUTOCLICK_COST, username))
    conn.commit()
    new_row = conn.execute('SELECT coins, autoclickers FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    return jsonify({ 'ok': True, 'coins': new_row['coins'], 'autoclickers': new_row['autoclickers'] })

if __name__ == '__main__':
    app.run(debug=True)