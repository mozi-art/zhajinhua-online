// M3 · 绘制执行层：只把 scene 的图元指令搬到 Canvas 上，不做任何判定、不读任何模型。
// 拆成这一层的意义：布局逻辑（scene）能在 Node 里断言，这里薄到可以靠眼睛与截图验收。
// 颜色纪律（ui3/29）：本文件一个十六进制色值都不许出现 —— 全部来自 scene 的图元数据
//（含渐变色标），paint 只负责材质化。旋转/渐变都包在 save/restore 里，互不渗漏。
import type { Primitive, Scene } from './scene.ts';

type EllipsePrim = Extract<Primitive, { kind: 'ellipse' }>;
type RectPrim = Extract<Primitive, { kind: 'rect' }>;

// 把 scene 数据里的渐变色标材质化为 CanvasGradient（radial = 椭圆内径向，缺省 = 竖向线性）。
function materializeGrad(ctx: CanvasRenderingContext2D, p: EllipsePrim): string | CanvasGradient {
  const grad = p.grad;
  if (grad === undefined) return p.fill ?? 'transparent';
  const g = grad.radial === true
    ? ctx.createRadialGradient(p.cx, p.cy, 0, p.cx, p.cy, Math.max(p.rx, p.ry, 1))
    : ctx.createLinearGradient(p.cx, p.cy - p.ry, p.cx, p.cy + p.ry);
  for (const [offset, color] of grad.stops) g.addColorStop(offset, color);
  return g;
}

// 矩形渐变：缺省竖向线性（上亮下暗，正是"金色行动钮"的受光方向）；radial = 矩形中心径向。
// 颜色依旧全部来自 scene 的色标数据 —— 本文件一个十六进制都不写（ui3/38）。
function materializeRectGrad(ctx: CanvasRenderingContext2D, p: RectPrim): string | CanvasGradient {
  const grad = p.grad;
  if (grad === undefined) return p.fill;
  const { x, y, w, h } = p.rect;
  const g = grad.radial === true
    ? ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h, 1) / 2)
    : ctx.createLinearGradient(x, y, x, y + h);
  for (const [offset, color] of grad.stops) g.addColorStop(offset, color);
  return g;
}

function drawPrimitive(ctx: CanvasRenderingContext2D, p: Primitive, font: string): void {  switch (p.kind) {
    case 'rect': {
      const r = Math.min(p.radius, p.rect.w / 2, p.rect.h / 2);
      ctx.beginPath();
      if (p.tilt !== undefined && p.tilt !== 0) {
        // 倾斜（发牌飞行）：绕矩形中心旋转，落定后 tilt 缺省 ⇒ 走下面的无旋转路径
        ctx.save();
        ctx.translate(p.rect.x + p.rect.w / 2, p.rect.y + p.rect.h / 2);
        ctx.rotate((p.tilt * Math.PI) / 180);
        ctx.roundRect(-p.rect.w / 2, -p.rect.h / 2, p.rect.w, p.rect.h, r);
        ctx.fillStyle = p.grad !== undefined ? materializeRectGrad(ctx, p) : p.fill;
        ctx.fill();
        if (p.stroke !== null) {
          ctx.strokeStyle = p.stroke;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
        return;
      }
      ctx.roundRect(p.rect.x, p.rect.y, p.rect.w, p.rect.h, r);
      ctx.fillStyle = p.grad !== undefined ? materializeRectGrad(ctx, p) : p.fill;
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
      ctx.fillStyle = materializeGrad(ctx, p);
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
