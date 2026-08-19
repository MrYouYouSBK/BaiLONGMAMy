import AVFoundation
import Foundation
import Speech

struct SpeechEvent: Encodable {
  let type: String
  let text: String?
  let is_final: Bool?
  let message: String?
  let language: String?
}

func emit(_ event: SpeechEvent) {
  guard let data = try? JSONEncoder().encode(event), let line = String(data: data, encoding: .utf8) else { return }
  print(line)
  fflush(stdout)
}

func fail(_ message: String) -> Never {
  emit(SpeechEvent(type: "error", text: nil, is_final: nil, message: message, language: nil))
  exit(1)
}

func argValue(_ name: String, fallback: String) -> String {
  let args = CommandLine.arguments
  guard let index = args.firstIndex(of: name), index + 1 < args.count else { return fallback }
  return args[index + 1]
}

func requestSpeechAuthorization() {
  let semaphore = DispatchSemaphore(value: 0)
  var status: SFSpeechRecognizerAuthorizationStatus = .notDetermined
  SFSpeechRecognizer.requestAuthorization { nextStatus in status = nextStatus; semaphore.signal() }
  semaphore.wait()
  switch status {
  case .authorized: return
  case .denied: fail("macOS speech recognition permission was denied")
  case .restricted: fail("macOS speech recognition is restricted on this Mac")
  case .notDetermined: fail("macOS speech recognition permission was not granted")
  @unknown default: fail("macOS speech recognition authorization failed")
  }
}

func requestMicrophoneAuthorization() {
  let semaphore = DispatchSemaphore(value: 0)
  var granted = false
  AVCaptureDevice.requestAccess(for: .audio) { ok in granted = ok; semaphore.signal() }
  semaphore.wait()
  if !granted { fail("microphone permission was denied") }
}

requestSpeechAuthorization()
requestMicrophoneAuthorization()

let localeId = argValue("--lang", fallback: "multilingual")
let recognitionMode = argValue("--mode", fallback: "auto")
let requestedLocales: [String]
if localeId == "multilingual" { requestedLocales = ["zh-CN", "en-US", "ms-MY"] }
else if localeId == "bilingual" { requestedLocales = ["zh-CN", "en-US"] }
else { requestedLocales = [localeId] }

let audioEngine = AVAudioEngine()
let contextualPhrases = [
  "API", "ASR", "TTS", "Mac", "macOS", "OpenAI", "DeepSeek", "MiniMax", "Claude", "Gemini", "ChatGPT", "GPT",
  "Agent", "GAI AI", "Hey GAI", "GitHub", "Electron", "JavaScript", "TypeScript", "Python", "Swift", "WebSocket", "HTTP",
  "localhost", "prompt", "token", "model", "Bahasa Melayu", "tolong", "terima kasih", "boleh", "ingatkan saya",
]

struct Candidate: Sendable {
  let text: String
  let isFinal: Bool
  let localeId: String
  let confidence: Float
}

func averageConfidence(_ result: SFSpeechRecognitionResult) -> Float {
  let segments = result.bestTranscription.segments
  guard !segments.isEmpty else { return 0 }
  return segments.map(\.confidence).reduce(0, +) / Float(segments.count)
}

final class RecognizerContext: @unchecked Sendable {
  let localeId: String
  let recognizer: SFSpeechRecognizer
  private let stateQueue: DispatchQueue
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var generation = 0
  private var startedAt = Date.distantPast
  private var stopped = false
  private var usesOnDeviceRecognition = false

  init(localeId: String, recognizer: SFSpeechRecognizer) {
    self.localeId = localeId
    self.recognizer = recognizer
    self.stateQueue = DispatchQueue(label: "gai.ai.speech.\(localeId)")
  }

