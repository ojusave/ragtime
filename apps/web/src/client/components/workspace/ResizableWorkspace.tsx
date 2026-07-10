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

/** Three-zone playground: setup, arena, peek. */
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
    <Group orientation="horizontal" className="workspace-resizable">
      <Panel
        id="controls"
        defaultSize="24%"
        minSize={260}
        maxSize={440}
        groupResizeBehavior="preserve-pixel-size"
      >
        <aside className="workspace-pane workspace-pane--controls">
          <ZoneLabel dotClass="" label={COPY.playground.zones.setup} />
          <div className="pane-scroll">{controls}</div>
        </aside>
      </Panel>

      <Separator className="resize-handle" aria-label="Resize setup and arena">
        <span />
      </Separator>

      <Panel id="canvas" defaultSize="52%" minSize={480}>
        <main className="workspace-pane workspace-pane--canvas">
          <ZoneLabel dotClass="pg-zone-dot--arena" label={COPY.playground.zones.arena} />
          <div className="pane-scroll">{canvas}</div>
        </main>
      </Panel>

      <Separator className="resize-handle" aria-label="Resize arena and peek">
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
          <ZoneLabel dotClass="pg-zone-dot--peek" label={COPY.playground.zones.peek} />
          <div className="pane-scroll">{inspector}</div>
        </aside>
      </Panel>
    </Group>
  );
}
