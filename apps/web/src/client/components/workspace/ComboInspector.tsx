import { Loader, ScrollArea, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import TrialStagesPanel from "../TrialStagesPanel";
import { COPY } from "../../lib/copy";
import { comboLabel } from "@ragtime/core";
import type { TrialDetail } from "../../hooks/types";

export default function ComboInspector({
  trial,
  loading,
}: {
  trial: TrialDetail | undefined;
  loading: boolean;
}) {
  const chunkMap = useMemo(() => {
    const m = new Map<string, { id: string; content: string; idx?: number }>();
    for (const c of trial?.chunks ?? []) {
      m.set(c.id, c);
    }
    return m;
  }, [trial]);

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="sm" />
      </Stack>
    );
  }

  if (!trial) {
    return (
      <Stack gap="sm" className="combo-inspector">
        <Text className="pg-section-title">{COPY.playground.zones.peek}</Text>
        <Text size="sm" c="dimmed">
          {COPY.playground.inspectorEmpty}
        </Text>
      </Stack>
    );
  }

  const label = comboLabel(
    trial.combo.embeddingModel,
    trial.combo.rerankModel,
    trial.combo.genModel
  );

  return (
    <Stack gap="md" className="combo-inspector">
      <Stack gap={4}>
        <Text className="pg-section-title">{COPY.playground.zones.peek}</Text>
        <Text fw={600} size="sm">
          {label}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={3}>
          {trial.question.text}
        </Text>
      </Stack>
      <ScrollArea.Autosize mah={520} type="auto">
        <TrialStagesPanel
          stages={trial.trial.stages}
          answer={trial.trial.answer}
          chunks={chunkMap}
        />
      </ScrollArea.Autosize>
    </Stack>
  );
}
