using UnityEngine;

namespace Evolve.Rendering
{
    /// <summary>
    /// Builds materials at runtime without caring which render pipeline the
    /// project is on.
    ///
    /// Stage 1 has to run on whatever a fresh Unity project defaults to, and
    /// Stage 3 switches to HDRP. Built-in, URP and HDRP disagree about both
    /// the shader name and the colour property name, so every material goes
    /// through here and every property is set defensively.
    /// </summary>
    public static class MaterialFactory
    {
        static Shader _litShader;
        static Shader _unlitShader;

        static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        static readonly int ColorId = Shader.PropertyToID("_Color");
        static readonly int EmissionColorId = Shader.PropertyToID("_EmissionColor");
        static readonly int SmoothnessId = Shader.PropertyToID("_Smoothness");
        static readonly int GlossinessId = Shader.PropertyToID("_Glossiness");
        static readonly int MetallicId = Shader.PropertyToID("_Metallic");
        static readonly int SurfaceId = Shader.PropertyToID("_Surface");
        static readonly int BlendId = Shader.PropertyToID("_Blend");
        static readonly int SrcBlendId = Shader.PropertyToID("_SrcBlend");
        static readonly int DstBlendId = Shader.PropertyToID("_DstBlend");
        static readonly int ZWriteId = Shader.PropertyToID("_ZWrite");

        static Shader LitShader
        {
            get
            {
                if (_litShader != null) return _litShader;

                _litShader = Shader.Find("Universal Render Pipeline/Lit")
                             ?? Shader.Find("HDRP/Lit")
                             ?? Shader.Find("Standard")
                             ?? Shader.Find("Diffuse");

                if (_litShader == null)
                    Debug.LogWarning("[Evolve] No lit shader found; falling back to the error shader.");

                return _litShader;
            }
        }

        static Shader UnlitShader
        {
            get
            {
                if (_unlitShader != null) return _unlitShader;
                _unlitShader = Shader.Find("Universal Render Pipeline/Unlit")
                               ?? Shader.Find("HDRP/Unlit")
                               ?? Shader.Find("Unlit/Color")
                               ?? LitShader;
                return _unlitShader;
            }
        }

        /// <summary>An opaque, slightly glossy body material.</summary>
        public static Material Opaque(Color color, float smoothness = 0.5f)
        {
            var mat = new Material(LitShader) { name = "Evolve/Opaque" };
            SetColor(mat, color);
            SetSmoothness(mat, smoothness);
            if (mat.HasProperty(MetallicId)) mat.SetFloat(MetallicId, 0f);
            return mat;
        }

        /// <summary>A glowing material for food motes and other beacons.</summary>
        public static Material Emissive(Color color, float intensity = 2f)
        {
            var mat = Opaque(color, 0.25f);
            mat.name = "Evolve/Emissive";
            if (mat.HasProperty(EmissionColorId))
            {
                mat.EnableKeyword("_EMISSION");
                mat.SetColor(EmissionColorId, color * intensity);
                mat.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive;
            }
            return mat;
        }

        /// <summary>
        /// A see-through material for shells and membranes. Transparency has to
        /// be switched on differently per pipeline, so all three are nudged.
        /// </summary>
        public static Material Transparent(Color color, float smoothness = 0.8f)
        {
            var mat = new Material(LitShader) { name = "Evolve/Transparent" };
            SetColor(mat, color);
            SetSmoothness(mat, smoothness);

            // URP / HDRP style switches
            if (mat.HasProperty(SurfaceId)) mat.SetFloat(SurfaceId, 1f);   // 1 = transparent
            if (mat.HasProperty(BlendId)) mat.SetFloat(BlendId, 0f);       // 0 = alpha
            mat.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            mat.EnableKeyword("_ALPHAPREMULTIPLY_ON");

            // Built-in style switches
            if (mat.HasProperty(SrcBlendId)) mat.SetFloat(SrcBlendId, (float)UnityEngine.Rendering.BlendMode.SrcAlpha);
            if (mat.HasProperty(DstBlendId)) mat.SetFloat(DstBlendId, (float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            if (mat.HasProperty(ZWriteId)) mat.SetFloat(ZWriteId, 0f);

            mat.DisableKeyword("_ALPHATEST_ON");
            mat.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
            return mat;
        }

        public static Material Unlit(Color color)
        {
            var mat = new Material(UnlitShader) { name = "Evolve/Unlit" };
            SetColor(mat, color);
            return mat;
        }

        static void SetColor(Material mat, Color color)
        {
            // Set whichever exists; URP/HDRP use _BaseColor, built-in uses _Color.
            if (mat.HasProperty(BaseColorId)) mat.SetColor(BaseColorId, color);
            if (mat.HasProperty(ColorId)) mat.SetColor(ColorId, color);
        }

        static void SetSmoothness(Material mat, float smoothness)
        {
            if (mat.HasProperty(SmoothnessId)) mat.SetFloat(SmoothnessId, smoothness);
            if (mat.HasProperty(GlossinessId)) mat.SetFloat(GlossinessId, smoothness);
        }
    }
}
