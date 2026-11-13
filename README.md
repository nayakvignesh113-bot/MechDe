# MechDe: Mechanical Design Studio

An interactive website for learning and doing mechanical design: **build, load, test and size** structures and machine elements, and see **which failure mode governs** and why.

Design is the reverse of analysis. MechDe connects the four subjects behind every machine:

**Kinematics → Kinetics/Dynamics → Strength of Materials → Machine Design → (feedback)**

## Built for beginners

- An animated **presenter** (Dr. Vignesh, or Asha / Arjun) walks through each page with gestures, lip-synced speech and highlights.

- **Simple / Expert** switch: beginners see only the key inputs; every input has an ⓘ plain-language explanation.
- Every page opens with **What this page does** and a **Try this** experiment, and has a **📘 equations panel** (meaning of every symbol and what happens when each parameter changes) plus a live **🔬 effect-of-parameters** table.
- The home page has a clickable **design flowchart**: need → requirements → concepts → kinematics → loads → stresses → failure modes → material → size & shape (loop) → detail → test (loop) → production & feedback (loop).

## Start here

The **How to design with MechDe** page explains how to read any module, gives step-by-step recipes (bicycle drivetrain, motorcycle gearbox, conveyor drive, footbridge, engine, cam, crane jib) and lists what is and is not covered yet.

## Modules

| Area | Module | What it does |
|---|---|---|
| Foundations | SOM → Design bridge | Safety-factor "waterfall" (how temperature, fatigue, finish, size, reliability, medium and notches erode the textbook FS); Mohr's circle; Tresca / von Mises / Rankine / Coulomb–Mohr envelopes; SOM-topic → machine-element map |
| | Kinematics lab | Four-bar linkage (Grashof, coupler curve, transmission angle, ω/α, quick return); cam & follower SVAJ, pressure angle, undercut, retaining-spring force |
| | Dynamics lab | Engine turning-moment diagram & flywheel sizing (1–6 cylinders); rotating-mass balancing; vibration isolation / transmissibility |
| | Design Chain | Slider-crank engine: kinematics → gas + inertia forces → Rankine buckling & whipping → I-section connecting rod, iterated until rod mass converges |
| Build & test | Structure builder | Draw trusses/frames/bridges; 2D FEM (frame or pin-jointed); self-weight, deck, point, thermal, wind loads; utilisation colouring, deformed shape, BMD; buckling checks; auto-sizing; modal analysis with animated mode shapes; FRF / resonance vs pedestrian bands; moving vehicle with envelope & influence line |
| | 3D space trusses | Lattice tower, crane mast + jib, double-layer space-frame roof, tripod: 3D direct-stiffness solve, Euler buckling and yield per member, rotatable view, deflected shape, first three modes (inverse iteration) with animation |
| Machine elements | Shaft | DE-Goodman/Gerber/ASME/Soderberg, yield, deflection, bearing & gear slope, Rayleigh critical speed: required Ø per criterion, governing mode, iteration table, speed sweep |
| | Spur gear | Lewis + Barth/velocity factor, Buckingham wear, Hertz cross-check; module sweep; involute meshing animation |
| | Belt drive | Flat & V-belt, centrifugal tension, optimum speed, number of belts, shaft load |
| | Helical spring | Bergsträsser factor, Zimmerli fatigue, solid-height stress, buckling, surge; wire-size iteration |
| | Leaf, torsion & torsion-bar springs | Multi-leaf (full + graduated) stress, deflection, ride frequency; helical torsion spring with Wahl-type curvature factor; torsion bar |
| | Bolted joint | Joint stiffness, preload, separation, Goodman fatigue, thermal preload change, joint diagram |
| | Columns | Euler / Johnson / Rankine–Gordon / secant; regime map |
| | Helical, bevel, worm & planetary | Virtual teeth, axial thrust, cone geometry, worm efficiency & self-locking, heat balance, Willis equation, planetary assembly checks |
| | AGMA gear rating | Metric AGMA 2001 bending and pitting with Kv, KH, Ks, life factors; compared with Lewis |
| | Cam & valve-train dynamics | Follower train as spring-mass system: valve float / jump, spring surge, redline speed |
| | Fracture & creep life | K_IC, critical crack size, Paris-law crack growth and inspection interval, leak-before-break; Larson–Miller creep rupture life |
| | Bearings | Ball/roller L10 life with reliability factor and catalogue selection; journal bearing (Sommerfeld, Ocvirk film thickness, Petroff friction, Trumpler limit) |
| | Keys, splines & couplings | Key shear/crushing length, spline engagement, rigid flange vs flexible bush coupling |
| | Clutches & brakes | Plate (uniform wear/pressure), cone (jamming), vehicle disc brake energy & temperature, band brake |
| | Welded & riveted joints | Eccentric fillet-weld group, riveted joint efficiency vs pitch |
| | Power screws | Raise/lower torque, self-locking, efficiency, screw buckling, nut length |
| | Pressure vessels & curved beams | Thin/thick (Lamé) shells, hemispherical/elliptical/flat ends, Winkler–Bach crane hook |
| | Bike drivetrain & gear train | Bicycle: chainrings/cassette, speeds, gear inches, climbing, cross-chaining, chain tension. Motorcycle: ratio spacing, constant-mesh teeth, per-pair gear strength, tractive-effort diagram, final chain |
| Products | Self-balancing bikes | Inverted-pendulum simulator with steering (Honda-style negative trail) or gyroscope control; gyro sizing |
| | EV & Tesla-style design | Range vs speed, 0–100, top speed, single-gear tractive force, battery series/parallel and C-rate; Tesla design choices explained |
| | Sewing machine | Needle slider-crank, 2:1 rotary hook, take-up, four-motion feed; timing diagram and inertia |
| Design thinking | Why is it built this way? | I-beams, hollow shafts, fillets, domes, hooks, triangles, springs, involutes, ribs, drive choice, with live comparisons |
| | Why is a spanner shaped so? | Length from torque, 15° offset from hex geometry, uniform-strength taper, curved-beam jaw |
| | Failure case studies | Tacoma Narrows, Hyatt Regency, Comet, Liberty ships, Silver Bridge, Millennium Bridge |
| | Design notebook | Notes with voice dictation |

**Global environment** (temperature, medium, reliability, design life, wind) applies to every module: strength and modulus derating, corrosion-fatigue factors, corrosion allowance, low-temperature brittleness and creep warnings.

**Voice**: in Chrome/Edge, press 🎙 Voice and say *"go to gear"*, *"set power to 15"*, *"set material to 4140"*, *"explain"*, *"note …"*. 🔊 Explain reads the current verdict aloud.

## Run

Static site, no build step. Open `index.html`, or serve with GitHub Pages (Settings → Pages → deploy from branch `main`, root).

## Caveats

Methods follow standard textbook practice (Shigley, Bhandari/PSG conventions, AGMA, IS 800/875 concepts). Temperature, corrosion and V-belt tension data are indicative. Verify final designs against codes, certified material data and manufacturer catalogues.
