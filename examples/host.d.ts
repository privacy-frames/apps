interface Window {
  readonly privacyHost?: {
    readonly version: number;
    readonly application: string;
    readonly publisher: string;
    readonly mode: 'network-isolated';
  };
  boundaryProbes: Record<string, () => unknown>;
}
