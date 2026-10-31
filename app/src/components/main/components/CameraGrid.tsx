import { create } from "zustand"
import type { CameraProfile } from "@/components/settings/types"
import { persistentSettings } from "@/services/PersistentSettingsService"

interface CameraState {
  isStreaming: boolean
  isVideoLoading: boolean
  cameraActive: boolean
  websocketStatus: "disconnected" | "connecting" | "connected" | "error"
  cameraDevices: MediaDeviceInfo[]
  selectedCamera: string
  preferredCameraId: string | null
  preferredCameraLabel: string | null
  isPreferredCameraMissing: boolean
  cameraProfiles: CameraProfile[]
  setIsStreaming: (value: boolean) => void
  setIsVideoLoading: (value: boolean) => void
  setCameraActive: (value: boolean) => void
  setWebsocketStatus: (status: "disconnected" | "connecting" | "connected" | "error") => void
  setCameraDevices: (devices: MediaDeviceInfo[]) => void
  setSelectedCamera: (deviceId: string) => void
  ensureCameraProfiles: (devices?: MediaDeviceInfo[]) => CameraProfile[]
  renameCamera: (deviceId: string, displayName: string) => void
  moveCamera: (deviceId: string, direction: "up" | "down") => void
  getCameraProfile: (deviceId: string) => CameraProfile | undefined
}

const sanitizeCameraName = (value: string): string => {
  const cleaned = value.replace(/\s+/g, " ").trim()
  return cleaned.slice(0, 40) || "Camera"
}

const buildProfileFromDevice = (
  device: MediaDeviceInfo,
  index: number,
  sourceType: CameraProfile["sourceType"] = "usb",
): CameraProfile => ({
  id: device.deviceId || `camera-${index}`,
  deviceId: device.deviceId || `camera-${index}`,
  displayName: device.label?.trim() || `Camera ${index + 1}`,
  enabled: true,
  order: index,
  sourceType,
  sourceUrl: null,
  status: "unknown",
})

