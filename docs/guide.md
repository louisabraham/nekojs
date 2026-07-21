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

<div class="guide-demo-tabs" role="tablist" aria-label="Demo sections">
  <button type="button" class="is-active" data-guide-demo-tab="welcome" role="tab" aria-selected="true">Welcome</button>
  <button type="button" data-guide-demo-tab="explore" role="tab" aria-selected="false">Explore</button>
</div>

<section id="guide-welcome" data-guide-demo-panel="welcome" role="tabpanel">
  <h2>Welcome</h2>
  <div class="guide-demo-grid">
    <article id="guide-introduction">
      <strong>Introduction</strong>
      <p>A short welcome helps visitors understand what this page offers.</p>
    </article>
    <article id="guide-next-step">
      <strong>Next step</strong>
      <p>A clear action gives visitors an easy way to continue.</p>
    </article>
  </div>
</section>

<section id="guide-explore" data-guide-demo-panel="explore" role="tabpanel" hidden>
  <h2>Explore</h2>
  <div class="guide-demo-grid">
    <article id="guide-feature">
      <strong>Featured area</strong>
      <p>Neko can introduce an important part of any page.</p>
    </article>
    <article id="guide-resources">
      <strong>Helpful resources</strong>
      <p>Useful links and supporting content remain easy to discover.</p>
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

<i data-neko-guide data-neko-group="welcome" data-neko-target="#guide-introduction" data-neko-side="bottom" data-neko-message="Start here for a quick introduction to the page."></i>
<i data-neko-guide data-neko-group="welcome" data-neko-target="#guide-next-step" data-neko-side="left" data-neko-message="This is the natural next step when you are ready to continue."></i>
<i data-neko-guide data-neko-group="explore" data-neko-target="#guide-feature" data-neko-side="bottom" data-neko-message="I can point out a feature without interrupting the page."></i>
<i data-neko-guide data-neko-group="explore" data-neko-target="#guide-resources" data-neko-side="left" data-neko-message="Helpful resources are easier to find when I lead you there."></i>
<i data-neko-guide data-neko-target="#guide-finish" data-neko-side="top" data-neko-message="I found this after the page moved. My message is still attached to the element."></i>

<script>
document.addEventListener("DOMContentLoaded", function () {
  let activeGroup = "welcome";
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
