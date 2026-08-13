using System.Collections.Generic;
using UnityEngine;
using Evolve.Environment;

namespace Evolve.Core
{
    /// <summary>
    /// A mote of food drifting in the broth.
    ///
    /// Every live particle registers itself in a static list. Eating and AI
    /// foraging both need "what is near me", and walking a list of a few
    /// hundred motes is far cheaper than physics queries or FindObjectsOfType,
    /// and does not depend on colliders existing at all.
    /// </summary>
    public class FoodParticle : MonoBehaviour
    {
        static readonly List<FoodParticle> _live = new List<FoodParticle>();
        public static IReadOnlyList<FoodParticle> Live => _live;

        [Tooltip("Energy restored when eaten.")]
        public float nutrition = 9f;

        [Tooltip("Evolution points awarded. Most motes give none; some are worth points.")]
        public int evolutionPoints;

        public float radius = 0.18f;

        Vector3 _drift;
        float _bobPhase;
        float _bobAmplitude;

        /// <summary>Set by the spawner so eaten motes can be recycled.</summary>
        public System.Action<FoodParticle> Recycled;

        void OnEnable()
        {
            _live.Add(this);
            _drift = Random.insideUnitSphere * 0.35f;
            _bobPhase = Random.value * Mathf.PI * 2f;
            _bobAmplitude = Random.Range(0.05f, 0.2f);
        }

        void OnDisable()
        {
            _live.Remove(this);
        }

        void Update()
        {
            float dt = Time.deltaTime;
            var fluid = FluidVolume.Instance;

            Vector3 motion = _drift;
            if (fluid != null) motion += fluid.current;

            // A slow vertical bob sells "suspended in liquid" more cheaply
            // than any particle system would.
            _bobPhase += dt * 0.8f;
            motion.y += Mathf.Sin(_bobPhase) * _bobAmplitude;

            transform.position += motion * dt;

            if (fluid != null)
                transform.position = fluid.ClampPosition(transform.position);
        }

        /// <summary>Hand this mote back to its spawner.</summary>
        public void Consume()
        {
            if (Recycled != null) Recycled(this);
            else gameObject.SetActive(false);
        }

        /// <summary>
        /// Nearest mote to a point within <paramref name="maxDistance"/>, or
        /// null. Compares squared distances to keep the square root out of the
        /// inner loop.
        /// </summary>
        public static FoodParticle FindNearest(Vector3 position, float maxDistance)
        {
            FoodParticle best = null;
            float bestSqr = maxDistance * maxDistance;

            for (int i = 0; i < _live.Count; i++)
            {
                var f = _live[i];
                if (f == null) continue;

                float sqr = (f.transform.position - position).sqrMagnitude;
                if (sqr < bestSqr)
                {
                    bestSqr = sqr;
                    best = f;
                }
            }
            return best;
        }
    }
}
