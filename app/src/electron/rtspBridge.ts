import http from "node:http"
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

type RtspStreamState = {
  ffmpeg: ReturnType<typeof spawn> | null
  server: http.Server | null
  port: number
  url: string
  startedAt: number
  lastError: string | null
}

const activeStreams = new Map<string, RtspStreamState>()

const createLocalServer = async (): Promise<{ server: http.Server; port: number }> => {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1")
      const streamId = url.pathname.replace(/^\/stream\//, "")

      if (!streamId) {
        res.statusCode = 404
        res.end("not found")
        return
      }

      const state = activeStreams.get(streamId)
      if (!state || !state.ffmpeg) {
        res.statusCode = 503
        res.end("stream unavailable")
        return
      }

      res.writeHead(200, {
        "Content-Type": "multipart/x-mixed-replace; boundary=--boundary",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Connection: "close",
        Pragma: "no-cache",
      })

      const bufferChunks: Buffer[] = []

      const onData = (chunk: Buffer) => {
        if (!chunk || chunk.length === 0) return
        bufferChunks.push(chunk)
        if (bufferChunks.length > 100) {
          bufferChunks.shift()
        }
      }

      const writeChunk = () => {
        const chunk = bufferChunks.shift()
        if (!chunk) return
        res.write(`--boundary\\r\\n`)
        res.write(`Content-Type: image/jpeg\\r\\n`)
        res.write(`Content-Length: ${chunk.length}\\r\\n\\r\\n`)
        res.write(chunk)
        res.write(`\\r\\n`)
      }

      const bind = state.ffmpeg.stdout
      if (bind && "on" in bind) {
        bind.on("data", (data: Buffer) => {
          onData(data)
          writeChunk()
        })
      }

      req.on("close", () => {
        bind?.removeAllListeners("data")
      })
    })

    const port = 0
    server.listen(port, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") return reject(new Error("invalid server"))
      resolve({
        server,
        port: typeof address === "number" ? address : address.port,
      })
    })

    server.on("error", (err) => {
      reject(err)
    })
  })
}

const sanitizeRtspUrl = (value: string): string => {
  if (!value || typeof value !== "string") return ""
  try {
    const url = new URL(value)
    if (!["rtsp:", "http:", "https:"].includes(url.protocol)) {
      throw new Error("invalid protocol")
    }
    return url.toString()
  } catch {
    return ""
  }
}

export async function startRtspStream(
  cameraId: string,
  rtspUrl: string,
): Promise<{ streamUrl: string; status: "ok" | "error"; error?: string }> {
  const sanitized = sanitizeRtspUrl(rtspUrl)
  if (!sanitized) {
    return { streamUrl: "", status: "error", error: "invalid source URL" }
  }

  if (activeStreams.has(cameraId)) {
    return { streamUrl: activeStreams.get(cameraId)!.url, status: "ok" }
  }

  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg"

  const { server, port } = await createLocalServer()
  const streamUrl = `http://127.0.0.1:${port}/stream/${cameraId}`

  const ffmpeg = spawn(ffmpegPath, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-rtsp_transport",
    "tcp",
    "-i",
    sanitized,
    "-f",
    "mjpeg",
    "-vf",
    "scale=1280:720:force_original_aspect_ratio=decrease",
    "-q:v",
    "2",
    "-",
  ])

  const state: RtspStreamState = {
    ffmpeg,
    server,
    port,
    url: streamUrl,
    startedAt: Date.now(),
    lastError: null,
  }

  activeStreams.set(cameraId, state)

  ffmpeg.on("error", (err) => {
    state.lastError = err.message
    stopRtspStream(cameraId)
  })

  ffmpeg.on("close", (code) => {
    if (code !== 0) {
      state.lastError = `ffmpeg exited with code ${code}`
    }
    stopRtspStream(cameraId)
  })

  return { streamUrl, status: "ok" }
}

export function stopRtspStream(cameraId: string): void {
  const state = activeStreams.get(cameraId)
  if (!state) return

  state.ffmpeg?.kill("SIGTERM")
  state.server?.close()
  activeStreams.delete(cameraId)
}

export function getRtspStreamStatus(cameraId: string): { status: "online" | "offline"; streamUrl?: string } {
  const state = activeStreams.get(cameraId)
  if (!state) {
    return { status: "offline" }
  }
  return {
    status: "online",
    streamUrl: state.url,
  }
}
import { spawn } from "node:child_process"

type CameraStreamState = {
  ffmpeg: ReturnType<typeof spawn> | null
  url: string
  startedAt: number
  lastError: string | null
}

const activeStreams = new Map<string, CameraStreamState>()

const sanitizeUrl = (value: string): string => {
  if (!value || typeof value !== "string") return ""
  try {
    const url = new URL(value)
    if (["rtsp:", "http:", "https:"].includes(url.protocol)) return url.toString()
  } catch {
    // ignore
  }
  return ""
}

export function startRtspCameraStream(cameraId: string, sourceUrl: string) {
  const safeUrl = sanitizeUrl(sourceUrl)
  if (!safeUrl) {
    return { status: "error", error: "invalid RTSP URL" as const }
  }

  if (activeStreams.has(cameraId)) {
    const current = activeStreams.get(cameraId)
    return { status: "ok", streamUrl: current?.url ?? "" }
  }

  const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg"
  const localPort = 18000 + (Math.abs(cameraId.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % 5000)
  const localUrl = `http://127.0.0.1:${localPort}/stream/${cameraId}`

  const ffmpeg = spawn(ffmpegPath, [
    "-rtsp_transport",
    "tcp",
    "-i",
    safeUrl,
    "-f",
    "mjpeg",
    "-q:v",
    "2",
    "-",
  ])

  const state: CameraStreamState = {
    ffmpeg,
    url: localUrl,
    startedAt: Date.now(),
    lastError: null,
  }

  activeStreams.set(cameraId, state)

  ffmpeg.on("error", (error) => {
    state.lastError = error.message
    stopRtspCameraStream(cameraId)
  })

  ffmpeg.on("close", (code) => {
    if (code !== 0) {
      state.lastError = `ffmpeg exited with code ${code}`
    }
    stopRtspCameraStream(cameraId)
  })

  return { status: "ok", streamUrl: localUrl }
}

export function stopRtspCameraStream(cameraId: string) {
  const state = activeStreams.get(cameraId)
  if (!state) return

  state.ffmpeg?.kill("SIGTERM")
  activeStreams.delete(cameraId)
}

export function getRtspCameraStatus(cameraId: string) {
  const state = activeStreams.get(cameraId)
  if (!state) return { status: "offline" as const }

  return { status: "online" as const, streamUrl: state.url }
}
