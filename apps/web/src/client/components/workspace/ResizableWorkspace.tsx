import type { ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { COPY } from "../../lib/copy";

function ZoneLabel({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <div className="pg-zone-label">
      <span className={`pg-zone-dot ${dotClass}`} aria-hidden="true" />
      {label}
    </div>
  );
}

/** Three-pane layout: inputs, run output, trial detail. */
export default function ResizableWorkspace({
  controls,
  canvas,
  inspector,
}: {
  controls: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
}) {
  return (
    <Group orientation="horizontal" className="workspace-resizable" style={{ height: "100%" }}>
      <Panel
        id="controls"
        defaultSize="24%"
        minSize={260}
        maxSize={440}
        groupResizeBehavior="preserve-pixel-size"
      >
        <aside className="workspace-pane workspace-pane--controls">
          <ZoneLabel dotClass="" label={COPY.app.zones.inputs} />
          <div className="pane-scroll">{controls}</div>
        </aside>
      </Panel>

      <Separator className="resize-handle" aria-label="Resize inputs and run panes">
        <span />
      </Separator>

      <Panel id="canvas" defaultSize="52%" minSize={480}>
        <main className="workspace-pane workspace-pane--canvas">
          <ZoneLabel dotClass="pg-zone-dot--arena" label={COPY.app.zones.run} />
          <div className="pane-scroll">{canvas}</div>
        </main>
      </Panel>

      <Separator className="resize-handle" aria-label="Resize run and trial detail panes">
        <span />
      </Separator>

      <Panel
        id="inspector"
        defaultSize="24%"
        minSize={260}
        maxSize={480}
        groupResizeBehavior="preserve-pixel-size"
      >
        <aside className="workspace-pane workspace-pane--inspector">
          <ZoneLabel dotClass="pg-zone-dot--peek" label={COPY.app.zones.detail} />
          <div className="pane-scroll">{inspector}</div>
        </aside>
      </Panel>
    </Group>
  );
}
