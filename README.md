# Mochi Drop

A premium, one-finger merge game in the spirit of Suika. Drop sticky mochi into a night-market bowl. Matching sizes become the next, until a giant daifuku crowns the pile — or the rim overflows.

**Play:** [https://dust2ash7.github.io/mochi-drop/](https://dust2ash7.github.io/mochi-drop/)

## How to play

1. Move left and right to aim. A ghost shows the piece about to fall.
2. Click, tap-release, Space, or Enter to drop.
3. Two mochi of the **same size** merge into the next size, with juice, pop, and combo score.
4. Stay under the gold **RIM** line. Overflow ends the round — one more try.

Sizes run from tiny **Kome** (rice) through sakura, matcha, azuki, and daifuku up to **O-Daifuku**.

## Controls

| Input | Action |
| --- | --- |
| Mouse / touch drag | Aim |
| Click or finger up | Drop |
| ← → or A D | Aim |
| Space / Enter | Drop |
| Esc | Pause / resume |
| M | Mute |

## Features

- 11 mochi sizes, squishy circle physics, gravity and rest
- Next-piece queue and drop ghost
- Combos, score, and `localStorage` high score
- Mute, pause, start and game-over screens
- Reduced motion: less bounce and shake
- Keyboard and touch, labeled buttons, pause when the tab hides
- Installable PWA (manifest + service worker)
- No backend, accounts, or paywall

## Run locally

Open `index.html` from this folder, or serve the directory (needed for the service worker):

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080/`.

GitHub Pages should be enabled on `main` with the root of this repository as the site source.
