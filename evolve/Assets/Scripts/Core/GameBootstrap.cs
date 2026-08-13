using System.Collections.Generic;
using UnityEngine;
using Evolve.AI;
using Evolve.Environment;
using Evolve.Rendering;
using Evolve.UI;

namespace Evolve.Core
{
    /// <summary>
    /// Builds the entire Stage 1 world at runtime.
    ///
    /// The whole game is assembled from code so the repository stays a text
    /// checkout: no prefabs to keep in sync, no scene file whose binary-ish
    /// YAML nobody can review, and no "drag this into that slot" step between
    /// cloning and playing. Drop this component on one empty object, press
    /// Play, and everything below exists.
    /// </summary>
    public class GameBootstrap : MonoBehaviour
    {
        [Header("World")]
        public float volumeRadius = 45f;
        public Color waterColor = new Color(0.035f, 0.10f, 0.145f);
        public Color fogColor = new Color(0.05f, 0.15f, 0.20f);
        public float fogDensity = 0.022f;

        [Header("Player")]
        public float startingBiomass = 1f;

        [Header("Predators")]
        public int predatorCount = 7;
        public float predatorMinBiomass = 0.7f;
        public float predatorMaxBiomass = 2.6f;

        [Header("Food")]
        public int foodCount = 260;

        [Header("Controls")]
        public KeyCode restartKey = KeyCode.R;

        GameObject _worldRoot;
        CellController _player;

        void Start()
        {
            BuildWorld();
        }

        void Update()
        {
            // Restart is always available, not only on death: an unwinnable
            // position is just as worth abandoning as a lost one.
            if (Input.GetKeyDown(restartKey)) Rebuild();
        }

        void Rebuild()
        {
            if (_worldRoot != null)
            {
                // Destroy is deferred to the end of the frame, so the old
                // camera and AudioListener would briefly coexist with the new
                // ones and Unity would complain about both. Switching the root
                // off first retires them immediately.
                _worldRoot.SetActive(false);
                Destroy(_worldRoot);
            }
            BuildWorld();
        }

        void BuildWorld()
        {
            _worldRoot = new GameObject("EvolveWorld");

            BuildEnvironment(_worldRoot.transform);
            _player = BuildPlayer(_worldRoot.transform);
            BuildCamera(_worldRoot.transform);
            BuildFood(_worldRoot.transform);
            BuildPredators(_worldRoot.transform);
            BuildHud(_worldRoot.transform);
        }

        // ------------------------------------------------------------------

        void BuildEnvironment(Transform parent)
        {
            var volumeGo = new GameObject("FluidVolume");
            volumeGo.transform.SetParent(parent, false);

            var volume = volumeGo.AddComponent<FluidVolume>();
            volume.radius = volumeRadius;

            // Depth fog is what turns an empty sphere into "somewhere in a
            // body of water" without any geometry at all.
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = fogColor;
            RenderSettings.fogDensity = fogDensity;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.16f, 0.32f, 0.38f);
            RenderSettings.ambientEquatorColor = new Color(0.08f, 0.16f, 0.22f);
            RenderSettings.ambientGroundColor = new Color(0.02f, 0.05f, 0.07f);

            var lightGo = new GameObject("SunShaft");
            lightGo.transform.SetParent(parent, false);
            lightGo.transform.rotation = Quaternion.Euler(62f, -30f, 0f);

            var light = lightGo.AddComponent<Light>();
            light.type = LightType.Directional;
            light.color = new Color(0.75f, 0.92f, 1f);
            light.intensity = 1.15f;
            light.shadows = LightShadows.None;   // nothing here casts meaningful shadows yet

            var motes = new GameObject("Suspension");
            motes.transform.SetParent(parent, false);
            motes.AddComponent<AmbientParticles>();
        }

