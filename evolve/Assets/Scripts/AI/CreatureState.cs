namespace Evolve.AI
{
    /// <summary>
    /// States a creature can be in. Kept as a flat enum rather than a class
    /// hierarchy: Stage 1 has four states and one creature type, and a
    /// switch over an enum is far easier to read — and to debug from the
    /// inspector — than four small classes.
    ///
    /// Stage 2 splits this into an interface once several creature types need
    /// genuinely different behaviour per state.
    /// </summary>
    public enum CreatureState
    {
        /// <summary>Drifting, no target.</summary>
        Idle,

        /// <summary>Moving along a patrol route.</summary>
        Patrol,

        /// <summary>Closing on prey.</summary>
        Hunt,

        /// <summary>In contact range, dealing damage.</summary>
        Attack,

        /// <summary>Running from something bigger.</summary>
        Flee
    }
}
