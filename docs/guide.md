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
    Neko is resting in the bottom-right corner and occasionally has opinions.
    Click the cat to wake it, then watch it tour all seven colours.
  </p>
</div>

<section class="guide-colour-tour" aria-labelledby="colour-tour-title">
  <h2 id="colour-tour-title">Seven-colour tour</h2>
  <div class="guide-colour-grid">
    <article id="colour-red" class="guide-colour-card" style="--guide-colour: #ef4444">
      <span aria-hidden="true"></span>
      <strong>Red</strong>
    </article>
    <article id="colour-orange" class="guide-colour-card" style="--guide-colour: #f97316">
      <span aria-hidden="true"></span>
      <strong>Orange</strong>
    </article>
    <article id="colour-yellow" class="guide-colour-card" style="--guide-colour: #facc15">
      <span aria-hidden="true"></span>
      <strong>Yellow</strong>
    </article>
    <article id="colour-green" class="guide-colour-card" style="--guide-colour: #22c55e">
      <span aria-hidden="true"></span>
      <strong>Green</strong>
    </article>
    <article id="colour-blue" class="guide-colour-card" style="--guide-colour: #3b82f6">
      <span aria-hidden="true"></span>
      <strong>Blue</strong>
    </article>
    <article id="colour-indigo" class="guide-colour-card" style="--guide-colour: #4f46e5">
      <span aria-hidden="true"></span>
      <strong>Indigo</strong>
    </article>
    <article id="colour-violet" class="guide-colour-card" style="--guide-colour: #8b5cf6">
      <span aria-hidden="true"></span>
      <strong>Violet</strong>
    </article>
  </div>
</section>

<div class="guide-demo-note">
  <strong>Try the interactions</strong>
  <p>
    Hover a message to keep Neko at that colour. After it leaves, hover the
    black-and-white paw to preview the previous message, or click it to call
    Neko back.
  </p>
</div>

<i data-neko-guide data-neko-target="#colour-red" data-neko-side="bottom" data-neko-message="Red. Subtle as a fire alarm. I respect the commitment."></i>
<i data-neko-guide data-neko-target="#colour-orange" data-neko-side="bottom" data-neko-message="Orange. Red took a holiday and came back cheerful."></i>
<i data-neko-guide data-neko-target="#colour-yellow" data-neko-side="bottom" data-neko-message="Yellow. Sunshine, now with contrast requirements."></i>
<i data-neko-guide data-neko-target="#colour-green" data-neko-side="bottom" data-neko-message="Green. Nature's favourite success badge."></i>
<i data-neko-guide data-neko-target="#colour-blue" data-neko-side="bottom" data-neko-message="Blue. Calm, dependable, and on every corporate slide."></i>
<i data-neko-guide data-neko-target="#colour-indigo" data-neko-side="bottom" data-neko-message="Indigo. Blue, but it read one mysterious book."></i>
<i data-neko-guide data-neko-target="#colour-violet" data-neko-side="bottom" data-neko-message="Violet. Purple with a slightly fancier résumé."></i>

<script>
document.addEventListener("DOMContentLoaded", function () {
  window.guide = createNekoGuide({
    recallDuration: 10000,
    idleMessageDelay: [3000, 6000],
    nekoOptions: {
      fps: 60,
      speed: 18
    }
  });
});
</script>
