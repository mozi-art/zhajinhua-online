// M3 · 绘制执行层：只把 scene 的图元指令搬到 Canvas 上，不做任何判定、不读任何模型。
// 拆成这一层的意义：布局逻辑（scene）能在 Node 里断言，这里薄到可以靠眼睛与截图验收。
import type { Primitive, Scene } from './scene.ts';

function drawPrimitive(ctx: CanvasRenderingContext2D, p: Primitive, font: string): void {  switch (p.kind) {
    case 'rect': {
      ctx.beginPath();
      const r = Math.min(p.radius, p.rect.w / 2, p.rect.h / 2);
      ctx.roundRect(p.rect.x, p.rect.y, p.rect.w, p.rect.h, r);
      ctx.fillStyle = p.fill;
      ctx.fill();
      if (p.stroke !== null) {
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      return;
    }
    case 'ellipse': {
      ctx.beginPath();
      ctx.ellipse(p.cx, p.cy, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.fill;
      ctx.fill();
      if (p.stroke !== null) {
        ctx.strokeStyle = p.stroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      return;
    }
    case 'text': {
      ctx.font = `${p.bold ? '700 ' : ''}${String(p.size)}px ${font}`;
      ctx.fillStyle = p.color;
      ctx.textAlign = p.align;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(p.text, p.x, p.y);
      return;
    }
    case 'line': {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
      return;
    }
    default: {
      const exhausted: never = p;
      return exhausted;
    }
  }
}

export function paint(ctx: CanvasRenderingContext2D, scene: Scene): void {
  ctx.save();
  ctx.clearRect(0, 0, scene.width, scene.height);
  for (const p of scene.primitives) drawPrimitive(ctx, p, scene.font);
  ctx.restore();
}
