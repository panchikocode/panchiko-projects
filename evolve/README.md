# Evolve

A 3D evolution simulator. You start as a single cell in open water, eat, grow,
and mutate your way up through the eras.

**This is Stage 1 — the playable MVP.** Swimming, feeding, growth, hunger, one
mutation, and one predator species with a working state machine. Everything
after that is planned but not written; see the roadmap at the bottom.

---

## Running it

1. Open this folder as a project in Unity Hub. It targets **Unity 2022.3 LTS or
   newer**; it is built and verified on **Unity 6.3 LTS (6000.3.22f1)**.
2. Let Unity generate `Library/` on first open — that takes a minute and is
   normal.
3. Open `Assets/Scenes/Stage1_Broth.unity`.
4. Press Play.

The scene holds one empty object with `GameBootstrap` on it; everything else is
created at runtime, so there is nothing to drag into an inspector. If you delete
it or want a fresh one, **Evolve → Create Stage 1 Scene** rebuilds it, and
**Evolve → Add Bootstrap To Current Scene** drops the same object into a scene
you already have.

### A correction on the version

You asked for Unity 2023 LTS. There is no such release: the 2023 line was a
tech stream, and 2023.3 was renamed **Unity 6** before it ever shipped as an
LTS. The last conventional LTS is **2022.3**, and the current one is **Unity 6
(6000.x)**. This project sticks to APIs present in both, so either works.

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` | Swim, relative to the camera |
| `Space` / `E` | Rise |
| `Ctrl` / `Q` | Sink |
| Right mouse drag | Look around |
| Mouse wheel | Zoom |
| `R` | Restart |

## What Stage 1 actually does

**Swimming.** Hand-integrated motion in a viscous medium — heavy exponential
drag, and thrust delivered in pulses rather than as a steady push, because
flagellates lurch. Acceleration falls off as you grow: thrust scales with
surface area, mass with volume.

**Feeding and growth.** Motes drift through the broth; touching one eats it.
Most restore energy only, roughly one in eight is also worth an evolution
point. Two percent of everything you eat is invested as biomass. Radius is the
cube root of biomass, so doubling your size costs eight times the food.

**Hunger.** Energy drains constantly, faster the bigger you are and the harder
you swim. At zero you start losing health. Above half energy you heal.

**One mutation.** The **Flagellum** costs one evolution point and gives about
two thirds more thrust for a fifth more upkeep. It physically grows on the
model: a five-joint tail that lashes in a travelling wave and beats harder the
harder you swim.

**One predator, four states.** `Idle → Patrol → Hunt → Attack`, plus `Flee`.
Each one compares its biomass to yours: at least 15% bigger than you and it
hunts; 25% smaller and it runs. It gives up a chase past its lose-interest
range. Once you are 40% bigger than one, you can simply eat it — which is what
makes growing worth the energy it costs.

**No assets.** Every mesh is a Unity primitive deformed by Perlin noise, every
material is built at runtime, and the cell bodies are seeded so no two look
alike. There is not one imported file in the project.

## Layout

```
Assets/Scripts/
  Core/          CellStats, SwimMotor, CellController, mutations, food, bootstrap
  AI/            CreatureState, PredatorAI
  Environment/   FluidVolume, FoodSpawner, AmbientParticles
  Rendering/     MaterialFactory, ProceduralShapes, CellVisual, CameraRig
  UI/            HudController
Assets/Editor/   EvolveSceneBuilder (the menu items above)
```

Some decisions worth knowing before you extend it:

- **No assembly definitions.** `Core` and `AI` reference each other — the
  player eats predators, predators hunt the player — which two asmdefs cannot
  express without a third shared assembly. Not worth the ceremony at this size.
  Stage 2 is the moment to split it properly.
- **No Rigidbody.** Stage 1 needs no collision response, so contact is a
  distance check and motion is integrated by hand. That makes the feel
  independent of the project's physics settings.
- **No NavMesh.** NavMesh navigates surfaces; this era is open water in three
  dimensions. The state machine is deliberately kept separate from how movement
  happens, so the land eras can drop NavMesh in underneath it unchanged.
- **IMGUI for the HUD.** A runtime uGUI canvas needs a font asset, and the name
  of the built-in font has changed between Unity versions. IMGUI needs nothing.
  Stage 4 replaces it.
- **Render pipeline agnostic.** Every material goes through `MaterialFactory`,
  which finds a URP, HDRP or built-in shader and sets both `_BaseColor` and
  `_Color`. The HDRP move in Stage 3 will not require touching call sites.

## Tuning

Select the `GameBootstrap` object and adjust the fields in the inspector —
volume radius, predator count and size range, food density, starting biomass.
Per-organism numbers live on `CellStats`, `SwimMotor` and `PredatorAI`.

## Roadmap

- **Stage 1 — done.** Cell swims, eats, grows, one mutation, one predator.
- **Stage 2.** The full branching mutation tree (shell, spines, eye spots are
  already defined and wired, just gated off), two or three eras, several
  creature types, NPCs that eat and breed independently of the player.
- **Stage 3.** HDRP, a real water shader with refraction, depth fog, richer
  particles, procedural terrain from Perlin noise for the land eras, IK limbs.
- **Stage 4.** Audio, music, menus, a proper UI, save and load.

## Status

Compiles clean on Unity 6.3 LTS (6000.3.22f1) — `Assembly-CSharp.dll` and
`Assembly-CSharp-Editor.dll` both build with no errors and no warnings. The
scene loads and the project opens.

It has **not been played through** yet, so the numbers are unproven: how fast
growth feels, whether the predators are a threat or a nuisance, whether food
density is right. Expect to spend the first session on the tuning values rather
than on bugs — they are all exposed on `GameBootstrap`, `CellStats`,
`SwimMotor` and `PredatorAI` in the inspector.
