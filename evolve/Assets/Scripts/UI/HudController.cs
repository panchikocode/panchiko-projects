using UnityEngine;
using Evolve.Core;

namespace Evolve.UI
{
    /// <summary>
    /// Stage 1 HUD: energy, health, size, evolution points, and the mutation
    /// list.
    ///
    /// Drawn with IMGUI on purpose. A uGUI canvas built at runtime needs a
    /// font asset, and which font is available by name has changed between
    /// Unity versions; IMGUI needs nothing and cannot fail to find an asset.
    /// Stage 4 replaces this wholesale with a proper canvas — until then, this
    /// is the version that is guaranteed to draw on a fresh checkout.
    /// </summary>
    public class HudController : MonoBehaviour
    {
        [Header("Layout")]
        public float margin = 16f;
        public float panelWidth = 300f;

        [Header("Palette")]
        public Color energyColor = new Color(0.45f, 0.85f, 0.55f);
        public Color healthColor = new Color(0.85f, 0.35f, 0.35f);
        public Color panelColor = new Color(0.04f, 0.06f, 0.08f, 0.72f);
        public Color textColor = new Color(0.92f, 0.95f, 0.94f);
        public Color dimColor = new Color(0.62f, 0.70f, 0.72f);
        public Color accentColor = new Color(1f, 0.82f, 0.35f);

        Texture2D _white;
        GUIStyle _label, _small, _heading, _button;
        bool _stylesReady;

        void Awake()
        {
            _white = new Texture2D(1, 1);
            _white.SetPixel(0, 0, Color.white);
            _white.Apply();
            _white.hideFlags = HideFlags.HideAndDontSave;
        }

        void OnDestroy()
        {
            if (_white != null) Destroy(_white);
        }

        void BuildStyles()
        {
            // Styles must be built inside OnGUI: GUI.skin is not valid earlier.
            _heading = new GUIStyle(GUI.skin.label)
            {
                fontSize = 15,
                fontStyle = FontStyle.Bold
            };
            _heading.normal.textColor = textColor;

            _label = new GUIStyle(GUI.skin.label) { fontSize = 12 };
            _label.normal.textColor = textColor;

            _small = new GUIStyle(GUI.skin.label) { fontSize = 11, wordWrap = true };
            _small.normal.textColor = dimColor;

            _button = new GUIStyle(GUI.skin.button) { fontSize = 12, wordWrap = true };

            _stylesReady = true;
        }

        void OnGUI()
        {
            if (!_stylesReady) BuildStyles();

            var player = CellController.Instance;
            if (player == null) return;

            var stats = player.Stats;

            float x = margin;
            float y = margin;
            float lineHeight = 18f;

            // ---- vitals -----------------------------------------------------
            float panelHeight = 128f;
            DrawPanel(new Rect(x, y, panelWidth, panelHeight));

            float inner = x + 12f;
            float cursor = y + 10f;
            float barWidth = panelWidth - 24f;

            GUI.Label(new Rect(inner, cursor, barWidth, lineHeight), "EVOLVE", _heading);
            cursor += lineHeight + 4f;

            DrawBar(new Rect(inner, cursor, barWidth, 12f), stats.EnergyFraction, energyColor,
                    $"Energy  {Mathf.CeilToInt(stats.energy)} / {Mathf.CeilToInt(stats.maxEnergy)}");
            cursor += 18f;

            DrawBar(new Rect(inner, cursor, barWidth, 12f), stats.HealthFraction, healthColor,
                    $"Health  {Mathf.CeilToInt(stats.health)} / {Mathf.CeilToInt(stats.maxHealth)}");
            cursor += 22f;

            GUI.Label(new Rect(inner, cursor, barWidth, lineHeight),
                      $"Biomass {stats.biomass:0.00}    Radius {stats.Radius:0.00}", _label);
            cursor += lineHeight;

            var pointStyle = new GUIStyle(_label);
            pointStyle.normal.textColor = stats.evolutionPoints > 0 ? accentColor : dimColor;
            GUI.Label(new Rect(inner, cursor, barWidth, lineHeight),
                      $"Evolution points: {stats.evolutionPoints}", pointStyle);

            // ---- mutations --------------------------------------------------
            y += panelHeight + 10f;
            DrawMutationPanel(ref x, ref y);

            // ---- status -----------------------------------------------------
            if (stats.IsDead) DrawCentered("You were digested.  Press R to begin again.", healthColor);
            else if (stats.IsStarving) DrawCentered("Starving — find food.", accentColor);

            // ---- controls ---------------------------------------------------
            var help = new GUIStyle(_small) { alignment = TextAnchor.LowerLeft };
            GUI.Label(new Rect(margin, Screen.height - 42f, 620f, 34f),
                      "WASD swim   Space / Ctrl rise and sink   Right mouse look   Wheel zoom   R restart",
                      help);
        }

