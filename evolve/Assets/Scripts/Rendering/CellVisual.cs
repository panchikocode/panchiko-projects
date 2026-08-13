using System.Collections.Generic;
using UnityEngine;
using Evolve.Core;

namespace Evolve.Rendering
{
    /// <summary>
    /// The body you actually see. Builds a lumpy membrane, keeps it in step
    /// with the organism's radius, and bolts on a new piece of anatomy each
    /// time a mutation unlocks.
    ///
    /// Visuals are driven by events from <see cref="CellStats"/> and
    /// <see cref="MutationSystem"/> rather than polled, so nothing here runs
    /// per frame except the parts that are genuinely animated.
    /// </summary>
    public class CellVisual : MonoBehaviour
    {
        [Header("Look")]
        public Color membraneColor = new Color(0.45f, 0.85f, 0.7f, 0.85f);
        public Color nucleusColor = new Color(0.15f, 0.35f, 0.45f, 1f);
        public int shapeSeed = 1;

        [Header("Motion")]
        [Tooltip("How fast the flagellum lashes, in cycles per second.")]
        public float flagellumBeat = 3.2f;

        [Tooltip("How far each tail segment swings, in degrees.")]
        public float flagellumSwing = 26f;

        Transform _body;
        Transform _anatomy;
        readonly List<Transform> _tailSegments = new List<Transform>();
        float _radius = 0.5f;

        CellStats _stats;
        MutationSystem _mutations;

        /// <summary>Set by the controller so the tail lashes harder under load.</summary>
        public float Effort { get; set; }

        void Awake()
        {
            _stats = GetComponentInParent<CellStats>();
            _mutations = GetComponentInParent<MutationSystem>();

            _anatomy = new GameObject("Anatomy").transform;
            _anatomy.SetParent(transform, false);

            BuildBody();

            if (_stats != null)
            {
                _stats.RadiusChanged += OnRadiusChanged;
                OnRadiusChanged(_stats.Radius);
            }

            if (_mutations != null)
                _mutations.Unlocked += OnMutationUnlocked;
        }

        void OnDestroy()
        {
            if (_stats != null) _stats.RadiusChanged -= OnRadiusChanged;
            if (_mutations != null) _mutations.Unlocked -= OnMutationUnlocked;
        }

        void BuildBody()
        {
            var membrane = MaterialFactory.Transparent(membraneColor);
            var bodyGo = ProceduralShapes.CreateRenderer(
                "Membrane", ProceduralShapes.Blob(shapeSeed), membrane, transform);
            _body = bodyGo.transform;

            // An off-centre nucleus reads as "this thing has an inside".
            var nucleus = ProceduralShapes.CreateRenderer(
                "Nucleus", ProceduralShapes.Blob(shapeSeed + 101, 0.2f),
                MaterialFactory.Opaque(nucleusColor, 0.3f), _body);
            nucleus.transform.localScale = Vector3.one * 0.42f;
            nucleus.transform.localPosition = new Vector3(0.06f, -0.04f, 0.02f);
        }

        void OnRadiusChanged(float radius)
        {
            _radius = radius;
            // The visual root is scaled, so every attached organelle follows
            // without needing to know the organism grew.
            transform.localScale = Vector3.one * (radius * 2f);
        }

        void OnMutationUnlocked(Mutation m)
        {
            switch (m.visual)
            {
                case MutationVisual.Flagellum: BuildFlagellum(); break;
                case MutationVisual.Shell: BuildShell(); break;
                case MutationVisual.Spikes: BuildSpikes(); break;
                case MutationVisual.Eyes: BuildEyes(); break;
                case MutationVisual.None: break;
            }
        }

