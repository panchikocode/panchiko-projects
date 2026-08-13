using System.Collections.Generic;
using UnityEngine;

namespace Evolve.Core
{
    /// <summary>
    /// The mutation tree, defined in code so the project runs from a clean
    /// checkout with no assets to author.
    ///
    /// Stage 1 only ships the Flagellum as an unlockable; the rest are defined
    /// here so the tree, the prerequisite chain and the UI all have something
    /// real to work against, and are gated by <see cref="stageOneOnly"/> until
    /// Stage 2 turns them on.
    /// </summary>
    public static class MutationCatalog
    {
        /// <summary>Stage 1 exposes exactly one mutation. Flip to false in Stage 2.</summary>
        public static bool stageOneOnly = true;

        public const string Flagellum = "flagellum";
        public const string Shell = "shell";
        public const string Spikes = "spikes";
        public const string Eyes = "eyes";

        static List<Mutation> _all;

        public static IReadOnlyList<Mutation> All => _all ??= Build();

        /// <summary>Mutations the player is allowed to see right now.</summary>
        public static IEnumerable<Mutation> Available()
        {
            foreach (var m in All)
            {
                if (stageOneOnly && m.id != Flagellum) continue;
                yield return m;
            }
        }

        public static Mutation Find(string id)
        {
            foreach (var m in All)
                if (m.id == id) return m;
            return null;
        }

        static List<Mutation> Build()
        {
            return new List<Mutation>
            {
                new Mutation
                {
                    id = Flagellum,
                    displayName = "Flagellum",
                    description = "A whipping tail. Roughly two thirds more thrust, " +
                                  "and it costs energy to keep lashing.",
                    branch = MutationBranch.Locomotion,
                    cost = 1,
                    speedMultiplier = 1.65f,
                    turnMultiplier = 1.15f,
                    upkeepMultiplier = 1.2f,
                    visual = MutationVisual.Flagellum
                },

                new Mutation
                {
                    id = Shell,
                    displayName = "Chitin Shell",
                    description = "A hardened outer layer. Halves incoming damage, " +
                                  "and the extra weight slows you down.",
                    branch = MutationBranch.Defence,
                    cost = 2,
                    damageTakenMultiplier = 0.5f,
                    speedMultiplier = 0.85f,
                    upkeepMultiplier = 1.15f,
                    visual = MutationVisual.Shell
                },

                new Mutation
                {
                    id = Spikes,
                    displayName = "Venom Spines",
                    description = "Anything that touches you takes damage for the privilege.",
                    branch = MutationBranch.Offence,
                    cost = 2,
                    contactDamageBonus = 12f,
                    upkeepMultiplier = 1.1f,
                    visual = MutationVisual.Spikes
                },

                new Mutation
                {
                    id = Eyes,
                    displayName = "Eye Spots",
                    description = "Light-sensitive patches. You notice food and predators " +
                                  "from much further away.",
                    branch = MutationBranch.Senses,
                    cost = 2,
                    senseMultiplier = 2.0f,
                    upkeepMultiplier = 1.05f,
                    visual = MutationVisual.Eyes
                }
            };
        }
    }
}
