const roulette = document.getElementById('roulette');
const startBtn = document.getElementById('start-roulette');
const coinsEl = document.getElementById('coins');
const resultBox = document.createElement('div'); // Блок для результата
resultBox.style.marginTop = "20px";
resultBox.style.fontSize = "1.5rem";
resultBox.style.fontWeight = "bold";
document.querySelector('main').appendChild(resultBox);

const skins = [
    'static/images/skins/skin1.jpg','static/images/skins/skin2.jpg','static/images/skins/skin3.jpg',
    'static/images/skins/skin4.jpg','static/images/skins/skin5.jpg','static/images/skins/skin6.jpg',
    'static/images/skins/skin7.jpg','static/images/skins/skin8.jpg','static/images/skins/skin9.jpg',
    'static/images/skins/skin10.jpg'
];

// Цены задаём в соответствии с вероятностями выигрыша на сервере
// Низкая ценность (~60%): 50–800
// Средняя (~20%): 1100–1500
// Высокая (~15%): 2000–3000
// Джекпот (~5%): 8000–12000
const priceBuckets = [
  { min: 50, max: 800, weight: 0.60 },
  { min: 1100, max: 1500, weight: 0.20 },
  { min: 2000, max: 3000, weight: 0.15 },
  { min: 8000, max: 12000, weight: 0.05 },
];

function chooseBucket() {
  const r = Math.random();
  let acc = 0;
  for (const b of priceBuckets) {
    acc += b.weight;
    if (r < acc) return b;
  }
  return priceBuckets[0];
}

let skinPrices = {};
skins.forEach(skin => {
  const b = chooseBucket();
  skinPrices[skin] = Math.floor(Math.random() * (b.max - b.min + 1)) + b.min;
});

function shuffleArray(array) {
    return array.sort(() => Math.random() - 0.5);
}

function initRoulette() {
    roulette.innerHTML = '';
    const shuffled = shuffleArray([...skins, ...skins, ...skins]); // дублируем для плавного цикла
    shuffled.forEach(skin => {
        const img = document.createElement('img');
        img.src = skin;
        img.dataset.skin = skin;
        img.style.width = "100px";
        img.style.height = "100px";
        img.style.margin = "5px";
        img.style.borderRadius = "8px";
        img.style.transition = "transform 0.3s ease";
        roulette.appendChild(img);
    });
}

let speed = 2;
let animId;
let currentOffset = 0;

function startRoulette() {
    currentOffset = 0;
    let offset = 0;
    let images = Array.from(roulette.querySelectorAll('img'));

    function loop() {
        offset += speed;
        currentOffset = offset;

        if (offset >= images[0].offsetWidth + 10) {
            offset -= images[0].offsetWidth + 10;
            const first = images.shift();
            roulette.appendChild(first);
            images.push(first);
        }

        images.forEach(img => {
            img.style.transform = `translateX(-${offset}px)`;
        });

        animId = requestAnimationFrame(loop);
    }

    loop();

    // Ускорение
    let accel = 0.5;
    const accelInterval = setInterval(() => {
        speed += accel;
        accel *= 0.95;
        if (accel < 0.02) clearInterval(accelInterval);
    }, 30);

    // Замедление
    setTimeout(() => {
        const decelInterval = setInterval(() => {
            speed *= 0.95;
            if (speed < 0.5) {
                cancelAnimationFrame(animId);
                clearInterval(decelInterval);
                // Окончание прокрутки. Победителя определим позже в startSpin
            }
        }, 30);
    }, 4000);
}

function highlightWinner() { /* логика перенесена в startSpin */ }

// Конфетти
function launchConfetti() {
    const duration = 2 * 1000;
    const end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    })();
}

startBtn.addEventListener('click', () => {
    // Сначала списываем стоимость на сервере, потом запускаем анимацию и зачисление выигрыша
    startSpin();
});

window.onload = initRoulette;

async function refreshCoins() {
    try {
        const res = await fetch('/api/coins');
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok) coinsEl.textContent = data.coins;
    } catch(e) {}
}

async function startSpin() {
    // Пытаемся списать стоимость спина на сервере
    try {
        const res = await fetch('/api/spin_start', { method: 'POST' });
        const data = await res.json();
        if (!res.ok || !data.ok) {
            alert(data && data.error === 'not_enough_coins' ? 'Недостаточно монет (1000)' : 'Ошибка');
            return;
        }
        if (coinsEl) coinsEl.textContent = data.coins;
    } catch(e) {
        alert('Ошибка сети');
        return;
    }

    // Сброс визуала
    resultBox.innerHTML = '';
    const images = Array.from(roulette.querySelectorAll('img'));
    images.forEach(img => {
        img.style.border = 'none';
        img.style.boxShadow = 'none';
        img.style.transform = 'translateX(0)';
    });
    speed = 2;
    startRoulette();

    // Примерно через 5-6 секунд получим победителя и отправим цену на сервер
    setTimeout(async () => {
        const imagesNow = Array.from(roulette.querySelectorAll('img'));
        const container = roulette.getBoundingClientRect();
        const centerX = container.left + container.width / 2;
        let winner = null;
        let closest = Infinity;
        imagesNow.forEach(img => {
            const rect = img.getBoundingClientRect();
            const mid = rect.left + rect.width / 2;
            const d = Math.abs(centerX - mid);
            if (d < closest) { closest = d; winner = img; }
        });
        let win = 0;
        if (winner) {
            const skinName = winner.dataset.skin;
            win = skinPrices[skinName] || 0;
        }
        try {
            const res = await fetch('/api/spin_finish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ win })
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                alert('Ошибка спина');
                return;
            }
            // Сервер подтвердил: обновим баланс и отрисуем результат
            if (winner) {
                winner.style.border = '4px solid gold';
                winner.style.boxShadow = '0 0 20px gold';
                winner.style.transform += ' scale(1.2)';
            }
            resultBox.innerHTML = `🎉 Выпал скин за <span style=\"color:gold\">${data.win} калабанкоинов</span>. Баланс: ${data.coins}`;
            if (coinsEl) coinsEl.textContent = data.coins;
            launchConfetti();
            // Проигрываем звук победы
const winSound = document.getElementById("win-sound");
if (winSound) {
    winSound.currentTime = 0; // перемотка на начало
    winSound.play().catch(e => console.log("Автозапуск звука заблокирован:", e));
}

        } catch(e) {
            alert('Ошибка сети');
        }
    }, 5200);
}

refreshCoins();
