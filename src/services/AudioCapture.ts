const TARGET_SAMPLE_RATE = 16_000
const CHANNEL_COUNT = 1
const BUFFER_SIZE = 1024
const CHUNK_DURATION_MS = 100
const CHUNK_PUMP_INTERVAL_MS = 50
const MAX_PENDING_CHUNKS = 120
const MAX_CHUNKS_PER_PUMP = 4
const SAMPLES_PER_CHUNK = (TARGET_SAMPLE_RATE * CHUNK_DURATION_MS) / 1000

const floatToPcm16 = (input: Float32Array) => {
  const output = new Int16Array(input.length)

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] ?? 0))
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }

  return output
}

const downsampleBuffer = (
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
) => {
  if (inputSampleRate === outputSampleRate) {
    return input
  }

  const ratio = inputSampleRate / outputSampleRate
  const outputLength = Math.round(input.length / ratio)
  const output = new Float32Array(outputLength)

  let outputIndex = 0
  let inputIndex = 0

  while (outputIndex < outputLength) {
    const nextInputIndex = Math.round((outputIndex + 1) * ratio)
    let total = 0
    let count = 0

    for (
      let currentIndex = inputIndex;
      currentIndex < nextInputIndex && currentIndex < input.length;
      currentIndex += 1
    ) {
      total += input[currentIndex] ?? 0
      count += 1
    }

    output[outputIndex] = count > 0 ? total / count : 0
    outputIndex += 1
    inputIndex = nextInputIndex
  }

  return output
}

export class AudioCaptureService {
  private audioContext: AudioContext | null = null

  private mediaStream: MediaStream | null = null

  private sourceNode: MediaStreamAudioSourceNode | null = null

  private processorNode: ScriptProcessorNode | null = null

  private pendingSamples = new Int16Array(0)

  private pendingChunks: Uint8Array[] = []

  private onChunk: ((chunk: Uint8Array) => void) | null = null

  private chunkPumpTimer: number | null = null

  private chunkPumpAccumulatorMs = 0

  private chunkPumpLastTickAt: number | null = null

  private isActive = false

  async start(onChunk: (chunk: Uint8Array) => void) {
    this.onChunk = onChunk
    this.startChunkPump()
    await this.resume()
  }

  async pause() {
    await this.teardownAudioGraph()
    this.stopChunkPump()
    this.pendingChunks = []
    this.pendingSamples = new Int16Array(0)
  }

  async resume() {
    if (!this.onChunk) {
      throw new Error('Audio capture has not been initialized yet.')
    }

    this.startChunkPump()

    if (this.isActive) {
      return
    }

    await this.teardownAudioGraph()

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: CHANNEL_COUNT,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    })

    const audioContext = new AudioContext({
      sampleRate: TARGET_SAMPLE_RATE,
    })

    await audioContext.resume()

    const sourceNode = audioContext.createMediaStreamSource(mediaStream)
    const processorNode = audioContext.createScriptProcessor(
      BUFFER_SIZE,
      CHANNEL_COUNT,
      CHANNEL_COUNT,
    )

    processorNode.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0)
      const normalized = downsampleBuffer(
        inputData,
        audioContext.sampleRate,
        TARGET_SAMPLE_RATE,
      )

      const pcmChunk = floatToPcm16(normalized)
      const merged = new Int16Array(this.pendingSamples.length + pcmChunk.length)
      merged.set(this.pendingSamples)
      merged.set(pcmChunk, this.pendingSamples.length)

      let offset = 0
      while (merged.length - offset >= SAMPLES_PER_CHUNK) {
        const chunk = merged.slice(offset, offset + SAMPLES_PER_CHUNK)
        this.pendingChunks.push(new Uint8Array(chunk.buffer.slice(0)))

        if (this.pendingChunks.length > MAX_PENDING_CHUNKS) {
          this.pendingChunks.shift()
        }

        offset += SAMPLES_PER_CHUNK
      }

      this.pendingSamples = merged.slice(offset)
    }

    sourceNode.connect(processorNode)
    processorNode.connect(audioContext.destination)

    this.audioContext = audioContext
    this.mediaStream = mediaStream
    this.sourceNode = sourceNode
    this.processorNode = processorNode
    this.isActive = true
  }

  async stop() {
    await this.teardownAudioGraph()
    this.stopChunkPump()
    this.pendingChunks = []
    this.pendingSamples = new Int16Array(0)
    this.onChunk = null
  }

  private startChunkPump() {
    if (this.chunkPumpTimer !== null) {
      return
    }

    this.chunkPumpAccumulatorMs = 0
    this.chunkPumpLastTickAt = performance.now()

    this.chunkPumpTimer = window.setInterval(() => {
      const now = performance.now()
      const previousTickAt = this.chunkPumpLastTickAt ?? now
      const elapsedMs = Math.max(0, now - previousTickAt)

      this.chunkPumpLastTickAt = now

      if (!this.onChunk) {
        return
      }

      this.chunkPumpAccumulatorMs = Math.min(
        this.chunkPumpAccumulatorMs + elapsedMs,
        CHUNK_DURATION_MS * MAX_PENDING_CHUNKS,
      )

      let sentChunks = 0

      while (
        this.chunkPumpAccumulatorMs >= CHUNK_DURATION_MS &&
        this.pendingChunks.length > 0 &&
        sentChunks < MAX_CHUNKS_PER_PUMP
      ) {
        const nextChunk = this.pendingChunks.shift()

        if (!nextChunk) {
          break
        }

        this.onChunk(nextChunk)
        this.chunkPumpAccumulatorMs -= CHUNK_DURATION_MS
        sentChunks += 1
      }

      if (this.pendingChunks.length === 0) {
        this.chunkPumpAccumulatorMs = Math.min(
          this.chunkPumpAccumulatorMs,
          CHUNK_DURATION_MS,
        )
      }
    }, CHUNK_PUMP_INTERVAL_MS)
  }

  private stopChunkPump() {
    if (this.chunkPumpTimer === null) {
      return
    }

    window.clearInterval(this.chunkPumpTimer)
    this.chunkPumpTimer = null
    this.chunkPumpAccumulatorMs = 0
    this.chunkPumpLastTickAt = null
  }

  private async teardownAudioGraph() {
    this.processorNode?.disconnect()
    this.sourceNode?.disconnect()
    this.processorNode = null
    this.sourceNode = null

    this.mediaStream?.getTracks().forEach((track) => track.stop())
    this.mediaStream = null

    if (this.audioContext) {
      await this.audioContext.close()
      this.audioContext = null
    }

    this.isActive = false
  }
}
