using System.Collections.Generic;
using UnityEngine;
using Evolve.Core;
using Evolve.Environment;
using Evolve.Rendering;

namespace Evolve.AI
{
    /// <summary>
    /// A hunting microbe. Patrols the broth, chases anything smaller than it,
    /// bites what it catches, and runs from anything that has outgrown it.
    ///
    /// Stage 1 steers directly rather than using NavMesh: NavMesh is a surface
    /// solution and this era is fully three-dimensional open water. The land
    /// eras in Stage 2 are where NavMesh earns its place, which is why the
    /// state machine here is deliberately kept independent of how movement is
    /// carried out.
    /// </summary>
    [RequireComponent(typeof(CellStats))]
    [RequireComponent(typeof(SwimMotor))]
    public class PredatorAI : MonoBehaviour
    {
        static readonly List<PredatorAI> _live = new List<PredatorAI>();
        public static IReadOnlyList<PredatorAI> Live => _live;

        [Header("Perception")]
        public float senseRadius = 14f;

        [Tooltip("Give up the chase past this distance.")]
        public float loseInterestRadius = 22f;

        [Header("Combat")]
        public float contactDamage = 14f;
        public float attackInterval = 0.9f;

        [Tooltip("Prey must be at least this much smaller to be worth chasing.")]
        public float preySizeRatio = 0.85f;

        [Tooltip("Flee when the other organism is at least this much bigger.")]
        public float threatSizeRatio = 1.25f;

        [Header("Patrol")]
        public float patrolRadius = 18f;
        public float waypointTolerance = 2f;
        public float idleDuration = 1.5f;

        [Header("Reward")]
        [Tooltip("Evolution points the player gets for outliving this one.")]
        public int evolutionReward = 1;

        public CreatureState State { get; private set; } = CreatureState.Idle;

        CellStats _stats;
        SwimMotor _motor;
        CellVisual _visual;

        Vector3 _patrolTarget;
        float _stateTimer;
        float _attackCooldown;
        Transform _target;
        CellStats _targetStats;

        void Awake()
        {
            _stats = GetComponent<CellStats>();
            _motor = GetComponent<SwimMotor>();
            _visual = GetComponentInChildren<CellVisual>();
            _patrolTarget = transform.position;
        }

        void OnEnable()
        {
            _live.Add(this);
            if (_stats != null) _stats.Died += OnDied;
        }

        void OnDisable()
        {
            _live.Remove(this);
            if (_stats != null) _stats.Died -= OnDied;
        }

        void OnDied()
        {
            var player = CellController.Instance;
            if (player != null && !player.Stats.IsDead)
                player.Stats.AwardEvolutionPoints(evolutionReward);

            gameObject.SetActive(false);
        }

        void Update()
        {
            if (_stats.IsDead) return;

            float dt = Time.deltaTime;
            _stateTimer -= dt;
            _attackCooldown -= dt;

            Sense();
            Vector3 desired = Act(dt);

            _motor.Move(desired, dt);
            _stats.Tick(dt, _motor.Effort);
            if (_visual != null) _visual.Effort = _motor.Effort;
        }

