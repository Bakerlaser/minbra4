// app.js

/**
 * Game State Management
 */
const state = {
    players: [], // { name: string, score: number, role: 'spy' | 'normal' | 'helper', word: string, votedFor: string }
    rounds: 3,
    currentRound: 1,
    selectedCategory: null,
    spiesCount: 1,
    useHelper: false,
    useDoubleAgent: false,
    useForbiddenWords: false,

    currentWord: '',
    currentFakeWord: '',
    currentForbiddenWords: [],
    currentFakeForbiddenWords: [],
    spyIndices: [],
    helperIndex: -1,
    previousSpyIndices: [],

    // Stats
    stats: {
        mostVoted: {}, // { playerName: count }
        correctVotes: {} // { playerName: count }
    },

    // UI tracking
    currentPlayerIndex: 0,
    questionPairs: [],
    currentQuestionIndex: 0
};

// Online State
let socket = null;
let isOnline = false;
let isHost = false;
let myPlayerName = '';
let myPlayerId = '';
let currentRoomCode = '';

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;

/**
 * DOM Elements
 */
const screens = {
    modeSelect: document.getElementById('screen-mode-select'),
    onlineLobby: document.getElementById('screen-online-lobby'),
    setup: document.getElementById('screen-setup'),
    pass: document.getElementById('screen-pass'),
    reveal: document.getElementById('screen-reveal'),
    playing: document.getElementById('screen-playing'),
    voting: document.getElementById('screen-voting'),
    suspense: document.getElementById('screen-suspense'),
    spyGuess: document.getElementById('screen-spy-guess'),
    roundResults: document.getElementById('screen-round-results'),
    finalResults: document.getElementById('screen-final-results')
};

const overlay = document.getElementById('transition-overlay');

// Mode Select UI
const btnModeLocal = document.getElementById('btn-mode-local');
const btnModeOnline = document.getElementById('btn-mode-online');

// Online Lobby UI
const onlinePlayerName = document.getElementById('online-player-name');
const btnCreateRoom = document.getElementById('btn-create-room');
const roomCodeInput = document.getElementById('room-code-input');
const btnJoinRoom = document.getElementById('btn-join-room');
const btnLobbyBack = document.getElementById('btn-lobby-back');

// Setup Additions
const setupTitleText = document.getElementById('setup-title-text');
const roomCodeDisplay = document.getElementById('room-code-display');
const btnSetupBack = document.getElementById('btn-setup-back');
const waitingHostMsg = document.getElementById('waiting-host-msg');

// Setup UI
const btnRoundsMinus = document.getElementById('btn-rounds-minus');
const btnRoundsPlus = document.getElementById('btn-rounds-plus');
const roundsDisplay = document.getElementById('rounds-display');
const btnSpiesMinus = document.getElementById('btn-spies-minus');
const btnSpiesPlus = document.getElementById('btn-spies-plus');
const spiesDisplay = document.getElementById('spies-display');
const categorySelector = document.getElementById('category-selector');
const helperCheckbox = document.getElementById('helper-checkbox');
const doubleAgentCheckbox = document.getElementById('double-agent-checkbox');
const forbiddenWordsCheckbox = document.getElementById('forbidden-words-checkbox');
const playerNameInput = document.getElementById('player-name-input');
const btnAddPlayer = document.getElementById('btn-add-player');
const playersList = document.getElementById('players-list');
const playerCountDisplay = document.getElementById('player-count');
const btnStartGame = document.getElementById('btn-start-game');
const btnInstallApp = document.getElementById('btn-install-app');

// Audio
const audioHeartbeat = document.getElementById('audio-heartbeat');
const audioTada = document.getElementById('audio-tada');
const audioFail = document.getElementById('audio-fail');

function playSound(audioEl) {
    if (!audioEl) return;
    audioEl.currentTime = 0;
    audioEl.play().catch(e => console.warn('Audio play blocked:', e));
}

// Pass & Reveal UI
const passMessageSpan = document.querySelector('#pass-message span');
const btnReady = document.getElementById('btn-ready');
const btnNextPlayerReveal = document.getElementById('btn-next-player');
const roleTitle = document.getElementById('role-title');
const secretWord = document.getElementById('secret-word');

// Playing UI
const askerName = document.getElementById('asker-name');
const targetName = document.getElementById('target-name');
const btnNextQuestion = document.getElementById('btn-next-question');
const btnEndPlaying = document.getElementById('btn-end-playing');

// Voting UI
const votingInstructionSpan = document.querySelector('#voting-instruction span');
const votingList = document.getElementById('voting-list');
const btnUseHint = document.getElementById('btn-use-hint');
const hintDisplayArea = document.getElementById('hint-display-area');

// Suspense UI
const btnSuspenseNext = document.getElementById('btn-suspense-next');
const suspenseTitle = document.getElementById('suspense-title');
const suspenseSpyNames = document.getElementById('suspense-spy-names');

// Spy Guessing UI
const spyGuessInstruction = document.getElementById('spy-guess-instruction');
const spyGuessWordsList = document.getElementById('spy-guess-words-list');

// Results UI
const actualSpyName = document.getElementById('actual-spy-name');
const roundResultMsg = document.getElementById('round-result-msg');
const roundLeaderboardList = document.getElementById('round-leaderboard-list');
const btnNextRound = document.getElementById('btn-next-round');

// Final UI
const finalWinnerName = document.getElementById('final-winner-name');
const finalLeaderboardList = document.getElementById('final-leaderboard-list');
const btnNewGame = document.getElementById('btn-new-game');
const statsContainer = document.getElementById('stats-container');
const statsList = document.getElementById('stats-list');

// Custom Modal DOM
const customModalOverlay = document.getElementById('custom-modal-overlay');
const customModalIcon = document.getElementById('modal-icon');
const customModalTitle = document.getElementById('modal-title');
const customModalBody = document.getElementById('modal-body');
const customModalBtnCancel = document.getElementById('modal-btn-cancel');
const customModalBtnConfirm = document.getElementById('modal-btn-confirm');

function showCustomModal(title, message, icon, showCancel = false, onConfirm = null) {
    customModalTitle.textContent = title;
    customModalBody.innerHTML = message;
    customModalIcon.textContent = icon || '❗';

    customModalBtnCancel.style.display = showCancel ? 'block' : 'none';

    customModalBtnConfirm.onclick = () => {
        customModalOverlay.classList.remove('active');
        if (onConfirm) onConfirm();
    };

    customModalBtnCancel.onclick = () => {
        customModalOverlay.classList.remove('active');
    };

    customModalOverlay.classList.add('active');
}


