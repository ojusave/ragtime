import { ActionIcon, Group, Paper, Select, Stack, Text } from "@mantine/core";
import { COPY } from "../../lib/copy";
import type { Catalog, Setup } from "../../hooks/types";
import ProviderMark from "./ProviderMark";

type Props = {
  catalog: Catalog | undefined;
  setups: Setup[];
  onUpdate: (id: string, patch: Partial<Omit<Setup, "id">>) => void;
  onRemove: (id: string) => void;
};

const selectProps = {
  size: "xs" as const,
  comboboxProps: { withinPortal: true },
  classNames: { input: "rag-select-input" },
  searchable: true,
};

function modelOptions(models: { id: string; name: string }[] = []) {
  return models.map((m) => ({ value: m.id, label: m.name }));
}

function renderModelOption({ option }: { option: { value: string; label: string } }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <ProviderMark modelId={option.value} />
      <Text size="sm" lineClamp={1}>
        {option.label}
      </Text>
    </Group>
  );
}

export default function SetupList({ catalog, setups, onUpdate, onRemove }: Props) {
  if (setups.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        {COPY.app.emptySetups}
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      {setups.map((setup, index) => (
        <Paper key={setup.id} withBorder p="xs" radius="sm" className="setup-card">
          <Group justify="space-between" align="center" mb={4}>
            <Text size="xs" fw={600} c="dimmed">
              {COPY.app.setupNumber(index + 1)}
            </Text>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              aria-label={`${COPY.app.removeSetup} ${index + 1}`}
              onClick={() => onRemove(setup.id)}
            >
              ×
            </ActionIcon>
          </Group>
          <Stack gap={6}>
            <Select
              {...selectProps}
              label={COPY.app.embedLabel}
              data={modelOptions(catalog?.embedding)}
              renderOption={renderModelOption}
              value={setup.embeddingModel || null}
              onChange={(value) =>
                onUpdate(setup.id, { embeddingModel: value ?? "" })
              }
            />
            <Select
              {...selectProps}
              label={COPY.app.rerankLabel}
              clearable
              placeholder={COPY.app.noneOption}
              data={modelOptions(catalog?.rerank)}
              renderOption={renderModelOption}
              value={setup.rerankModel}
              onChange={(value) => onUpdate(setup.id, { rerankModel: value })}
            />
            <Select
              {...selectProps}
              label={COPY.app.genLabel}
              data={modelOptions(catalog?.chat)}
              renderOption={renderModelOption}
              value={setup.genModel || null}
              onChange={(value) => onUpdate(setup.id, { genModel: value ?? "" })}
            />
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
