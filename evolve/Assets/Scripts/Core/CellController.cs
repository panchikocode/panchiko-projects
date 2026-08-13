using UnityEngine;
using Evolve.Rendering;

namespace Evolve.Core
{
    /// <summary>
    /// The player's cell: turns input into swimming, and swallows anything
    /// small enough that it bumps into.
    /// </summary>
    [RequireComponent(typeof(CellStats))]
    [RequireComponent(typeof(MutationSystem))]
    [RequireComponent(typeof(SwimMotor))]
    public class CellController : MonoBehaviour
    {
        public static CellController Instance { get; private set; }

        [Header("Feeding")]
        [Tooltip("How far beyond the membrane the cell can engulf a mote.")]
        public float reachBonus = 0.35f;

        [Tooltip("A creature can be swallowed once its biomass is under this fraction of yours.")]
        [Range(0.1f, 1f)] public float engulfSizeRatio = 0.6f;

        [Header("Perception")]
        [Tooltip("Base sense radius before the Eye Spots mutation.")]
        public float baseSenseRadius = 12f;

        [Header("Input")]
        [Tooltip("Move relative to where the camera is looking rather than world axes.")]
        public bool cameraRelative = true;

        public CellStats Stats { get; private set; }
        public MutationSystem Mutations { get; private set; }
        public SwimMotor Motor { get; private set; }

        public float SenseRadius => baseSenseRadius * (Mutations != null ? Mutations.SenseMultiplier : 1f);
        public float EatRadius => Stats.Radius + reachBonus;

        CellVisual _visual;
        Transform _cameraTransform;

        void Awake()
        {
            Instance = this;
            Stats = GetComponent<CellStats>();
            Mutations = GetComponent<MutationSystem>();
            Motor = GetComponent<SwimMotor>();
            _visual = GetComponentInChildren<CellVisual>();
        }

        void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        void Start()
        {
            if (Camera.main != null) _cameraTransform = Camera.main.transform;
        }

        void Update()
        {
            if (Stats.IsDead)
            {
                Motor.Move(Vector3.zero, Time.deltaTime);
                return;
            }

            Vector3 input = ReadInput();
            Motor.Move(input, Time.deltaTime);

            // Mutations that add machinery make resting more expensive, so the
            // upkeep multiplier is folded in through the effort term.
            float upkeepMul = Mutations != null ? Mutations.UpkeepMultiplier : 1f;
            Stats.Tick(Time.deltaTime, Motor.Effort * upkeepMul);

            if (_visual != null) _visual.Effort = Motor.Effort;

            Feed();
            FeedOnCreatures();
        }

        Vector3 ReadInput()
        {
            // Axis names below are Unity's defaults, present in every new
            // project, so this needs no input map to be authored.
            float x = Input.GetAxisRaw("Horizontal");
            float z = Input.GetAxisRaw("Vertical");

            float y = 0f;
            if (Input.GetKey(KeyCode.Space) || Input.GetKey(KeyCode.E)) y += 1f;
            if (Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.Q)) y -= 1f;

            // The camera is built in the same frame as the player, so Start
            // may have run before it existed. Pick it up whenever it appears.
            if (_cameraTransform == null && Camera.main != null)
                _cameraTransform = Camera.main.transform;

            Vector3 dir;
            if (cameraRelative && _cameraTransform != null)
            {
                // Flatten the camera basis so looking down does not turn
                // "forward" into "dive".
                Vector3 forward = Vector3.ProjectOnPlane(_cameraTransform.forward, Vector3.up).normalized;
                if (forward.sqrMagnitude < 0.001f) forward = Vector3.forward;
                // Cross(up, forward) is already +right in Unity's left-handed
                // basis: for forward (0,0,1) it yields (1,0,0).
                Vector3 right = Vector3.Cross(Vector3.up, forward).normalized;

                dir = forward * z + right * x + Vector3.up * y;
            }
            else
            {
                dir = new Vector3(x, y, z);
            }

            // Clamp rather than normalise, so a single key is not full throttle
            // in the same way that two keys diagonally are.
            return Vector3.ClampMagnitude(dir, 1f);
        }

        void Feed()
        {
            float reach = EatRadius;
            float reachSqr = reach * reach;

            // Iterate backwards: Consume() deactivates the mote, which removes
            // it from the live list mid-loop.
            var live = FoodParticle.Live;
            for (int i = live.Count - 1; i >= 0; i--)
            {
                var food = live[i];
                if (food == null) continue;

                float sqr = (food.transform.position - transform.position).sqrMagnitude;
                if (sqr > reachSqr) continue;

                Stats.Consume(food.nutrition);
                if (food.evolutionPoints > 0) Stats.AwardEvolutionPoints(food.evolutionPoints);
                food.Consume();
            }
        }

        /// <summary>
        /// Swallow creatures that have fallen far enough behind in size. This
        /// is what makes growing worth the trouble: the things hunting you at
        /// the start become food once you outgrow them.
        /// </summary>
        void FeedOnCreatures()
        {
            var predators = Evolve.AI.PredatorAI.Live;

            for (int i = predators.Count - 1; i >= 0; i--)
            {
                var predator = predators[i];
                if (predator == null) continue;

                var prey = predator.GetComponent<CellStats>();
                if (prey == null || prey.IsDead) continue;

                // Needs a clear size advantage, otherwise the two would eat
                // each other on contact and the winner would be whoever's
                // Update ran first.
                if (prey.biomass > Stats.biomass * engulfSizeRatio) continue;

                float contact = Stats.Radius + prey.Radius;
                if ((predator.transform.position - transform.position).sqrMagnitude > contact * contact)
                    continue;

                Stats.Consume(prey.biomass * 26f);
                prey.Damage(prey.maxHealth * 2f);   // fatal; the creature awards its own points
            }
        }

        /// <summary>Take a hit, after armour.</summary>
        public void TakeDamage(float amount, Vector3 fromPosition)
        {
            if (Stats.IsDead) return;

            float mul = Mutations != null ? Mutations.DamageTakenMultiplier : 1f;
            Stats.Damage(amount * mul);

            Vector3 away = (transform.position - fromPosition);
            if (away.sqrMagnitude > 0.0001f)
                Motor.AddImpulse(away.normalized * 4f);
        }

        void OnDrawGizmosSelected()
        {
            if (Stats == null) return;
            Gizmos.color = new Color(1f, 0.85f, 0.3f, 0.6f);
            Gizmos.DrawWireSphere(transform.position, EatRadius);
            Gizmos.color = new Color(0.4f, 0.8f, 1f, 0.25f);
            Gizmos.DrawWireSphere(transform.position, SenseRadius);
        }
    }
}
