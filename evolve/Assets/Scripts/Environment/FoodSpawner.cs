using System.Collections.Generic;
using UnityEngine;
using Evolve.Core;
using Evolve.Rendering;

namespace Evolve.Environment
{
    /// <summary>
    /// Keeps the broth stocked with food.
    ///
    /// Motes are pooled rather than created and destroyed: at this density the
    /// churn would otherwise be a steady drip of garbage collection, and a
    /// stutter every few seconds is exactly the kind of thing that gets blamed
    /// on "Unity being slow".
    /// </summary>
    public class FoodSpawner : MonoBehaviour
    {
        [Header("Population")]
        public int targetCount = 260;

        [Tooltip("Motes restored per second once the population drops.")]
        public float respawnRate = 14f;

        [Header("Nutrition")]
        public float plainNutrition = 9f;

        [Tooltip("Fraction of motes that are rich in evolution points.")]
        [Range(0f, 1f)] public float richFraction = 0.12f;

        public float richNutrition = 14f;
        public int richEvolutionPoints = 1;

        [Header("Look")]
        public Color plainColor = new Color(0.55f, 0.9f, 0.55f);
        public Color richColor = new Color(1f, 0.82f, 0.3f);
        public float plainScale = 0.34f;
        public float richScale = 0.52f;

        readonly Stack<FoodParticle> _pool = new Stack<FoodParticle>();
        readonly List<FoodParticle> _all = new List<FoodParticle>();

        Material _plainMaterial;
        Material _richMaterial;
        Transform _root;
        float _spawnCredit;

        void Awake()
        {
            _root = new GameObject("FoodMotes").transform;
            _root.SetParent(transform, false);

            _plainMaterial = MaterialFactory.Emissive(plainColor, 1.4f);
            _richMaterial = MaterialFactory.Emissive(richColor, 3f);
        }

        void Start()
        {
            // Fill the volume immediately so the first frame is not an empty tank.
            for (int i = 0; i < targetCount; i++) SpawnOne();
        }

        void Update()
        {
            int live = FoodParticle.Live.Count;
            if (live >= targetCount) return;

            // Accumulate fractional spawns so a low rate still works at high
            // framerates instead of rounding down to nothing every frame.
            _spawnCredit += respawnRate * Time.deltaTime;

            while (_spawnCredit >= 1f && FoodParticle.Live.Count < targetCount)
            {
                _spawnCredit -= 1f;
                SpawnOne();
            }
        }

        void SpawnOne()
        {
            var fluid = FluidVolume.Instance;
            Vector3 position = fluid != null
                ? fluid.RandomPointInside(2f)
                : Random.insideUnitSphere * 20f;

            bool rich = Random.value < richFraction;

            FoodParticle food = _pool.Count > 0 ? _pool.Pop() : CreateMote();
            Configure(food, rich);

            food.transform.position = position;
            food.gameObject.SetActive(true);
        }

        FoodParticle CreateMote()
        {
            var go = new GameObject("Mote");
            go.transform.SetParent(_root, false);

            var mesh = ProceduralShapes.Sphere;
            var visual = ProceduralShapes.CreateRenderer("Body", mesh, _plainMaterial, go.transform);
            visual.name = "Body";

            var food = go.AddComponent<FoodParticle>();
            food.Recycled = Recycle;

            _all.Add(food);
            go.SetActive(false);
            return food;
        }

        void Configure(FoodParticle food, bool rich)
        {
            food.nutrition = rich ? richNutrition : plainNutrition;
            food.evolutionPoints = rich ? richEvolutionPoints : 0;

            float scale = rich ? richScale : plainScale;
            food.radius = scale * 0.5f;
            food.transform.localScale = Vector3.one * scale;

            var renderer = food.GetComponentInChildren<MeshRenderer>();
            if (renderer != null)
                renderer.sharedMaterial = rich ? _richMaterial : _plainMaterial;
        }

        void Recycle(FoodParticle food)
        {
            food.gameObject.SetActive(false);
            _pool.Push(food);
        }
    }
}
