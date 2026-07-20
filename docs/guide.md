---
layout: default
title: Neko.js guided companion demo
---

<script src="neko.js"></script>
<script src="neko-guide.js"></script>

<div class="guide-demo-heading">
  <p class="guide-demo-kicker">optional guided companion</p>
  <h1>Let Neko explain the page</h1>
  <p>
    Neko is resting in the bottom-right corner. Click the cat to release it,
    then scroll or change tabs while it follows the page's live layout.
  </p>
</div>

<div class="guide-demo-tabs" role="tablist" aria-label="Demo signals">
  <button type="button" class="is-active" data-guide-demo-tab="signals" role="tab" aria-selected="true">Signals</button>
  <button type="button" data-guide-demo-tab="details" role="tab" aria-selected="false">Details</button>
</div>

<section id="guide-signals" data-guide-demo-panel="signals" role="tabpanel">
  <h2>Signals</h2>
  <div class="guide-demo-grid">
    <article id="guide-priority">
      <strong>Priority queue</strong>
      <p>Three items need a decision before work can continue.</p>
    </article>
    <article id="guide-health">
      <strong>System health</strong>
      <p>All checks are passing, with one warning to review.</p>
    </article>
  </div>
</section>

<section id="guide-details" data-guide-demo-panel="details" role="tabpanel" hidden>
  <h2>Details</h2>
  <div class="guide-demo-grid">
    <article id="guide-owner">
      <strong>Clear ownership</strong>
      <p>The next action and accountable owner are visible together.</p>
    </article>
    <article id="guide-evidence">
      <strong>Linked evidence</strong>
      <p>Supporting context is one click away from the decision.</p>
    </article>
  </div>
</section>

<div class="guide-demo-spacer" aria-hidden="true"></div>

<section id="guide-finish" class="guide-demo-finish">
  <h2>Scroll-aware destinations</h2>
  <p>
    Neko uses the target's current viewport position. If the destination is
    outside the viewport, the cat waits at the edge until you scroll.
  </p>
</section>

<i data-neko-guide data-neko-group="signals" data-neko-target="#guide-priority" data-neko-side="bottom" data-neko-message="This queue is the fastest place to unblock the team."></i>
<i data-neko-guide data-neko-group="signals" data-neko-target="#guide-health" data-neko-side="left" data-neko-message="The warning is visible without making the healthy checks feel urgent."></i>
<i data-neko-guide data-neko-group="details" data-neko-target="#guide-owner" data-neko-side="bottom" data-neko-message="The owner sits next to the action, so the handoff is clear."></i>
<i data-neko-guide data-neko-group="details" data-neko-target="#guide-evidence" data-neko-side="left" data-neko-message="This evidence is close to the decision it supports."></i>
<i data-neko-guide data-neko-target="#guide-finish" data-neko-side="top" data-neko-message="I found this after the page moved. My message is still attached to the element."></i>

<script>
document.addEventListener("DOMContentLoaded", function () {
  let activeGroup = "signals";
  const tabs = Array.from(document.querySelectorAll("[data-guide-demo-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-guide-demo-panel]"));

  window.guide = createNekoGuide({
    getActiveGroup: function () {
      return activeGroup;
    },
    nekoOptions: {
      fps: 60,
      speed: 18
    }
  });

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      activeGroup = tab.dataset.guideDemoTab;
      tabs.forEach(function (item) {
        const selected = item === tab;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-selected", String(selected));
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.dataset.guideDemoPanel !== activeGroup;
      });
      window.dispatchEvent(new Event("neko-guide:refresh"));
    });
  });
});
</script>
