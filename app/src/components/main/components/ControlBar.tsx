import { Dropdown, Tooltip } from "@/components/shared"
import { formatCameraDevices } from "@/utils/cameraConstraints"

interface ControlBarProps {
  cameraDevices: MediaDeviceInfo[]
  selectedCamera: string
  setSelectedCamera: (deviceId: string) => void
  isStreaming: boolean
  startCamera: () => void
  stopCamera: (forceCleanup?: boolean) => void
  isShellReady: boolean
  hasGroups: boolean
  hasSelectedGroup: boolean
  hasEnrolledFaces: boolean
}

export function ControlBar({
  cameraDevices,
  selectedCamera,
  setSelectedCamera,
  isStreaming,
  startCamera,
  stopCamera,
  isShellReady,
  hasGroups,
  hasSelectedGroup,
  hasEnrolledFaces,
}: ControlBarProps) {
  const hasCameraDevices = cameraDevices.length > 0

  const handlePrimaryAction = () => {
    if (isStreaming) {
      stopCamera()
    } else {
      startCamera()
    }
  }

  const getButtonState = () => {
    if (isStreaming) {
      return {
        label: "Stop",
        className:
          "border border-rose-500/30 bg-[#2a1216] font-semibold text-rose-200 hover:border-rose-500/50 hover:bg-[#3d181f] hover:text-white active:scale-95 transition-all tracking-wider",
        tooltip: undefined,
        enabled: true,
      }
    }

    if (!isShellReady) {
      return {
        label: "Preparing…",
        className:
          "bg-[#141518] border border-white/10 text-white/50 hover:bg-[#141518] hover:text-white/50",
        tooltip: "Loading groups and settings",
        enabled: false,
      }
    }

    if (!hasGroups) {
      return {
        label: "Start scan",
        className:
          "bg-[#141518] border border-white/10 text-white/50 hover:bg-[#141518] hover:text-white/50",
        tooltip: "Create a group to start scanning",
        enabled: false,
      }
    }

    if (!hasSelectedGroup) {
      return {
        label: "Start scan",
        className:
          "bg-[#141518] border border-white/10 text-white/50 hover:bg-[#141518] hover:text-white/50",
        tooltip: "Select a group to start scanning",
        enabled: false,
      }
    }

    if (!hasEnrolledFaces) {
      return {
        label: "Start scan",
        className:
          "bg-[#141518] border border-white/10 text-white/40 hover:bg-[#141518] hover:text-white/40",
        tooltip: "Enroll at least one member to start scanning",
        enabled: false,
      }
    }

    if (!hasCameraDevices) {
      return {
        label: "Start scan",
        className:
          "bg-[#141518] border border-white/10 text-white/40 hover:bg-[#141518] hover:text-white/40",
        tooltip: "No camera detected",
        enabled: false,
      }
    }

    const cyanStyle =
      "border border-cyan-500/30 bg-[#0e2429] font-semibold text-cyan-200 hover:border-cyan-500/50 hover:bg-[#14353d] hover:text-white active:scale-95 transition-all tracking-wider"

    return {
      label: "Start scan",
      className: cyanStyle,
      tooltip: undefined,
      enabled: true,
    }
  }

  const buttonState = getButtonState()

  return (
    <div>
      <div className="flex min-h-16 items-center justify-between gap-4 rounded-lg p-3 pt-0">
        <div className="flex items-center space-x-6">
          {cameraDevices.length === 1 ?
            <div className="flex items-center rounded-lg border border-white/5 bg-white/5 px-4 py-2 text-sm font-medium text-white/90">
              <span className="max-w-[200px] truncate">
                {formatCameraDevices(cameraDevices)[0]?.label || "Camera"}
              </span>
            </div>
          : cameraDevices.length > 1 ?
            <div className="flex flex-col items-start space-y-1">
              <div className="w-fit max-w-[260px]">
                <Dropdown
                  fit
                  menuWidth={200}
                  align="left"
                  options={formatCameraDevices(cameraDevices)}
                  value={selectedCamera}
                  onChange={(deviceId) => {
                    if (deviceId) setSelectedCamera(String(deviceId))
                  }}
                  placeholder="Select camera…"
                  emptyMessage="No cameras available"
                  disabled={isStreaming}
                  maxHeight={256}
                  buttonClassName="px-4 font-medium"
                  showPlaceholderOption={false}
                  allowClear={false}
                />
              </div>
            </div>
          : null}
        </div>

        <div className="flex items-center gap-3">
          <Tooltip content={buttonState.tooltip}>
            <button
              onClick={handlePrimaryAction}
              disabled={!buttonState.enabled}
              aria-label={buttonState.label}
              className={`flex min-w-28 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${buttonState.className}`}>
              {buttonState.label}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
import { useCameraStore } from "@/components/main/stores"
import { ArrowUp, ArrowDown, Pencil, MonitorUp } from "lucide-react"

interface CameraGridProps {
  cameraDevices: MediaDeviceInfo[]
  selectedCamera: string
  setSelectedCamera: (deviceId: string) => void
  startCamera: () => void
  stopCamera: (forceCleanup?: boolean) => void
  isStreaming: boolean
}

export function CameraGrid({
  cameraDevices,
  selectedCamera,
  setSelectedCamera,
  startCamera,
  stopCamera,
  isStreaming,
}: CameraGridProps) {
  const cameraProfiles = useCameraStore((state) => state.cameraProfiles)
  const renameCamera = useCameraStore((state) => state.renameCamera)
  const moveCamera = useCameraStore((state) => state.moveCamera)

  const orderedDevices = [...cameraDevices].sort((a, b) => {
    const profileA = cameraProfiles.find((p) => p.deviceId === a.deviceId)
    const profileB = cameraProfiles.find((p) => p.deviceId === b.deviceId)
    const orderA = profileA?.order ?? 9999
    const orderB = profileB?.order ?? 9999
    return orderA - orderB
  })

  const handleRename = (deviceId: string) => {
    const current = cameraProfiles.find((profile) => profile.deviceId === deviceId)
    const nextLabel = window.prompt("Rename camera", current?.displayName || "Camera")
    if (!nextLabel) return
    renameCamera(deviceId, nextLabel)
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-white/80">Camera feeds</div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {orderedDevices.map((device) => {
          const profile = cameraProfiles.find((p) => p.deviceId === device.deviceId)
          const displayName = profile?.displayName || device.label || "Camera"
          const isActive = selectedCamera === device.deviceId

          return (
            <button
              key={device.deviceId}
              type="button"
              onClick={() => setSelectedCamera(device.deviceId)}
              className={[
                "group relative overflow-hidden rounded-xl border p-3 text-left transition-all",
                isActive
                  ? "border-cyan-500/60 bg-cyan-500/10"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{displayName}</div>
                  <div className="mt-1 text-[11px] text-white/50">
                    {device.label || "Web camera"}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Rename ${displayName}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRename(device.deviceId)
                    }}
                    className="rounded-md border border-white/10 bg-white/5 p-1 text-white/70 hover:bg-white/10"
                  >
                    <Pencil className="size-3.5" />
                  </button>

                  <button
                    type="button"
                    aria-label={`Move ${displayName} up`}
                    onClick={(e) => {
                      e.stopPropagation()
                      moveCamera(device.deviceId, "up")
                    }}
                    className="rounded-md border border-white/10 bg-white/5 p-1 text-white/70 hover:bg-white/10"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>

                  <button
                    type="button"
                    aria-label={`Move ${displayName} down`}
                    onClick={(e) => {
                      e.stopPropagation()
                      moveCamera(device.deviceId, "down")
                    }}
                    className="rounded-md border border-white/10 bg-white/5 p-1 text-white/70 hover:bg-white/10"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-white/60">
                  <MonitorUp className="size-3.5" />
                  {isActive ? "Selected" : "Available"}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isStreaming && selectedCamera === device.deviceId) {
                      stopCamera(false)
                    } else {
                      setSelectedCamera(device.deviceId)
                      startCamera()
                    }
                  }}
                  className={[
                    "rounded-md px-2 py-1 text-[11px] font-medium",
                    isStreaming && selectedCamera === device.deviceId
                      ? "bg-rose-500/20 text-rose-200"
                      : "bg-cyan-500/20 text-cyan-200",
                  ].join(" ")}
                >
                  {isStreaming && selectedCamera === device.deviceId ? "Stop" : "Start"}
                </button>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
