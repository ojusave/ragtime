import type { ReactNode } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

/** Three-pane workspace: controls, live canvas, inspector. */
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
        defaultSize="22%"
        minSize={230}
        maxSize={420}
        groupResizeBehavior="preserve-pixel-size"
      >
        <aside className="workspace-pane workspace-pane--controls">
          <div className="pane-scroll">{controls}</div>
        </aside>
      </Panel>

      <Separator className="resize-handle" aria-label="Resize inputs and canvas">
        <span />
      </Separator>

      <Panel id="canvas" defaultSize="56%" minSize={480}>
        <main className="workspace-pane workspace-pane--canvas">
          <div className="pane-scroll">{canvas}</div>
        </main>
      </Panel>

      <Separator className="resize-handle" aria-label="Resize canvas and details">
        <span />
      </Separator>

      <Panel
        id="inspector"
        defaultSize="22%"
        minSize={260}
        maxSize={480}
        groupResizeBehavior="preserve-pixel-size"
      >
        <aside className="workspace-pane workspace-pane--inspector">
          <div className="pane-scroll">{inspector}</div>
        </aside>
      </Panel>
    </Group>
  );
}
