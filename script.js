// --- Game Assets and Configuration ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Screens
const homeScreen = document.getElementById('home-screen');
const mainGameScreen = document.getElementById('main-game-screen');
const skinsScreen = document.getElementById('skins-screen');
const tutorialScreen = document.getElementById('tutorial-screen');
const gameOverScreen = document.getElementById('game-over-screen');

// UI Elements
const scoreDisplay = document.getElementById('scoreDisplay');
const healthDisplay = document.getElementById('healthDisplay');
const finalScoreDisplay = document.getElementById('finalScoreDisplay');
const skinSelectionContainer = document.getElementById('skin-selection');
const tutorialMessage = document.getElementById('tutorial-message');
const nextTutorialButton = document.getElementById('nextTutorialButton');

// Buttons
const startButton = document.getElementById('startButton');
const skinsButton = document.getElementById('skinsButton');
const tutorialButton = document.getElementById('tutorialButton');
const backToHomeButtonFromSkins = document.getElementById('backToHomeFromSkinsButton');
const backToHomeButtonFromTutorial = document.getElementById('backFromTutorialButton');
const restartButton = document.getElementById('restartButton');
const backToHomeButtonFromGameOver = document.getElementById('backToHomeFromGameOverButton');

// Mobile Controls
const mobileControls = document.getElementById('mobile-controls');
const jumpButton = document.getElementById('jumpButton');
const slideButton = document.getElementById('slideButton');

// Game Settings
canvas.width = 800;
canvas.height = 600;
const GRAVITY = 0.8;
let gameSpeed = 5; // Initial scrolling speed
const INITIAL_PLAYER_HEALTH = 100;
let gameRunning = false;
let gamePaused = false; // For tutorial
let currentFrame = 0; // For animations

// --- Game Objects ---
let player = {};
let platforms = [];
let obstacles = []; // Spikes, low blockers
let collectibles = []; // Coins

// Player States
const PLAYER_STATE = {
    IDLE: 'idle',
    JUMPING: 'jumping',
    SLIDING: 'sliding'
};

// --- Asset Loading ---
const ASSET_PATHS = {
    // Basic shared assets
    coin: 'assets/coin.png',
    spike: 'assets/spike.png',
    blocker: 'assets/blocker.png',

    // Classic Skin
    player_classic_idle: 'assets/player_idle.png',
    player_classic_jump: 'assets/player_jump.png',
    player_classic_slide: 'assets/player_slide.png',
    enemy_classic: 'assets/enemy_basic.png',
    ground_classic: 'assets/ground_default.png',
    preview_classic: 'assets/preview_classic.png',

    // Desert Skin (Example)
    player_desert_idle: 'assets/player_desert_idle.png', // Create these images!
    player_desert_jump: 'assets/player_desert_jump.png',
    player_desert_slide: 'assets/player_desert_slide.png',
    enemy_desert: 'assets/enemy_scorpion.png', // Create this image!
    ground_desert: 'assets/ground_desert.png',
    preview_desert: 'assets/preview_desert.png',
};

const images = {}; // To store loaded Image objects

// Define Skins (match ASSET_PATHS keys)
const availableSkins = [
    {
        id: 'classic',
        name: 'Classic Runner',
        player: { idle: 'player_classic_idle', jump: 'player_classic_jump', slide: 'player_classic_slide' },
        enemy: 'enemy_classic',
        ground: 'ground_classic',
        coin: 'coin',
        spike: 'spike',
        blocker: 'blocker',
        preview: 'preview_classic'
    },
    {
        id: 'desert',
        name: 'Desert Explorer',
        player: { idle: 'player_desert_idle', jump: 'player_desert_jump', slide: 'player_desert_slide' },
        enemy: 'enemy_desert',
        ground: 'ground_desert',
        coin: 'coin', // Can reuse general assets
        spike: 'spike',
        blocker: 'blocker',
        preview: 'preview_desert'
    }
    // Add more skins here!
];

let currentSkin = availableSkins[0]; // Default skin