const CATEGORY_PRICE = 50;
const UNLOCK_ROUNDS = 10;
const ROUND_REWARD = 10;
const FREE_CATEGORIES = ["أكل", "شخصيات", "حيوانات", "مدن", "مهن", "أشياء عامة", "ملابس"];

const unlockState = {
    points: 0,
    categories: {} // e.g. "رياضة": 10 (remaining rounds)
};

function loadUnlockState() {
    const saved = localStorage.getItem('minBaraAlsalfa_unlocks');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            unlockState.points = parsed.points || 0;
            unlockState.categories = parsed.categories || {};
        } catch (e) { }
    } else {
        // Gift for new players
        unlockState.points = 0;
    }
}

function saveUnlockState() {
    localStorage.setItem('minBaraAlsalfa_unlocks', JSON.stringify(unlockState));
    updatePointsUI();
}

function updatePointsUI() {
    const display = document.getElementById('app-points-display');
    if (display) display.textContent = unlockState.points;
}

function isCategoryUnlocked(cat) {
    if (FREE_CATEGORIES.includes(cat)) return true;
    if (unlockState.categories[cat] && unlockState.categories[cat] > 0) return true;
    return false;
}

/**
 * Initialization
 */
function init() {
    loadUnlockState();
    updatePointsUI();
    initCategories();
    setupEventListeners();
    updateSetupUI();
}

function initCategories() {
    const categories = Object.keys(window.WORDS_DB);

    // Ensure selected category is unlocked, fallback to first unlocked
    if (categories.length > 0) {
        if (!state.selectedCategory || !isCategoryUnlocked(state.selectedCategory)) {
            state.selectedCategory = categories.find(c => isCategoryUnlocked(c)) || categories[0];
        }
    }

    categorySelector.innerHTML = '';
    categories.forEach(cat => {
        const isFree = FREE_CATEGORIES.includes(cat);
        const unlockedRounds = unlockState.categories[cat] || 0;
        const isUnlocked = isFree || unlockedRounds > 0;

        const chip = document.createElement('div');
        chip.className = `chip ${cat === state.selectedCategory ? 'active' : ''}`;

        if (isFree) {
            chip.textContent = cat;
        } else if (isUnlocked) {
            chip.innerHTML = `${cat} <span style="font-size: 0.8rem; opacity: 0.8;">(${unlockedRounds} جولات)</span>`;
            chip.classList.add('unlocked-paid');
        } else {
            chip.innerHTML = `🔒 ${cat} <span class="price-tag">${CATEGORY_PRICE} 🪙</span>`;
            chip.classList.add('locked');
        }

        chip.onclick = () => {
            if (isUnlocked) {
                selectCategory(cat);
            } else {
                attemptUnlockCategory(cat);
            }
        };
        categorySelector.appendChild(chip);
    });
}

function attemptUnlockCategory(cat) {
    if (unlockState.points >= CATEGORY_PRICE) {
        showCustomModal(
            "فتح قسم جديد",
            `هل تريد فتح قسم "${cat}" لـ ${UNLOCK_ROUNDS} جولات مقابل ${CATEGORY_PRICE} نقطة؟`,
            "🔓",
            true,
            () => {
                unlockState.points -= CATEGORY_PRICE;
                unlockState.categories[cat] = UNLOCK_ROUNDS;
                saveUnlockState();
                selectCategory(cat);
            }
        );
    } else {
        const needed = CATEGORY_PRICE - unlockState.points;
        showCustomModal(
            "نقاط غير كافية",
            `عذراً، تحتاج إلى ${needed} نقطة إضافية لفتح هذا القسم. العب المزيد من الجولات لجمع النقاط!`,
            "🪙",
            false
        );
    }
}

function selectCategory(cat) {
    state.selectedCategory = cat;
    initCategories(); // Re-render chips to show active state properly with new innerHTML
}

