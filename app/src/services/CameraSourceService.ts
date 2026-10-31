import { persistentSettings } from "@/services/PersistentSettingsService"
import type { CameraSource } from "@/components/settings/types"

export class CameraSourceService {
  static async getSources(): Promise<CameraSource[]> {
    const uiState = await persistentSettings.getUIState()
    return uiState.cameraSources ?? []
  }

  static async saveSources(sources: CameraSource[]): Promise<void> {
    await persistentSettings.setUIState({ cameraSources: sources })
  }

  static async addSource(source: CameraSource): Promise<void> {
    const sources = await this.getSources()
    const next = [...sources, source]
    await this.saveSources(next)
  }

  static async updateSource(sourceId: string, updates: Partial<CameraSource>): Promise<void> {
    const sources = await this.getSources()
    const next = sources.map((source) => (source.id === sourceId ? { ...source, ...updates } : source))
    await this.saveSources(next)
  }

  static async removeSource(sourceId: string): Promise<void> {
    const sources = await this.getSources()
    const next = sources.filter((source) => source.id !== sourceId)
    await this.saveSources(next)
  }
}
