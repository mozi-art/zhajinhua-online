// M6 · 大厅页：开桌（摇一个不撞码的房间码）+ 列在座房间 + 手输码进入。
// 三条纪律，与前两版页面同源：
//   · 零 netx 进口（nst/04：页面侧唯一接缝是 netplay.ts）⇒ 房间码的字母表与校验从 netplay 转口，
//     与服务端路由是同一个定义，不会"页面放行、服务端拒收"。
//   · 随机只用 crypto.getRandomValues（srv/05 的口径）：房间码虽不保密，但"下一张桌是什么码"
//     不该被人算着抢先占座；Math.random 顶上是把这一条换成可预测的数。
//   · 链接一律**相对路径**（./index.html?room=CODE、./lobby.html）：页面既被房间进程从 /webui/
//     端出去，也被 vite dev（root=webui，根就是 /）端出去 —— 绝对路径 /webui/... 只在一边成立。
//     注意不能写 ./?room=CODE：/webui/ 会被 302 到 index.html，query 在那一跳就丢了。
import { normalizeRoomCode, ROOM_CODE_ALPHABET } from './netplay.ts';

type RoomRow = { code: string; seated: number; connections: number; phase: string; hand: number; waiting: boolean };

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`#${id} 不在页面上`);
  return node as T;
}

// /rooms 只在"从房间进程打开"时才存在；vite dev 下 fetch 会 404/连接不上 ⇒ 列表降级为空 +
// 一句说明（开桌与手输码仍可用），绝不把整页卡死。这就是大厅对两种宿主的全部适配。
async function fetchRooms(): Promise<RoomRow[] | null> {
  try {
    const res = await fetch('/rooms');
    if (!res.ok) return null;
    return (await res.json()) as RoomRow[];
  } catch {
    return null;
  }
}

async function renderRooms(): Promise<void> {
  const list = el<HTMLUListElement>('roomList');
  const note = el<HTMLParagraphElement>('listNote');
  const rows = await fetchRooms();
  if (rows === null) {
    list.replaceChildren();
    note.textContent = '（拿不到房间列表：不是从房间进程打开的？开新桌与手输房间码仍然可用）';
    return;
  }
  note.textContent = rows.length === 0 ? '（还没有码房间；点上面开一张）' : '（列表每 5 秒自动刷新）';
  const items = rows.map((r) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `./index.html?room=${r.code}`;
    // 等待中/进行中比裸 phase（idle/betting/…）好读；hosted 房间未开局就是等待中
    const stage = r.waiting ? '等待中' : '进行中';
    const handInfo = r.waiting || r.hand === 0 ? '' : ` · 第 ${String(r.hand)} 手`;
    a.textContent = `${r.code} · ${stage} · ${String(r.seated)} 人在座${handInfo}`;
    li.append(a);
    return li;
  });
  list.replaceChildren(...items);
}

// 摇一个不在"已存在码"里的房间码。拿不到 /rooms（vite dev）就当空表 —— 92 万个码里
// 两个人同时各摇一个还撞上（1/92 万）不值得为它加一次服务端往返；能拿到列表时就避开。
function rollCode(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  let code = '';
  for (const b of buf) code += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length];
  return code;
}

async function freshCode(): Promise<string> {
  const rows = (await fetchRooms()) ?? [];
  const taken = new Set(rows.map((r) => r.code));
  for (let i = 0; i < 20; i += 1) {
    const c = rollCode();
    if (!taken.has(c)) return c;
  }
  return rollCode(); // 20 次都撞（表坏到不像话）：照常给码，服务端那边本来就是首连即新房
}

function enter(code: string): void {
  window.location.href = `./index.html?room=${code}`;
}

el<HTMLButtonElement>('newRoom').addEventListener('click', () => {
  void freshCode().then(enter);
});

el<HTMLButtonElement>('joinCode').addEventListener('click', () => {
  const note = el<HTMLSpanElement>('codeNote');
  const raw = el<HTMLInputElement>('codeInput').value.trim();
  const code = normalizeRoomCode(raw);
  if (code === null) {
    note.textContent = `「${raw}」不是合法房间码（4 位，无 0/1/O/I/L）`;
    return;
  }
  note.textContent = '';
  enter(code);
});

void renderRooms();
// 自动刷新：大厅是"等朋友进来"的页面，新开出的桌不该要求手动刷新才看得见。
// 页面不可见时跳过（省无谓请求）；浏览器层允许用定时器（scene 那套纯函数纪律管不到这里）。
setInterval(
  () => {
    if (document.visibilityState === 'visible') void renderRooms();
  },
  5000,
);
