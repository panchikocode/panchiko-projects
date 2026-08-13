using UnityEngine;

namespace Evolve.Rendering
{
    /// <summary>
    /// Mesh helpers. Everything starts from Unity's built-in primitives and is
    /// deformed from there, so the project needs no imported models and no
    /// hand-written vertex tables that cannot be eyeballed for correctness.
    /// </summary>
    public static class ProceduralShapes
    {
        static Mesh _sphere;
        static Mesh _capsule;
        static Mesh _cone;

        /// <summary>A shared unit sphere mesh, borrowed once from a throwaway primitive.</summary>
        public static Mesh Sphere => _sphere ??= BorrowPrimitiveMesh(PrimitiveType.Sphere);

        public static Mesh Capsule => _capsule ??= BorrowPrimitiveMesh(PrimitiveType.Capsule);

        /// <summary>A cone, built by collapsing one end of a cylinder to a point.</summary>
        public static Mesh Cone
        {
            get
            {
                if (_cone != null) return _cone;

                var src = BorrowPrimitiveMesh(PrimitiveType.Cylinder);
                var mesh = Object.Instantiate(src);
                mesh.name = "Evolve/Cone";

                var verts = mesh.vertices;
                for (int i = 0; i < verts.Length; i++)
                {
                    // The built-in cylinder spans -1..1 on Y. Pinch the top.
                    if (verts[i].y > 0.5f)
                    {
                        verts[i].x = 0f;
                        verts[i].z = 0f;
                    }
                }
                mesh.vertices = verts;
                mesh.RecalculateNormals();
                mesh.RecalculateBounds();

                _cone = mesh;
                return _cone;
            }
        }

        /// <summary>
        /// A lumpy sphere. Vertices are pushed along their own normals by 3D
        /// Perlin noise, which is what stops every cell in the broth from
        /// looking like the same billiard ball.
        /// </summary>
        public static Mesh Blob(int seed, float lumpiness = 0.14f, float frequency = 2.2f)
        {
            var mesh = Object.Instantiate(Sphere);
            mesh.name = $"Evolve/Blob{seed}";

            var verts = mesh.vertices;
            var normals = mesh.normals;

            // Offsetting the noise field per seed is cheaper than reseeding it,
            // and Mathf.PerlinNoise has no seed parameter to begin with.
            var offset = new Vector3(seed * 13.37f, seed * 7.77f, seed * 3.11f);

            for (int i = 0; i < verts.Length; i++)
            {
                Vector3 p = verts[i].normalized * frequency + offset;

                // Mathf only offers 2D Perlin, so sample three planes and average.
                float n = (Mathf.PerlinNoise(p.x, p.y)
                           + Mathf.PerlinNoise(p.y, p.z)
                           + Mathf.PerlinNoise(p.z, p.x)) / 3f;

                float displacement = 1f + (n - 0.5f) * 2f * lumpiness;
                verts[i] = normals[i] * 0.5f * displacement;
            }

            mesh.vertices = verts;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>
        /// Creates a primitive, steals its mesh, and destroys the object. The
        /// collider that CreatePrimitive attaches goes with it.
        /// </summary>
        static Mesh BorrowPrimitiveMesh(PrimitiveType type)
        {
            var temp = GameObject.CreatePrimitive(type);
            var mesh = temp.GetComponent<MeshFilter>().sharedMesh;

            if (Application.isPlaying) Object.Destroy(temp);
            else Object.DestroyImmediate(temp);

            return mesh;
        }

        /// <summary>A bare renderable child: no collider, no physics, just a mesh.</summary>
        public static GameObject CreateRenderer(string name, Mesh mesh, Material material, Transform parent)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);

            var mf = go.AddComponent<MeshFilter>();
            mf.sharedMesh = mesh;

            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = material;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mr.receiveShadows = false;

            return go;
        }
    }
}