        CellController BuildPlayer(Transform parent)
        {
            var go = new GameObject("PlayerCell");
            go.transform.SetParent(parent, false);
            go.transform.position = Vector3.zero;

            var stats = go.AddComponent<CellStats>();
            stats.startingBiomass = startingBiomass;
            stats.biomass = startingBiomass;

            go.AddComponent<MutationSystem>();
            go.AddComponent<SwimMotor>();

            var visualGo = new GameObject("Visual");
            visualGo.transform.SetParent(go.transform, false);
            var visual = visualGo.AddComponent<CellVisual>();
            visual.membraneColor = new Color(0.5f, 0.9f, 0.78f, 0.8f);
            visual.nucleusColor = new Color(0.15f, 0.42f, 0.5f);
            visual.shapeSeed = 3;

            var controller = go.AddComponent<CellController>();

            // ResetTo has to run after every component exists, so the radius
            // event finds the visual already listening.
            stats.ResetTo(startingBiomass);

            return controller;
        }

        void BuildCamera(Transform parent)
        {
            var go = new GameObject("MainCamera");
            go.transform.SetParent(parent, false);
            go.tag = "MainCamera";

            var cam = go.AddComponent<Camera>();
            cam.backgroundColor = waterColor;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.nearClipPlane = 0.05f;
            cam.farClipPlane = 400f;
            cam.fieldOfView = 62f;

            go.AddComponent<AudioListener>();

            var rig = go.AddComponent<CameraRig>();
            rig.target = _player != null ? _player.transform : null;
        }

        void BuildFood(Transform parent)
        {
            var go = new GameObject("FoodSpawner");
            go.transform.SetParent(parent, false);

            var spawner = go.AddComponent<FoodSpawner>();
            spawner.targetCount = foodCount;
        }

        void BuildPredators(Transform parent)
        {
            var root = new GameObject("Predators");
            root.transform.SetParent(parent, false);

            for (int i = 0; i < predatorCount; i++)
                BuildPredator(root.transform, i);
        }

        void BuildPredator(Transform parent, int index)
        {
            var go = new GameObject($"Predator{index}");
            go.transform.SetParent(parent, false);

            var volume = FluidVolume.Instance;
            Vector3 position = volume != null ? volume.RandomPointInside(6f) : Random.insideUnitSphere * 30f;

            // Never spawn one on top of the player.
            if (_player != null)
            {
                Vector3 away = position - _player.transform.position;
                if (away.sqrMagnitude < 144f)
                    position = _player.transform.position + away.normalized * 12f;
            }
            go.transform.position = position;

            float biomass = Random.Range(predatorMinBiomass, predatorMaxBiomass);

            var stats = go.AddComponent<CellStats>();
            stats.startingBiomass = biomass;
            stats.biomass = biomass;

            // Predators are not on the same clock as the player: they should
            // not quietly starve to death off screen while nobody watches.
            // Only the upkeep rates are set here — ResetTo below recomputes
            // the pools from biomass, so setting them now would be a no-op.
            stats.basalUpkeep = 0.15f;
            stats.swimUpkeep = 0.3f;

            go.AddComponent<MutationSystem>();

            var motor = go.AddComponent<SwimMotor>();
            motor.baseThrust = 11f;
            motor.pulseDepth = 0.25f;

            var visualGo = new GameObject("Visual");
            visualGo.transform.SetParent(go.transform, false);
            var visual = visualGo.AddComponent<CellVisual>();
            visual.membraneColor = new Color(0.85f, 0.35f, 0.42f, 0.82f);
            visual.nucleusColor = new Color(0.4f, 0.08f, 0.14f);
            visual.shapeSeed = 40 + index;

            var ai = go.AddComponent<PredatorAI>();
            ai.senseRadius = 12f + biomass * 2f;

            stats.ResetTo(biomass);
        }

        void BuildHud(Transform parent)
        {
            var go = new GameObject("HUD");
            go.transform.SetParent(parent, false);
            go.AddComponent<HudController>();
        }
    }
}
