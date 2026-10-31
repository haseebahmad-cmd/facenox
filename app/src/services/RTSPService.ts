export class RTSPService {
  static async start(cameraId: string, rtspUrl: string) {
    if (!window.facenoxRTSP) {
      throw new Error("RTSP bridge not available")
    }
    return window.facenoxRTSP.start(cameraId, rtspUrl)
  }

  static async stop(cameraId: string) {
    if (!window.facenoxRTSP) {
      throw new Error("RTSP bridge not available")
    }
    return window.facenoxRTSP.stop(cameraId)
  }

  static async status(cameraId: string) {
    if (!window.facenoxRTSP) {
      return { status: "offline" as const }
    }
    return window.facenoxRTSP.status(cameraId)
  }
}