async function loadAssets() {
    const promises = [];
    for (const key in ASSET_PATHS) {
        const img = new Image();
        img.src = ASSET_PATHS[key];
        images[key] = img; // Store image object
        promises.push(new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => {
                console.warn(`Failed to load image: ${ASSET_PATHS[key]}. Using fallback color.`);
                // Set a placeholder color for drawing if image fails
                images[key] = null; // Mark as failed to load
                resolve(); // Resolve anyway so game can start
            };
        }));
    }
    await Promise.all(promises);
    console.log("All assets loaded or failed gracefully.");
}

function getImage(assetKey) {
    return images[currentSkin[assetKey]] || images[assetKey] || null;
}

// --- Player Class (or Object) ---
function createPlayer() {
    return {
        x: 100,
        y: canvas.height - 150, // Initial position, standing on ground
        width: 60,
        height: 100,
        dy: 0,
        score: 0,
        health: INITIAL_PLAYER_HEALTH,
        isJumping: false,
        isSliding: false,
        slideTimer: 0,
        maxSlideTime: 60, // frames
        jumpForce: -18,
        state: PLAYER_STATE.IDLE,
        originalHeight: 100, // Used for slide transformations
        originalY: canvas.height - 150 // Used for slide transformations
    };
}

function drawPlayer() {
    const img = getImage(currentSkin.player[player.state]);

    if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, player.x, player.y, player.width, player.height);
    } else {
        // Fallback to drawing a colored rectangle
        ctx.fillStyle = '#ff6347'; // Default player color
        if (player.state === PLAYER_STATE.SLIDING) {
            ctx.fillStyle = '#ff9933'; // Sliding color
        }
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }
}

function updatePlayer() {
    // Apply gravity
    player.dy += GRAVITY;
    player.y += player.dy;

    // Check ground collision
    const groundLevel = canvas.height - 50 - player.height; // Adjust for player height and ground
    if (player.y >= groundLevel) {
        player.y = groundLevel;
        player.dy = 0;
        player.isJumping = false;
        if (player.state !== PLAYER_STATE.SLIDING) {
            player.state = PLAYER_STATE.IDLE;
        }
    }

    // Handle sliding
    if (player.isSliding) {
        player.slideTimer--;
        // Temporarily adjust player's dimensions for sliding
        player.height = player.originalHeight / 2;
        player.y = player.originalY + player.originalHeight / 2; // Move player down to slide
        if (player.slideTimer <= 0) {
            player.isSliding = false;
            player.state = PLAYER_STATE.IDLE;
            player.height = player.originalHeight;
            player.y = player.originalY; // Reset player dimensions
        }
    }
}

function playerJump() {
    if (!player.isJumping && !player.isSliding && gameRunning) {
        player.dy = player.jumpForce;
        player.isJumping = true;
        player.state = PLAYER_STATE.JUMPING;
    }
}

function playerSlide() {
    if (!player.isSliding && !player.isJumping && gameRunning) {
        player.isSliding = true;
        player.state = PLAYER_STATE.SLIDING;
        player.slideTimer = player.maxSlideTime;
    }
}

// --- Level Generation & Objects ---

// Ground segments (for seamless scrolling)
let groundSegments = [];
const groundHeight = 50;

function createGroundSegment(x) {
    return {
        x: x,
        y: canvas.height - groundHeight,
        width: canvas.width / 2, // Each segment is half canvas width
        height: groundHeight,
        color: '#556b2f' // Dark Olive Green
    };
}

function generateInitialGround() {
    for (let i = 0; i < 3; i++) { // Enough segments to cover and extend
        groundSegments.push(createGroundSegment(i * (canvas.width / 2)));
    }
}

function updateGround() {
    for (let i = 0; i < groundSegments.length; i++) {
        groundSegments[i].x -= gameSpeed;
    }

    // Remove off-screen segments and add new ones
    if (groundSegments[0] && groundSegments[0].x + groundSegments[0].width < 0) {
        groundSegments.shift(); // Remove first segment
        groundSegments.push(createGroundSegment(groundSegments[groundSegments.length - 1].x + groundSegments[groundSegments.length - 1].width));
    }
}

function drawGround() {
    const groundImg = getImage(currentSkin.ground);
    groundSegments.forEach(segment => {
        if (groundImg && groundImg.complete && groundImg.naturalWidth > 0) {
            ctx.drawImage(groundImg, segment.x, segment.y, segment.width, segment.height);
        } else {
            ctx.fillStyle = segment.color;
            ctx.fillRect(segment.x, segment.y, segment.width, segment.height);
        }
    });
}

