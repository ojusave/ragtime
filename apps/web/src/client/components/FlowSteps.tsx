import { Stepper } from "@mantine/core";

type Step = { label: string; description?: string };

type Props = {
  active: number;
  steps: Step[];
};

/** Horizontal progress through the main eval workflow. */
export default function FlowSteps({ active, steps }: Props) {
  return (
    <Stepper active={active} size="sm" wrap={false}>
      {steps.map((s, i) => (
        <Stepper.Step key={i} label={s.label} description={s.description} />
      ))}
    </Stepper>
  );
}
