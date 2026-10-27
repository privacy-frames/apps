declare abstract class AudioWorkletProcessor {
  abstract process(): boolean;
}

declare function registerProcessor(
  name: string,
  processor: typeof AudioWorkletProcessor,
): void;

class DiagnosticProcessor extends AudioWorkletProcessor {
  process() {
    return true;
  }
}
registerProcessor('diagnostic-processor', DiagnosticProcessor);