// Obstacles (Spikes, Blockers, Enemies)
const OBSTACLE_TYPES = {
    SPIKE: 'spike',
    BLOCKER: 'blocker',
    ENEMY: 'enemy'
};

const OBSTACLE_CONFIG = {
    spike: { width: 40, height: 30, yOffset: 0, damage: 20 },
    blocker: { width: 60, height: 50, yOffset: 50, damage: 10 }, // Y offset means from player bottom, so this is a low obstacle
    enemy: { width: 50, height: 70, yOffset: 0, damage: 25 }
};

let lastObstacleX = canvas.width; // To ensure proper spacing

function generateObstacle() {
    const randomType = Object.keys(OBSTACLE_TYPES)[Math.floor(Math.random() * Object.keys(OBSTACLE_TYPES).length)];
    const config = OBSTACLE_CONFIG[randomType];

    let x = lastObstacleX + Math.random() * 200 + 150; // Random spacing between obstacles
    let y = canvas.height - groundHeight - config.height - config.yOffset; // Position on ground or slightly above

    // Ensure it's not too far
    if (x > canvas.width * 1.5) { // Cap max x to prevent excessively long empty stretches
        x = canvas.width + Math.random() * 100 + 50;
    }

    obstacles.push({
        x: x,
        y: y,
        width: config.width,
        height: config.height,
        type: randomType,
        damage: config.damage,
        hit: false // To prevent multiple hits from one collision
    });
    lastObstacleX = x + config.width;
}

function updateObstacles() {
    // Generate new obstacles if needed
    if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < canvas.width - 200) {
        generateObstacle();
    }

    // Update and remove obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= gameSpeed;

        // Collision detection with player
        if (!obstacles[i].hit && checkCollision(player, obstacles[i])) {
            // Specific collision logic
            let hit = false;
            if (obstacles[i].type === OBSTACLE_TYPES.SPIKE) {
                // Spikes are typically jumped over
                if (!player.isJumping) { // If not jumping, take damage
                    player.health -= obstacles[i].damage;
                    hit = true;
                }
            } else if (obstacles[i].type === OBSTACLE_TYPES.BLOCKER) {
                // Blockers are typically slid under
                if (!player.isSliding) { // If not sliding, take damage
                    player.health -= obstacles[i].damage;
                    hit = true;
                }
            } else if (obstacles[i].type === OBSTACLE_TYPES.ENEMY) {
                // Enemies can be jumped over or hit
                if (!player.isJumping) { // If not jumping, take damage
                    player.health -= obstacles[i].damage;
                    hit = true;
                } else {
                    // Jumped over enemy, perhaps gain a small bonus or just avoid damage
                    player.score += 10;
                }
            }

            if (hit) {
                obstacles[i].hit = true; // Mark as hit to prevent repeated damage
                if (player.health <= 0) {
                    player.health = 0;
                    endGame();
                }
            }
        }

        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1); // Remove off-screen obstacle
        }
    }
}

function drawObstacles() {
    obstacles.forEach(obs => {
        let img = null;
        let color = '#a0522d'; // Default obstacle color (Sienna)
        switch (obs.type) {
            case OBSTACLE_TYPES.SPIKE:
                img = getImage(currentSkin.spike);
                color = '#777'; // Gray for spikes
                break;
            case OBSTACLE_TYPES.BLOCKER:
                img = getImage(currentSkin.blocker);
                color = '#8b4513'; // SaddleBrown for blockers
                break;
            case OBSTACLE_TYPES.ENEMY:
                img = getImage(currentSkin.enemy);
                color = '#b22222'; // FireBrick for enemies
                break;
        }

        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, obs.x, obs.y, obs.width, obs.height);
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        }
    });
}

// Collectibles (Coins)
function generateCollectible(x, y) {
    collectibles.push({
        x: x,
        y: y,
        size: 20,
        value: 5,
        hit: false
    });
}

