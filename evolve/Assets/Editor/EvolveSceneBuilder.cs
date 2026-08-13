using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Evolve.Core;

namespace Evolve.EditorTools
{
    /// <summary>
    /// Creates the Stage 1 scene from the menu.
    ///
    /// The scene is one empty object carrying <see cref="GameBootstrap"/>;
    /// everything else is built at runtime. That keeps the repository free of
    /// a scene file whose diffs nobody can read, and means a scene can never
    /// drift out of sync with the code that populates it.
    /// </summary>
    public static class EvolveSceneBuilder
    {
        const string ScenePath = "Assets/Scenes/Stage1_Broth.unity";

        [MenuItem("Evolve/Create Stage 1 Scene", priority = 0)]
        public static void CreateStageOneScene()
        {
            if (!EditorUtility.DisplayDialog(
                    "Evolve",
                    $"Create {ScenePath}?\n\nThe current scene will be closed; you will be asked to save it if it has unsaved changes.",
                    "Create", "Cancel"))
                return;

            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;

            var scene = EditorSceneManager.NewScene(
                NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var root = new GameObject("GameBootstrap");
            root.AddComponent<GameBootstrap>();

            System.IO.Directory.CreateDirectory("Assets/Scenes");
            EditorSceneManager.SaveScene(scene, ScenePath);
            AssetDatabase.Refresh();

            EditorGUIUtility.PingObject(AssetDatabase.LoadAssetAtPath<Object>(ScenePath));
            Debug.Log($"[Evolve] Created {ScenePath}. Press Play.");
        }

        [MenuItem("Evolve/Add Bootstrap To Current Scene", priority = 1)]
        public static void AddBootstrapToCurrentScene()
        {
            if (Object.FindAnyObjectByType<GameBootstrap>() != null)
            {
                Debug.LogWarning("[Evolve] This scene already has a GameBootstrap.");
                return;
            }

            var root = new GameObject("GameBootstrap");
            root.AddComponent<GameBootstrap>();

            Undo.RegisterCreatedObjectUndo(root, "Add Evolve Bootstrap");
            Selection.activeGameObject = root;
            EditorSceneManager.MarkSceneDirty(root.scene);
        }
    }
}
