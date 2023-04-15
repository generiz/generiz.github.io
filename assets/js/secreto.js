const konamiCode = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
let konamiIndex = 0;

document.addEventListener("keydown", (event) => {
  if (event.keyCode === konamiCode[konamiIndex]) {
    konamiIndex++;
    if (konamiIndex === konamiCode.length) {
      showGameConsole();
      konamiIndex = 0;
    }
  } else {
    konamiIndex = 0;
  }
});

function showGameConsole() {
  const gameConsole = document.getElementById("game-console");
  gameConsole.style.display = "block";
}
document.querySelector('.close').addEventListener('click', function() {
    document.getElementById('game-console').style.display = 'none';
  });