function generateCoinsAroundObstacle(obstacleX) {
    // Generate a few coins near an obstacle, potentially at different heights
    let numCoins = Math.floor(Math.random() * 3) + 1; // 1 to 3 coins
    for (let i = 0; i < numCoins; i++) {
        generateCollectible(
            obstacleX + i * 30 + (Math.random() * 20 - 10), // slight horizontal variation
            canvas.height - groundHeight - 100 - Math.random() * 50 // above ground, varied height
        );
    }
}

function updateCollectibles() {
    // Spawn coins alongside obstacles
    if (obstacles.length > 0 && !obstacles[obstacles.length - 1].coinsSpawned && obstacles[obstacles.length - 1].x < canvas.width - 300) {
        generateCoinsAroundObstacle(obstacles[obstacles.length - 1].x);
        obstacles[obstacles.length - 1].coinsSpawned = true; // Mark to prevent re-spawning
    }

    for (let i = collectibles.length - 1; i >= 0; i--) {
        collectibles[i].x -= gameSpeed;

        if (!collectibles[i].hit && checkCollision(player, { ...collectibles[i], width: collectibles[i].size, height: collectibles[i].size })) {
            player.score += collectibles[i].value;
            collectibles[i].hit = true; // Mark as hit
            collectibles.splice(i, 1); // Remove collected coin
        } else if (collectibles[i].x + collectibles[i].size < 0) {
            collectibles.splice(i, 1); // Remove off-screen coin
        }
    }
}