        /// <summary>
        /// Decide what this creature currently cares about. Threat beats prey:
        /// being eaten is worse than going hungry.
        /// </summary>
        void Sense()
        {
            var player = CellController.Instance;
            if (player == null || player.Stats.IsDead)
            {
                if (State == CreatureState.Hunt || State == CreatureState.Attack || State == CreatureState.Flee)
                    EnterState(CreatureState.Patrol);
                _target = null;
                _targetStats = null;
                return;
            }

            float distance = Vector3.Distance(transform.position, player.transform.position);
            float sizeRatio = player.Stats.biomass / Mathf.Max(_stats.biomass, 0.0001f);

            bool inSense = distance <= senseRadius;
            bool stillRelevant = distance <= loseInterestRadius;

            if (sizeRatio >= threatSizeRatio)
            {
                // Bigger than us. Run while it is anywhere near.
                if (inSense || (State == CreatureState.Flee && stillRelevant))
                {
                    _target = player.transform;
                    _targetStats = player.Stats;
                    EnterState(CreatureState.Flee);
                    return;
                }
            }
            else if (sizeRatio <= preySizeRatio)
            {
                if (inSense || ((State == CreatureState.Hunt || State == CreatureState.Attack) && stillRelevant))
                {
                    _target = player.transform;
                    _targetStats = player.Stats;

                    float contact = _stats.Radius + player.Stats.Radius + 0.25f;
                    EnterState(distance <= contact ? CreatureState.Attack : CreatureState.Hunt);
                    return;
                }
            }

            // Evenly matched, or nothing worth reacting to.
            if (State == CreatureState.Hunt || State == CreatureState.Attack || State == CreatureState.Flee)
            {
                _target = null;
                _targetStats = null;
                EnterState(CreatureState.Patrol);
            }
        }

        Vector3 Act(float dt)
        {
            switch (State)
            {
                case CreatureState.Idle:
                    if (_stateTimer <= 0f) EnterState(CreatureState.Patrol);
                    return Vector3.zero;

                case CreatureState.Patrol:
                    return Patrol();

                case CreatureState.Hunt:
                    if (_target == null) { EnterState(CreatureState.Patrol); return Vector3.zero; }
                    return (_target.position - transform.position).normalized;

                case CreatureState.Attack:
                    return Attack();

                case CreatureState.Flee:
                    if (_target == null) { EnterState(CreatureState.Patrol); return Vector3.zero; }
                    return (transform.position - _target.position).normalized;

                default:
                    return Vector3.zero;
            }
        }

        Vector3 Patrol()
        {
            Vector3 toTarget = _patrolTarget - transform.position;

            if (toTarget.magnitude <= waypointTolerance || _stateTimer <= 0f)
            {
                PickPatrolTarget();

                // Pause between legs so patrolling does not look like a machine
                // ticking between waypoints.
                if (Random.value < 0.35f)
                {
                    EnterState(CreatureState.Idle);
                    _stateTimer = idleDuration * Random.Range(0.6f, 1.6f);
                    return Vector3.zero;
                }
            }

            // Two thirds throttle: cruising, with headroom to accelerate when
            // something worth chasing turns up.
            return toTarget.normalized * 0.65f;
        }

        Vector3 Attack()
        {
            if (_target == null || _targetStats == null)
            {
                EnterState(CreatureState.Patrol);
                return Vector3.zero;
            }

            if (_attackCooldown <= 0f)
            {
                _attackCooldown = attackInterval;

                var player = CellController.Instance;
                if (player != null && player.Stats == _targetStats)
                    player.TakeDamage(contactDamage, transform.position);
                else
                    _targetStats.Damage(contactDamage);

                // Recoil, so a predator does not simply park inside its prey.
                Vector3 back = (transform.position - _target.position);
                if (back.sqrMagnitude > 0.0001f)
                    _motor.AddImpulse(back.normalized * 3f);
            }

            return (_target.position - transform.position).normalized * 0.4f;
        }

        void PickPatrolTarget()
        {
            var fluid = FluidVolume.Instance;

            Vector3 candidate = transform.position + Random.insideUnitSphere * patrolRadius;
            if (fluid != null) candidate = fluid.ClampPosition(candidate);

            _patrolTarget = candidate;
            _stateTimer = 8f; // hard cap, so an unreachable waypoint is abandoned
        }

        void EnterState(CreatureState next)
        {
            if (State == next) return;
            State = next;

            if (next == CreatureState.Patrol) PickPatrolTarget();
            else if (next == CreatureState.Idle) _stateTimer = idleDuration;
        }

        void OnDrawGizmosSelected()
        {
            Gizmos.color = new Color(1f, 0.3f, 0.3f, 0.4f);
            Gizmos.DrawWireSphere(transform.position, senseRadius);
        }
    }
}
