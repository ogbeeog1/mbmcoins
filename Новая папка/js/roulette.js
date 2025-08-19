// В файле roulette.js замените начало кода на:
document.addEventListener('DOMContentLoaded', function() {
    const rouletteContainer = document.querySelector('.roulette-container');
    if (!rouletteContainer) return;
    
    // Остальной код roulette.js...
});
const roulette = document.getElementById('roulette');
const startBtn = document.getElementById('start-roulette');
const resultBox = document.createElement('div'); // Блок для результата
resultBox.style.marginTop = "20px";
resultBox.style.fontSize = "1.5rem";
resultBox.style.fontWeight = "bold";
document.querySelector('main').appendChild(resultBox);

const skins = [
    'images/skins/skin1.jpg','images/skins/skin2.jpg','images/skins/skin3.jpg',
    'images/skins/skin4.jpg','images/skins/skin5.jpg','images/skins/skin6.jpg',
    'images/skins/skin7.jpg','images/skins/skin8.jpg','images/skins/skin9.jpg',
    'images/skins/skin10.jpg'
];

// Случайные цены
let skinPrices = {};
skins.forEach(skin => {
    skinPrices[skin] = Math.floor(Math.random() * (5000 - 50) + 50); // 50–5000₽
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
                highlightWinner();
            }
        }, 30);
    }, 4000);
}

function highlightWinner() {
    const images = Array.from(roulette.querySelectorAll('img'));
    const container = roulette.getBoundingClientRect();
    const centerX = container.left + container.width / 2;

    let winner = null;
    let closestDistance = Infinity;

    images.forEach(img => {
        const rect = img.getBoundingClientRect();
        const imgCenter = rect.left + rect.width / 2;
        const distance = Math.abs(centerX - imgCenter);
        if (distance < closestDistance) {
            closestDistance = distance;
            winner = img;
        }
    });

    if (winner) {
        winner.style.border = '4px solid gold';
        winner.style.boxShadow = '0 0 20px gold';
        winner.style.transform += ' scale(1.2)';

        // Цена
        const skinName = winner.dataset.skin;
        const price = skinPrices[skinName];
        resultBox.innerHTML = `🎉 Выпал скин за <span style="color:gold">${price}₽</span>`;

        // Конфетти 🎉
        launchConfetti();
    }
}

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
    // Сброс
    resultBox.innerHTML = '';
    const images = Array.from(roulette.querySelectorAll('img'));
    images.forEach(img => {
        img.style.border = 'none';
        img.style.boxShadow = 'none';
        img.style.transform = 'translateX(0)';
    });
    speed = 2;
    startRoulette();
});

window.onload = initRoulette;
