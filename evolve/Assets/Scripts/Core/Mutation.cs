using System;
using System.Collections.Generic;
using UnityEngine;

namespace Evolve.Core
{
    /// <summary>Which branch of the tree a mutation sits on. Stage 2 fans these out.</summary>
    public enum MutationBranch
    {
        Locomotion,
        Defence,
        Offence,
        Senses
    }

    /// <summary>
    /// One node of the mutation tree.
    ///
    /// Deliberately a plain serializable class rather than a ScriptableObject:
    /// assets cannot be created from a text-only checkout, and Stage 1 should
    /// run from a fresh clone with nothing to author by hand. Stage 2 can
    /// promote this to a ScriptableObject without touching the consumers.
    /// </summary>
    [Serializable]
    public class Mutation
    {
        public string id;
        public string displayName;
        [TextArea] public string description;
        public MutationBranch branch;
        public int cost = 1;

        /// <summary>Ids that must already be unlocked. Empty means it is a root node.</summary>
        public List<string> requires = new List<string>();

        [Header("Effects")]
        [Tooltip("Multiplies swim thrust.")]
        public float speedMultiplier = 1f;

        [Tooltip("Multiplies how fast the organism can change heading.")]
        public float turnMultiplier = 1f;

        [Tooltip("Multiplies incoming damage. Below 1 is armour.")]
        public float damageTakenMultiplier = 1f;

        [Tooltip("Flat contact damage added to this organism's attacks.")]
        public float contactDamageBonus = 0f;

        [Tooltip("Multiplies how far this organism can perceive things.")]
        public float senseMultiplier = 1f;

        [Tooltip("Multiplies resting energy burn. Bigger machinery costs more to run.")]
        public float upkeepMultiplier = 1f;

        /// <summary>What to bolt onto the model when this unlocks. Empty means no visual change.</summary>
        public MutationVisual visual = MutationVisual.None;
    }

    public enum MutationVisual
    {
        None,
        Flagellum,
        Shell,
        Spikes,
        Eyes
    }
}
