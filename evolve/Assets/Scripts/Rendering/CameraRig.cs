using UnityEngine;
using Evolve.Core;

namespace Evolve.Rendering
{
    /// <summary>
    /// Orbiting follow camera.
    ///
    /// The orbit distance is derived from the player's radius, so the cell
    /// keeps roughly the same size on screen as it grows. Without that, a
    /// fixed camera turns the late game into a close-up of a membrane.
    /// </summary>
    public class CameraRig : MonoBehaviour
    {
        [Header("Target")]
        public Transform target;

        [Header("Framing")]
        [Tooltip("Distance at radius 0.5, scaled up as the organism grows.")]
        public float baseDistance = 7f;

        [Tooltip("How much of the distance comes from the organism's own size.")]
        public float distancePerRadius = 9f;

        public float minDistance = 3f;
        public float maxDistance = 60f;

        [Tooltip("Extra zoom the player has dialled in with the scroll wheel.")]
        public float zoom = 1f;
        public float zoomSpeed = 6f;
        public float minZoom = 0.5f;
        public float maxZoom = 3f;

        [Header("Orbit")]
        public float yaw = 0f;
        public float pitch = 18f;
        public float mouseSensitivity = 180f;
        public float minPitch = -70f;
        public float maxPitch = 80f;

        [Tooltip("Hold this to look around. Set to None to orbit without holding anything.")]
        public KeyCode orbitButton = KeyCode.Mouse1;

        [Header("Smoothing")]
        [Tooltip("Seconds for the camera to close most of the gap to where it should be.")]
        public float followSmoothing = 0.12f;

        Vector3 _velocity;
        CellStats _targetStats;

        void Start()
        {
            if (target == null && CellController.Instance != null)
                target = CellController.Instance.transform;

            if (target != null) _targetStats = target.GetComponent<CellStats>();

            // Start already framed rather than flying in from the origin.
            if (target != null)
            {
                transform.position = DesiredPosition();
                transform.LookAt(target.position);
            }
        }

        void Update()
        {
            if (target == null)
            {
                if (CellController.Instance == null) return;
                target = CellController.Instance.transform;
                _targetStats = target.GetComponent<CellStats>();
            }

            ReadOrbitInput();
        }

        void LateUpdate()
        {
            if (target == null) return;

            // LateUpdate so the camera reacts to where the player ended this
            // frame, not where it started. Following in Update produces a
            // one-frame lag that reads as jitter.
            transform.position = Vector3.SmoothDamp(
                transform.position, DesiredPosition(), ref _velocity, followSmoothing);

            transform.rotation = Quaternion.LookRotation(
                (target.position - transform.position).normalized, Vector3.up);
        }

        void ReadOrbitInput()
        {
            bool orbiting = orbitButton == KeyCode.None || Input.GetKey(orbitButton);
            if (orbiting)
            {
                yaw += Input.GetAxisRaw("Mouse X") * mouseSensitivity * Time.deltaTime;
                pitch -= Input.GetAxisRaw("Mouse Y") * mouseSensitivity * Time.deltaTime;
                pitch = Mathf.Clamp(pitch, minPitch, maxPitch);
            }

            float scroll = Input.GetAxisRaw("Mouse ScrollWheel");
            if (Mathf.Abs(scroll) > 0.0001f)
                zoom = Mathf.Clamp(zoom - scroll * zoomSpeed, minZoom, maxZoom);
        }

        Vector3 DesiredPosition()
        {
            float radius = _targetStats != null ? _targetStats.Radius : 0.5f;
            float distance = Mathf.Clamp(
                (baseDistance + radius * distancePerRadius) * zoom, minDistance, maxDistance);

            Quaternion orbit = Quaternion.Euler(pitch, yaw, 0f);
            return target.position + orbit * (Vector3.back * distance);
        }
    }
}
