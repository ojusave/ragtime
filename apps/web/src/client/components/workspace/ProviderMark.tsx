const PROVIDERS: Record<string, { label: string; mark: string }> = {
  anthropic: { label: "Anthropic", mark: "A" },
  baai: { label: "BAAI", mark: "B" },
  cohere: { label: "Cohere", mark: "C" },
  google: { label: "Google", mark: "G" },
  meta: { label: "Meta", mark: "M" },
  "meta-llama": { label: "Meta", mark: "M" },
  microsoft: { label: "Microsoft", mark: "M" },
  mistralai: { label: "Mistral AI", mark: "M" },
  openai: { label: "OpenAI", mark: "O" },
  qwen: { label: "Qwen", mark: "Q" },
  xai: { label: "xAI", mark: "X" },
};

export function modelProvider(modelId: string): { key: string; label: string; mark: string } {
  const raw = modelId.split("/")[0]?.toLowerCase() || "model";
  const provider = PROVIDERS[raw];
  return {
    key: provider ? raw : "other",
    label: provider?.label ?? raw.replace(/(^|-)(\w)/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`),
    mark: provider?.mark ?? raw.slice(0, 1).toUpperCase(),
  };
}

export default function ProviderMark({ modelId }: { modelId: string }) {
  const provider = modelProvider(modelId);
  return (
    <span
      className="provider-mark"
      data-provider={provider.key}
      title={provider.label}
      aria-hidden="true"
    >
      {provider.mark}
    </span>
  );
}
