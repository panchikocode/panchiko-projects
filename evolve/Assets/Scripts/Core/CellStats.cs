using System;
using UnityEngine;

namespace Evolve.Core
{
    /// <summary>
    /// Everything about an organism that a number can describe: how big it is,
    /// how much energy it has left, how much damage it can take.
    ///
    /// Biomass is the single source of truth for size. Radius, speed penalty,
    /// upkeep and edibility are all derived from it, so growth never needs to
    /// be applied to five fields that can drift apart.
    /// </summary>
    public class CellStats : MonoBehaviour
    {
        [Header("Biomass")]
        [Tooltip("Growth is measured in biomass; radius is derived from it.")]
        public float biomass = 1f;
        public float startingBiomass = 1f;

        [Header("Energy")]
        [Tooltip("Energy is spent living and swimming, and refilled by eating.")]
        public float energy = 100f;
        public float maxEnergy = 100f;

        [Tooltip("Energy burned per second at rest, per unit of biomass.")]
        public float basalUpkeep = 1.6f;

        [Tooltip("Extra energy burned per second while swimming at full effort.")]
        public float swimUpkeep = 4.0f;

        [Header("Health")]
        public float health = 100f;
        public float maxHealth = 100f;

        [Tooltip("Health lost per second while starving.")]
        public float starvationDamage = 8f;

        [Tooltip("Health regained per second while well fed.")]
        public float regenRate = 3f;

        [Tooltip("Regeneration only happens above this fraction of max energy.")]
        [Range(0f, 1f)] public float regenEnergyThreshold = 0.5f;

        [Header("Evolution")]
        public int evolutionPoints;

        /// <summary>Raised when this organism's biomass changes. Payload is the new radius.</summary>
        public event Action<float> RadiusChanged;

        /// <summary>Raised once, when health reaches zero.</summary>
        public event Action Died;

        public bool IsDead { get; private set; }

        /// <summary>
        /// Radius grows with the cube root of biomass: doubling the radius
        /// costs eight times the mass, the same way volume actually works.
        /// Without this, eating a few particles would inflate the cell
        /// alarmingly fast.
        /// </summary>
        public float Radius => Mathf.Pow(Mathf.Max(biomass, 0.0001f), 1f / 3f) * 0.5f;

        public float EnergyFraction => maxEnergy > 0f ? energy / maxEnergy : 0f;
        public float HealthFraction => maxHealth > 0f ? health / maxHealth : 0f;
        public bool IsStarving => energy <= 0f;

        float _lastAppliedRadius = -1f;

        void Awake()
        {
            if (biomass <= 0f) biomass = startingBiomass;
            NotifyRadius(force: true);
        }

        /// <summary>
        /// Burn one frame's worth of upkeep. <paramref name="effort"/> is the
        /// normalised swimming effort this frame, 0 to 1.
        /// </summary>
        public void Tick(float deltaTime, float effort)
        {
            if (IsDead) return;

            float upkeep = (basalUpkeep + swimUpkeep * Mathf.Clamp01(effort)) * biomass;
            energy -= upkeep * deltaTime;

            if (energy <= 0f)
            {
                energy = 0f;
                Damage(starvationDamage * deltaTime);
            }
            else if (EnergyFraction >= regenEnergyThreshold && health < maxHealth)
            {
                health = Mathf.Min(maxHealth, health + regenRate * deltaTime);
            }
        }

        /// <summary>Eat something. Part of the nutrition becomes energy, part becomes body.</summary>
        public void Consume(float nutrition)
        {
            if (IsDead) return;

            energy = Mathf.Min(maxEnergy, energy + nutrition);

            // A fixed slice of everything eaten is invested in growth.
            Grow(nutrition * 0.02f);
        }

        public void Grow(float amount)
        {
            if (IsDead || amount <= 0f) return;

            biomass += amount;

            // A bigger body holds more energy and takes more punishment.
            maxEnergy = 100f * Mathf.Sqrt(biomass);
            maxHealth = 100f * Mathf.Sqrt(biomass);

            NotifyRadius();
        }

        public void Damage(float amount)
        {
            if (IsDead || amount <= 0f) return;

            health -= amount;
            if (health <= 0f)
            {
                health = 0f;
                IsDead = true;
                Died?.Invoke();
            }
        }

        public void AwardEvolutionPoints(int points)
        {
            if (points <= 0) return;
            evolutionPoints += points;
        }

        public bool TrySpendEvolutionPoints(int cost)
        {
            if (cost <= 0 || evolutionPoints < cost) return false;
            evolutionPoints -= cost;
            return true;
        }

        public void ResetTo(float newBiomass)
        {
            IsDead = false;
            biomass = Mathf.Max(0.0001f, newBiomass);
            maxEnergy = 100f * Mathf.Sqrt(biomass);
            maxHealth = 100f * Mathf.Sqrt(biomass);
            energy = maxEnergy;
            health = maxHealth;
            NotifyRadius(force: true);
        }

        void NotifyRadius(bool force = false)
        {
            float r = Radius;
            // Only fire when the change is big enough to matter visually;
            // biomass creeps up on almost every frame that food is eaten.
            if (force || Mathf.Abs(r - _lastAppliedRadius) > 0.0005f)
            {
                _lastAppliedRadius = r;
                RadiusChanged?.Invoke(r);
            }
        }
    }
}
