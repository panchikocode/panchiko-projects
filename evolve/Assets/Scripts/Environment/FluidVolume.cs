using UnityEngine;

namespace Evolve.Environment
{
    /// <summary>
    /// The body of water everything in Stage 1 lives in.
    ///
    /// A sphere rather than a box: there are no corners to get wedged into,
    /// the "swim back toward the middle" nudge is one vector subtraction, and
    /// it reads as an unbounded broth instead of an aquarium.
    /// </summary>
    public class FluidVolume : MonoBehaviour
    {
        public static FluidVolume Instance { get; private set; }

        [Header("Extent")]
        public float radius = 45f;

        [Header("Physics")]
        [Tooltip("Velocity retained per second. Water is thick; cells coast very little.")]
        [Range(0.001f, 0.999f)] public float dragPerSecond = 0.02f;

        [Tooltip("Slow bulk drift of the medium, in units per second.")]
        public Vector3 current = new Vector3(0.15f, 0f, -0.1f);

        [Header("Containment")]
        [Tooltip("How hard the boundary pushes an organism back toward the centre.")]
        public float boundaryPush = 12f;

        [Tooltip("Distance inside the boundary at which the push begins.")]
        public float boundaryMargin = 6f;

        void Awake()
        {
            // Last one wins rather than first: a scene rebuilt at runtime
            // should hand control to the new volume, not the stale one.
            Instance = this;
        }

        void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        /// <summary>
        /// Extra acceleration pushing an organism away from the wall. Zero
        /// while it is comfortably inside.
        /// </summary>
        public Vector3 ContainmentAcceleration(Vector3 position)
        {
            Vector3 toCentre = transform.position - position;
            float distance = toCentre.magnitude;
            float limit = radius - boundaryMargin;

            if (distance <= limit || distance < 0.0001f) return Vector3.zero;

            float overshoot = Mathf.Clamp01((distance - limit) / Mathf.Max(boundaryMargin, 0.001f));
            return toCentre.normalized * (overshoot * overshoot * boundaryPush);
        }

        /// <summary>A hard backstop, in case something outruns the soft push.</summary>
        public Vector3 ClampPosition(Vector3 position)
        {
            Vector3 offset = position - transform.position;
            float distance = offset.magnitude;
            if (distance <= radius || distance < 0.0001f) return position;
            return transform.position + offset / distance * radius;
        }

        public Vector3 RandomPointInside(float inset = 0f)
        {
            float r = Mathf.Max(0f, radius - inset);
            return transform.position + Random.insideUnitSphere * r;
        }

        /// <summary>Fraction of the way from the centre to the wall, 0 to 1.</summary>
        public float NormalizedDepth(Vector3 position)
        {
            if (radius <= 0.0001f) return 0f;
            return Mathf.Clamp01(Vector3.Distance(position, transform.position) / radius);
        }

        void OnDrawGizmosSelected()
        {
            Gizmos.color = new Color(0.3f, 0.7f, 0.9f, 0.35f);
            Gizmos.DrawWireSphere(transform.position, radius);
            Gizmos.color = new Color(0.9f, 0.5f, 0.3f, 0.25f);
            Gizmos.DrawWireSphere(transform.position, Mathf.Max(0f, radius - boundaryMargin));
        }
    }
}