        void BuildFlagellum()
        {
            if (_tailSegments.Count > 0) return;

            var mat = MaterialFactory.Opaque(membraneColor * 0.85f, 0.4f);
            Transform parent = _anatomy;

            const int segments = 5;
            const float segLength = 0.22f;

            for (int i = 0; i < segments; i++)
            {
                float t = i / (float)(segments - 1);

                // The joint carries rotation only. Meshes hang off it as
                // children with their own scale: a chained transform that is
                // both rotated and non-uniformly scaled shears everything
                // below it, which is exactly what a tail must not do.
                var joint = new GameObject($"TailJoint{i}").transform;
                joint.SetParent(parent, false);
                joint.localPosition = i == 0
                    ? new Vector3(0f, 0f, -0.46f)   // where the tail leaves the body
                    : new Vector3(0f, 0f, -segLength);

                float thickness = Mathf.Lerp(0.11f, 0.035f, t);
                var seg = ProceduralShapes.CreateRenderer(
                    $"Tail{i}", ProceduralShapes.Capsule, mat, joint).transform;

                // Unity's capsule is 2 units tall along Y; lay it along -Z and
                // scale it to one segment's length.
                seg.localRotation = Quaternion.Euler(90f, 0f, 0f);
                seg.localScale = new Vector3(thickness, segLength * 0.5f, thickness);
                seg.localPosition = new Vector3(0f, 0f, -segLength * 0.5f);

                _tailSegments.Add(joint);
                parent = joint;
            }
        }

        void BuildShell()
        {
            var shell = ProceduralShapes.CreateRenderer(
                "Shell",
                ProceduralShapes.Blob(shapeSeed + 7, 0.08f),
                MaterialFactory.Transparent(new Color(0.75f, 0.68f, 0.45f, 0.5f), 0.9f),
                _anatomy);

            shell.transform.localScale = Vector3.one * 1.16f;
        }

        void BuildSpikes()
        {
            var mat = MaterialFactory.Opaque(new Color(0.8f, 0.25f, 0.35f), 0.6f);

            const int count = 10;
            for (int i = 0; i < count; i++)
            {
                // Fibonacci sphere: evenly spread directions without clumping
                // at the poles, which a naive lat/long loop would do.
                float y = 1f - (i / (float)(count - 1)) * 2f;
                float r = Mathf.Sqrt(Mathf.Max(0f, 1f - y * y));
                float theta = i * 2.399963f; // golden angle
                var dir = new Vector3(Mathf.Cos(theta) * r, y, Mathf.Sin(theta) * r);

                var spike = ProceduralShapes.CreateRenderer(
                    $"Spike{i}", ProceduralShapes.Cone, mat, _anatomy).transform;

                spike.localPosition = dir * 0.48f;
                spike.localRotation = Quaternion.FromToRotation(Vector3.up, dir);
                spike.localScale = new Vector3(0.11f, 0.2f, 0.11f);
            }
        }

        void BuildEyes()
        {
            var white = MaterialFactory.Opaque(new Color(0.95f, 0.95f, 0.9f), 0.8f);
            var pupil = MaterialFactory.Opaque(new Color(0.05f, 0.04f, 0.08f), 0.9f);

            for (int side = -1; side <= 1; side += 2)
            {
                var eye = ProceduralShapes.CreateRenderer(
                    side < 0 ? "EyeL" : "EyeR", ProceduralShapes.Sphere, white, _anatomy).transform;

                eye.localPosition = new Vector3(0.19f * side, 0.14f, 0.42f);
                eye.localScale = Vector3.one * 0.19f;

                var dot = ProceduralShapes.CreateRenderer("Pupil", ProceduralShapes.Sphere, pupil, eye).transform;
                dot.localPosition = new Vector3(0f, 0f, 0.34f);
                dot.localScale = Vector3.one * 0.55f;
            }
        }

        void Update()
        {
            if (_tailSegments.Count == 0) return;

            // Idling still ripples a little; swimming hard whips it.
            float amplitude = flagellumSwing * Mathf.Lerp(0.25f, 1f, Mathf.Clamp01(Effort));
            float time = Time.time * flagellumBeat * Mathf.PI * 2f;

            for (int i = 0; i < _tailSegments.Count; i++)
            {
                // Each joint lags the one before it, which is what turns a
                // stack of rotations into a travelling wave rather than a
                // rigid tail wagging as one piece.
                float phase = time - i * 0.7f;
                float angle = Mathf.Sin(phase) * amplitude * ((i + 1f) / _tailSegments.Count);

                _tailSegments[i].localRotation = Quaternion.Euler(0f, angle, 0f);
            }
        }
    }
}