        void DrawMutationPanel(ref float x, ref float y)
        {
            var player = CellController.Instance;
            var stats = player.Stats;
            var mutations = player.Mutations;

            int count = 0;
            foreach (var _ in MutationCatalog.Available()) count++;
            if (count == 0) return;

            float rowHeight = 54f;
            float height = 30f + count * rowHeight;
            DrawPanel(new Rect(x, y, panelWidth, height));

            float inner = x + 12f;
            float cursor = y + 8f;
            float width = panelWidth - 24f;

            GUI.Label(new Rect(inner, cursor, width, 18f), "MUTATIONS", _heading);
            cursor += 22f;

            foreach (var m in MutationCatalog.Available())
            {
                bool owned = mutations.Has(m.id);
                bool affordable = mutations.CanUnlock(m, stats);

                var rect = new Rect(inner, cursor, width, rowHeight - 6f);

                if (owned)
                {
                    var ownedStyle = new GUIStyle(_label);
                    ownedStyle.normal.textColor = accentColor;
                    GUI.Label(new Rect(rect.x, rect.y, rect.width, 16f), $"{m.displayName} — active", ownedStyle);
                    GUI.Label(new Rect(rect.x, rect.y + 16f, rect.width, 32f), m.description, _small);
                }
                else
                {
                    GUI.enabled = affordable;
                    if (GUI.Button(new Rect(rect.x, rect.y, rect.width, 22f),
                                   $"{m.displayName}   ({m.cost} pt)", _button))
                    {
                        mutations.TryUnlock(m, stats);
                    }
                    GUI.enabled = true;

                    GUI.Label(new Rect(rect.x, rect.y + 23f, rect.width, 30f), m.description, _small);
                }

                cursor += rowHeight;
            }

            y += height;
        }

        void DrawCentered(string message, Color color)
        {
            var style = new GUIStyle(_heading)
            {
                alignment = TextAnchor.MiddleCenter,
                fontSize = 20
            };
            style.normal.textColor = color;

            var rect = new Rect(0f, Screen.height * 0.42f, Screen.width, 40f);
            GUI.Label(rect, message, style);
        }

        void DrawPanel(Rect rect)
        {
            var previous = GUI.color;
            GUI.color = panelColor;
            GUI.DrawTexture(rect, _white);
            GUI.color = previous;
        }

        void DrawBar(Rect rect, float fill, Color color, string caption)
        {
            var previous = GUI.color;

            GUI.color = new Color(1f, 1f, 1f, 0.12f);
            GUI.DrawTexture(rect, _white);

            GUI.color = color;
            var filled = new Rect(rect.x, rect.y, rect.width * Mathf.Clamp01(fill), rect.height);
            GUI.DrawTexture(filled, _white);

            GUI.color = previous;

            var style = new GUIStyle(_small)
            {
                alignment = TextAnchor.MiddleLeft,
                fontSize = 10
            };
            style.normal.textColor = textColor;
            GUI.Label(new Rect(rect.x + 6f, rect.y - 1f, rect.width, rect.height + 2f), caption, style);
        }
    }
}
