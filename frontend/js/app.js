// app.js - Frontend only version
let currentUser = null;

// Initialize local guest user
function initGuestUser() {
    const defaultUser = {
        username: 'GuestNinja',
        coins: 0,
        stars: 0,
        classic_level: 1,
        zen_level: 1,
        arcade_level: 1,
        unlocked_themes: 'default'
    };
    const saved = localStorage.getItem('fruitwar_guest');
    if (saved) {
        currentUser = JSON.parse(saved);
        // ensure new fields exist
        currentUser = {...defaultUser, ...currentUser};
    } else {
        currentUser = defaultUser;
        saveGuestUser();
    }
}

function saveGuestUser() {
    localStorage.setItem('fruitwar_guest', JSON.stringify(currentUser));
}

// Screens
const loginScreen = document.getElementById('login-screen');
const mainMenu = document.getElementById('main-menu');
const inGameUi = document.getElementById('in-game-ui');
const gameOverScreen = document.getElementById('game-over-screen');

function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// Start app
window.addEventListener('load', () => {
    initGuestUser();
    updateMenuStats();
    showScreen(mainMenu); // Bypass login entirely!
});

// Auth buttons (hide them or make them do nothing)
document.getElementById('logout-btn').style.display = 'none';

document.getElementById('reset-progress-btn').addEventListener('click', () => {
    if (confirm("⚠️ ARE YOU SURE? \n\nThis will permanently delete your scores, coins, stars, and theme unlocks. This cannot be undone!")) {
        localStorage.removeItem('fruitwar_guest');
        initGuestUser();
        updateMenuStats();
        
        // Refresh theme buttons
        const unlocked = currentUser.unlocked_themes.split(",");
        document.querySelectorAll('.theme-btn').forEach(btn => {
            const theme = btn.dataset.theme;
            if (unlocked.includes(theme)) {
                btn.classList.remove('locked');
                const costSpan = btn.querySelector('.cost');
                if (costSpan) costSpan.style.display = 'none';
            } else {
                btn.classList.add('locked');
                const costSpan = btn.querySelector('.cost');
                if (costSpan) costSpan.style.display = 'inline';
            }
        });
        
        // Switch back to default theme visually
        document.querySelector('[data-theme="default"]').click();
        alert("Ninja progress has been wiped clean. Good luck starting over!");
    }
});

function updateMenuStats() {
    if(!currentUser) return;
    document.getElementById('star-count').innerText = currentUser.stars;
    document.getElementById('coin-count').innerText = currentUser.coins;
    
    document.getElementById('classic-level').innerText = currentUser.classic_level;
    document.getElementById('zen-level').innerText = currentUser.zen_level;
    document.getElementById('arcade-level').innerText = currentUser.arcade_level;
    
    document.getElementById('classic-goal').innerText = `Next: Score ${currentUser.classic_level * 50}`;
    document.getElementById('zen-goal').innerText = `Next: Score ${currentUser.zen_level * 50}`;
    document.getElementById('arcade-goal').innerText = `Next: Score ${currentUser.arcade_level * 50}`;
    
    if (typeof refreshThemeButtons === 'function') refreshThemeButtons();
}

// Game Flow
document.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const mode = e.target.parentElement.dataset.mode;
        startGame(mode);
    });
});

document.getElementById('home-btn').addEventListener('click', () => {
    showScreen(mainMenu);
    if(window.gameInstance) window.gameInstance.reset();
});

document.getElementById('pause-btn').addEventListener('click', () => {
    if(window.gameInstance) {
        window.gameInstance.togglePause();
        document.getElementById('pause-overlay').style.display = window.gameInstance.isPaused ? 'flex' : 'none';
    }
});

document.getElementById('resume-btn').addEventListener('click', () => {
    if(window.gameInstance && window.gameInstance.isPaused) {
        window.gameInstance.togglePause();
        document.getElementById('pause-overlay').style.display = 'none';
    }
});

document.getElementById('pause-home-btn').addEventListener('click', () => {
    document.getElementById('pause-overlay').style.display = 'none';
    if(window.gameInstance) window.gameInstance.reset();
    showScreen(mainMenu);
});

// Theme switching
let currentTheme = 'default';
const THEME_COSTS = {
    default: {type: 'coins', amount: 0},
    neon: {type: 'coins', amount: 100},
    sunset: {type: 'coins', amount: 150},
    ocean: {type: 'coins', amount: 200},
    sakura: {type: 'coins', amount: 250},
    cyberpunk: {type: 'coins', amount: 300},
    lava: {type: 'coins', amount: 350},
    galaxy: {type: 'coins', amount: 400},
    toxic: {type: 'coins', amount: 450},
    ice: {type: 'coins', amount: 500},
    inferno: {type: 'stars', amount: 1},
    jungle: {type: 'stars', amount: 1},
    storm: {type: 'stars', amount: 1},
    gold: {type: 'stars', amount: 1},
    midnight: {type: 'stars', amount: 1},
    candy: {type: 'stars', amount: 1},
    deepsea: {type: 'stars', amount: 1},
    desert: {type: 'stars', amount: 2},
    matrix: {type: 'stars', amount: 2},
    zen: {type: 'stars', amount: 2},
    steampunk: {type: 'stars', amount: 2},
    rainbow: {type: 'stars', amount: 2},
    void: {type: 'stars', amount: 2},
    emerald: {type: 'stars', amount: 2},
    solar: {type: 'stars', amount: 2}
};

