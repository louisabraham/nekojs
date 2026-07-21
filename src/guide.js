/**
 * Optional guided companion mode for Neko.js.
 *
 * Turns Neko into an opt-in page guide that visits semantic HTML annotations,
 * explains nearby UI, waits at the viewport edge for off-screen targets, and
 * leaves a temporary paw marker so the previous message can be replayed.
 */

(function () {
  "use strict";

  const DEFAULT_GUIDE_SPRITE_SIZE = 32;
  const GUIDE_STYLE_ID = "neko-guide-styles";
  const DEFAULT_IDLE_MESSAGES = [
    "I am not asleep. I am conserving dramatic energy.",
    "Click me. Apparently the page will not tour itself.",
    "I know where everything is. Modesty is not included.",
    "This corner is mine now. I checked.",
    "Your cursor looks confident for someone without directions.",
    "I could help, but this nap has excellent momentum.",
    "Wake me when you are ready to pretend this was your idea.",
  ];

  class NekoGuide {
    constructor(neko, options = {}) {
      if (!neko) {
        throw new Error("NekoGuide requires a Neko instance");
      }

      this.neko = neko;
      this.spriteSize = neko.spriteSize || DEFAULT_GUIDE_SPRITE_SIZE;
      this.root = options.root || document;
      this.selector = options.selector || "[data-neko-guide]";
      this.getActiveGroup = options.getActiveGroup || null;
      this.messageDuration = options.messageDuration ?? 6000;
      this.recallDuration = options.recallDuration ?? 10000;
      this.idleMessageDuration = options.idleMessageDuration ?? 4000;
      this.idleMessageDelay = options.idleMessageDelay || [9000, 18000];
      this.idleMessages =
        options.idleMessages === false
          ? []
          : options.idleMessages || DEFAULT_IDLE_MESSAGES;
      this.arrivalDistance = options.arrivalDistance || 24;
      this.edgePadding = options.edgePadding || 24;
      this.targetGap = options.targetGap || 24;
      this.dockGap = options.dockGap || 16;
      this.scrollMessage =
        options.scrollMessage ||
        ((direction) => `Scroll ${direction} — there is more.`);
      this.wakeLabel = options.wakeLabel || "Wake Neko";
      this.restLabel = options.restLabel || "Let Neko rest";
      this.returningLabel =
        options.returningLabel || "Neko is returning to rest";
      this.recallLabel =
        options.recallLabel || "Replay Neko's previous message";
      this.destroyNeko = options.destroyNeko !== false;

      this.stops = [];
      this.stopIndex = 0;
      this.active = false;
      this.docking = false;
      this.arrived = false;
      this.waitingDirection = null;
      this.recallStop = null;
      this.spokenStop = null;
      this.messagePaused = false;
      this.bubbleHeld = false;
      this.recallPreviewVisible = false;
      this.lastIdleMessageIndex = -1;
      this.lastActiveGroup = undefined;
      this.destroyed = false;

      this.arrivalTimer = null;
      this.bubbleTimer = null;
      this.recallTimer = null;
      this.idleMessageTimer = null;
      this.dockTimer = null;
      this.dockTick = 0;
      this.frameId = null;
      this.refreshFrame = null;
      this.refreshNeedsRestart = false;

      this._onCatPointerDown = this._onCatPointerDown.bind(this);
      this._onCatKeyDown = this._onCatKeyDown.bind(this);
      this._onRecall = this._onRecall.bind(this);
      this._onRecallPreviewEnter = this._onRecallPreviewEnter.bind(this);
      this._onRecallPreviewLeave = this._onRecallPreviewLeave.bind(this);
      this._onBubbleEnter = this._onBubbleEnter.bind(this);
      this._onBubbleLeave = this._onBubbleLeave.bind(this);
      this._onResize = this._onResize.bind(this);
      this._onScroll = this._onScroll.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onRefreshRequest = this._onRefreshRequest.bind(this);
      this._loop = this._loop.bind(this);

      this._mount();
      this.refresh();

      if (options.startDocked === false) {
        this.wake();
      } else {
        this.dock({ immediate: true });
      }
    }

    _mount() {
      this._installStyles();

      this.bubble = document.createElement("div");
      this.bubble.className = "neko-guide__bubble";
      this.bubble.setAttribute("role", "status");
      this.bubble.setAttribute("aria-live", "polite");
      this.bubble.tabIndex = 0;
      this.bubble.hidden = true;
      document.body.appendChild(this.bubble);

      this.recallMarker = document.createElement("button");
      this.recallMarker.type = "button";
      this.recallMarker.className = "neko-guide__recall";
      this.recallMarker.setAttribute(
        "aria-label",
        this.recallLabel
      );
      this.recallMarker.title = "Replay previous message";
      this.recallMarker.innerHTML = '<span aria-hidden="true">🐾</span>';
      this.recallMarker.setAttribute("aria-expanded", "false");
      this.recallMarker.hidden = true;
      document.body.appendChild(this.recallMarker);

      this.recallPreview = document.createElement("div");
      this.recallPreview.className = "neko-guide__recall-preview";
      this.recallPreview.id = "neko-guide-recall-preview";
      this.recallPreview.setAttribute("role", "tooltip");
      this.recallPreview.hidden = true;
      this.recallMarker.setAttribute(
        "aria-describedby",
        this.recallPreview.id
      );
      document.body.appendChild(this.recallPreview);

      this.neko.element.classList.add("neko-guide__cat");
      this.neko.element.style.pointerEvents = "auto";
      this.neko.element.style.cursor = "pointer";
      this.neko.element.setAttribute("role", "button");
      this.neko.element.tabIndex = 0;
      const image = this.neko.element.querySelector("img");
      if (image) image.setAttribute("alt", "");

      this.neko.element.addEventListener(
        "pointerdown",
        this._onCatPointerDown
      );
      this.neko.element.addEventListener("keydown", this._onCatKeyDown);
      this.bubble.addEventListener("mouseenter", this._onBubbleEnter);
      this.bubble.addEventListener("mouseleave", this._onBubbleLeave);
      this.bubble.addEventListener("focus", this._onBubbleEnter);
      this.bubble.addEventListener("blur", this._onBubbleLeave);
      this.recallMarker.addEventListener("click", this._onRecall);
      this.recallMarker.addEventListener(
        "mouseenter",
        this._onRecallPreviewEnter
      );
      this.recallMarker.addEventListener(
        "mouseleave",
        this._onRecallPreviewLeave
      );
      this.recallMarker.addEventListener("focus", this._onRecallPreviewEnter);
      this.recallMarker.addEventListener("blur", this._onRecallPreviewLeave);
      window.addEventListener("resize", this._onResize);
      document.addEventListener("scroll", this._onScroll, {
        capture: true,
        passive: true,
      });
      document.addEventListener("mousemove", this._onMouseMove);
      window.addEventListener("neko-guide:refresh", this._onRefreshRequest);

      this.observer = new MutationObserver(() => {
        this._scheduleRefresh();
      });
      this.observer.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ["hidden", "aria-hidden", "class"],
      });
    }

    _installStyles() {
      if (document.getElementById(GUIDE_STYLE_ID)) return;

      const style = document.createElement("style");
      style.id = GUIDE_STYLE_ID;
      style.textContent = `
        [data-neko-guide] {
          display: none !important;
        }

        .neko.neko-guide__cat {
          pointer-events: auto !important;
          cursor: pointer !important;
          border-radius: 4px;
        }

        .neko-guide__cat img {
          transition: filter 150ms ease, transform 150ms ease;
        }

        .neko-guide__cat:hover img {
          filter: drop-shadow(0 2px 2px rgba(15, 23, 42, 0.28));
          transform: translateY(-1px);
        }

        .neko-guide__cat:focus-visible {
          outline: 3px solid rgba(245, 158, 11, 0.32);
          outline-offset: 3px;
        }

        .neko-guide__bubble {
          position: fixed;
          z-index: 1000001;
          max-width: min(240px, calc(100vw - 16px));
          border: 2px solid #0f172a;
          border-radius: 10px;
          background: #fffdf3;
          padding: 7px 11px;
          box-shadow: 3px 3px 0 rgba(15, 23, 42, 0.18);
          color: #0f172a;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            monospace;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.35;
          text-align: center;
          pointer-events: auto;
          cursor: help;
        }

        .neko-guide__bubble[hidden],
        .neko-guide__recall[hidden],
        .neko-guide__recall-preview[hidden] {
          display: none;
        }

        .neko-guide__bubble:hover,
        .neko-guide__bubble.is-held {
          box-shadow: 3px 3px 0 #0f172a;
        }

        .neko-guide__bubble:focus-visible {
          outline: 3px solid rgba(15, 23, 42, 0.28);
          outline-offset: 3px;
        }

        .neko-guide__bubble::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -9px;
          width: 13px;
          height: 13px;
          border-right: 2px solid #0f172a;
          border-bottom: 2px solid #0f172a;
          background: #fffdf3;
          transform: translateX(-50%) rotate(45deg);
        }

        .neko-guide__bubble.is-below::after {
          top: -8px;
          bottom: auto;
          border: 0;
          border-top: 2px solid #0f172a;
          border-left: 2px solid #0f172a;
        }

        .neko-guide__recall {
          position: fixed;
          z-index: 1000000;
          display: grid;
          width: 28px;
          height: 28px;
          place-items: center;
          border: 1px solid rgba(100, 116, 139, 0.48);
          border-radius: 999px;
          background: rgba(248, 250, 252, 0.94);
          padding: 0;
          box-shadow: 0 2px 7px rgba(15, 23, 42, 0.14);
          color: #475569;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
          opacity: 0.88;
          transition: opacity 150ms ease, transform 150ms ease,
            background 150ms ease, border-color 150ms ease,
            box-shadow 150ms ease;
        }

        .neko-guide__recall:hover {
          border-color: #94a3b8;
          background: #e2e8f0;
          box-shadow: 0 3px 9px rgba(15, 23, 42, 0.18);
          color: #0f172a;
          opacity: 1;
          transform: scale(1.08);
        }

        .neko-guide__recall:focus-visible {
          outline: 3px solid rgba(100, 116, 139, 0.24);
          outline-offset: 2px;
          opacity: 1;
        }

        .neko-guide__recall-preview {
          position: fixed;
          z-index: 1000002;
          max-width: min(220px, calc(100vw - 16px));
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: rgba(248, 250, 252, 0.98);
          padding: 6px 9px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
          color: #334155;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            monospace;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.35;
          text-align: center;
          pointer-events: none;
        }
      `;
      document.head.appendChild(style);
    }

    _activeGroup() {
      if (typeof this.getActiveGroup === "function") {
        return this.getActiveGroup();
      }
      return this.getActiveGroup;
    }

    _resolveTarget(annotation) {
      const selector = annotation.dataset.nekoTarget;
      if (!selector) return null;

      let target;
      try {
        target = this.root.querySelector(selector);
      } catch (error) {
        console.warn(`NekoGuide ignored invalid selector: ${selector}`, error);
        return null;
      }

      const closestSelector = annotation.dataset.nekoClosest;
      if (target && closestSelector) {
        try {
          target = target.closest(closestSelector);
        } catch (error) {
          console.warn(
            `NekoGuide ignored invalid closest selector: ${closestSelector}`,
            error
          );
          return null;
        }
      }
      return target;
    }

    _targetIsAvailable(target) {
      if (!target || !target.isConnected) return false;
      if (target.closest("[hidden], [aria-hidden='true']")) return false;

      const style = getComputedStyle(target);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }

      const rect = target.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    _currentStop() {
      if (!this.stops.length) return null;
      return this.stops[this.stopIndex % this.stops.length];
    }

    refresh({ restart = false } = {}) {
      if (this.destroyed) return;

      const previousAnnotation = this._currentStop()?.annotation;
      const activeGroup = this._activeGroup();
      const groupChanged = activeGroup !== this.lastActiveGroup;
      const annotations = Array.from(this.root.querySelectorAll(this.selector));
      const nextStops = annotations
        .filter((annotation) => {
          const group = annotation.dataset.nekoGroup;
          return !group || !activeGroup || group === activeGroup;
        })
        .map((annotation) => ({
          annotation,
          target: this._resolveTarget(annotation),
          message:
            annotation.dataset.nekoMessage ||
            annotation.getAttribute("aria-label") ||
            "",
          side: annotation.dataset.nekoSide || "bottom",
        }))
        .filter(
          (stop) => stop.message && this._targetIsAvailable(stop.target)
        );

      const previousIndex = !restart && !groupChanged && previousAnnotation
        ? nextStops.findIndex(
            (stop) => stop.annotation === previousAnnotation
          )
        : -1;
      const routeChanged =
        restart ||
        groupChanged ||
        (previousAnnotation && previousIndex === -1) ||
        (!previousAnnotation && nextStops.length > 0);

      this.stops = nextStops;
      this.stopIndex = previousIndex >= 0 ? previousIndex : 0;
      this.lastActiveGroup = activeGroup;

      if (routeChanged) this._clearArrival();
      if (this.active && !this.docking) this._enforceWaypoint();
    }

    _scheduleRefresh(restart = false) {
      this.refreshNeedsRestart ||= restart;
      if (this.refreshFrame || this.destroyed) return;

      this.refreshFrame = requestAnimationFrame(() => {
        const shouldRestart = this.refreshNeedsRestart;
        this.refreshFrame = null;
        this.refreshNeedsRestart = false;
        this.refresh({ restart: shouldRestart });
      });
    }

    _scrollDirectionForTarget(rect) {
      const edge = this.edgePadding;
      if (rect.bottom < edge) return "up";
      if (rect.top > window.innerHeight - edge) return "down";
      if (rect.right < edge) return "left";
      if (rect.left > window.innerWidth - edge) return "right";
      return null;
    }

    _waypointAtViewportEdge(rect, direction) {
      const edge = this.edgePadding;
      const centerX = Math.max(
        edge,
        Math.min(rect.left + rect.width / 2, window.innerWidth - edge)
      );
      const centerY = Math.max(
        edge,
        Math.min(rect.top + rect.height / 2, window.innerHeight - edge)
      );

      if (direction === "up") return { x: centerX, y: edge };
      if (direction === "down") {
        return { x: centerX, y: window.innerHeight - edge };
      }
      if (direction === "left") return { x: edge, y: centerY };
      return { x: window.innerWidth - edge, y: centerY };
    }

    _waypointNearTarget(rect, side) {
      const edge = this.edgePadding;
      const gap = this.targetGap;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + Math.min(rect.height / 2, 72);
      let x = centerX;
      let y = centerY;

      if (side === "left") {
        x = rect.left - gap;
        if (x < edge) x = rect.right + gap;
      } else if (side === "right") {
        x = rect.right + gap;
        if (x > window.innerWidth - edge) x = rect.left - gap;
      } else if (side === "top") {
        y = rect.top - gap;
        if (y < edge) y = rect.bottom + gap;
      } else {
        y = rect.bottom + gap;
        if (y > window.innerHeight - edge) y = rect.top - gap;
      }

      return {
        x: Math.max(edge, Math.min(x, window.innerWidth - edge)),
        y: Math.max(edge, Math.min(y, window.innerHeight - edge)),
      };
    }

    _enforceWaypoint() {
      if (!this.active || !this.stops.length) return null;

      const stop = this._currentStop();
      if (!this._targetIsAvailable(stop.target)) {
        this._scheduleRefresh();
        return null;
      }

      const rect = stop.target.getBoundingClientRect();
      const scrollDirection = this._scrollDirectionForTarget(rect);
      const position = scrollDirection
        ? this._waypointAtViewportEdge(rect, scrollDirection)
        : this._waypointNearTarget(rect, stop.side);

      this.neko.setTarget(position.x, position.y);
      return { ...position, scrollDirection, stop };
    }

    _showBubble(message, duration = this.messageDuration, announce = true) {
      this.bubble.setAttribute("aria-live", announce ? "polite" : "off");
      this.bubble.textContent = message;
      this.bubble.hidden = false;
      if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
      this.bubbleTimer = duration
        ? setTimeout(() => this._hideBubble(), duration)
        : null;
    }

    _hideBubble() {
      this.bubble.hidden = true;
      if (this.bubbleTimer) {
        clearTimeout(this.bubbleTimer);
        this.bubbleTimer = null;
      }
    }

    _trackBubble() {
      if (this.destroyed || this.bubble.hidden) return;

      const width = this.bubble.offsetWidth;
      const height = this.bubble.offsetHeight;
      const centerX = this.neko.x + this.spriteSize / 2;
      const left = Math.max(
        8,
        Math.min(centerX - width / 2, window.innerWidth - width - 8)
      );
      const above = this.neko.y - height - 12;
      const fitsAbove = above > 8;

      this.bubble.style.left = `${left}px`;
      this.bubble.style.top = `${
        fitsAbove ? above : this.neko.y + this.spriteSize + 8
      }px`;
      this.bubble.classList.toggle("is-below", !fitsAbove);
    }

    _clearRecallMarker() {
      this.recallStop = null;
      this.recallMarker.hidden = true;
      this._hideRecallPreview();
      if (this.recallTimer) {
        clearTimeout(this.recallTimer);
        this.recallTimer = null;
      }
    }

    _trackRecallMarker() {
      const stop = this.recallStop;
      if (
        !this.active ||
        !stop ||
        !this._targetIsAvailable(stop.target)
      ) {
        this.recallMarker.hidden = true;
        this._hideRecallPreview();
        return;
      }

      const rect = stop.target.getBoundingClientRect();
      if (this._scrollDirectionForTarget(rect)) {
        this.recallMarker.hidden = true;
        this._hideRecallPreview();
        return;
      }

      const position = this._waypointNearTarget(rect, stop.side);
      const markerSize = 28;
      this.recallMarker.hidden = false;
      this.recallMarker.style.left = `${Math.max(
        6,
        Math.min(
          position.x - markerSize / 2,
          window.innerWidth - markerSize - 6
        )
      )}px`;
      this.recallMarker.style.top = `${Math.max(
        6,
        Math.min(
          position.y - markerSize / 2,
          window.innerHeight - markerSize - 6
        )
      )}px`;
      this._syncRecallPreviewHover();
      if (this.recallPreviewVisible) this._positionRecallPreview();
    }

    _syncRecallPreviewHover() {
      const interested =
        this.recallMarker.matches(":hover") ||
        document.activeElement === this.recallMarker;
      if (interested && !this.recallPreviewVisible) {
        this._showRecallPreview();
      } else if (!interested && this.recallPreviewVisible) {
        this._hideRecallPreview();
      }
    }

    _positionRecallPreview() {
      if (!this.recallPreviewVisible || this.recallMarker.hidden) return;

      const markerRect = this.recallMarker.getBoundingClientRect();
      const width = this.recallPreview.offsetWidth;
      const height = this.recallPreview.offsetHeight;
      const left = Math.max(
        8,
        Math.min(
          markerRect.left + markerRect.width / 2 - width / 2,
          window.innerWidth - width - 8
        )
      );
      const above = markerRect.top - height - 10;
      this.recallPreview.style.left = `${left}px`;
      this.recallPreview.style.top = `${
        above > 8 ? above : markerRect.bottom + 10
      }px`;
    }

    _showRecallPreview() {
      if (!this.recallStop || this.recallMarker.hidden) return;
      this.recallPreview.textContent = this.recallStop.message;
      this.recallPreview.hidden = false;
      this.recallPreviewVisible = true;
      this.recallMarker.setAttribute("aria-expanded", "true");
      this._positionRecallPreview();
    }

    _hideRecallPreview() {
      this.recallPreview.hidden = true;
      this.recallPreviewVisible = false;
      this.recallMarker.setAttribute("aria-expanded", "false");
    }

    _leaveRecallMarker(stop) {
      this._clearRecallMarker();
      if (!stop || !this._targetIsAvailable(stop.target)) return;

      this.recallStop = stop;
      this.recallTimer = setTimeout(
        () => this._clearRecallMarker(),
        this.recallDuration
      );
      this._trackRecallMarker();
    }

    _scheduleStopAdvance(stop, delay = this.messageDuration + 400) {
      if (this.arrivalTimer) clearTimeout(this.arrivalTimer);
      this.arrivalTimer = setTimeout(() => {
        this.arrivalTimer = null;
        this._advanceFromStop(stop);
      }, delay);
    }

    _advanceFromStop(stop) {
      if (this.messagePaused || this.spokenStop !== stop) return;

      this._leaveRecallMarker(stop);
      const spokenIndex = this.stops.findIndex(
        (item) => item.annotation === stop.annotation
      );
      this.stopIndex =
        spokenIndex >= 0 ? (spokenIndex + 1) % this.stops.length : 0;
      this.arrived = false;
      this.spokenStop = null;
      this._hideBubble();
      this._enforceWaypoint();
    }

    _clearArrival() {
      if (this.arrivalTimer) {
        clearTimeout(this.arrivalTimer);
        this.arrivalTimer = null;
      }
      this.arrived = false;
      this.spokenStop = null;
      this.messagePaused = false;
      this.bubbleHeld = false;
      this.bubble.classList.remove("is-held");
      this.waitingDirection = null;
      this._clearRecallMarker();
      this._hideBubble();
    }

    _edgeStateForDirection(direction) {
      const state = window.NekoState;
      if (!state) return null;
      if (direction === "up") return state.U_CLAW;
      if (direction === "down") return state.D_CLAW;
      if (direction === "left") return state.L_CLAW;
      if (direction === "right") return state.R_CLAW;
      return null;
    }

    _loop() {
      if ((!this.active && !this.docking) || this.destroyed) {
        this.frameId = null;
        return;
      }

      if (this.docking) {
        const dock = this._dockedPosition();
        this.neko.setTarget(
          dock.x + this.spriteSize / 2,
          dock.y + this.spriteSize - 1
        );
        const dx = this.neko.x - dock.x;
        const dy = this.neko.y - dock.y;

        if (Math.sqrt(dx * dx + dy * dy) <= 1) {
          this._finishDock();
          return;
        }

        this.frameId = requestAnimationFrame(this._loop);
        return;
      }

      const waypoint = this._enforceWaypoint();
      if (waypoint) {
        const dx =
          this.neko.x + this.spriteSize / 2 - waypoint.x;
        const dy =
          this.neko.y + this.spriteSize / 2 - waypoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (waypoint.scrollDirection) {
          if (this.arrivalTimer) {
            clearTimeout(this.arrivalTimer);
            this.arrivalTimer = null;
          }
          if (this.arrived) {
            this.spokenStop = null;
            this.messagePaused = false;
            this.bubbleHeld = false;
            this.bubble.classList.remove("is-held");
            this._hideBubble();
          }
          this.arrived = false;

          if (
            distance < this.arrivalDistance &&
            this.waitingDirection !== waypoint.scrollDirection
          ) {
            this.waitingDirection = waypoint.scrollDirection;
            const message =
              typeof this.scrollMessage === "function"
                ? this.scrollMessage(waypoint.scrollDirection)
                : this.scrollMessage;
            this._showBubble(message, 0);
          }
          if (distance < this.arrivalDistance) {
            const edgeState = this._edgeStateForDirection(
              waypoint.scrollDirection
            );
            if (edgeState !== null && this.neko.state !== edgeState) {
              this.neko.setState(edgeState);
            }
          }
        } else {
          if (this.waitingDirection) {
            this.waitingDirection = null;
            this.neko.setState(window.NekoState.AWAKE);
            this._hideBubble();
          }

          if (distance < this.arrivalDistance && !this.arrived) {
            this.arrived = true;
            this.spokenStop = waypoint.stop;
            this.messagePaused = false;
            this._showBubble(waypoint.stop.message);
            this._scheduleStopAdvance(waypoint.stop);
          }
        }
      }

      this._syncBubbleHover();
      this._trackBubble();
      this._trackRecallMarker();
      this.frameId = requestAnimationFrame(this._loop);
    }

    _startLoop() {
      if (!this.frameId) {
        this.frameId = requestAnimationFrame(this._loop);
      }
    }

    _stopLoop() {
      if (this.frameId) {
        cancelAnimationFrame(this.frameId);
        this.frameId = null;
      }
    }

    _dockedPosition() {
      const gap =
        window.innerWidth <= 640 ? Math.min(this.dockGap, 12) : this.dockGap;
      return {
        x: Math.max(
          0,
          document.documentElement.clientWidth - this.spriteSize - gap
        ),
        y: Math.max(0, window.innerHeight - this.spriteSize - gap),
      };
    }

    _positionDockedNeko() {
      if (this.active || this.docking) return;

      const position = this._dockedPosition();
      this.neko.setPosition(position.x, position.y);
    }

    _renderDockFrame() {
      if (this.active || this.destroyed) return;

      const phase = this.dockTick % 100;
      let state = window.NekoState.STOP;
      if (phase < 3 || (phase >= 80 && phase < 83)) {
        state = window.NekoState.AWAKE;
      } else if (
        (phase >= 3 && phase < 11) ||
        (phase >= 83 && phase < 91)
      ) {
        state = window.NekoState.SCRATCH;
      } else if (phase >= 41 && phase < 45) {
        state = window.NekoState.YAWN;
      } else if (phase >= 45 && phase < 80) {
        state = window.NekoState.SLEEP;
      }

      if (this.neko.state !== state) {
        this.neko.setState(state);
      } else {
        this.neko.tickCount = (this.neko.tickCount + 1) % 9999;
      }
      this.neko.updateSprite();
      this.dockTick++;
      this._syncBubbleHover();
      this._trackBubble();
    }

    _startDockAnimation() {
      this._stopDockAnimation();
      this.dockTick = 0;
      this._renderDockFrame();
      this.dockTimer = setInterval(() => this._renderDockFrame(), 200);
    }

    _stopDockAnimation() {
      if (!this.dockTimer) return;
      clearInterval(this.dockTimer);
      this.dockTimer = null;
    }

    _randomIdleDelay() {
      const range = Array.isArray(this.idleMessageDelay)
        ? this.idleMessageDelay
        : [this.idleMessageDelay, this.idleMessageDelay];
      const minimum = Math.max(0, Number(range[0]) || 0);
      const maximum = Math.max(minimum, Number(range[1]) || minimum);
      return minimum + Math.random() * (maximum - minimum);
    }

    _nextIdleMessage() {
      if (!this.idleMessages.length) return "";

      let index = Math.floor(Math.random() * this.idleMessages.length);
      if (
        this.idleMessages.length > 1 &&
        index === this.lastIdleMessageIndex
      ) {
        index = (index + 1) % this.idleMessages.length;
      }
      this.lastIdleMessageIndex = index;
      return this.idleMessages[index];
    }

    _scheduleIdleMessage() {
      this._stopIdleMessages();
      if (this.active || this.destroyed || !this.idleMessages.length) return;

      this.idleMessageTimer = setTimeout(() => {
        this.idleMessageTimer = null;
        if (this.active || this.destroyed) return;
        if (!this.bubbleHeld) {
          this._showBubble(
            this._nextIdleMessage(),
            this.idleMessageDuration,
            false
          );
          this._trackBubble();
        }
        this._scheduleIdleMessage();
      }, this._randomIdleDelay());
    }

    _stopIdleMessages() {
      if (!this.idleMessageTimer) return;
      clearTimeout(this.idleMessageTimer);
      this.idleMessageTimer = null;
    }

    _updateControl() {
      this.neko.element.classList.toggle(
        "neko-guide__cat--docked",
        !this.active
      );
      this.neko.element.classList.toggle(
        "neko-guide__cat--returning",
        this.docking
      );
      this.neko.element.setAttribute(
        "aria-pressed",
        String(this.active && !this.docking)
      );
      this.neko.element.setAttribute("aria-disabled", String(this.docking));
      const label = this.docking
        ? this.returningLabel
        : this.active
          ? this.restLabel
          : this.wakeLabel;
      this.neko.element.setAttribute("aria-label", label);
      this.neko.element.title = label;
    }

    wake() {
      if (this.active || this.destroyed) return false;

      this.refresh({ restart: true });
      if (!this.stops.length) return false;

      this._stopDockAnimation();
      this._stopIdleMessages();
      this._clearArrival();
      this.active = true;
      this.neko.setState(window.NekoState.AWAKE);
      this.neko.start();
      this._enforceWaypoint();
      this._updateControl();
      this._startLoop();
      return true;
    }

    release() {
      return this.wake();
    }

    _finishDock() {
      this.docking = false;
      this.active = false;
      this.neko.stop();
      this._stopLoop();
      this._clearArrival();
      this._positionDockedNeko();
      this._startDockAnimation();
      this._scheduleIdleMessage();
      this._updateControl();
    }

    dock({ immediate = false } = {}) {
      if (this.destroyed) return;

      if (this.docking && !immediate) return;

      if (!this.active || immediate) {
        this._finishDock();
        return;
      }

      this.docking = true;
      this._stopDockAnimation();
      this._stopIdleMessages();
      this._clearArrival();
      const dock = this._dockedPosition();
      this.neko.setTarget(
        dock.x + this.spriteSize / 2,
        dock.y + this.spriteSize - 1
      );
      this.neko.calcDirection(dock.x - this.neko.x, dock.y - this.neko.y);
      this.neko.start();
      this._updateControl();
      this._startLoop();
    }

    toggle() {
      if (this.docking) return;
      if (this.active) {
        this.dock();
      } else {
        this.wake();
      }
    }

    _onCatPointerDown(event) {
      event.preventDefault();
      event.stopPropagation();
      this.toggle();
    }

    _onCatKeyDown(event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      this.toggle();
    }

    _onBubbleEnter() {
      if (this.bubble.hidden) return;
      this.bubbleHeld = true;
      this.bubble.classList.add("is-held");
      if (this.bubbleTimer) {
        clearTimeout(this.bubbleTimer);
        this.bubbleTimer = null;
      }

      if (this.active && this.arrived && this.spokenStop) {
        this.messagePaused = true;
        if (this.arrivalTimer) {
          clearTimeout(this.arrivalTimer);
          this.arrivalTimer = null;
        }
      }
    }

    _syncBubbleHover() {
      const interested =
        !this.bubble.hidden &&
        (this.bubble.matches(":hover") ||
          document.activeElement === this.bubble);
      if (interested && !this.bubbleHeld) {
        this._onBubbleEnter();
      } else if (!interested && this.bubbleHeld) {
        this._onBubbleLeave();
      }
    }

    _onBubbleLeave() {
      if (!this.bubbleHeld) return;
      this.bubbleHeld = false;
      this.bubble.classList.remove("is-held");

      if (this.active && this.messagePaused && this.spokenStop) {
        this.messagePaused = false;
        this._showBubble(this.spokenStop.message);
        this._scheduleStopAdvance(this.spokenStop);
      } else if (!this.active && !this.bubble.hidden) {
        this._showBubble(
          this.bubble.textContent,
          this.idleMessageDuration,
          false
        );
      }
    }

    _onRecallPreviewEnter() {
      this._showRecallPreview();
    }

    _onRecallPreviewLeave() {
      this._hideRecallPreview();
    }

    _onRecall() {
      if (!this.active || this.docking || !this.recallStop) return;

      const recalledIndex = this.stops.findIndex(
        (stop) => stop.annotation === this.recallStop.annotation
      );
      if (recalledIndex < 0) {
        this._clearRecallMarker();
        return;
      }

      if (this.arrivalTimer) {
        clearTimeout(this.arrivalTimer);
        this.arrivalTimer = null;
      }
      this.stopIndex = recalledIndex;
      this.arrived = false;
      this.spokenStop = null;
      this.messagePaused = false;
      this.waitingDirection = null;
      this._hideBubble();
      this._clearRecallMarker();
      this._enforceWaypoint();
    }

    _onResize() {
      this._positionDockedNeko();
      this._scheduleRefresh();
    }

    _onScroll() {
      this._scheduleRefresh();
    }

    _onMouseMove() {
      if (this.active && !this.docking) this._enforceWaypoint();
    }

    _onRefreshRequest() {
      this._scheduleRefresh(true);
    }

    destroy() {
      if (this.destroyed) return;

      this.dock({ immediate: true });
      this.destroyed = true;
      this._stopDockAnimation();
      this._stopIdleMessages();
      if (this.refreshFrame) cancelAnimationFrame(this.refreshFrame);
      this.observer.disconnect();

      this.neko.element.removeEventListener(
        "pointerdown",
        this._onCatPointerDown
      );
      this.neko.element.removeEventListener("keydown", this._onCatKeyDown);
      this.bubble.removeEventListener("mouseenter", this._onBubbleEnter);
      this.bubble.removeEventListener("mouseleave", this._onBubbleLeave);
      this.bubble.removeEventListener("focus", this._onBubbleEnter);
      this.bubble.removeEventListener("blur", this._onBubbleLeave);
      this.recallMarker.removeEventListener("click", this._onRecall);
      this.recallMarker.removeEventListener(
        "mouseenter",
        this._onRecallPreviewEnter
      );
      this.recallMarker.removeEventListener(
        "mouseleave",
        this._onRecallPreviewLeave
      );
      this.recallMarker.removeEventListener(
        "focus",
        this._onRecallPreviewEnter
      );
      this.recallMarker.removeEventListener(
        "blur",
        this._onRecallPreviewLeave
      );
      window.removeEventListener("resize", this._onResize);
      document.removeEventListener("scroll", this._onScroll, {
        capture: true,
      });
      document.removeEventListener("mousemove", this._onMouseMove);
      window.removeEventListener(
        "neko-guide:refresh",
        this._onRefreshRequest
      );

      this.bubble.remove();
      this.recallMarker.remove();
      this.recallPreview.remove();
      if (this.destroyNeko) this.neko.destroy();
    }
  }

  window.NekoGuide = NekoGuide;
  window.createNekoGuide = function (options = {}) {
    if (typeof window.createNeko !== "function") {
      throw new Error("Load neko.js before neko-guide.js");
    }

    const neko = window.createNeko({
      ...options.nekoOptions,
      allowBehaviorChange: false,
    });
    neko.stop();
    return new NekoGuide(neko, options);
  };
})();
