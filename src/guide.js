/**
 * Optional guided companion mode for Neko.js.
 *
 * Turns Neko into an opt-in page guide that visits semantic HTML annotations,
 * explains nearby UI, waits at the viewport edge for off-screen targets, and
 * leaves a temporary paw marker so the previous message can be replayed.
 */

(function () {
  "use strict";

  const GUIDE_SPRITE_SIZE = 32;
  const GUIDE_STYLE_ID = "neko-guide-styles";

  class NekoGuide {
    constructor(neko, options = {}) {
      if (!neko) {
        throw new Error("NekoGuide requires a Neko instance");
      }

      this.neko = neko;
      this.root = options.root || document;
      this.selector = options.selector || "[data-neko-guide]";
      this.getActiveGroup = options.getActiveGroup || null;
      this.messageDuration = options.messageDuration ?? 6000;
      this.recallDuration = options.recallDuration ?? 60000;
      this.arrivalDistance = options.arrivalDistance || 24;
      this.edgePadding = options.edgePadding || 24;
      this.targetGap = options.targetGap || 24;
      this.dockGap = options.dockGap || 16;
      this.scrollMessage =
        options.scrollMessage ||
        ((direction) => `Scroll ${direction} — there is more.`);
      this.destroyNeko = options.destroyNeko !== false;

      this.stops = [];
      this.stopIndex = 0;
      this.active = false;
      this.arrived = false;
      this.waitingDirection = null;
      this.recallStop = null;
      this.lastActiveGroup = undefined;
      this.destroyed = false;

      this.arrivalTimer = null;
      this.bubbleTimer = null;
      this.recallTimer = null;
      this.dockTimer = null;
      this.dockTick = 0;
      this.frameId = null;
      this.refreshFrame = null;
      this.refreshNeedsRestart = false;

      this._onCatPointerDown = this._onCatPointerDown.bind(this);
      this._onCatKeyDown = this._onCatKeyDown.bind(this);
      this._onRecall = this._onRecall.bind(this);
      this._onResize = this._onResize.bind(this);
      this._onScroll = this._onScroll.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onRefreshRequest = this._onRefreshRequest.bind(this);
      this._loop = this._loop.bind(this);

      this._mount();
      this.refresh();

      if (options.startDocked === false) {
        this.release();
      } else {
        this.dock();
      }
    }

    _mount() {
      this._installStyles();

      this.bubble = document.createElement("div");
      this.bubble.className = "neko-guide__bubble";
      this.bubble.setAttribute("role", "status");
      this.bubble.setAttribute("aria-live", "polite");
      this.bubble.hidden = true;
      document.body.appendChild(this.bubble);

      this.recallMarker = document.createElement("button");
      this.recallMarker.type = "button";
      this.recallMarker.className = "neko-guide__recall";
      this.recallMarker.setAttribute(
        "aria-label",
        "Replay Neko's previous message"
      );
      this.recallMarker.title = "Replay previous message";
      this.recallMarker.innerHTML = '<span aria-hidden="true">🐾</span>';
      this.recallMarker.hidden = true;
      document.body.appendChild(this.recallMarker);

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
      this.recallMarker.addEventListener("click", this._onRecall);
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
          pointer-events: none;
        }

        .neko-guide__bubble[hidden],
        .neko-guide__recall[hidden] {
          display: none;
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
          border: 0;
          border-radius: 999px;
          background: rgba(255, 251, 235, 0.88);
          padding: 0;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.16);
          color: #b45309;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
          opacity: 0.72;
          transition: opacity 150ms ease, transform 150ms ease,
            background 150ms ease;
        }

        .neko-guide__recall:hover {
          background: #fffbeb;
          opacity: 1;
          transform: scale(1.12);
        }

        .neko-guide__recall:focus-visible {
          outline: 3px solid rgba(245, 158, 11, 0.28);
          outline-offset: 2px;
          opacity: 1;
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
      if (this.active) this._enforceWaypoint();
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

    _showBubble(message, duration = this.messageDuration) {
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
      if (!this.active || this.bubble.hidden) return;

      const width = this.bubble.offsetWidth;
      const height = this.bubble.offsetHeight;
      const centerX = this.neko.x + GUIDE_SPRITE_SIZE / 2;
      const left = Math.max(
        8,
        Math.min(centerX - width / 2, window.innerWidth - width - 8)
      );
      const above = this.neko.y - height - 12;
      const fitsAbove = above > 8;

      this.bubble.style.left = `${left}px`;
      this.bubble.style.top = `${
        fitsAbove ? above : this.neko.y + GUIDE_SPRITE_SIZE + 8
      }px`;
      this.bubble.classList.toggle("is-below", !fitsAbove);
    }

    _clearRecallMarker() {
      this.recallStop = null;
      this.recallMarker.hidden = true;
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
        return;
      }

      const rect = stop.target.getBoundingClientRect();
      if (this._scrollDirectionForTarget(rect)) {
        this.recallMarker.hidden = true;
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

    _clearArrival() {
      if (this.arrivalTimer) {
        clearTimeout(this.arrivalTimer);
        this.arrivalTimer = null;
      }
      this.arrived = false;
      this.waitingDirection = null;
      this._clearRecallMarker();
      this._hideBubble();
    }

    _loop() {
      if (!this.active || this.destroyed) {
        this.frameId = null;
        return;
      }

      const waypoint = this._enforceWaypoint();
      if (waypoint) {
        const dx =
          this.neko.x + GUIDE_SPRITE_SIZE / 2 - waypoint.x;
        const dy =
          this.neko.y + GUIDE_SPRITE_SIZE / 2 - waypoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (waypoint.scrollDirection) {
          if (this.arrivalTimer) {
            clearTimeout(this.arrivalTimer);
            this.arrivalTimer = null;
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
        } else {
          if (this.waitingDirection) {
            this.waitingDirection = null;
            this._hideBubble();
          }

          if (distance < this.arrivalDistance && !this.arrived) {
            this.arrived = true;
            this._showBubble(waypoint.stop.message);
            const spokenStop = waypoint.stop;

            this.arrivalTimer = setTimeout(() => {
              this._leaveRecallMarker(spokenStop);
              const spokenIndex = this.stops.findIndex(
                (stop) => stop.annotation === spokenStop.annotation
              );
              this.stopIndex =
                spokenIndex >= 0
                  ? (spokenIndex + 1) % this.stops.length
                  : 0;
              this.arrived = false;
              this._hideBubble();
              this._enforceWaypoint();
            }, this.messageDuration + 400);
          }
        }
      }

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

    _positionDockedNeko() {
      if (this.active) return;

      const gap =
        window.innerWidth <= 640 ? Math.min(this.dockGap, 12) : this.dockGap;
      const x = Math.max(
        0,
        document.documentElement.clientWidth - GUIDE_SPRITE_SIZE - gap
      );
      const y = Math.max(
        0,
        window.innerHeight - GUIDE_SPRITE_SIZE - gap
      );
      this.neko.setPosition(x, y);
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

    _updateControl() {
      this.neko.element.classList.toggle(
        "neko-guide__cat--docked",
        !this.active
      );
      this.neko.element.setAttribute("aria-pressed", String(this.active));
      const label = this.active ? "Let Neko rest" : "Release Neko";
      this.neko.element.setAttribute("aria-label", label);
      this.neko.element.title = label;
    }

    release() {
      if (this.active || this.destroyed) return false;

      this.refresh({ restart: true });
      if (!this.stops.length) return false;

      this._stopDockAnimation();
      this._clearArrival();
      this.active = true;
      this.neko.setState(window.NekoState.AWAKE);
      this.neko.start();
      this._enforceWaypoint();
      this._updateControl();
      this._startLoop();
      return true;
    }

    dock() {
      if (this.destroyed) return;

      this.neko.stop();
      this.active = false;
      this._stopLoop();
      this._clearArrival();
      this._positionDockedNeko();
      this._startDockAnimation();
      this._updateControl();
    }

    toggle() {
      if (this.active) {
        this.dock();
      } else {
        this.release();
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

    _onRecall() {
      if (!this.active || !this.recallStop) return;

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
      if (this.active) this._enforceWaypoint();
    }

    _onRefreshRequest() {
      this._scheduleRefresh(true);
    }

    destroy() {
      if (this.destroyed) return;

      this.dock();
      this.destroyed = true;
      this._stopDockAnimation();
      if (this.refreshFrame) cancelAnimationFrame(this.refreshFrame);
      this.observer.disconnect();

      this.neko.element.removeEventListener(
        "pointerdown",
        this._onCatPointerDown
      );
      this.neko.element.removeEventListener("keydown", this._onCatKeyDown);
      this.recallMarker.removeEventListener("click", this._onRecall);
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