function drawCollectibles() {
    const coinImg = getImage(currentSkin.coin);
    collectibles.forEach(coin => {
        if (coinImg && coinImg.complete && coinImg.naturalWidth > 0) {
            ctx.drawImage(coinImg, coin.x, coin.y, coin.size, coin.size);
        } else {
            ctx.fillStyle = '#ffd700'; // Gold color for fallback
            ctx.beginPath();
            ctx.arc(coin.x + coin.size / 2, coin.y + coin.size / 2, coin.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

// --- Utility Functions ---
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Simple background
    ctx.fillStyle = '#87ceeb'; // Sky blue
    ctx.fillRect(0, 0, canvas.width, canvas.height - groundHeight);
}

function updateUI() {
    scoreDisplay.textContent = player.score;
    healthDisplay.textContent = player.health;
}

function showScreen(screenId) {
    const screens = document.querySelectorAll('.game-screen');
    screens.forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    // Manage mobile controls visibility
    if (screenId === 'main-game-screen') {
        mobileControls.style.display = 'flex';
    } else {
        mobileControls.style.display = 'none';
    }
}

// --- Game Loop ---
function gameLoop() {
    if (!gameRunning) return;
    if (gamePaused) { // Only update UI when paused, not game state
        requestAnimationFrame(gameLoop);
        return;
    }

    clearCanvas();

    updateGround();
    drawGround();

    updateObstacles();
    drawObstacles();

    updateCollectibles();
    drawCollectibles();

    updatePlayer();
    drawPlayer();

    updateUI();

    // Increase speed slightly over time
    gameSpeed += 0.0005;
    currentFrame++;

    requestAnimationFrame(gameLoop);
}

// --- Game State Management ---
function startGame() {
    player = createPlayer(); // Reset player state
    platforms = [];
    obstacles = [];
    collectibles = [];
    groundSegments = [];
    lastObstacleX = canvas.width; // Reset obstacle generation
    gameSpeed = 5; // Reset speed
    gameRunning = true;
    gamePaused = false;
    currentFrame = 0;

    generateInitialGround(); // Re-init ground

    showScreen('main-game-screen');
    gameLoop();
}

function endGame() {
    gameRunning = false;
    finalScoreDisplay.textContent = player.score;
    showScreen('game-over-screen');
}

// --- Tutorial System ---
let tutorialSteps = [
    { message: "Welcome to Parkour Runner!", action: null },
    { message: "Press JUMP to leap over obstacles.", action: 'jump' },
    { message: "Press SLIDE to duck under low obstacles.", action: 'slide' },
    { message: "Collect coins for points!", action: null },
    { message: "Avoid enemies and spikes!", action: null },
    { message: "Good luck, runner!", action: 'finish' }
];
let currentTutorialStepIndex = 0;

function startTutorial() {
    currentTutorialStepIndex = 0;
    showScreen('tutorial-screen');
    displayTutorialStep();
    gamePaused = true;
    gameRunning = true; // Start a "paused" game loop for visual context
    gameLoop(); // Ensure loop runs to draw background elements
}

function displayTutorialStep() {
    const step = tutorialSteps[currentTutorialStepIndex];
    tutorialMessage.textContent = step.message;

    if (step.action === 'finish') {
        nextTutorialButton.textContent = 'DONE';
        nextTutorialButton.classList.remove('hidden');
    } else if (step.action) {
        nextTutorialButton.classList.add('hidden'); // Hide until action is performed
    } else {
        nextTutorialButton.textContent = 'NEXT';
        nextTutorialButton.classList.remove('hidden');
    }
}

function nextTutorialStep() {
    currentTutorialStepIndex++;
    if (currentTutorialStepIndex < tutorialSteps.length) {
        displayTutorialStep();
    } else {
        exitTutorial();
    }
}

function exitTutorial() {
    gamePaused = false;
    gameRunning = false; // Stop the paused game loop
    showScreen('home-screen');
}

// --- Skin Selection ---
function populateSkins() {
    skinSelectionContainer.innerHTML = ''; // Clear previous options
    availableSkins.forEach(skin => {
        const div = document.createElement('div');
        div.classList.add('skin-option');
        if (currentSkin.id === skin.id) {
            div.classList.add('selected');
        }

        const img = new Image();
        img.src = ASSET_PATHS[skin.preview];
        img.alt = skin.name;
        img.onerror = () => { img.src = ''; img.style.backgroundColor = '#888'; }; // Fallback if preview fails

        const p = document.createElement('p');
        p.textContent = skin.name;

        div.appendChild(img);
        div.appendChild(p);
        div.addEventListener('click', () => {
            currentSkin = skin;
            // Update selected class
            document.querySelectorAll('.skin-option').forEach(opt => opt.classList.remove('selected'));
            div.classList.add('selected');
            console.log(`Selected skin: ${currentSkin.name}`);
        });
        skinSelectionContainer.appendChild(div);
    });
}

// --- Event Listeners ---
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);

skinsButton.addEventListener('click', () => {
    populateSkins();
    showScreen('skins-screen');
});
backToHomeButtonFromSkins.addEventListener('click', () => showScreen('home-screen'));

tutorialButton.addEventListener('click', startTutorial);
nextTutorialButton.addEventListener('click', nextTutorialStep);
backToHomeButtonFromTutorial.addEventListener('click', exitTutorial);

backToHomeButtonFromGameOver.addEventListener('click', () => showScreen('home-screen'));

// Keyboard Controls
window.addEventListener('keydown', (e) => {
    if (gameRunning && !gamePaused) {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
            playerJump();
            e.preventDefault(); // Prevent scrolling page with space/arrows
        }
        if (e.key === 'ArrowDown' || e.key === 's') {
            playerSlide();
            e.preventDefault();
        }
    } else if (gamePaused && tutorialSteps[currentTutorialStepIndex].action) {
        // If tutorial is paused waiting for an action
        const step = tutorialSteps[currentTutorialStepIndex];
        if (step.action === 'jump' && (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ')) {
            playerJump();
            nextTutorialButton.classList.remove('hidden'); // Show next button
        } else if (step.action === 'slide' && (e.key === 'ArrowDown' || e.key === 's')) {
            playerSlide();
            nextTutorialButton.classList.remove('hidden');
        }
    }
});

// Mobile Controls
jumpButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameRunning && !gamePaused) {
        playerJump();
    } else if (gamePaused && tutorialSteps[currentTutorialStepIndex].action === 'jump') {
        playerJump();
        nextTutorialButton.classList.remove('hidden');
    }
}, { passive: false });

slideButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameRunning && !gamePaused) {
        playerSlide();
    } else if (gamePaused && tutorialSteps[currentTutorialStepIndex].action === 'slide') {
        playerSlide();
        nextTutorialButton.classList.remove('hidden');
    }
}, { passive: false });

// Initialize the game by showing the home screen and loading assets
loadAssets().then(() => {
    showScreen('home-screen');
});
