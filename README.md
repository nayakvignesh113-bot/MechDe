# MechDe: Mechanical Design Studio

An interactive website for learning and doing mechanical design: **build, load, test and size** structures and machine elements, and see **which failure mode governs** and why.

Design is the reverse of analysis. MechDe connects the four subjects behind every machine:

**Kinematics → Kinetics/Dynamics → Strength of Materials → Machine Design → (feedback)**

## Modules

| Area | Module | What it does |
|---|---|---|
| Foundations | SOM → Design bridge | Safety-factor "waterfall" (how temperature, fatigue, finish, size, reliability, medium and notches erode the textbook FS); Mohr's circle; Tresca / von Mises / Rankine / Coulomb–Mohr envelopes; SOM-topic → machine-element map |
| | Kinematics lab | Four-bar linkage (Grashof, coupler curve, transmission angle, ω/α, quick return); cam & follower SVAJ, pressure angle, undercut, retaining-spring force |
| | Dynamics lab | Engine turning-moment diagram & flywheel sizing (1–6 cylinders); rotating-mass balancing; vibration isolation / transmissibility |
| | Design Chain | Slider-crank engine: kinematics → gas + inertia forces → Rankine buckling & whipping → I-section connecting rod, iterated until rod mass converges |
| Build & test | Structure builder | Draw trusses/frames/bridges; 2D FEM (frame or pin-jointed); self-weight, deck, point, thermal, wind loads; utilisation colouring, deformed shape, BMD; buckling checks; auto-sizing; modal analysis with animated mode shapes; FRF / resonance vs pedestrian bands; moving vehicle with envelope & influence line |
| Machine elements | Shaft | DE-Goodman/Gerber/ASME/Soderberg, yield, deflection, bearing & gear slope, Rayleigh critical speed: required Ø per criterion, governing mode, iteration table, speed sweep |
| | Spur gear | Lewis + Barth/velocity factor, Buckingham wear, Hertz cross-check; module sweep; involute meshing animation |
| | Belt drive | Flat & V-belt, centrifugal tension, optimum speed, number of belts, shaft load |
| | Helical spring | Bergsträsser factor, Zimmerli fatigue, solid-height stress, buckling, surge; wire-size iteration |
| | Bolted joint | Joint stiffness, preload, separation, Goodman fatigue, thermal preload change, joint diagram |
| | Columns | Euler / Johnson / Rankine–Gordon / secant; regime map |
| Design thinking | Why is a spanner shaped so? | Length from torque, 15° offset from hex geometry, uniform-strength taper, curved-beam jaw |
| | Failure case studies | Tacoma Narrows, Hyatt Regency, Comet, Liberty ships, Silver Bridge, Millennium Bridge |
| | Design notebook | Notes with voice dictation |

**Global environment** (temperature, medium, reliability, design life, wind) applies to every module: strength and modulus derating, corrosion-fatigue factors, corrosion allowance, low-temperature brittleness and creep warnings.

**Voice**: in Chrome/Edge, press 🎙 Voice and say *"go to gear"*, *"set power to 15"*, *"set material to 4140"*, *"explain"*, *"note …"*. 🔊 Explain reads the current verdict aloud.

## Run

Static site, no build step. Open `index.html`, or serve with GitHub Pages (Settings → Pages → deploy from branch `main`, root).

## Caveats

Methods follow standard textbook practice (Shigley, Bhandari/PSG conventions, AGMA, IS 800/875 concepts). Temperature, corrosion and V-belt tension data are indicative. Verify final designs against codes, certified material data and manufacturer catalogues.