function setupEventListeners() {
    // Mode Selection
    btnModeLocal.onclick = () => {
        isOnline = false;
        isHost = true; // In local mode, you are the host of your own game

        // Hide online specific UI
        roomCodeDisplay.style.display = 'none';
        waitingHostMsg.style.display = 'none';
        btnStartGame.style.display = 'block';
        setupTitleText.innerHTML = "إعدادات <span>اللعبة</span> (جهاز واحد)";

        // Enable setup inputs
        toggleSetupInputs(true);

        // Add default players if empty
        if (state.players.length === 0) {
            addPlayerWithName('اللاعب 1');
            addPlayerWithName('اللاعب 2');
            addPlayerWithName('اللاعب 3');
        }

        switchScreen('setup');
    };

    btnModeOnline.onclick = () => {
        isOnline = true;
        // Connect to Socket.IO if not already connected
        if (!socket) {
            initSocket();
        }
        onlinePlayerName.value = localStorage.getItem('minBaraAlsalfa_playerName') || '';
        switchScreen('onlineLobby');
    };

    btnLobbyBack.onclick = () => {
        switchScreen('modeSelect');
    };

    btnSetupBack.onclick = () => {
        if (isOnline) {
            showCustomModal(
                "تأكيد الخروج",
                "هل تريد الخروج من هذه الغرفة؟",
                "🚪",
                true,
                () => {
                    if (socket) socket.disconnect(); // Leave room
                    socket = null; // Re-init later if needed
                    state.players = [];
                    switchScreen('modeSelect');
                }
            );
        } else {
            switchScreen('modeSelect');
        }
    };

    btnCreateRoom.onclick = () => {
        const name = onlinePlayerName.value.trim();
        if (!name) { showCustomModal("تنبيه", "الرجاء كتابة اسمك أولاً!", "❗"); return; }

        localStorage.setItem('minBaraAlsalfa_playerName', name);
        btnCreateRoom.disabled = true;

        socket.emit('createRoom', name, (response) => {
            btnCreateRoom.disabled = false;
            if (response.success) {
                isHost = true;
                myPlayerName = name;
                myPlayerId = socket.id;
                currentRoomCode = response.roomCode;

                // Initialize state from server room
                state.players = response.room.players;

                // Setup UI for Host
                roomCodeDisplay.textContent = `كود الغرفة: ${currentRoomCode}`;
                roomCodeDisplay.style.display = 'block';
                setupTitleText.innerHTML = "أنت المضيف 👑";
                waitingHostMsg.style.display = 'none';
                btnStartGame.style.display = 'block';
                toggleSetupInputs(true);

                updateSetupUI();
                switchScreen('setup');
            } else {
                showCustomModal("خطأ", "حدث خطأ أثناء إنشاء الغرفة.", "❌");
            }
        });
    };

    btnJoinRoom.onclick = () => {
        const name = onlinePlayerName.value.trim();
        const code = roomCodeInput.value.trim();
        if (!name) { showCustomModal("تنبيه", "الرجاء كتابة اسمك أولاً!", "❗"); return; }
        if (code.length !== 4) { showCustomModal("تنبيه", "كود الغرفة يجب أن يكون 4 أرقام!", "❗"); return; }

        localStorage.setItem('minBaraAlsalfa_playerName', name);
        btnJoinRoom.disabled = true;

        socket.emit('joinRoom', { roomCode: code, playerName: name }, (response) => {
            btnJoinRoom.disabled = false;
            if (response.success) {
                isHost = false;
                myPlayerName = name;
                myPlayerId = socket.id;
                currentRoomCode = code;

                // Sync state from server room
                state.players = response.room.players;
                updateSettingsFromHost(response.room.settings);

                // Setup UI for Client
                roomCodeDisplay.textContent = `كود الغرفة: ${currentRoomCode}`;
                roomCodeDisplay.style.display = 'block';
                setupTitleText.innerHTML = "في انتظار المضيف لبدء اللعبة ⏳";
                waitingHostMsg.style.display = 'block';
                btnStartGame.style.display = 'none';
                toggleSetupInputs(false); // Clients can't change settings

                updateSetupUI();
                switchScreen('setup');
            } else {
                showCustomModal("خطأ", response.message, "❌");
            }
        });
    };

    // Setup
    btnRoundsMinus.onclick = () => { if (state.rounds > 1) { state.rounds--; updateSetupUI(); broadcastSettings(); } };
    btnRoundsPlus.onclick = () => { if (state.rounds < 10) { state.rounds++; updateSetupUI(); broadcastSettings(); } };

    btnSpiesMinus.onclick = () => { if (state.spiesCount > 1) { state.spiesCount--; updateSetupUI(); broadcastSettings(); } };
    btnSpiesPlus.onclick = () => {
        const maxSpies = Math.max(1, state.players.length - 2);
        if (state.spiesCount < maxSpies) { state.spiesCount++; updateSetupUI(); broadcastSettings(); }
    };

    helperCheckbox.onchange = (e) => { state.useHelper = e.target.checked; broadcastSettings(); };
    doubleAgentCheckbox.onchange = (e) => { state.useDoubleAgent = e.target.checked; broadcastSettings(); };
    forbiddenWordsCheckbox.onchange = (e) => { state.useForbiddenWords = e.target.checked; broadcastSettings(); };

    btnAddPlayer.onclick = () => {
        if (isOnline) return; // Only local can freely add fake players
        const name = playerNameInput.value.trim();
        addPlayerWithName(name);
    };
    playerNameInput.onkeypress = (e) => { if (e.key === 'Enter') btnAddPlayer.onclick(); };
    btnStartGame.onclick = startGame;

    // PWA Install
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;

        // At this point, the browser SAYS it's ready to install.
        btnInstallApp.style.display = 'block';
    });

    // When the user clicks the button, tell the browser to show the real popup
    btnInstallApp.addEventListener('click', async () => {
        if (!deferredPrompt) return;

        // Show the native PWA install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('User accepted the PWA prompt');
            btnInstallApp.style.display = 'none';
        } else {
            console.log('User dismissed the PWA prompt');
        }

        // We can only use the prompt once
        deferredPrompt = null;
    });

    // Hide the button if the app is successfully installed via any method
    window.addEventListener('appinstalled', (evt) => {
        console.log('INSTALL: Success');
        btnInstallApp.style.display = 'none';
    });

    // Pass & Reveal
    btnReady.onclick = () => {
        if (state._passAction === 'vote') {
            showVotingUI();
        } else {
            showReveal();
        }
    };
    btnNextPlayerReveal.onclick = handleNextReveal;

    // Playing
    btnNextQuestion.onclick = showNextQuestion;
    btnEndPlaying.onclick = startVotingPhase;

    // Suspense & Guessing
    btnSuspenseNext.onclick = handleSuspenseNext;

    // Results
    btnNextRound.onclick = nextRound;
    btnNewGame.onclick = resetGame;
}

/**
 * Setup Phase Logic
 */
function addPlayerWithName(name) {
    if (!name) return;

    if (state.players.length >= MAX_PLAYERS) {
        showCustomModal("تنبيه", `الحد الأقصى ${MAX_PLAYERS} لاعبين.`, "👥");
        return;
    }

    if (state.players.some(p => p.name === name)) {
        showCustomModal("تنبيه", "هذا الاسم موجود بالفعل!", "❗");
        return;
    }

    state.players.push({
        name: name,
        score: 0,
        hintPoints: 100, // رصيد التلميحات لكل لاعب
        role: 'normal',
        word: '',
        votedFor: null
    });

    if (playerNameInput) playerNameInput.value = '';
    updateSetupUI();
}

function toggleSetupInputs(isEnabled) {
    btnRoundsMinus.disabled = !isEnabled;
    btnRoundsPlus.disabled = !isEnabled;
    btnSpiesMinus.disabled = !isEnabled;
    btnSpiesPlus.disabled = !isEnabled;
    helperCheckbox.disabled = !isEnabled;
    doubleAgentCheckbox.disabled = !isEnabled;
    forbiddenWordsCheckbox.disabled = !isEnabled;

    // Disable chips for clients
    const chips = categorySelector.querySelectorAll('.chip');
    chips.forEach(c => {
        c.style.pointerEvents = isEnabled ? 'auto' : 'none';
        c.style.opacity = isEnabled ? '1' : '0.7';
    });

    // Disable adding players for clients (they join via code)
    if (playerNameInput) playerNameInput.disabled = !isEnabled;
    if (btnAddPlayer) btnAddPlayer.disabled = !isEnabled;
}

function updateSettingsFromHost(settings) {
    state.rounds = settings.rounds;
    state.spiesCount = settings.spiesCount;
    state.useHelper = settings.useHelper;
    state.useDoubleAgent = settings.useDoubleAgent;
    state.useForbiddenWords = settings.useForbiddenWords;
    state.selectedCategory = settings.selectedCategory;

    // Update local UI
    helperCheckbox.checked = state.useHelper;
    doubleAgentCheckbox.checked = state.useDoubleAgent;
    forbiddenWordsCheckbox.checked = state.useForbiddenWords;
    initCategories(); // will re-render exactly like host (since we synced selectedCategory)
}

