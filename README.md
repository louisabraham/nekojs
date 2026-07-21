# <img src="nkosrc4/Neko98/Res/Awake.ico" width="32" alt="Neko" class="readme-neko-icon" style="image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges;"> Neko.js

A JavaScript reimplementation of the classic Neko desktop pet for the web.

[Live Demo](https://louisabraham.github.io/nekojs/) | [Guided Demo](https://louisabraham.github.io/nekojs/guide.html) | [Usage](#usage) | [Github](https://github.com/louisabraham/nekojs)

## About

[Neko](https://en.wikipedia.org/wiki/Neko_(software)) is a classic desktop pet that follows your mouse cursor around the screen. This JavaScript version brings the cat to web pages.

It should also be possible to build a browser extension that adds a Neko to all pages and keeps its position consistent across pages. Feel free to submit a pull request or reuse the code in your application!

The original goal of this recreation was to test the capabilities of Claude Code (Sonnet 4.5) and to see how well it could recreate the original Neko98 behavior with just the original source code and a few prompts. I would have called this **NEKOMANCING** (ba-dum-tss!).

While it worked to some extent, some substantial manual improvements were needed to make it actually good. Read more about the creation process [below](#how-this-project-was-made).

The original source code (in the `nkosrc4/` folder) was downloaded from [web.archive.org](https://web.archive.org/web/20050330224958fw_/http://www.angelfire.com/ct/neko/download.html).


### Features

- 🎯 **Follows your cursor** - Chases your mouse around the page
- 💤 **Idle animations** - Falls asleep when you stop moving
- 🐾 **Faithful recreation** - Matches original Neko98 state machine and behavior
- 🎨 **Pixel-perfect** - Uses original 32x32 pixel sprites
- ⚡ **Lightweight** - ~38KB uncompressed with sprites embedded (brotli compressed to ~14KB)
- 🚀 **Zero dependencies** - Pure vanilla JavaScript
- 🖱️ **Interactive** - Click to change behavior modes
- 💬 **Optional page guide** - Visits annotated elements and explains the page

## Usage

Add to your HTML:

```html
<script src="https://louisabraham.github.io/nekojs/neko.js" data-autostart></script>
```

Or with custom options:

```javascript
const neko = createNeko({
  speed: 24,                 // Pixels per logic tick (default: 24, 5 ticks/sec)
  fps: 120,                  // Render frame rate (default: 120)
  behaviorMode: 0,           // 0=chase, 1=run away, 2=random, 3=pace, 4=ball chase
  idleThreshold: 6,          // Distance to consider idle (default: 6)
  allowBehaviorChange: true, // Click to cycle behaviors (default: true)
  startX: 0,                 // Initial X position (default: 0)
  startY: 0                  // Initial Y position (default: 0)
});

neko.start();
neko.stop();
neko.destroy();
```

For integrations that need to direct Neko instead of following the cursor:

```javascript
neko.setPosition(24, 24); // Move immediately to a viewport position
neko.setTarget(320, 180); // Run toward a viewport position
```

### Guided companion mode

`createNekoGuide()` turns the same cat into an opt-in guide for a page. Neko
rests in the bottom corner with occasional random banter until clicked, then
visits visible annotations in order. Targets are resolved again after scrolling
or UI changes, so messages stay attached to the current position of the related
element.

Add semantic annotations anywhere in the page:

```html
<section id="welcome-card">...</section>

<i
  data-neko-guide
  data-neko-target="#welcome-card"
  data-neko-side="bottom"
  data-neko-message="This is a good place to begin."
></i>
```

Load the optional guide after `neko.js`, then create it:

```html
<script src="https://louisabraham.github.io/nekojs/neko.js"></script>
<script src="https://louisabraham.github.io/nekojs/neko-guide.js"></script>
<script>
const guide = createNekoGuide({
  messageDuration: 6000,
  recallDuration: 10000,
  idleMessageDelay: [9000, 18000],
  nekoOptions: {
    speed: 18,
    fps: 60
  }
});
</script>
```

Custom character packs can reuse the same movement engine by supplying the
classic 32-frame animation order and a display size:

```javascript
const guide = createNekoGuide({
  wakeLabel: "Wake the companion",
  restLabel: "Let the companion rest",
  returningLabel: "The companion is returning to rest",
  recallLabel: "Replay the companion's previous message",
  nekoOptions: {
    sprites: companionSprites,
    spriteSize: 48
  }
});
```

The default cat remains 32 pixels. When an off-screen destination makes the
guide wait at a viewport edge, the matching claw frames are used as climbing
frames, so themed sprite packs can visibly climb while asking the user to
scroll. When the active companion is clicked again, it walks back to its dock
before entering the idle animation cycle.

The annotations are hidden automatically. Each one supports:

| Attribute | Purpose |
| --- | --- |
| `data-neko-target` | CSS selector for the element Neko should visit |
| `data-neko-message` | Message shown when Neko arrives |
| `data-neko-side` | Preferred placement: `top`, `right`, `bottom`, or `left` |
| `data-neko-closest` | Optional ancestor selector applied to the target |
| `data-neko-group` | Optional route group for tabs or other UI states |

For tabbed or filtered interfaces, return the active group and request a route
refresh whenever the interface changes:

```javascript
let activeTab = "home";

const guide = createNekoGuide({
  getActiveGroup: () => activeTab
});

activeTab = "features";
window.dispatchEvent(new Event("neko-guide:refresh"));
```

Elements inside a `hidden` or `aria-hidden="true"` container are skipped
automatically. When a target is off screen, Neko waits at the corresponding
viewport edge with a short scroll hint. Hovering a message pauses both its timer
and Neko's route. After each message, a subtle neutral paw remains for ten
seconds. Hovering the paw previews the message; selecting it calls Neko back to
that tour stop.

The returned guide exposes `wake()`, `dock()`, `toggle()`, `refresh()`, and
`destroy()`. `release()` remains as an alias for `wake()`.

To _build_ (actually just package the sprites), run `python3 build.py` (requires Pillow).

## How this project was made

This project was originally created through AI-assisted "vibe coding" with Claude, then refined with manual improvements.

### Initial AI generation

The first version was generated by Claude Sonnet 4 from the original Neko98 C++ source code using four prompts:

<details>
<summary><strong>Prompt 1: Initial Implementation</strong></summary>

```
I want to build a modern web version of neko.

I put the original implementation of neko in @nkosrc4/

Start by exploring the codebase and fully document what it does, then reimplement as much as possible in js.

Implement a simple JS version. Avoid using any external libraries except if absolutely necessary. If there is a build step (probably mostly for minification), use a simple one.

Use the orignal sprites from @nkosrc4/Neko98/Res/, add them to the build so that in the end one can just include a single js file that loads very fast (maybe it does network requests but it should be very fast). Maybe you can bundle or compress the sprites to make loading faster.

I will serve the repository using github pages in a docs/ folder. The build process should output a single docs/neko.js file.

Create a README.md file and a pretty looking docs/index.html to present the project. Properly credit the original code downloaded from https://web.archive.org/web/20050330224958fw_/http://www.angelfire.com/ct/neko/download.html. Include installation instructions in both.

Create a simple LICENSE.md file that respects the original license of the code and credits the original author. If you can, put a modern GPL license on the JS code.

Finally, the README.md and the index.html should include the fact that the code was produced fully by this prompt (after downloading and uncompressing nkosrc4 and converting some documentation `classes.doc` to `classes.txt`). Include the prompt verbatim.

You should use git and commit regularly. Don't commit the original source.
```

</details>

<details>
<summary><strong>Prompt 2: Bug Fix (Sprite Mapping)</strong></summary>

After the initial implementation, diagonal movements showed incorrect sprites. Two screenshots were provided showing the bug:

```
There is a bug in the movement handling, it is supposed to go up left in the first
image and down left in the second. Think to identify the source of the bug and check
the logic of all sprite indexing.
```

</details>

<details>
<summary><strong>Prompt 3: Documentation Update</strong></summary>

```
Finally update README.md and index.html to document the previous error and the
prompt that fixed it (explain that I pasted two screenshots), and also include
the current prompt. I want people to know everything about the creation process
so include every prompt in the docs. Also mention which model was used (claude 4.5).
This is the reported usage, report only the important stats on the webpage (even
if this prompt will be included fully)

Total cost: $1.42 Total duration (API): 9m 34s Total duration (wall): 20m 34s
Total code changes: 1442 lines added, 37 lines removed Usage by model:
claude-haiku: 30.9k input, 5.6k output, 179.8k cache read, 41.0k cache write ($0.1279)
claude-opus-4-5: 901 input, 109 output, 0 cache read, 0 cache write ($0.0072)
claude-sonnet: 146 input, 24.5k output, 1.8m cache read, 100.2k cache write ($1.28)
```

</details>

<details>
<summary><strong>Prompt 4: GitHub Integration</strong></summary>

```
I have now configured the github remote. Update the links where suitable. Don't
forget to update README.md and index.html to include this prompt. Mention that
just before this, the total cost was

Total cost: $2.07 Total duration (API): 11m 27s Total duration (wall): 26m 49s
Total code changes: 1554 lines added, 51 lines removed Usage by model:
claude-haiku: 32.1k input, 5.7k output, 179.8k cache read, 41.0k cache write ($0.1297)
claude-opus-4-5: 901 input, 109 output, 0 cache read, 0 cache write ($0.0072)
claude-sonnet: 174 input, 29.0k output, 2.8m cache read, 171.8k cache write ($1.94)

mostly because the conversation is getting long and I didn't compact it at all.
I'm also using the most expensive Claude Opus 4.5 model.

Commit and push your changes.
```

</details>

### Manual improvements

The plan was to try to let the AI fully implement the project, but it was not able to do so.

After the initial AI generation, significant work with a human in the loop (aka me) was done to fix bugs and add features:

- **Rewrote movement system** - Complete rewrite for more realistic movement matching the original C++ implementation for state changes and animation timing while allowing for smooth movement at higher FPS.
- **Fixed wall clawing bug** - Movement deltas were floating-point causing direction flickering that reset state counters; converted to integers like original C++
- **Fixed boundary detection to exclude scrollbars**
- **Added click-to-change behavior** - Click on Neko to cycle through all 5 behavior modes
- **Fixed click detection** - Changed from `click` to `mousedown` event so clicks register even when cat is moving

## License

This JavaScript implementation is licensed under **GNU General Public License v3.0**, respecting the original Neko license.

See [LICENSE.md](LICENSE.md) for full details.