export const useCameraStore = create<CameraState>((set, get) => ({
  isStreaming: false,
  isVideoLoading: false,
  cameraActive: false,
  websocketStatus: "disconnected",
  cameraDevices: [],
  selectedCamera: "",
  preferredCameraId: null,
  preferredCameraLabel: null,
  isPreferredCameraMissing: false,
  cameraProfiles: [],

  setIsStreaming: (value) => set({ isStreaming: value }),
  setIsVideoLoading: (value) => set({ isVideoLoading: value }),
  setCameraActive: (value) => set({ cameraActive: value }),
  setWebsocketStatus: (status) => set({ websocketStatus: status }),

  ensureCameraProfiles: (devices = get().cameraDevices) => {
    const nextProfiles = devices.map((device, index) => {
      const existing = get().cameraProfiles.find((profile) => profile.deviceId === device.deviceId)
      const fallback = existing ?? buildProfileFromDevice(device, index, "usb")

      return {
        ...fallback,
        id: device.deviceId || fallback.id || `camera-${index}`,
        deviceId: device.deviceId || fallback.deviceId || `camera-${index}`,
        displayName: sanitizeCameraName(
          existing?.displayName || fallback.displayName || device.label || `Camera ${index + 1}`,
        ),
        enabled: existing?.enabled ?? true,
        order: existing?.order ?? index,
        sourceType: existing?.sourceType ?? fallback.sourceType ?? "usb",
        sourceUrl: existing?.sourceUrl ?? fallback.sourceUrl ?? null,
        status: existing?.status ?? "unknown",
      }
    })

    const sorted = [...nextProfiles].sort((a, b) => a.order - b.order)
    set({ cameraProfiles: sorted })
    void persistentSettings.setUIState({ cameraProfiles: sorted }).catch(console.error)
    return sorted
  },

  setCameraDevices: (devices) => {
    const { preferredCameraId, preferredCameraLabel, selectedCamera } = get()
    set({ cameraDevices: devices })

    const profiles = get().ensureCameraProfiles(devices)

    if (devices.length === 0) {
      set({ isPreferredCameraMissing: !!preferredCameraId })
      return
    }

    const preferredIdExists = devices.some((d) => d.deviceId === preferredCameraId)

    if (preferredCameraId && preferredIdExists) {
      if (selectedCamera !== preferredCameraId) {
        set({
          selectedCamera: preferredCameraId,
          isPreferredCameraMissing: false,
        })
      } else {
        set({ isPreferredCameraMissing: false })
      }
      return
    }

    if (preferredCameraLabel) {
      const labelMatch = devices.find((d) => d.label === preferredCameraLabel)
      if (labelMatch) {
        const newId = labelMatch.deviceId
        set({
          selectedCamera: newId,
          preferredCameraId: newId,
          isPreferredCameraMissing: false,
        })
        persistentSettings
          .setUIState({
            selectedCamera: newId,
            selectedCameraLabel: labelMatch.label,
          })
          .catch(console.error)
        return
      }
    }

    if (preferredCameraId) {
      const fallbackId = devices[0].deviceId
      if (selectedCamera !== fallbackId) {
        set({
          selectedCamera: fallbackId,
          isPreferredCameraMissing: true,
        })
      } else {
        set({ isPreferredCameraMissing: true })
      }
    } else if (!selectedCamera && devices.length > 0) {
      const firstId = devices[0].deviceId
      set({ selectedCamera: firstId })
    }

    void persistentSettings.setUIState({ cameraProfiles: profiles }).catch(console.error)
  },

  setSelectedCamera: (deviceId) => {
    if (!deviceId) return
    const { cameraDevices } = get()
    const device = cameraDevices.find((d) => d.deviceId === deviceId)
    const label = device?.label || null

    set({
      selectedCamera: deviceId,
      preferredCameraId: deviceId,
      preferredCameraLabel: label,
      isPreferredCameraMissing: false,
    })

    persistentSettings
      .setUIState({
        selectedCamera: deviceId,
        selectedCameraLabel: label,
      })
      .catch(console.error)
  },

  renameCamera: (deviceId, displayName) => {
    const next = get().cameraProfiles.map((profile) =>
      profile.deviceId === deviceId ? { ...profile, displayName: sanitizeCameraName(displayName) } : profile,
    )

    set({ cameraProfiles: next })
    void persistentSettings.setUIState({ cameraProfiles: next }).catch(console.error)
  },

  moveCamera: (deviceId, direction) => {
    const profiles = [...get().cameraProfiles]
    const index = profiles.findIndex((profile) => profile.deviceId === deviceId)
    if (index === -1) return

    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= profiles.length) return

    const [item] = profiles.splice(index, 1)
    profiles.splice(targetIndex, 0, item)

    const reordered = profiles.map((profile, orderIndex) => ({
      ...profile,
      order: orderIndex,
    }))

    set({ cameraProfiles: reordered })
    void persistentSettings.setUIState({ cameraProfiles: reordered }).catch(console.error)
  },

  getCameraProfile: (deviceId) => get().cameraProfiles.find((profile) => profile.deviceId === deviceId),
}))

if (typeof window !== "undefined") {
  persistentSettings.getUIState().then((uiState) => {
    const storedProfiles = Array.isArray(uiState.cameraProfiles) ? uiState.cameraProfiles : []
    if (storedProfiles.length > 0) {
      useCameraStore.setState({ cameraProfiles: storedProfiles })
    }

    if (uiState.selectedCamera) {
      useCameraStore.setState({
        selectedCamera: uiState.selectedCamera,
        preferredCameraId: uiState.selectedCamera,
        preferredCameraLabel: uiState.selectedCameraLabel,
      })
    }
  })
}
import { RTSPService } from "@/services/RTSPService"

const handleRtspStart = async (deviceId: string, rtspUrl: string) => {
  const response = await RTSPService.start(deviceId, rtspUrl)
  if (response.status === "ok") {
    console.log("RTSP stream started:", response.streamUrl)
  } else {
    console.error("RTSP stream failed:", response.error)
  }
}
import { RTSPService } from "@/services/RTSPService"

const handleRtspStart = async (deviceId: string, rtspUrl: string) => {
  const response = await RTSPService.start(deviceId, rtspUrl)
  if (response.status === "ok") {
    console.log("RTSP stream started:", response.streamUrl)
  } else {
    console.error("RTSP stream failed:", response.error)
  }
}
if (profile?.sourceType === "rtsp" && profile?.sourceUrl) {
  const imageSrc = `http://127.0.0.1:PORT/stream/${deviceId}`
  // Render as <img src={imageSrc} />
}