  private func makeRequest() -> SFSpeechAudioBufferRecognitionRequest? {
    let next = SFSpeechAudioBufferRecognitionRequest()
    next.shouldReportPartialResults = true
    next.taskHint = .dictation
    next.contextualStrings = contextualPhrases
    if #available(macOS 10.15, *) {
      if recognitionMode == "online" { next.requiresOnDeviceRecognition = false }
      else if recognizer.supportsOnDeviceRecognition { next.requiresOnDeviceRecognition = true }
      else if recognitionMode == "local" || recognitionMode == "on-device" {
        emit(SpeechEvent(type: "warning", text: nil, is_final: nil, message: "on-device recognition unavailable for \(localeId)", language: localeId))
        return nil
      } else { next.requiresOnDeviceRecognition = false }
      usesOnDeviceRecognition = next.requiresOnDeviceRecognition
    }
    return next
  }

  @discardableResult func start() -> Bool { return stateQueue.sync { startLocked() } }
  private func startLocked() -> Bool {
    guard !stopped, recognizer.isAvailable, let next = makeRequest() else { return false }
    generation += 1
    let currentGeneration = generation
    request = next
    startedAt = Date()
    task = recognizer.recognitionTask(with: next) { [weak self] result, error in
      guard let self = self else { return }
      var candidate: Candidate?
      if let result = result {
        let text = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.isEmpty { candidate = Candidate(text: text, isFinal: result.isFinal, localeId: self.localeId, confidence: averageConfidence(result)) }
      }
      self.handle(candidate: candidate, isFinal: result?.isFinal == true, errorMessage: error?.localizedDescription, generation: currentGeneration)
    }
    stateQueue.asyncAfter(deadline: .now() + .seconds(58)) { [weak self] in
      guard let self = self, self.generation == currentGeneration, !self.stopped else { return }
      self.restartLocked()
    }
    return true
  }

  private func handle(candidate: Candidate?, isFinal: Bool, errorMessage: String?, generation expectedGeneration: Int) {
    stateQueue.async { [weak self] in
      guard let self = self, self.generation == expectedGeneration, !self.stopped else { return }
      if let candidate = candidate { submit(candidate) }
      if let errorMessage = errorMessage { emit(SpeechEvent(type: "warning", text: nil, is_final: nil, message: "\(self.localeId): \(errorMessage)", language: self.localeId)) }
      guard isFinal || errorMessage != nil else { return }
      self.stateQueue.asyncAfter(deadline: .now() + .milliseconds(180)) { [weak self] in
        guard let self = self, self.generation == expectedGeneration, !self.stopped else { return }
        self.restartLocked()
      }
    }
  }

  private func restartLocked() {
    generation += 1
    request?.endAudio(); task?.cancel(); request = nil; task = nil
    if !startLocked() && !stopped {
      let retryGeneration = generation
      stateQueue.asyncAfter(deadline: .now() + .seconds(1)) { [weak self] in
        guard let self = self, self.generation == retryGeneration, !self.stopped else { return }
        _ = self.startLocked()
      }
    }
  }

  func append(_ buffer: AVAudioPCMBuffer) { stateQueue.sync { request?.append(buffer) } }
  func rolloverIfDue(quiet: Bool) {
    guard quiet else { return }
    stateQueue.async { [weak self] in
      guard let self = self, !self.stopped, Date().timeIntervalSince(self.startedAt) >= 45 else { return }
      self.restartLocked()
    }
  }
  func stop() { stateQueue.sync { stopped = true; generation += 1; request?.endAudio(); task?.cancel(); request = nil; task = nil } }
  var modeLabel: String { return stateQueue.sync { usesOnDeviceRecognition ? "on-device" : "system" } }
}

let selectionQueue = DispatchQueue(label: "gai.ai.speech.selection")
var pendingCandidates: [String: Candidate] = [:]
var selectionWork: DispatchWorkItem?
var lastEmittedText = ""
var lastEmittedLocale = ""