function broadcastSettings() {
    if (isOnline && isHost && socket) {
        socket.emit('updateSettings', {
            rounds: state.rounds,
            spiesCount: state.spiesCount,
            useHelper: state.useHelper,
            useDoubleAgent: state.useDoubleAgent,
            useForbiddenWords: state.useForbiddenWords,
            selectedCategory: state.selectedCategory
        });
    }
}

function initSocket() {
    socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

    socket.on('playerJoined', (players) => {
        state.players = players;
        if (isHost) updateSetupUI(); // Host UI update handling kicks later
        else updateSetupUI();
    });

    socket.on('playerLeft', (players) => {
        state.players = players;
        updateSetupUI();
    });

    socket.on('youAreHost', () => {
        isHost = true;
        setupTitleText.innerHTML = "أنت المضيف 👑";
        waitingHostMsg.style.display = 'none';
        btnStartGame.style.display = 'block';
        toggleSetupInputs(true);
        showCustomModal("حسناً", "أنت المضيف الآن لأن المضيف السابق غادر.", "👑");
    });

    socket.on('kicked', () => {
        showCustomModal("تنبيه", "تم طردك من الغرفة.", "👢", false, () => {
            isOnline = false;
            socket.disconnect();
            socket = null;
            state.players = [];
            switchScreen('modeSelect');
        });
    });

    socket.on('settingsUpdated', (settings) => {
        if (!isHost) {
            updateSettingsFromHost(settings);
            updateSetupUI();
        }
    });

    socket.on('gameEvent', (data) => {
        // Here we handle broadcasts from Host
        if (!isHost) {
            handleServerGameEvent(data);
        }
    });

    socket.on('clientEvent', (data) => {
        if (isHost) {
            if (data.type === 'submitVote') {
                const p = state.players.find(p => p.id === data.playerId);
                if (p) {
                    p.votedFor = data.targetName;
                    state.votesReceived = (state.votesReceived || 0) + 1;
                    checkAllVotesReceived();
                }
            } else if (data.type === 'submitSpyGuess') {
                submitSpyGuess(data.guessedWord, data.playerId);
            }
        }
    });

    socket.on('roomClosed', () => {
        showCustomModal("تنبيه", "أغلق المضيف الغرفة.", "🔌", false, () => {
            isOnline = false;
            socket.disconnect();
            socket = null;
            state.players = [];
            switchScreen('modeSelect');
        });
    });
}

function broadcastGameState(eventType, extraData = {}) {
    if (isOnline && isHost && socket) {
        socket.emit('hostEvent', {
            type: 'gameStateUpdate',
            eventType: eventType,
            state: {
                phase: state._currentPhase,
                currentRound: state.currentRound,
                currentWord: state.currentWord,
                currentFakeWord: state.currentFakeWord,
                currentForbiddenWords: state.currentForbiddenWords,
                currentFakeForbiddenWords: state.currentFakeForbiddenWords,
                spyIndices: state.spyIndices,
                helperIndex: state.helperIndex,
                currentPlayerIndex: state.currentPlayerIndex,
                questionPairs: state.questionPairs,
                currentQuestionIndex: state.currentQuestionIndex,
                _caughtSpies: state._caughtSpies,
                _uncaughtSpies: state._uncaughtSpies,
                stats: state.stats
            },
            players: state.players,
            ...extraData
        });
    }
}

function handleServerGameEvent(data) {
    if (data.type === 'gameStateUpdate') {
        Object.assign(state, data.state);
        state.players = data.players;

        // Router based on eventType
        if (data.eventType === 'startRound') {
            handleClientPhase('passReveal');
        } else if (data.eventType === 'startPlaying') {
            handleClientPhase('playing');
        } else if (data.eventType === 'updatePlaying') {
            updateQuestionUI();
        } else if (data.eventType === 'startVoting') {
            handleClientPhase('voting');
        } else if (data.eventType === 'showSuspense') {
            showSuspenseScreen(data.spyNamesStr, true); // true = client mode
        } else if (data.eventType === 'spyGuessing') {
            startSpyGuessingPhase(true); // true = client mode
        } else if (data.eventType === 'roundResults') {
            showRoundResultsClient(data.guessedCorrectly);
        } else if (data.eventType === 'finalResults') {
            showFinalResults();
        } else if (data.eventType === 'resetGame') {
            updateSetupUI();
            switchScreen('setup');
        }
    }
}

function handleClientPhase(phase) {
    if (phase === 'passReveal') {
        const myIndex = state.players.findIndex(p => p.id === myPlayerId || p.name === myPlayerName);
        state.currentPlayerIndex = myIndex !== -1 ? myIndex : 0;

        if (isHost) {
            btnNextPlayerReveal.style.display = 'block';
            btnNextPlayerReveal.textContent = 'بدء اللعب وتوجيه الأسئلة';
            btnNextPlayerReveal.onclick = () => { startPlayingPhase(); };
        } else {
            btnNextPlayerReveal.style.display = 'none';
        }
        showReveal();
    } else if (phase === 'playing') {
        updateQuestionUI();
        switchScreen('playing');
        if (isHost) {
            btnNextQuestion.style.display = 'block';
            btnEndPlaying.style.display = 'block';
        } else {
            btnNextQuestion.style.display = 'none';
            btnEndPlaying.style.display = 'none';
        }
    } else if (phase === 'voting') {
        const myIndex = state.players.findIndex(p => p.id === myPlayerId || p.name === myPlayerName);
        state.currentPlayerIndex = myIndex !== -1 ? myIndex : 0;
        showVotingUI();
    }
}

function removePlayer(name) {
    state.players = state.players.filter(p => p.name !== name);
    updateSetupUI();
}

