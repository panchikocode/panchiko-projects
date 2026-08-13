using UnityEngine;
using Evolve.Rendering;

namespace Evolve.Environment
{
    /// <summary>
    /// Suspended matter drifting through the water, plus the occasional
    /// rising bubble.
    ///
    /// The system is parented to the camera and emits in a box around it, so a
    /// modest particle budget covers wherever the player happens to be instead
    /// of being spread thin across the whole volume.
    /// </summary>
    public class AmbientParticles : MonoBehaviour
    {
        [Header("Suspension")]
        public int motesPerSecond = 45;
        public float motesLifetime = 9f;
        public Vector3 emissionBox = new Vector3(26f, 18f, 26f);
        public Color moteColor = new Color(0.75f, 0.92f, 1f, 0.22f);

        [Header("Bubbles")]
        public int bubblesPerSecond = 6;
        public float bubbleRiseSpeed = 1.6f;
        public Color bubbleColor = new Color(0.85f, 0.97f, 1f, 0.4f);

        ParticleSystem _motes;
        ParticleSystem _bubbles;
        Transform _follow;

        void Start()
        {
            _motes = BuildSystem("Suspension", moteColor, motesPerSecond, motesLifetime,
                                 sizeMin: 0.03f, sizeMax: 0.09f, rise: 0.05f);

            _bubbles = BuildSystem("Bubbles", bubbleColor, bubblesPerSecond, 7f,
                                   sizeMin: 0.05f, sizeMax: 0.16f, rise: bubbleRiseSpeed);

            if (Camera.main != null) _follow = Camera.main.transform;
        }

        void LateUpdate()
        {
            if (_follow == null)
            {
                if (Camera.main == null) return;
                _follow = Camera.main.transform;
            }

            // Follow position only. Inheriting the camera's rotation would spin
            // the whole field of debris every time the player looks around.
            transform.position = _follow.position;
        }

        ParticleSystem BuildSystem(string name, Color color, int rate, float lifetime,
                                   float sizeMin, float sizeMax, float rise)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);

            var ps = go.AddComponent<ParticleSystem>();

            // ParticleSystem modules are structs that proxy the real system, so
            // they must be pulled into a local, mutated, and left alone; there
            // is nothing to assign back.
            var main = ps.main;
            main.loop = true;
            main.startLifetime = lifetime;
            main.startSpeed = new ParticleSystem.MinMaxCurve(0.05f, 0.3f);
            main.startSize = new ParticleSystem.MinMaxCurve(sizeMin, sizeMax);
            main.startColor = color;
            main.gravityModifier = -rise * 0.02f;   // negative gravity floats things up
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.maxParticles = Mathf.Max(64, Mathf.CeilToInt(rate * lifetime * 1.2f));
            main.playOnAwake = true;

            var emission = ps.emission;
            emission.rateOverTime = rate;

            var shape = ps.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = emissionBox;

            var renderer = go.GetComponent<ParticleSystemRenderer>();
            renderer.renderMode = ParticleSystemRenderMode.Billboard;
            renderer.material = MaterialFactory.Unlit(color);
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.receiveShadows = false;

            ps.Play();
            return ps;
        }
    }
}
