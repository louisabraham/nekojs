/**
 * Neko.js - A JavaScript implementation of the classic Neko desktop pet
 *
 * Based on Neko98 by David Harvey (1998)
 * Original Neko by Masayuki Koba
 *
 * This JavaScript implementation created by AI (Claude) from the original C++ source
 * Licensed under GPL v3 (see LICENSE.md)
 */

(function () {
  "use strict";

  // Animation states (matching original Neko.h enum)
  const NekoState = {
    STOP: 0,
    WASH: 1,
    SCRATCH: 2,
    YAWN: 3,
    SLEEP: 4,
    AWAKE: 5,
    U_MOVE: 6, // Up
    D_MOVE: 7, // Down
    L_MOVE: 8, // Left
    R_MOVE: 9, // Right
    UL_MOVE: 10, // Up-Left
    UR_MOVE: 11, // Up-Right
    DL_MOVE: 12, // Down-Left
    DR_MOVE: 13, // Down-Right
    U_CLAW: 14, // Clawing upward (at top boundary)
    D_CLAW: 15, // Clawing downward (at bottom boundary)
    L_CLAW: 16, // Clawing left (at left boundary)
    R_CLAW: 17, // Clawing right (at right boundary)
  };

  // Behavior modes (matching original Action enum)
  const BehaviorMode = {
    CHASE_MOUSE: 0,
    RUN_AWAY_FROM_MOUSE: 1,
    RUN_AROUND_RANDOMLY: 2,
    PACE_AROUND_SCREEN: 3,
    RUN_AROUND: 4,
  };

  // Animation timing constants (in frames)
  const STOP_TIME = 4;
  const WASH_TIME = 10;
  const SCRATCH_TIME = 4;
  const YAWN_TIME = 3;
  const AWAKE_TIME = 3;
  const CLAW_TIME = 10;

  // Sprite size
  const SPRITE_SIZE = 32;

  class Neko {
    constructor(options = {}) {
      // Configuration
      this.fps = options.fps || 120; // Target FPS (default 120 for smooth movement)
      // Original used 16 pixels/tick for 640x480 screens (~2.5% of width)
      // Modern screens are ~3x larger, so default to 24 for similar feel
      this.speed = options.speed || 24;
      this.spriteSize = Math.max(16, Number(options.spriteSize) || SPRITE_SIZE);
      this.behaviorMode = options.behaviorMode || BehaviorMode.CHASE_MOUSE;
      this.idleThreshold = options.idleThreshold || 6; // Original m_dwIdleSpace = 6

      // State
      this.state = NekoState.STOP;
      this.tickCount = 0; // Increments every frame (like m_uTickCount)
      this.stateCount = 0; // Increments every 2 original ticks (like m_uStateCount)

      // Position (display position for smooth rendering)
      this.x = options.startX || 0;
      this.y = options.startY || 0;
      // Logic position (updated at original 5 FPS tick rate)
      this.logicX = this.x;
      this.logicY = this.y;
      // Previous logic position (for interpolation)
      this.prevLogicX = this.x;
      this.prevLogicY = this.y;
      // Target tracking
      this.targetX = this.x;
      this.targetY = this.y;
      this.oldTargetX = this.x;
      this.oldTargetY = this.y;
      // Movement deltas (preserved like m_nDX, m_nDY in original)
      this.moveDX = 0;
      this.moveDY = 0;

      // Bounds - clientWidth excludes scrollbar, innerHeight is viewport height
      this.boundsWidth =
        document.documentElement.clientWidth - this.spriteSize;
      this.boundsHeight = window.innerHeight - this.spriteSize;

      // Mouse tracking - null until first mouse event
      // This prevents neko from running somewhere before user moves mouse
      this.mouseX = null;
      this.mouseY = null;
      this.hasMouseMoved = false;

      // DOM element
      this.element = null;
      this.spriteImages = [];
      this.allowBehaviorChange = options.allowBehaviorChange !== false; // Default true

      // Animation lookup table (maps state to sprite indices)
      // Format: [frame1_index, frame2_index]
      // These MUST match the original C++ m_nAnimation table EXACTLY
      // From Neko.cpp lines 40-57:
      this.animationTable = [
        [28, 28], // STOP: m_nAnimation[STOP][0]=28, [1]=28
        [25, 28], // WASH: m_nAnimation[WASH][0]=25, [1]=28
        [26, 27], // SCRATCH: m_nAnimation[SCRATCH][0]=26, [1]=27
        [29, 29], // YAWN: m_nAnimation[YAWN][0]=29, [1]=29
        [30, 31], // SLEEP: m_nAnimation[SLEEP][0]=30, [1]=31
        [0, 0], // AWAKE: m_nAnimation[AWAKE][0]=0, [1]=0
        [1, 2], // U_MOVE: m_nAnimation[U_MOVE][0]=1, [1]=2
        [9, 10], // D_MOVE: m_nAnimation[D_MOVE][0]=9, [1]=10
        [13, 14], // L_MOVE: m_nAnimation[L_MOVE][0]=13, [1]=14
        [5, 6], // R_MOVE: m_nAnimation[R_MOVE][0]=5, [1]=6
        [15, 16], // UL_MOVE: m_nAnimation[UL_MOVE][0]=15, [1]=16
        [3, 4], // UR_MOVE: m_nAnimation[UR_MOVE][0]=3, [1]=4
        [11, 12], // DL_MOVE: m_nAnimation[DL_MOVE][0]=11, [1]=12
        [7, 8], // DR_MOVE: m_nAnimation[DR_MOVE][0]=7, [1]=8
        [17, 18], // U_CLAW: m_nAnimation[U_CLAW][0]=17, [1]=18
        [23, 24], // D_CLAW: m_nAnimation[D_CLAW][0]=23, [1]=24
        [21, 22], // L_CLAW: m_nAnimation[L_CLAW][0]=21, [1]=22
        [19, 20], // R_CLAW: m_nAnimation[R_CLAW][0]=19, [1]=20
      ];

      // Additional state for behaviors
      this.cornerIndex = 0;
      this.ballX = 0;
      this.ballY = 0;
      this.ballVX = 0;
      this.ballVY = 0;

      this.init();
    }

    init() {
      // Create the neko element with defensive styles to prevent global CSS interference
      this.element = document.createElement("div");
      this.element.className = "neko";
      this.element.style.cssText = `
        position: fixed;
        width: ${this.spriteSize}px;
        height: ${this.spriteSize}px;
        image-rendering: pixelated;
        pointer-events: ${this.allowBehaviorChange ? "auto" : "none"};
        cursor: ${this.allowBehaviorChange ? "pointer" : "default"};
        z-index: 999999;
        left: ${this.x}px;
        top: ${this.y}px;
        margin: 0;
        padding: 0;
        border: none;
        background: transparent;
        overflow: visible;
        box-sizing: border-box;
        user-select: none;
        -webkit-user-select: none;
      `;

      // Create image element with defensive styles to prevent global CSS interference
      const img = document.createElement("img");
      img.style.cssText = `
        width: 100%;
        height: 100%;
        background: transparent;
        border: none;
        margin: 0;
        padding: 0;
        max-width: none;
        max-height: none;
        display: block;
        box-sizing: border-box;
        user-select: none;
        -webkit-user-select: none;
        -webkit-user-drag: none;
        pointer-events: none;
      `;
      this.element.appendChild(img);

      document.body.appendChild(this.element);

      // Click to cycle through behaviors
      // Use mousedown instead of click - click requires mouseup on same element,
      // which fails if the cat moves between mousedown and mouseup
      if (this.allowBehaviorChange) {
        this.element.addEventListener("mousedown", (e) => {
          e.stopPropagation();
          e.preventDefault(); // Prevent text selection
          // Make cat appear surprised/awake
          this.setState(NekoState.AWAKE);
          this.cycleBehavior();
        });
      }

      // Track mouse position - set flag on first move
      document.addEventListener("mousemove", (e) => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        this.hasMouseMoved = true;
      });

      // Update bounds on resize
      window.addEventListener("resize", () => {
        this.boundsWidth =
          document.documentElement.clientWidth - this.spriteSize;
        this.boundsHeight = window.innerHeight - this.spriteSize;
      });

      // Random starting position within viewport
      this.x = Math.random() * this.boundsWidth;
      this.y = Math.random() * this.boundsHeight;
      this.logicX = this.x;
      this.logicY = this.y;
      this.prevLogicX = this.x;
      this.prevLogicY = this.y;
      // Initialize target to current position (so no initial movement)
      this.targetX = this.x + this.spriteSize / 2;
      this.targetY = this.y + this.spriteSize - 1;
      this.oldTargetX = this.targetX;
      this.oldTargetY = this.targetY;
      this.updatePosition();

      // Animation loop
      this.running = false;
      this.intervalId = null;
    }

    start() {
      if (this.running) return;
      this.running = true;

      // Calculate interval from FPS
      // Higher FPS = smoother movement while maintaining same speed
      const interval = 1000 / this.fps;
      this.intervalId = setInterval(() => {
        this.update();
      }, interval);
    }

    stop() {
      this.running = false;
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }

    setSprites(sprites) {
      this.spriteImages = sprites;
      this.updateSprite();
    }

    updateSprite() {
      if (this.spriteImages.length === 0) return;

      // Get the current animation frame index
      // Uses tickCount which is scaled to match original 5 FPS timing
      let frameIndex;
      if (this.state === NekoState.SLEEP) {
        // Slower animation for sleep (toggles every 4 ticks in original = 800ms)
        frameIndex =
          this.animationTable[this.state][(this.tickCount >> 2) & 0x1];
      } else {
        // Normal animation speed (toggles every tick in original = 200ms)
        frameIndex = this.animationTable[this.state][this.tickCount & 0x1];
      }

      // Update the image
      const img = this.element.querySelector("img");
      if (img && this.spriteImages[frameIndex]) {
        img.src = this.spriteImages[frameIndex];
      }
    }

    updatePosition() {
      this.element.style.left = Math.round(this.x) + "px";
      this.element.style.top = Math.round(this.y) + "px";
    }

    setPosition(x, y) {
      const nextX = Math.max(0, Math.min(this.boundsWidth, x));
      const nextY = Math.max(0, Math.min(this.boundsHeight, y));
      this.x = nextX;
      this.y = nextY;
      this.logicX = nextX;
      this.logicY = nextY;
      this.prevLogicX = nextX;
      this.prevLogicY = nextY;
      this.targetX = nextX + this.spriteSize / 2;
      this.targetY = nextY + this.spriteSize - 1;
      this.oldTargetX = this.targetX;
      this.oldTargetY = this.targetY;
      this.updatePosition();
    }

    setTarget(x, y) {
      this.mouseX = x;
      this.mouseY = y;
      this.hasMouseMoved = true;
    }

    update() {
      // Track time accumulator for original tick timing
      // Original runs at 5 FPS (200ms per tick), we run at this.fps
      // We need to accumulate fractional ticks and process when we hit a full tick
      if (this.tickAccumulator === undefined) this.tickAccumulator = 0;

      const originalFPS = 5;
      this.tickAccumulator += originalFPS / this.fps;

      // Process as many original ticks as have accumulated
      while (this.tickAccumulator >= 1) {
        this.tickAccumulator -= 1;
        // Save previous position before processing tick
        this.prevLogicX = this.logicX;
        this.prevLogicY = this.logicY;
        this.processOriginalTick();
      }

      // Smooth interpolation between logic positions
      // tickAccumulator represents progress (0-1) towards next tick
      const t = this.tickAccumulator;
      this.x = this.prevLogicX + (this.logicX - this.prevLogicX) * t;
      this.y = this.prevLogicY + (this.logicY - this.prevLogicY) * t;

      // Update display position every frame
      this.updatePosition();
    }

    processOriginalTick() {
      // This runs at the original 5 FPS equivalent timing
      // Increment tick counter (like m_uTickCount)
      this.tickCount++;
      if (this.tickCount >= 9999) this.tickCount = 0;

      // Increment state counter every 2 ticks (like original)
      if (this.tickCount % 2 === 0) {
        this.stateCount++;
      }

      // Update behavior based on mode
      switch (this.behaviorMode) {
        case BehaviorMode.CHASE_MOUSE:
          this.chaseMouse();
          break;
        case BehaviorMode.RUN_AWAY_FROM_MOUSE:
          this.runAwayFromMouse();
          break;
        case BehaviorMode.RUN_AROUND_RANDOMLY:
          this.runRandomly();
          break;
        case BehaviorMode.PACE_AROUND_SCREEN:
          this.paceAroundScreen();
          break;
        case BehaviorMode.RUN_AROUND:
          this.runAround();
          break;
      }

      // Update animation frame
      this.updateSprite();
    }

    chaseMouse() {
      // Don't chase until mouse has moved at least once
      if (!this.hasMouseMoved) {
        // Just idle in place - pass target that results in zero movement
        this.runTowards(
          this.logicX + this.spriteSize / 2,
          this.logicY + this.spriteSize - 1
        );
        return;
      }
      this.runTowards(this.mouseX, this.mouseY);
    }

    runAwayFromMouse() {
      // Don't run away until mouse has moved
      if (!this.hasMouseMoved) {
        this.runTowards(
          this.logicX + this.spriteSize / 2,
          this.logicY + this.spriteSize - 1
        );
        return;
      }

      // Original uses m_dwIdleSpace * 16 as the trigger distance
      const dwLimit = this.idleThreshold * 16;
      const xdiff = this.logicX + this.spriteSize / 2 - this.mouseX;
      const ydiff = this.logicY + this.spriteSize / 2 - this.mouseY;

      if (Math.abs(xdiff) < dwLimit && Math.abs(ydiff) < dwLimit) {
        // Mouse cursor is too close - run away
        const dLength = Math.sqrt(xdiff * xdiff + ydiff * ydiff);
        let targetX, targetY;
        if (dLength !== 0) {
          targetX = this.logicX + (xdiff / dLength) * dwLimit;
          targetY = this.logicY + (ydiff / dLength) * dwLimit;
        } else {
          targetX = targetY = this.spriteSize;
        }
        this.runTowards(targetX, targetY);
        // Skip awake animation like original
        if (this.state === NekoState.AWAKE) {
          this.calcDirection(targetX - this.logicX, targetY - this.logicY);
        }
      } else {
        // Keep running to current target (idle in place)
        this.runTowards(this.targetX, this.targetY);
      }
    }

    runRandomly() {
      // Original: increments actionCount while sleeping, picks new target after idleSpace*10
      if (this.state === NekoState.SLEEP) {
        this.actionCount = (this.actionCount || 0) + 1;
      }
      if ((this.actionCount || 0) > this.idleThreshold * 10) {
        this.actionCount = 0;
        this.targetX = Math.random() * this.boundsWidth;
        this.targetY = Math.random() * this.boundsHeight;
        this.runTowards(this.targetX, this.targetY);
      } else {
        this.runTowards(this.targetX, this.targetY);
      }
    }

    paceAroundScreen() {
      // Original checks if neko has stopped moving (m_nDX == 0 && m_nDY == 0)
      // We track this via lastMoveDX/DY
      if (this.lastMoveDX === 0 && this.lastMoveDY === 0) {
        this.cornerIndex = ((this.cornerIndex || 0) + 1) % 4;
      }

      // Corners offset by sprite size (matching original)
      // Target positions that result in neko stopping at the corners
      const corners = [
        [
          this.spriteSize + this.spriteSize / 2,
          this.spriteSize + this.spriteSize - 1,
        ],
        [
          this.spriteSize + this.spriteSize / 2,
          this.boundsHeight - this.spriteSize + this.spriteSize - 1,
        ],
        [
          this.boundsWidth - this.spriteSize + this.spriteSize / 2,
          this.boundsHeight - this.spriteSize + this.spriteSize - 1,
        ],
        [
          this.boundsWidth - this.spriteSize + this.spriteSize / 2,
          this.spriteSize + this.spriteSize - 1,
        ],
      ];

      const target = corners[this.cornerIndex || 0];
      this.runTowards(target[0], target[1]);
    }

    runAround() {
      // Original ball physics with repelling from edges
      const dwBoundingBox = this.speed * 8;

      // Initialize ball if needed (matching original constructor)
      if (this.ballX === 0 && this.ballY === 0) {
        this.ballX = Math.random() * (this.boundsWidth - dwBoundingBox);
        this.ballY = Math.random() * (this.boundsHeight - dwBoundingBox);
        this.ballVX = (Math.random() < 0.5 ? 1 : -1) * (this.speed / 2) + 1;
        this.ballVY = (Math.random() < 0.5 ? 1 : -1) * (this.speed / 2) + 1;
      }

      // Move invisible ball
      this.ballX += this.ballVX;
      this.ballY += this.ballVY;

      // Repel from edges (original logic)
      if (this.ballX < dwBoundingBox) {
        if (this.ballX > 0) this.ballVX++;
        else this.ballVX = -this.ballVX;
      } else if (this.ballX > this.boundsWidth - dwBoundingBox) {
        if (this.ballX < this.boundsWidth) this.ballVX--;
        else this.ballVX = -this.ballVX;
      }

      if (this.ballY < dwBoundingBox) {
        if (this.ballY > 0) this.ballVY++;
        else this.ballVY = -this.ballVY;
      } else if (this.ballY > this.boundsHeight - dwBoundingBox) {
        if (this.ballY < this.boundsHeight) this.ballVY--;
        else this.ballVY = -this.ballVY;
      }

      this.runTowards(this.ballX, this.ballY);
    }

    setState(newState) {
      // Reset counters on state change (like original SetState)
      this.tickCount = 0;
      this.stateCount = 0;
      this.state = newState;
    }

    runTowards(targetX, targetY) {
      // Store old target for MoveStart check
      this.oldTargetX = this.targetX;
      this.oldTargetY = this.targetY;
      this.targetX = targetX;
      this.targetY = targetY;

      // Calculate distance to target (using logic position, not display position)
      const dx = targetX - this.logicX - this.spriteSize / 2; // Stop in middle of cursor
      const dy = targetY - this.logicY - this.spriteSize + 1; // Just above cursor
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Calculate movement delta (like original m_nDX, m_nDY)
      // Store as instance variables so they persist across ticks
      // IMPORTANT: Use integers like original to prevent direction flickering
      // which causes state resets and prevents wall clawing
      if (distance !== 0) {
        if (distance <= this.speed) {
          // Less than top speed - jump the gap
          this.moveDX = Math.trunc(dx);
          this.moveDY = Math.trunc(dy);
        } else {
          // More than top speed - run at top speed
          this.moveDX = Math.trunc((this.speed * dx) / distance);
          this.moveDY = Math.trunc((this.speed * dy) / distance);
        }
      } else {
        this.moveDX = 0;
        this.moveDY = 0;
      }

      // Store for paceAroundScreen check
      this.lastMoveDX = this.moveDX;
      this.lastMoveDY = this.moveDY;

      // Check if target moved (MoveStart equivalent)
      const moveStart = !(
        this.oldTargetX >= this.targetX - this.idleThreshold &&
        this.oldTargetX <= this.targetX + this.idleThreshold &&
        this.oldTargetY >= this.targetY - this.idleThreshold &&
        this.oldTargetY <= this.targetY + this.idleThreshold
      );

      // State machine (matching original RunTowards switch)
      switch (this.state) {
        case NekoState.STOP:
          if (moveStart) {
            this.setState(NekoState.AWAKE);
          } else if (this.stateCount >= STOP_TIME) {
            // Check for wall scratching using preserved moveDX/moveDY
            if (this.moveDX < 0 && this.logicX <= 0) {
              this.setState(NekoState.L_CLAW);
            } else if (this.moveDX > 0 && this.logicX >= this.boundsWidth) {
              this.setState(NekoState.R_CLAW);
            } else if (this.moveDY < 0 && this.logicY <= 0) {
              this.setState(NekoState.U_CLAW);
            } else if (this.moveDY > 0 && this.logicY >= this.boundsHeight) {
              this.setState(NekoState.D_CLAW);
            } else {
              this.setState(NekoState.WASH);
            }
          }
          break;

        case NekoState.WASH:
          if (moveStart) {
            this.setState(NekoState.AWAKE);
          } else if (this.stateCount >= WASH_TIME) {
            this.setState(NekoState.SCRATCH);
          }
          break;

        case NekoState.SCRATCH:
          if (moveStart) {
            this.setState(NekoState.AWAKE);
          } else if (this.stateCount >= SCRATCH_TIME) {
            this.setState(NekoState.YAWN);
          }
          break;

        case NekoState.YAWN:
          if (moveStart) {
            this.setState(NekoState.AWAKE);
          } else if (this.stateCount >= YAWN_TIME) {
            this.setState(NekoState.SLEEP);
          }
          break;

        case NekoState.SLEEP:
          if (moveStart) {
            this.setState(NekoState.AWAKE);
          }
          break;

        case NekoState.AWAKE:
          if (this.stateCount >= AWAKE_TIME + Math.floor(Math.random() * 20)) {
            this.calcDirection(this.moveDX, this.moveDY);
          }
          break;

        case NekoState.U_MOVE:
        case NekoState.D_MOVE:
        case NekoState.L_MOVE:
        case NekoState.R_MOVE:
        case NekoState.UL_MOVE:
        case NekoState.UR_MOVE:
        case NekoState.DL_MOVE:
        case NekoState.DR_MOVE:
          // Calculate new position using preserved moveDX/moveDY
          let newX = this.logicX + this.moveDX;
          let newY = this.logicY + this.moveDY;
          const wasOutside =
            newX <= 0 ||
            newX >= this.boundsWidth ||
            newY <= 0 ||
            newY >= this.boundsHeight;

          // Update direction
          this.calcDirection(this.moveDX, this.moveDY);

          // Clamp position
          newX = Math.max(0, Math.min(this.boundsWidth, newX));
          newY = Math.max(0, Math.min(this.boundsHeight, newY));
          const notMoved = newX === this.logicX && newY === this.logicY;

          // Stop if we can't go further
          if (wasOutside && notMoved) {
            this.setState(NekoState.STOP);
          } else {
            this.logicX = newX;
            this.logicY = newY;
          }
          break;

        case NekoState.U_CLAW:
        case NekoState.D_CLAW:
        case NekoState.L_CLAW:
        case NekoState.R_CLAW:
          if (moveStart) {
            this.setState(NekoState.AWAKE);
          } else if (this.stateCount >= CLAW_TIME) {
            this.setState(NekoState.SCRATCH);
          }
          break;

        default:
          this.setState(NekoState.STOP);
          break;
      }
    }

    calcDirection(dx, dy) {
      // Calculate direction based on movement delta (like original CalcDirection)
      let newState;

      if (dx === 0 && dy === 0) {
        newState = NekoState.STOP;
      } else {
        const largeX = dx;
        const largeY = -dy; // Y is inverted
        const length = Math.sqrt(largeX * largeX + largeY * largeY);
        const sinTheta = largeY / length;

        const sinPiPer8 = 0.3826834323651;
        const sinPiPer8Times3 = 0.9238795325113;

        if (dx > 0) {
          if (sinTheta > sinPiPer8Times3) {
            newState = NekoState.U_MOVE;
          } else if (sinTheta > sinPiPer8) {
            newState = NekoState.UR_MOVE;
          } else if (sinTheta > -sinPiPer8) {
            newState = NekoState.R_MOVE;
          } else if (sinTheta > -sinPiPer8Times3) {
            newState = NekoState.DR_MOVE;
          } else {
            newState = NekoState.D_MOVE;
          }
        } else {
          if (sinTheta > sinPiPer8Times3) {
            newState = NekoState.U_MOVE;
          } else if (sinTheta > sinPiPer8) {
            newState = NekoState.UL_MOVE;
          } else if (sinTheta > -sinPiPer8) {
            newState = NekoState.L_MOVE;
          } else if (sinTheta > -sinPiPer8Times3) {
            newState = NekoState.DL_MOVE;
          } else {
            newState = NekoState.D_MOVE;
          }
        }
      }

      if (this.state !== newState) {
        this.setState(newState);
      }
    }

    isIdle() {
      return (
        this.state === NekoState.STOP ||
        this.state === NekoState.WASH ||
        this.state === NekoState.SCRATCH ||
        this.state === NekoState.YAWN ||
        this.state === NekoState.SLEEP ||
        this.state === NekoState.AWAKE
      );
    }

    cycleBehavior() {
      // Cycle through behaviors: Chase -> Run Away -> Random -> Pace -> Run Around -> back to Chase
      const behaviors = [
        BehaviorMode.CHASE_MOUSE,
        BehaviorMode.RUN_AWAY_FROM_MOUSE,
        BehaviorMode.RUN_AROUND_RANDOMLY,
        BehaviorMode.PACE_AROUND_SCREEN,
        BehaviorMode.RUN_AROUND,
      ];
      const currentIndex = behaviors.indexOf(this.behaviorMode);
      const nextIndex = (currentIndex + 1) % behaviors.length;
      this.behaviorMode = behaviors[nextIndex];

      // Reset state to wake the cat up if sleeping
      if (this.state === NekoState.SLEEP) {
        this.setState(NekoState.AWAKE);
      }

      // Show behavior name (optional - can be removed if you don't want this)
      const behaviorNames = [
        "Chase Mouse",
        "Run Away From Mouse",
        "Run Around Randomly",
        "Pace Around Screen",
        "Run Around",
      ];
      console.log(`Neko behavior: ${behaviorNames[nextIndex]}`);
    }

    destroy() {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    }
  }

  // Export to global scope
  window.Neko = Neko;
  window.NekoState = NekoState;
  window.BehaviorMode = BehaviorMode;
})();