const THEME_BACKGROUNDS = {
    default:   'radial-gradient(circle at center, #2f3542, #1e272e)',
    neon:      'radial-gradient(circle at center, #2d004d, #0d001a)',
    sunset:    'radial-gradient(circle at center, #ff7e5f, #764ba2)',
    ocean:     'radial-gradient(circle at center, #006994, #001a33)',
    sakura:    'radial-gradient(circle at center, #d4618c, #3b1f2b)',
    cyberpunk: 'radial-gradient(circle at center, #00e5ff, #0a0a2e)',
    lava:      'radial-gradient(circle at center, #e25822, #1a0500)',
    galaxy:    'radial-gradient(circle at center, #1b003a, #000000)',
    toxic:     'radial-gradient(circle at center, #1c3b1c, #0d1a0d)',
    ice:       'radial-gradient(circle at center, #a0e6ff, #003366)',
    inferno:   'radial-gradient(circle at center, #4d0a00, #000000)',
    jungle:    'radial-gradient(circle at center, #132d13, #000000)',
    storm:     'radial-gradient(circle at center, #1a1a2e, #0a0a1a)',
    gold:      'radial-gradient(circle at center, #4d3d00, #000000)',
    midnight:  'radial-gradient(circle at center, #00001a, #000000)',
    candy:     'radial-gradient(circle at center, #ff80b3, #4d001a)',
    deepsea:   'radial-gradient(circle at center, #000033, #000000)',
    desert:    'radial-gradient(circle at center, #4d2600, #1a0d00)',
    matrix:    'radial-gradient(circle at center, #001a00, #000000)',
    zen:       'radial-gradient(circle at center, #e0e0e0, #4d4d4d)',
    steampunk: 'radial-gradient(circle at center, #3d2613, #000000)',
    rainbow:   'radial-gradient(circle at center, #330033, #000000)',
    void:      'radial-gradient(circle at center, #1a0033, #000000)',
    emerald:   'radial-gradient(circle at center, #00331a, #000000)',
    solar:     'radial-gradient(circle at center, #4d4d00, #000000)'
};

function refreshThemeButtons() {
    if (!currentUser) return;
    const owned = currentUser.unlocked_themes ? currentUser.unlocked_themes.split(',') : ['default']; 
    document.querySelectorAll('.theme-btn').forEach(btn => {
        const theme = btn.dataset.theme;
        btn.classList.remove('locked', 'owned');
        if (owned.includes(theme)) {
            btn.classList.add('owned');
        } else {
            btn.classList.add('locked');
        }
        if (theme === currentTheme) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function applyTheme(theme) {
    currentTheme = theme;
    document.getElementById('game-container').style.background = THEME_BACKGROUNDS[theme];
    if (window.gameInstance) {
        if (window.gameInstance.scene) window.gameInstance.scene.background = null; 
        if (typeof window.gameInstance.setTheme === 'function') window.gameInstance.setTheme(theme);
    }
    refreshThemeButtons();
}

document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        if (theme === currentTheme || !currentUser) return;

        const owned = currentUser.unlocked_themes ? currentUser.unlocked_themes.split(',') : ['default']; 
        if (owned.includes(theme)) {
            applyTheme(theme);
            return;
        }

        const costInfo = THEME_COSTS[theme] || {type: 'coins', amount: 0};
        const currencyType = costInfo.type;
        const costAmount = costInfo.amount;

        if (currentUser[currencyType] < costAmount) {
            alert(`Not enough ${currencyType}! You have ${currentUser[currencyType]}, need ${costAmount}.`);
            return;
        }

        currentUser[currencyType] -= costAmount;
        currentUser.unlocked_themes += "," + theme;
        saveGuestUser();
        updateMenuStats();
        applyTheme(theme);
    });
});

async function endGame(score, mode) {
    showScreen(gameOverScreen);
    document.getElementById('final-score').innerText = score;
    document.getElementById('pause-overlay').style.display = 'none';
    
    const coinsEarned = Math.floor(score / 10);
    const starsEarned = score > 100 ? 1 : 0;
    
    document.getElementById('earned-coins').innerText = coinsEarned;
    document.getElementById('earned-stars').innerText = starsEarned;
    
    if(currentUser) {
        currentUser.coins += coinsEarned;
        currentUser.stars += starsEarned;
        
        const oldLevel = currentUser[mode + '_level'];
        const threshold = oldLevel * 50;
        if (score >= threshold) {
            currentUser[mode + '_level']++;
            document.getElementById('earned-stars').innerText += ` 🎉 Level Up! ${mode} is now Level ${currentUser[mode + '_level']}`;
        }
        
        saveGuestUser();
        updateMenuStats();
    }
}

function startGame(mode) {
    showScreen(inGameUi);
    document.getElementById('pause-overlay').style.display = 'none';
    document.getElementById('pause-btn').innerText = 'Pause';
    
    if (currentUser) {
        const lvl = currentUser[mode + '_level'] || 1;
        document.getElementById('level-hud').innerText = `Level ${lvl}`;
    }
    
    const countdownOverlay = document.getElementById('countdown-overlay');
    const countdownNumber = document.getElementById('countdown-number');
    countdownOverlay.style.display = 'flex';
    
    let count = 3;
    const updateCountdown = () => {
        if (count > 0) {
            countdownNumber.innerText = count;
            if (window.gameInstance) window.gameInstance.playBeep(true);
        } else if (count === 0) {
            countdownNumber.innerText = 'GO!';
            if (window.gameInstance) window.gameInstance.playBeep(false);
        } else {
            clearInterval(countInterval);
            countdownOverlay.style.display = 'none';
            
            const cameraEnabled = document.getElementById('camera-enabled').checked;
            if (cameraEnabled && !window.cameraTrackingStarted) {
                startCameraTracking();
                window.cameraTrackingStarted = true;
            }
            
            if (window.gameInstance) window.gameInstance.start(mode);
            return;
        }
        count--;
    };

    updateCountdown();
    const countInterval = setInterval(updateCountdown, 1000);
}
