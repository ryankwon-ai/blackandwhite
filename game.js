/**
 * Baduk Transposition 1v1 Battle Game Engine
 * Mode: Shared Stones (Mode 1), User Starts First
 */

// Sound Synthesizer via Web Audio API
class BattleAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
  }

  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.5) {
    if (!this.enabled) return;
    try {
      this.init();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn('Audio tone failed', e);
    }
  }

  playPlaceStone(isJump = false) {
    if (!this.enabled) return;
    try {
      this.init();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = isJump ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isJump ? 380 : 270, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);

      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {
      console.warn('Audio place failed', e);
    }
  }

  playIllegal() {
    this.playTone(140, 'sawtooth', 0.15, 0.4);
  }

  playTurnChime(isUser) {
    this.playTone(isUser ? 523.25 : 392.00, 'triangle', 0.12, 0.3);
  }

  playVictory() {
    if (!this.enabled) return;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.35, 0.4), i * 110);
    });
  }

  playDefeat() {
    if (!this.enabled) return;
    const notes = [440, 392, 349.23, 293.66];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 'sawtooth', 0.3, 0.35), i * 150);
    });
  }
}

// Confetti Engine
class ConfettiEffect {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.animId = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start() {
    this.particles = [];
    const colors = ['#00d2ff', '#ff3b69', '#ffbe0b', '#48bb78', '#9f7aea', '#ffffff'];
    for (let i = 0; i < 150; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height - this.canvas.height,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 5,
        vy: Math.random() * 5 + 3,
        rot: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 8
      });
    }
    if (!this.animId) this.loop();
  }

  loop() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let alive = false;
    this.particles.forEach(p => {
      p.y += p.vy;
      p.x += p.vx;
      p.rot += p.vRot;
      if (p.y < this.canvas.height) alive = true;

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rot * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      this.ctx.restore();
    });

    if (alive) {
      this.animId = requestAnimationFrame(() => this.loop());
    } else {
      this.animId = null;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

// 5x5 Baduk Transposition Puzzle Configurations
const GOAL_STATE = [
  2, 2, 2, 1, 1,
  2, 2, 2, 1, 1,
  2, 2, 0, 1, 1,
  2, 2, 1, 1, 1,
  2, 2, 1, 1, 1
];

const INITIAL_STATE = [
  1, 1, 1, 2, 2,
  1, 1, 1, 2, 2,
  1, 1, 0, 2, 2,
  1, 1, 2, 2, 2,
  1, 1, 2, 2, 2
];

class BattleGame {
  constructor() {
    this.board = [...INITIAL_STATE];
    this.currentTurn = 'user'; // 'user' always starts first as requested
    this.totalMoves = 0;
    this.userMoves = 0;
    this.cpuMoves = 0;
    this.isGameOver = false;
    this.timerSeconds = 0;
    this.timerInterval = null;
    this.lastMoveInfo = null;

    this.audio = new BattleAudio();
    this.confetti = new ConfettiEffect(document.getElementById('confettiCanvas'));

    this.cacheDOMElements();
    this.bindEvents();
    this.renderMiniGoal();
    this.showScreen('intro');
  }

  cacheDOMElements() {
    // Screens
    this.screens = {
      intro: document.getElementById('introScreen'),
      game: document.getElementById('gameScreen'),
      result: document.getElementById('resultScreen')
    };

    // Buttons
    this.startGameBtn = document.getElementById('startGameBtn');
    this.introRuleBtn = document.getElementById('introRuleBtn');
    this.gameRuleBtn = document.getElementById('gameRuleBtn');
    this.rematchBtn = document.getElementById('rematchBtn');
    this.goIntroBtn = document.getElementById('goIntroBtn');
    this.forfeitBtn = document.getElementById('forfeitBtn');
    this.soundToggleBtn = document.getElementById('soundToggleBtn');

    // Modals
    this.rulesModal = document.getElementById('rulesModal');
    this.closeRulesBtn = document.getElementById('closeRulesBtn');
    this.confirmRulesBtn = document.getElementById('confirmRulesBtn');

    // In-game HUD
    this.gobanEl = document.getElementById('goban');
    this.miniGoalGobanEl = document.getElementById('miniGoalGoban');
    this.userProfile = document.getElementById('userProfile');
    this.cpuProfile = document.getElementById('cpuProfile');
    this.turnAnnouncer = document.getElementById('turnAnnouncer');
    this.turnLabel = document.getElementById('turnLabel');
    this.turnSub = document.getElementById('turnSub');
    this.turnCounter = document.getElementById('turnCounter');
    this.timerText = document.getElementById('timerText');
    this.progressBar = document.getElementById('progressBar');
    this.matchPercent = document.getElementById('matchPercent');
    this.tipBanner = document.getElementById('tipBanner');
    this.logList = document.getElementById('logList');
    this.logCountBadge = document.getElementById('logCountBadge');

    // Results Screen elements
    this.resultBanner = document.getElementById('resultBanner');
    this.resultEmblem = document.getElementById('resultEmblem');
    this.resultTitle = document.getElementById('resultTitle');
    this.resultSubtitle = document.getElementById('resultSubtitle');
    this.resWinnerName = document.getElementById('resWinnerName');
    this.resTotalTurns = document.getElementById('resTotalTurns');
    this.resDuration = document.getElementById('resDuration');
    this.resMoveSplit = document.getElementById('resMoveSplit');
  }

  bindEvents() {
    this.startGameBtn.addEventListener('click', () => this.startNewMatch());
    this.rematchBtn.addEventListener('click', () => this.startNewMatch());
    this.goIntroBtn.addEventListener('click', () => this.showScreen('intro'));

    // Rules modal
    const openRules = () => this.rulesModal.classList.add('open');
    const closeRules = () => this.rulesModal.classList.remove('open');
    this.introRuleBtn.addEventListener('click', openRules);
    this.gameRuleBtn.addEventListener('click', openRules);
    this.closeRulesBtn.addEventListener('click', closeRules);
    this.confirmRulesBtn.addEventListener('click', closeRules);
    this.rulesModal.addEventListener('click', (e) => {
      if (e.target === this.rulesModal) closeRules();
    });

    // Forfeit button
    this.forfeitBtn.addEventListener('click', () => {
      if (this.isGameOver) return;
      if (confirm('정말로 기권하시겠습니까? 컴퓨터의 승리로 처리됩니다.')) {
        this.endGame('cpu', '기권패 (사용자 기권)');
      }
    });

    // Sound toggle
    this.soundToggleBtn.addEventListener('click', () => {
      this.audio.enabled = !this.audio.enabled;
      this.soundToggleBtn.textContent = this.audio.enabled ? '🔊 소리 켜짐' : '🔇 음소거';
    });
  }

  showScreen(name) {
    Object.keys(this.screens).forEach(key => {
      this.screens[key].classList.toggle('active', key === name);
    });
    if (name !== 'result') {
      this.confetti.stop();
    }
  }

  startNewMatch() {
    this.board = [...INITIAL_STATE];
    this.currentTurn = 'user'; // User always first
    this.totalMoves = 0;
    this.userMoves = 0;
    this.cpuMoves = 0;
    this.isGameOver = false;
    this.lastMoveInfo = null;
    this.timerSeconds = 0;

    this.stopTimer();
    this.startTimer();

    this.logList.innerHTML = '<div class="log-empty">대전 시작! 사용자 선공입니다.</div>';
    this.logCountBadge.textContent = '0 수';

    this.showScreen('game');
    this.updateHUD();
    this.renderBoard();
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.timerSeconds++;
      const m = Math.floor(this.timerSeconds / 60).toString().padStart(2, '0');
      const s = (this.timerSeconds % 60).toString().padStart(2, '0');
      this.timerText.textContent = `${m}:${s}`;
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  getEmptyIndex(state = this.board) {
    return state.indexOf(0);
  }

  /**
   * Determine legal move to empty cell:
   * Rule 2: 1-step orthogonal
   * Rule 3: 2-step orthogonal jumping over 1 opposite-color stone
   */
  checkMoveLegal(fromIdx, state = this.board) {
    if (state[fromIdx] === 0) return { canMove: false, isJump: false };
    const emptyIdx = this.getEmptyIndex(state);

    const fr = Math.floor(fromIdx / 5);
    const fc = fromIdx % 5;
    const er = Math.floor(emptyIdx / 5);
    const ec = emptyIdx % 5;

    const dr = er - fr;
    const dc = ec - fc;

    // Rule 2: 1-step slide
    if (Math.abs(dr) + Math.abs(dc) === 1) {
      return { canMove: true, isJump: false };
    }

    // Rule 3: 2-step jump over opposite color stone
    if ((Math.abs(dr) === 2 && dc === 0) || (Math.abs(dc) === 2 && dr === 0)) {
      const midR = fr + dr / 2;
      const midC = fc + dc / 2;
      const midIdx = midR * 5 + midC;
      const midColor = state[midIdx];
      const movingColor = state[fromIdx];

      if (midColor !== 0 && midColor !== movingColor) {
        return { canMove: true, isJump: true };
      }
    }

    return { canMove: false, isJump: false };
  }

  /**
   * Return array of all valid move objects { from, to, isJump }
   */
  getAllLegalMoves(state = this.board) {
    const moves = [];
    const emptyIdx = this.getEmptyIndex(state);
    for (let i = 0; i < 25; i++) {
      if (state[i] !== 0) {
        const check = this.checkMoveLegal(i, state);
        if (check.canMove) {
          moves.push({
            from: i,
            to: emptyIdx,
            isJump: check.isJump,
            color: state[i]
          });
        }
      }
    }
    return moves;
  }

  /**
   * Handle user clicking a stone
   */
  handleUserClick(index) {
    if (this.isGameOver) return;
    if (this.currentTurn !== 'user') {
      this.tipBanner.textContent = '⏳ 컴퓨터가 생각 중입니다. 잠시 기다려주세요!';
      return;
    }

    const { canMove, isJump } = this.checkMoveLegal(index);
    if (!canMove) {
      // Illegal move feedback
      this.audio.playIllegal();
      const stoneEl = this.gobanEl.querySelector(`[data-index="${index}"] .stone`);
      if (stoneEl) {
        stoneEl.classList.add('shake-illegal');
        setTimeout(() => stoneEl.classList.remove('shake-illegal'), 380);
      }
      this.tipBanner.textContent = '❌ 규칙상 빈칸으로 이동할 수 없는 위치의 돌입니다.';
      return;
    }

    // Execute User Move
    this.executeMove(index, isJump, 'user');
  }

  /**
   * Execute move on board, animate, check win, and pass turn
   */
  executeMove(fromIdx, isJump, mover) {
    const emptyIdx = this.getEmptyIndex();
    const stoneColor = this.board[fromIdx];

    // Apply move
    this.board[emptyIdx] = stoneColor;
    this.board[fromIdx] = 0;

    this.totalMoves++;
    if (mover === 'user') this.userMoves++;
    else this.cpuMoves++;

    this.lastMoveInfo = {
      from: fromIdx,
      to: emptyIdx,
      isJump,
      mover,
      color: stoneColor
    };

    this.audio.playPlaceStone(isJump);
    this.appendLog(this.totalMoves, mover, stoneColor, isJump);
    this.renderBoard();
    this.updateHUD();

    // Check Win Condition: Did this move achieve GOAL_STATE?
    if (this.checkGoalAchieved()) {
      this.endGame(mover, '목표 [그림 2] 배치 최종 완성!');
      return;
    }

    // Switch Turn
    if (mover === 'user') {
      this.currentTurn = 'cpu';
      this.updateHUD();
      this.audio.playTurnChime(false);
      // Natural AI thinking delay
      setTimeout(() => this.executeCPUTurn(), 620);
    } else {
      this.currentTurn = 'user';
      this.updateHUD();
      this.audio.playTurnChime(true);
    }
  }

  /**
   * Computer AI Decision Engine
   */
  executeCPUTurn() {
    if (this.isGameOver) return;

    const legalMoves = this.getAllLegalMoves();
    if (legalMoves.length === 0) {
      // No legal moves available: opponent wins
      this.endGame('user', '컴퓨터 이동 불가로 패배');
      return;
    }

    // Evaluate each legal move
    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of legalMoves) {
      // Simulate move
      const nextBoard = [...this.board];
      nextBoard[move.to] = nextBoard[move.from];
      nextBoard[move.from] = 0;

      // 1. Instant Win Check: Does this move complete [그림 2]?
      const isWin = nextBoard.every((val, idx) => val === GOAL_STATE[idx]);
      if (isWin) {
        bestMove = move;
        break; // Take the winning move immediately!
      }

      // 2. Blunder Check: If AI makes this move, can user win on the very next turn?
      let allowsUserWin = false;
      const userNextMoves = this.getAllLegalMoves(nextBoard);
      for (const uMove of userNextMoves) {
        const uBoard = [...nextBoard];
        uBoard[uMove.to] = uBoard[uMove.from];
        uBoard[uMove.from] = 0;
        if (uBoard.every((v, i) => v === GOAL_STATE[i])) {
          allowsUserWin = true;
          break;
        }
      }

      // Calculate heuristic score
      let score = 0;
      if (allowsUserWin) {
        score -= 50000; // Heavily penalize giving opponent instant win
      }

      // Match count score (+100 for each stone matching goal)
      let matchCount = 0;
      for (let i = 0; i < 25; i++) {
        if (nextBoard[i] === GOAL_STATE[i]) matchCount++;
      }
      score += matchCount * 120;

      // Distance score: White stones should move toward left-top, Black toward right-bottom
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const val = nextBoard[r * 5 + c];
          if (val === 2) { // White stone: prefers low row and low col
            score += (4 - r) * 6 + (4 - c) * 6;
          } else if (val === 1) { // Black stone: prefers high row and high col
            score += r * 6 + c * 6;
          }
        }
      }

      // Prefer jumping over simple sliding (tactical mobility)
      if (move.isJump) score += 15;

      // Small random tie-breaker
      score += Math.random() * 8;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    if (!bestMove) {
      bestMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }

    this.executeMove(bestMove.from, bestMove.isJump, 'cpu');
  }

  checkGoalAchieved() {
    return this.board.every((val, idx) => val === GOAL_STATE[idx]);
  }

  endGame(winner, reason) {
    this.isGameOver = true;
    this.stopTimer();

    const isUserWin = winner === 'user';
    if (isUserWin) {
      this.audio.playVictory();
      this.confetti.start();
      this.resultBanner.className = 'result-banner victory';
      this.resultEmblem.textContent = '🏆';
      this.resultTitle.textContent = 'VICTORY! 사용자 승리!';
      this.resultSubtitle.textContent = reason || '뛰어난 수읽기로 [그림 2] 목표 배치를 완성했습니다!';
      this.resWinnerName.textContent = '사용자 (Player 1)';
      this.resWinnerName.style.color = 'var(--accent-gold)';
    } else {
      this.audio.playDefeat();
      this.resultBanner.className = 'result-banner defeat';
      this.resultEmblem.textContent = '🤖';
      this.resultTitle.textContent = 'DEFEAT! 컴퓨터 승리!';
      this.resultSubtitle.textContent = reason || '컴퓨터 AI가 마지막 결정타를 놓아 [그림 2]를 완성했습니다!';
      this.resWinnerName.textContent = '컴퓨터 AI (Player 2)';
      this.resWinnerName.style.color = 'var(--accent-red)';
    }

    this.resTotalTurns.textContent = `${this.totalMoves} 턴`;
    this.resDuration.textContent = this.timerText.textContent;
    this.resMoveSplit.textContent = `${this.userMoves}회 / ${this.cpuMoves}회`;

    setTimeout(() => {
      this.showScreen('result');
    }, 700);
  }

  appendLog(turnNum, mover, stoneColor, isJump) {
    const isFirst = this.logList.querySelector('.log-empty');
    if (isFirst) this.logList.innerHTML = '';

    const entry = document.createElement('div');
    entry.className = `log-entry ${mover}`;
    const moverName = mover === 'user' ? '사용자' : '컴퓨터';
    const colorName = stoneColor === 1 ? '흑돌' : '백돌';
    const action = isJump ? '점프 착수' : '1칸 이동';

    entry.innerHTML = `
      <span>#${turnNum} ${moverName}</span>
      <span>${colorName} ${action}</span>
    `;

    this.logList.prepend(entry);
    this.logCountBadge.textContent = `${turnNum} 수`;
  }

  updateHUD() {
    this.turnCounter.textContent = this.totalMoves;

    // Turn indicator
    const isUser = this.currentTurn === 'user';
    this.userProfile.classList.toggle('active', isUser);
    this.cpuProfile.classList.toggle('active', !isUser);

    if (isUser) {
      this.turnAnnouncer.className = 'turn-announcer user-turn';
      this.turnLabel.textContent = 'YOUR TURN';
      this.turnSub.textContent = '이동할 바둑돌을 선택하세요 (사용자 턴)';
      this.tipBanner.textContent = '💡 빈칸으로 이동(슬라이드) 또는 다른 색 돌을 뛰어넘을(점프) 돌을 클릭하세요.';
      this.gobanEl.classList.add('user-turn-active');
    } else {
      this.turnAnnouncer.className = 'turn-announcer cpu-turn';
      this.turnLabel.textContent = 'CPU THINKING...';
      this.turnSub.textContent = '컴퓨터 AI가 수를 계산 중입니다';
      this.tipBanner.textContent = '🤖 컴퓨터가 최적의 수를 연산하고 있습니다...';
      this.gobanEl.classList.remove('user-turn-active');
    }

    // Match percentage
    let match = 0;
    for (let i = 0; i < 25; i++) {
      if (this.board[i] === GOAL_STATE[i]) match++;
    }
    const percent = Math.round((match / 25) * 100);
    this.progressBar.style.width = `${percent}%`;
    this.matchPercent.textContent = `${percent}%`;
  }

  renderBoard() {
    this.gobanEl.innerHTML = '';
    const emptyIdx = this.getEmptyIndex();

    for (let i = 0; i < 25; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = i;

      // Star point at center
      if (i === 12) {
        cell.classList.add('star-point');
        const dot = document.createElement('div');
        dot.className = 'star-dot';
        cell.appendChild(dot);
      }

      const val = this.board[i];
      if (val === 0) {
        cell.classList.add('empty-slot');
      } else {
        const stone = document.createElement('div');
        stone.className = `stone ${val === 1 ? 'black' : 'white'}`;

        // Check if legal to move
        const { canMove } = this.checkMoveLegal(i);
        if (canMove) {
          stone.classList.add('can-move');
        }

        // Highlight if last moved to here
        if (this.lastMoveInfo && this.lastMoveInfo.to === i) {
          cell.classList.add('last-move-cell');
          stone.classList.add(this.lastMoveInfo.isJump ? 'jumping' : 'sliding');
        }

        // Hover target highlight
        if (canMove) {
          stone.addEventListener('mouseenter', () => {
            const emptyCell = this.gobanEl.querySelector('.empty-slot');
            if (emptyCell) emptyCell.classList.add('target-highlight');
          });
          stone.addEventListener('mouseleave', () => {
            const emptyCell = this.gobanEl.querySelector('.empty-slot');
            if (emptyCell) emptyCell.classList.remove('target-highlight');
          });
        }

        // Click handler
        stone.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleUserClick(i);
        });

        cell.appendChild(stone);
      }

      this.gobanEl.appendChild(cell);
    }
  }

  renderMiniGoal() {
    this.miniGoalGobanEl.innerHTML = '';
    for (let i = 0; i < 25; i++) {
      const cell = document.createElement('div');
      cell.className = 'mini-cell';
      const val = GOAL_STATE[i];
      if (val !== 0) {
        const stone = document.createElement('div');
        stone.className = `mini-stone ${val === 1 ? 'black' : 'white'}`;
        cell.appendChild(stone);
      }
      this.miniGoalGobanEl.appendChild(cell);
    }
  }
}

// Instantiate game on load
document.addEventListener('DOMContentLoaded', () => {
  window.battleGame = new BattleGame();
});
