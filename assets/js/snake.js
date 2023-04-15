// snake.js
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gridSize = 20;
const gridCount = canvas.width / gridSize;

let snake;
let food;
let dx;
let dy;
let interval;

function startGame() {
  snake = [{ x: gridSize * Math.floor(gridCount / 2), y: gridSize * Math.floor(gridCount / 2) }];
  food = newFood();
  dx = gridSize;
  dy = 0;

  clearInterval(interval);
  interval = setInterval(moveSnake, 100);
}

function newFood() {
  return {
    x: gridSize * Math.floor(Math.random() * gridCount),
    y: gridSize * Math.floor(Math.random() * gridCount),
  };
}

function moveSnake() {
  const head = { x: snake[0].x + dx, y: snake[0].y + dy };

  if (head.x === food.x && head.y === food.y) {
    food = newFood();
  } else {
    snake.pop();
  }

  snake.unshift(head);

  if (collision(head)) {
    startGame();
  }

  draw();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "green";
  for (const segment of snake) {
    ctx.fillRect(segment.x, segment.y, gridSize, gridSize);
  }

  ctx.fillStyle = "red";
  ctx.fillRect(food.x, food.y, gridSize, gridSize);
}

function collision(head) {
  if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) {
    return true;
  }

  for (const segment of snake.slice(1)) {
    if (head.x === segment.x && head.y === segment.y) {
      return true;
    }
  }

  return false;
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp" && dy === 0) {
    dx = 0;
    dy = -gridSize;
  } else if (event.key === "ArrowDown" && dy === 0) {
    dx = 0;
    dy = gridSize;
  } else if (event.key === "ArrowLeft" && dx === 0) {
    dx = -gridSize;
    dy = 0;
  } else if (event.key === "ArrowRight" && dx === 0) {
    dx = gridSize;
    dy = 0;
  }
});

startGame();
