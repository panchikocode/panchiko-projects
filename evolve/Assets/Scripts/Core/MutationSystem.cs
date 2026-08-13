using System;
using System.Collections.Generic;
using UnityEngine;

namespace Evolve.Core
{
    /// <summary>
    /// Owns which mutations an organism has unlocked, and folds their effects
    /// into one set of multipliers the rest of the game reads.
    ///
    /// Nothing else multiplies mutation effects together; every consumer asks
    /// this component. That keeps a second mutation from silently double
    /// counting when Stage 2 adds branches.
    /// </summary>
    [RequireComponent(typeof(CellStats))]
    public class MutationSystem : MonoBehaviour
    {
        readonly HashSet<string> _unlocked = new HashSet<string>();

        /// <summary>Raised with the mutation that was just unlocked.</summary>
        public event Action<Mutation> Unlocked;

        public float SpeedMultiplier { get; private set; } = 1f;
        public float TurnMultiplier { get; private set; } = 1f;
        public float DamageTakenMultiplier { get; private set; } = 1f;
        public float ContactDamageBonus { get; private set; }
        public float SenseMultiplier { get; private set; } = 1f;
        public float UpkeepMultiplier { get; private set; } = 1f;

        public IReadOnlyCollection<string> UnlockedIds => _unlocked;

        public bool Has(string id) => _unlocked.Contains(id);

        /// <summary>True when every prerequisite of <paramref name="m"/> is already unlocked.</summary>
        public bool PrerequisitesMet(Mutation m)
        {
            if (m?.requires == null) return true;
            foreach (var req in m.requires)
                if (!_unlocked.Contains(req)) return false;
            return true;
        }

        public bool CanUnlock(Mutation m, CellStats stats)
        {
            if (m == null || stats == null) return false;
            if (_unlocked.Contains(m.id)) return false;
            if (!PrerequisitesMet(m)) return false;
            return stats.evolutionPoints >= m.cost;
        }

        /// <summary>
        /// Spend the points and apply the mutation. Returns false and changes
        /// nothing if it was not affordable or not yet reachable.
        /// </summary>
        public bool TryUnlock(Mutation m, CellStats stats)
        {
            if (!CanUnlock(m, stats)) return false;
            if (!stats.TrySpendEvolutionPoints(m.cost)) return false;

            _unlocked.Add(m.id);
            Recalculate();
            Unlocked?.Invoke(m);
            return true;
        }

        public void Clear()
        {
            _unlocked.Clear();
            Recalculate();
        }

        void Recalculate()
        {
            SpeedMultiplier = 1f;
            TurnMultiplier = 1f;
            DamageTakenMultiplier = 1f;
            ContactDamageBonus = 0f;
            SenseMultiplier = 1f;
            UpkeepMultiplier = 1f;

            foreach (var id in _unlocked)
            {
                var m = MutationCatalog.Find(id);
                if (m == null) continue;

                SpeedMultiplier *= m.speedMultiplier;
                TurnMultiplier *= m.turnMultiplier;
                DamageTakenMultiplier *= m.damageTakenMultiplier;
                ContactDamageBonus += m.contactDamageBonus;
                SenseMultiplier *= m.senseMultiplier;
                UpkeepMultiplier *= m.upkeepMultiplier;
            }
        }
    }
}
