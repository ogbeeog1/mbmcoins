// Кнопка би-бу
const bibubbe = document.getElementById('bibubbe');
const audio = document.getElementById('ggg');
let isPlaying = false;

bibubbe.addEventListener('click', () => {
    if (isPlaying) {
        audio.pause();
        isPlaying = false;
        bibubbe.textContent = "Би-бу-бэ-би-би-бу-бу"; 
    } else {
        audio.play();
        isPlaying = true;
        bibubbe.textContent = "Пауза"; 
    }
});