function updateSetupUI() {
    roundsDisplay.textContent = state.rounds;
    playerCountDisplay.textContent = state.players.length;

    let maxSpies = Math.max(1, state.players.length - 2);
    if (state.players.length < 3) maxSpies = 1;
    if (state.spiesCount > maxSpies) state.spiesCount = Math.max(1, maxSpies);

    if (spiesDisplay) spiesDisplay.textContent = state.spiesCount;

    playersList.innerHTML = '';
    state.players.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${p.name}</span>
            <button class="btn-remove-player" onclick="removePlayer('${p.name}')">×</button>
        `;
        playersList.appendChild(li);
    });

    btnStartGame.disabled = state.players.length < MIN_PLAYERS;
}


/**
 * Game Flow Logic
 */
function startGame() {
    if (!FREE_CATEGORIES.includes(state.selectedCategory)) {
        const remaining = unlockState.categories[state.selectedCategory] || 0;
        if (remaining < state.rounds) {
            showCustomModal(
                "تنبيه",
                `القسم المختار متبقي فيه ${remaining} جولات فقط. الرجاء تقليل عدد جولات اللعبة ليتناسب معها، أو اختيار قسم آخر.`,
                "⚠️"
            );
            return;
        }
    }

    state.currentRound = 1;
    state.previousSpyIndices = [];
    state.useHelper = helperCheckbox.checked;
    state.useDoubleAgent = doubleAgentCheckbox.checked;
    state.useForbiddenWords = forbiddenWordsCheckbox.checked;
    state.stats.mostVoted = {};
    state.stats.correctVotes = {};
    state.players.forEach(p => {
        p.score = 0;
        p.hintPoints = 100; // إعادة تعبئة النقاط الخاصة في بداية الجولات الجديدة
        state.stats.mostVoted[p.name] = 0;
        state.stats.correctVotes[p.name] = 0;
    });
    prepareRound();
}

function prepareRound() {
    // Pick word
    const wordsList = window.WORDS_DB[state.selectedCategory];
    const rawWordItem = wordsList[Math.floor(Math.random() * wordsList.length)];

    let wordStr = '';
    let fakeStr = '';
    let forbiddenArr = [];

    // Parse "Word|FakeWord|F1,F2,F3" format
    if (typeof rawWordItem === 'string' && rawWordItem.includes('|')) {
        const parts = rawWordItem.split('|');
        wordStr = parts[0];
        fakeStr = parts[1] || '';
        if (parts[2]) {
            forbiddenArr = parts[2].split(',').map(s => s.trim());
        }
    } else {
        wordStr = rawWordItem;
    }

    state.currentWord = wordStr;

    // Set predetermined fake and forbidden words if they exist
    state.currentFakeWord = fakeStr;
    state.currentForbiddenWords = forbiddenArr;
    state.currentFakeForbiddenWords = [];

    // Attempt to find the fake word in the DB to extract its specific forbidden words
    if (fakeStr) {
        const fakeItem = wordsList.find(w => typeof w === 'string' && w.startsWith(fakeStr + '|'));
        if (fakeItem) {
            const fakeParts = fakeItem.split('|');
            if (fakeParts[2]) {
                state.currentFakeForbiddenWords = fakeParts[2].split(',').map(s => s.trim());
            }
        }
    }

    // Get a list of clean other words (for fallbacks and spy guessing)
    let availableOtherWords = wordsList.map(item => {
        if (typeof item === 'string' && item.includes('|')) return item.split('|')[0];
        return item;
    }).filter(w => w !== state.currentWord);

    availableOtherWords = shuffleArray(availableOtherWords);

    // Fallback logic if the structured data wasn't provided for this word
    if (state.useDoubleAgent && !state.currentFakeWord) {
        state.currentFakeWord = availableOtherWords[0] || 'كلمة غريبة';
    }

    if (state.useForbiddenWords && state.currentForbiddenWords.length === 0) {
        state.currentForbiddenWords = availableOtherWords.slice(1, 4);
    }

    if (state.useDoubleAgent && state.useForbiddenWords && state.currentFakeForbiddenWords.length === 0) {
        state.currentFakeForbiddenWords = availableOtherWords.slice(4, 7);
    }

    // Pick spies
    let allIndices = [...Array(state.players.length).keys()];

    // Filter out previous spies if possible
    let availableIndices = allIndices.filter(idx => !state.previousSpyIndices.includes(idx));

    // If we don't have enough available players, fall back to all indices
    if (availableIndices.length < state.spiesCount) {
        availableIndices = allIndices;
    }

    availableIndices = shuffleArray(availableIndices);
    state.spyIndices = availableIndices.slice(0, state.spiesCount);
    state.previousSpyIndices = [...state.spyIndices];

    // Pick helper if enabled and enough players
    state.helperIndex = -1;
    if (state.useHelper && state.players.length > state.spiesCount + 1) {
        let nonSpyIndices = allIndices.filter(idx => !state.spyIndices.includes(idx));
        state.helperIndex = nonSpyIndices[Math.floor(Math.random() * nonSpyIndices.length)];
    }

    // Assign roles
    state.players.forEach((p, index) => {
        p.votedFor = null;
        if (state.spyIndices.includes(index)) {
            p.role = 'spy';
            // Double Agent logic: Give them the fake word instead of empty string
            p.word = state.useDoubleAgent ? state.currentFakeWord : '';
        } else if (index === state.helperIndex) {
            p.role = 'helper';
            p.word = state.currentWord;
        } else {
            p.role = 'normal';
            p.word = state.currentWord;
        }
    });

    if (isOnline) {
        state._currentPhase = 'reveal';
        broadcastGameState('startRound');
        handleClientPhase('passReveal');
    } else {
        state.currentPlayerIndex = 0;
        showPassDevice('reveal');
    }
}

/**
 * Screen Transitions & Overlays
 */
function switchScreen(screenKey) {
    overlay.classList.add('active');

    setTimeout(() => {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenKey].classList.add('active');

        setTimeout(() => {
            overlay.classList.remove('active');
        }, 100);
    }, 400); // Overlay transition duration
}

function showPassDevice(nextAction) {
    state._passAction = nextAction; // 'reveal' or 'vote'
    const currentPlayer = state.players[state.currentPlayerIndex];
    passMessageSpan.textContent = currentPlayer.name;
    switchScreen('pass');
}

function showReveal() {
    const p = state.players[state.currentPlayerIndex];

    // Reset styles
    secretWord.style.color = "var(--primary)";

    // Clear any previous forbidden words UI
    let forbiddenHTML = '';
    if (state.useForbiddenWords && state.currentForbiddenWords.length > 0 && p.role !== 'spy') {
        forbiddenHTML = `<br><span style="font-size: 1.1rem; display: block; margin-top: 15px; color: var(--danger)">
            <strong>الكلمات المحرمة 💣:</strong><br>
            ${state.currentForbiddenWords.join(' - ')}
        </span>`;
    }

    if (p.role === 'spy') {
        if (state.useDoubleAgent) {
            let fakeForbiddenHTML = '';
            if (state.useForbiddenWords && state.currentFakeForbiddenWords.length > 0) {
                fakeForbiddenHTML = `<br><span style="font-size: 1.1rem; display: block; margin-top: 15px; color: var(--danger)">
                    <strong>الكلمات المحرمة 💣:</strong><br>
                    ${state.currentFakeForbiddenWords.join(' - ')}
                </span>`;
            }
            // Double Agent: disguise as normal
            roleTitle.textContent = "السالفة هي...";
            roleTitle.style.color = "var(--text-main)";
            secretWord.innerHTML = p.word + fakeForbiddenHTML; // They see the fake word and fake forbidden words!
        } else {
            // Normal Spy
            roleTitle.textContent = "أنت...";
            roleTitle.style.color = "var(--text-main)";
            secretWord.textContent = "برا السالفة!";
        }
    } else if (p.role === 'helper') {
        const spyNames = state.players.filter(pl => pl.role === 'spy').map(s => s.name).join(' و ');
        roleTitle.textContent = "أنت المساعد! السالفة هي...";
        roleTitle.style.color = "var(--success)";
        secretWord.innerHTML = `${p.word}<br><span style="font-size: 1.2rem; display: block; margin-top: 10px; color: var(--danger)">برا السالفة: ${spyNames}</span>${forbiddenHTML}`;
    } else {
        roleTitle.textContent = "السالفة هي...";
        roleTitle.style.color = "var(--text-main)";
        secretWord.innerHTML = p.word + forbiddenHTML;
    }
    switchScreen('reveal');
}

function handleNextReveal() {
    if (isOnline) {
        if (isHost) startPlayingPhase();
    } else {
        state.currentPlayerIndex++;
        if (state.currentPlayerIndex < state.players.length) {
            showPassDevice('reveal');
        } else {
            startPlayingPhase();
        }
    }
}

/**
 * Playing Phase
 */
function generateQuestionPairs() {
    const n = state.players.length;

    // تكوين دورة عشوائية من اللاعبين لضمان عدالة الأسئلة (كل لاعب يسأل مرة ويُسأل مرة)
    let players = Array.from({ length: n }, (_, i) => i);
    players = shuffleArray(players);

    const pairs = [];
    // كل لاعب يسأل اللاعب الذي يليه في الدورة
    for (let i = 0; i < n; i++) {
        pairs.push({
            asker: players[i],
            target: players[(i + 1) % n]
        });
    }

    // خلط ترتيب الأسئلة حتى لا يكون التسلسل متوقعاً
    return shuffleArray(pairs);
}

function startPlayingPhase() {
    if (isOnline && !isHost) return;
    state.questionPairs = generateQuestionPairs();
    state.currentQuestionIndex = 0;

    if (isOnline) {
        state._currentPhase = 'playing';
        broadcastGameState('startPlaying');
        handleClientPhase('playing');
    } else {
        updateQuestionUI();
        switchScreen('playing');
    }
}

function updateQuestionUI() {
    if (state.currentQuestionIndex >= state.questionPairs.length) {
        state.questionPairs = state.questionPairs.concat(generateQuestionPairs());
    }

    const pair = state.questionPairs[state.currentQuestionIndex];
    askerName.textContent = state.players[pair.asker].name;
    targetName.textContent = state.players[pair.target].name;
}

function showNextQuestion() {
    if (isOnline && !isHost) return;
    state.currentQuestionIndex++;
    if (isOnline) {
        broadcastGameState('updatePlaying');
        updateQuestionUI();
    } else {
        updateQuestionUI();
    }
}

/**
 * Voting Phase
 */
function startVotingPhase() {
    if (isOnline && !isHost) return;
    if (isOnline) {
        state._currentPhase = 'voting';
        state.votesReceived = 0;
        broadcastGameState('startVoting');
        handleClientPhase('voting');
    } else {
        state.currentPlayerIndex = 0;
        showPassDevice('vote');
    }
}



function showVotingUI() {
    const voter = state.players[state.currentPlayerIndex];
    votingInstructionSpan.textContent = voter.name;

    // Reset Hint UI
    hintDisplayArea.style.display = 'none';
    hintDisplayArea.textContent = '';

    // Hint only for Spy, and hide it in Double Agent mode to prevent leaking their identity
    if (voter.role === 'spy' && !state.useDoubleAgent) {
        btnUseHint.style.display = 'flex';
        btnUseHint.innerHTML = `<span>💡</span> تلميح (30) - نقاطك: ${voter.hintPoints}`;
        btnUseHint.onclick = () => useHint(voter);
    } else {
        btnUseHint.style.display = 'none';
    }

    votingList.innerHTML = '';
    state.players.forEach(p => {
        if (p.name === voter.name) return; // Prevent self voting

        const btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.textContent = p.name;
        btn.onclick = () => submitVote(p.name);
        votingList.appendChild(btn);
    });

    switchScreen('voting');
}

function useHint(voter) {
    const HINT_PRICE = 30;
    if (voter.hintPoints < HINT_PRICE) {
        showCustomModal(
            "رصيد غير كافٍ",
            `ماعندك نقاط كافية يا جاسوس! تحتاج 30 نقطة ورصيدك الحالي ${voter.hintPoints}.`,
            "🪙",
            false
        );
        return;
    }

    showCustomModal(
        "تأكيد الخصم",
        "راح نخصم 30 نقطة من رصيدك الخاص عشان نعطيك تلميحة.. متأكد؟",
        "❓",
        true,
        () => {
            voter.hintPoints -= HINT_PRICE;

            btnUseHint.style.display = 'none';
            hintDisplayArea.style.display = 'block';

            let extraHint = '';
            if (state.currentForbiddenWords && state.currentForbiddenWords.length > 0) {
                // currentForbiddenWords contains descriptive words (e.g. "dough", "cheese" for "pizza")
                extraHint = `<br><br><span style="color:var(--primary);">💡 ولها علاقة بـ: <strong>( ${state.currentForbiddenWords.join(' - ')} )</strong></span>`;
            }

            hintDisplayArea.innerHTML = `تلميحة: الكلمة من قسم <strong>${state.selectedCategory}</strong>${extraHint}`;
        }
    );
}

function submitVote(targetName) {
    if (isOnline) {
        if (isHost) {
            const p = state.players.find(x => x.id === myPlayerId);
            if (p) {
                p.votedFor = targetName;
                state.votesReceived = (state.votesReceived || 0) + 1;
                checkAllVotesReceived();
            }
        } else {
            socket.emit('clientEvent', { type: 'submitVote', targetName, playerId: myPlayerId });
        }
        votingList.innerHTML = '<div style="text-align:center; padding:20px; font-size:1.2rem; color:var(--primary);">تم تسجيل تصويتك، في انتظار البقية...</div>';
        btnUseHint.style.display = 'none';
        hintDisplayArea.style.display = 'none';
    } else {
        state.players[state.currentPlayerIndex].votedFor = targetName;
        state.currentPlayerIndex++;
        if (state.currentPlayerIndex < state.players.length) {
            showPassDevice('vote');
        } else {
            processResults();
        }
    }
}

function checkAllVotesReceived() {
    if (state.votesReceived >= state.players.length) {
        processResults();
    }
}

/**
 * Results Logic
 */
function processResults() {
    // Count votes
    const voteCounts = {};
    state.players.forEach(p => voteCounts[p.name] = 0);
    state.players.forEach(p => {
        if (p.votedFor) {
            voteCounts[p.votedFor]++;
            state.stats.mostVoted[p.votedFor]++;

            // Check if voted for spy
            const votedTarget = state.players.find(x => x.name === p.votedFor);
            if (votedTarget && votedTarget.role === 'spy') {
                state.stats.correctVotes[p.name]++;
            }
        }
    });

    // Find highest voted
    let maxVotes = 0;
    let mostVotedPlayers = [];

    for (const [name, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
            maxVotes = count;
            mostVotedPlayers = [name];
        } else if (count === maxVotes) {
            mostVotedPlayers.push(name);
        }
    }

    const spies = state.players.filter(p => p.role === 'spy');

    // Check who was caught
    state._caughtSpies = [];
    mostVotedPlayers.forEach(votedName => {
        const p = state.players.find(x => x.name === votedName);
        if (p && p.role === 'spy') {
            state._caughtSpies.push(p);
        }
    });

    state._uncaughtSpies = spies.filter(s => !state._caughtSpies.some(cs => cs.name === s.name));

    showSuspenseScreen(spies.map(s => s.name).join(' و '));
}

function showSuspenseScreen(spyNamesStr, isClientMode = false) {
    suspenseTitle.style.opacity = '0';
    suspenseSpyNames.style.opacity = '0';
    suspenseSpyNames.textContent = spyNamesStr;
    btnSuspenseNext.style.display = 'none';

    if (!isClientMode && isOnline && isHost) {
        broadcastGameState('showSuspense', { spyNamesStr });
    }

    playSound(audioHeartbeat);

    switchScreen('suspense');

    setTimeout(() => {
        suspenseTitle.style.opacity = '1';
    }, 1000);

    setTimeout(() => {
        audioHeartbeat.pause();
        suspenseSpyNames.style.opacity = '1';
        if (isHost || !isOnline) {
            btnSuspenseNext.style.display = 'block';
        }
    }, 3500); // Wait longer for heartbeat effect
}

function handleSuspenseNext() {
    // If any spy was caught, they get a chance to guess the word
    if (state._caughtSpies.length > 0) {
        startSpyGuessingPhase();
    } else {
        // No spies caught, go straight to results
        finishGuessingPhase(false); // false because no guess was made
    }
}

function startSpyGuessingPhase(isClientMode = false) {
    if (!isClientMode && isOnline && isHost) {
        broadcastGameState('spyGuessing');
    }

    const caughtNames = state._caughtSpies.map(s => s.name).join(' و ');
    spyGuessInstruction.textContent = `دور ${caughtNames} في التوقع`;

    // Populate words from current category: 4 wrong + 1 correct
    // Clean all words to get just the base words
    let allBaseWords = window.WORDS_DB[state.selectedCategory].map(item => {
        if (typeof item === 'string' && item.includes('|')) return item.split('|')[0];
        return item;
    });

    // Remove the actual word and the fake word (so they don't randomly guess their fake word as the correct answer)
    let wrongWords = allBaseWords.filter(w => w !== state.currentWord && w !== state.currentFakeWord);
    wrongWords = shuffleArray(wrongWords).slice(0, 4);

    let guessOptions = [...wrongWords, state.currentWord];
    guessOptions = shuffleArray(guessOptions);

    spyGuessWordsList.innerHTML = '';
    spyGuessWordsList.className = 'stacked-grid';

    guessOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.textContent = opt;
        btn.onclick = () => {
            if (isOnline && !isHost) {
                socket.emit('clientEvent', { type: 'submitSpyGuess', guessedWord: opt, playerId: myPlayerId });
                spyGuessWordsList.innerHTML = '<div style="text-align:center;">تم إرسال توقعك...</div>';
            } else {
                submitSpyGuess(opt, isOnline ? myPlayerId : null);
            }
        };
        spyGuessWordsList.appendChild(btn);
    });

    if (isOnline) {
        const amICaughtSpy = state._caughtSpies.some(s => s.id === myPlayerId);
        if (!amICaughtSpy) {
            spyGuessWordsList.innerHTML = '<div style="text-align:center; padding: 20px;">في انتظار المجرمين يحاولون يرقعون السالفة... ⏳</div>';
        }
    }

    switchScreen('spyGuess');
}

function submitSpyGuess(guessedWord, playerId) {
    const isCorrect = (guessedWord === state.currentWord);
    finishGuessingPhase(isCorrect);
}

function finishGuessingPhase(guessedCorrectly, isClientMode = false) {
    if (isOnline && !isHost && !isClientMode) return; // Only host completes this

    const spies = state.players.filter(p => p.role === 'spy');
    actualSpyName.textContent = spies.map(s => s.name).join(' و ');

    if (state._caughtSpies.length > 0) {
        if (guessedCorrectly) {
            playSound(audioTada);
            roundResultMsg.textContent = "تم كشف برا السالفة، لكنه عرف السالفة ونجا! +2 نقطة له.";
            roundResultMsg.style.color = "var(--primary)";
            state._caughtSpies.forEach(spy => spy.score += 2);
        } else {
            playSound(audioFail);
            roundResultMsg.textContent = `تم كشف ${state._caughtSpies.length} من برا السالفة وما عرفوا الكلمة! +1 نقطة للبقية.`;
            roundResultMsg.style.color = "var(--primary)";

            // Give normal players points
            state.players.forEach(p => {
                if (p.role !== 'spy') p.score += 1;
            });
        }
    } else {
        playSound(audioTada);
        roundResultMsg.textContent = "نجا برا السالفة! +2 نقطة لهم.";
        roundResultMsg.style.color = "var(--danger)";
        // Only uncaught spies get points here
        state._uncaughtSpies.forEach(spy => spy.score += 2);
    }

    // Note: Any spy that was NOT caught always gets their base survival points 
    // regardless if their partner was caught or guessed correctly.
    if (state._uncaughtSpies.length > 0) {
        state._uncaughtSpies.forEach(spy => spy.score += 2);
    }

    // Economy: Deduct 1 round from paid category, Add reward points ONLY ONCE BY HOST
    if (isHost || !isOnline) {
        if (!FREE_CATEGORIES.includes(state.selectedCategory)) {
            if (unlockState.categories[state.selectedCategory] && unlockState.categories[state.selectedCategory] > 0) {
                unlockState.categories[state.selectedCategory]--;
            }
        }
        unlockState.points += ROUND_REWARD;
        saveUnlockState();
    }

    if (!isClientMode && isOnline && isHost) {
        broadcastGameState('roundResults', { guessedCorrectly });
    }

    showRoundResultsClient(guessedCorrectly);
}

function showRoundResultsClient(guessedCorrectly) {
    const spies = state.players.filter(p => p.role === 'spy');
    actualSpyName.textContent = spies.map(s => s.name).join(' و ');

    if (state._caughtSpies.length > 0) {
        if (guessedCorrectly) {
            playSound(audioTada);
            roundResultMsg.textContent = "تم كشف برا السالفة، لكنه عرف السالفة ونجا! +2 نقطة له.";
            roundResultMsg.style.color = "var(--primary)";
        } else {
            playSound(audioFail);
            roundResultMsg.textContent = `تم كشف ${state._caughtSpies.length} من برا السالفة وما عرفوا الكلمة! +1 نقطة للبقية.`;
            roundResultMsg.style.color = "var(--primary)";
        }
    } else {
        playSound(audioTada);
        roundResultMsg.textContent = "نجا برا السالفة! +2 نقطة لهم.";
        roundResultMsg.style.color = "var(--danger)";
    }

    renderLeaderboard(roundLeaderboardList);

    if (isOnline && !isHost) {
        btnNextRound.style.display = 'none';
        btnNewGame.style.display = 'none';
    } else {
        btnNextRound.style.display = 'block';
        btnNewGame.style.display = 'block';
    }

    switchScreen('roundResults');
}

function renderLeaderboard(listElement) {
    listElement.innerHTML = '';

    // Sort by score
    const sorted = [...state.players].sort((a, b) => b.score - a.score);

    sorted.forEach((p, idx) => {
        const li = document.createElement('li');
        const isSelf = p.name === sorted[idx].name; // always true, just for logic context
        li.innerHTML = `
            <span>${idx + 1}. ${p.name}</span>
            <span>${p.score} pt</span>
        `;
        listElement.appendChild(li);
    });
}

function nextRound() {
    if (isOnline && !isHost) return;
    if (state.currentRound < state.rounds) {
        state.currentRound++;
        prepareRound();
    } else {
        if (isOnline && isHost) broadcastGameState('finalResults');
        showFinalResults();
    }
}

function showFinalResults() {
    // تصفير النقاط الخاصة بالتلميحات بعد انتهاء الجولات
    state.players.forEach(p => p.hintPoints = 0);

    renderLeaderboard(finalLeaderboardList);

    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    finalWinnerName.textContent = sorted[0].name;
    playSound(audioTada);

    renderStats();

    if (isOnline && !isHost) {
        btnNewGame.style.display = 'none';
        // Note: You might have another button for changing settings, but btnNewGame usually restarts.
    } else {
        btnNewGame.style.display = 'block';
    }

    switchScreen('finalResults');
}

function renderStats() {
    statsList.innerHTML = '';

    // Find most voted (excluding actual spies to make it funnier)
    let maxVotes = 0;
    let mostVotedPlayer = null;
    let maxCorrectVotes = 0;
    let bestDetective = null;

    Object.entries(state.stats.mostVoted).forEach(([name, count]) => {
        const p = state.players.find(x => x.name === name);
        if (p && p.role !== 'spy' && count > maxVotes) {
            maxVotes = count;
            mostVotedPlayer = name;
        }
    });

    Object.entries(state.stats.correctVotes).forEach(([name, count]) => {
        if (count > maxCorrectVotes) {
            maxCorrectVotes = count;
            bestDetective = name;
        }
    });

    if (mostVotedPlayer && maxVotes > 0) {
        statsList.innerHTML += `
            <li>
                <span class="stats-icon">🤨</span>
                <span><strong>أكثر شخص مشبوه ماله ذنب:</strong> ${mostVotedPlayer} (${maxVotes} أصوات)</span>
            </li>
        `;
    } else {
        statsList.innerHTML += `
            <li>
                <span class="stats-icon">😇</span>
                <span><strong>لعب نظيف:</strong> لم يتم ظلم أي شخص بريء!</span>
            </li>
        `;
    }

    if (bestDetective && maxCorrectVotes > 0) {
        statsList.innerHTML += `
            <li>
                <span class="stats-icon">🕵️</span>
                <span><strong>المحقق كونان الجلسة:</strong> ${bestDetective} (صادهم ${maxCorrectVotes} مرة)</span>
            </li>
        `;
    } else {
        statsList.innerHTML += `
            <li>
                <span class="stats-icon">🙈</span>
                <span><strong>المحققين نايمين:</strong> محد قدر يصيد برا السالفة صح!</span>
            </li>
        `;
    }

    statsContainer.style.display = 'block';
}

function resetGame() {
    if (isOnline && !isHost) return;

    state.players.forEach(p => {
        p.score = 0;
        p.hintPoints = 100;
        p.votedFor = null;
        p.role = 'normal';
        p.word = '';
    });

    if (isOnline && isHost) {
        state._currentPhase = 'lobby';
        socket.emit('hostEvent', {
            type: 'gameStateUpdate',
            eventType: 'resetGame',
            state: { phase: 'lobby', currentRound: 0 },
            players: state.players
        });
    }

    updateSetupUI();
    switchScreen('setup');
}

/**
 * Utilities
 */
function shuffleArray(array) {
    let curId = array.length;
    while (0 !== curId) {
        let randId = Math.floor(Math.random() * curId);
        curId -= 1;
        let tmp = array[curId];
        array[curId] = array[randId];
        array[randId] = tmp;
    }
    return array;
}

// Boot
init();
