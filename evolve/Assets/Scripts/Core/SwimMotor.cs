using UnityEngine;
using Evolve.Environment;

namespace Evolve.Core
{
    /// <summary>
    /// Movement for anything that swims. Shared by the player and the AI so
    /// both obey the same water.
    ///
    /// Integration is done by hand rather than through a Rigidbody: Stage 1
    /// needs no collision response, contact is resolved by distance checks,
    /// and hand integration keeps the feel identical no matter what the
    /// project's physics settings happen to be.
    /// </summary>
    public class SwimMotor : MonoBehaviour
    {
        [Header("Thrust")]
        [Tooltip("Base acceleration at biomass 1, before mutations.")]
        public float baseThrust = 14f;

        [Tooltip("Degrees per second the body can reorient at full turn rate.")]
        public float baseTurnRate = 220f;

        [Header("Feel")]
        [Tooltip("Cells swim in pulses rather than gliding. 0 disables the pulsing.")]
        [Range(0f, 1f)] public float pulseDepth = 0.35f;

        [Tooltip("Pulses per second.")]
        public float pulseRate = 2.4f;

        public Vector3 Velocity { get; private set; }

        /// <summary>Normalised effort this frame, 0 to 1. Read by stats and animation.</summary>
        public float Effort { get; private set; }

        CellStats _stats;
        MutationSystem _mutations;
        float _pulsePhase;

        void Awake()
        {
            _stats = GetComponent<CellStats>();
            _mutations = GetComponent<MutationSystem>();
            _pulsePhase = Random.value * Mathf.PI * 2f;
        }

        /// <summary>
        /// Drive one frame. <paramref name="desiredDirection"/> need not be
        /// normalised; its magnitude is the throttle, clamped to 1.
        /// </summary>
        public void Move(Vector3 desiredDirection, float deltaTime)
        {
            var fluid = FluidVolume.Instance;

            float throttle = Mathf.Min(desiredDirection.magnitude, 1f);
            Vector3 dir = throttle > 0.0001f ? desiredDirection.normalized : Vector3.zero;

            // Bigger bodies are harder to shift: thrust scales with area while
            // mass scales with volume, so acceleration falls off as it grows.
            float size = _stats != null ? Mathf.Max(_stats.biomass, 0.0001f) : 1f;
            float sizePenalty = 1f / Mathf.Pow(size, 1f / 3f);

            float speedMul = _mutations != null ? _mutations.SpeedMultiplier : 1f;
            float turnMul = _mutations != null ? _mutations.TurnMultiplier : 1f;

            // Real flagellates lurch rather than cruise. The pulse only shapes
            // thrust, never direction, so control stays predictable.
            _pulsePhase += deltaTime * pulseRate * Mathf.PI * 2f;
            float pulse = 1f - pulseDepth * 0.5f * (1f + Mathf.Cos(_pulsePhase));

            Vector3 acceleration = dir * (baseThrust * speedMul * sizePenalty * throttle * pulse);

            if (fluid != null)
            {
                acceleration += fluid.ContainmentAcceleration(transform.position);
                acceleration += fluid.current;
            }

            Velocity += acceleration * deltaTime;

            // Exponential drag, framerate independent: the fraction of velocity
            // kept after one second is dragPerSecond.
            float keep = fluid != null ? fluid.dragPerSecond : 0.02f;
            Velocity *= Mathf.Pow(Mathf.Clamp(keep, 0.0001f, 0.9999f), deltaTime);

            transform.position += Velocity * deltaTime;

            if (fluid != null)
                transform.position = fluid.ClampPosition(transform.position);

            // Face where we are actually going, not where input pointed.
            if (Velocity.sqrMagnitude > 0.01f)
            {
                Quaternion target = Quaternion.LookRotation(Velocity.normalized, Vector3.up);
                transform.rotation = Quaternion.RotateTowards(
                    transform.rotation, target, baseTurnRate * turnMul * deltaTime);
            }

            Effort = throttle;
        }

        public void Stop() => Velocity = Vector3.zero;

        /// <summary>Shove this organism, for knockback and similar.</summary>
        public void AddImpulse(Vector3 impulse) => Velocity += impulse;
    }
}