func containsHan(_ text: String) -> Bool {
  return text.unicodeScalars.contains { scalar in (0x4E00...0x9FFF).contains(Int(scalar.value)) || (0x3400...0x4DBF).contains(Int(scalar.value)) }
}
func candidateScore(_ candidate: Candidate) -> Float {
  var score = candidate.confidence
  if containsHan(candidate.text) { score += candidate.localeId.hasPrefix("zh") ? 2.0 : -2.0 }
  else { score += candidate.localeId.hasPrefix("zh") ? -0.8 : 0.25 }
  if candidate.isFinal { score += 0.15 }
  return score + min(0.2, Float(candidate.text.count) / 500.0)
}
func submit(_ candidate: Candidate) {
  selectionQueue.async {
    pendingCandidates[candidate.localeId] = candidate
    selectionWork?.cancel()
    let work = DispatchWorkItem {
      guard let best = pendingCandidates.values.max(by: { candidateScore($0) < candidateScore($1) }) else { return }
      pendingCandidates.removeAll(keepingCapacity: true)
      if best.text == lastEmittedText && best.localeId == lastEmittedLocale && !best.isFinal { return }
      lastEmittedText = best.text; lastEmittedLocale = best.localeId
      emit(SpeechEvent(type: "transcript", text: best.text, is_final: best.isFinal, message: nil, language: best.localeId))
    }
    selectionWork = work
    selectionQueue.asyncAfter(deadline: .now() + .milliseconds(candidate.isFinal ? 70 : 150), execute: work)
  }
}

func createContext(locale: String) -> RecognizerContext? {
  guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale)), recognizer.isAvailable else {
    emit(SpeechEvent(type: "warning", text: nil, is_final: nil, message: "speech recognizer unavailable for \(locale)", language: locale)); return nil
  }
  let context = RecognizerContext(localeId: locale, recognizer: recognizer)
  return context.start() ? context : nil
}

let contexts = requestedLocales.compactMap(createContext)
if contexts.isEmpty { fail("no requested speech-recognition locale is available") }

final class RolloverProbeClock: @unchecked Sendable {
  private let lock = NSLock()
  private var counter = 0
  func tick() -> Bool { lock.lock(); defer { lock.unlock() }; counter = (counter + 1) % 32; return counter == 0 }
}

let inputNode = audioEngine.inputNode
var voiceProcessingEnabled = false
if #available(macOS 10.15, *) {
  do {
    try inputNode.setVoiceProcessingEnabled(true)
    voiceProcessingEnabled = true
  } catch {
    emit(SpeechEvent(type: "warning", text: nil, is_final: nil, message: "Apple voice processing unavailable; continuing with raw microphone input: \(error.localizedDescription)", language: nil))
  }
}
let format = inputNode.outputFormat(forBus: 0)
let rolloverProbeClock = RolloverProbeClock()
inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
  let channel = buffer.floatChannelData?[0]
  var energy: Float = 0
  if let channel = channel { for index in 0..<Int(buffer.frameLength) { let sample = channel[index]; energy += sample * sample } }
  let rms = buffer.frameLength > 0 ? sqrt(energy / Float(buffer.frameLength)) : 0
  let shouldProbeRollover = rolloverProbeClock.tick()
  for context in contexts { context.append(buffer); if shouldProbeRollover { context.rolloverIfDue(quiet: rms < 0.012) } }
}

do { audioEngine.prepare(); try audioEngine.start() }
catch { for context in contexts { context.stop() }; fail("failed to start microphone capture: \(error.localizedDescription)") }

let localeSummary = contexts.map { "\($0.localeId):\($0.modeLabel)" }.joined(separator: ",")
let configurationObserver = NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: audioEngine, queue: nil) { _ in
  emit(SpeechEvent(type: "warning", text: nil, is_final: nil, message: "audio device configuration changed; restarting recognition", language: nil))
  for context in contexts { context.stop() }
  audioEngine.stop()
  exit(75)
}
_ = configurationObserver
emit(SpeechEvent(type: "ready", text: nil, is_final: nil, message: "macOS multilingual speech ready [\(localeSummary)] voice-processing=\(voiceProcessingEnabled)", language: nil))
RunLoop.main.run()
