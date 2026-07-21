import { useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';

export type DraggablePanel = 'explorer' | 'details' | 'code';
type SidePanel = 'explorer' | 'details';
type RightPanel = 'details' | 'code';

export interface ResizableLayout {
  columnsOrder: SidePanel[];
  rightColumnOrder: RightPanel[];
  gridStyle: CSSProperties;
  rightColumnStyle: CSSProperties;
  startDragging(panel: DraggablePanel): void;
  handleExplorerDrop(): void;
  handleDetailsDrop(): void;
  handleCodeDrop(): void;
  swapHorizontalLayout(): void;
  swapVerticalLayout(): void;
  handleLeftResize(event: ReactMouseEvent): void;
  handleRightResize(event: ReactMouseEvent): void;
  handleHeightResize(event: ReactMouseEvent): void;
}

function panelWidth(selector: string, fallback: number): number {
  return document.querySelector(selector)?.getBoundingClientRect().width ?? fallback;
}

export function useResizableLayout(): ResizableLayout {
  const [columnsOrder, setColumnsOrder] = useState<SidePanel[]>(['explorer', 'details']);
  const [rightColumnOrder, setRightColumnOrder] = useState<RightPanel[]>(['code', 'details']);
  const [draggedPanel, setDraggedPanel] = useState<DraggablePanel | null>(null);
  const [leftWidth, setLeftWidth] = useState<number | null>(null);
  const [rightWidth, setRightWidth] = useState<number | null>(null);
  const [detailsHeight, setDetailsHeight] = useState<number | null>(null);

  function swapHorizontalLayout(): void {
    setColumnsOrder(([left, right]) => [right, left]);
  }
  function swapVerticalLayout(): void {
    setRightColumnOrder(([top, bottom]) => [bottom, top]);
  }
  function handleExplorerDrop(): void {
    if (draggedPanel === 'details' || draggedPanel === 'code') swapHorizontalLayout();
    setDraggedPanel(null);
  }
  function handleDetailsDrop(): void {
    if (draggedPanel === 'explorer') swapHorizontalLayout();
    else if (draggedPanel === 'code') swapVerticalLayout();
    setDraggedPanel(null);
  }
  function handleCodeDrop(): void {
    if (draggedPanel === 'explorer') swapHorizontalLayout();
    else if (draggedPanel === 'details') swapVerticalLayout();
    setDraggedPanel(null);
  }

  function handleHorizontalResize(event: ReactMouseEvent, side: 'left' | 'right'): void {
    event.preventDefault();
    const startX = event.clientX;
    const currentWidth =
      side === 'left'
        ? (leftWidth ?? panelWidth('.tree-panel, .right-column-container', 360))
        : (rightWidth ?? panelWidth('.right-column-container, .tree-panel:last-child', 480));
    const maximum = Math.floor(window.innerWidth * (side === 'left' ? 0.45 : 0.55));
    const minimum = side === 'left' ? 180 : 200;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = (moveEvent.clientX - startX) * (side === 'left' ? 1 : -1);
      const width = Math.max(minimum, Math.min(maximum, currentWidth + delta));
      if (side === 'left') setLeftWidth(width);
      else setRightWidth(width);
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  function handleHeightResize(event: ReactMouseEvent): void {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight =
      detailsHeight ??
      document.querySelector('.details-panel')?.getBoundingClientRect().height ??
      260;
    const detailsOnTop = rightColumnOrder[0] === 'details';
    const containerHeight =
      document.querySelector('.right-column-container')?.getBoundingClientRect().height ?? 750;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = (moveEvent.clientY - startY) * (detailsOnTop ? 1 : -1);
      setDetailsHeight(Math.max(100, Math.min(containerHeight * 0.8, startHeight + delta)));
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  const gridStyle = useMemo<CSSProperties>(() => {
    const swapped = columnsOrder[0] === 'details';
    const left =
      leftWidth === null
        ? swapped
          ? 'minmax(300px, 1fr)'
          : 'minmax(240px, 360px)'
        : `${leftWidth}px`;
    const right =
      rightWidth === null
        ? swapped
          ? 'minmax(240px, 360px)'
          : 'minmax(300px, 1fr)'
        : `${rightWidth}px`;
    return { gridTemplateColumns: `${left} 6px minmax(280px, 1fr) 6px ${right}`, gap: 0 };
  }, [columnsOrder, leftWidth, rightWidth]);
  const rightColumnStyle = useMemo<CSSProperties>(() => {
    const detailsOnTop = rightColumnOrder[0] === 'details';
    const rows =
      detailsHeight === null
        ? detailsOnTop
          ? 'auto 6px 1fr'
          : '1fr 6px auto'
        : detailsOnTop
          ? `${detailsHeight}px 6px 1fr`
          : `1fr 6px ${detailsHeight}px`;
    return { display: 'grid', gridTemplateRows: rows, gap: 0, height: '100%', minHeight: 0 };
  }, [detailsHeight, rightColumnOrder]);

  return {
    columnsOrder,
    rightColumnOrder,
    gridStyle,
    rightColumnStyle,
    startDragging: setDraggedPanel,
    handleExplorerDrop,
    handleDetailsDrop,
    handleCodeDrop,
    swapHorizontalLayout,
    swapVerticalLayout,
    handleLeftResize: (event) => handleHorizontalResize(event, 'left'),
    handleRightResize: (event) => handleHorizontalResize(event, 'right'),
    handleHeightResize,
  };
}
