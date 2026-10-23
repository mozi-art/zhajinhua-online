# TEST-OUTPUT.md —— 测试输出与复现证据（DELIVERY rev 13 · M5 第三轮定点返修）

> 交付物之一（工单 §0.3）。自评表在 `SELF-REVIEW.md`。
> 所有输出都是命令的真实产物，未手工转写；本文件不含时间戳。
> **第 13 节 = 本轮（Q7 裁定 = B：停手改成标签页级，唯一一条）**；
> 第 12 节是 rev=12（rev=11 裁定的必修 1 项 + 应修 4 项 + §8 那八条口径）；
> 第 11 节是 rev=11（rev=10 裁定的必修 2 项 + 应修 9 项 + §8 那十三条验收口径）；
> 第 10 节是 rev=10（M5 联机可玩 + Q6=A2 价格接缝 + rev=9 §4 的 7 条应修销账）；
> 其后 **第 9 节是 rev=9（M4 定点返修）**、**第 8 节是 rev=8（M4 联机首版）**、第 7 节是 rev=7（观感修正）、
> M3 节是 rev=6、M2 节是 rev=5、第 0 节是 rev=4、第 1–7 节是 rev=3 原文，历史数字（171/206/232/340/362 例、46/70/73/76/41 条变异等）
> 属当时时点，有意不回改；rev=2（M1）在**附录 A**，rev=1（M0）的裁定见 `REVIEW.md`。
> 本轮新增的两件"测试工装自身"的证据写在 10.1.1 与 10.4.1：一次双跑不过的真因，以及扫描进程被切断留下变异态的经过。

# 13 · rev=13 定点返修（Q7 裁定 = B：停手是**标签页级**的，不是会话级）

> 本轮范围只有一件事：把 `ANSWERS.md` 第七轮裁定的 (B) 落地。里程碑不推进：批准范围仍停在 M4，
> M5 的唯一剩余闸门就是这一条（`REVIEW.md` rev=12 §9.3）。`nui/27`、`nui/28` 与全部既有用例的期望
> **一条都没改**（裁定明令），本轮只做加法。
> 要堵的洞不在"服务端掐线"（那条路复用同一个 peer，本来就洗不掉），而在玩家最自然的那两下点击：
> 「断开」→「连接」在 `webui/main.ts:152-156` 新建一个 peer，`violations` 随旧 peer 一起丢 ⇒ 警告被
> 静默抹掉，且复位时页面一句话都不说。这条是 2026-10-01 人类终验时在真浏览器里看到的（`r12-gui-edge-B-afterrenew.png`）。

## 13.1 命令、退出码与 §0.5 双跑哈希

| # | 命令 | 结果 |
|---|---|---|
| 1 | `node test/run.ts` | exit=0，末三行：`RUNNER files=29 cases=414` / `SUMMARY pass=414 fail=0 total=414` / `RESULT=ALL_PASS` |
| 2 | 同一条紧接着再跑一次 | exit=0，输出与第 1 次**逐字节相同** |
| 3 | `npm test` | exit=0，同上 |
| 4 | `npm test` 再跑一次 | exit=0，与第 3 次逐字节相同 |
| 5 | `npx tsc --noEmit` | exit=0，零诊断 |

```
node test/run.ts  →  .scratch/r13-run-node1.txt ≡ .scratch/r13-run-node2.txt   （cmp 逐字节相同，两次 exit=0）
  1826dd9ad457231ed5c94eb3d1d45c461bb458f723a136aae31289f46ed28dab  .scratch/r13-run-node1.txt
  1826dd9ad457231ed5c94eb3d1d45c461bb458f723a136aae31289f46ed28dab  .scratch/r13-run-node2.txt
npm test          →  .scratch/r13-run-npm1.txt  ≡ .scratch/r13-run-npm2.txt    （cmp 逐字节相同，两次 exit=0）
  8336295d0dfec4359830d13c791ba5c00eac9f9e3ab567bec8d10e45135f3e00  .scratch/r13-run-npm1.txt
  8336295d0dfec4359830d13c791ba5c00eac9f9e3ab567bec8d10e45135f3e00  .scratch/r13-run-npm2.txt
```

## 13.2 零回归与本轮用例

```
$ grep '^PASS ' .scratch/r12-run-node1.txt | sed -E 's/^PASS ([^ ]+) :: ([^ ]+).*/\1::\2/' | sort > .scratch/r12-ids-extract.txt
$ grep '^PASS ' .scratch/r13-run-node1.txt | sed -E 's/^PASS ([^ ]+) :: ([^ ]+).*/\1::\2/' | sort > .scratch/r13-ids.txt
$ comm -23 .scratch/r12-ids-extract.txt .scratch/r13-ids.txt      # 丢掉的 ⇒ 必须为空
（空）
$ comm -13 .scratch/r12-ids-extract.txt .scratch/r13-ids.txt      # 本轮新增
test/netx-netplay.test.ts::nui/29
test/netx-netplay.test.ts::nui/30
```

基线 = rev=12 交付时的 412 条 ID（同样从 `PASS` 行机械抽取，不手抄），本轮 414 条：**一条没丢、净增 2 条**，
两条都用新编号（`nui/29`、`nui/30`），没有任何既有用例被改名、改期望或删掉。

| 用例 | 钉的是裁定里的哪一颗钉子 |
|---|---|
| `nui/29`（新增） | 全条对着 `ANSWERS.md` 第七轮"二、停手口径裁 B"逐点断言：① **落账**——被抓那一帧就把 `{count:1, first:<越界原文>, hand:<手号>}` 写进 `<prefix>:untrusted`，且写真源只有 `peer.info()`；② **读取先于首帧**——同一份 store 上再 `createNet`（= `main.ts:152-156` 那两下点击的替身），新 peer 的 `violations` 明明是空的，页面仍然判不可信、`act()` 发不出去、警告位在第一条下行到达之前就把"只有关闭本标签页才能解除"说出来；③ **重连不自己涨数**——没再被抓时账一位没动；④ **再抓只递增**——`count` 1→2 而 `first` 永远是当年那一条，且**地板不替代**：那一世的墙照样响、被拒那一帧照样不进快照；⑤ **四操作不清**——`joinWire()`（重新入桌 / 换房间 URL）清的是凭据那把键，粘性这把一位不动（两把键各管各的，用 `store.get(':session')===null` 反向对照证明不是"顺手一起清"）；⑥ **新标签页干净**——换一份 store 就是一条提示都没有（解除只有那一条路） |
| `nui/30`（新增） | 读取判据不掺猜测：坏 JSON、`first` 为空、`count<1`、缺 `hand` 四种一律降级成"没有"（既不造停手也不崩，与 `readSaved` 同一口径）；合法账哪怕 `count=7` 也照实停手、照实把次数与首条原文印出来；**两把键互不牵连**——坏凭据不清粘性、坏粘性不影响凭据路径（对照组：从没被抓过的那一页 `untrusted=false`） |

## 13.3 变异扫描：本轮 7 条 + rev=11/12 受影响门复跑

`webui/netplay.ts` 本轮被改 ⇒ 以它为宿主的那几道老门全部复跑（`nst/13` 的 N05、`nui/21` 的 M08/M09）。

### 本轮新增的 7 条（全部只打这一道新门）

| id | 打坏的是什么 | 抓到它的门 | 结果 |
|---|---|---|---|
| P01 | 摘掉**写入**：被抓了但不落标签页账 ⇒ 重连就洗白（Q7 要堵的原洞形状） | `nui/29` 的 ① | caught |
| P02 | 摘掉**读取**：账落盘了但没人读 ⇒ "读取先于首帧"不成立 | `nui/29` + `nui/30` | caught |
| P03 | 摘掉 `act()` 的粘性拦截：继承来的停手仍然发得出上行 | `nui/29` | caught |
| P04 | 把 `untrusted()` 退回只看本会话：按钮不再塌、横幅不再出 | `nui/29` + `nui/30` | caught |
| P05 | "重新入桌顺手清一切"：`joinWire()` 里多清一把粘性键（裁定明令不清的四种操作之一） | `nui/29` 的 ⑤ | caught |
| P06 | 再被抓时把"首条"覆盖掉：玩家看不见最初是哪一条判的 | `nui/29` 的 ④ | caught |
| P07 | 计数初值写成"继承即已记"：第二世再被抓就不递增 —— **这是实现方本轮真写错过的语义**（13-C 第 1 项） | `nui/29` 的 ④ | caught |

⇒ `TOTAL=7 caught=7 survived=0 skipped=0`（`.scratch/r13-mut-out.txt`）。
P07 这一条特别说明：我第一次把 `stickyRecorded` 的初值写成"继承即已记"，那样 `count` 永远停在 1、
裁定要的"再抓递增"就是空转。改对之后我把它**反过来做成一条变异**，让这条语义有一个"改回去就翻红"的门。

### 宿主文件（`webui/netplay.ts`）本轮被改过 ⇒ 以它为宿主的 6 条老门全部复跑

| id | 打坏的是什么 | 抓到它的门 | 结果 |
|---|---|---|---|
| M06 | 只把 `departed` 过滤摘掉而不改标签（裁定点名的"不接受的改法"） | `nst/12` | caught |
| M07 | 离桌占位格不说"本局不参与" | `nui/22` | caught |
| M08 | collect 那段日志区不含服务端说明 | `nui/21` | caught |
| M09 | 主分支日志区不再并 `notices` | `nui/21` | caught |
| M12 | 座位格的 `resultText` 恒空 | `nui/23` | caught |
| N05 | collect 分支的日志不封顶（rev=11 应修 3 的原形） | `nst/13` | caught |

⇒ `TOTAL=6 caught=6 survived=0 skipped=0`（`.scratch/r13-mut-oldgates.txt`）。
本轮合计 **13 条变异：13 caught / 0 survived / 0 还原失败**。其余老门的宿主文件本轮一字未动
（`netx/client.ts`、`netx/ws.ts`、`netx/serve.ts`、`webmin/serve.ts`、`webui/scene.ts`、`src/**`），故不复跑。


## 13.4 覆盖 oracle v4（脚本 = 监督方 `.audit/rev11/sup-cov-final3.mjs`，原样、只读）

```
NODE_V8_COVERAGE=.scratch/r13-cov node test/run.ts
node .audit/rev11/sup-cov-final3.mjs .scratch/r13-cov      # → .scratch/r13-cov-report.txt
```

| 量 | rev=12（本轮的上一份） | rev=13（本轮同一脚本） |
|---|---|---|
| 全局 | 22 文件 / 43 段 / 5683 行覆盖 5543 = 97.5% | 22 文件 / **43 段** / **5758 行覆盖 5618 = 97.6%**（可执行行 +75 全在 `webui/netplay.ts`） |
| `webui/netplay.ts`（本轮唯一改动的交付文件） | 504/524 = 96.2% / 3 段 | **579/599 = 96.7% / 3 段** —— 新增的 `untrustedKey` / `readUntrusted` / `recordUntrusted` / `act()` 的粘性分支 / `trustLines()` 的追加行**全部在覆盖里**；未覆盖那三段仍是老面孔（`:484-500` K5 兜底、`:522-523` K8 余数文案、`:573` K1 穷尽） |
| `netx/client.ts` | 379/384 = 98.7% / 2 段 | **未改动**，读数一字不差：379/384 = 98.7% / 2 段 |
| `netx/ws.ts` | 236/246 = 95.9% / 4 段 | **未改动**：236/246 = 95.9% / 4 段 |

四条地面真值自检：原样跑 **A=`1111` / B=`1111111` / C=`12222222` / D=`11111`，`ORACLE_SELFCHECK_OK`**。
**A 那一条本轮仍然是行漂移的假绿**（rev=12 就报过一次：final3 把 A 写死在 `netx/ws.ts:146-149`，
而 500 兜底在 rev=12 就漂到了 `162-164`，146-149 现在是 `/health` 的 JSON 体）。本轮 `ws.ts` 一字未动，
所以我照旧用那份逐字副本复核而不是拿它当结论：

```
$ node .scratch/repin/r12-cov-repin.mjs .scratch/r13-cov > .scratch/r13-cov-report-repin.txt
  A netx/ws.ts:162-164  期望 111  实得 111  OK
$ diff .scratch/r13-cov-report.txt .scratch/r13-cov-report-repin.txt
228c228   ← 只差 A 这一行 ⇒ 上表合计读数不受影响
```

12-F 那 43 段与本轮 oracle 逐行对上（`SELF-REVIEW.md` 的 13-F），对账用监督方工装的副本
（`.scratch/r13-mk-diffcopy.mjs` → `.scratch/repin/r13-covdiff.mjs`，只改报告路径与节标签）：
**`COVDIFFRESULT=OK`，`onlyMine=0` / `onlyTheirs=0`**，双方段数都是 43、与 13-F 标题自称一致，
oracle 合计行 `# 合计 文件=22 可执行行=5758 已覆盖=5618 (97.6%) 未覆盖区间=43`，
`ranges=0` 的 5 个文件（`netx/seed.ts 112/112`、`netx/sha256.ts 113/113`、`src/cards.ts 135/135`、
`src/engine/project.ts 62/62`、`webui/bridge.ts 153/153`）与 13-F 表尾那句逐字对上。
原文留在 `.scratch/r13-covdiff-run.txt`。

## 13.5 真浏览器续证（§8.7 已签收，这一轮看的是"粘性真的粘住"）

§8.7 已于 2026-10-01 由人类监督方签收（`ANSWERS.md` 第七轮 / `REVIEW.md` rev=12 §9.1）。这一节记的是
**本轮改动的续证**：同一套真浏览器 + 真中间人工装，看的是"粘性真的粘得住"。
环境 = 真 Edge（视口 1910×915）、真房间（`node netx/serve.ts 8790`）、真 TCP 中间人
（`node .audit/rev11/br-mitm2.ts 8812 8790 .scratch/r13-mitm-trigger.json`）、两个真标签页各占一座。

| 时刻 | 屏幕上看到的 | 产物 |
|---|---|---|
| ① 注入落地 | 页眉 `⚠ 这一局不可信：patch unusable: pot 103 != sum(committed) 3 ⏎ （另有 2 条越界记录…） ⏎ 已停手：本页面不再向服务端发出任何行动 ⏎ ⚠ 本标签页曾判不可信 1 次（首条：patch unusable: pot 103 != sum(committed) 3），已停手；只有关闭本标签页才能解除`；底部按钮塌成 `已停手：这一局不可信`；**池仍显示 2**（被拒那一帧没进快照） | `.scratch/r13-gui-D-stopped.png` |
| ② 断开 → 重连（**本轮要看的就这一步**） | 新会话的 `violations` 是空的，但页眉只剩一行：`⚠ 本标签页曾判不可信 1 次（首条：…），已停手；只有关闭本标签页才能解除`；底部依旧 `已停手：这一局不可信`；而局面仍然看得见（第 2 手·待结算、`亮牌: 玩家 KD AS AD / 玩家 6H 5D AH`、`对子 · 应赢 8`）⇒ **只挡行动、不挡入桌**（13-D 第 2 项那个自行决定就是这么落的） | `.scratch/r13-gui-D-reconnected.png` |
| ③ 直连对照页 | 全程零误报、按钮正常、`在场筹码+池 512` 守恒 | `.scratch/r13-gui-C-control.png` |
| 注入确实发生 | 代理日志 `MITM2 armed mode=pot` → `MITM2 INJECTED mode=pot`，原文 `"pot":3` 被改成 `"pot":103` | `.scratch/r13-gui-mitm.log` |

**与 rev=12 的唯一区别就在第 ② 步**：那一份的证据是 `.scratch/r12-gui-edge-B-afterrenew.png`
（重连后横幅消失、行动恢复、页面一句话都不说），本轮同一动作变成"仍然停手 + 说清怎么解除"。
分级：这些截图与代理日志是**产物级**证据；"人手点出来的那两下"仍然只有人类监督方能自证，我不冒充。

收尾：房间与代理两个进程跑完已停（`netstat` 复查 8790/8812 均无监听），不留野进程。

## 13.6 `npm test` 完整输出（第 1 次运行原文）

```

> zjh@0.0.0 test
> node test/run.ts

=== ZJH TEST REPORT (deterministic) ===
PASS test/ai-honest.test.ts :: ai/01 牌力先验表 = 22100 手全枚举的事实
PASS test/ai-honest.test.ts :: ai/02 分位表按 classic 写死，但 a23off 下的偏差 < 2pp（所以表可以不分 preset）
PASS test/ai-honest.test.ts :: ai/03 牌力分位单调，且跨档不倒挂（弱档最强手 <= 强档最弱手）
PASS test/ai-honest.test.ts :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）
PASS test/ai-honest.test.ts :: ai/05 看过牌后才按牌力决策：强牌加注、中带跟、烂牌弃
PASS test/ai-honest.test.ts :: ai/06 池赔率真的进了决策：同一副牌，池给得大方就跟、池小就弃
PASS test/ai-honest.test.ts :: ai/07 对手数量真的进了决策：同一副牌同一赔率，人越多越保守
PASS test/ai-honest.test.ts :: ai/08 看牌/保持闷是真决策：最低注级闷着省钱，注级一抬就先转明
PASS test/ai-honest.test.ts :: ai/09 只出合法行动、闷着绝不加注也绝不比牌、比牌必是合法目标（200 组随机合法集合）
PASS test/ai-honest.test.ts :: ai/12 比牌触发率 = 1000 个 seq 上量得出来，且完全由 seq+座位决定（可重放）
PASS test/ai-honest.test.ts :: ai/10 纯函数：同一输入两次调用结果逐字相同（fuzz 与回放的前提）
PASS test/ai-honest.test.ts :: ai/11 先验与 tierOrder 挂钩：把档位排列倒过来，分位表跟着倒
PASS test/ai-honest.test.ts :: ai/13 比牌目标 = 活跃对手中已投入最高者；本局已比过则不再比
PASS test/ai-honest.test.ts :: ai/13b 投入并列时按环形序选目标，而不是按座位号大小（变异 C06 复发哨）
PASS test/ai-honest.test.ts :: ai/14 掷点只由 seq+座位决定：同输入同结果、同 seq 换座位换结果
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/classic 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/a23off 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/档位集合 六档键完全一致且无重复，计数均为非负整数
PASS test/classify.test.ts :: classify/闭式结构 trips 与 pair 与 a23 无关，其余四类随 runs 移动
PASS test/classify.test.ts :: classify/输入顺序无关 455 规范类 × 6 排列判定全同（两 preset）
PASS test/classify.test.ts :: classify/A23 一族 64 手在两 preset 下的迁移符合公式
PASS test/classify.test.ts :: classify/归一化键 顺子高点 A23=3 / 234=4 / QKA=14 且长度为 1
PASS test/classify.test.ts :: classify/归一化键 对子=[对子点, 踢脚]，穷举 3744 手
PASS test/classify.test.ts :: classify/归一化键 豹子 ranks=[r]，穷举 52 手
PASS test/classify.test.ts :: classify/NOTES 打印计数三元组（实际/闭式/锚点）供独立复算
PASS test/compare.test.ts :: compare/01 规范类数量 = C(15,3) = 455
PASS test/compare.test.ts :: compare/02 自反：每类与自身比较 = 0
PASS test/compare.test.ts :: compare/03 反对称：455^2 = 207025 全对，cmp(a,b) = -cmp(b,a)
PASS test/compare.test.ts :: compare/04 传递性穷举：(a>=b && b>=c) ⇒ a>=c，全 455^3 三元组
PASS test/compare.test.ts :: compare/05 花色不参与：全体花色平移 +1 后仍判 0
PASS test/compare.test.ts :: compare/06 与独立整数键参考实现交叉一致（455^2 全对）
PASS test/compare.test.ts :: compare/07 tierOrder 整序反转：跨档对全部翻转、同档对不变
PASS test/compare.test.ts :: compare/08 tierOrder 局部改动即刻生效（把 pair 提到 trips 之上）
PASS test/compare.test.ts :: compare/09 固定种子 1000 手排序后做全对序校验（不只是相邻）
PASS test/compare.test.ts :: compare/10 牌型序链：豹子>同花顺>同花>顺子>对子>单张（15 对全断言）
PASS test/compare.test.ts :: compare/11 tierOrder 缺档时 compare 抛错而不静默
PASS test/compare.test.ts :: compare/12 档位优先于点数：最小同花顺 > 最大普通顺等交叉断言
PASS test/deck.test.ts :: deck/01 makeDeck 长度 52 且逐位满足 index = suit*13 + (rank-2)
PASS test/deck.test.ts :: deck/02 52 张互不相同
PASS test/deck.test.ts :: deck/03 makeDeck 每次返回新数组与新对象（无共享可变状态）
PASS test/deck.test.ts :: deck/04 mulberry32 同 seed 的 1000 项序列完全一致
PASS test/deck.test.ts :: deck/05 不同 seed 的序列不同
PASS test/deck.test.ts :: deck/06 输出恒为非负 uint32 整数（1e6 次采样，覆盖边界 seed）
PASS test/deck.test.ts :: deck/07 seed 非整数抛 TypeError
PASS test/deck.test.ts :: deck/08 shuffle 原地：返回值与入参是同一个数组引用
PASS test/deck.test.ts :: deck/09 shuffle 结果是原牌堆的一个排列
PASS test/deck.test.ts :: deck/10 同 seed 两次洗牌逐位一致，不同 seed 至少一处不同
PASS test/deck.test.ts :: deck/11 52 张牌恰好调用 rng 51 次
PASS test/deck.test.ts :: deck/12 rng 返回浮点/负数/非数一律抛 TypeError
PASS test/deck.test.ts :: deck/13 空牌堆与单元素牌堆不调用 rng、不抛
PASS test/deck.test.ts :: deck/14 发牌烟雾：seed=1 洗完发 6 家，每手都可判定
PASS test/deck.test.ts :: deck/16 洗牌分布公平性：固定种子 20000 轮，52 个落点计数都在容差内
PASS test/deck.test.ts :: deck/17 三张牌穷举 144 种 rng 输出：每张牌的落点计数恰为 48
PASS test/deck.test.ts :: deck/18 NOTES 打印 PRNG 与洗牌的规范向量（供跨端复算）
PASS test/deck.test.ts :: deck/19 与独立誊写的参考 mulberry32 逐位一致（钉住结构与常数）
PASS test/deck.test.ts :: deck/20 rng 恒为 0 时输出等于牌堆左旋一格（钉住从尾往前的遍历方向）
PASS test/edge.test.ts :: edge/01 §3.5 A♠2♦3♣ < 3♠4♦5♣（A23 是最小顺）
PASS test/edge.test.ts :: edge/02 §3.5 A♥2♥3♥ 是同花顺且 > 4♣5♦6♣（档位优先于点数）
PASS test/edge.test.ts :: edge/03 §3.5 2♦2♣2♥ > A♠K♠Q♠（豹子 > 同花顺）
PASS test/edge.test.ts :: edge/04 §3.5 A♦A♣3♠ > K♦K♣A♠（对子点优先，踢脚再大也没用）
PASS test/edge.test.ts :: edge/05 §3.5 同点同级 → 0（花色完全不参与）
PASS test/edge.test.ts :: edge/06 绕 A 不成顺：A♠K♦2♣ 是单张而不是顺子
PASS test/edge.test.ts :: edge/07 最大豹子 > 最小豹子 > 任意同花顺
PASS test/edge.test.ts :: edge/08 a23off 下 A♥2♥3♥ 降为同花、A♠2♦3♣ 降为单张
PASS test/edge.test.ts :: edge/09 A 在非顺子牌型里取 14
PASS test/edge.test.ts :: edge/10 归一化键长度按档固定：豹子/顺 1 位、对子 2 位、同花/单张 3 位
PASS test/edge.test.ts :: edge/11 非法手牌：长度≠3 抛 TypeError
PASS test/edge.test.ts :: edge/12 非法手牌：两张同一牌（同点同花）抛 TypeError
PASS test/edge.test.ts :: edge/13 非法牌面：rank / suit 越界、非整数、NaN 都抛 TypeError
PASS test/edge.test.ts :: edge/14 非法手牌容器：非数组 / 元素非对象 / 缺字段抛 TypeError
PASS test/edge.test.ts :: edge/15 compare 两侧都继承 classify 的非法输入检查
PASS test/edge.test.ts :: edge/16 rules 结构缺失时不静默：缺 handEval 抛 TypeError
PASS test/edge.test.ts :: edge/17 单张的型内比较只看归一化后的三点
PASS test/engine-core.test.ts :: core/01 startHand 不变量：底注入池、每人扣 ante、游标在庄家下家、计数归零
PASS test/engine-core.test.ts :: core/02 发牌互不重叠且都来自标准 52 张
PASS test/engine-core.test.ts :: core/03 发牌顺序 = 独立复算的洗牌结果（庄家下家起连续取牌）
PASS test/engine-core.test.ts :: core/04 庄家必须在座位表里
PASS test/engine-core.test.ts :: core/05 配置非法一律抛 TypeError（人数越界 / 重复座位 / 付不起底注 / seed 非整数）
PASS test/engine-core.test.ts :: core/06 apply 是纯函数：对旧状态深冻结后再推进行动，不抛（说明没有原地写）
PASS test/engine-core.test.ts :: core/07 stateHash 对状态变化敏感、对重放稳定
PASS test/engine-core.test.ts :: core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值
PASS test/engine-core.test.ts :: core/09 资金守恒：开局到结算，筹码 + 池恒等于买入总额
PASS test/engine-core.test.ts :: core/10 同一配置重复开局得到同一状态（引擎里没有隐藏全局态）
PASS test/engine-core.test.ts :: core/11 日志单调：seq 逐条 +1，type 全部来自固定集合
PASS test/engine-core.test.ts :: core/12 引擎对 2 人与 6 人都能开局（人数只受 rules.players 约束，不硬编码）
PASS test/engine-core.test.ts :: core/13 终止阈值不多不少：注级 8 上各家满 2 次仍在局里，满 3 次才 stall
PASS test/engine-fuzz.test.ts :: fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码
PASS test/engine-fuzz.test.ts :: fuzz/02 三种终止条件都能被随机行动打到（换策略覆盖 ②③）
PASS test/engine-fuzz.test.ts :: fuzz/03 2–6 人局全部跑通且守恒
PASS test/engine-fuzz.test.ts :: fuzz/04 非法行动注入：一律抛 InvalidActionError，且状态指纹不变
PASS test/engine-fuzz.test.ts :: fuzz/05 回放确定性：同 seed + 同行动序列 ⇒ 同指纹（20 局）
PASS test/engine-fuzz.test.ts :: fuzz/06 结算幂等：settle 前后指纹稳定，且只入账一次
PASS test/engine-illegal.test.ts :: illegal/01 不轮到你 → not_current_turn（三种动作各一例）
PASS test/engine-illegal.test.ts :: illegal/02 座位不存在 → bad_seat
PASS test/engine-illegal.test.ts :: illegal/03 行动对象本身不合法 → unknown_action
PASS test/engine-illegal.test.ts :: illegal/04 首圈禁比：任何人第一次行动之前都不能比牌，全员各一次后立刻放开
PASS test/engine-illegal.test.ts :: illegal/05 比牌目标非法：自己 / 已弃牌 / 不存在的座位
PASS test/engine-illegal.test.ts :: illegal/06 重复看牌被拒；看牌不消耗行动数也不推进游标
PASS test/engine-illegal.test.ts :: illegal/07 注级顶格不能再加注
PASS test/engine-illegal.test.ts :: illegal/08 钱不够 ⇒ 唯一合法行动是弃牌（全押禁用，§1 全押行）
PASS test/engine-illegal.test.ts :: illegal/09 已弃牌的座位不会再被要求行动，硬塞则 seat_not_active
PASS test/engine-illegal.test.ts :: illegal/10 终局后所有下注类行动被拒（phase_not_betting）
PASS test/engine-illegal.test.ts :: illegal/11 结算时机：没终局不能 settle；已结算再 settle 是幂等 no-op
PASS test/engine-illegal.test.ts :: illegal/12 legalActions 与 checkAction 判据完全一致（不轮到你时给出的是当前 turn 的动作集）
PASS test/engine-illegal.test.ts :: illegal/13 timeout 是普通行动：买得起 ≡ 跟注、买不起 ≡ 弃牌，且都过同一道 validate
PASS test/engine-money.test.ts :: money/01 底注：pool = ante × 人数，每人筹码与 committed 各扣/记一份
PASS test/engine-money.test.ts :: money/02 闷跟 = stake×bet.dark，明跟 = stake×bet.seen（三种注级各验）
PASS test/engine-money.test.ts :: money/03 加注：注级翻倍并按新注级付跟价（Q1 读法 B），且全员当前注级行动数清零
PASS test/engine-money.test.ts :: money/04 比牌费 = fee × stake 入池，与闷/明无关（注级 1/2/4 各验一次）
PASS test/engine-money.test.ts :: money/05 不变量：pot 恒等于各家 committed 之和；每步增量恰是 actionCost
PASS test/engine-money.test.ts :: money/06 弃牌不花钱也不退钱：弃牌者的 committed 留在池里（无边池无退款）
PASS test/engine-money.test.ts :: money/07 分池：整除时人人等份；有余数时给"距庄家下家最近"的赢家
PASS test/engine-money.test.ts :: money/08 幂等结算：入账只发生一次，重放 settle 不重复扣/发钱
PASS test/engine-money.test.ts :: money/09 任何时刻都不出现负筹码（全押禁用的直接后果）
PASS test/engine-money.test.ts :: money/10 结算后赢家所得 = 池，且各家 committed 之和 = 结算前 pot
PASS test/engine-project.test.ts :: project/01 谁都没看过牌：本人也是 unknown，他人一律 unknown（§1 看牌行）
PASS test/engine-project.test.ts :: project/02 序列化后仍然搜不到任何他人牌面（整条 view 一起查，含日志）
PASS test/engine-project.test.ts :: project/03 强制开牌后：活跃家全部可见，弃牌/被淘汰者仍然 unknown
PASS test/engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
PASS test/engine-project.test.ts :: project/05 seed 只在结算后才暴露（否则任何客户端都能反算整副牌）
PASS test/engine-project.test.ts :: project/06 公开信息一字不漏：池/注级/游标/计数/闷明/committed 全部同步
PASS test/engine-project.test.ts :: project/07 观战视角（viewer 不在座位表里）看不到任何未开的牌
PASS test/engine-project.test.ts :: project/08 视图是拷贝，改它不会污染引擎状态
PASS test/engine-project.test.ts :: project/09 终局信息公开：赢家集合、份额、余数归属都可投影
PASS test/engine-project.test.ts :: project/10 startHand 之后立刻投影：轮到行动也没看过牌 ⇒ 本人同样无牌可看
PASS test/engine-project.test.ts :: project/11 负向：未看牌时整条 view 序列化后搜不到本人牌面
PASS test/engine-project.test.ts :: project/12 revealed 优先于 looked：本人没看牌，被强制开牌后照样看得见自己的牌
PASS test/engine-scripts.test.ts :: scripts/01 弃至通吃（§1①）：只剩一人即结束，且不开牌
PASS test/engine-scripts.test.ts :: scripts/02 比牌链：连续两次比牌各淘汰一家，输家的牌永不公开
PASS test/engine-scripts.test.ts :: scripts/03 封顶开牌（§1②）：注级 16 且活跃各家再完成 1 次行动 ⇒ 强制开牌
PASS test/engine-scripts.test.ts :: scripts/04 stall 强开（§1③）：同一注级下活跃各家各满 3 次行动；加注会把计数清零重计
PASS test/engine-scripts.test.ts :: scripts/05 平局分池：两家打平 ⇒ 平分池，除不尽的余数给距庄家下家最近者
PASS test/engine-scripts.test.ts :: scripts/06 挑战者输：比牌平局时挑战者出局（§1 比牌行）
PASS test/engine-scripts.test.ts :: scripts/07 剩两家比牌 = 直接开牌定胜负（两家牌都亮）
PASS test/engine-scripts.test.ts :: scripts/08 三条终止路径各自都要能到达（覆盖性，不是只测一条）
PASS test/engine-scripts.test.ts :: scripts/09 每个脚本重放得到同一状态指纹（回放确定性）
PASS test/engine-timeout.test.ts :: timeout/01 (a) 全员托管的一手牌必然走完，且终局原因是 stall
PASS test/engine-timeout.test.ts :: timeout/02 (b) 付不起跟价的那一家回退成弃牌，且不欠款、不出现负筹码
PASS test/engine-timeout.test.ts :: timeout/03 (c) 已看牌者付明注价、未看牌者付闷注价
PASS test/engine-timeout.test.ts :: timeout/04 (d) 托管不产生 look / raise / compare 事件，也不替玩家看牌
PASS test/engine-timeout.test.ts :: timeout/05 托管仍是普通行动：同一道 validate，越界照样被拒
PASS test/engine-timeout.test.ts :: timeout/06 可归因性：玩家自主跟注的 note 里不许出现 timeout
PASS test/m2-fuzz.test.ts :: m2/01 随机合法行动 1000 局：守恒 / 无负筹码 / 无重复结算 / 有限步终止
PASS test/m2-fuzz.test.ts :: m2/02 诚实 AI 1000 局：只出合法行动、闷着不加注、决策数非零且必然终止
PASS test/m2-fuzz.test.ts :: m2/03 AI 臂与随机臂都打到全部三类终止条件（覆盖不是单边运气）
PASS test/m2-fuzz.test.ts :: m2/04 四类非法行动必被 validate 拒（不轮到你 / 钱不够 / 比已弃牌者 / 首圈禁比时段比牌）
PASS test/m2-fuzz.test.ts :: m2/05 牌力分位 ≈ 真实胜率，且档内端点随 a23 正确移动（两 preset 全枚举对拍）
PASS test/netx-client.test.ts :: client/01 收到 collect 里"还缺我"就立刻交一份份额，且一局只交一次
PASS test/netx-client.test.ts :: client/02 行动防呆：只有"轮到我且局面干净"才放行
PASS test/netx-client.test.ts :: client/03 服务端越界第一类：消息本身不合法 ⇒ 记录违规并拒绝继续
PASS test/netx-client.test.ts :: client/04 增量对不上号 ⇒ 不合并并记违规
PASS test/netx-client.test.ts :: client/05 快照的日志有洞 = 不可信
PASS test/netx-client.test.ts :: client/06 揭示核对的几类造假都会被当场发现
PASS test/netx-client.test.ts :: client/07 结算之前收到 deal 载荷（种子提前泄露）⇒ 违规并停手
PASS test/netx-client.test.ts :: client/08 error 分两类：漏牌即停手，普通回执不停手
PASS test/netx-client.test.ts :: client/09 重连消息带的是"我看到的 hand/seq"，没凭据时不发
PASS test/netx-client.test.ts :: client/11 揭示"自洽"但不是发牌用的那颗种子 ⇒ 仍然要报
PASS test/netx-client.test.ts :: client/10 旁观者的揭示（本局没参与、也没拿到过承诺）不报违规，也不算核对通过
PASS test/netx-client.test.ts :: client/12 收完份额之后改口重发承诺 ⇒ 当场识破，且那份"自洽揭示"随后也过不了（必修 1 主案）
PASS test/netx-client.test.ts :: client/13 对照组：不改口、只揭示另一个份额 ⇒ 承诺门独立就能抓住（洞在存储，不在核对逻辑）
PASS test/netx-client.test.ts :: client/13b 同值重发承诺要放过（断线补承诺），换局则重新开账
PASS test/netx-client.test.ts :: client/14 别人的承诺混进来仍然算越界（写一次门不改变这一条）
PASS test/netx-client.test.ts :: client/15 logShape 三道闸门报错文本互不相同，合法增量则一条不报（移植复审 S9）
PASS test/netx-client.test.ts :: client/16 拿到 token 但还没进过任何一手 ⇒ resume 发不出去（hand=0 是协议非法值），上层因此会改走 join
PASS test/netx-crypto.test.ts :: netx/01 SHA-256 命中 FIPS 180-4 公开向量
PASS test/netx-crypto.test.ts :: netx/02 与 node:crypto 逐字节差分（覆盖补齐边界与多字节 UTF-8）
PASS test/netx-crypto.test.ts :: netx/03 雪崩：改一个字符，256 位里至少一半上下变化
PASS test/netx-crypto.test.ts :: netx/04 base64 命中经典向量（长度余数 0/1/2 三条路径都走到）
PASS test/netx-crypto.test.ts :: netx/05 握手 accept 命中 RFC 6455 §1.3 向量，非法 key 抛错
PASS test/netx-crypto.test.ts :: netx/06 十六进制与字节的往返（承诺/份额的编码面）
PASS test/netx-crypto.test.ts :: netx/07 摘要入口对空输入与非空输入给出不同长度一致的输出
PASS test/netx-crypto.test.ts :: netx/08 SHA-1（握手用）与 node:crypto 差分，且命中 RFC 6455 §1.3 向量
PASS test/netx-frames.test.ts :: frame/01 编码的三档长度字段逐字节符合规范
PASS test/netx-frames.test.ts :: frame/02 客户端方向必须掩码，且 XOR 逐字节可复算
PASS test/netx-frames.test.ts :: frame/03 客户端→服务端：掩码帧能解，逐字节喂也要能解
PASS test/netx-frames.test.ts :: frame/04 掩码方向判反：客户端不掩码 / 服务端掩码 都拒
PASS test/netx-frames.test.ts :: frame/05 长度必须最小编码，64 位长度不得越出 32 位
PASS test/netx-frames.test.ts :: frame/06 RSV 位非 0 一律拒（没谈扩展就不许出现）
PASS test/netx-frames.test.ts :: frame/07 控制帧规则：ping/pong 原样交回，close 解析状态码
PASS test/netx-frames.test.ts :: frame/08 非法 close 一律拒（1 字节载荷 / 保留码 / 越界码）
PASS test/netx-frames.test.ts :: frame/09 控制帧不得分片、载荷不得过 125
PASS test/netx-frames.test.ts :: frame/10 文本分片可重组，控制帧插在中间也不丢序
PASS test/netx-frames.test.ts :: frame/11 跨分片的多字节字符不会解坏（UTF-8 状态在帧边界上延续）
PASS test/netx-frames.test.ts :: frame/12 非法帧序与未知操作码一律拒
PASS test/netx-frames.test.ts :: frame/13 巨帧、巨消息与编码侧都有上限
PASS test/netx-frames.test.ts :: frame/14 非法 UTF-8 文本帧拒收
PASS test/netx-frames.test.ts :: frame/15 握手 accept：已知向量 + key 边界
PASS test/netx-frames.test.ts :: frame/16 编码侧的三道参数自检：掩码键长度、分片点、pong 帧
PASS test/netx-frames.test.ts :: frame/17 64 位长度字段：非最小编码要拒、合法长帧要收、高 32 位不许越界
PASS test/netx-leak.test.ts :: leak/01 真实牌面在"亮牌"之前不出现在任何一条下行字节里（三家、跑完整一手）
PASS test/netx-leak.test.ts :: leak/02 种子与各家份额在揭示之前不外泄
PASS test/netx-leak.test.ts :: leak/03 中途加入的旁观者：既不在投影里，也没发现任何越界
PASS test/netx-leak.test.ts :: leak/04 增量重连与全量快照两条路收敛：日志逐条一致、数字一致
PASS test/netx-leak.test.ts :: leak/05 客户端第二道墙：服务端把别人的牌塞进投影 ⇒ 当场发现并拒绝再行动
PASS test/netx-leak.test.ts :: leak/06 上行 nonce 各交一份、互不相同，且承诺里读不出份额
PASS test/netx-netplay.test.ts :: nui/01 联机快照与单机快照键集逐字一致 ⇒ 同一套 scene/paint 不必改一个字
PASS test/netx-netplay.test.ts :: nui/02 只有一道墙：netplay 里不得出现第二份协议实现，也不得自己判规则算钱
PASS test/netx-netplay.test.ts :: nui/03 两家打完两整手：看牌 / 加注 / 比牌 / 结算面板 / 第二手轮庄，两侧数字逐字一致
PASS test/netx-netplay.test.ts :: nui/04 负向：没看牌时本人牌不在快照里，别家牌面全程不出现
PASS test/netx-netplay.test.ts :: nui/05 伪造下行：当场标"不可信"并停手；leak_blocked 与 replaced 的提示可区分
PASS test/netx-netplay.test.ts :: nui/06 断线重连：增量与快照两条路都真走到，台账一颗不错
PASS test/netx-netplay.test.ts :: nui/07 同一浏览器两个标签页各占一座：per-tab 存储互不覆盖；共享存储会翻车（对照）
PASS test/netx-netplay.test.ts :: nui/08 超时托管一路带到 UI：日志行里就是 timeout→call 的字样
PASS test/netx-netplay.test.ts :: nui/09 按钮：可用性只看服务端 phase/turn；金额来自引擎那一处算术且只进文案（Q6=A2）
PASS test/netx-netplay.test.ts :: nui/10 刷新之后仍能核对揭示：份额必须随凭据一起存下来
PASS test/netx-netplay.test.ts :: nui/11 (a) 端到端价格一致性：行动前页面显示的 cost === 行动后 log 里那条事件的 amount（跟/加/比各一次）
PASS test/netx-netplay.test.ts :: nui/12 (b) 闷/明差价在页面上看得见，且两个数都等于 priceOf 的输出（不是测试里手写的常量）
PASS test/netx-netplay.test.ts :: nui/13 (c) 买不起跟价的座位：按钮仍然可点、发得出去，代价由服务端 reject 送回来并被页面显示
PASS test/netx-netplay.test.ts :: nui/14 (d) 同一条按钮契约两条路共用一处算术：单机 buttonOptions 的 cost 与联机 buttonRow 的 cost 相等
PASS test/netx-netplay.test.ts :: nui/15 意图 → 动作的收窄：只有五种真行动能上协议线，推进类意图一律 null
PASS test/netx-netplay.test.ts :: nui/18 凭据作废（房间重启后 token 不认）⇒ 清存储 + 说清楚 + 自动补一条全新 join，页面不许停在"已连接、零下行"
PASS test/netx-netplay.test.ts :: nui/17 页面模块图在静态服务策略下完整可达（浏览器实测抓到的那类 403 由这条兜住）
PASS test/netx-netplay.test.ts :: nui/16 入口层静态门：main.ts 只接线不判规则，联机那一侧只有一个进口
PASS test/netx-netplay.test.ts :: nui/19 过不了 schema 的下行不许清凭据、不许强制重入桌；已停手的那一世也不许再发上行（rev=10 应修 2）
PASS test/netx-netplay.test.ts :: nui/20 上一条 reject 在我发出新行动之后必须过期（提示行不许陈述已翻篇的事实，rev=10 应修 4）
PASS test/netx-netplay.test.ts :: nui/21 服务端 notice 上到日志区：玩家既看得见结果、也看得见原因（rev=10 应修 5）
PASS test/netx-netplay.test.ts :: nui/22 底部那行数字的标签与 departed 过滤同口径：是「在场筹码+池」，不是「桌上总额」（rev=10 应修 7 / §8.9）
PASS test/netx-netplay.test.ts :: nui/23 在座座位格是服务端那一行的逐项映射：牌面/等级/筹码/已投入/状态/庄标/隐藏（rev=10 §8.12 i 主路径）
PASS test/netx-netplay.test.ts :: nui/24 中间人改 patch：往我的 view 里塞别家的牌面必须被抓、不许采纳、页面立刻停手（rev=10 §8.13）
PASS test/netx-netplay.test.ts :: nui/25 seq 面与采纳面：合法增量被采纳、同一条重放当场被抓、被拒的帧不进快照（rev=11 必修 1 的改写）
PASS test/netx-netplay.test.ts :: nui/27 patch 上的权威数字篡改：六种注入每一种都被纯客户端恒等式抓住、不采纳、并停手（rev=11 必修 1）
PASS test/netx-netplay.test.ts :: nui/28 诚实流量上恒等式不误报：三手多路行动逐帧采样，violations 恒空（误报与漏报同罪）
PASS test/netx-netplay.test.ts :: nui/26 per-tab 存储里那坨值是坏 JSON：会话建得起来、当作没有凭据、入桌照常（netplay.ts::readSaved 的 catch）
PASS test/netx-netplay.test.ts :: nui/29 停手粘在标签页上：重连新建的会话仍然停手；再被抓只递增次数、不改首条；新标签页干净（Q7 = B）
PASS test/netx-netplay.test.ts :: nui/30 标签页账的读判据：坏 JSON 与形状不对一律降级成"没有"，合法账哪怕次数很大也照实停手（两把键互不牵连）
PASS test/netx-protocol.test.ts :: proto/01 双向消息 encode→check 往返保真，且字节稳定
PASS test/netx-protocol.test.ts :: proto/02 未知 key 一律拒（顶层、嵌套 move、嵌套 view、rules 内部）
PASS test/netx-protocol.test.ts :: proto/03 缺 key 与类型不符一律拒
PASS test/netx-protocol.test.ts :: proto/04 数值与长度越界一律拒
PASS test/netx-protocol.test.ts :: proto/05 引擎拒绝码全集与 src/engine/validate.ts 逐字对齐（防契约漂移）
PASS test/netx-protocol.test.ts :: proto/06 服务端实际发出的 net 拒绝码都在声明集合里，且声明集合没有空转项
PASS test/netx-protocol.test.ts :: proto/07 checkViewLeak 拦住五种越界投影，放过两种合法情形
PASS test/netx-protocol.test.ts :: proto/08 已看牌但未亮牌的"别人"仍然算泄漏（rev=4 口径在网络层同样生效）
PASS test/netx-protocol.test.ts :: proto/09 toAction 只能用绑定的座位，compare 才带 target
PASS test/netx-protocol.test.ts :: proto/10 校验错误信息带路径，便于线上定位
PASS test/netx-protocol.test.ts :: proto/11 巨帧保护：超过上限的字符串直接拒
PASS test/netx-protocol.test.ts :: proto/12 出口编码也过同一套校验：服务端构造出非法消息时本地就炸，不发到线上
PASS test/netx-protocol.test.ts :: proto/13 入参既不是 JSON 文本也不是对象 ⇒ 报"必须是文本或对象"，不报成 schema 错（rev=9 应修 3）
PASS test/netx-room.test.ts :: room/01 两家入座即开局：hello→承诺→份额→发牌，第三条连接中途加入不参与本局
PASS test/netx-room.test.ts :: room/02 承诺先于任何份额被接受（线上顺序可查，且承诺不是份额本身）
PASS test/netx-room.test.ts :: room/03 没凑齐份额就不发牌；凑齐的那一刻发牌，且发牌后种子仍不外泄
PASS test/netx-room.test.ts :: room/04 发牌之后再交份额一律被拒，且局面一字不动
PASS test/netx-room.test.ts :: room/04b 收份额阶段：错局号与"不在这局里"的家都被拒
PASS test/netx-room.test.ts :: room/05 座位由连接绑定：上行里没有 seat 字段，越界与伪造一律无副作用
PASS test/netx-room.test.ts :: room/06 完整一手：行动、结算、揭示核对，客户端零违规、总筹码守恒
PASS test/netx-room.test.ts :: room/07 全程没人动手：超时托管把一手牌走到结算，且走的是"自动跟注"这条臂
PASS test/netx-room.test.ts :: room/08 断线重连·seq 对得上 ⇒ 只补增量，补齐后三家视图与日志逐条一致
PASS test/netx-room.test.ts :: room/09 断线跨了一局再回来 ⇒ 拿的是新一局的快照，且本局种子对它合法可见
PASS test/netx-room.test.ts :: room/10 掉线者不交份额 ⇒ 到点改成两人局，牌局照常走完
PASS test/netx-room.test.ts :: room/11 多局连续：轮庄、筹码结转、每一局的揭示都对得上
PASS test/netx-room.test.ts :: room/12 桌上凑不齐两家就收桌：破产者下一局不再入池，筹码一颗不少
PASS test/netx-room.test.ts :: room/13 重连凭据的保护：乱 token 不绑座，真 token 回原位并顶掉旧连接
PASS test/netx-room.test.ts :: room/14 承诺与揭示双向绑定：打得开、合得出、换一家就对不上
PASS test/netx-room.test.ts :: room/15 房间层的门槛：最小买入与满座都不占座
PASS test/netx-room.test.ts :: room/16 driveToSettle 走的一手牌必然在有限步内终止（引擎不变量在联机层同样成立）
PASS test/netx-room.test.ts :: room/17 结算之后才回来的那一家，承诺+快照+揭示一起补回（审计材料不因断线丢失）
PASS test/netx-room.test.ts :: room/20 阶段门在房间层：awaitingSettle 之后的行动被房间挡下（不是丢给引擎）
PASS test/netx-room.test.ts :: room/19 没绑上座位的连接：任何游戏消息都只会拿到 no_seat，不会碰到局面
PASS test/netx-room.test.ts :: room/18 定时器不泄漏：发牌后 nonce 表必须取消，结算后只剩局间那一只
PASS test/netx-room.test.ts :: room/21 应用层 ping→pong 端到端（rev=8 里这条路径零覆盖）
PASS test/netx-room.test.ts :: room/22 已经绑上座位的连接再 join ⇒ already_joined，座位绑定不动
PASS test/netx-room.test.ts :: room/23 拿别人座位的 token 在已绑座的连接上重连 ⇒ token_seat_mismatch
PASS test/netx-room.test.ts :: room/24 行动阶段的两道门：没有牌局 ⇒ not_dealt，局号错位 ⇒ bad_hand
PASS test/netx-room.test.ts :: room/25 份额阶段的两道门：没有牌局 ⇒ not_dealt，不在本局名单里的 party ⇒ no_seat
PASS test/netx-room.test.ts :: room/26 诊断面的连接清单按码点序给出（与份额定序同一把尺，rev=8 应修 5）
PASS test/netx-room.test.ts :: room/27 构造期三道 TypeError 各自说清越界在哪（rev=9 应修 1）
PASS test/netx-room.test.ts :: room/28 到点还凑不齐最低人数 ⇒ 本局作废、只挂局间表、到点重开为第二局（rev=9 应修 2）
PASS test/netx-room.test.ts :: room/29 庄家那一座没交份额 ⇒ 剔除之后庄家必须挪到还在桌的一家，牌局照常开（旧行为：整个房间进程被 TypeError 打死）
PASS test/netx-seed.test.ts :: seed/01 承诺把 hand / party / 份额三者绑在一起
PASS test/netx-seed.test.ts :: seed/02 合成与提交顺序无关（任何一端都能独立复算）
PASS test/netx-seed.test.ts :: seed/03 改任何一家的份额，种子必变（没有旁观者）
PASS test/netx-seed.test.ts :: seed/04 没有任何一家能决定种子：固定其余各家，逐家扫描 32 个候选
PASS test/netx-seed.test.ts :: seed/05 局号参与合成：同一批份额在不同局给出不同种子
PASS test/netx-seed.test.ts :: seed/06 合成结果是引擎接受的 uint32 整数
PASS test/netx-seed.test.ts :: seed/07 非法份额输入一律抛错（含能造成拼接歧义的字符）
PASS test/netx-seed.test.ts :: seed/08 揭示核对：一一对上才算通过
PASS test/netx-seed.test.ts :: seed/09 承诺文本是单射的：改一个字符就换摘要（雪崩在这里体现为不可伪造）
PASS test/netx-seed.test.ts :: seed/10 座位方命名在 party charset 内，且与"server"不撞
PASS test/netx-seed.test.ts :: seed/12 合成用的是完整 32 位（截断成 16 位会被这条抓到）
PASS test/netx-seed.test.ts :: seed/13 定序只用码点键：seedVector 与 canonicalShares 是同一把尺（rev=8 必修 4）
PASS test/netx-seed.test.ts :: seed/14 互为前缀的 party 名（seat:1 与 seat:10）：定序排的是 party，不是拼接串
PASS test/netx-seed.test.ts :: seed/11 固定向量：复审可照抄复算
PASS test/netx-serve.test.ts :: srv/01 房间进程在空闲端口上起来：/health 与 webui 页面同源同端口
PASS test/netx-serve.test.ts :: srv/02 两家从房间进程真跑一手牌：跨真 socket 的揭示核对通过，零越界
PASS test/netx-serve.test.ts :: srv/03 一条命令起、一句 quit 干净退出（退出码 0，不是被硬杀）
PASS test/netx-serve.test.ts :: srv/04 坏端口参数：退出码 2 且留一句话
PASS test/netx-serve.test.ts :: srv/05 默认端口在"房间进程"与"页面输入框"两处不许各说各话
PASS test/netx-serve.test.ts :: srv/06 横幅里印出来的那个页面 URL 就是联机页（rev=10 必修 1）
PASS test/netx-serve.test.ts :: srv/07 一条畸形百分号转义打死独立静态服务（rev=10 必修 2）⇒ 现在回 400 且进程存活
PASS test/netx-serve.test.ts :: srv/08 文件不存在回 404（不是 500），响应形状与 no-store 口径一起钉住
PASS test/netx-static.test.ts :: nst/01 扫描范围覆盖 netx 全部源文件，可移植清单里的文件都真实存在
PASS test/netx-static.test.ts :: nst/02 零第三方依赖：netx 里每个 import 都是相对路径或 node: 内置
PASS test/netx-static.test.ts :: nst/03 协议核心里没有时钟、随机与 IO（引擎的确定性口径延续到联机层）
PASS test/netx-static.test.ts :: nst/04 分层：src/ 与 webmin/ 完全不知道联机存在；webui 里只有 netplay.ts 这一个进口
PASS test/netx-static.test.ts :: nst/05 tsconfig 的 include 覆盖 netx，且沿用同一条可擦除语法约束
PASS test/netx-static.test.ts :: nst/06 netx 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）
PASS test/netx-static.test.ts :: nst/07 M4 之后依赖面仍然没扩：dependencies 空、devDependencies 仍在白名单内
PASS test/netx-static.test.ts :: nst/08 房间层的时钟与随机全部来自注入（RoomOptions 是唯一的入口）
PASS test/netx-static.test.ts :: nst/10 Q6=A2 ④：价格公式不许扩散 —— 页面侧只有 netplay.ts 这一个接缝
PASS test/netx-static.test.ts :: nst/11 跑测工装必须挡住"带 PID 的实验警告"这条双跑破口（§0.5）
PASS test/netx-static.test.ts :: nst/09 M4 的测试文件自己也不许用时钟与随机（否则双跑必然不一致）
PASS test/netx-static.test.ts :: nst/12 「在场筹码+池」一把尺：标签、渲染处、过滤口径、两个页面入口必须同进退（rev=10 应修 7）
PASS test/netx-static.test.ts :: nst/13 日志区两条分支同一条上限，且 notices 的窗口不许超过它（rev=11 应修 3）
PASS test/netx-ws.test.ts :: ws/01 三个独立 WebSocket 客户端打进来，跑完整一手并各自核对揭示
PASS test/netx-ws.test.ts :: ws/02 /health 可读；普通 HTTP 请求不会误入升级分支
PASS test/netx-ws.test.ts :: ws/03 握手与帧的严格性在真 socket 上生效：合法 101、旧版本 426、未掩码被 1002 关掉
PASS test/netx-ws.test.ts :: ws/05 非法握手的每一条都被拒，且拒绝不在房间里留下连接
PASS test/netx-ws.test.ts :: ws/06 真 socket 上的控制帧：客户端 ping 得到同载荷 pong，坏帧得到 1002（rev=9 应修 3）
PASS test/netx-ws.test.ts :: ws/09 握手拒绝的正文两两不同，且与 Node 自己答的那串 400 可分辨（rev=11 应修 2）
PASS test/netx-ws.test.ts :: ws/04 真 socket 断线：牌局在托管下走完，凭 token 重连后拿到完整局面并核对揭示
PASS test/netx-ws.test.ts :: ws/07 onHttpRequest 抛异常 ⇒ 500 兜底、连接不残留、房间照常服务（rev=10 应修 9）
PASS test/netx-ws.test.ts :: ws/08 Connection 头的四种"我们不肯放行"写法全部停在 Node 层 404：ws.ts:163-167 按构造不可达
PASS test/rules.test.ts :: rules/01 presets.classic 幂等通过 validateRules
PASS test/rules.test.ts :: rules/02 presets.a23off 幂等通过 validateRules
PASS test/rules.test.ts :: rules/03 两个 preset 仅在 handEval.a23 上不同
PASS test/rules.test.ts :: rules/04 classic 的每个数值逐项等于工单 §1 表格
PASS test/rules.test.ts :: rules/05 未知顶层 key special235=true 抛 TypeError
PASS test/rules.test.ts :: rules/06 未知 key 即使值为 false 也抛（不在 v1 schema）
PASS test/rules.test.ts :: rules/07 未知嵌套 key 抛（handEval / bet 内）
PASS test/rules.test.ts :: rules/08 缺 key 抛（顶层与嵌套各一例）
PASS test/rules.test.ts :: rules/09 值类型错抛（字符串数字 / null / 非布尔）
PASS test/rules.test.ts :: rules/10 version 必须是字面量 1
PASS test/rules.test.ts :: rules/11 字面量域的非法值抛（allIn / compare.tie / showdown.*）
PASS test/rules.test.ts :: rules/12 tierOrder 必须是 6 档无重复排列
PASS test/rules.test.ts :: rules/13 非对象输入一律抛
PASS test/rules.test.ts :: rules/14 validateRules 返回值深冻结（顶层/嵌套/数组都改不动）
PASS test/rules.test.ts :: rules/15 validateRules 返回深拷贝，输入事后被改不影响副本
PASS test/rules.test.ts :: rules/16 presets 本身深冻结
PASS test/rules.test.ts :: rules/17 错误消息点名违规所在路径与 key
PASS test/rules.test.ts :: rules/18 dealer.next 三档各自合法，且 preset 默认 = rotate
PASS test/rules.test.ts :: rules/19 dealer 的非法形态一律抛（枚举外值 / 缺字段 / 多余 key / 非对象 / 大小写）
PASS test/rules.test.ts :: rules/20 跨字段约束：players.min≤max 与 stake.initial≤max 各自抛，等号边界放过
PASS test/static.test.ts :: static/00 扫描范围覆盖 cards / rules / engine / ai 全部源文件
PASS test/static.test.ts :: static/01 src 里不出现时钟与随机全局态
PASS test/static.test.ts :: static/02 src 里不出现文件、网络与控制台 IO
PASS test/static.test.ts :: static/03 src 不引用任何运行时全局可变对象
PASS test/static.test.ts :: static/04 import 只允许相对路径；M0 两文件只允许 import type ./rules.ts
PASS test/static.test.ts :: static/05 src 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）
PASS test/static.test.ts :: static/06 零运行时依赖：dependencies 必须为空（或整体不存在）
PASS test/static.test.ts :: static/07 devDependencies 落在工单白名单内
PASS test/static.test.ts :: static/08 npm test 是单命令，且不依赖任何已安装依赖
PASS test/static.test.ts :: static/09 tsconfig 打开 strict 与 erasableSyntaxOnly
PASS test/static.test.ts :: static/10 输出生产者 test/run.ts 不引用时钟（保证两次运行一致）
PASS test/static.test.ts :: static/11 测试目录可被 runner 发现且无空目录
PASS test/static.test.ts :: static/12 M0 冻结接口：cards/rules 的导出名恰好是 §2.7 契约（不夹带私有实现的导出）
PASS test/static.test.ts :: static/13 src/ai 只用投影信息：越界引用与运行时依赖一律为 0 命中
PASS test/webmin-dealer.test.ts :: dealer/01 rotate：庄家的下家接任（手推座位号）
PASS test/webmin-dealer.test.ts :: dealer/02 winner：单赢家通吃即该赢家坐庄
PASS test/webmin-dealer.test.ts :: dealer/03 winner：平局分池先给拿到余数的那位，无余数才按环形最近
PASS test/webmin-dealer.test.ts :: dealer/04 loser：非赢家中距庄家下家最近者；其离桌则环形顺延到下一家输家
PASS test/webmin-dealer.test.ts :: dealer/05 loser 档无在桌输家时退回轮庄（Q2 已裁定 A）
PASS test/webmin-dealer.test.ts :: dealer/06 三档都没有可留的座位时返回 null（调用方该收桌）
PASS test/webmin-dealer.test.ts :: dealer/07 createSession：三档都合法、默认 rotate、非法值抛 TypeError
PASS test/webmin-dealer.test.ts :: dealer/08 会话层：winner 档 ⇒ 每局庄家 = 上一局赢家
PASS test/webmin-dealer.test.ts :: dealer/09 会话层：loser 档 ⇒ 庄家来自上一局非赢家（除非无在桌输家）
PASS test/webmin-dealer.test.ts :: dealer/10 会话层：rotate 档仍是老行为（庄位逐局换人），且三档结果互不相同
PASS test/webmin-dealer.test.ts :: dealer/11 选庄不改钱：三档各自跨局守恒
PASS test/webmin-model.test.ts :: ui/01 createSession 建立座位、首局与台账
PASS test/webmin-model.test.ts :: ui/02 非法开局参数一律抛 TypeError
PASS test/webmin-model.test.ts :: ui/03 deriveSeed 确定、逐局不同、不用时钟
PASS test/webmin-model.test.ts :: ui/04 没轮到真人时点按钮 → 拒绝且状态指纹不变
PASS test/webmin-model.test.ts :: ui/05 真人+机器人打完一整局：走到结算，台账守恒
PASS test/webmin-model.test.ts :: ui/06 真人发起合法比牌恰好淘汰一家；期间确证首圈禁比挡过
PASS test/webmin-model.test.ts :: ui/07 乱点不崩：非法意图 ok:false 且指纹不变；整桌重来永远可点
PASS test/webmin-model.test.ts :: ui/08 再来一局：局号 +1、庄家轮转到下家、总额守恒
PASS test/webmin-model.test.ts :: ui/09 连打 12 局：每局有限步结束、总额恒定
PASS test/webmin-model.test.ts :: ui/10 机器人走 AI：只出合法意图、闷着不加注不比牌、注级抬高先转明
PASS test/webmin-model.test.ts :: ui/10b 机器人走 AI：强牌加注 / 同一副牌随赔率翻转 / 闷着遇高注级先转明
PASS test/webmin-model.test.ts :: ui/10c 未看牌的机器人决策与手牌无关（同一局面只换牌）
PASS test/webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
PASS test/webmin-model.test.ts :: ui/11b 整桌重来要请回破产离桌的人，并保留庄家规则档位（M2 实测抓到的两个缺陷）
PASS test/webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
PASS test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
PASS test/webmin-model.test.ts :: ui/14 分层边界：model 不碰 DOM/时钟/随机，app 不碰 node 内置也不自己判规则
PASS test/webmin-model.test.ts :: ui/15 页面接线：html 与各模块 import 路径都能被服务放行
PASS test/webmin-model.test.ts :: ui/16 一整局的可见性推进：局中暗牌、终局按规则亮
PASS test/webmin-model.test.ts :: ui/17 页面显示的牌型名与 classify 判定一致（且以看过牌为前提）
PASS test/webmin-model.test.ts :: ui/18 未看牌时 view() 全树序列化与座位行都搜不到真人牌面
PASS test/webmin-model.test.ts :: ui/19 结算信息一条不丢：每家的账就地进座位板，结算块只留原因与指纹（rev=7 ④的前提）
PASS test/webmin-model.test.ts :: ui/20 亮牌文本行：ASCII 记法逐张对得上，且只列真亮出来的牌（验收④给机器的读法）
PASS test/webui.test.ts :: ui3/01 层次：webui 只 import 彼此与 webmin/model，绝不直接碰引擎或 src
PASS test/webui.test.ts :: ui3/02 层次：只有入口层能碰 DOM；UI 侧一行规则判定都没有
PASS test/webui.test.ts :: ui3/03 bridge：开桌后快照结构化，未看牌 ⇒ 每一行都是隐藏位
PASS test/webui.test.ts :: ui3/04 bridge：三档庄家规则都开得出桌并回显在快照里
PASS test/webui.test.ts :: ui3/04b 页面接线：开桌控件与 StartOptions 一一对应，庄家三档不许在 M3 这一版丢掉
PASS test/webui.test.ts :: ui3/05 bridge：非法意图走引擎拒绝路径，计数与状态指纹都对
PASS test/webui.test.ts :: ui3/06 bridge：真人点看牌 ⇒ 只有自己那行亮牌，且快照里搜不到任何别家牌面
PASS test/webui.test.ts :: ui3/07 bridge：把一局打完 ⇒ 结算区有内容、日志在长、桌上总额守恒
PASS test/webui.test.ts :: ui3/08 scene 是纯函数：同一输入两次布局逐字节相同
PASS test/webui.test.ts :: ui3/09 scene 布局不变量：命中区与按钮一一对应、互不重叠、都在画布内（三种视口）
PASS test/webui.test.ts :: ui3/09b 低于最小视口时不做布局、只画提示，且不留下任何可点区（不装作能玩）
PASS test/webui.test.ts :: ui3/09c 竖向预算先给牌桌：候选 10 个时按钮条至多 3 行，座位板照旧不挤不越界（变异 U05 复发哨）
PASS test/webui.test.ts :: ui3/10 scene 命中测试：中心与四条边角都算命中，边界外 1px 不命中
PASS test/webui.test.ts :: ui3/11 scene 不泄露未看过的牌：开局整棵图元树里没有任何牌面字符
PASS test/webui.test.ts :: ui3/11b 看牌前后：整棵图元树从 0 张牌面变成正好 3 张（且就是本人那手）
PASS test/webui.test.ts :: ui3/12 paint 只执行图元：假 ctx 下调用次数与图元数一一对应
PASS test/webui.test.ts :: ui3/13 静态服务放行 webui（不装 vite 也跑得起），根路径仍指向 M1.5
PASS test/webui.test.ts :: ui3/14b 没轮到真人时"整桌重来"仍报合法（U01 复发哨：灰按钮不许谎报会被拒）
PASS test/webui.test.ts :: ui3/15 翻牌动画：进度过半之前一张牌面都不许出现，之后才亮
PASS test/webui.test.ts :: ui3/16 动画进度是纯入参：同一 (快照, anim) 两次布局逐字节相同；不给 anim 时直接终态
PASS test/webui.test.ts :: ui3/17 没配 since 的座位视为已翻开；换局后重新亮牌的座位会重新起算
PASS test/webui.test.ts :: ui3/14 灰按钮点了必被引擎拒（验收③在 M3 侧的等价形态）
PASS test/webui.test.ts :: ui3/18 牌面放大：每张亮牌 ≥48×64、点数 ≥18px，本人手牌再大一档（工单 rev=7 ①）
PASS test/webui.test.ts :: ui3/19 2–6 家都排得开：座位板数量对得上、互不重叠、不越界、不压按钮（工单 rev=7 ②）
PASS test/webui.test.ts :: ui3/19b 极端候选数下只许二选一：要么明说装不下，要么座位板/按钮/底部条互不重叠（不许硬排）
PASS test/webui.test.ts :: ui3/20 结算块不许盖住任何一张亮出来的牌（牌刚亮完就被盖住 = rev=7 要修的老毛病）
PASS test/webui.test.ts :: ui3/21 顶栏不许被牌桌盖住：状态行是整句，被木轨吃掉就等于丢信息（rev=7 实测缺陷复发哨）
PASS test/webui.test.ts :: ui3/22 按钮文案一个字都不许丢：折行只改行数，且每行都得待在自己那颗按钮里
PASS test/webui.test.ts :: ui3/23 牌角不许爬到邻牌脸上：每个点数/花色图元必须待在"自己那张牌露出来的那一条"里
PASS test/webui.test.ts :: ui3/24 桌面中央的"亮牌"文本行：每张亮牌都在里面、字号够读、且不压任何座位板

=== NOTES (fixed vectors, recompute-able independently) ===
AI-CALIB max|est-true|=0.3pp over 24 anchors
AI02 tier-percentile max diff=0.27pp
AI09 compare=1/200 组（其中有资格比牌的才 9 组）
AI12 trigger=14.6% over 1000 seqs
CANONICAL mulberry32 seed=1 float_first=0.6270739405881613
CMP 2S 2D 9C vs 3S 4D 5C = -1
CMP 2S 3D 4C vs AS KS QS = -1
CMP 4S 9S JS vs AS 2S 3S = -1
CMP 9S 9D 2C vs 9C 9S 2D = 0
CMP AS 2S 3S vs QD KC JS = 1
DEAL seat=0 hand=T♠2♠J♠ tier=flush ranks=[11,10,2]
DEAL seat=1 hand=5♠9♣J♥ tier=highCard ranks=[11,9,5]
DEAL seat=2 hand=3♠6♦A♦ tier=highCard ranks=[14,6,3]
DEAL seat=3 hand=6♠K♥7♣ tier=highCard ranks=[13,7,6]
DEAL seat=4 hand=2♥7♠T♣ tier=highCard ranks=[10,7,2]
DEAL seat=5 hand=Q♥J♣7♦ tier=highCard ranks=[12,11,7]
DEALER08 winner 0>2=>2 2>0=>0 0>1=>1 1>0=>0 0>0=>0 0>3=>3
DEALER09 loser hands=6 fallback=0
DEALER10 rotate=0,1,2,3,0 winner=0,2,0,1,0 loser=0,1,3,1,2
ENUM a23off actual   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off anchor   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off closed   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM classic actual   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic anchor   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic closed   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
FUZZ-ILLEGAL probes=3645 rejected=3247
FUZZ-ILLEGAL4 probes=15589 not_current_turn=5592 cannot_afford=2796 bad_target=2921 compare_forbidden_before_first_actions=2672
FUZZ-MODE reasons=oneLeft,stakeCap,stall
FUZZ-ai hands=1000 maxSteps=17 decisions=9262 look=1231 compare=117 有比牌的局=113 reasons=oneLeft=300 stakeCap=42 stall=658
FUZZ-random hands=1000 maxSteps=22 decisions=0 look=0 compare=0 有比牌的局=0（decisions/look/compare 只统计 decideAi 的决策，随机臂不经过 AI ⇒ 恒为 0，不是"随机臂不打比牌"） reasons=oneLeft=755 stakeCap=233 stall=12
FUZZ200 maxSteps=19 reasons=oneLeft=169 stakeCap=27 stall=4
HASH seed11-3calls=c654f607d89ce8c9
REPLAY cap seed=1 hash=03adaa7bef0f0d99
REPLAY cap seed=2 hash=2d3f6f85ce3ae82f
REPLAY cap seed=5 hash=0966c43c35d04a96
REPLAY foldout seed=1 hash=f6ebdc809abcb74a
REPLAY foldout seed=2 hash=aceb2772ab74efc0
REPLAY foldout seed=5 hash=096e62b78da9c34d
REPLAY stall seed=1 hash=1730bb61755d018f
REPLAY stall seed=2 hash=80606e936d104725
REPLAY stall seed=5 hash=286b96c25face2b4
SCRIPT02 seed=1 loser1=2 loser2=0
SCRIPT05 seed=1061 pot=13 shares=7,6
SCRIPT06 seed=622 tie hands: 1=[{"rank":8,"suit":1},{"rank":14,"suit":0},{"rank":7,"suit":3}] 2=[{"rank":7,"suit":1},{"rank":8,"suit":2},{"rank":14,"suit":3}]
SEED base=20260925 h1=3776361071 h2=1243603819
SETTLE seed1-stall chips=96,108,96 pot0 total=300
SHUFFLE-FAIR trials=20000 expected=384.61538461538464 min=331 max=431
SORT1000 seed=20260925 ties=2182 first=[{"rank":10,"suit":3},{"rank":10,"suit":1},{"rank":10,"suit":0}]
TRANS full_triples=94196375 implied_triples=47201700
UI05 steps=5 结束原因：同一注级下各家各完成 3 次行动 → 强制开牌
UI06 合法比牌达成，且首圈禁比确凿生效过
UI07 rejected=7/7
UI09 hands=12 total=768 over=null
UI10 botSteps=253 raise=10 call=110 fold=43 look=77 compare=13
UI11 收桌于第 3 局：只剩 1 家还付得起底注（最少需要 2 家），牌局结束
UI16 reason=stall
UI19 待结算样本：phase=awaitingSettle 赢家=1
UI20 亮牌：你 8C 3S KS 单张 / 电脑1 5S TC 5H 对子 / 电脑3 QS 3H 7D 单张
UI307 结算行=5 日志行=12 点击=3 被拒=0
VECTOR mulberry32 seed=1 first8=2693262067,11749833,2265367787,4213581821,4159151403,1207330352,2632122864,3095568220
VECTOR mulberry32 seed=2 first8=3153583793,1395857638,1225337227,2310499808,3759333107,2709408573,2144054433,1534354113
VECTOR mulberry32 seed=4294967295 first8=3850105811,813802916,3073704848,4054706436,3630262831,2315588663,2922715533,2042566601
VECTOR shuffle seed=1 first12=TS 2S JS 5S 9C JH 3S 6D AD 6S KH 7C
VECTOR shuffle seed=1 last6=2D 3C QC KC 8D 4H
frame/15 握手向量 = RFC 6455 §1.3（SHA-1 + GUID 258EAFA5-E914-47DA-95CA-C5AB0DC85B11）
frame/17 64 位长度三臂：非最小拒 / 66000 字节合法帧解通 / 0x10000 声明走"等数据"分支
leak/01 按 seed 独立复算三家的牌面，逐条扫描"别人看到且尚未亮牌"的下行（96 次检查）：零命中
leak/02 结算视图前扫描 36 条下行：种子字段/种子数字零命中；揭示前份额明文零命中
leak/04 抖动重连 8 次之后仍与稳定路径逐条收敛
netx/02 SHA-256 与 node:crypto 差分 208 条输入全部一致
netx/08 SHA-1 与 node:crypto 差分 202 条一致；握手向量 = RFC 6455 §1.3
nst/07 依赖面：dependencies={}，devDependencies=@types/node,typescript,vite
nst/09 M4 测试文件 12 份：netx-client.test.ts, netx-crypto.test.ts, netx-fixtures.ts, netx-frames.test.ts, netx-leak.test.ts, netx-netplay.test.ts, netx-protocol.test.ts, netx-room.test.ts, netx-seed.test.ts, netx-serve.test.ts, netx-static.test.ts, netx-ws.test.ts；时钟例外只给 netx-ws.test.ts / netx-serve.test.ts（仅看门狗）
nst/10 扫 webui 全部 5 个 .ts：价格算式只在 webui/netplay.ts，其内 priceOf 只调一次、三档按钮都从它取数
nst/12 标签「在场筹码+池」：文案①渲染②过滤③入口④四道判据互锁，三组对照各命中一条（webui/webmin/netx/src 共 24 个 .ts 被扫）
nst/13 两条 log 分支同为 40 行上限，notices 窗口 6 ≤ 上限；两组对照各命中一条，另钉住 netx-ws 的时钟例外仍是 3 处
nui/01 快照 20 个字段两边一致；联机快照排版出 39 图元 / 0 命中区
nui/03 两整手：第 1 手池 0，第 2 手庄家=座位1，终局台账 512
nui/04 未看牌 / 别家牌面 / 开牌之后三个阶段各自都拿整棵快照搜过（含正、反向对照）
nui/05 三类可见反馈各自可辨认：伪造下行→停手；leak_blocked→漏牌；replaced→顶号
nui/06 三条重连形状各自真实走到：断线→(seq,now] 增量、同局刷新→(0,now] 增量、跨局→全量快照；台账全程守恒 512
nui/07 per-tab 存储各占一座；换成共享存储时"甲"被接回座位1（=乙的座位）
nui/08 UI 日志里 6 条 timeout→call；末条：#007 call      甲 出 1 @注级1｜timeout→call dark×stake
nui/09 按钮只列候选意图；cost 恒 null；不轮到自己时全灰且发不出去
nui/10 份额随凭据存住 ⇒ 刷新重连后局末核对照样通过，且服务端不再向它重复收份额
nui/11 (a) 三种行动各自对账通过：raise=4@注级1 / call=4@注级2 / compare=4@注级2
nui/12 (b) 注级 1：闷 1 → 明 2，两个数都由 priceOf 现算
nui/13 (c) 穷座筹码 1 对 8 的跟价：仍可点、发得出、服务端拒、页面照实说
nui/14 (d) 两条路对同一 state 逐按钮相等：25 次、11 种组合
nui/16 入口层只有接线与显示：netx 进口为零，规则与价格的判定面全在别处
nui/17 模块图 19 个文件全部可达，其中 netx 只有 4 个：netx/client.ts, netx/protocol.ts, netx/seed.ts, netx/sha256.ts
nui/18 bad_token ⇒ 清存储 + 提示 + onText 自己产出 join（一次），哑管道端到端也真把局面接回来了
nui/19 判据只认墙校验过的 errors：非法报文不清凭据不发上行；停手的那一世也不发；干净的那一世才自动重入桌
nui/20 compare_forbidden_before_first_actions 上屏后，下一个被接受的行动把它换下了提示行，审计面仍留着 1 条
nui/21 入座 / 没交份额 / 挪庄三类 notice 都进了日志区，键集与 40 行上限不变
nui/22 在场=512、房间整本=768（差额 256 = 离桌那一家），标签「在场筹码+池」与过滤同口径
nui/23 座位格主路径三个时刻各比对 27 项，牌面/等级/筹码/状态/结算文案全部由 view 那一行推出（甲0、乙1、丙2）
nui/24 patch 上塞别家牌面 ⇒ 当场抓到（1 条越界）、投影不采纳、页面塌成"已停手"、act 发不出去；同工装下的合法 patch 零误伤
nui/25 的 seq 面：重放同一条 patch 当场被抓；揭示核对仍然只认份额与承诺
nui/26 坏 JSON 降级为"没有凭据"、入桌照常、新凭据写回；对照：合法凭据能构造 resume
nui/27 六种 patch 数字注入各被恒等式抓住：(a) 抓 pot/committed，逐座位恒定抓两家 chips 与"committed+pot 一起改"那一支，(d) 抓凭空多出来的假座位；被拒帧不采纳，页面停在已停手
nui/28 诚实流量 144 次逐帧采样、0 处误报；三家都核对通过（靠放宽检查换绿会在这里露馅）
nui/29 停手粘在标签页上：重连仍停手、joinWire/换 URL/再重连都不清、再抓 count 递增 first 不变、按钮塌同一条出口、新标签页干净
nui/30 标签页账：坏 JSON/形状不对一律降级成"没有"，合法账照实停手并报次数；与凭据那把键互不牵连
proto/01 上行 6 条 / 下行 10 条往返保真且字节稳定
proto/06 net 拒绝码 5 个全部会被真正发出：bad_hand, no_seat, not_dealt, bad_nonce, nonce_late
proto/12 出口编码：6 类非法消息全部在本地被拦（服务端不能只约束客户端）
proto/13 parse() 两条报错口径互不混用：非文本非对象 / 坏 JSON / schema 缺 key 各归各
room/07 全程托管 ⇒ 六次 timeout→call、零弃牌、终局 stall；三家版见 timeout/01
room/11 三局庄家轮转 0→1→2；结束时 0:249 1:256 2:263
room/16 2~6 家全部靠"看牌+跟注"走到强制开牌，无违规、无 fault
room/17 缺席完全局的重连：承诺/快照/揭示三件齐补，种子核对通过
room/18 每一阶段的待发定时器数量恒为 1（nonce/回合/结算表都被正确取消）
room/21 应用层心跳：三条 ping 各自回显，局面一字未动（3 条 pong）
room/26 连接清单 = A2, B3, C2, a10, c1, c10（码点序；locale 序会是 a10, A2, B3, c1, c10, C2）
room/28 到点开不齐人 ⇒ 本局作废 + 局号不回卷 + 台账零扣减；重开后份额重新收
room/29 庄家缺席 ⇒ 挪到座位1、牌局开出来、进程没炸；缺席家筹码原样
seed/11 合成 seed=1498111553（份额明文见 netx-seed.test.ts 顶部 SHARES）
seed/11 固定向量 hand=1 shares=[seat:0:49af21ae…, seat:1:4ec39f40…, seat:2:e4aa43f9…, server:12be698b…]
seed/12 4096 组份额合成 4096 个互不相同的种子，最大值 4294600091
seed/13 码点序=A,Seat:10,a,seat:2,server / locale 序=a,A,Seat:10,seat:2,server ⇒ 向量取前者，权威路径同键（seed=3577986836）
seed/14 前缀相撞的 party 名：权威 = 向量 = seat:1,seat:10,seat:2,server（seed=2391714912）
srv/02 真 socket 走完一手：19 步，两家各自核对通过（端口由内核挑，不印进输出）
srv/05 默认端口 8790：进程与页面两处一致；存储与熵源口径也钉住
srv/06 入口面：横幅原样印出 http://127.0.0.1:〔内核端口〕/webui/ 且跟到底就是联机页；/ 仍 302 到 M1.5（映射未动）
srv/07 四发畸形转义全部 400、%00 与越界 403 档位不变、事后合法路径仍 200（进程存活）
srv/08 ENOENT 与 src 下不存在都 404（带原因、纯文本、no-store），对照组 /webui/index.html 仍 200
timeout/06 托管与自主跟注只差 note：timeout→call seen/dark×stake vs dark×stake
ws/01 真实 socket + Node 内置 WebSocket 客户端跑完一手牌：11 个 seq，三家各自核对通过
ws/04 断线期间牌局由托管走完；重连后 seq 从 0 追到 9，揭示核对通过
ws/05 9 条非法握手各自被拒（400/404/426 按来源分档），零连接残留
ws/06 控制帧：ping(122,104,33,0,255) 原样回显、零长度边界、客户端 pong 不回声（管道里恰好一个 pong）、非法帧 1002
ws/07 钩子抛 ⇒ 500 + 原文；/health 与真握手照常；钩子自己应答时 203/404 两档不受影响
ws/08 4 种 Connection 写法全部由 Node 层答 404（正文即判据），我们那三行 400 在本机 Node 上按构造不可达
ws/09 三条可达 guard 的正文互不相同、426 另有自己的正文，且 Node 自己答的那一发仍是零正文 ⇒ 400 归因不再需要覆盖差分

RUNNER files=29 cases=414
SUMMARY pass=414 fail=0 total=414
RESULT=ALL_PASS
```

# 12 · rev=12 定点返修（rev=11 裁定的必修 1 项 + 应修 4 项 + §8 那八条验收口径）

> 本轮范围：`rev=11` 裁定的**必修 1**（`patch` 上的数字篡改抓不到，而 `nui/25` 把"抓不到"写成"客户端无法独立核对"）
> 与**应修 1–4**（三处文书、握手 400 不可归因、collect 分支缺上限、以假前提写成的披露行），
> 外加 §8 八条口径。批准范围不推进：M5 两轮均未通过，本轮仍是返修。
> 撤回两处：`ws.ts:163-167` 由复审独立实测确认为按构造不可达（我 rev=11 的说法对，他们的 §8.12(ii) 那半句已撤回 X）；
> `netplay.ts:398-419` 不是"主路径"而是 K5 兜底（措辞是复审自己改判的），本轮文书按此改写。

## 12.1 命令、退出码与 §0.5 双跑哈希

| # | 命令 | 结果 |
|---|---|---|
| 1 | `node test/run.ts` | exit=0，末三行：`RUNNER files=29 cases=412` / `SUMMARY pass=412 fail=0 total=412` / `RESULT=ALL_PASS` |
| 2 | 同一条紧接着再跑一次 | exit=0，输出与第 1 次**逐字节相同** |
| 3 | `npm test` | exit=0，同上 |
| 4 | `npm test` 再跑一次 | exit=0，与第 3 次逐字节相同 |
| 5 | `npx tsc --noEmit` | exit=0，零诊断 |

```
node test/run.ts  →  .scratch/r12-run-node1.txt ≡ .scratch/r12-run-node2.txt   （cmp 逐字节相同，两次 exit=0）
  4be8a6cc5dc72df1425002d9dd7bdb929ff924ff2006d3b5f667009896137217  .scratch/r12-run-node1.txt
  4be8a6cc5dc72df1425002d9dd7bdb929ff924ff2006d3b5f667009896137217  .scratch/r12-run-node2.txt
npm test          →  .scratch/r12-run-npm1.txt  ≡ .scratch/r12-run-npm2.txt    （cmp 逐字节相同，两次 exit=0）
  4db779a494008df972b55082c8b1cccdabed88fb171c5e0124b6951f63b2308f  .scratch/r12-run-npm1.txt
  4db779a494008df972b55082c8b1cccdabed88fb171c5e0124b6951f63b2308f  .scratch/r12-run-npm2.txt
```

## 12.2 §8.6 零回归与本轮用例

```
$ grep '^PASS ' .scratch/r11-run-node1.txt | sed -E 's/^PASS ([^ ]+) :: ([^ ]+).*/\1::\2/' | sort > .scratch/r11-ids-extract.txt
$ grep '^PASS ' .scratch/r12-run-node1.txt | sed -E 's/^PASS ([^ ]+) :: ([^ ]+).*/\1::\2/' | sort > .scratch/r12-ids.txt
$ comm -23 .scratch/r11-ids-extract.txt .scratch/r12-ids.txt        # 丢掉的 ⇒ 必须为空
（空）
$ comm -13 .scratch/r11-ids-extract.txt .scratch/r12-ids.txt        # 本轮新增
test/netx-netplay.test.ts::nui/27
test/netx-netplay.test.ts::nui/28
test/netx-static.test.ts::nst/13
test/netx-ws.test.ts::ws/09
```

基线 = rev=11 交付时的 408 条 ID（机械抽取，不是手抄），本轮 412 条：**一条没丢、净增 4 条**，
新增全部用新编号，`nui/25` 是**改写而编号保留**（§8.2），`client/10` 是**加强既有条**而不是复用编号装新内容。

**基线文件自身的一处缺陷，我一并修在这里**：`.scratch/r11-ids.txt` 只有 406 行 —— 它是在 `nui/26`、`srv/08`
两条落地**之前**生成的，所以拿它当 rev=11 的 408 条基线会漏比两条（`comm -23` 仍会为空 ⇒ 结论侥幸没错，
但判据是松的）。本轮从 rev=11 的原始运行产物 `r11-run-node1.txt` 重新抽出 `.scratch/r11-ids-extract.txt`
（408 行）作为规范基线，**旧文件原样保留不删**。抽取里 3 个 key 各出现两次（`classify/a23off`、`classify/classic`、
`classify/归一化键` —— 同名的参数化用例），rev=11 与 rev=12 两边完全一致，不影响 `comm` 的判据。

本轮新增/改写各自钉的口径：

| 用例 | 钉的是哪一条口径 |
|---|---|
| `nui/27`（新增） | **必修 1 的正面对手戏**：六种"真发下来过、会话还没见过"的 `patch` 注入 —— `pot+100`、我的 `chips+100`、我的 `committed+100`、别家 `chips+100`、**`committed` 与 `pot` 一起改**（故意让 (a) 放行）、**凭空多塞一个假座位**（只有全桌恒定能抓）。每支都断言：抓到的判据指名是哪条恒等式破了、`untrusted=true`、被拒那一帧**不进快照**（`snap.pot` 停在上一帧的好数字）、按钮塌成"已停手"、`act()` 返回 `sent:false`；再把同一条 patch 的**诚实原件**喂回去 ⇒ 仍接得上 seq 并被采纳（"被拒"不许吞 seq）；另一家零越界 |
| `nui/28`（新增） | 复审 §3 用例要求 ①的无头版：三手真房间流量、看牌/跟注/加注/比牌轮着来，**逐帧**断言 `violations` 恒空 + 采样数下限（实测 144 次采样、0 处误报；下限钉在 60，防"靠放宽检查换绿"） |
| `nui/25`（改写，未删） | 原来那条"改 chips/pot 抓不到 —— 客户端无法独立核对"是**假边界** ⇒ 改写成本轮只有它能钉的两件事：合法增量确实被采纳、同一条 patch **重放**被 seq 那道闸抓住、被拒的帧不进快照。数字那一面交给 `nui/27`/`nui/28` |
| `ws/09`（新增） | 应修 2：三条**可达** 400 的正文两两不同（`upgrade header missing` / `sec-websocket-version missing` / `sec-websocket-key invalid`）、426 另有 `version not supported`；**对照组**是 Node 自己答的两发（obs-fold 折行、坏请求行）仍然零正文 ⇒ 我们的正文与它必然不同，归因不再需要覆盖差分；够不到的那一条（`netx/ws.ts:179-181`，`Connection` 缺 upgrade）的正文钉在源码上，五者互不相同 |
| `nst/13`（新增） | 应修 3：`netplay` 两条 `log:` 装配语句必须**同一个**上限、`notices` 窗口 ≤ 上限、两组正向对照（摘掉上限 / 把窗口撑到 999）各命中一条；另钉住 `test/netx-ws.test.ts` 的 `setTimeout` **精确** 3 处（`nst/09` 的例外是按下限给的，悄悄加看门狗会把例外面撑宽） |
| `client/10`（对照支） | 同一位旁观者：合法投影零越界，而 `pot` 被 +100 的那一条**必须**被抓且投影不被采纳。这一条的夹具本轮被改过（旧夹具是"两家投影删掉 0 号位"，算术上不成立 ⇒ 诚实房间发不出那种投影），见 12-D 第 4 项 |
| `nui/24` / `proto/07` / `proto/08` / `leak/05` | 牌面那一族原样保留（§3 用例要求 ③：不许在改写中被打散）；变异 M13 复跑仍被这四条一起抓 |

## 12.3 变异扫描：本轮新增 8 条 + rev=11 受影响门复跑 10 条（合计 18 条）

工装与 rev=10/11 同一套（`.scratch/r12-mutate.mjs`、`.scratch/r11-mutate.mjs`）：单锚点就地打坏 → 全量跑 → 还原并核对 sha；锚点命中 0 次或多次 ⇒ 判 SKIPPED。
M03/M04/M05 未复跑：它们打的是 `netx/serve.ts`、`webmin/serve.ts`、`webui/scene.ts`，这三个文件本轮一个字没改；
其余十条（`netplay` 5 条、`client` 2 条、`ws` 2 条、`protocol` 1 条）本轮都改了宿主文件 ⇒ 全部复跑。

### 本轮新增的 8 条

| id | 打坏的是什么 | 抓到它的门 | 结果 |
|---|---|---|---|
| N01 | 摘掉恒等式 (a)：`pot` 与 Σ`committed` 不再对账 | `nui/27`（并带 `client/10` 的注入对照支） | caught |
| N02 | 摘掉**逐座位**手内恒定：改某一家的 `chips` 不再被发现 | `nui/27` | caught |
| N03 | 摘掉全桌恒定 (d)：凭空多一个假座位不再被发现 | `nui/27` 的 `extra-seat` 那一支 | caught |
| N04 | 撤掉 `settled` 守卫：诚实流量在结算那一帧被误判成越界 | **`nui/28` 在内，共 21 条红**（`client/02·06·11`、`leak/01·03·04`、`nui/03·06·08·10·23·25·28`、`room/06·07·11·14·17`、`srv/02`、`ws/01·04`） | caught |
| N05 | collect 分支的日志又不封顶了（应修 3 的原形） | `nst/13` | caught |
| N06 | 两条握手 guard 的正文并回同一句（应修 2 要治的病） | `ws/09` | caught |
| N07 | **`patch`** 被拒的帧照样落进 `view`（墙抓到了却不告诉渲染层） | `nui/27`（并带 `client/04`、`client/15`、`nui/24`） | caught |
| N08 | **`view`（快照）**被拒的帧照样落进 —— 与 N07 对称的另一条分支 | `client/10` 的对照支（命中 1 条，正是它） | caught |

**N07 那一次我把期望写错了，写在这里而不是改掉**：期望列原本写的是"`nui/27` + `client/10` 的对照支"，
实得里没有 `client/10`。原因不是那条用例没有牙，而是**它盯的是另一条分支** —— `client/10` 注入的是
`t:'view'`（快照），走 `client.ts:277-283`；N07 打坏的是 `case 'patch'` 里 `:290-296` 那一道。
⇒ 本轮补了 N08 专门打快照那一条分支，`client/10` 的"被拒的投影不许被采纳"由它钉；
两条分支各自的"不采纳"现在都有变异盯着，不再混为一谈。

**N04 这一条是本轮炸得最广的**（21 条红）：撤掉 `settled` 守卫之后，凡是跑到结算那一步的流量全被误判成越界 ⇒
判据 `nui/28` 翻红的同时，老面（`room/*`、`ws/01`、`srv/02`、`leak/*`）一起响。
这也是"正向对照"真正有牙的证据 —— 不是只有一条新用例盯着它。

### rev=11 那 13 条里宿主文件被改过的 10 条：全部复跑

| id | 打坏的是什么 | 抓到它的门 | 结果 |
|---|---|---|---|
| M01 | `netx/ws.ts` 的 500 兜底降级成 400（复审明令"别顺手改成 400"那一档） | `ws/07` | caught |
| M02 | `netx/ws.ts` 兜底不再带异常原文 | `ws/07` | caught |
| M06 | 只把 `departed` 过滤摘掉而不改标签（裁定点名的"不接受的改法"） | `nst/12` | caught |
| M07 | 离桌占位格不说"本局不参与" | `nui/22` | caught |
| M08 | collect 那段日志区不含服务端说明 | `nui/21` | caught |
| M09 | 主分支日志区不再并 `notices` | `nui/21` | caught |
| M10 | 发出新行动后不清 `lastReject` | `nui/20` | caught |
| M11 | `rejects` 审计面不再累积 | `nui/20`（并带 `room/04·05·12·20·24`） | caught |
| M12 | 座位格的 `resultText` 恒空 | `nui/23` | caught |
| M13 | `checkViewLeak` 只认揭示、不认投影里的别家牌面 | `nui/24`（并带 `leak/05`、`proto/07`、`proto/08`） | caught |

合计：**本轮 8 条 + 复跑 10 条 = 18 条，18 caught / 0 survived / 0 还原失败**。
（N07 第一次跑出 SKIPPED，是锚点缩进写错 ⇒ 工装拒绝执行；改对之后 caught。过程写在上面。）
`M03/M04/M05` 未复跑的理由写在 12.3 开头：它们的宿主文件本轮一字未动（`netx/serve.ts`、`webmin/serve.ts`、`webui/scene.ts`）。


### N07 第一次跑成 SKIPPED —— 是工装判对了，不是"改不动就算了"

N07 那条变异（把 `patch` 分支的 `if (why !== null) violate(...); else {` 换成 `if (true) {`）
第一次跑出 **`SKIPPED：锚点命中 0 次`**：我把锚点里三行的缩进写成 10 个空格，源码里是 12 个。
工装按既定规则拒绝执行（既不"就近找一个像的地方改"，也不给个 caught），改对锚点后单跑：`caught`。
这一条记在这里，是因为 rev=10/11 立过的口径就是"锚点打不中 ⇒ 判 SKIPPED，绝不静默跳过"。

### 命中列表不再截断（一件工装缺陷）

第一版把 FAIL 行截到前 8 条打印。N04（撤掉 `settled` 守卫）恰恰是一条门炸出十几条红的那种，
截断之后**期望的那条 `nui/28` 被切掉了** ⇒ 我原先"变异 N04 正是被 `nui/28` 翻红"这句话在报表里拿不到证据。
现在改成不截断并打印命中条数（`.scratch/r12-mut-n04.txt` 是改完之后的重跑），下表按重跑结果记。


## 12.4 覆盖 oracle v4（脚本 = 监督方 `.audit/rev11/sup-cov-final3.mjs`，原样、只读）

```
NODE_V8_COVERAGE=.scratch/r12-cov node test/run.ts
node .audit/rev11/sup-cov-final3.mjs .scratch/r12-cov      # → .scratch/r12-cov-report.txt
```

| 量 | rev=11（复审的读数） | rev=12（本轮同一脚本） |
|---|---|---|
| 全局 | 22 文件 / 43 段 / 5625 行覆盖 5484 = 97.5% | 22 文件 / **43 段** / **5683 行覆盖 5543 = 97.5%**（可执行行 +58 = `checkMoney` 那 33 行 + `refuseUpgrade` 那 11 行 + `netplay`/`ws` 的注释与守卫行） |
| `netx/client.ts` | 333/338 = 98.5% / 2 段 | **379/384 = 98.7% / 2 段** —— 新增的 `checkMoney` 整段都进了覆盖（两条未覆盖段仍是老面孔：合并后条数自检 `:166-167`、`exhausted: never` `:353-355`） |
| `netx/ws.ts` | 225/236 = 95.3% / 4 段 | **236/246 = 95.9% / 4 段** —— `refuseUpgrade` 本体已覆盖，未覆盖那四段仍是 K5/K8 老账（`:179-181` 那一档随 `Connection` 守卫一起漂过去了，见下面的自检 A 行漂移） |
| `webui/netplay.ts` | 502/522 = 96.2% / 3 段 | **504/524 = 96.2% / 3 段** —— `.slice(-40)` 那行在 collect 主路径上，已覆盖 |

三条地面真值自检按 §8.5 的新期望值核对：原样跑是 **A=`1111` / B=`1111111` / C=`12222222` / D=`11111`，
`ORACLE_SELFCHECK_OK` 四条全对**；但 **A 那一条本轮是行漂移造成的假绿**（见本节末），重标定到 `ws.ts:162-164`
之后读到 `111`，结论"ws/07 真打到了 500 兜底"照旧成立。
逐段披露（43 段、一行一段）与理由写在 `SELF-REVIEW.md` 的 **12-F**；
应修 4 要求的"以'客户端无法独立核对'为前提的旧理由"已在 12-F 里点名作废并改写。

**自检 A 本轮发生了行漂移，我没有拿它当"覆盖变好了"**（这正是 final3 头部警告、rev=11 的 C 条栽过的那个失效模式）：
final3 把 A 的行号**写死**在 `netx/ws.ts:146-149`，而应修 2 在同一个文件里新增了 `refuseUpgrade()`，
500 兜底那三行漂到 `162-164` ⇒ 146-149 现在落在 `/health` 的 JSON 体上（本来就全覆盖），
原样跑出来的 `A 期望 1111 实得 1111 OK` 因此是**假证据**。我没有改他们的脚本（`.audit/` 只读），
而是生成一份**逐字副本**（`.scratch/r12-mk-covcopy.mjs` → `.scratch/repin/r12-cov-repin.mjs`，diff 只有 A 那一行）
把锚点重标定到 `162-164`：

```
$ node .scratch/repin/r12-cov-repin.mjs .scratch/r12-cov > .scratch/r12-cov-report-repin.txt
  A netx/ws.ts:162-164  期望 111  实得 111  OK        ← ws/07 真打到了 500 兜底（结论没变，变的是证据的行号）
$ diff .scratch/r12-cov-report.txt .scratch/r12-cov-report-repin.txt
228c228
<   A netx/ws.ts:146-149  期望 1111  实得 1111  OK
---
>   A netx/ws.ts:162-164  期望 111  实得 111  OK
```

⇒ 两份报告只差 A 那一行 ⇒ 上表的合计读数与逐段披露**不受重标定影响**。
另外记一笔与 §8.5 文字不符的地方（不改口，请你对着脚本判）：裁定写"B 的期望值改为 `1111011`"，
而 `sup-cov-final3.mjs` 里 B 条的 `want` 实际是 `has1`，本轮实得 `1111111`（`netx/serve.ts:83-93` 整段都刷出来了）。

## 12.5 探针：恒等式的成立区间是量出来的

`.scratch/r12-invariants.ts`（不入 manifest、不在 `test/` 下）跑 6 手 × 3 家：看牌、跟注、加注、
比牌淘汰、弃牌、托管到点、结算、换手全部走到，逐帧记录 (a)(c′)(d) 三条恒等式与在座/存活集合。

```
$ node .scratch/r12-invariants.ts        # 全文 .scratch/r12-invariants-out.txt
### 甲：帧=77 墙内 violations=0 非settled不符=0 settled合法豁免=13 存活标记跳变=11
### 乙：帧=78 墙内 violations=0 非settled不符=0 settled合法豁免=14 存活标记跳变=11
### 丙：帧=77 墙内 violations=0 非settled不符=0 settled合法豁免=15 存活标记跳变=11

房间末态 phase=betting hand=7 over= fault=
采样总数=232 非settled不符=0 settled豁免=42 墙内violations=0
  自检 PASS 非 settled 相位零不符（检查本身有效 ⇒ 见下一条）
  自检 PASS settled 豁免非空（拿掉守卫就会翻红 ⇒ 豁免不是空转）
  自检 PASS 墙（真 client.ts）在同一段流量上零 violation
  自检 PASS 采样量够大（≥180 帧，防"跑了两帧就宣布零不符"）
PROBE_SELFTEST_PASS
```

⇒ 结论：`betting` 与 `awaitingSettle` 全程 0 处不符，**只有 `settled` 那一帧合法地破**
（池分发完毕归零，而 `committed` 记的仍是本手投入、赢家余额同时进账）；弃牌/淘汰只改 `active` 标记、
不动 `chips/committed` ⇒ 手内恒定不受影响。这条实测就是 `checkMoney` 里那句
`if (v.phase === 'settled') return null;` 的依据，也是 `nui/28` 对照的预期值。

**这件工装的自检第一次是 FAIL 的，我把它写在这里而不是删掉那次运行**：初版把三类账混成一个"不符"数，
于是 `settled` 那一帧的合法豁免和"存活标记跳变"（弃牌/淘汰造成的 `0,1X,2`）都被算成不符，
跑出来 `不符总数=75` + `PROBE_SELFTEST_FAIL`。按工单"测试脚本自身先被验证"的口径，
**错的是工装的分类，不是数据**：现在分成 `bad`（非 `settled` 不符，期望 0）/ `exempt`（`settled` 豁免，
期望 **>0**）/ `notes`（存活标记跳变，只是注记）三本账，并把自检从一条恒真判据换成四条互相牵制的判据 ——
其中 `exempt > 0` 专门用来防止"把守卫写成永不命中的空转"，`wall === 0` 是拿真 `client.ts` 在同一批流量上
做独立对照（探针与交付代码两套实现、同一个结论）。

## 12.6 `npm test` 完整输出（第 1 次运行原文）

```

> zjh@0.0.0 test
> node test/run.ts

=== ZJH TEST REPORT (deterministic) ===
PASS test/ai-honest.test.ts :: ai/01 牌力先验表 = 22100 手全枚举的事实
PASS test/ai-honest.test.ts :: ai/02 分位表按 classic 写死，但 a23off 下的偏差 < 2pp（所以表可以不分 preset）
PASS test/ai-honest.test.ts :: ai/03 牌力分位单调，且跨档不倒挂（弱档最强手 <= 强档最弱手）
PASS test/ai-honest.test.ts :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）
PASS test/ai-honest.test.ts :: ai/05 看过牌后才按牌力决策：强牌加注、中带跟、烂牌弃
PASS test/ai-honest.test.ts :: ai/06 池赔率真的进了决策：同一副牌，池给得大方就跟、池小就弃
PASS test/ai-honest.test.ts :: ai/07 对手数量真的进了决策：同一副牌同一赔率，人越多越保守
PASS test/ai-honest.test.ts :: ai/08 看牌/保持闷是真决策：最低注级闷着省钱，注级一抬就先转明
PASS test/ai-honest.test.ts :: ai/09 只出合法行动、闷着绝不加注也绝不比牌、比牌必是合法目标（200 组随机合法集合）
PASS test/ai-honest.test.ts :: ai/12 比牌触发率 = 1000 个 seq 上量得出来，且完全由 seq+座位决定（可重放）
PASS test/ai-honest.test.ts :: ai/10 纯函数：同一输入两次调用结果逐字相同（fuzz 与回放的前提）
PASS test/ai-honest.test.ts :: ai/11 先验与 tierOrder 挂钩：把档位排列倒过来，分位表跟着倒
PASS test/ai-honest.test.ts :: ai/13 比牌目标 = 活跃对手中已投入最高者；本局已比过则不再比
PASS test/ai-honest.test.ts :: ai/13b 投入并列时按环形序选目标，而不是按座位号大小（变异 C06 复发哨）
PASS test/ai-honest.test.ts :: ai/14 掷点只由 seq+座位决定：同输入同结果、同 seq 换座位换结果
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/classic 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/a23off 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/档位集合 六档键完全一致且无重复，计数均为非负整数
PASS test/classify.test.ts :: classify/闭式结构 trips 与 pair 与 a23 无关，其余四类随 runs 移动
PASS test/classify.test.ts :: classify/输入顺序无关 455 规范类 × 6 排列判定全同（两 preset）
PASS test/classify.test.ts :: classify/A23 一族 64 手在两 preset 下的迁移符合公式
PASS test/classify.test.ts :: classify/归一化键 顺子高点 A23=3 / 234=4 / QKA=14 且长度为 1
PASS test/classify.test.ts :: classify/归一化键 对子=[对子点, 踢脚]，穷举 3744 手
PASS test/classify.test.ts :: classify/归一化键 豹子 ranks=[r]，穷举 52 手
PASS test/classify.test.ts :: classify/NOTES 打印计数三元组（实际/闭式/锚点）供独立复算
PASS test/compare.test.ts :: compare/01 规范类数量 = C(15,3) = 455
PASS test/compare.test.ts :: compare/02 自反：每类与自身比较 = 0
PASS test/compare.test.ts :: compare/03 反对称：455^2 = 207025 全对，cmp(a,b) = -cmp(b,a)
PASS test/compare.test.ts :: compare/04 传递性穷举：(a>=b && b>=c) ⇒ a>=c，全 455^3 三元组
PASS test/compare.test.ts :: compare/05 花色不参与：全体花色平移 +1 后仍判 0
PASS test/compare.test.ts :: compare/06 与独立整数键参考实现交叉一致（455^2 全对）
PASS test/compare.test.ts :: compare/07 tierOrder 整序反转：跨档对全部翻转、同档对不变
PASS test/compare.test.ts :: compare/08 tierOrder 局部改动即刻生效（把 pair 提到 trips 之上）
PASS test/compare.test.ts :: compare/09 固定种子 1000 手排序后做全对序校验（不只是相邻）
PASS test/compare.test.ts :: compare/10 牌型序链：豹子>同花顺>同花>顺子>对子>单张（15 对全断言）
PASS test/compare.test.ts :: compare/11 tierOrder 缺档时 compare 抛错而不静默
PASS test/compare.test.ts :: compare/12 档位优先于点数：最小同花顺 > 最大普通顺等交叉断言
PASS test/deck.test.ts :: deck/01 makeDeck 长度 52 且逐位满足 index = suit*13 + (rank-2)
PASS test/deck.test.ts :: deck/02 52 张互不相同
PASS test/deck.test.ts :: deck/03 makeDeck 每次返回新数组与新对象（无共享可变状态）
PASS test/deck.test.ts :: deck/04 mulberry32 同 seed 的 1000 项序列完全一致
PASS test/deck.test.ts :: deck/05 不同 seed 的序列不同
PASS test/deck.test.ts :: deck/06 输出恒为非负 uint32 整数（1e6 次采样，覆盖边界 seed）
PASS test/deck.test.ts :: deck/07 seed 非整数抛 TypeError
PASS test/deck.test.ts :: deck/08 shuffle 原地：返回值与入参是同一个数组引用
PASS test/deck.test.ts :: deck/09 shuffle 结果是原牌堆的一个排列
PASS test/deck.test.ts :: deck/10 同 seed 两次洗牌逐位一致，不同 seed 至少一处不同
PASS test/deck.test.ts :: deck/11 52 张牌恰好调用 rng 51 次
PASS test/deck.test.ts :: deck/12 rng 返回浮点/负数/非数一律抛 TypeError
PASS test/deck.test.ts :: deck/13 空牌堆与单元素牌堆不调用 rng、不抛
PASS test/deck.test.ts :: deck/14 发牌烟雾：seed=1 洗完发 6 家，每手都可判定
PASS test/deck.test.ts :: deck/16 洗牌分布公平性：固定种子 20000 轮，52 个落点计数都在容差内
PASS test/deck.test.ts :: deck/17 三张牌穷举 144 种 rng 输出：每张牌的落点计数恰为 48
PASS test/deck.test.ts :: deck/18 NOTES 打印 PRNG 与洗牌的规范向量（供跨端复算）
PASS test/deck.test.ts :: deck/19 与独立誊写的参考 mulberry32 逐位一致（钉住结构与常数）
PASS test/deck.test.ts :: deck/20 rng 恒为 0 时输出等于牌堆左旋一格（钉住从尾往前的遍历方向）
PASS test/edge.test.ts :: edge/01 §3.5 A♠2♦3♣ < 3♠4♦5♣（A23 是最小顺）
PASS test/edge.test.ts :: edge/02 §3.5 A♥2♥3♥ 是同花顺且 > 4♣5♦6♣（档位优先于点数）
PASS test/edge.test.ts :: edge/03 §3.5 2♦2♣2♥ > A♠K♠Q♠（豹子 > 同花顺）
PASS test/edge.test.ts :: edge/04 §3.5 A♦A♣3♠ > K♦K♣A♠（对子点优先，踢脚再大也没用）
PASS test/edge.test.ts :: edge/05 §3.5 同点同级 → 0（花色完全不参与）
PASS test/edge.test.ts :: edge/06 绕 A 不成顺：A♠K♦2♣ 是单张而不是顺子
PASS test/edge.test.ts :: edge/07 最大豹子 > 最小豹子 > 任意同花顺
PASS test/edge.test.ts :: edge/08 a23off 下 A♥2♥3♥ 降为同花、A♠2♦3♣ 降为单张
PASS test/edge.test.ts :: edge/09 A 在非顺子牌型里取 14
PASS test/edge.test.ts :: edge/10 归一化键长度按档固定：豹子/顺 1 位、对子 2 位、同花/单张 3 位
PASS test/edge.test.ts :: edge/11 非法手牌：长度≠3 抛 TypeError
PASS test/edge.test.ts :: edge/12 非法手牌：两张同一牌（同点同花）抛 TypeError
PASS test/edge.test.ts :: edge/13 非法牌面：rank / suit 越界、非整数、NaN 都抛 TypeError
PASS test/edge.test.ts :: edge/14 非法手牌容器：非数组 / 元素非对象 / 缺字段抛 TypeError
PASS test/edge.test.ts :: edge/15 compare 两侧都继承 classify 的非法输入检查
PASS test/edge.test.ts :: edge/16 rules 结构缺失时不静默：缺 handEval 抛 TypeError
PASS test/edge.test.ts :: edge/17 单张的型内比较只看归一化后的三点
PASS test/engine-core.test.ts :: core/01 startHand 不变量：底注入池、每人扣 ante、游标在庄家下家、计数归零
PASS test/engine-core.test.ts :: core/02 发牌互不重叠且都来自标准 52 张
PASS test/engine-core.test.ts :: core/03 发牌顺序 = 独立复算的洗牌结果（庄家下家起连续取牌）
PASS test/engine-core.test.ts :: core/04 庄家必须在座位表里
PASS test/engine-core.test.ts :: core/05 配置非法一律抛 TypeError（人数越界 / 重复座位 / 付不起底注 / seed 非整数）
PASS test/engine-core.test.ts :: core/06 apply 是纯函数：对旧状态深冻结后再推进行动，不抛（说明没有原地写）
PASS test/engine-core.test.ts :: core/07 stateHash 对状态变化敏感、对重放稳定
PASS test/engine-core.test.ts :: core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值
PASS test/engine-core.test.ts :: core/09 资金守恒：开局到结算，筹码 + 池恒等于买入总额
PASS test/engine-core.test.ts :: core/10 同一配置重复开局得到同一状态（引擎里没有隐藏全局态）
PASS test/engine-core.test.ts :: core/11 日志单调：seq 逐条 +1，type 全部来自固定集合
PASS test/engine-core.test.ts :: core/12 引擎对 2 人与 6 人都能开局（人数只受 rules.players 约束，不硬编码）
PASS test/engine-core.test.ts :: core/13 终止阈值不多不少：注级 8 上各家满 2 次仍在局里，满 3 次才 stall
PASS test/engine-fuzz.test.ts :: fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码
PASS test/engine-fuzz.test.ts :: fuzz/02 三种终止条件都能被随机行动打到（换策略覆盖 ②③）
PASS test/engine-fuzz.test.ts :: fuzz/03 2–6 人局全部跑通且守恒
PASS test/engine-fuzz.test.ts :: fuzz/04 非法行动注入：一律抛 InvalidActionError，且状态指纹不变
PASS test/engine-fuzz.test.ts :: fuzz/05 回放确定性：同 seed + 同行动序列 ⇒ 同指纹（20 局）
PASS test/engine-fuzz.test.ts :: fuzz/06 结算幂等：settle 前后指纹稳定，且只入账一次
PASS test/engine-illegal.test.ts :: illegal/01 不轮到你 → not_current_turn（三种动作各一例）
PASS test/engine-illegal.test.ts :: illegal/02 座位不存在 → bad_seat
PASS test/engine-illegal.test.ts :: illegal/03 行动对象本身不合法 → unknown_action
PASS test/engine-illegal.test.ts :: illegal/04 首圈禁比：任何人第一次行动之前都不能比牌，全员各一次后立刻放开
PASS test/engine-illegal.test.ts :: illegal/05 比牌目标非法：自己 / 已弃牌 / 不存在的座位
PASS test/engine-illegal.test.ts :: illegal/06 重复看牌被拒；看牌不消耗行动数也不推进游标
PASS test/engine-illegal.test.ts :: illegal/07 注级顶格不能再加注
PASS test/engine-illegal.test.ts :: illegal/08 钱不够 ⇒ 唯一合法行动是弃牌（全押禁用，§1 全押行）
PASS test/engine-illegal.test.ts :: illegal/09 已弃牌的座位不会再被要求行动，硬塞则 seat_not_active
PASS test/engine-illegal.test.ts :: illegal/10 终局后所有下注类行动被拒（phase_not_betting）
PASS test/engine-illegal.test.ts :: illegal/11 结算时机：没终局不能 settle；已结算再 settle 是幂等 no-op
PASS test/engine-illegal.test.ts :: illegal/12 legalActions 与 checkAction 判据完全一致（不轮到你时给出的是当前 turn 的动作集）
PASS test/engine-illegal.test.ts :: illegal/13 timeout 是普通行动：买得起 ≡ 跟注、买不起 ≡ 弃牌，且都过同一道 validate
PASS test/engine-money.test.ts :: money/01 底注：pool = ante × 人数，每人筹码与 committed 各扣/记一份
PASS test/engine-money.test.ts :: money/02 闷跟 = stake×bet.dark，明跟 = stake×bet.seen（三种注级各验）
PASS test/engine-money.test.ts :: money/03 加注：注级翻倍并按新注级付跟价（Q1 读法 B），且全员当前注级行动数清零
PASS test/engine-money.test.ts :: money/04 比牌费 = fee × stake 入池，与闷/明无关（注级 1/2/4 各验一次）
PASS test/engine-money.test.ts :: money/05 不变量：pot 恒等于各家 committed 之和；每步增量恰是 actionCost
PASS test/engine-money.test.ts :: money/06 弃牌不花钱也不退钱：弃牌者的 committed 留在池里（无边池无退款）
PASS test/engine-money.test.ts :: money/07 分池：整除时人人等份；有余数时给"距庄家下家最近"的赢家
PASS test/engine-money.test.ts :: money/08 幂等结算：入账只发生一次，重放 settle 不重复扣/发钱
PASS test/engine-money.test.ts :: money/09 任何时刻都不出现负筹码（全押禁用的直接后果）
PASS test/engine-money.test.ts :: money/10 结算后赢家所得 = 池，且各家 committed 之和 = 结算前 pot
PASS test/engine-project.test.ts :: project/01 谁都没看过牌：本人也是 unknown，他人一律 unknown（§1 看牌行）
PASS test/engine-project.test.ts :: project/02 序列化后仍然搜不到任何他人牌面（整条 view 一起查，含日志）
PASS test/engine-project.test.ts :: project/03 强制开牌后：活跃家全部可见，弃牌/被淘汰者仍然 unknown
PASS test/engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
PASS test/engine-project.test.ts :: project/05 seed 只在结算后才暴露（否则任何客户端都能反算整副牌）
PASS test/engine-project.test.ts :: project/06 公开信息一字不漏：池/注级/游标/计数/闷明/committed 全部同步
PASS test/engine-project.test.ts :: project/07 观战视角（viewer 不在座位表里）看不到任何未开的牌
PASS test/engine-project.test.ts :: project/08 视图是拷贝，改它不会污染引擎状态
PASS test/engine-project.test.ts :: project/09 终局信息公开：赢家集合、份额、余数归属都可投影
PASS test/engine-project.test.ts :: project/10 startHand 之后立刻投影：轮到行动也没看过牌 ⇒ 本人同样无牌可看
PASS test/engine-project.test.ts :: project/11 负向：未看牌时整条 view 序列化后搜不到本人牌面
PASS test/engine-project.test.ts :: project/12 revealed 优先于 looked：本人没看牌，被强制开牌后照样看得见自己的牌
PASS test/engine-scripts.test.ts :: scripts/01 弃至通吃（§1①）：只剩一人即结束，且不开牌
PASS test/engine-scripts.test.ts :: scripts/02 比牌链：连续两次比牌各淘汰一家，输家的牌永不公开
PASS test/engine-scripts.test.ts :: scripts/03 封顶开牌（§1②）：注级 16 且活跃各家再完成 1 次行动 ⇒ 强制开牌
PASS test/engine-scripts.test.ts :: scripts/04 stall 强开（§1③）：同一注级下活跃各家各满 3 次行动；加注会把计数清零重计
PASS test/engine-scripts.test.ts :: scripts/05 平局分池：两家打平 ⇒ 平分池，除不尽的余数给距庄家下家最近者
PASS test/engine-scripts.test.ts :: scripts/06 挑战者输：比牌平局时挑战者出局（§1 比牌行）
PASS test/engine-scripts.test.ts :: scripts/07 剩两家比牌 = 直接开牌定胜负（两家牌都亮）
PASS test/engine-scripts.test.ts :: scripts/08 三条终止路径各自都要能到达（覆盖性，不是只测一条）
PASS test/engine-scripts.test.ts :: scripts/09 每个脚本重放得到同一状态指纹（回放确定性）
PASS test/engine-timeout.test.ts :: timeout/01 (a) 全员托管的一手牌必然走完，且终局原因是 stall
PASS test/engine-timeout.test.ts :: timeout/02 (b) 付不起跟价的那一家回退成弃牌，且不欠款、不出现负筹码
PASS test/engine-timeout.test.ts :: timeout/03 (c) 已看牌者付明注价、未看牌者付闷注价
PASS test/engine-timeout.test.ts :: timeout/04 (d) 托管不产生 look / raise / compare 事件，也不替玩家看牌
PASS test/engine-timeout.test.ts :: timeout/05 托管仍是普通行动：同一道 validate，越界照样被拒
PASS test/engine-timeout.test.ts :: timeout/06 可归因性：玩家自主跟注的 note 里不许出现 timeout
PASS test/m2-fuzz.test.ts :: m2/01 随机合法行动 1000 局：守恒 / 无负筹码 / 无重复结算 / 有限步终止
PASS test/m2-fuzz.test.ts :: m2/02 诚实 AI 1000 局：只出合法行动、闷着不加注、决策数非零且必然终止
PASS test/m2-fuzz.test.ts :: m2/03 AI 臂与随机臂都打到全部三类终止条件（覆盖不是单边运气）
PASS test/m2-fuzz.test.ts :: m2/04 四类非法行动必被 validate 拒（不轮到你 / 钱不够 / 比已弃牌者 / 首圈禁比时段比牌）
PASS test/m2-fuzz.test.ts :: m2/05 牌力分位 ≈ 真实胜率，且档内端点随 a23 正确移动（两 preset 全枚举对拍）
PASS test/netx-client.test.ts :: client/01 收到 collect 里"还缺我"就立刻交一份份额，且一局只交一次
PASS test/netx-client.test.ts :: client/02 行动防呆：只有"轮到我且局面干净"才放行
PASS test/netx-client.test.ts :: client/03 服务端越界第一类：消息本身不合法 ⇒ 记录违规并拒绝继续
PASS test/netx-client.test.ts :: client/04 增量对不上号 ⇒ 不合并并记违规
PASS test/netx-client.test.ts :: client/05 快照的日志有洞 = 不可信
PASS test/netx-client.test.ts :: client/06 揭示核对的几类造假都会被当场发现
PASS test/netx-client.test.ts :: client/07 结算之前收到 deal 载荷（种子提前泄露）⇒ 违规并停手
PASS test/netx-client.test.ts :: client/08 error 分两类：漏牌即停手，普通回执不停手
PASS test/netx-client.test.ts :: client/09 重连消息带的是"我看到的 hand/seq"，没凭据时不发
PASS test/netx-client.test.ts :: client/11 揭示"自洽"但不是发牌用的那颗种子 ⇒ 仍然要报
PASS test/netx-client.test.ts :: client/10 旁观者的揭示（本局没参与、也没拿到过承诺）不报违规，也不算核对通过
PASS test/netx-client.test.ts :: client/12 收完份额之后改口重发承诺 ⇒ 当场识破，且那份"自洽揭示"随后也过不了（必修 1 主案）
PASS test/netx-client.test.ts :: client/13 对照组：不改口、只揭示另一个份额 ⇒ 承诺门独立就能抓住（洞在存储，不在核对逻辑）
PASS test/netx-client.test.ts :: client/13b 同值重发承诺要放过（断线补承诺），换局则重新开账
PASS test/netx-client.test.ts :: client/14 别人的承诺混进来仍然算越界（写一次门不改变这一条）
PASS test/netx-client.test.ts :: client/15 logShape 三道闸门报错文本互不相同，合法增量则一条不报（移植复审 S9）
PASS test/netx-client.test.ts :: client/16 拿到 token 但还没进过任何一手 ⇒ resume 发不出去（hand=0 是协议非法值），上层因此会改走 join
PASS test/netx-crypto.test.ts :: netx/01 SHA-256 命中 FIPS 180-4 公开向量
PASS test/netx-crypto.test.ts :: netx/02 与 node:crypto 逐字节差分（覆盖补齐边界与多字节 UTF-8）
PASS test/netx-crypto.test.ts :: netx/03 雪崩：改一个字符，256 位里至少一半上下变化
PASS test/netx-crypto.test.ts :: netx/04 base64 命中经典向量（长度余数 0/1/2 三条路径都走到）
PASS test/netx-crypto.test.ts :: netx/05 握手 accept 命中 RFC 6455 §1.3 向量，非法 key 抛错
PASS test/netx-crypto.test.ts :: netx/06 十六进制与字节的往返（承诺/份额的编码面）
PASS test/netx-crypto.test.ts :: netx/07 摘要入口对空输入与非空输入给出不同长度一致的输出
PASS test/netx-crypto.test.ts :: netx/08 SHA-1（握手用）与 node:crypto 差分，且命中 RFC 6455 §1.3 向量
PASS test/netx-frames.test.ts :: frame/01 编码的三档长度字段逐字节符合规范
PASS test/netx-frames.test.ts :: frame/02 客户端方向必须掩码，且 XOR 逐字节可复算
PASS test/netx-frames.test.ts :: frame/03 客户端→服务端：掩码帧能解，逐字节喂也要能解
PASS test/netx-frames.test.ts :: frame/04 掩码方向判反：客户端不掩码 / 服务端掩码 都拒
PASS test/netx-frames.test.ts :: frame/05 长度必须最小编码，64 位长度不得越出 32 位
PASS test/netx-frames.test.ts :: frame/06 RSV 位非 0 一律拒（没谈扩展就不许出现）
PASS test/netx-frames.test.ts :: frame/07 控制帧规则：ping/pong 原样交回，close 解析状态码
PASS test/netx-frames.test.ts :: frame/08 非法 close 一律拒（1 字节载荷 / 保留码 / 越界码）
PASS test/netx-frames.test.ts :: frame/09 控制帧不得分片、载荷不得过 125
PASS test/netx-frames.test.ts :: frame/10 文本分片可重组，控制帧插在中间也不丢序
PASS test/netx-frames.test.ts :: frame/11 跨分片的多字节字符不会解坏（UTF-8 状态在帧边界上延续）
PASS test/netx-frames.test.ts :: frame/12 非法帧序与未知操作码一律拒
PASS test/netx-frames.test.ts :: frame/13 巨帧、巨消息与编码侧都有上限
PASS test/netx-frames.test.ts :: frame/14 非法 UTF-8 文本帧拒收
PASS test/netx-frames.test.ts :: frame/15 握手 accept：已知向量 + key 边界
PASS test/netx-frames.test.ts :: frame/16 编码侧的三道参数自检：掩码键长度、分片点、pong 帧
PASS test/netx-frames.test.ts :: frame/17 64 位长度字段：非最小编码要拒、合法长帧要收、高 32 位不许越界
PASS test/netx-leak.test.ts :: leak/01 真实牌面在"亮牌"之前不出现在任何一条下行字节里（三家、跑完整一手）
PASS test/netx-leak.test.ts :: leak/02 种子与各家份额在揭示之前不外泄
PASS test/netx-leak.test.ts :: leak/03 中途加入的旁观者：既不在投影里，也没发现任何越界
PASS test/netx-leak.test.ts :: leak/04 增量重连与全量快照两条路收敛：日志逐条一致、数字一致
PASS test/netx-leak.test.ts :: leak/05 客户端第二道墙：服务端把别人的牌塞进投影 ⇒ 当场发现并拒绝再行动
PASS test/netx-leak.test.ts :: leak/06 上行 nonce 各交一份、互不相同，且承诺里读不出份额
PASS test/netx-netplay.test.ts :: nui/01 联机快照与单机快照键集逐字一致 ⇒ 同一套 scene/paint 不必改一个字
PASS test/netx-netplay.test.ts :: nui/02 只有一道墙：netplay 里不得出现第二份协议实现，也不得自己判规则算钱
PASS test/netx-netplay.test.ts :: nui/03 两家打完两整手：看牌 / 加注 / 比牌 / 结算面板 / 第二手轮庄，两侧数字逐字一致
PASS test/netx-netplay.test.ts :: nui/04 负向：没看牌时本人牌不在快照里，别家牌面全程不出现
PASS test/netx-netplay.test.ts :: nui/05 伪造下行：当场标"不可信"并停手；leak_blocked 与 replaced 的提示可区分
PASS test/netx-netplay.test.ts :: nui/06 断线重连：增量与快照两条路都真走到，台账一颗不错
PASS test/netx-netplay.test.ts :: nui/07 同一浏览器两个标签页各占一座：per-tab 存储互不覆盖；共享存储会翻车（对照）
PASS test/netx-netplay.test.ts :: nui/08 超时托管一路带到 UI：日志行里就是 timeout→call 的字样
PASS test/netx-netplay.test.ts :: nui/09 按钮：可用性只看服务端 phase/turn；金额来自引擎那一处算术且只进文案（Q6=A2）
PASS test/netx-netplay.test.ts :: nui/10 刷新之后仍能核对揭示：份额必须随凭据一起存下来
PASS test/netx-netplay.test.ts :: nui/11 (a) 端到端价格一致性：行动前页面显示的 cost === 行动后 log 里那条事件的 amount（跟/加/比各一次）
PASS test/netx-netplay.test.ts :: nui/12 (b) 闷/明差价在页面上看得见，且两个数都等于 priceOf 的输出（不是测试里手写的常量）
PASS test/netx-netplay.test.ts :: nui/13 (c) 买不起跟价的座位：按钮仍然可点、发得出去，代价由服务端 reject 送回来并被页面显示
PASS test/netx-netplay.test.ts :: nui/14 (d) 同一条按钮契约两条路共用一处算术：单机 buttonOptions 的 cost 与联机 buttonRow 的 cost 相等
PASS test/netx-netplay.test.ts :: nui/15 意图 → 动作的收窄：只有五种真行动能上协议线，推进类意图一律 null
PASS test/netx-netplay.test.ts :: nui/18 凭据作废（房间重启后 token 不认）⇒ 清存储 + 说清楚 + 自动补一条全新 join，页面不许停在"已连接、零下行"
PASS test/netx-netplay.test.ts :: nui/17 页面模块图在静态服务策略下完整可达（浏览器实测抓到的那类 403 由这条兜住）
PASS test/netx-netplay.test.ts :: nui/16 入口层静态门：main.ts 只接线不判规则，联机那一侧只有一个进口
PASS test/netx-netplay.test.ts :: nui/19 过不了 schema 的下行不许清凭据、不许强制重入桌；已停手的那一世也不许再发上行（rev=10 应修 2）
PASS test/netx-netplay.test.ts :: nui/20 上一条 reject 在我发出新行动之后必须过期（提示行不许陈述已翻篇的事实，rev=10 应修 4）
PASS test/netx-netplay.test.ts :: nui/21 服务端 notice 上到日志区：玩家既看得见结果、也看得见原因（rev=10 应修 5）
PASS test/netx-netplay.test.ts :: nui/22 底部那行数字的标签与 departed 过滤同口径：是「在场筹码+池」，不是「桌上总额」（rev=10 应修 7 / §8.9）
PASS test/netx-netplay.test.ts :: nui/23 在座座位格是服务端那一行的逐项映射：牌面/等级/筹码/已投入/状态/庄标/隐藏（rev=10 §8.12 i 主路径）
PASS test/netx-netplay.test.ts :: nui/24 中间人改 patch：往我的 view 里塞别家的牌面必须被抓、不许采纳、页面立刻停手（rev=10 §8.13）
PASS test/netx-netplay.test.ts :: nui/25 seq 面与采纳面：合法增量被采纳、同一条重放当场被抓、被拒的帧不进快照（rev=11 必修 1 的改写）
PASS test/netx-netplay.test.ts :: nui/27 patch 上的权威数字篡改：六种注入每一种都被纯客户端恒等式抓住、不采纳、并停手（rev=11 必修 1）
PASS test/netx-netplay.test.ts :: nui/28 诚实流量上恒等式不误报：三手多路行动逐帧采样，violations 恒空（误报与漏报同罪）
PASS test/netx-netplay.test.ts :: nui/26 per-tab 存储里那坨值是坏 JSON：会话建得起来、当作没有凭据、入桌照常（netplay.ts::readSaved 的 catch）
PASS test/netx-protocol.test.ts :: proto/01 双向消息 encode→check 往返保真，且字节稳定
PASS test/netx-protocol.test.ts :: proto/02 未知 key 一律拒（顶层、嵌套 move、嵌套 view、rules 内部）
PASS test/netx-protocol.test.ts :: proto/03 缺 key 与类型不符一律拒
PASS test/netx-protocol.test.ts :: proto/04 数值与长度越界一律拒
PASS test/netx-protocol.test.ts :: proto/05 引擎拒绝码全集与 src/engine/validate.ts 逐字对齐（防契约漂移）
PASS test/netx-protocol.test.ts :: proto/06 服务端实际发出的 net 拒绝码都在声明集合里，且声明集合没有空转项
PASS test/netx-protocol.test.ts :: proto/07 checkViewLeak 拦住五种越界投影，放过两种合法情形
PASS test/netx-protocol.test.ts :: proto/08 已看牌但未亮牌的"别人"仍然算泄漏（rev=4 口径在网络层同样生效）
PASS test/netx-protocol.test.ts :: proto/09 toAction 只能用绑定的座位，compare 才带 target
PASS test/netx-protocol.test.ts :: proto/10 校验错误信息带路径，便于线上定位
PASS test/netx-protocol.test.ts :: proto/11 巨帧保护：超过上限的字符串直接拒
PASS test/netx-protocol.test.ts :: proto/12 出口编码也过同一套校验：服务端构造出非法消息时本地就炸，不发到线上
PASS test/netx-protocol.test.ts :: proto/13 入参既不是 JSON 文本也不是对象 ⇒ 报"必须是文本或对象"，不报成 schema 错（rev=9 应修 3）
PASS test/netx-room.test.ts :: room/01 两家入座即开局：hello→承诺→份额→发牌，第三条连接中途加入不参与本局
PASS test/netx-room.test.ts :: room/02 承诺先于任何份额被接受（线上顺序可查，且承诺不是份额本身）
PASS test/netx-room.test.ts :: room/03 没凑齐份额就不发牌；凑齐的那一刻发牌，且发牌后种子仍不外泄
PASS test/netx-room.test.ts :: room/04 发牌之后再交份额一律被拒，且局面一字不动
PASS test/netx-room.test.ts :: room/04b 收份额阶段：错局号与"不在这局里"的家都被拒
PASS test/netx-room.test.ts :: room/05 座位由连接绑定：上行里没有 seat 字段，越界与伪造一律无副作用
PASS test/netx-room.test.ts :: room/06 完整一手：行动、结算、揭示核对，客户端零违规、总筹码守恒
PASS test/netx-room.test.ts :: room/07 全程没人动手：超时托管把一手牌走到结算，且走的是"自动跟注"这条臂
PASS test/netx-room.test.ts :: room/08 断线重连·seq 对得上 ⇒ 只补增量，补齐后三家视图与日志逐条一致
PASS test/netx-room.test.ts :: room/09 断线跨了一局再回来 ⇒ 拿的是新一局的快照，且本局种子对它合法可见
PASS test/netx-room.test.ts :: room/10 掉线者不交份额 ⇒ 到点改成两人局，牌局照常走完
PASS test/netx-room.test.ts :: room/11 多局连续：轮庄、筹码结转、每一局的揭示都对得上
PASS test/netx-room.test.ts :: room/12 桌上凑不齐两家就收桌：破产者下一局不再入池，筹码一颗不少
PASS test/netx-room.test.ts :: room/13 重连凭据的保护：乱 token 不绑座，真 token 回原位并顶掉旧连接
PASS test/netx-room.test.ts :: room/14 承诺与揭示双向绑定：打得开、合得出、换一家就对不上
PASS test/netx-room.test.ts :: room/15 房间层的门槛：最小买入与满座都不占座
PASS test/netx-room.test.ts :: room/16 driveToSettle 走的一手牌必然在有限步内终止（引擎不变量在联机层同样成立）
PASS test/netx-room.test.ts :: room/17 结算之后才回来的那一家，承诺+快照+揭示一起补回（审计材料不因断线丢失）
PASS test/netx-room.test.ts :: room/20 阶段门在房间层：awaitingSettle 之后的行动被房间挡下（不是丢给引擎）
PASS test/netx-room.test.ts :: room/19 没绑上座位的连接：任何游戏消息都只会拿到 no_seat，不会碰到局面
PASS test/netx-room.test.ts :: room/18 定时器不泄漏：发牌后 nonce 表必须取消，结算后只剩局间那一只
PASS test/netx-room.test.ts :: room/21 应用层 ping→pong 端到端（rev=8 里这条路径零覆盖）
PASS test/netx-room.test.ts :: room/22 已经绑上座位的连接再 join ⇒ already_joined，座位绑定不动
PASS test/netx-room.test.ts :: room/23 拿别人座位的 token 在已绑座的连接上重连 ⇒ token_seat_mismatch
PASS test/netx-room.test.ts :: room/24 行动阶段的两道门：没有牌局 ⇒ not_dealt，局号错位 ⇒ bad_hand
PASS test/netx-room.test.ts :: room/25 份额阶段的两道门：没有牌局 ⇒ not_dealt，不在本局名单里的 party ⇒ no_seat
PASS test/netx-room.test.ts :: room/26 诊断面的连接清单按码点序给出（与份额定序同一把尺，rev=8 应修 5）
PASS test/netx-room.test.ts :: room/27 构造期三道 TypeError 各自说清越界在哪（rev=9 应修 1）
PASS test/netx-room.test.ts :: room/28 到点还凑不齐最低人数 ⇒ 本局作废、只挂局间表、到点重开为第二局（rev=9 应修 2）
PASS test/netx-room.test.ts :: room/29 庄家那一座没交份额 ⇒ 剔除之后庄家必须挪到还在桌的一家，牌局照常开（旧行为：整个房间进程被 TypeError 打死）
PASS test/netx-seed.test.ts :: seed/01 承诺把 hand / party / 份额三者绑在一起
PASS test/netx-seed.test.ts :: seed/02 合成与提交顺序无关（任何一端都能独立复算）
PASS test/netx-seed.test.ts :: seed/03 改任何一家的份额，种子必变（没有旁观者）
PASS test/netx-seed.test.ts :: seed/04 没有任何一家能决定种子：固定其余各家，逐家扫描 32 个候选
PASS test/netx-seed.test.ts :: seed/05 局号参与合成：同一批份额在不同局给出不同种子
PASS test/netx-seed.test.ts :: seed/06 合成结果是引擎接受的 uint32 整数
PASS test/netx-seed.test.ts :: seed/07 非法份额输入一律抛错（含能造成拼接歧义的字符）
PASS test/netx-seed.test.ts :: seed/08 揭示核对：一一对上才算通过
PASS test/netx-seed.test.ts :: seed/09 承诺文本是单射的：改一个字符就换摘要（雪崩在这里体现为不可伪造）
PASS test/netx-seed.test.ts :: seed/10 座位方命名在 party charset 内，且与"server"不撞
PASS test/netx-seed.test.ts :: seed/12 合成用的是完整 32 位（截断成 16 位会被这条抓到）
PASS test/netx-seed.test.ts :: seed/13 定序只用码点键：seedVector 与 canonicalShares 是同一把尺（rev=8 必修 4）
PASS test/netx-seed.test.ts :: seed/14 互为前缀的 party 名（seat:1 与 seat:10）：定序排的是 party，不是拼接串
PASS test/netx-seed.test.ts :: seed/11 固定向量：复审可照抄复算
PASS test/netx-serve.test.ts :: srv/01 房间进程在空闲端口上起来：/health 与 webui 页面同源同端口
PASS test/netx-serve.test.ts :: srv/02 两家从房间进程真跑一手牌：跨真 socket 的揭示核对通过，零越界
PASS test/netx-serve.test.ts :: srv/03 一条命令起、一句 quit 干净退出（退出码 0，不是被硬杀）
PASS test/netx-serve.test.ts :: srv/04 坏端口参数：退出码 2 且留一句话
PASS test/netx-serve.test.ts :: srv/05 默认端口在"房间进程"与"页面输入框"两处不许各说各话
PASS test/netx-serve.test.ts :: srv/06 横幅里印出来的那个页面 URL 就是联机页（rev=10 必修 1）
PASS test/netx-serve.test.ts :: srv/07 一条畸形百分号转义打死独立静态服务（rev=10 必修 2）⇒ 现在回 400 且进程存活
PASS test/netx-serve.test.ts :: srv/08 文件不存在回 404（不是 500），响应形状与 no-store 口径一起钉住
PASS test/netx-static.test.ts :: nst/01 扫描范围覆盖 netx 全部源文件，可移植清单里的文件都真实存在
PASS test/netx-static.test.ts :: nst/02 零第三方依赖：netx 里每个 import 都是相对路径或 node: 内置
PASS test/netx-static.test.ts :: nst/03 协议核心里没有时钟、随机与 IO（引擎的确定性口径延续到联机层）
PASS test/netx-static.test.ts :: nst/04 分层：src/ 与 webmin/ 完全不知道联机存在；webui 里只有 netplay.ts 这一个进口
PASS test/netx-static.test.ts :: nst/05 tsconfig 的 include 覆盖 netx，且沿用同一条可擦除语法约束
PASS test/netx-static.test.ts :: nst/06 netx 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）
PASS test/netx-static.test.ts :: nst/07 M4 之后依赖面仍然没扩：dependencies 空、devDependencies 仍在白名单内
PASS test/netx-static.test.ts :: nst/08 房间层的时钟与随机全部来自注入（RoomOptions 是唯一的入口）
PASS test/netx-static.test.ts :: nst/10 Q6=A2 ④：价格公式不许扩散 —— 页面侧只有 netplay.ts 这一个接缝
PASS test/netx-static.test.ts :: nst/11 跑测工装必须挡住"带 PID 的实验警告"这条双跑破口（§0.5）
PASS test/netx-static.test.ts :: nst/09 M4 的测试文件自己也不许用时钟与随机（否则双跑必然不一致）
PASS test/netx-static.test.ts :: nst/12 「在场筹码+池」一把尺：标签、渲染处、过滤口径、两个页面入口必须同进退（rev=10 应修 7）
PASS test/netx-static.test.ts :: nst/13 日志区两条分支同一条上限，且 notices 的窗口不许超过它（rev=11 应修 3）
PASS test/netx-ws.test.ts :: ws/01 三个独立 WebSocket 客户端打进来，跑完整一手并各自核对揭示
PASS test/netx-ws.test.ts :: ws/02 /health 可读；普通 HTTP 请求不会误入升级分支
PASS test/netx-ws.test.ts :: ws/03 握手与帧的严格性在真 socket 上生效：合法 101、旧版本 426、未掩码被 1002 关掉
PASS test/netx-ws.test.ts :: ws/05 非法握手的每一条都被拒，且拒绝不在房间里留下连接
PASS test/netx-ws.test.ts :: ws/06 真 socket 上的控制帧：客户端 ping 得到同载荷 pong，坏帧得到 1002（rev=9 应修 3）
PASS test/netx-ws.test.ts :: ws/09 握手拒绝的正文两两不同，且与 Node 自己答的那串 400 可分辨（rev=11 应修 2）
PASS test/netx-ws.test.ts :: ws/04 真 socket 断线：牌局在托管下走完，凭 token 重连后拿到完整局面并核对揭示
PASS test/netx-ws.test.ts :: ws/07 onHttpRequest 抛异常 ⇒ 500 兜底、连接不残留、房间照常服务（rev=10 应修 9）
PASS test/netx-ws.test.ts :: ws/08 Connection 头的四种"我们不肯放行"写法全部停在 Node 层 404：ws.ts:163-167 按构造不可达
PASS test/rules.test.ts :: rules/01 presets.classic 幂等通过 validateRules
PASS test/rules.test.ts :: rules/02 presets.a23off 幂等通过 validateRules
PASS test/rules.test.ts :: rules/03 两个 preset 仅在 handEval.a23 上不同
PASS test/rules.test.ts :: rules/04 classic 的每个数值逐项等于工单 §1 表格
PASS test/rules.test.ts :: rules/05 未知顶层 key special235=true 抛 TypeError
PASS test/rules.test.ts :: rules/06 未知 key 即使值为 false 也抛（不在 v1 schema）
PASS test/rules.test.ts :: rules/07 未知嵌套 key 抛（handEval / bet 内）
PASS test/rules.test.ts :: rules/08 缺 key 抛（顶层与嵌套各一例）
PASS test/rules.test.ts :: rules/09 值类型错抛（字符串数字 / null / 非布尔）
PASS test/rules.test.ts :: rules/10 version 必须是字面量 1
PASS test/rules.test.ts :: rules/11 字面量域的非法值抛（allIn / compare.tie / showdown.*）
PASS test/rules.test.ts :: rules/12 tierOrder 必须是 6 档无重复排列
PASS test/rules.test.ts :: rules/13 非对象输入一律抛
PASS test/rules.test.ts :: rules/14 validateRules 返回值深冻结（顶层/嵌套/数组都改不动）
PASS test/rules.test.ts :: rules/15 validateRules 返回深拷贝，输入事后被改不影响副本
PASS test/rules.test.ts :: rules/16 presets 本身深冻结
PASS test/rules.test.ts :: rules/17 错误消息点名违规所在路径与 key
PASS test/rules.test.ts :: rules/18 dealer.next 三档各自合法，且 preset 默认 = rotate
PASS test/rules.test.ts :: rules/19 dealer 的非法形态一律抛（枚举外值 / 缺字段 / 多余 key / 非对象 / 大小写）
PASS test/rules.test.ts :: rules/20 跨字段约束：players.min≤max 与 stake.initial≤max 各自抛，等号边界放过
PASS test/static.test.ts :: static/00 扫描范围覆盖 cards / rules / engine / ai 全部源文件
PASS test/static.test.ts :: static/01 src 里不出现时钟与随机全局态
PASS test/static.test.ts :: static/02 src 里不出现文件、网络与控制台 IO
PASS test/static.test.ts :: static/03 src 不引用任何运行时全局可变对象
PASS test/static.test.ts :: static/04 import 只允许相对路径；M0 两文件只允许 import type ./rules.ts
PASS test/static.test.ts :: static/05 src 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）
PASS test/static.test.ts :: static/06 零运行时依赖：dependencies 必须为空（或整体不存在）
PASS test/static.test.ts :: static/07 devDependencies 落在工单白名单内
PASS test/static.test.ts :: static/08 npm test 是单命令，且不依赖任何已安装依赖
PASS test/static.test.ts :: static/09 tsconfig 打开 strict 与 erasableSyntaxOnly
PASS test/static.test.ts :: static/10 输出生产者 test/run.ts 不引用时钟（保证两次运行一致）
PASS test/static.test.ts :: static/11 测试目录可被 runner 发现且无空目录
PASS test/static.test.ts :: static/12 M0 冻结接口：cards/rules 的导出名恰好是 §2.7 契约（不夹带私有实现的导出）
PASS test/static.test.ts :: static/13 src/ai 只用投影信息：越界引用与运行时依赖一律为 0 命中
PASS test/webmin-dealer.test.ts :: dealer/01 rotate：庄家的下家接任（手推座位号）
PASS test/webmin-dealer.test.ts :: dealer/02 winner：单赢家通吃即该赢家坐庄
PASS test/webmin-dealer.test.ts :: dealer/03 winner：平局分池先给拿到余数的那位，无余数才按环形最近
PASS test/webmin-dealer.test.ts :: dealer/04 loser：非赢家中距庄家下家最近者；其离桌则环形顺延到下一家输家
PASS test/webmin-dealer.test.ts :: dealer/05 loser 档无在桌输家时退回轮庄（Q2 已裁定 A）
PASS test/webmin-dealer.test.ts :: dealer/06 三档都没有可留的座位时返回 null（调用方该收桌）
PASS test/webmin-dealer.test.ts :: dealer/07 createSession：三档都合法、默认 rotate、非法值抛 TypeError
PASS test/webmin-dealer.test.ts :: dealer/08 会话层：winner 档 ⇒ 每局庄家 = 上一局赢家
PASS test/webmin-dealer.test.ts :: dealer/09 会话层：loser 档 ⇒ 庄家来自上一局非赢家（除非无在桌输家）
PASS test/webmin-dealer.test.ts :: dealer/10 会话层：rotate 档仍是老行为（庄位逐局换人），且三档结果互不相同
PASS test/webmin-dealer.test.ts :: dealer/11 选庄不改钱：三档各自跨局守恒
PASS test/webmin-model.test.ts :: ui/01 createSession 建立座位、首局与台账
PASS test/webmin-model.test.ts :: ui/02 非法开局参数一律抛 TypeError
PASS test/webmin-model.test.ts :: ui/03 deriveSeed 确定、逐局不同、不用时钟
PASS test/webmin-model.test.ts :: ui/04 没轮到真人时点按钮 → 拒绝且状态指纹不变
PASS test/webmin-model.test.ts :: ui/05 真人+机器人打完一整局：走到结算，台账守恒
PASS test/webmin-model.test.ts :: ui/06 真人发起合法比牌恰好淘汰一家；期间确证首圈禁比挡过
PASS test/webmin-model.test.ts :: ui/07 乱点不崩：非法意图 ok:false 且指纹不变；整桌重来永远可点
PASS test/webmin-model.test.ts :: ui/08 再来一局：局号 +1、庄家轮转到下家、总额守恒
PASS test/webmin-model.test.ts :: ui/09 连打 12 局：每局有限步结束、总额恒定
PASS test/webmin-model.test.ts :: ui/10 机器人走 AI：只出合法意图、闷着不加注不比牌、注级抬高先转明
PASS test/webmin-model.test.ts :: ui/10b 机器人走 AI：强牌加注 / 同一副牌随赔率翻转 / 闷着遇高注级先转明
PASS test/webmin-model.test.ts :: ui/10c 未看牌的机器人决策与手牌无关（同一局面只换牌）
PASS test/webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
PASS test/webmin-model.test.ts :: ui/11b 整桌重来要请回破产离桌的人，并保留庄家规则档位（M2 实测抓到的两个缺陷）
PASS test/webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
PASS test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
PASS test/webmin-model.test.ts :: ui/14 分层边界：model 不碰 DOM/时钟/随机，app 不碰 node 内置也不自己判规则
PASS test/webmin-model.test.ts :: ui/15 页面接线：html 与各模块 import 路径都能被服务放行
PASS test/webmin-model.test.ts :: ui/16 一整局的可见性推进：局中暗牌、终局按规则亮
PASS test/webmin-model.test.ts :: ui/17 页面显示的牌型名与 classify 判定一致（且以看过牌为前提）
PASS test/webmin-model.test.ts :: ui/18 未看牌时 view() 全树序列化与座位行都搜不到真人牌面
PASS test/webmin-model.test.ts :: ui/19 结算信息一条不丢：每家的账就地进座位板，结算块只留原因与指纹（rev=7 ④的前提）
PASS test/webmin-model.test.ts :: ui/20 亮牌文本行：ASCII 记法逐张对得上，且只列真亮出来的牌（验收④给机器的读法）
PASS test/webui.test.ts :: ui3/01 层次：webui 只 import 彼此与 webmin/model，绝不直接碰引擎或 src
PASS test/webui.test.ts :: ui3/02 层次：只有入口层能碰 DOM；UI 侧一行规则判定都没有
PASS test/webui.test.ts :: ui3/03 bridge：开桌后快照结构化，未看牌 ⇒ 每一行都是隐藏位
PASS test/webui.test.ts :: ui3/04 bridge：三档庄家规则都开得出桌并回显在快照里
PASS test/webui.test.ts :: ui3/04b 页面接线：开桌控件与 StartOptions 一一对应，庄家三档不许在 M3 这一版丢掉
PASS test/webui.test.ts :: ui3/05 bridge：非法意图走引擎拒绝路径，计数与状态指纹都对
PASS test/webui.test.ts :: ui3/06 bridge：真人点看牌 ⇒ 只有自己那行亮牌，且快照里搜不到任何别家牌面
PASS test/webui.test.ts :: ui3/07 bridge：把一局打完 ⇒ 结算区有内容、日志在长、桌上总额守恒
PASS test/webui.test.ts :: ui3/08 scene 是纯函数：同一输入两次布局逐字节相同
PASS test/webui.test.ts :: ui3/09 scene 布局不变量：命中区与按钮一一对应、互不重叠、都在画布内（三种视口）
PASS test/webui.test.ts :: ui3/09b 低于最小视口时不做布局、只画提示，且不留下任何可点区（不装作能玩）
PASS test/webui.test.ts :: ui3/09c 竖向预算先给牌桌：候选 10 个时按钮条至多 3 行，座位板照旧不挤不越界（变异 U05 复发哨）
PASS test/webui.test.ts :: ui3/10 scene 命中测试：中心与四条边角都算命中，边界外 1px 不命中
PASS test/webui.test.ts :: ui3/11 scene 不泄露未看过的牌：开局整棵图元树里没有任何牌面字符
PASS test/webui.test.ts :: ui3/11b 看牌前后：整棵图元树从 0 张牌面变成正好 3 张（且就是本人那手）
PASS test/webui.test.ts :: ui3/12 paint 只执行图元：假 ctx 下调用次数与图元数一一对应
PASS test/webui.test.ts :: ui3/13 静态服务放行 webui（不装 vite 也跑得起），根路径仍指向 M1.5
PASS test/webui.test.ts :: ui3/14b 没轮到真人时"整桌重来"仍报合法（U01 复发哨：灰按钮不许谎报会被拒）
PASS test/webui.test.ts :: ui3/15 翻牌动画：进度过半之前一张牌面都不许出现，之后才亮
PASS test/webui.test.ts :: ui3/16 动画进度是纯入参：同一 (快照, anim) 两次布局逐字节相同；不给 anim 时直接终态
PASS test/webui.test.ts :: ui3/17 没配 since 的座位视为已翻开；换局后重新亮牌的座位会重新起算
PASS test/webui.test.ts :: ui3/14 灰按钮点了必被引擎拒（验收③在 M3 侧的等价形态）
PASS test/webui.test.ts :: ui3/18 牌面放大：每张亮牌 ≥48×64、点数 ≥18px，本人手牌再大一档（工单 rev=7 ①）
PASS test/webui.test.ts :: ui3/19 2–6 家都排得开：座位板数量对得上、互不重叠、不越界、不压按钮（工单 rev=7 ②）
PASS test/webui.test.ts :: ui3/19b 极端候选数下只许二选一：要么明说装不下，要么座位板/按钮/底部条互不重叠（不许硬排）
PASS test/webui.test.ts :: ui3/20 结算块不许盖住任何一张亮出来的牌（牌刚亮完就被盖住 = rev=7 要修的老毛病）
PASS test/webui.test.ts :: ui3/21 顶栏不许被牌桌盖住：状态行是整句，被木轨吃掉就等于丢信息（rev=7 实测缺陷复发哨）
PASS test/webui.test.ts :: ui3/22 按钮文案一个字都不许丢：折行只改行数，且每行都得待在自己那颗按钮里
PASS test/webui.test.ts :: ui3/23 牌角不许爬到邻牌脸上：每个点数/花色图元必须待在"自己那张牌露出来的那一条"里
PASS test/webui.test.ts :: ui3/24 桌面中央的"亮牌"文本行：每张亮牌都在里面、字号够读、且不压任何座位板

=== NOTES (fixed vectors, recompute-able independently) ===
AI-CALIB max|est-true|=0.3pp over 24 anchors
AI02 tier-percentile max diff=0.27pp
AI09 compare=1/200 组（其中有资格比牌的才 9 组）
AI12 trigger=14.6% over 1000 seqs
CANONICAL mulberry32 seed=1 float_first=0.6270739405881613
CMP 2S 2D 9C vs 3S 4D 5C = -1
CMP 2S 3D 4C vs AS KS QS = -1
CMP 4S 9S JS vs AS 2S 3S = -1
CMP 9S 9D 2C vs 9C 9S 2D = 0
CMP AS 2S 3S vs QD KC JS = 1
DEAL seat=0 hand=T♠2♠J♠ tier=flush ranks=[11,10,2]
DEAL seat=1 hand=5♠9♣J♥ tier=highCard ranks=[11,9,5]
DEAL seat=2 hand=3♠6♦A♦ tier=highCard ranks=[14,6,3]
DEAL seat=3 hand=6♠K♥7♣ tier=highCard ranks=[13,7,6]
DEAL seat=4 hand=2♥7♠T♣ tier=highCard ranks=[10,7,2]
DEAL seat=5 hand=Q♥J♣7♦ tier=highCard ranks=[12,11,7]
DEALER08 winner 0>2=>2 2>0=>0 0>1=>1 1>0=>0 0>0=>0 0>3=>3
DEALER09 loser hands=6 fallback=0
DEALER10 rotate=0,1,2,3,0 winner=0,2,0,1,0 loser=0,1,3,1,2
ENUM a23off actual   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off anchor   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off closed   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM classic actual   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic anchor   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic closed   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
FUZZ-ILLEGAL probes=3645 rejected=3247
FUZZ-ILLEGAL4 probes=15589 not_current_turn=5592 cannot_afford=2796 bad_target=2921 compare_forbidden_before_first_actions=2672
FUZZ-MODE reasons=oneLeft,stakeCap,stall
FUZZ-ai hands=1000 maxSteps=17 decisions=9262 look=1231 compare=117 有比牌的局=113 reasons=oneLeft=300 stakeCap=42 stall=658
FUZZ-random hands=1000 maxSteps=22 decisions=0 look=0 compare=0 有比牌的局=0（decisions/look/compare 只统计 decideAi 的决策，随机臂不经过 AI ⇒ 恒为 0，不是"随机臂不打比牌"） reasons=oneLeft=755 stakeCap=233 stall=12
FUZZ200 maxSteps=19 reasons=oneLeft=169 stakeCap=27 stall=4
HASH seed11-3calls=c654f607d89ce8c9
REPLAY cap seed=1 hash=03adaa7bef0f0d99
REPLAY cap seed=2 hash=2d3f6f85ce3ae82f
REPLAY cap seed=5 hash=0966c43c35d04a96
REPLAY foldout seed=1 hash=f6ebdc809abcb74a
REPLAY foldout seed=2 hash=aceb2772ab74efc0
REPLAY foldout seed=5 hash=096e62b78da9c34d
REPLAY stall seed=1 hash=1730bb61755d018f
REPLAY stall seed=2 hash=80606e936d104725
REPLAY stall seed=5 hash=286b96c25face2b4
SCRIPT02 seed=1 loser1=2 loser2=0
SCRIPT05 seed=1061 pot=13 shares=7,6
SCRIPT06 seed=622 tie hands: 1=[{"rank":8,"suit":1},{"rank":14,"suit":0},{"rank":7,"suit":3}] 2=[{"rank":7,"suit":1},{"rank":8,"suit":2},{"rank":14,"suit":3}]
SEED base=20260925 h1=3776361071 h2=1243603819
SETTLE seed1-stall chips=96,108,96 pot0 total=300
SHUFFLE-FAIR trials=20000 expected=384.61538461538464 min=331 max=431
SORT1000 seed=20260925 ties=2182 first=[{"rank":10,"suit":3},{"rank":10,"suit":1},{"rank":10,"suit":0}]
TRANS full_triples=94196375 implied_triples=47201700
UI05 steps=5 结束原因：同一注级下各家各完成 3 次行动 → 强制开牌
UI06 合法比牌达成，且首圈禁比确凿生效过
UI07 rejected=7/7
UI09 hands=12 total=768 over=null
UI10 botSteps=253 raise=10 call=110 fold=43 look=77 compare=13
UI11 收桌于第 3 局：只剩 1 家还付得起底注（最少需要 2 家），牌局结束
UI16 reason=stall
UI19 待结算样本：phase=awaitingSettle 赢家=1
UI20 亮牌：你 8C 3S KS 单张 / 电脑1 5S TC 5H 对子 / 电脑3 QS 3H 7D 单张
UI307 结算行=5 日志行=12 点击=3 被拒=0
VECTOR mulberry32 seed=1 first8=2693262067,11749833,2265367787,4213581821,4159151403,1207330352,2632122864,3095568220
VECTOR mulberry32 seed=2 first8=3153583793,1395857638,1225337227,2310499808,3759333107,2709408573,2144054433,1534354113
VECTOR mulberry32 seed=4294967295 first8=3850105811,813802916,3073704848,4054706436,3630262831,2315588663,2922715533,2042566601
VECTOR shuffle seed=1 first12=TS 2S JS 5S 9C JH 3S 6D AD 6S KH 7C
VECTOR shuffle seed=1 last6=2D 3C QC KC 8D 4H
frame/15 握手向量 = RFC 6455 §1.3（SHA-1 + GUID 258EAFA5-E914-47DA-95CA-C5AB0DC85B11）
frame/17 64 位长度三臂：非最小拒 / 66000 字节合法帧解通 / 0x10000 声明走"等数据"分支
leak/01 按 seed 独立复算三家的牌面，逐条扫描"别人看到且尚未亮牌"的下行（96 次检查）：零命中
leak/02 结算视图前扫描 36 条下行：种子字段/种子数字零命中；揭示前份额明文零命中
leak/04 抖动重连 8 次之后仍与稳定路径逐条收敛
netx/02 SHA-256 与 node:crypto 差分 208 条输入全部一致
netx/08 SHA-1 与 node:crypto 差分 202 条一致；握手向量 = RFC 6455 §1.3
nst/07 依赖面：dependencies={}，devDependencies=@types/node,typescript,vite
nst/09 M4 测试文件 12 份：netx-client.test.ts, netx-crypto.test.ts, netx-fixtures.ts, netx-frames.test.ts, netx-leak.test.ts, netx-netplay.test.ts, netx-protocol.test.ts, netx-room.test.ts, netx-seed.test.ts, netx-serve.test.ts, netx-static.test.ts, netx-ws.test.ts；时钟例外只给 netx-ws.test.ts / netx-serve.test.ts（仅看门狗）
nst/10 扫 webui 全部 5 个 .ts：价格算式只在 webui/netplay.ts，其内 priceOf 只调一次、三档按钮都从它取数
nst/12 标签「在场筹码+池」：文案①渲染②过滤③入口④四道判据互锁，三组对照各命中一条（webui/webmin/netx/src 共 24 个 .ts 被扫）
nst/13 两条 log 分支同为 40 行上限，notices 窗口 6 ≤ 上限；两组对照各命中一条，另钉住 netx-ws 的时钟例外仍是 3 处
nui/01 快照 20 个字段两边一致；联机快照排版出 39 图元 / 0 命中区
nui/03 两整手：第 1 手池 0，第 2 手庄家=座位1，终局台账 512
nui/04 未看牌 / 别家牌面 / 开牌之后三个阶段各自都拿整棵快照搜过（含正、反向对照）
nui/05 三类可见反馈各自可辨认：伪造下行→停手；leak_blocked→漏牌；replaced→顶号
nui/06 三条重连形状各自真实走到：断线→(seq,now] 增量、同局刷新→(0,now] 增量、跨局→全量快照；台账全程守恒 512
nui/07 per-tab 存储各占一座；换成共享存储时"甲"被接回座位1（=乙的座位）
nui/08 UI 日志里 6 条 timeout→call；末条：#007 call      甲 出 1 @注级1｜timeout→call dark×stake
nui/09 按钮只列候选意图；cost 恒 null；不轮到自己时全灰且发不出去
nui/10 份额随凭据存住 ⇒ 刷新重连后局末核对照样通过，且服务端不再向它重复收份额
nui/11 (a) 三种行动各自对账通过：raise=4@注级1 / call=4@注级2 / compare=4@注级2
nui/12 (b) 注级 1：闷 1 → 明 2，两个数都由 priceOf 现算
nui/13 (c) 穷座筹码 1 对 8 的跟价：仍可点、发得出、服务端拒、页面照实说
nui/14 (d) 两条路对同一 state 逐按钮相等：25 次、11 种组合
nui/16 入口层只有接线与显示：netx 进口为零，规则与价格的判定面全在别处
nui/17 模块图 19 个文件全部可达，其中 netx 只有 4 个：netx/client.ts, netx/protocol.ts, netx/seed.ts, netx/sha256.ts
nui/18 bad_token ⇒ 清存储 + 提示 + onText 自己产出 join（一次），哑管道端到端也真把局面接回来了
nui/19 判据只认墙校验过的 errors：非法报文不清凭据不发上行；停手的那一世也不发；干净的那一世才自动重入桌
nui/20 compare_forbidden_before_first_actions 上屏后，下一个被接受的行动把它换下了提示行，审计面仍留着 1 条
nui/21 入座 / 没交份额 / 挪庄三类 notice 都进了日志区，键集与 40 行上限不变
nui/22 在场=512、房间整本=768（差额 256 = 离桌那一家），标签「在场筹码+池」与过滤同口径
nui/23 座位格主路径三个时刻各比对 27 项，牌面/等级/筹码/状态/结算文案全部由 view 那一行推出（甲0、乙1、丙2）
nui/24 patch 上塞别家牌面 ⇒ 当场抓到（1 条越界）、投影不采纳、页面塌成"已停手"、act 发不出去；同工装下的合法 patch 零误伤
nui/25 的 seq 面：重放同一条 patch 当场被抓；揭示核对仍然只认份额与承诺
nui/26 坏 JSON 降级为"没有凭据"、入桌照常、新凭据写回；对照：合法凭据能构造 resume
nui/27 六种 patch 数字注入各被恒等式抓住：(a) 抓 pot/committed，逐座位恒定抓两家 chips 与"committed+pot 一起改"那一支，(d) 抓凭空多出来的假座位；被拒帧不采纳，页面停在已停手
nui/28 诚实流量 144 次逐帧采样、0 处误报；三家都核对通过（靠放宽检查换绿会在这里露馅）
proto/01 上行 6 条 / 下行 10 条往返保真且字节稳定
proto/06 net 拒绝码 5 个全部会被真正发出：bad_hand, no_seat, not_dealt, bad_nonce, nonce_late
proto/12 出口编码：6 类非法消息全部在本地被拦（服务端不能只约束客户端）
proto/13 parse() 两条报错口径互不混用：非文本非对象 / 坏 JSON / schema 缺 key 各归各
room/07 全程托管 ⇒ 六次 timeout→call、零弃牌、终局 stall；三家版见 timeout/01
room/11 三局庄家轮转 0→1→2；结束时 0:249 1:256 2:263
room/16 2~6 家全部靠"看牌+跟注"走到强制开牌，无违规、无 fault
room/17 缺席完全局的重连：承诺/快照/揭示三件齐补，种子核对通过
room/18 每一阶段的待发定时器数量恒为 1（nonce/回合/结算表都被正确取消）
room/21 应用层心跳：三条 ping 各自回显，局面一字未动（3 条 pong）
room/26 连接清单 = A2, B3, C2, a10, c1, c10（码点序；locale 序会是 a10, A2, B3, c1, c10, C2）
room/28 到点开不齐人 ⇒ 本局作废 + 局号不回卷 + 台账零扣减；重开后份额重新收
room/29 庄家缺席 ⇒ 挪到座位1、牌局开出来、进程没炸；缺席家筹码原样
seed/11 合成 seed=1498111553（份额明文见 netx-seed.test.ts 顶部 SHARES）
seed/11 固定向量 hand=1 shares=[seat:0:49af21ae…, seat:1:4ec39f40…, seat:2:e4aa43f9…, server:12be698b…]
seed/12 4096 组份额合成 4096 个互不相同的种子，最大值 4294600091
seed/13 码点序=A,Seat:10,a,seat:2,server / locale 序=a,A,Seat:10,seat:2,server ⇒ 向量取前者，权威路径同键（seed=3577986836）
seed/14 前缀相撞的 party 名：权威 = 向量 = seat:1,seat:10,seat:2,server（seed=2391714912）
srv/02 真 socket 走完一手：19 步，两家各自核对通过（端口由内核挑，不印进输出）
srv/05 默认端口 8790：进程与页面两处一致；存储与熵源口径也钉住
srv/06 入口面：横幅原样印出 http://127.0.0.1:〔内核端口〕/webui/ 且跟到底就是联机页；/ 仍 302 到 M1.5（映射未动）
srv/07 四发畸形转义全部 400、%00 与越界 403 档位不变、事后合法路径仍 200（进程存活）
srv/08 ENOENT 与 src 下不存在都 404（带原因、纯文本、no-store），对照组 /webui/index.html 仍 200
timeout/06 托管与自主跟注只差 note：timeout→call seen/dark×stake vs dark×stake
ws/01 真实 socket + Node 内置 WebSocket 客户端跑完一手牌：11 个 seq，三家各自核对通过
ws/04 断线期间牌局由托管走完；重连后 seq 从 0 追到 9，揭示核对通过
ws/05 9 条非法握手各自被拒（400/404/426 按来源分档），零连接残留
ws/06 控制帧：ping(122,104,33,0,255) 原样回显、零长度边界、客户端 pong 不回声（管道里恰好一个 pong）、非法帧 1002
ws/07 钩子抛 ⇒ 500 + 原文；/health 与真握手照常；钩子自己应答时 203/404 两档不受影响
ws/08 4 种 Connection 写法全部由 Node 层答 404（正文即判据），我们那三行 400 在本机 Node 上按构造不可达
ws/09 三条可达 guard 的正文互不相同、426 另有自己的正文，且 Node 自己答的那一发仍是零正文 ⇒ 400 归因不再需要覆盖差分

RUNNER files=29 cases=412
SUMMARY pass=412 fail=0 total=412
RESULT=ALL_PASS
```

# 11 · rev=11 定点返修（REVIEW.md rev=10 的必修 2 项 + 应修 9 项 + §8 那十三条验收口径）

> 本轮范围：`rev=10` 裁定的**必修 1、必修 2、应修 1–9**，以及 §8 里点名的 **8.9 / 8.10 / 8.11 / 8.12(i) / 8.12(ii) / 8.13**。
> 8.7（真浏览器 ≥720×640 + 同一浏览器两个标签页）按裁定仍归监督方，本轮不声称验过；
> 页面侧那一行标签的**渲染证据**改用无头对照（nui/22 直接读 `buildScene` 的图元树）。

## 11.1 命令、退出码与 §0.5 双跑哈希

| # | 命令 | 结果 |
|---|---|---|
| 1 | `node test/run.ts` | exit=0，`RUNNER files=29 cases=408`、`SUMMARY pass=408 fail=0 total=408`、`RESULT=ALL_PASS` |
| 2 | 同一条紧接着再跑一次 | exit=0，输出与第 1 次**逐字节相同** |
| 3 | `npm test` | exit=0，同上 |
| 4 | `npm test` 再跑一次 | exit=0，与第 3 次逐字节相同 |
| 5 | `npx tsc --noEmit` | exit=0，零诊断 |

四个产物文件的 sha256（`.scratch/` 下，不入 manifest）：

```
node test/run.ts  →  .scratch/r11-run-node1.txt ≡ .scratch/r11-run-node2.txt
  8738b996e36562a1a8f093380ce784b9d09037b0c0f03df08564096171e7dcb0
npm test          →  .scratch/r11-run-npm1.txt  ≡ .scratch/r11-run-npm2.txt
  50c323126c098b804debb0c88534e98b52ff08b10849e7a833bdf28d314afa50
```

两组哈希各自相等 ⇒ 输出里没有耗时、时间戳、随机顺序；端口全部由内核挑（`port: 0`），
横幅与 URL 一律不进断言输出（srv/06 的 note 把端口写成 `〔内核端口〕` 才落纸）。

## 11.2 §8.6 零回归：393 → 408，ID 一条没丢

```
comm -23 .scratch/r10-ids.txt .scratch/r11-ids.txt   →   （空）
```

新增 15 条（全部用**新编号**，没有复用旧编号装新内容）：

| 用例 | 钉的是哪一条口径 |
|---|---|
| `srv/06` | 必修 1 / 8.1：房间进程**印出来的那一个 URL** 逐字跟到底就是联机页（`pathname === '/webui/'` + 正文含 `id="netUrl"`），并对照 `/` 仍 302 到 M1.5（那条映射一字未动）。这一条是被变异 M03 逼着补强的，见 11.3 |
| `srv/07` | 必修 2 / 8.2：`/%`、`/%zz`、`/%e0%A4%A`、`/webmin/%%` 四发全部 **400 `malformed percent-escape`**，且真 spawn 的进程打完之后对合法路径仍然 200（"进程还活着"是断言里的一条，不是我的口头判断） |
| `nui/19` | 应修 2 / 8.3：一条**没过 schema 校验**的下行不再清凭据；判据换成 `peer.info().errors` 之后，只有合法 `bad_token` 才触发"清 + 重入桌"，且抓到越界（停手）那一侧绝不自动重入桌 |
| `nui/20` | 应修 4 / 8.8 前半：`lastReject` 在"我发出的下一个行动被接受"之后从提示行过期；同时钉住两个面的分工 —— 提示行会过期，审计面 `info().rejects` 只增不减 |
| `nui/21` | 应修 5 / 8.8 后半：服务端 `notice`（入座 / 没交份额 / 挪庄）出现在 `snapshot().log`，且是**附加**在引擎日志之前；键集仍与单机快照逐字一致、40 行上限不被撑破。未开局（collect）那一段的占位分支同样带 notices |
| `nui/22` | 应修 7 / 8.9 选①：`total` === 在场各家的筹码 + 池；`ledgerLine` 不列不在场那家；`TOTAL_LABEL` 含"在场"且不含"桌上"；`buildScene` 底部那一行**以标签开头并带着同一个数**；`房间整本账 − total` 正好等于离桌那一家的余额 |
| `nui/23` | 8.12(i)：座位格主路径（`netplay` 把 `view.seats` 那一行映射成格子）在三个时刻各逐项比对 —— 开局（谁都没看牌）/ 甲看牌之后 / 打完结算；牌面、等级、筹码、已投入、`looked`、`active`、状态、庄/行动标记、结算文案共 27 项 |
| `nui/24` | 8.13 预告的注入点：把**真发下来过的**一条 `patch` 只改 `seats[i].cards`（塞进别家三张牌），喂进页面那条真管道 ⇒ `patch unusable: cards of seat N exposed while revealed=false` 落进 `violations`、投影**不被采纳**（格子里仍是 `···`）、日志区印出"这一局不可信"、五个按钮塌成一个不可点的"已停手"、`act()` 再也发不出去。对照组：同一工装下的合法 patch 零越界 |
| `nui/25` | 8.13 的另一半（边界如实成文）：`patch` 上改 `chips`/`pot` **抓不到** —— 公开权威数字没有可独立核对的第二来源；同一条 patch 重放（seq 接不上）则**当场**被抓，作对照。房间侧账目一位不动、下一帧权威面把显示纠回来、揭示核对仍然只认份额与承诺 |
| `nui/26` | §5(d) 点名的 `netplay.ts::readSaved` 那条 catch：per-tab 存储里躺着**半截 JSON** 时会话仍然建得起来、降级成"没有凭据"、入桌照常、并把新凭据写回去；对照组放一条结构合法的凭据 ⇒ `resumeWire()` 出得来（证明前面那条 `null` 不是把路写死） |
| `ws/07` | 应修 9 / 8.12(ii)：`onHttpRequest` 故意抛 ⇒ 那层 catch 回 **500 且带异常原文**；`/health` 仍然 200、`fault` 仍为 null、真 WebSocket 升级照常（连接不残留、服务不被卡住）；对照组：钩子自己应答时 203 说了算、钩子答"没处理"时仍是那句 404 |
| `ws/08` | 8.12(ii) 的另一半：`Connection` 那三种"我们的 `headerList` 不肯放行"的写法（`Upgrade Keep-Alive`、`Upgrade\tKeep-Alive`、`Upgrade Upgrade`、`Upgrade:`）全部由 **Node 层答 404**（判据是正文那句 `this endpoint is a websocket room`），而 `Upgrade: HTTP` 那种才是**我们**答的 400（无正文 + `Connection: close`）⇒ `ws.ts:164-167` 在本机 Node 上按构造不可达；这条不是"没找到用例"，是有实测 |
| `srv/08` | §5(d) 点名的 `webmin/serve.ts` 那条 404/500 catch：在**进程内**直接打 `serveStatic` —— `/webui/no-such-file.ts` 与 `/src/engine/nope.ts` 都必须回 **404 并带 ENOENT 原因**（服务端什么都没坏，不许报 500），响应形状一起钉（纯文本 + `no-store`）；对照组 `/webui/index.html` 仍 200 + `text/html`，并钉 `/webui/` 走 302 到真实位置 |
| `nst/12` | 应修 7 的静态面：标签文案 / 渲染处 / `departed` 过滤 / 两个页面入口（画布 + M1.5 的 DOM 台账行）四道判据互锁，另带三组正向对照（只改文案、只改过滤、绕开常量各命中一条） |
| `rules/20` | §5(d) 点名的 `src/rules.ts::crossField` 两条可达而未测的抛（`players.min>max`、`stake.initial>max`），带等号边界与两个 preset 的不抛对照 |

`nst/04` 未动：`webui/` 里仍然只有 `netplay.ts` 一个 `netx/` 进口（8.3 的"不许有第二份协议实现"照旧有机检）。

## 11.3 变异扫描：本轮 13 条，13 caught / 0 survived / 0 skipped

工装与 rev=10 同一套：单锚点就地打坏 → 全量跑 → 还原并核对 sha；锚点命中 0 次或多次 ⇒ 判 SKIPPED（绝不"改不动就算了"，那等于门是虚的）。

| id | 打坏的是什么 | 抓到它的门 | 结果 |
|---|---|---|---|
| M01 | `netx/ws.ts` 的 500 兜底降级成 400（复审明令"别顺手改成 400"那一档） | `ws/07` | caught |
| M02 | `netx/ws.ts` 兜底不再带异常原文 | `ws/07` | caught |
| M03 | `netx/serve.ts` 横幅从 `${uiUrl}` 退回 `${httpUrl}`（= 必修 1 的原始缺陷形状） | `srv/06` | **caught（第一次逃掉，补强后才被抓）** |
| M04 | `webmin/serve.ts` 畸形转义从 400 漂回 500（必修 2 的状态码档位） | `srv/07` | caught |
| M05 | 标签文案漂回「桌上总额」（只改文案不改过滤） | `nui/22` + `nst/12` | caught（两条门各响一次） |
| M06 | 只把 `departed` 过滤摘掉而不改标签（裁定点名的"不接受的改法"） | `nst/12` | caught |
| M07 | 离桌占位格不说"本局不参与" | `nui/22` | caught |
| M08 | 未开局（collect）那段日志区不含服务端说明 | `nui/21` | caught |
| M09 | 主分支日志区不再并 `notices` | `nui/21` | caught |
| M10 | 发出新行动后不清 `lastReject`（应修 4 的提示行过期） | `nui/20` | caught |
| M11 | `rejects` 审计面不再累积 | `nui/20`（并带 `room/04/05/12/20/24` 同族） | caught |
| M12 | 座位格的 `resultText` 恒空（主路径少一列） | `nui/23` | caught |
| M13 | `checkViewLeak` 只认揭示、不认投影里的别家牌面 | `nui/24`（并带 `leak/05`、`proto/07`、`proto/08`） | caught |

**M03 逃掉的经过（本轮唯一一次"门是虚的"）**：`srv/06` 第一版读横幅的方式是
`waitLine(/页面 (http:\/\/127\.0\.0\.1:\d+\/)\S*/)` —— 只捕获**源**，然后测试自己再拼一个 `webui/` 去 fetch。
于是横幅里印的到底是 `/` 还是 `/webui/` 根本没进断言，把横幅改回 `httpUrl` 照样全绿。
改成逐字取横幅里那一个字符串（`/页面 (http:\/\/127\.0\.0\.1:\d+\/\S*)/`）之后：① 断言它的 `pathname === '/webui/'`；
② 原样跟到底必须含 `id="netUrl"` —— 两条都是复审 8.1 给的判据，M03 随即被抓。

补强过程中还撞出**一件工装缺陷**：断言失败发生在 `kid.write('quit')` **之前**时子进程活着 ⇒
父进程握着那条 stdout 管道 ⇒ `node test/run.ts` 打完全绿却永远不退出（表现为"跑测挂住"，本机实测两次）。
现在 `runNode` 那一段包进 `try/finally`，无论断言成不成都把子进程送走。

**没有对应变异的一条，如实写明**：`ws/08` 钉的是"本机 Node 的 http 解析层在把请求派发成 upgrade 事件之前，
已经要求 `Connection` 头以 upgrade 成词"这一**分档事实**；纵深防御的那三行 400 够不到，
把它整段删掉也不会有用例变红 ⇒ 它是地面真值记录，不是行为门。同步写进 `SELF-REVIEW.md` 11-F。

## 11.4 覆盖 oracle v4 重跑（脚本 = 监督方 `.audit/rev10/sup-cov-final2.mjs`，只读不改）

```
NODE_V8_COVERAGE=.scratch/r11-cov node test/run.ts        # 408 全绿；四个进程的 coverage JSON 落进同一目录
node .audit/rev10/sup-cov-final2.mjs .scratch/r11-cov      # 报告原文 → .scratch/r11-cov-report.txt
```

| 量 | rev=10（复审的 v4 读数） | rev=11（本轮同一脚本） |
|---|---|---|
| 全局 | 22 文件 / **53 段** / 5548 行覆盖 5363 = 96.7% | 22 文件 / **43 段** / 5625 行覆盖 5484 = **97.5%** |
| `netx/ws.ts` | 221/236 = 93.6%，`:146-149` 零覆盖 | **225/236 = 95.3%**，`:146-149` 已覆盖（`ws/07`） |
| `webui/netplay.ts` | 86.9% / 9 段（含 `:394-410` 主路径） | **502/522 = 96.2% / 3 段**：主路径、离桌占位格、未开局占位快照、`readSaved` 的 catch 都进来了 |
| `netx/client.ts` | 98.2% | **333/338 = 98.5%**（`ping()` 死接口按 rev=9 必修 2 的判据删除，见 11-E） |
| `src/rules.ts` | 2 段（`crossField` 两条可达未测） | **1 段**（只剩 `:125-127` 那条 `exhausted: never` 恒真兜底） |
| `webmin/serve.ts` | 三段未覆盖 | **126/148 = 85.1% / 3 段**（`srv/08` 在进程内直接打 `serveStatic`，把 ENOENT→404 那一段收了；剩下三段属"子进程被 SIGKILL 送走 ⇒ V8 不刷 coverage"那一类，见 11-F） |
| 仍然 100.0% 的文件 | `netx/seed.ts`、`netx/sha256.ts`、`src/cards.ts`、`src/engine/project.ts`、`webui/bridge.ts` | 同上五条不变 |

三条**地面真值自检**的读数与改判（复审 §8.4 要求脚本末尾自动打印；自检不过 ⇒ 整份覆盖率结论作废）：

| 自检 | rev=10 的期望 | rev=11 实得 | 判读 |
|---|---|---|---|
| A `netx/ws.ts:146-149` | 全为 2（未覆盖） | **`1111`** | 工具没坏 —— 这条由红翻绿正是 `ws/07` 落地的形状。下一轮沿用该脚本时，这一条的期望值应改成"全为 1"，否则会被误判成"自检失败" |
| B `netx/serve.ts:75-86` | 含 1 | `1111011` | 仍然成立（`srv/03` 的真 spawn 把覆盖刷了出来） |
| C `webmin/serve.ts:117-121` | 含 2 | **`11111`** | 这条也被翻绿了：`srv/08` 在进程内直接打 `serveStatic`，ENOENT→404 那一段真的被执行到（不是靠子进程刷 coverage）。下一轮这一条的期望值同样应改成"全为 1" |

逐段披露（43 段、一行一段）写在 `SELF-REVIEW.md` 11-F；§5(c) 那四段"按构造不可达 + 具体前提"也在同一张表里。

## 11.5 `npm test` 完整输出（第 1 次运行原文，408 例）

```

> zjh@0.0.0 test
> node test/run.ts

=== ZJH TEST REPORT (deterministic) ===
PASS test/ai-honest.test.ts :: ai/01 牌力先验表 = 22100 手全枚举的事实
PASS test/ai-honest.test.ts :: ai/02 分位表按 classic 写死，但 a23off 下的偏差 < 2pp（所以表可以不分 preset）
PASS test/ai-honest.test.ts :: ai/03 牌力分位单调，且跨档不倒挂（弱档最强手 <= 强档最弱手）
PASS test/ai-honest.test.ts :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）
PASS test/ai-honest.test.ts :: ai/05 看过牌后才按牌力决策：强牌加注、中带跟、烂牌弃
PASS test/ai-honest.test.ts :: ai/06 池赔率真的进了决策：同一副牌，池给得大方就跟、池小就弃
PASS test/ai-honest.test.ts :: ai/07 对手数量真的进了决策：同一副牌同一赔率，人越多越保守
PASS test/ai-honest.test.ts :: ai/08 看牌/保持闷是真决策：最低注级闷着省钱，注级一抬就先转明
PASS test/ai-honest.test.ts :: ai/09 只出合法行动、闷着绝不加注也绝不比牌、比牌必是合法目标（200 组随机合法集合）
PASS test/ai-honest.test.ts :: ai/12 比牌触发率 = 1000 个 seq 上量得出来，且完全由 seq+座位决定（可重放）
PASS test/ai-honest.test.ts :: ai/10 纯函数：同一输入两次调用结果逐字相同（fuzz 与回放的前提）
PASS test/ai-honest.test.ts :: ai/11 先验与 tierOrder 挂钩：把档位排列倒过来，分位表跟着倒
PASS test/ai-honest.test.ts :: ai/13 比牌目标 = 活跃对手中已投入最高者；本局已比过则不再比
PASS test/ai-honest.test.ts :: ai/13b 投入并列时按环形序选目标，而不是按座位号大小（变异 C06 复发哨）
PASS test/ai-honest.test.ts :: ai/14 掷点只由 seq+座位决定：同输入同结果、同 seq 换座位换结果
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/classic 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/a23off 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/档位集合 六档键完全一致且无重复，计数均为非负整数
PASS test/classify.test.ts :: classify/闭式结构 trips 与 pair 与 a23 无关，其余四类随 runs 移动
PASS test/classify.test.ts :: classify/输入顺序无关 455 规范类 × 6 排列判定全同（两 preset）
PASS test/classify.test.ts :: classify/A23 一族 64 手在两 preset 下的迁移符合公式
PASS test/classify.test.ts :: classify/归一化键 顺子高点 A23=3 / 234=4 / QKA=14 且长度为 1
PASS test/classify.test.ts :: classify/归一化键 对子=[对子点, 踢脚]，穷举 3744 手
PASS test/classify.test.ts :: classify/归一化键 豹子 ranks=[r]，穷举 52 手
PASS test/classify.test.ts :: classify/NOTES 打印计数三元组（实际/闭式/锚点）供独立复算
PASS test/compare.test.ts :: compare/01 规范类数量 = C(15,3) = 455
PASS test/compare.test.ts :: compare/02 自反：每类与自身比较 = 0
PASS test/compare.test.ts :: compare/03 反对称：455^2 = 207025 全对，cmp(a,b) = -cmp(b,a)
PASS test/compare.test.ts :: compare/04 传递性穷举：(a>=b && b>=c) ⇒ a>=c，全 455^3 三元组
PASS test/compare.test.ts :: compare/05 花色不参与：全体花色平移 +1 后仍判 0
PASS test/compare.test.ts :: compare/06 与独立整数键参考实现交叉一致（455^2 全对）
PASS test/compare.test.ts :: compare/07 tierOrder 整序反转：跨档对全部翻转、同档对不变
PASS test/compare.test.ts :: compare/08 tierOrder 局部改动即刻生效（把 pair 提到 trips 之上）
PASS test/compare.test.ts :: compare/09 固定种子 1000 手排序后做全对序校验（不只是相邻）
PASS test/compare.test.ts :: compare/10 牌型序链：豹子>同花顺>同花>顺子>对子>单张（15 对全断言）
PASS test/compare.test.ts :: compare/11 tierOrder 缺档时 compare 抛错而不静默
PASS test/compare.test.ts :: compare/12 档位优先于点数：最小同花顺 > 最大普通顺等交叉断言
PASS test/deck.test.ts :: deck/01 makeDeck 长度 52 且逐位满足 index = suit*13 + (rank-2)
PASS test/deck.test.ts :: deck/02 52 张互不相同
PASS test/deck.test.ts :: deck/03 makeDeck 每次返回新数组与新对象（无共享可变状态）
PASS test/deck.test.ts :: deck/04 mulberry32 同 seed 的 1000 项序列完全一致
PASS test/deck.test.ts :: deck/05 不同 seed 的序列不同
PASS test/deck.test.ts :: deck/06 输出恒为非负 uint32 整数（1e6 次采样，覆盖边界 seed）
PASS test/deck.test.ts :: deck/07 seed 非整数抛 TypeError
PASS test/deck.test.ts :: deck/08 shuffle 原地：返回值与入参是同一个数组引用
PASS test/deck.test.ts :: deck/09 shuffle 结果是原牌堆的一个排列
PASS test/deck.test.ts :: deck/10 同 seed 两次洗牌逐位一致，不同 seed 至少一处不同
PASS test/deck.test.ts :: deck/11 52 张牌恰好调用 rng 51 次
PASS test/deck.test.ts :: deck/12 rng 返回浮点/负数/非数一律抛 TypeError
PASS test/deck.test.ts :: deck/13 空牌堆与单元素牌堆不调用 rng、不抛
PASS test/deck.test.ts :: deck/14 发牌烟雾：seed=1 洗完发 6 家，每手都可判定
PASS test/deck.test.ts :: deck/16 洗牌分布公平性：固定种子 20000 轮，52 个落点计数都在容差内
PASS test/deck.test.ts :: deck/17 三张牌穷举 144 种 rng 输出：每张牌的落点计数恰为 48
PASS test/deck.test.ts :: deck/18 NOTES 打印 PRNG 与洗牌的规范向量（供跨端复算）
PASS test/deck.test.ts :: deck/19 与独立誊写的参考 mulberry32 逐位一致（钉住结构与常数）
PASS test/deck.test.ts :: deck/20 rng 恒为 0 时输出等于牌堆左旋一格（钉住从尾往前的遍历方向）
PASS test/edge.test.ts :: edge/01 §3.5 A♠2♦3♣ < 3♠4♦5♣（A23 是最小顺）
PASS test/edge.test.ts :: edge/02 §3.5 A♥2♥3♥ 是同花顺且 > 4♣5♦6♣（档位优先于点数）
PASS test/edge.test.ts :: edge/03 §3.5 2♦2♣2♥ > A♠K♠Q♠（豹子 > 同花顺）
PASS test/edge.test.ts :: edge/04 §3.5 A♦A♣3♠ > K♦K♣A♠（对子点优先，踢脚再大也没用）
PASS test/edge.test.ts :: edge/05 §3.5 同点同级 → 0（花色完全不参与）
PASS test/edge.test.ts :: edge/06 绕 A 不成顺：A♠K♦2♣ 是单张而不是顺子
PASS test/edge.test.ts :: edge/07 最大豹子 > 最小豹子 > 任意同花顺
PASS test/edge.test.ts :: edge/08 a23off 下 A♥2♥3♥ 降为同花、A♠2♦3♣ 降为单张
PASS test/edge.test.ts :: edge/09 A 在非顺子牌型里取 14
PASS test/edge.test.ts :: edge/10 归一化键长度按档固定：豹子/顺 1 位、对子 2 位、同花/单张 3 位
PASS test/edge.test.ts :: edge/11 非法手牌：长度≠3 抛 TypeError
PASS test/edge.test.ts :: edge/12 非法手牌：两张同一牌（同点同花）抛 TypeError
PASS test/edge.test.ts :: edge/13 非法牌面：rank / suit 越界、非整数、NaN 都抛 TypeError
PASS test/edge.test.ts :: edge/14 非法手牌容器：非数组 / 元素非对象 / 缺字段抛 TypeError
PASS test/edge.test.ts :: edge/15 compare 两侧都继承 classify 的非法输入检查
PASS test/edge.test.ts :: edge/16 rules 结构缺失时不静默：缺 handEval 抛 TypeError
PASS test/edge.test.ts :: edge/17 单张的型内比较只看归一化后的三点
PASS test/engine-core.test.ts :: core/01 startHand 不变量：底注入池、每人扣 ante、游标在庄家下家、计数归零
PASS test/engine-core.test.ts :: core/02 发牌互不重叠且都来自标准 52 张
PASS test/engine-core.test.ts :: core/03 发牌顺序 = 独立复算的洗牌结果（庄家下家起连续取牌）
PASS test/engine-core.test.ts :: core/04 庄家必须在座位表里
PASS test/engine-core.test.ts :: core/05 配置非法一律抛 TypeError（人数越界 / 重复座位 / 付不起底注 / seed 非整数）
PASS test/engine-core.test.ts :: core/06 apply 是纯函数：对旧状态深冻结后再推进行动，不抛（说明没有原地写）
PASS test/engine-core.test.ts :: core/07 stateHash 对状态变化敏感、对重放稳定
PASS test/engine-core.test.ts :: core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值
PASS test/engine-core.test.ts :: core/09 资金守恒：开局到结算，筹码 + 池恒等于买入总额
PASS test/engine-core.test.ts :: core/10 同一配置重复开局得到同一状态（引擎里没有隐藏全局态）
PASS test/engine-core.test.ts :: core/11 日志单调：seq 逐条 +1，type 全部来自固定集合
PASS test/engine-core.test.ts :: core/12 引擎对 2 人与 6 人都能开局（人数只受 rules.players 约束，不硬编码）
PASS test/engine-core.test.ts :: core/13 终止阈值不多不少：注级 8 上各家满 2 次仍在局里，满 3 次才 stall
PASS test/engine-fuzz.test.ts :: fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码
PASS test/engine-fuzz.test.ts :: fuzz/02 三种终止条件都能被随机行动打到（换策略覆盖 ②③）
PASS test/engine-fuzz.test.ts :: fuzz/03 2–6 人局全部跑通且守恒
PASS test/engine-fuzz.test.ts :: fuzz/04 非法行动注入：一律抛 InvalidActionError，且状态指纹不变
PASS test/engine-fuzz.test.ts :: fuzz/05 回放确定性：同 seed + 同行动序列 ⇒ 同指纹（20 局）
PASS test/engine-fuzz.test.ts :: fuzz/06 结算幂等：settle 前后指纹稳定，且只入账一次
PASS test/engine-illegal.test.ts :: illegal/01 不轮到你 → not_current_turn（三种动作各一例）
PASS test/engine-illegal.test.ts :: illegal/02 座位不存在 → bad_seat
PASS test/engine-illegal.test.ts :: illegal/03 行动对象本身不合法 → unknown_action
PASS test/engine-illegal.test.ts :: illegal/04 首圈禁比：任何人第一次行动之前都不能比牌，全员各一次后立刻放开
PASS test/engine-illegal.test.ts :: illegal/05 比牌目标非法：自己 / 已弃牌 / 不存在的座位
PASS test/engine-illegal.test.ts :: illegal/06 重复看牌被拒；看牌不消耗行动数也不推进游标
PASS test/engine-illegal.test.ts :: illegal/07 注级顶格不能再加注
PASS test/engine-illegal.test.ts :: illegal/08 钱不够 ⇒ 唯一合法行动是弃牌（全押禁用，§1 全押行）
PASS test/engine-illegal.test.ts :: illegal/09 已弃牌的座位不会再被要求行动，硬塞则 seat_not_active
PASS test/engine-illegal.test.ts :: illegal/10 终局后所有下注类行动被拒（phase_not_betting）
PASS test/engine-illegal.test.ts :: illegal/11 结算时机：没终局不能 settle；已结算再 settle 是幂等 no-op
PASS test/engine-illegal.test.ts :: illegal/12 legalActions 与 checkAction 判据完全一致（不轮到你时给出的是当前 turn 的动作集）
PASS test/engine-illegal.test.ts :: illegal/13 timeout 是普通行动：买得起 ≡ 跟注、买不起 ≡ 弃牌，且都过同一道 validate
PASS test/engine-money.test.ts :: money/01 底注：pool = ante × 人数，每人筹码与 committed 各扣/记一份
PASS test/engine-money.test.ts :: money/02 闷跟 = stake×bet.dark，明跟 = stake×bet.seen（三种注级各验）
PASS test/engine-money.test.ts :: money/03 加注：注级翻倍并按新注级付跟价（Q1 读法 B），且全员当前注级行动数清零
PASS test/engine-money.test.ts :: money/04 比牌费 = fee × stake 入池，与闷/明无关（注级 1/2/4 各验一次）
PASS test/engine-money.test.ts :: money/05 不变量：pot 恒等于各家 committed 之和；每步增量恰是 actionCost
PASS test/engine-money.test.ts :: money/06 弃牌不花钱也不退钱：弃牌者的 committed 留在池里（无边池无退款）
PASS test/engine-money.test.ts :: money/07 分池：整除时人人等份；有余数时给"距庄家下家最近"的赢家
PASS test/engine-money.test.ts :: money/08 幂等结算：入账只发生一次，重放 settle 不重复扣/发钱
PASS test/engine-money.test.ts :: money/09 任何时刻都不出现负筹码（全押禁用的直接后果）
PASS test/engine-money.test.ts :: money/10 结算后赢家所得 = 池，且各家 committed 之和 = 结算前 pot
PASS test/engine-project.test.ts :: project/01 谁都没看过牌：本人也是 unknown，他人一律 unknown（§1 看牌行）
PASS test/engine-project.test.ts :: project/02 序列化后仍然搜不到任何他人牌面（整条 view 一起查，含日志）
PASS test/engine-project.test.ts :: project/03 强制开牌后：活跃家全部可见，弃牌/被淘汰者仍然 unknown
PASS test/engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
PASS test/engine-project.test.ts :: project/05 seed 只在结算后才暴露（否则任何客户端都能反算整副牌）
PASS test/engine-project.test.ts :: project/06 公开信息一字不漏：池/注级/游标/计数/闷明/committed 全部同步
PASS test/engine-project.test.ts :: project/07 观战视角（viewer 不在座位表里）看不到任何未开的牌
PASS test/engine-project.test.ts :: project/08 视图是拷贝，改它不会污染引擎状态
PASS test/engine-project.test.ts :: project/09 终局信息公开：赢家集合、份额、余数归属都可投影
PASS test/engine-project.test.ts :: project/10 startHand 之后立刻投影：轮到行动也没看过牌 ⇒ 本人同样无牌可看
PASS test/engine-project.test.ts :: project/11 负向：未看牌时整条 view 序列化后搜不到本人牌面
PASS test/engine-project.test.ts :: project/12 revealed 优先于 looked：本人没看牌，被强制开牌后照样看得见自己的牌
PASS test/engine-scripts.test.ts :: scripts/01 弃至通吃（§1①）：只剩一人即结束，且不开牌
PASS test/engine-scripts.test.ts :: scripts/02 比牌链：连续两次比牌各淘汰一家，输家的牌永不公开
PASS test/engine-scripts.test.ts :: scripts/03 封顶开牌（§1②）：注级 16 且活跃各家再完成 1 次行动 ⇒ 强制开牌
PASS test/engine-scripts.test.ts :: scripts/04 stall 强开（§1③）：同一注级下活跃各家各满 3 次行动；加注会把计数清零重计
PASS test/engine-scripts.test.ts :: scripts/05 平局分池：两家打平 ⇒ 平分池，除不尽的余数给距庄家下家最近者
PASS test/engine-scripts.test.ts :: scripts/06 挑战者输：比牌平局时挑战者出局（§1 比牌行）
PASS test/engine-scripts.test.ts :: scripts/07 剩两家比牌 = 直接开牌定胜负（两家牌都亮）
PASS test/engine-scripts.test.ts :: scripts/08 三条终止路径各自都要能到达（覆盖性，不是只测一条）
PASS test/engine-scripts.test.ts :: scripts/09 每个脚本重放得到同一状态指纹（回放确定性）
PASS test/engine-timeout.test.ts :: timeout/01 (a) 全员托管的一手牌必然走完，且终局原因是 stall
PASS test/engine-timeout.test.ts :: timeout/02 (b) 付不起跟价的那一家回退成弃牌，且不欠款、不出现负筹码
PASS test/engine-timeout.test.ts :: timeout/03 (c) 已看牌者付明注价、未看牌者付闷注价
PASS test/engine-timeout.test.ts :: timeout/04 (d) 托管不产生 look / raise / compare 事件，也不替玩家看牌
PASS test/engine-timeout.test.ts :: timeout/05 托管仍是普通行动：同一道 validate，越界照样被拒
PASS test/engine-timeout.test.ts :: timeout/06 可归因性：玩家自主跟注的 note 里不许出现 timeout
PASS test/m2-fuzz.test.ts :: m2/01 随机合法行动 1000 局：守恒 / 无负筹码 / 无重复结算 / 有限步终止
PASS test/m2-fuzz.test.ts :: m2/02 诚实 AI 1000 局：只出合法行动、闷着不加注、决策数非零且必然终止
PASS test/m2-fuzz.test.ts :: m2/03 AI 臂与随机臂都打到全部三类终止条件（覆盖不是单边运气）
PASS test/m2-fuzz.test.ts :: m2/04 四类非法行动必被 validate 拒（不轮到你 / 钱不够 / 比已弃牌者 / 首圈禁比时段比牌）
PASS test/m2-fuzz.test.ts :: m2/05 牌力分位 ≈ 真实胜率，且档内端点随 a23 正确移动（两 preset 全枚举对拍）
PASS test/netx-client.test.ts :: client/01 收到 collect 里"还缺我"就立刻交一份份额，且一局只交一次
PASS test/netx-client.test.ts :: client/02 行动防呆：只有"轮到我且局面干净"才放行
PASS test/netx-client.test.ts :: client/03 服务端越界第一类：消息本身不合法 ⇒ 记录违规并拒绝继续
PASS test/netx-client.test.ts :: client/04 增量对不上号 ⇒ 不合并并记违规
PASS test/netx-client.test.ts :: client/05 快照的日志有洞 = 不可信
PASS test/netx-client.test.ts :: client/06 揭示核对的几类造假都会被当场发现
PASS test/netx-client.test.ts :: client/07 结算之前收到 deal 载荷（种子提前泄露）⇒ 违规并停手
PASS test/netx-client.test.ts :: client/08 error 分两类：漏牌即停手，普通回执不停手
PASS test/netx-client.test.ts :: client/09 重连消息带的是"我看到的 hand/seq"，没凭据时不发
PASS test/netx-client.test.ts :: client/11 揭示"自洽"但不是发牌用的那颗种子 ⇒ 仍然要报
PASS test/netx-client.test.ts :: client/10 旁观者的揭示（本局没参与、也没拿到过承诺）不报违规，也不算核对通过
PASS test/netx-client.test.ts :: client/12 收完份额之后改口重发承诺 ⇒ 当场识破，且那份"自洽揭示"随后也过不了（必修 1 主案）
PASS test/netx-client.test.ts :: client/13 对照组：不改口、只揭示另一个份额 ⇒ 承诺门独立就能抓住（洞在存储，不在核对逻辑）
PASS test/netx-client.test.ts :: client/13b 同值重发承诺要放过（断线补承诺），换局则重新开账
PASS test/netx-client.test.ts :: client/14 别人的承诺混进来仍然算越界（写一次门不改变这一条）
PASS test/netx-client.test.ts :: client/15 logShape 三道闸门报错文本互不相同，合法增量则一条不报（移植复审 S9）
PASS test/netx-client.test.ts :: client/16 拿到 token 但还没进过任何一手 ⇒ resume 发不出去（hand=0 是协议非法值），上层因此会改走 join
PASS test/netx-crypto.test.ts :: netx/01 SHA-256 命中 FIPS 180-4 公开向量
PASS test/netx-crypto.test.ts :: netx/02 与 node:crypto 逐字节差分（覆盖补齐边界与多字节 UTF-8）
PASS test/netx-crypto.test.ts :: netx/03 雪崩：改一个字符，256 位里至少一半上下变化
PASS test/netx-crypto.test.ts :: netx/04 base64 命中经典向量（长度余数 0/1/2 三条路径都走到）
PASS test/netx-crypto.test.ts :: netx/05 握手 accept 命中 RFC 6455 §1.3 向量，非法 key 抛错
PASS test/netx-crypto.test.ts :: netx/06 十六进制与字节的往返（承诺/份额的编码面）
PASS test/netx-crypto.test.ts :: netx/07 摘要入口对空输入与非空输入给出不同长度一致的输出
PASS test/netx-crypto.test.ts :: netx/08 SHA-1（握手用）与 node:crypto 差分，且命中 RFC 6455 §1.3 向量
PASS test/netx-frames.test.ts :: frame/01 编码的三档长度字段逐字节符合规范
PASS test/netx-frames.test.ts :: frame/02 客户端方向必须掩码，且 XOR 逐字节可复算
PASS test/netx-frames.test.ts :: frame/03 客户端→服务端：掩码帧能解，逐字节喂也要能解
PASS test/netx-frames.test.ts :: frame/04 掩码方向判反：客户端不掩码 / 服务端掩码 都拒
PASS test/netx-frames.test.ts :: frame/05 长度必须最小编码，64 位长度不得越出 32 位
PASS test/netx-frames.test.ts :: frame/06 RSV 位非 0 一律拒（没谈扩展就不许出现）
PASS test/netx-frames.test.ts :: frame/07 控制帧规则：ping/pong 原样交回，close 解析状态码
PASS test/netx-frames.test.ts :: frame/08 非法 close 一律拒（1 字节载荷 / 保留码 / 越界码）
PASS test/netx-frames.test.ts :: frame/09 控制帧不得分片、载荷不得过 125
PASS test/netx-frames.test.ts :: frame/10 文本分片可重组，控制帧插在中间也不丢序
PASS test/netx-frames.test.ts :: frame/11 跨分片的多字节字符不会解坏（UTF-8 状态在帧边界上延续）
PASS test/netx-frames.test.ts :: frame/12 非法帧序与未知操作码一律拒
PASS test/netx-frames.test.ts :: frame/13 巨帧、巨消息与编码侧都有上限
PASS test/netx-frames.test.ts :: frame/14 非法 UTF-8 文本帧拒收
PASS test/netx-frames.test.ts :: frame/15 握手 accept：已知向量 + key 边界
PASS test/netx-frames.test.ts :: frame/16 编码侧的三道参数自检：掩码键长度、分片点、pong 帧
PASS test/netx-frames.test.ts :: frame/17 64 位长度字段：非最小编码要拒、合法长帧要收、高 32 位不许越界
PASS test/netx-leak.test.ts :: leak/01 真实牌面在"亮牌"之前不出现在任何一条下行字节里（三家、跑完整一手）
PASS test/netx-leak.test.ts :: leak/02 种子与各家份额在揭示之前不外泄
PASS test/netx-leak.test.ts :: leak/03 中途加入的旁观者：既不在投影里，也没发现任何越界
PASS test/netx-leak.test.ts :: leak/04 增量重连与全量快照两条路收敛：日志逐条一致、数字一致
PASS test/netx-leak.test.ts :: leak/05 客户端第二道墙：服务端把别人的牌塞进投影 ⇒ 当场发现并拒绝再行动
PASS test/netx-leak.test.ts :: leak/06 上行 nonce 各交一份、互不相同，且承诺里读不出份额
PASS test/netx-netplay.test.ts :: nui/01 联机快照与单机快照键集逐字一致 ⇒ 同一套 scene/paint 不必改一个字
PASS test/netx-netplay.test.ts :: nui/02 只有一道墙：netplay 里不得出现第二份协议实现，也不得自己判规则算钱
PASS test/netx-netplay.test.ts :: nui/03 两家打完两整手：看牌 / 加注 / 比牌 / 结算面板 / 第二手轮庄，两侧数字逐字一致
PASS test/netx-netplay.test.ts :: nui/04 负向：没看牌时本人牌不在快照里，别家牌面全程不出现
PASS test/netx-netplay.test.ts :: nui/05 伪造下行：当场标"不可信"并停手；leak_blocked 与 replaced 的提示可区分
PASS test/netx-netplay.test.ts :: nui/06 断线重连：增量与快照两条路都真走到，台账一颗不错
PASS test/netx-netplay.test.ts :: nui/07 同一浏览器两个标签页各占一座：per-tab 存储互不覆盖；共享存储会翻车（对照）
PASS test/netx-netplay.test.ts :: nui/08 超时托管一路带到 UI：日志行里就是 timeout→call 的字样
PASS test/netx-netplay.test.ts :: nui/09 按钮：可用性只看服务端 phase/turn；金额来自引擎那一处算术且只进文案（Q6=A2）
PASS test/netx-netplay.test.ts :: nui/10 刷新之后仍能核对揭示：份额必须随凭据一起存下来
PASS test/netx-netplay.test.ts :: nui/11 (a) 端到端价格一致性：行动前页面显示的 cost === 行动后 log 里那条事件的 amount（跟/加/比各一次）
PASS test/netx-netplay.test.ts :: nui/12 (b) 闷/明差价在页面上看得见，且两个数都等于 priceOf 的输出（不是测试里手写的常量）
PASS test/netx-netplay.test.ts :: nui/13 (c) 买不起跟价的座位：按钮仍然可点、发得出去，代价由服务端 reject 送回来并被页面显示
PASS test/netx-netplay.test.ts :: nui/14 (d) 同一条按钮契约两条路共用一处算术：单机 buttonOptions 的 cost 与联机 buttonRow 的 cost 相等
PASS test/netx-netplay.test.ts :: nui/15 意图 → 动作的收窄：只有五种真行动能上协议线，推进类意图一律 null
PASS test/netx-netplay.test.ts :: nui/18 凭据作废（房间重启后 token 不认）⇒ 清存储 + 说清楚 + 自动补一条全新 join，页面不许停在"已连接、零下行"
PASS test/netx-netplay.test.ts :: nui/17 页面模块图在静态服务策略下完整可达（浏览器实测抓到的那类 403 由这条兜住）
PASS test/netx-netplay.test.ts :: nui/16 入口层静态门：main.ts 只接线不判规则，联机那一侧只有一个进口
PASS test/netx-netplay.test.ts :: nui/19 过不了 schema 的下行不许清凭据、不许强制重入桌；已停手的那一世也不许再发上行（rev=10 应修 2）
PASS test/netx-netplay.test.ts :: nui/20 上一条 reject 在我发出新行动之后必须过期（提示行不许陈述已翻篇的事实，rev=10 应修 4）
PASS test/netx-netplay.test.ts :: nui/21 服务端 notice 上到日志区：玩家既看得见结果、也看得见原因（rev=10 应修 5）
PASS test/netx-netplay.test.ts :: nui/22 底部那行数字的标签与 departed 过滤同口径：是「在场筹码+池」，不是「桌上总额」（rev=10 应修 7 / §8.9）
PASS test/netx-netplay.test.ts :: nui/23 在座座位格是服务端那一行的逐项映射：牌面/等级/筹码/已投入/状态/庄标/隐藏（rev=10 §8.12 i 主路径）
PASS test/netx-netplay.test.ts :: nui/24 中间人改 patch：往我的 view 里塞别家的牌面必须被抓、不许采纳、页面立刻停手（rev=10 §8.13）
PASS test/netx-netplay.test.ts :: nui/25 patch 上改 chips/pot 抓不到 —— 这是权威面的边界，页面只照抄不背书（与 nui/24 成对）
PASS test/netx-netplay.test.ts :: nui/26 per-tab 存储里那坨值是坏 JSON：会话建得起来、当作没有凭据、入桌照常（netplay.ts::readSaved 的 catch）
PASS test/netx-protocol.test.ts :: proto/01 双向消息 encode→check 往返保真，且字节稳定
PASS test/netx-protocol.test.ts :: proto/02 未知 key 一律拒（顶层、嵌套 move、嵌套 view、rules 内部）
PASS test/netx-protocol.test.ts :: proto/03 缺 key 与类型不符一律拒
PASS test/netx-protocol.test.ts :: proto/04 数值与长度越界一律拒
PASS test/netx-protocol.test.ts :: proto/05 引擎拒绝码全集与 src/engine/validate.ts 逐字对齐（防契约漂移）
PASS test/netx-protocol.test.ts :: proto/06 服务端实际发出的 net 拒绝码都在声明集合里，且声明集合没有空转项
PASS test/netx-protocol.test.ts :: proto/07 checkViewLeak 拦住五种越界投影，放过两种合法情形
PASS test/netx-protocol.test.ts :: proto/08 已看牌但未亮牌的"别人"仍然算泄漏（rev=4 口径在网络层同样生效）
PASS test/netx-protocol.test.ts :: proto/09 toAction 只能用绑定的座位，compare 才带 target
PASS test/netx-protocol.test.ts :: proto/10 校验错误信息带路径，便于线上定位
PASS test/netx-protocol.test.ts :: proto/11 巨帧保护：超过上限的字符串直接拒
PASS test/netx-protocol.test.ts :: proto/12 出口编码也过同一套校验：服务端构造出非法消息时本地就炸，不发到线上
PASS test/netx-protocol.test.ts :: proto/13 入参既不是 JSON 文本也不是对象 ⇒ 报"必须是文本或对象"，不报成 schema 错（rev=9 应修 3）
PASS test/netx-room.test.ts :: room/01 两家入座即开局：hello→承诺→份额→发牌，第三条连接中途加入不参与本局
PASS test/netx-room.test.ts :: room/02 承诺先于任何份额被接受（线上顺序可查，且承诺不是份额本身）
PASS test/netx-room.test.ts :: room/03 没凑齐份额就不发牌；凑齐的那一刻发牌，且发牌后种子仍不外泄
PASS test/netx-room.test.ts :: room/04 发牌之后再交份额一律被拒，且局面一字不动
PASS test/netx-room.test.ts :: room/04b 收份额阶段：错局号与"不在这局里"的家都被拒
PASS test/netx-room.test.ts :: room/05 座位由连接绑定：上行里没有 seat 字段，越界与伪造一律无副作用
PASS test/netx-room.test.ts :: room/06 完整一手：行动、结算、揭示核对，客户端零违规、总筹码守恒
PASS test/netx-room.test.ts :: room/07 全程没人动手：超时托管把一手牌走到结算，且走的是"自动跟注"这条臂
PASS test/netx-room.test.ts :: room/08 断线重连·seq 对得上 ⇒ 只补增量，补齐后三家视图与日志逐条一致
PASS test/netx-room.test.ts :: room/09 断线跨了一局再回来 ⇒ 拿的是新一局的快照，且本局种子对它合法可见
PASS test/netx-room.test.ts :: room/10 掉线者不交份额 ⇒ 到点改成两人局，牌局照常走完
PASS test/netx-room.test.ts :: room/11 多局连续：轮庄、筹码结转、每一局的揭示都对得上
PASS test/netx-room.test.ts :: room/12 桌上凑不齐两家就收桌：破产者下一局不再入池，筹码一颗不少
PASS test/netx-room.test.ts :: room/13 重连凭据的保护：乱 token 不绑座，真 token 回原位并顶掉旧连接
PASS test/netx-room.test.ts :: room/14 承诺与揭示双向绑定：打得开、合得出、换一家就对不上
PASS test/netx-room.test.ts :: room/15 房间层的门槛：最小买入与满座都不占座
PASS test/netx-room.test.ts :: room/16 driveToSettle 走的一手牌必然在有限步内终止（引擎不变量在联机层同样成立）
PASS test/netx-room.test.ts :: room/17 结算之后才回来的那一家，承诺+快照+揭示一起补回（审计材料不因断线丢失）
PASS test/netx-room.test.ts :: room/20 阶段门在房间层：awaitingSettle 之后的行动被房间挡下（不是丢给引擎）
PASS test/netx-room.test.ts :: room/19 没绑上座位的连接：任何游戏消息都只会拿到 no_seat，不会碰到局面
PASS test/netx-room.test.ts :: room/18 定时器不泄漏：发牌后 nonce 表必须取消，结算后只剩局间那一只
PASS test/netx-room.test.ts :: room/21 应用层 ping→pong 端到端（rev=8 里这条路径零覆盖）
PASS test/netx-room.test.ts :: room/22 已经绑上座位的连接再 join ⇒ already_joined，座位绑定不动
PASS test/netx-room.test.ts :: room/23 拿别人座位的 token 在已绑座的连接上重连 ⇒ token_seat_mismatch
PASS test/netx-room.test.ts :: room/24 行动阶段的两道门：没有牌局 ⇒ not_dealt，局号错位 ⇒ bad_hand
PASS test/netx-room.test.ts :: room/25 份额阶段的两道门：没有牌局 ⇒ not_dealt，不在本局名单里的 party ⇒ no_seat
PASS test/netx-room.test.ts :: room/26 诊断面的连接清单按码点序给出（与份额定序同一把尺，rev=8 应修 5）
PASS test/netx-room.test.ts :: room/27 构造期三道 TypeError 各自说清越界在哪（rev=9 应修 1）
PASS test/netx-room.test.ts :: room/28 到点还凑不齐最低人数 ⇒ 本局作废、只挂局间表、到点重开为第二局（rev=9 应修 2）
PASS test/netx-room.test.ts :: room/29 庄家那一座没交份额 ⇒ 剔除之后庄家必须挪到还在桌的一家，牌局照常开（旧行为：整个房间进程被 TypeError 打死）
PASS test/netx-seed.test.ts :: seed/01 承诺把 hand / party / 份额三者绑在一起
PASS test/netx-seed.test.ts :: seed/02 合成与提交顺序无关（任何一端都能独立复算）
PASS test/netx-seed.test.ts :: seed/03 改任何一家的份额，种子必变（没有旁观者）
PASS test/netx-seed.test.ts :: seed/04 没有任何一家能决定种子：固定其余各家，逐家扫描 32 个候选
PASS test/netx-seed.test.ts :: seed/05 局号参与合成：同一批份额在不同局给出不同种子
PASS test/netx-seed.test.ts :: seed/06 合成结果是引擎接受的 uint32 整数
PASS test/netx-seed.test.ts :: seed/07 非法份额输入一律抛错（含能造成拼接歧义的字符）
PASS test/netx-seed.test.ts :: seed/08 揭示核对：一一对上才算通过
PASS test/netx-seed.test.ts :: seed/09 承诺文本是单射的：改一个字符就换摘要（雪崩在这里体现为不可伪造）
PASS test/netx-seed.test.ts :: seed/10 座位方命名在 party charset 内，且与"server"不撞
PASS test/netx-seed.test.ts :: seed/12 合成用的是完整 32 位（截断成 16 位会被这条抓到）
PASS test/netx-seed.test.ts :: seed/13 定序只用码点键：seedVector 与 canonicalShares 是同一把尺（rev=8 必修 4）
PASS test/netx-seed.test.ts :: seed/14 互为前缀的 party 名（seat:1 与 seat:10）：定序排的是 party，不是拼接串
PASS test/netx-seed.test.ts :: seed/11 固定向量：复审可照抄复算
PASS test/netx-serve.test.ts :: srv/01 房间进程在空闲端口上起来：/health 与 webui 页面同源同端口
PASS test/netx-serve.test.ts :: srv/02 两家从房间进程真跑一手牌：跨真 socket 的揭示核对通过，零越界
PASS test/netx-serve.test.ts :: srv/03 一条命令起、一句 quit 干净退出（退出码 0，不是被硬杀）
PASS test/netx-serve.test.ts :: srv/04 坏端口参数：退出码 2 且留一句话
PASS test/netx-serve.test.ts :: srv/05 默认端口在"房间进程"与"页面输入框"两处不许各说各话
PASS test/netx-serve.test.ts :: srv/06 横幅里印出来的那个页面 URL 就是联机页（rev=10 必修 1）
PASS test/netx-serve.test.ts :: srv/07 一条畸形百分号转义打死独立静态服务（rev=10 必修 2）⇒ 现在回 400 且进程存活
PASS test/netx-serve.test.ts :: srv/08 文件不存在回 404（不是 500），响应形状与 no-store 口径一起钉住
PASS test/netx-static.test.ts :: nst/01 扫描范围覆盖 netx 全部源文件，可移植清单里的文件都真实存在
PASS test/netx-static.test.ts :: nst/02 零第三方依赖：netx 里每个 import 都是相对路径或 node: 内置
PASS test/netx-static.test.ts :: nst/03 协议核心里没有时钟、随机与 IO（引擎的确定性口径延续到联机层）
PASS test/netx-static.test.ts :: nst/04 分层：src/ 与 webmin/ 完全不知道联机存在；webui 里只有 netplay.ts 这一个进口
PASS test/netx-static.test.ts :: nst/05 tsconfig 的 include 覆盖 netx，且沿用同一条可擦除语法约束
PASS test/netx-static.test.ts :: nst/06 netx 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）
PASS test/netx-static.test.ts :: nst/07 M4 之后依赖面仍然没扩：dependencies 空、devDependencies 仍在白名单内
PASS test/netx-static.test.ts :: nst/08 房间层的时钟与随机全部来自注入（RoomOptions 是唯一的入口）
PASS test/netx-static.test.ts :: nst/10 Q6=A2 ④：价格公式不许扩散 —— 页面侧只有 netplay.ts 这一个接缝
PASS test/netx-static.test.ts :: nst/11 跑测工装必须挡住"带 PID 的实验警告"这条双跑破口（§0.5）
PASS test/netx-static.test.ts :: nst/09 M4 的测试文件自己也不许用时钟与随机（否则双跑必然不一致）
PASS test/netx-static.test.ts :: nst/12 「在场筹码+池」一把尺：标签、渲染处、过滤口径、两个页面入口必须同进退（rev=10 应修 7）
PASS test/netx-ws.test.ts :: ws/01 三个独立 WebSocket 客户端打进来，跑完整一手并各自核对揭示
PASS test/netx-ws.test.ts :: ws/02 /health 可读；普通 HTTP 请求不会误入升级分支
PASS test/netx-ws.test.ts :: ws/03 握手与帧的严格性在真 socket 上生效：合法 101、旧版本 426、未掩码被 1002 关掉
PASS test/netx-ws.test.ts :: ws/05 非法握手的每一条都被拒，且拒绝不在房间里留下连接
PASS test/netx-ws.test.ts :: ws/06 真 socket 上的控制帧：客户端 ping 得到同载荷 pong，坏帧得到 1002（rev=9 应修 3）
PASS test/netx-ws.test.ts :: ws/04 真 socket 断线：牌局在托管下走完，凭 token 重连后拿到完整局面并核对揭示
PASS test/netx-ws.test.ts :: ws/07 onHttpRequest 抛异常 ⇒ 500 兜底、连接不残留、房间照常服务（rev=10 应修 9）
PASS test/netx-ws.test.ts :: ws/08 Connection 头的四种"我们不肯放行"写法全部停在 Node 层 404：ws.ts:163-167 按构造不可达
PASS test/rules.test.ts :: rules/01 presets.classic 幂等通过 validateRules
PASS test/rules.test.ts :: rules/02 presets.a23off 幂等通过 validateRules
PASS test/rules.test.ts :: rules/03 两个 preset 仅在 handEval.a23 上不同
PASS test/rules.test.ts :: rules/04 classic 的每个数值逐项等于工单 §1 表格
PASS test/rules.test.ts :: rules/05 未知顶层 key special235=true 抛 TypeError
PASS test/rules.test.ts :: rules/06 未知 key 即使值为 false 也抛（不在 v1 schema）
PASS test/rules.test.ts :: rules/07 未知嵌套 key 抛（handEval / bet 内）
PASS test/rules.test.ts :: rules/08 缺 key 抛（顶层与嵌套各一例）
PASS test/rules.test.ts :: rules/09 值类型错抛（字符串数字 / null / 非布尔）
PASS test/rules.test.ts :: rules/10 version 必须是字面量 1
PASS test/rules.test.ts :: rules/11 字面量域的非法值抛（allIn / compare.tie / showdown.*）
PASS test/rules.test.ts :: rules/12 tierOrder 必须是 6 档无重复排列
PASS test/rules.test.ts :: rules/13 非对象输入一律抛
PASS test/rules.test.ts :: rules/14 validateRules 返回值深冻结（顶层/嵌套/数组都改不动）
PASS test/rules.test.ts :: rules/15 validateRules 返回深拷贝，输入事后被改不影响副本
PASS test/rules.test.ts :: rules/16 presets 本身深冻结
PASS test/rules.test.ts :: rules/17 错误消息点名违规所在路径与 key
PASS test/rules.test.ts :: rules/18 dealer.next 三档各自合法，且 preset 默认 = rotate
PASS test/rules.test.ts :: rules/19 dealer 的非法形态一律抛（枚举外值 / 缺字段 / 多余 key / 非对象 / 大小写）
PASS test/rules.test.ts :: rules/20 跨字段约束：players.min≤max 与 stake.initial≤max 各自抛，等号边界放过
PASS test/static.test.ts :: static/00 扫描范围覆盖 cards / rules / engine / ai 全部源文件
PASS test/static.test.ts :: static/01 src 里不出现时钟与随机全局态
PASS test/static.test.ts :: static/02 src 里不出现文件、网络与控制台 IO
PASS test/static.test.ts :: static/03 src 不引用任何运行时全局可变对象
PASS test/static.test.ts :: static/04 import 只允许相对路径；M0 两文件只允许 import type ./rules.ts
PASS test/static.test.ts :: static/05 src 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）
PASS test/static.test.ts :: static/06 零运行时依赖：dependencies 必须为空（或整体不存在）
PASS test/static.test.ts :: static/07 devDependencies 落在工单白名单内
PASS test/static.test.ts :: static/08 npm test 是单命令，且不依赖任何已安装依赖
PASS test/static.test.ts :: static/09 tsconfig 打开 strict 与 erasableSyntaxOnly
PASS test/static.test.ts :: static/10 输出生产者 test/run.ts 不引用时钟（保证两次运行一致）
PASS test/static.test.ts :: static/11 测试目录可被 runner 发现且无空目录
PASS test/static.test.ts :: static/12 M0 冻结接口：cards/rules 的导出名恰好是 §2.7 契约（不夹带私有实现的导出）
PASS test/static.test.ts :: static/13 src/ai 只用投影信息：越界引用与运行时依赖一律为 0 命中
PASS test/webmin-dealer.test.ts :: dealer/01 rotate：庄家的下家接任（手推座位号）
PASS test/webmin-dealer.test.ts :: dealer/02 winner：单赢家通吃即该赢家坐庄
PASS test/webmin-dealer.test.ts :: dealer/03 winner：平局分池先给拿到余数的那位，无余数才按环形最近
PASS test/webmin-dealer.test.ts :: dealer/04 loser：非赢家中距庄家下家最近者；其离桌则环形顺延到下一家输家
PASS test/webmin-dealer.test.ts :: dealer/05 loser 档无在桌输家时退回轮庄（Q2 已裁定 A）
PASS test/webmin-dealer.test.ts :: dealer/06 三档都没有可留的座位时返回 null（调用方该收桌）
PASS test/webmin-dealer.test.ts :: dealer/07 createSession：三档都合法、默认 rotate、非法值抛 TypeError
PASS test/webmin-dealer.test.ts :: dealer/08 会话层：winner 档 ⇒ 每局庄家 = 上一局赢家
PASS test/webmin-dealer.test.ts :: dealer/09 会话层：loser 档 ⇒ 庄家来自上一局非赢家（除非无在桌输家）
PASS test/webmin-dealer.test.ts :: dealer/10 会话层：rotate 档仍是老行为（庄位逐局换人），且三档结果互不相同
PASS test/webmin-dealer.test.ts :: dealer/11 选庄不改钱：三档各自跨局守恒
PASS test/webmin-model.test.ts :: ui/01 createSession 建立座位、首局与台账
PASS test/webmin-model.test.ts :: ui/02 非法开局参数一律抛 TypeError
PASS test/webmin-model.test.ts :: ui/03 deriveSeed 确定、逐局不同、不用时钟
PASS test/webmin-model.test.ts :: ui/04 没轮到真人时点按钮 → 拒绝且状态指纹不变
PASS test/webmin-model.test.ts :: ui/05 真人+机器人打完一整局：走到结算，台账守恒
PASS test/webmin-model.test.ts :: ui/06 真人发起合法比牌恰好淘汰一家；期间确证首圈禁比挡过
PASS test/webmin-model.test.ts :: ui/07 乱点不崩：非法意图 ok:false 且指纹不变；整桌重来永远可点
PASS test/webmin-model.test.ts :: ui/08 再来一局：局号 +1、庄家轮转到下家、总额守恒
PASS test/webmin-model.test.ts :: ui/09 连打 12 局：每局有限步结束、总额恒定
PASS test/webmin-model.test.ts :: ui/10 机器人走 AI：只出合法意图、闷着不加注不比牌、注级抬高先转明
PASS test/webmin-model.test.ts :: ui/10b 机器人走 AI：强牌加注 / 同一副牌随赔率翻转 / 闷着遇高注级先转明
PASS test/webmin-model.test.ts :: ui/10c 未看牌的机器人决策与手牌无关（同一局面只换牌）
PASS test/webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
PASS test/webmin-model.test.ts :: ui/11b 整桌重来要请回破产离桌的人，并保留庄家规则档位（M2 实测抓到的两个缺陷）
PASS test/webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
PASS test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
PASS test/webmin-model.test.ts :: ui/14 分层边界：model 不碰 DOM/时钟/随机，app 不碰 node 内置也不自己判规则
PASS test/webmin-model.test.ts :: ui/15 页面接线：html 与各模块 import 路径都能被服务放行
PASS test/webmin-model.test.ts :: ui/16 一整局的可见性推进：局中暗牌、终局按规则亮
PASS test/webmin-model.test.ts :: ui/17 页面显示的牌型名与 classify 判定一致（且以看过牌为前提）
PASS test/webmin-model.test.ts :: ui/18 未看牌时 view() 全树序列化与座位行都搜不到真人牌面
PASS test/webmin-model.test.ts :: ui/19 结算信息一条不丢：每家的账就地进座位板，结算块只留原因与指纹（rev=7 ④的前提）
PASS test/webmin-model.test.ts :: ui/20 亮牌文本行：ASCII 记法逐张对得上，且只列真亮出来的牌（验收④给机器的读法）
PASS test/webui.test.ts :: ui3/01 层次：webui 只 import 彼此与 webmin/model，绝不直接碰引擎或 src
PASS test/webui.test.ts :: ui3/02 层次：只有入口层能碰 DOM；UI 侧一行规则判定都没有
PASS test/webui.test.ts :: ui3/03 bridge：开桌后快照结构化，未看牌 ⇒ 每一行都是隐藏位
PASS test/webui.test.ts :: ui3/04 bridge：三档庄家规则都开得出桌并回显在快照里
PASS test/webui.test.ts :: ui3/04b 页面接线：开桌控件与 StartOptions 一一对应，庄家三档不许在 M3 这一版丢掉
PASS test/webui.test.ts :: ui3/05 bridge：非法意图走引擎拒绝路径，计数与状态指纹都对
PASS test/webui.test.ts :: ui3/06 bridge：真人点看牌 ⇒ 只有自己那行亮牌，且快照里搜不到任何别家牌面
PASS test/webui.test.ts :: ui3/07 bridge：把一局打完 ⇒ 结算区有内容、日志在长、桌上总额守恒
PASS test/webui.test.ts :: ui3/08 scene 是纯函数：同一输入两次布局逐字节相同
PASS test/webui.test.ts :: ui3/09 scene 布局不变量：命中区与按钮一一对应、互不重叠、都在画布内（三种视口）
PASS test/webui.test.ts :: ui3/09b 低于最小视口时不做布局、只画提示，且不留下任何可点区（不装作能玩）
PASS test/webui.test.ts :: ui3/09c 竖向预算先给牌桌：候选 10 个时按钮条至多 3 行，座位板照旧不挤不越界（变异 U05 复发哨）
PASS test/webui.test.ts :: ui3/10 scene 命中测试：中心与四条边角都算命中，边界外 1px 不命中
PASS test/webui.test.ts :: ui3/11 scene 不泄露未看过的牌：开局整棵图元树里没有任何牌面字符
PASS test/webui.test.ts :: ui3/11b 看牌前后：整棵图元树从 0 张牌面变成正好 3 张（且就是本人那手）
PASS test/webui.test.ts :: ui3/12 paint 只执行图元：假 ctx 下调用次数与图元数一一对应
PASS test/webui.test.ts :: ui3/13 静态服务放行 webui（不装 vite 也跑得起），根路径仍指向 M1.5
PASS test/webui.test.ts :: ui3/14b 没轮到真人时"整桌重来"仍报合法（U01 复发哨：灰按钮不许谎报会被拒）
PASS test/webui.test.ts :: ui3/15 翻牌动画：进度过半之前一张牌面都不许出现，之后才亮
PASS test/webui.test.ts :: ui3/16 动画进度是纯入参：同一 (快照, anim) 两次布局逐字节相同；不给 anim 时直接终态
PASS test/webui.test.ts :: ui3/17 没配 since 的座位视为已翻开；换局后重新亮牌的座位会重新起算
PASS test/webui.test.ts :: ui3/14 灰按钮点了必被引擎拒（验收③在 M3 侧的等价形态）
PASS test/webui.test.ts :: ui3/18 牌面放大：每张亮牌 ≥48×64、点数 ≥18px，本人手牌再大一档（工单 rev=7 ①）
PASS test/webui.test.ts :: ui3/19 2–6 家都排得开：座位板数量对得上、互不重叠、不越界、不压按钮（工单 rev=7 ②）
PASS test/webui.test.ts :: ui3/19b 极端候选数下只许二选一：要么明说装不下，要么座位板/按钮/底部条互不重叠（不许硬排）
PASS test/webui.test.ts :: ui3/20 结算块不许盖住任何一张亮出来的牌（牌刚亮完就被盖住 = rev=7 要修的老毛病）
PASS test/webui.test.ts :: ui3/21 顶栏不许被牌桌盖住：状态行是整句，被木轨吃掉就等于丢信息（rev=7 实测缺陷复发哨）
PASS test/webui.test.ts :: ui3/22 按钮文案一个字都不许丢：折行只改行数，且每行都得待在自己那颗按钮里
PASS test/webui.test.ts :: ui3/23 牌角不许爬到邻牌脸上：每个点数/花色图元必须待在"自己那张牌露出来的那一条"里
PASS test/webui.test.ts :: ui3/24 桌面中央的"亮牌"文本行：每张亮牌都在里面、字号够读、且不压任何座位板

=== NOTES (fixed vectors, recompute-able independently) ===
AI-CALIB max|est-true|=0.3pp over 24 anchors
AI02 tier-percentile max diff=0.27pp
AI09 compare=1/200 组（其中有资格比牌的才 9 组）
AI12 trigger=14.6% over 1000 seqs
CANONICAL mulberry32 seed=1 float_first=0.6270739405881613
CMP 2S 2D 9C vs 3S 4D 5C = -1
CMP 2S 3D 4C vs AS KS QS = -1
CMP 4S 9S JS vs AS 2S 3S = -1
CMP 9S 9D 2C vs 9C 9S 2D = 0
CMP AS 2S 3S vs QD KC JS = 1
DEAL seat=0 hand=T♠2♠J♠ tier=flush ranks=[11,10,2]
DEAL seat=1 hand=5♠9♣J♥ tier=highCard ranks=[11,9,5]
DEAL seat=2 hand=3♠6♦A♦ tier=highCard ranks=[14,6,3]
DEAL seat=3 hand=6♠K♥7♣ tier=highCard ranks=[13,7,6]
DEAL seat=4 hand=2♥7♠T♣ tier=highCard ranks=[10,7,2]
DEAL seat=5 hand=Q♥J♣7♦ tier=highCard ranks=[12,11,7]
DEALER08 winner 0>2=>2 2>0=>0 0>1=>1 1>0=>0 0>0=>0 0>3=>3
DEALER09 loser hands=6 fallback=0
DEALER10 rotate=0,1,2,3,0 winner=0,2,0,1,0 loser=0,1,3,1,2
ENUM a23off actual   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off anchor   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off closed   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM classic actual   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic anchor   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic closed   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
FUZZ-ILLEGAL probes=3645 rejected=3247
FUZZ-ILLEGAL4 probes=15589 not_current_turn=5592 cannot_afford=2796 bad_target=2921 compare_forbidden_before_first_actions=2672
FUZZ-MODE reasons=oneLeft,stakeCap,stall
FUZZ-ai hands=1000 maxSteps=17 decisions=9262 look=1231 compare=117 有比牌的局=113 reasons=oneLeft=300 stakeCap=42 stall=658
FUZZ-random hands=1000 maxSteps=22 decisions=0 look=0 compare=0 有比牌的局=0（decisions/look/compare 只统计 decideAi 的决策，随机臂不经过 AI ⇒ 恒为 0，不是"随机臂不打比牌"） reasons=oneLeft=755 stakeCap=233 stall=12
FUZZ200 maxSteps=19 reasons=oneLeft=169 stakeCap=27 stall=4
HASH seed11-3calls=c654f607d89ce8c9
REPLAY cap seed=1 hash=03adaa7bef0f0d99
REPLAY cap seed=2 hash=2d3f6f85ce3ae82f
REPLAY cap seed=5 hash=0966c43c35d04a96
REPLAY foldout seed=1 hash=f6ebdc809abcb74a
REPLAY foldout seed=2 hash=aceb2772ab74efc0
REPLAY foldout seed=5 hash=096e62b78da9c34d
REPLAY stall seed=1 hash=1730bb61755d018f
REPLAY stall seed=2 hash=80606e936d104725
REPLAY stall seed=5 hash=286b96c25face2b4
SCRIPT02 seed=1 loser1=2 loser2=0
SCRIPT05 seed=1061 pot=13 shares=7,6
SCRIPT06 seed=622 tie hands: 1=[{"rank":8,"suit":1},{"rank":14,"suit":0},{"rank":7,"suit":3}] 2=[{"rank":7,"suit":1},{"rank":8,"suit":2},{"rank":14,"suit":3}]
SEED base=20260925 h1=3776361071 h2=1243603819
SETTLE seed1-stall chips=96,108,96 pot0 total=300
SHUFFLE-FAIR trials=20000 expected=384.61538461538464 min=331 max=431
SORT1000 seed=20260925 ties=2182 first=[{"rank":10,"suit":3},{"rank":10,"suit":1},{"rank":10,"suit":0}]
TRANS full_triples=94196375 implied_triples=47201700
UI05 steps=5 结束原因：同一注级下各家各完成 3 次行动 → 强制开牌
UI06 合法比牌达成，且首圈禁比确凿生效过
UI07 rejected=7/7
UI09 hands=12 total=768 over=null
UI10 botSteps=253 raise=10 call=110 fold=43 look=77 compare=13
UI11 收桌于第 3 局：只剩 1 家还付得起底注（最少需要 2 家），牌局结束
UI16 reason=stall
UI19 待结算样本：phase=awaitingSettle 赢家=1
UI20 亮牌：你 8C 3S KS 单张 / 电脑1 5S TC 5H 对子 / 电脑3 QS 3H 7D 单张
UI307 结算行=5 日志行=12 点击=3 被拒=0
VECTOR mulberry32 seed=1 first8=2693262067,11749833,2265367787,4213581821,4159151403,1207330352,2632122864,3095568220
VECTOR mulberry32 seed=2 first8=3153583793,1395857638,1225337227,2310499808,3759333107,2709408573,2144054433,1534354113
VECTOR mulberry32 seed=4294967295 first8=3850105811,813802916,3073704848,4054706436,3630262831,2315588663,2922715533,2042566601
VECTOR shuffle seed=1 first12=TS 2S JS 5S 9C JH 3S 6D AD 6S KH 7C
VECTOR shuffle seed=1 last6=2D 3C QC KC 8D 4H
frame/15 握手向量 = RFC 6455 §1.3（SHA-1 + GUID 258EAFA5-E914-47DA-95CA-C5AB0DC85B11）
frame/17 64 位长度三臂：非最小拒 / 66000 字节合法帧解通 / 0x10000 声明走"等数据"分支
leak/01 按 seed 独立复算三家的牌面，逐条扫描"别人看到且尚未亮牌"的下行（96 次检查）：零命中
leak/02 结算视图前扫描 36 条下行：种子字段/种子数字零命中；揭示前份额明文零命中
leak/04 抖动重连 8 次之后仍与稳定路径逐条收敛
netx/02 SHA-256 与 node:crypto 差分 208 条输入全部一致
netx/08 SHA-1 与 node:crypto 差分 202 条一致；握手向量 = RFC 6455 §1.3
nst/07 依赖面：dependencies={}，devDependencies=@types/node,typescript,vite
nst/09 M4 测试文件 12 份：netx-client.test.ts, netx-crypto.test.ts, netx-fixtures.ts, netx-frames.test.ts, netx-leak.test.ts, netx-netplay.test.ts, netx-protocol.test.ts, netx-room.test.ts, netx-seed.test.ts, netx-serve.test.ts, netx-static.test.ts, netx-ws.test.ts；时钟例外只给 netx-ws.test.ts / netx-serve.test.ts（仅看门狗）
nst/10 扫 webui 全部 5 个 .ts：价格算式只在 webui/netplay.ts，其内 priceOf 只调一次、三档按钮都从它取数
nst/12 标签「在场筹码+池」：文案①渲染②过滤③入口④四道判据互锁，三组对照各命中一条（webui/webmin/netx/src 共 24 个 .ts 被扫）
nui/01 快照 20 个字段两边一致；联机快照排版出 39 图元 / 0 命中区
nui/03 两整手：第 1 手池 0，第 2 手庄家=座位1，终局台账 512
nui/04 未看牌 / 别家牌面 / 开牌之后三个阶段各自都拿整棵快照搜过（含正、反向对照）
nui/05 三类可见反馈各自可辨认：伪造下行→停手；leak_blocked→漏牌；replaced→顶号
nui/06 三条重连形状各自真实走到：断线→(seq,now] 增量、同局刷新→(0,now] 增量、跨局→全量快照；台账全程守恒 512
nui/07 per-tab 存储各占一座；换成共享存储时"甲"被接回座位1（=乙的座位）
nui/08 UI 日志里 6 条 timeout→call；末条：#007 call      甲 出 1 @注级1｜timeout→call dark×stake
nui/09 按钮只列候选意图；cost 恒 null；不轮到自己时全灰且发不出去
nui/10 份额随凭据存住 ⇒ 刷新重连后局末核对照样通过，且服务端不再向它重复收份额
nui/11 (a) 三种行动各自对账通过：raise=4@注级1 / call=4@注级2 / compare=4@注级2
nui/12 (b) 注级 1：闷 1 → 明 2，两个数都由 priceOf 现算
nui/13 (c) 穷座筹码 1 对 8 的跟价：仍可点、发得出、服务端拒、页面照实说
nui/14 (d) 两条路对同一 state 逐按钮相等：25 次、11 种组合
nui/16 入口层只有接线与显示：netx 进口为零，规则与价格的判定面全在别处
nui/17 模块图 19 个文件全部可达，其中 netx 只有 4 个：netx/client.ts, netx/protocol.ts, netx/seed.ts, netx/sha256.ts
nui/18 bad_token ⇒ 清存储 + 提示 + onText 自己产出 join（一次），哑管道端到端也真把局面接回来了
nui/19 判据只认墙校验过的 errors：非法报文不清凭据不发上行；停手的那一世也不发；干净的那一世才自动重入桌
nui/20 compare_forbidden_before_first_actions 上屏后，下一个被接受的行动把它换下了提示行，审计面仍留着 1 条
nui/21 入座 / 没交份额 / 挪庄三类 notice 都进了日志区，键集与 40 行上限不变
nui/22 在场=512、房间整本=768（差额 256 = 离桌那一家），标签「在场筹码+池」与过滤同口径
nui/23 座位格主路径三个时刻各比对 27 项，牌面/等级/筹码/状态/结算文案全部由 view 那一行推出（甲0、乙1、丙2）
nui/24 patch 上塞别家牌面 ⇒ 当场抓到（1 条越界）、投影不采纳、页面塌成"已停手"、act 发不出去；同工装下的合法 patch 零误伤
nui/25 边界如实成文：patch 上的公开权威数字（chips/pot）客户端无法独立核对 ⇒ 只照抄；而 seq 重放这一类照样当场被抓，揭示核对不受影响
nui/26 坏 JSON 降级为"没有凭据"、入桌照常、新凭据写回；对照：合法凭据能构造 resume
proto/01 上行 6 条 / 下行 10 条往返保真且字节稳定
proto/06 net 拒绝码 5 个全部会被真正发出：bad_hand, no_seat, not_dealt, bad_nonce, nonce_late
proto/12 出口编码：6 类非法消息全部在本地被拦（服务端不能只约束客户端）
proto/13 parse() 两条报错口径互不混用：非文本非对象 / 坏 JSON / schema 缺 key 各归各
room/07 全程托管 ⇒ 六次 timeout→call、零弃牌、终局 stall；三家版见 timeout/01
room/11 三局庄家轮转 0→1→2；结束时 0:249 1:256 2:263
room/16 2~6 家全部靠"看牌+跟注"走到强制开牌，无违规、无 fault
room/17 缺席完全局的重连：承诺/快照/揭示三件齐补，种子核对通过
room/18 每一阶段的待发定时器数量恒为 1（nonce/回合/结算表都被正确取消）
room/21 应用层心跳：三条 ping 各自回显，局面一字未动（3 条 pong）
room/26 连接清单 = A2, B3, C2, a10, c1, c10（码点序；locale 序会是 a10, A2, B3, c1, c10, C2）
room/28 到点开不齐人 ⇒ 本局作废 + 局号不回卷 + 台账零扣减；重开后份额重新收
room/29 庄家缺席 ⇒ 挪到座位1、牌局开出来、进程没炸；缺席家筹码原样
seed/11 合成 seed=1498111553（份额明文见 netx-seed.test.ts 顶部 SHARES）
seed/11 固定向量 hand=1 shares=[seat:0:49af21ae…, seat:1:4ec39f40…, seat:2:e4aa43f9…, server:12be698b…]
seed/12 4096 组份额合成 4096 个互不相同的种子，最大值 4294600091
seed/13 码点序=A,Seat:10,a,seat:2,server / locale 序=a,A,Seat:10,seat:2,server ⇒ 向量取前者，权威路径同键（seed=3577986836）
seed/14 前缀相撞的 party 名：权威 = 向量 = seat:1,seat:10,seat:2,server（seed=2391714912）
srv/02 真 socket 走完一手：19 步，两家各自核对通过（端口由内核挑，不印进输出）
srv/05 默认端口 8790：进程与页面两处一致；存储与熵源口径也钉住
srv/06 入口面：横幅原样印出 http://127.0.0.1:〔内核端口〕/webui/ 且跟到底就是联机页；/ 仍 302 到 M1.5（映射未动）
srv/07 四发畸形转义全部 400、%00 与越界 403 档位不变、事后合法路径仍 200（进程存活）
srv/08 ENOENT 与 src 下不存在都 404（带原因、纯文本、no-store），对照组 /webui/index.html 仍 200
timeout/06 托管与自主跟注只差 note：timeout→call seen/dark×stake vs dark×stake
ws/01 真实 socket + Node 内置 WebSocket 客户端跑完一手牌：11 个 seq，三家各自核对通过
ws/04 断线期间牌局由托管走完；重连后 seq 从 0 追到 9，揭示核对通过
ws/05 9 条非法握手各自被拒（400/404/426 按来源分档），零连接残留
ws/06 控制帧：ping(122,104,33,0,255) 原样回显、零长度边界、客户端 pong 不回声（管道里恰好一个 pong）、非法帧 1002
ws/07 钩子抛 ⇒ 500 + 原文；/health 与真握手照常；钩子自己应答时 203/404 两档不受影响
ws/08 4 种 Connection 写法全部由 Node 层答 404（正文即判据），我们那三行 400 在本机 Node 上按构造不可达

RUNNER files=29 cases=408
SUMMARY pass=408 fail=0 total=408
RESULT=ALL_PASS
```

# 10 · rev=10 M5 联机可玩（把 M4 的权威房间接到 M3 的 UI；含 Q6=A2、rev=9 七条应修销账）

## 10.1 命令、退出码与 §0.5 双跑哈希（同时销 rev=9 §4 应修 6）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `node test/run.ts` 第 1 次 | exit=0，393 例全过（原文见 10.5，那份就是它的产物） |
| 2 | `node test/run.ts` 第 2 次 | exit=0，与第 1 次**逐字节相同** |
| 3 | `npm test` 第 1 次 | exit=0 |
| 4 | `npm test` 第 2 次 | exit=0，与第 3 次**逐字节相同** |
| 5 | `npx tsc --noEmit` | exit=0，无诊断 |
| 6 | 变异扫描（10.3 / 10.4） | 22 条：21 caught、1 survived（D02，附等价性论证）、0 SKIPPED、0 还原失败 |

应修 6 要求"两条命令的哈希都写上"，四个 sha256（64 位全写，不缩写）：

```
node test/run.ts  run1  9ced956780b1578eb25ab8c46dc90d4f6c4caa6bc6ea595b877c62740147dbc4
node test/run.ts  run2  9ced956780b1578eb25ab8c46dc90d4f6c4caa6bc6ea595b877c62740147dbc4
npm test          run1  742e55c60b5adb0380aa454326d787b95817511b2d4a61ae4b9fbfb7acb8655c
npm test          run2  742e55c60b5adb0380aa454326d787b95817511b2d4a61ae4b9fbfb7acb8655c
```

同一命令两次相同 ⇒ 输出确定。`node` 与 `npm` 两个哈希**彼此不同**是预期的：`npm test` 的开头多 4 行 npm 自己的横幅
（`> zjh@0.0.0 test` / `> node test/run.ts` 及空行），正文与 `node test/run.ts` 完全一致（10.5 那份是 npm 版）。

### 10.1.1 双跑第一次是**不过**的，以及为此钉的门

第一次按上表跑，`node` 两次的哈希不同：唯一差异是一行 `(node:19636) ExperimentalWarning: stripTypeScriptTypes …`
——行首带**进程 PID**。来源链是 M5 新增的 `srv/01`：它经 HTTP 取 `/webui/main.ts`，走到
`webmin/serve.ts::readAsset` → `node:module.stripTypeScriptTypes`，于是 Node 在**跑测试的这个进程**里打出这条警告。

修法是"在输出这一侧精确删这两行"，不是静音：**先试过 `process.on('warning', …)`，实测拦不住** ——
监听器收到了，Node 的默认打印照样跑（`node -e` 单独验过：默认两行在前、监听器输出在后）。
所以现在过滤挂在 `process.stderr.write` 上，只匹配这一条警告的两行（`test/run.ts` 顶部注释把这段写死了）。
这条以后再被人删掉就会让交付证据的哈希漂，所以钉成 `nst/11`。

## 10.2 用例分布：362 → 393

| 家族 | 条数 | 本轮新/改 |
|---|---|---|
| `nui/01`–`nui/18` | 18 | **全新增**（M5 联机可玩：一道墙、快照键集、两整手、泄漏负向、伪造下行停手、三条重连形状、per-tab 存储、超时字样、A2 价格 (a)–(d)、`toMove` 收窄、入口层静态门、模块图可达、凭据作废自愈） |
| `srv/01`–`srv/05` | 5 | **全新增**（房间进程：同端口端页面与 `/health`、真 socket 走完一手、一句 quit 干净退出码 0、坏参数码 2、默认端口两处一致） |
| `nst/01`–`nst/11` | 11 | 改 01/04/09；新增 **10（A2 ④ 算式不扩散）**、**11（双跑破口的过滤门）** |
| `client/16` | +1 | `hand=0` 不许产出非法 resume |
| `room/29` | +1 | 庄家那席缺席被剔 ⇒ 庄家必须挪位，否则 `startHand` 抛 TypeError 打死进程 |
| `room/27`、`room/28`、`proto/13`、`ws/06`、`seed/13`、`seed/14`、`client/12`–`15`、`frame/16`、`frame/17` | +12 | rev=9 §4 应修 1/2/3 与必修 4 的覆盖（本轮同一份交付销账） |

**零回归口径**：`RUNNER files=29 cases=393 / SUMMARY pass=393 fail=0`；M4 那 362 条**一条期望都没改**——
A2 ①要求"抽 `priceOf` 之后行为逐字节不变"，这条不是自述：`money/02`、`money/03`、`illegal/06`、`project/06` 等
既有断言原样通过，且它们在 10.3 的 A01/A02 变异下会响（说明它们真的在盯这套算术，不是空过）。

## 10.3 变异扫描（22 条，逐条=单锚点就地打坏一道门 → 全量跑 → 还原核对 sha）

| id | 打坏的是哪道门 | 判定 | 被哪些用例抓到 |
|---|---|---|---|
| A01 | `priceOf` 里 明/闷 乘数互换（**A2 (e) 第一条**） | caught | `illegal/06`、`money/02`、`money/03`、`nui/11`、`nui/12` |
| A02 | `project()` 出口 `stake+1`（只改投影不改真状态，**A2 (e) 第二条**） | caught | `project/06`、`nui/11`、`nui/13` |
| A03 | 页面自己算价（`priceOf` 换成现场 `stake*2`） | caught | `nui/09`、`nui/11`、`nui/12` |
| A04 | 本地判"买不起 ⇒ 禁用按钮"（A2 ③ 明令禁止） | caught | `nui/13`、`nst/10` |
| B01 | 牌桌警告位不显示服务端 reject 原文 | caught | `nui/13` |
| B02 | 越界提示不进日志区（停手只剩一行标题） | caught（**第二轮**，见 10.4） | `nui/05` |
| C01 | `bad_token` 之后不清存储 | caught | `nui/18` |
| C02 | `persist()` 里"作废期间不写回"那道闸拆掉 | caught | `nui/18` |
| C03 | `joinWire` 不重置会话（带着上一世的份额） | caught | `nui/18` |
| C04 | `hand=0` 仍然发 resume | caught | `client/16` |
| C05 | `hello` 不清 `staleToken`（提示一直挂着） | caught | `nui/18` |
| D01 | 庄家缺席时不挪位（回到那条未捕获 TypeError） | caught | `room/29` |
| D02 | `beginHand` 的庄家兜底改回"取最小在席座位" | **survived**（等价性论证见 10.4） | — |
| D03 | 静态服务收回那四个 netx 可移植模块 | caught | `nui/17`、`srv/01` |
| D04 | 白名单写成整个 `netx` 目录（权威代码会被端进页面） | caught | `srv/01` |
| D05 | 房间进程不再顺手端页面 | caught | `srv/01`、`srv/03` |
| D06 | `ws.ts` 不调用 `onHttpRequest`（钩子形同虚设） | caught | `srv/01`、`srv/03` |
| E01 | 每标签页存储换成全局键 `localStorage` | caught | `nui/16`、`srv/05` |
| E02 | `netplay` 不再产出那条重入桌的 join | caught（**第二轮**，见 10.4） | `nui/18` |
| E04 | 重入桌的一次性闩锁拆掉（坏服务端可拖成 join 洪水） | caught | `nui/18` |
| E03 | 份额熵源退回 `Math.random` | caught | `srv/05` |
| F01 | 推进类意图被误当成 `call` 发出去 | caught | `nui/15` |

## 10.4 先逃后抓（3 条）与一条等价性论证

1. **B02（越界提示不进日志区）第一轮存活**。当时的 `nui/05` 只断言了 `note` 与按钮条，没断言 `snapshot().log`
   ⇒ 少说一处可见性就测不到。补三条：`log[0]` 必须是那条 `⚠ 这一局不可信`、日志里必须有"已停手"、
   并且越界提示是**附加**在真实日志之前而不是把日志整段换掉（`some(l => l.startsWith('#'))`）。第二轮被抓。
2. **E02 第一轮存活，而且它抓到的是我的设计问题**：那条"凭据被拒 ⇒ 回落 join"的分支当时写在
   `webui/main.ts::onmessage` 里，只能用文本形状的门去钉（`staleToken … joinWire()` 那种），
   形如一扇虚门。做法不是把门写严，而是**把决定收进 `netplay.onText`**（它直接产出那条 join），
   `main.ts` 退化成纯管道 ⇒ 这条路进到了能被无头钉住的那一层，`nui/18` 一钉两条（产出 join + 只产一次）。
   顺带把 `nst`/`nui/16` 的门改成"onmessage 必须是纯管道、`joinWire()` 在 `main.ts` 里只许出现一次"。
3. **D05/D06 是被工装事故"意外"跑的**：第一轮扫到 D05 时整个扫描进程被会话切换打死（后台任务的临时目录换了号），
   把 `netx/serve.ts` 与 `netx/ws.ts` **留在变异态**。是全量复跑（`srv/01`/`srv/03` 红）把它揪出来的，
   随后手工还原并逐条复扫。教训写进 10.4.1。

**D02 的等价性论证（不是"没测到"，是"测不到"）**：`dealerAmong(seats, preferred)` 与旧写法
`if (!eligible.includes(dealer)) dealer = eligible[0]` 只在"原庄家不在席、且席内有比它更大也有比它更小的座位"时才分叉。
而 `join()` 永远分配**最小空位** ⇒ `eligible` 恒为 roster 升序的**前缀**；`firstDealer` 又必须是 roster 里的座位
（否则构造期 `TypeError`，`room/27` 守着）⇒ 不在前缀里就一定在所有在席者**之后** ⇒ `dealerAmong` 只能绕回最小 ⇒ 与旧写法恒等。
`prev !== null` 那一支里 `nextDealerOf` 返回的本就是 eligible 成员，两条规则也都恒等。
我按这个前提写过 `room/30`（想造出"席内有大有小"的缺口），跑出来是**构造前提失败**——这本身就是上面那句证明的实验依据，
所以那条用例已撤除，改为在这里留论证。真正可达的那一支（`onNonceDeadline`）由 `room/29` + 变异 D01 钉着。

### 10.4.1 工装自身的两条自我验证记录

- **sha 还原核对不是装饰**：本轮两次实证。① D06 那一批被 15s/超时切断，`netx/ws.ts` 停在 `&& false` 态，
  是全量复跑红了两条才暴露；② 会话切换杀掉了第一轮的扫描进程，`netx/serve.ts` 停在 `onHttpRequest: undefined`。
  两处都靠"跑完全量看有没有意外的红"发现并手工还原，随后逐条复扫。**工装被中断时 sha 自检来不及跑**，
  所以后续批次改成"每条一批、批内两条"以缩短暴露窗口。
- **锚点命中数必须校验**：`room/28`/`room/30` 两次构造前提写错（三家桌两家到齐就开局；`join` 只给最小空位），
  都是**用例自己先失败**才发现的——这正是"测试脚本自身先被验证"的意义：前提断言（`构造前提：…`）与结论断言分开写。


## 10.5 `npm test` 完整输出（第 1 次运行原文，520 行）

```

> zjh@0.0.0 test
> node test/run.ts

=== ZJH TEST REPORT (deterministic) ===
PASS test/ai-honest.test.ts :: ai/01 牌力先验表 = 22100 手全枚举的事实
PASS test/ai-honest.test.ts :: ai/02 分位表按 classic 写死，但 a23off 下的偏差 < 2pp（所以表可以不分 preset）
PASS test/ai-honest.test.ts :: ai/03 牌力分位单调，且跨档不倒挂（弱档最强手 <= 强档最弱手）
PASS test/ai-honest.test.ts :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）
PASS test/ai-honest.test.ts :: ai/05 看过牌后才按牌力决策：强牌加注、中带跟、烂牌弃
PASS test/ai-honest.test.ts :: ai/06 池赔率真的进了决策：同一副牌，池给得大方就跟、池小就弃
PASS test/ai-honest.test.ts :: ai/07 对手数量真的进了决策：同一副牌同一赔率，人越多越保守
PASS test/ai-honest.test.ts :: ai/08 看牌/保持闷是真决策：最低注级闷着省钱，注级一抬就先转明
PASS test/ai-honest.test.ts :: ai/09 只出合法行动、闷着绝不加注也绝不比牌、比牌必是合法目标（200 组随机合法集合）
PASS test/ai-honest.test.ts :: ai/12 比牌触发率 = 1000 个 seq 上量得出来，且完全由 seq+座位决定（可重放）
PASS test/ai-honest.test.ts :: ai/10 纯函数：同一输入两次调用结果逐字相同（fuzz 与回放的前提）
PASS test/ai-honest.test.ts :: ai/11 先验与 tierOrder 挂钩：把档位排列倒过来，分位表跟着倒
PASS test/ai-honest.test.ts :: ai/13 比牌目标 = 活跃对手中已投入最高者；本局已比过则不再比
PASS test/ai-honest.test.ts :: ai/13b 投入并列时按环形序选目标，而不是按座位号大小（变异 C06 复发哨）
PASS test/ai-honest.test.ts :: ai/14 掷点只由 seq+座位决定：同输入同结果、同 seq 换座位换结果
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/classic 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/a23off 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/档位集合 六档键完全一致且无重复，计数均为非负整数
PASS test/classify.test.ts :: classify/闭式结构 trips 与 pair 与 a23 无关，其余四类随 runs 移动
PASS test/classify.test.ts :: classify/输入顺序无关 455 规范类 × 6 排列判定全同（两 preset）
PASS test/classify.test.ts :: classify/A23 一族 64 手在两 preset 下的迁移符合公式
PASS test/classify.test.ts :: classify/归一化键 顺子高点 A23=3 / 234=4 / QKA=14 且长度为 1
PASS test/classify.test.ts :: classify/归一化键 对子=[对子点, 踢脚]，穷举 3744 手
PASS test/classify.test.ts :: classify/归一化键 豹子 ranks=[r]，穷举 52 手
PASS test/classify.test.ts :: classify/NOTES 打印计数三元组（实际/闭式/锚点）供独立复算
PASS test/compare.test.ts :: compare/01 规范类数量 = C(15,3) = 455
PASS test/compare.test.ts :: compare/02 自反：每类与自身比较 = 0
PASS test/compare.test.ts :: compare/03 反对称：455^2 = 207025 全对，cmp(a,b) = -cmp(b,a)
PASS test/compare.test.ts :: compare/04 传递性穷举：(a>=b && b>=c) ⇒ a>=c，全 455^3 三元组
PASS test/compare.test.ts :: compare/05 花色不参与：全体花色平移 +1 后仍判 0
PASS test/compare.test.ts :: compare/06 与独立整数键参考实现交叉一致（455^2 全对）
PASS test/compare.test.ts :: compare/07 tierOrder 整序反转：跨档对全部翻转、同档对不变
PASS test/compare.test.ts :: compare/08 tierOrder 局部改动即刻生效（把 pair 提到 trips 之上）
PASS test/compare.test.ts :: compare/09 固定种子 1000 手排序后做全对序校验（不只是相邻）
PASS test/compare.test.ts :: compare/10 牌型序链：豹子>同花顺>同花>顺子>对子>单张（15 对全断言）
PASS test/compare.test.ts :: compare/11 tierOrder 缺档时 compare 抛错而不静默
PASS test/compare.test.ts :: compare/12 档位优先于点数：最小同花顺 > 最大普通顺等交叉断言
PASS test/deck.test.ts :: deck/01 makeDeck 长度 52 且逐位满足 index = suit*13 + (rank-2)
PASS test/deck.test.ts :: deck/02 52 张互不相同
PASS test/deck.test.ts :: deck/03 makeDeck 每次返回新数组与新对象（无共享可变状态）
PASS test/deck.test.ts :: deck/04 mulberry32 同 seed 的 1000 项序列完全一致
PASS test/deck.test.ts :: deck/05 不同 seed 的序列不同
PASS test/deck.test.ts :: deck/06 输出恒为非负 uint32 整数（1e6 次采样，覆盖边界 seed）
PASS test/deck.test.ts :: deck/07 seed 非整数抛 TypeError
PASS test/deck.test.ts :: deck/08 shuffle 原地：返回值与入参是同一个数组引用
PASS test/deck.test.ts :: deck/09 shuffle 结果是原牌堆的一个排列
PASS test/deck.test.ts :: deck/10 同 seed 两次洗牌逐位一致，不同 seed 至少一处不同
PASS test/deck.test.ts :: deck/11 52 张牌恰好调用 rng 51 次
PASS test/deck.test.ts :: deck/12 rng 返回浮点/负数/非数一律抛 TypeError
PASS test/deck.test.ts :: deck/13 空牌堆与单元素牌堆不调用 rng、不抛
PASS test/deck.test.ts :: deck/14 发牌烟雾：seed=1 洗完发 6 家，每手都可判定
PASS test/deck.test.ts :: deck/16 洗牌分布公平性：固定种子 20000 轮，52 个落点计数都在容差内
PASS test/deck.test.ts :: deck/17 三张牌穷举 144 种 rng 输出：每张牌的落点计数恰为 48
PASS test/deck.test.ts :: deck/18 NOTES 打印 PRNG 与洗牌的规范向量（供跨端复算）
PASS test/deck.test.ts :: deck/19 与独立誊写的参考 mulberry32 逐位一致（钉住结构与常数）
PASS test/deck.test.ts :: deck/20 rng 恒为 0 时输出等于牌堆左旋一格（钉住从尾往前的遍历方向）
PASS test/edge.test.ts :: edge/01 §3.5 A♠2♦3♣ < 3♠4♦5♣（A23 是最小顺）
PASS test/edge.test.ts :: edge/02 §3.5 A♥2♥3♥ 是同花顺且 > 4♣5♦6♣（档位优先于点数）
PASS test/edge.test.ts :: edge/03 §3.5 2♦2♣2♥ > A♠K♠Q♠（豹子 > 同花顺）
PASS test/edge.test.ts :: edge/04 §3.5 A♦A♣3♠ > K♦K♣A♠（对子点优先，踢脚再大也没用）
PASS test/edge.test.ts :: edge/05 §3.5 同点同级 → 0（花色完全不参与）
PASS test/edge.test.ts :: edge/06 绕 A 不成顺：A♠K♦2♣ 是单张而不是顺子
PASS test/edge.test.ts :: edge/07 最大豹子 > 最小豹子 > 任意同花顺
PASS test/edge.test.ts :: edge/08 a23off 下 A♥2♥3♥ 降为同花、A♠2♦3♣ 降为单张
PASS test/edge.test.ts :: edge/09 A 在非顺子牌型里取 14
PASS test/edge.test.ts :: edge/10 归一化键长度按档固定：豹子/顺 1 位、对子 2 位、同花/单张 3 位
PASS test/edge.test.ts :: edge/11 非法手牌：长度≠3 抛 TypeError
PASS test/edge.test.ts :: edge/12 非法手牌：两张同一牌（同点同花）抛 TypeError
PASS test/edge.test.ts :: edge/13 非法牌面：rank / suit 越界、非整数、NaN 都抛 TypeError
PASS test/edge.test.ts :: edge/14 非法手牌容器：非数组 / 元素非对象 / 缺字段抛 TypeError
PASS test/edge.test.ts :: edge/15 compare 两侧都继承 classify 的非法输入检查
PASS test/edge.test.ts :: edge/16 rules 结构缺失时不静默：缺 handEval 抛 TypeError
PASS test/edge.test.ts :: edge/17 单张的型内比较只看归一化后的三点
PASS test/engine-core.test.ts :: core/01 startHand 不变量：底注入池、每人扣 ante、游标在庄家下家、计数归零
PASS test/engine-core.test.ts :: core/02 发牌互不重叠且都来自标准 52 张
PASS test/engine-core.test.ts :: core/03 发牌顺序 = 独立复算的洗牌结果（庄家下家起连续取牌）
PASS test/engine-core.test.ts :: core/04 庄家必须在座位表里
PASS test/engine-core.test.ts :: core/05 配置非法一律抛 TypeError（人数越界 / 重复座位 / 付不起底注 / seed 非整数）
PASS test/engine-core.test.ts :: core/06 apply 是纯函数：对旧状态深冻结后再推进行动，不抛（说明没有原地写）
PASS test/engine-core.test.ts :: core/07 stateHash 对状态变化敏感、对重放稳定
PASS test/engine-core.test.ts :: core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值
PASS test/engine-core.test.ts :: core/09 资金守恒：开局到结算，筹码 + 池恒等于买入总额
PASS test/engine-core.test.ts :: core/10 同一配置重复开局得到同一状态（引擎里没有隐藏全局态）
PASS test/engine-core.test.ts :: core/11 日志单调：seq 逐条 +1，type 全部来自固定集合
PASS test/engine-core.test.ts :: core/12 引擎对 2 人与 6 人都能开局（人数只受 rules.players 约束，不硬编码）
PASS test/engine-core.test.ts :: core/13 终止阈值不多不少：注级 8 上各家满 2 次仍在局里，满 3 次才 stall
PASS test/engine-fuzz.test.ts :: fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码
PASS test/engine-fuzz.test.ts :: fuzz/02 三种终止条件都能被随机行动打到（换策略覆盖 ②③）
PASS test/engine-fuzz.test.ts :: fuzz/03 2–6 人局全部跑通且守恒
PASS test/engine-fuzz.test.ts :: fuzz/04 非法行动注入：一律抛 InvalidActionError，且状态指纹不变
PASS test/engine-fuzz.test.ts :: fuzz/05 回放确定性：同 seed + 同行动序列 ⇒ 同指纹（20 局）
PASS test/engine-fuzz.test.ts :: fuzz/06 结算幂等：settle 前后指纹稳定，且只入账一次
PASS test/engine-illegal.test.ts :: illegal/01 不轮到你 → not_current_turn（三种动作各一例）
PASS test/engine-illegal.test.ts :: illegal/02 座位不存在 → bad_seat
PASS test/engine-illegal.test.ts :: illegal/03 行动对象本身不合法 → unknown_action
PASS test/engine-illegal.test.ts :: illegal/04 首圈禁比：任何人第一次行动之前都不能比牌，全员各一次后立刻放开
PASS test/engine-illegal.test.ts :: illegal/05 比牌目标非法：自己 / 已弃牌 / 不存在的座位
PASS test/engine-illegal.test.ts :: illegal/06 重复看牌被拒；看牌不消耗行动数也不推进游标
PASS test/engine-illegal.test.ts :: illegal/07 注级顶格不能再加注
PASS test/engine-illegal.test.ts :: illegal/08 钱不够 ⇒ 唯一合法行动是弃牌（全押禁用，§1 全押行）
PASS test/engine-illegal.test.ts :: illegal/09 已弃牌的座位不会再被要求行动，硬塞则 seat_not_active
PASS test/engine-illegal.test.ts :: illegal/10 终局后所有下注类行动被拒（phase_not_betting）
PASS test/engine-illegal.test.ts :: illegal/11 结算时机：没终局不能 settle；已结算再 settle 是幂等 no-op
PASS test/engine-illegal.test.ts :: illegal/12 legalActions 与 checkAction 判据完全一致（不轮到你时给出的是当前 turn 的动作集）
PASS test/engine-illegal.test.ts :: illegal/13 timeout 是普通行动：买得起 ≡ 跟注、买不起 ≡ 弃牌，且都过同一道 validate
PASS test/engine-money.test.ts :: money/01 底注：pool = ante × 人数，每人筹码与 committed 各扣/记一份
PASS test/engine-money.test.ts :: money/02 闷跟 = stake×bet.dark，明跟 = stake×bet.seen（三种注级各验）
PASS test/engine-money.test.ts :: money/03 加注：注级翻倍并按新注级付跟价（Q1 读法 B），且全员当前注级行动数清零
PASS test/engine-money.test.ts :: money/04 比牌费 = fee × stake 入池，与闷/明无关（注级 1/2/4 各验一次）
PASS test/engine-money.test.ts :: money/05 不变量：pot 恒等于各家 committed 之和；每步增量恰是 actionCost
PASS test/engine-money.test.ts :: money/06 弃牌不花钱也不退钱：弃牌者的 committed 留在池里（无边池无退款）
PASS test/engine-money.test.ts :: money/07 分池：整除时人人等份；有余数时给"距庄家下家最近"的赢家
PASS test/engine-money.test.ts :: money/08 幂等结算：入账只发生一次，重放 settle 不重复扣/发钱
PASS test/engine-money.test.ts :: money/09 任何时刻都不出现负筹码（全押禁用的直接后果）
PASS test/engine-money.test.ts :: money/10 结算后赢家所得 = 池，且各家 committed 之和 = 结算前 pot
PASS test/engine-project.test.ts :: project/01 谁都没看过牌：本人也是 unknown，他人一律 unknown（§1 看牌行）
PASS test/engine-project.test.ts :: project/02 序列化后仍然搜不到任何他人牌面（整条 view 一起查，含日志）
PASS test/engine-project.test.ts :: project/03 强制开牌后：活跃家全部可见，弃牌/被淘汰者仍然 unknown
PASS test/engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
PASS test/engine-project.test.ts :: project/05 seed 只在结算后才暴露（否则任何客户端都能反算整副牌）
PASS test/engine-project.test.ts :: project/06 公开信息一字不漏：池/注级/游标/计数/闷明/committed 全部同步
PASS test/engine-project.test.ts :: project/07 观战视角（viewer 不在座位表里）看不到任何未开的牌
PASS test/engine-project.test.ts :: project/08 视图是拷贝，改它不会污染引擎状态
PASS test/engine-project.test.ts :: project/09 终局信息公开：赢家集合、份额、余数归属都可投影
PASS test/engine-project.test.ts :: project/10 startHand 之后立刻投影：轮到行动也没看过牌 ⇒ 本人同样无牌可看
PASS test/engine-project.test.ts :: project/11 负向：未看牌时整条 view 序列化后搜不到本人牌面
PASS test/engine-project.test.ts :: project/12 revealed 优先于 looked：本人没看牌，被强制开牌后照样看得见自己的牌
PASS test/engine-scripts.test.ts :: scripts/01 弃至通吃（§1①）：只剩一人即结束，且不开牌
PASS test/engine-scripts.test.ts :: scripts/02 比牌链：连续两次比牌各淘汰一家，输家的牌永不公开
PASS test/engine-scripts.test.ts :: scripts/03 封顶开牌（§1②）：注级 16 且活跃各家再完成 1 次行动 ⇒ 强制开牌
PASS test/engine-scripts.test.ts :: scripts/04 stall 强开（§1③）：同一注级下活跃各家各满 3 次行动；加注会把计数清零重计
PASS test/engine-scripts.test.ts :: scripts/05 平局分池：两家打平 ⇒ 平分池，除不尽的余数给距庄家下家最近者
PASS test/engine-scripts.test.ts :: scripts/06 挑战者输：比牌平局时挑战者出局（§1 比牌行）
PASS test/engine-scripts.test.ts :: scripts/07 剩两家比牌 = 直接开牌定胜负（两家牌都亮）
PASS test/engine-scripts.test.ts :: scripts/08 三条终止路径各自都要能到达（覆盖性，不是只测一条）
PASS test/engine-scripts.test.ts :: scripts/09 每个脚本重放得到同一状态指纹（回放确定性）
PASS test/engine-timeout.test.ts :: timeout/01 (a) 全员托管的一手牌必然走完，且终局原因是 stall
PASS test/engine-timeout.test.ts :: timeout/02 (b) 付不起跟价的那一家回退成弃牌，且不欠款、不出现负筹码
PASS test/engine-timeout.test.ts :: timeout/03 (c) 已看牌者付明注价、未看牌者付闷注价
PASS test/engine-timeout.test.ts :: timeout/04 (d) 托管不产生 look / raise / compare 事件，也不替玩家看牌
PASS test/engine-timeout.test.ts :: timeout/05 托管仍是普通行动：同一道 validate，越界照样被拒
PASS test/engine-timeout.test.ts :: timeout/06 可归因性：玩家自主跟注的 note 里不许出现 timeout
PASS test/m2-fuzz.test.ts :: m2/01 随机合法行动 1000 局：守恒 / 无负筹码 / 无重复结算 / 有限步终止
PASS test/m2-fuzz.test.ts :: m2/02 诚实 AI 1000 局：只出合法行动、闷着不加注、决策数非零且必然终止
PASS test/m2-fuzz.test.ts :: m2/03 AI 臂与随机臂都打到全部三类终止条件（覆盖不是单边运气）
PASS test/m2-fuzz.test.ts :: m2/04 四类非法行动必被 validate 拒（不轮到你 / 钱不够 / 比已弃牌者 / 首圈禁比时段比牌）
PASS test/m2-fuzz.test.ts :: m2/05 牌力分位 ≈ 真实胜率，且档内端点随 a23 正确移动（两 preset 全枚举对拍）
PASS test/netx-client.test.ts :: client/01 收到 collect 里"还缺我"就立刻交一份份额，且一局只交一次
PASS test/netx-client.test.ts :: client/02 行动防呆：只有"轮到我且局面干净"才放行
PASS test/netx-client.test.ts :: client/03 服务端越界第一类：消息本身不合法 ⇒ 记录违规并拒绝继续
PASS test/netx-client.test.ts :: client/04 增量对不上号 ⇒ 不合并并记违规
PASS test/netx-client.test.ts :: client/05 快照的日志有洞 = 不可信
PASS test/netx-client.test.ts :: client/06 揭示核对的几类造假都会被当场发现
PASS test/netx-client.test.ts :: client/07 结算之前收到 deal 载荷（种子提前泄露）⇒ 违规并停手
PASS test/netx-client.test.ts :: client/08 error 分两类：漏牌即停手，普通回执不停手
PASS test/netx-client.test.ts :: client/09 重连消息带的是"我看到的 hand/seq"，没凭据时不发
PASS test/netx-client.test.ts :: client/11 揭示"自洽"但不是发牌用的那颗种子 ⇒ 仍然要报
PASS test/netx-client.test.ts :: client/10 旁观者的揭示（本局没参与、也没拿到过承诺）不报违规，也不算核对通过
PASS test/netx-client.test.ts :: client/12 收完份额之后改口重发承诺 ⇒ 当场识破，且那份"自洽揭示"随后也过不了（必修 1 主案）
PASS test/netx-client.test.ts :: client/13 对照组：不改口、只揭示另一个份额 ⇒ 承诺门独立就能抓住（洞在存储，不在核对逻辑）
PASS test/netx-client.test.ts :: client/13b 同值重发承诺要放过（断线补承诺），换局则重新开账
PASS test/netx-client.test.ts :: client/14 别人的承诺混进来仍然算越界（写一次门不改变这一条）
PASS test/netx-client.test.ts :: client/15 logShape 三道闸门报错文本互不相同，合法增量则一条不报（移植复审 S9）
PASS test/netx-client.test.ts :: client/16 拿到 token 但还没进过任何一手 ⇒ resume 发不出去（hand=0 是协议非法值），上层因此会改走 join
PASS test/netx-crypto.test.ts :: netx/01 SHA-256 命中 FIPS 180-4 公开向量
PASS test/netx-crypto.test.ts :: netx/02 与 node:crypto 逐字节差分（覆盖补齐边界与多字节 UTF-8）
PASS test/netx-crypto.test.ts :: netx/03 雪崩：改一个字符，256 位里至少一半上下变化
PASS test/netx-crypto.test.ts :: netx/04 base64 命中经典向量（长度余数 0/1/2 三条路径都走到）
PASS test/netx-crypto.test.ts :: netx/05 握手 accept 命中 RFC 6455 §1.3 向量，非法 key 抛错
PASS test/netx-crypto.test.ts :: netx/06 十六进制与字节的往返（承诺/份额的编码面）
PASS test/netx-crypto.test.ts :: netx/07 摘要入口对空输入与非空输入给出不同长度一致的输出
PASS test/netx-crypto.test.ts :: netx/08 SHA-1（握手用）与 node:crypto 差分，且命中 RFC 6455 §1.3 向量
PASS test/netx-frames.test.ts :: frame/01 编码的三档长度字段逐字节符合规范
PASS test/netx-frames.test.ts :: frame/02 客户端方向必须掩码，且 XOR 逐字节可复算
PASS test/netx-frames.test.ts :: frame/03 客户端→服务端：掩码帧能解，逐字节喂也要能解
PASS test/netx-frames.test.ts :: frame/04 掩码方向判反：客户端不掩码 / 服务端掩码 都拒
PASS test/netx-frames.test.ts :: frame/05 长度必须最小编码，64 位长度不得越出 32 位
PASS test/netx-frames.test.ts :: frame/06 RSV 位非 0 一律拒（没谈扩展就不许出现）
PASS test/netx-frames.test.ts :: frame/07 控制帧规则：ping/pong 原样交回，close 解析状态码
PASS test/netx-frames.test.ts :: frame/08 非法 close 一律拒（1 字节载荷 / 保留码 / 越界码）
PASS test/netx-frames.test.ts :: frame/09 控制帧不得分片、载荷不得过 125
PASS test/netx-frames.test.ts :: frame/10 文本分片可重组，控制帧插在中间也不丢序
PASS test/netx-frames.test.ts :: frame/11 跨分片的多字节字符不会解坏（UTF-8 状态在帧边界上延续）
PASS test/netx-frames.test.ts :: frame/12 非法帧序与未知操作码一律拒
PASS test/netx-frames.test.ts :: frame/13 巨帧、巨消息与编码侧都有上限
PASS test/netx-frames.test.ts :: frame/14 非法 UTF-8 文本帧拒收
PASS test/netx-frames.test.ts :: frame/15 握手 accept：已知向量 + key 边界
PASS test/netx-frames.test.ts :: frame/16 编码侧的三道参数自检：掩码键长度、分片点、pong 帧
PASS test/netx-frames.test.ts :: frame/17 64 位长度字段：非最小编码要拒、合法长帧要收、高 32 位不许越界
PASS test/netx-leak.test.ts :: leak/01 真实牌面在"亮牌"之前不出现在任何一条下行字节里（三家、跑完整一手）
PASS test/netx-leak.test.ts :: leak/02 种子与各家份额在揭示之前不外泄
PASS test/netx-leak.test.ts :: leak/03 中途加入的旁观者：既不在投影里，也没发现任何越界
PASS test/netx-leak.test.ts :: leak/04 增量重连与全量快照两条路收敛：日志逐条一致、数字一致
PASS test/netx-leak.test.ts :: leak/05 客户端第二道墙：服务端把别人的牌塞进投影 ⇒ 当场发现并拒绝再行动
PASS test/netx-leak.test.ts :: leak/06 上行 nonce 各交一份、互不相同，且承诺里读不出份额
PASS test/netx-netplay.test.ts :: nui/01 联机快照与单机快照键集逐字一致 ⇒ 同一套 scene/paint 不必改一个字
PASS test/netx-netplay.test.ts :: nui/02 只有一道墙：netplay 里不得出现第二份协议实现，也不得自己判规则算钱
PASS test/netx-netplay.test.ts :: nui/03 两家打完两整手：看牌 / 加注 / 比牌 / 结算面板 / 第二手轮庄，两侧数字逐字一致
PASS test/netx-netplay.test.ts :: nui/04 负向：没看牌时本人牌不在快照里，别家牌面全程不出现
PASS test/netx-netplay.test.ts :: nui/05 伪造下行：当场标"不可信"并停手；leak_blocked 与 replaced 的提示可区分
PASS test/netx-netplay.test.ts :: nui/06 断线重连：增量与快照两条路都真走到，台账一颗不错
PASS test/netx-netplay.test.ts :: nui/07 同一浏览器两个标签页各占一座：per-tab 存储互不覆盖；共享存储会翻车（对照）
PASS test/netx-netplay.test.ts :: nui/08 超时托管一路带到 UI：日志行里就是 timeout→call 的字样
PASS test/netx-netplay.test.ts :: nui/09 按钮：可用性只看服务端 phase/turn；金额来自引擎那一处算术且只进文案（Q6=A2）
PASS test/netx-netplay.test.ts :: nui/10 刷新之后仍能核对揭示：份额必须随凭据一起存下来
PASS test/netx-netplay.test.ts :: nui/11 (a) 端到端价格一致性：行动前页面显示的 cost === 行动后 log 里那条事件的 amount（跟/加/比各一次）
PASS test/netx-netplay.test.ts :: nui/12 (b) 闷/明差价在页面上看得见，且两个数都等于 priceOf 的输出（不是测试里手写的常量）
PASS test/netx-netplay.test.ts :: nui/13 (c) 买不起跟价的座位：按钮仍然可点、发得出去，代价由服务端 reject 送回来并被页面显示
PASS test/netx-netplay.test.ts :: nui/14 (d) 同一条按钮契约两条路共用一处算术：单机 buttonOptions 的 cost 与联机 buttonRow 的 cost 相等
PASS test/netx-netplay.test.ts :: nui/15 意图 → 动作的收窄：只有五种真行动能上协议线，推进类意图一律 null
PASS test/netx-netplay.test.ts :: nui/18 凭据作废（房间重启后 token 不认）⇒ 清存储 + 说清楚 + 自动补一条全新 join，页面不许停在"已连接、零下行"
PASS test/netx-netplay.test.ts :: nui/17 页面模块图在静态服务策略下完整可达（浏览器实测抓到的那类 403 由这条兜住）
PASS test/netx-netplay.test.ts :: nui/16 入口层静态门：main.ts 只接线不判规则，联机那一侧只有一个进口
PASS test/netx-protocol.test.ts :: proto/01 双向消息 encode→check 往返保真，且字节稳定
PASS test/netx-protocol.test.ts :: proto/02 未知 key 一律拒（顶层、嵌套 move、嵌套 view、rules 内部）
PASS test/netx-protocol.test.ts :: proto/03 缺 key 与类型不符一律拒
PASS test/netx-protocol.test.ts :: proto/04 数值与长度越界一律拒
PASS test/netx-protocol.test.ts :: proto/05 引擎拒绝码全集与 src/engine/validate.ts 逐字对齐（防契约漂移）
PASS test/netx-protocol.test.ts :: proto/06 服务端实际发出的 net 拒绝码都在声明集合里，且声明集合没有空转项
PASS test/netx-protocol.test.ts :: proto/07 checkViewLeak 拦住五种越界投影，放过两种合法情形
PASS test/netx-protocol.test.ts :: proto/08 已看牌但未亮牌的"别人"仍然算泄漏（rev=4 口径在网络层同样生效）
PASS test/netx-protocol.test.ts :: proto/09 toAction 只能用绑定的座位，compare 才带 target
PASS test/netx-protocol.test.ts :: proto/10 校验错误信息带路径，便于线上定位
PASS test/netx-protocol.test.ts :: proto/11 巨帧保护：超过上限的字符串直接拒
PASS test/netx-protocol.test.ts :: proto/12 出口编码也过同一套校验：服务端构造出非法消息时本地就炸，不发到线上
PASS test/netx-protocol.test.ts :: proto/13 入参既不是 JSON 文本也不是对象 ⇒ 报"必须是文本或对象"，不报成 schema 错（rev=9 应修 3）
PASS test/netx-room.test.ts :: room/01 两家入座即开局：hello→承诺→份额→发牌，第三条连接中途加入不参与本局
PASS test/netx-room.test.ts :: room/02 承诺先于任何份额被接受（线上顺序可查，且承诺不是份额本身）
PASS test/netx-room.test.ts :: room/03 没凑齐份额就不发牌；凑齐的那一刻发牌，且发牌后种子仍不外泄
PASS test/netx-room.test.ts :: room/04 发牌之后再交份额一律被拒，且局面一字不动
PASS test/netx-room.test.ts :: room/04b 收份额阶段：错局号与"不在这局里"的家都被拒
PASS test/netx-room.test.ts :: room/05 座位由连接绑定：上行里没有 seat 字段，越界与伪造一律无副作用
PASS test/netx-room.test.ts :: room/06 完整一手：行动、结算、揭示核对，客户端零违规、总筹码守恒
PASS test/netx-room.test.ts :: room/07 全程没人动手：超时托管把一手牌走到结算，且走的是"自动跟注"这条臂
PASS test/netx-room.test.ts :: room/08 断线重连·seq 对得上 ⇒ 只补增量，补齐后三家视图与日志逐条一致
PASS test/netx-room.test.ts :: room/09 断线跨了一局再回来 ⇒ 拿的是新一局的快照，且本局种子对它合法可见
PASS test/netx-room.test.ts :: room/10 掉线者不交份额 ⇒ 到点改成两人局，牌局照常走完
PASS test/netx-room.test.ts :: room/11 多局连续：轮庄、筹码结转、每一局的揭示都对得上
PASS test/netx-room.test.ts :: room/12 桌上凑不齐两家就收桌：破产者下一局不再入池，筹码一颗不少
PASS test/netx-room.test.ts :: room/13 重连凭据的保护：乱 token 不绑座，真 token 回原位并顶掉旧连接
PASS test/netx-room.test.ts :: room/14 承诺与揭示双向绑定：打得开、合得出、换一家就对不上
PASS test/netx-room.test.ts :: room/15 房间层的门槛：最小买入与满座都不占座
PASS test/netx-room.test.ts :: room/16 driveToSettle 走的一手牌必然在有限步内终止（引擎不变量在联机层同样成立）
PASS test/netx-room.test.ts :: room/17 结算之后才回来的那一家，承诺+快照+揭示一起补回（审计材料不因断线丢失）
PASS test/netx-room.test.ts :: room/20 阶段门在房间层：awaitingSettle 之后的行动被房间挡下（不是丢给引擎）
PASS test/netx-room.test.ts :: room/19 没绑上座位的连接：任何游戏消息都只会拿到 no_seat，不会碰到局面
PASS test/netx-room.test.ts :: room/18 定时器不泄漏：发牌后 nonce 表必须取消，结算后只剩局间那一只
PASS test/netx-room.test.ts :: room/21 应用层 ping→pong 端到端（rev=8 里这条路径零覆盖）
PASS test/netx-room.test.ts :: room/22 已经绑上座位的连接再 join ⇒ already_joined，座位绑定不动
PASS test/netx-room.test.ts :: room/23 拿别人座位的 token 在已绑座的连接上重连 ⇒ token_seat_mismatch
PASS test/netx-room.test.ts :: room/24 行动阶段的两道门：没有牌局 ⇒ not_dealt，局号错位 ⇒ bad_hand
PASS test/netx-room.test.ts :: room/25 份额阶段的两道门：没有牌局 ⇒ not_dealt，不在本局名单里的 party ⇒ no_seat
PASS test/netx-room.test.ts :: room/26 诊断面的连接清单按码点序给出（与份额定序同一把尺，rev=8 应修 5）
PASS test/netx-room.test.ts :: room/27 构造期三道 TypeError 各自说清越界在哪（rev=9 应修 1）
PASS test/netx-room.test.ts :: room/28 到点还凑不齐最低人数 ⇒ 本局作废、只挂局间表、到点重开为第二局（rev=9 应修 2）
PASS test/netx-room.test.ts :: room/29 庄家那一座没交份额 ⇒ 剔除之后庄家必须挪到还在桌的一家，牌局照常开（旧行为：整个房间进程被 TypeError 打死）
PASS test/netx-seed.test.ts :: seed/01 承诺把 hand / party / 份额三者绑在一起
PASS test/netx-seed.test.ts :: seed/02 合成与提交顺序无关（任何一端都能独立复算）
PASS test/netx-seed.test.ts :: seed/03 改任何一家的份额，种子必变（没有旁观者）
PASS test/netx-seed.test.ts :: seed/04 没有任何一家能决定种子：固定其余各家，逐家扫描 32 个候选
PASS test/netx-seed.test.ts :: seed/05 局号参与合成：同一批份额在不同局给出不同种子
PASS test/netx-seed.test.ts :: seed/06 合成结果是引擎接受的 uint32 整数
PASS test/netx-seed.test.ts :: seed/07 非法份额输入一律抛错（含能造成拼接歧义的字符）
PASS test/netx-seed.test.ts :: seed/08 揭示核对：一一对上才算通过
PASS test/netx-seed.test.ts :: seed/09 承诺文本是单射的：改一个字符就换摘要（雪崩在这里体现为不可伪造）
PASS test/netx-seed.test.ts :: seed/10 座位方命名在 party charset 内，且与"server"不撞
PASS test/netx-seed.test.ts :: seed/12 合成用的是完整 32 位（截断成 16 位会被这条抓到）
PASS test/netx-seed.test.ts :: seed/13 定序只用码点键：seedVector 与 canonicalShares 是同一把尺（rev=8 必修 4）
PASS test/netx-seed.test.ts :: seed/14 互为前缀的 party 名（seat:1 与 seat:10）：定序排的是 party，不是拼接串
PASS test/netx-seed.test.ts :: seed/11 固定向量：复审可照抄复算
PASS test/netx-serve.test.ts :: srv/01 房间进程在空闲端口上起来：/health 与 webui 页面同源同端口
PASS test/netx-serve.test.ts :: srv/02 两家从房间进程真跑一手牌：跨真 socket 的揭示核对通过，零越界
PASS test/netx-serve.test.ts :: srv/03 一条命令起、一句 quit 干净退出（退出码 0，不是被硬杀）
PASS test/netx-serve.test.ts :: srv/04 坏端口参数：退出码 2 且留一句话
PASS test/netx-serve.test.ts :: srv/05 默认端口在"房间进程"与"页面输入框"两处不许各说各话
PASS test/netx-static.test.ts :: nst/01 扫描范围覆盖 netx 全部源文件，可移植清单里的文件都真实存在
PASS test/netx-static.test.ts :: nst/02 零第三方依赖：netx 里每个 import 都是相对路径或 node: 内置
PASS test/netx-static.test.ts :: nst/03 协议核心里没有时钟、随机与 IO（引擎的确定性口径延续到联机层）
PASS test/netx-static.test.ts :: nst/04 分层：src/ 与 webmin/ 完全不知道联机存在；webui 里只有 netplay.ts 这一个进口
PASS test/netx-static.test.ts :: nst/05 tsconfig 的 include 覆盖 netx，且沿用同一条可擦除语法约束
PASS test/netx-static.test.ts :: nst/06 netx 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）
PASS test/netx-static.test.ts :: nst/07 M4 之后依赖面仍然没扩：dependencies 空、devDependencies 仍在白名单内
PASS test/netx-static.test.ts :: nst/08 房间层的时钟与随机全部来自注入（RoomOptions 是唯一的入口）
PASS test/netx-static.test.ts :: nst/10 Q6=A2 ④：价格公式不许扩散 —— 页面侧只有 netplay.ts 这一个接缝
PASS test/netx-static.test.ts :: nst/11 跑测工装必须挡住"带 PID 的实验警告"这条双跑破口（§0.5）
PASS test/netx-static.test.ts :: nst/09 M4 的测试文件自己也不许用时钟与随机（否则双跑必然不一致）
PASS test/netx-ws.test.ts :: ws/01 三个独立 WebSocket 客户端打进来，跑完整一手并各自核对揭示
PASS test/netx-ws.test.ts :: ws/02 /health 可读；普通 HTTP 请求不会误入升级分支
PASS test/netx-ws.test.ts :: ws/03 握手与帧的严格性在真 socket 上生效：合法 101、旧版本 426、未掩码被 1002 关掉
PASS test/netx-ws.test.ts :: ws/05 非法握手的每一条都被拒，且拒绝不在房间里留下连接
PASS test/netx-ws.test.ts :: ws/06 真 socket 上的控制帧：客户端 ping 得到同载荷 pong，坏帧得到 1002（rev=9 应修 3）
PASS test/netx-ws.test.ts :: ws/04 真 socket 断线：牌局在托管下走完，凭 token 重连后拿到完整局面并核对揭示
PASS test/rules.test.ts :: rules/01 presets.classic 幂等通过 validateRules
PASS test/rules.test.ts :: rules/02 presets.a23off 幂等通过 validateRules
PASS test/rules.test.ts :: rules/03 两个 preset 仅在 handEval.a23 上不同
PASS test/rules.test.ts :: rules/04 classic 的每个数值逐项等于工单 §1 表格
PASS test/rules.test.ts :: rules/05 未知顶层 key special235=true 抛 TypeError
PASS test/rules.test.ts :: rules/06 未知 key 即使值为 false 也抛（不在 v1 schema）
PASS test/rules.test.ts :: rules/07 未知嵌套 key 抛（handEval / bet 内）
PASS test/rules.test.ts :: rules/08 缺 key 抛（顶层与嵌套各一例）
PASS test/rules.test.ts :: rules/09 值类型错抛（字符串数字 / null / 非布尔）
PASS test/rules.test.ts :: rules/10 version 必须是字面量 1
PASS test/rules.test.ts :: rules/11 字面量域的非法值抛（allIn / compare.tie / showdown.*）
PASS test/rules.test.ts :: rules/12 tierOrder 必须是 6 档无重复排列
PASS test/rules.test.ts :: rules/13 非对象输入一律抛
PASS test/rules.test.ts :: rules/14 validateRules 返回值深冻结（顶层/嵌套/数组都改不动）
PASS test/rules.test.ts :: rules/15 validateRules 返回深拷贝，输入事后被改不影响副本
PASS test/rules.test.ts :: rules/16 presets 本身深冻结
PASS test/rules.test.ts :: rules/17 错误消息点名违规所在路径与 key
PASS test/rules.test.ts :: rules/18 dealer.next 三档各自合法，且 preset 默认 = rotate
PASS test/rules.test.ts :: rules/19 dealer 的非法形态一律抛（枚举外值 / 缺字段 / 多余 key / 非对象 / 大小写）
PASS test/static.test.ts :: static/00 扫描范围覆盖 cards / rules / engine / ai 全部源文件
PASS test/static.test.ts :: static/01 src 里不出现时钟与随机全局态
PASS test/static.test.ts :: static/02 src 里不出现文件、网络与控制台 IO
PASS test/static.test.ts :: static/03 src 不引用任何运行时全局可变对象
PASS test/static.test.ts :: static/04 import 只允许相对路径；M0 两文件只允许 import type ./rules.ts
PASS test/static.test.ts :: static/05 src 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）
PASS test/static.test.ts :: static/06 零运行时依赖：dependencies 必须为空（或整体不存在）
PASS test/static.test.ts :: static/07 devDependencies 落在工单白名单内
PASS test/static.test.ts :: static/08 npm test 是单命令，且不依赖任何已安装依赖
PASS test/static.test.ts :: static/09 tsconfig 打开 strict 与 erasableSyntaxOnly
PASS test/static.test.ts :: static/10 输出生产者 test/run.ts 不引用时钟（保证两次运行一致）
PASS test/static.test.ts :: static/11 测试目录可被 runner 发现且无空目录
PASS test/static.test.ts :: static/12 M0 冻结接口：cards/rules 的导出名恰好是 §2.7 契约（不夹带私有实现的导出）
PASS test/static.test.ts :: static/13 src/ai 只用投影信息：越界引用与运行时依赖一律为 0 命中
PASS test/webmin-dealer.test.ts :: dealer/01 rotate：庄家的下家接任（手推座位号）
PASS test/webmin-dealer.test.ts :: dealer/02 winner：单赢家通吃即该赢家坐庄
PASS test/webmin-dealer.test.ts :: dealer/03 winner：平局分池先给拿到余数的那位，无余数才按环形最近
PASS test/webmin-dealer.test.ts :: dealer/04 loser：非赢家中距庄家下家最近者；其离桌则环形顺延到下一家输家
PASS test/webmin-dealer.test.ts :: dealer/05 loser 档无在桌输家时退回轮庄（Q2 已裁定 A）
PASS test/webmin-dealer.test.ts :: dealer/06 三档都没有可留的座位时返回 null（调用方该收桌）
PASS test/webmin-dealer.test.ts :: dealer/07 createSession：三档都合法、默认 rotate、非法值抛 TypeError
PASS test/webmin-dealer.test.ts :: dealer/08 会话层：winner 档 ⇒ 每局庄家 = 上一局赢家
PASS test/webmin-dealer.test.ts :: dealer/09 会话层：loser 档 ⇒ 庄家来自上一局非赢家（除非无在桌输家）
PASS test/webmin-dealer.test.ts :: dealer/10 会话层：rotate 档仍是老行为（庄位逐局换人），且三档结果互不相同
PASS test/webmin-dealer.test.ts :: dealer/11 选庄不改钱：三档各自跨局守恒
PASS test/webmin-model.test.ts :: ui/01 createSession 建立座位、首局与台账
PASS test/webmin-model.test.ts :: ui/02 非法开局参数一律抛 TypeError
PASS test/webmin-model.test.ts :: ui/03 deriveSeed 确定、逐局不同、不用时钟
PASS test/webmin-model.test.ts :: ui/04 没轮到真人时点按钮 → 拒绝且状态指纹不变
PASS test/webmin-model.test.ts :: ui/05 真人+机器人打完一整局：走到结算，台账守恒
PASS test/webmin-model.test.ts :: ui/06 真人发起合法比牌恰好淘汰一家；期间确证首圈禁比挡过
PASS test/webmin-model.test.ts :: ui/07 乱点不崩：非法意图 ok:false 且指纹不变；整桌重来永远可点
PASS test/webmin-model.test.ts :: ui/08 再来一局：局号 +1、庄家轮转到下家、总额守恒
PASS test/webmin-model.test.ts :: ui/09 连打 12 局：每局有限步结束、总额恒定
PASS test/webmin-model.test.ts :: ui/10 机器人走 AI：只出合法意图、闷着不加注不比牌、注级抬高先转明
PASS test/webmin-model.test.ts :: ui/10b 机器人走 AI：强牌加注 / 同一副牌随赔率翻转 / 闷着遇高注级先转明
PASS test/webmin-model.test.ts :: ui/10c 未看牌的机器人决策与手牌无关（同一局面只换牌）
PASS test/webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
PASS test/webmin-model.test.ts :: ui/11b 整桌重来要请回破产离桌的人，并保留庄家规则档位（M2 实测抓到的两个缺陷）
PASS test/webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
PASS test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
PASS test/webmin-model.test.ts :: ui/14 分层边界：model 不碰 DOM/时钟/随机，app 不碰 node 内置也不自己判规则
PASS test/webmin-model.test.ts :: ui/15 页面接线：html 与各模块 import 路径都能被服务放行
PASS test/webmin-model.test.ts :: ui/16 一整局的可见性推进：局中暗牌、终局按规则亮
PASS test/webmin-model.test.ts :: ui/17 页面显示的牌型名与 classify 判定一致（且以看过牌为前提）
PASS test/webmin-model.test.ts :: ui/18 未看牌时 view() 全树序列化与座位行都搜不到真人牌面
PASS test/webmin-model.test.ts :: ui/19 结算信息一条不丢：每家的账就地进座位板，结算块只留原因与指纹（rev=7 ④的前提）
PASS test/webmin-model.test.ts :: ui/20 亮牌文本行：ASCII 记法逐张对得上，且只列真亮出来的牌（验收④给机器的读法）
PASS test/webui.test.ts :: ui3/01 层次：webui 只 import 彼此与 webmin/model，绝不直接碰引擎或 src
PASS test/webui.test.ts :: ui3/02 层次：只有入口层能碰 DOM；UI 侧一行规则判定都没有
PASS test/webui.test.ts :: ui3/03 bridge：开桌后快照结构化，未看牌 ⇒ 每一行都是隐藏位
PASS test/webui.test.ts :: ui3/04 bridge：三档庄家规则都开得出桌并回显在快照里
PASS test/webui.test.ts :: ui3/04b 页面接线：开桌控件与 StartOptions 一一对应，庄家三档不许在 M3 这一版丢掉
PASS test/webui.test.ts :: ui3/05 bridge：非法意图走引擎拒绝路径，计数与状态指纹都对
PASS test/webui.test.ts :: ui3/06 bridge：真人点看牌 ⇒ 只有自己那行亮牌，且快照里搜不到任何别家牌面
PASS test/webui.test.ts :: ui3/07 bridge：把一局打完 ⇒ 结算区有内容、日志在长、桌上总额守恒
PASS test/webui.test.ts :: ui3/08 scene 是纯函数：同一输入两次布局逐字节相同
PASS test/webui.test.ts :: ui3/09 scene 布局不变量：命中区与按钮一一对应、互不重叠、都在画布内（三种视口）
PASS test/webui.test.ts :: ui3/09b 低于最小视口时不做布局、只画提示，且不留下任何可点区（不装作能玩）
PASS test/webui.test.ts :: ui3/09c 竖向预算先给牌桌：候选 10 个时按钮条至多 3 行，座位板照旧不挤不越界（变异 U05 复发哨）
PASS test/webui.test.ts :: ui3/10 scene 命中测试：中心与四条边角都算命中，边界外 1px 不命中
PASS test/webui.test.ts :: ui3/11 scene 不泄露未看过的牌：开局整棵图元树里没有任何牌面字符
PASS test/webui.test.ts :: ui3/11b 看牌前后：整棵图元树从 0 张牌面变成正好 3 张（且就是本人那手）
PASS test/webui.test.ts :: ui3/12 paint 只执行图元：假 ctx 下调用次数与图元数一一对应
PASS test/webui.test.ts :: ui3/13 静态服务放行 webui（不装 vite 也跑得起），根路径仍指向 M1.5
PASS test/webui.test.ts :: ui3/14b 没轮到真人时"整桌重来"仍报合法（U01 复发哨：灰按钮不许谎报会被拒）
PASS test/webui.test.ts :: ui3/15 翻牌动画：进度过半之前一张牌面都不许出现，之后才亮
PASS test/webui.test.ts :: ui3/16 动画进度是纯入参：同一 (快照, anim) 两次布局逐字节相同；不给 anim 时直接终态
PASS test/webui.test.ts :: ui3/17 没配 since 的座位视为已翻开；换局后重新亮牌的座位会重新起算
PASS test/webui.test.ts :: ui3/14 灰按钮点了必被引擎拒（验收③在 M3 侧的等价形态）
PASS test/webui.test.ts :: ui3/18 牌面放大：每张亮牌 ≥48×64、点数 ≥18px，本人手牌再大一档（工单 rev=7 ①）
PASS test/webui.test.ts :: ui3/19 2–6 家都排得开：座位板数量对得上、互不重叠、不越界、不压按钮（工单 rev=7 ②）
PASS test/webui.test.ts :: ui3/19b 极端候选数下只许二选一：要么明说装不下，要么座位板/按钮/底部条互不重叠（不许硬排）
PASS test/webui.test.ts :: ui3/20 结算块不许盖住任何一张亮出来的牌（牌刚亮完就被盖住 = rev=7 要修的老毛病）
PASS test/webui.test.ts :: ui3/21 顶栏不许被牌桌盖住：状态行是整句，被木轨吃掉就等于丢信息（rev=7 实测缺陷复发哨）
PASS test/webui.test.ts :: ui3/22 按钮文案一个字都不许丢：折行只改行数，且每行都得待在自己那颗按钮里
PASS test/webui.test.ts :: ui3/23 牌角不许爬到邻牌脸上：每个点数/花色图元必须待在"自己那张牌露出来的那一条"里
PASS test/webui.test.ts :: ui3/24 桌面中央的"亮牌"文本行：每张亮牌都在里面、字号够读、且不压任何座位板

=== NOTES (fixed vectors, recompute-able independently) ===
AI-CALIB max|est-true|=0.3pp over 24 anchors
AI02 tier-percentile max diff=0.27pp
AI09 compare=1/200 组（其中有资格比牌的才 9 组）
AI12 trigger=14.6% over 1000 seqs
CANONICAL mulberry32 seed=1 float_first=0.6270739405881613
CMP 2S 2D 9C vs 3S 4D 5C = -1
CMP 2S 3D 4C vs AS KS QS = -1
CMP 4S 9S JS vs AS 2S 3S = -1
CMP 9S 9D 2C vs 9C 9S 2D = 0
CMP AS 2S 3S vs QD KC JS = 1
DEAL seat=0 hand=T♠2♠J♠ tier=flush ranks=[11,10,2]
DEAL seat=1 hand=5♠9♣J♥ tier=highCard ranks=[11,9,5]
DEAL seat=2 hand=3♠6♦A♦ tier=highCard ranks=[14,6,3]
DEAL seat=3 hand=6♠K♥7♣ tier=highCard ranks=[13,7,6]
DEAL seat=4 hand=2♥7♠T♣ tier=highCard ranks=[10,7,2]
DEAL seat=5 hand=Q♥J♣7♦ tier=highCard ranks=[12,11,7]
DEALER08 winner 0>2=>2 2>0=>0 0>1=>1 1>0=>0 0>0=>0 0>3=>3
DEALER09 loser hands=6 fallback=0
DEALER10 rotate=0,1,2,3,0 winner=0,2,0,1,0 loser=0,1,3,1,2
ENUM a23off actual   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off anchor   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off closed   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM classic actual   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic anchor   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic closed   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
FUZZ-ILLEGAL probes=3645 rejected=3247
FUZZ-ILLEGAL4 probes=15589 not_current_turn=5592 cannot_afford=2796 bad_target=2921 compare_forbidden_before_first_actions=2672
FUZZ-MODE reasons=oneLeft,stakeCap,stall
FUZZ-ai hands=1000 maxSteps=17 decisions=9262 look=1231 compare=117 有比牌的局=113 reasons=oneLeft=300 stakeCap=42 stall=658
FUZZ-random hands=1000 maxSteps=22 decisions=0 look=0 compare=0 有比牌的局=0（decisions/look/compare 只统计 decideAi 的决策，随机臂不经过 AI ⇒ 恒为 0，不是"随机臂不打比牌"） reasons=oneLeft=755 stakeCap=233 stall=12
FUZZ200 maxSteps=19 reasons=oneLeft=169 stakeCap=27 stall=4
HASH seed11-3calls=c654f607d89ce8c9
REPLAY cap seed=1 hash=03adaa7bef0f0d99
REPLAY cap seed=2 hash=2d3f6f85ce3ae82f
REPLAY cap seed=5 hash=0966c43c35d04a96
REPLAY foldout seed=1 hash=f6ebdc809abcb74a
REPLAY foldout seed=2 hash=aceb2772ab74efc0
REPLAY foldout seed=5 hash=096e62b78da9c34d
REPLAY stall seed=1 hash=1730bb61755d018f
REPLAY stall seed=2 hash=80606e936d104725
REPLAY stall seed=5 hash=286b96c25face2b4
SCRIPT02 seed=1 loser1=2 loser2=0
SCRIPT05 seed=1061 pot=13 shares=7,6
SCRIPT06 seed=622 tie hands: 1=[{"rank":8,"suit":1},{"rank":14,"suit":0},{"rank":7,"suit":3}] 2=[{"rank":7,"suit":1},{"rank":8,"suit":2},{"rank":14,"suit":3}]
SEED base=20260925 h1=3776361071 h2=1243603819
SETTLE seed1-stall chips=96,108,96 pot0 total=300
SHUFFLE-FAIR trials=20000 expected=384.61538461538464 min=331 max=431
SORT1000 seed=20260925 ties=2182 first=[{"rank":10,"suit":3},{"rank":10,"suit":1},{"rank":10,"suit":0}]
TRANS full_triples=94196375 implied_triples=47201700
UI05 steps=5 结束原因：同一注级下各家各完成 3 次行动 → 强制开牌
UI06 合法比牌达成，且首圈禁比确凿生效过
UI07 rejected=7/7
UI09 hands=12 total=768 over=null
UI10 botSteps=253 raise=10 call=110 fold=43 look=77 compare=13
UI11 收桌于第 3 局：只剩 1 家还付得起底注（最少需要 2 家），牌局结束
UI16 reason=stall
UI19 待结算样本：phase=awaitingSettle 赢家=1
UI20 亮牌：你 8C 3S KS 单张 / 电脑1 5S TC 5H 对子 / 电脑3 QS 3H 7D 单张
UI307 结算行=5 日志行=12 点击=3 被拒=0
VECTOR mulberry32 seed=1 first8=2693262067,11749833,2265367787,4213581821,4159151403,1207330352,2632122864,3095568220
VECTOR mulberry32 seed=2 first8=3153583793,1395857638,1225337227,2310499808,3759333107,2709408573,2144054433,1534354113
VECTOR mulberry32 seed=4294967295 first8=3850105811,813802916,3073704848,4054706436,3630262831,2315588663,2922715533,2042566601
VECTOR shuffle seed=1 first12=TS 2S JS 5S 9C JH 3S 6D AD 6S KH 7C
VECTOR shuffle seed=1 last6=2D 3C QC KC 8D 4H
frame/15 握手向量 = RFC 6455 §1.3（SHA-1 + GUID 258EAFA5-E914-47DA-95CA-C5AB0DC85B11）
frame/17 64 位长度三臂：非最小拒 / 66000 字节合法帧解通 / 0x10000 声明走"等数据"分支
leak/01 按 seed 独立复算三家的牌面，逐条扫描"别人看到且尚未亮牌"的下行（96 次检查）：零命中
leak/02 结算视图前扫描 36 条下行：种子字段/种子数字零命中；揭示前份额明文零命中
leak/04 抖动重连 8 次之后仍与稳定路径逐条收敛
netx/02 SHA-256 与 node:crypto 差分 208 条输入全部一致
netx/08 SHA-1 与 node:crypto 差分 202 条一致；握手向量 = RFC 6455 §1.3
nst/07 依赖面：dependencies={}，devDependencies=@types/node,typescript,vite
nst/09 M4 测试文件 12 份：netx-client.test.ts, netx-crypto.test.ts, netx-fixtures.ts, netx-frames.test.ts, netx-leak.test.ts, netx-netplay.test.ts, netx-protocol.test.ts, netx-room.test.ts, netx-seed.test.ts, netx-serve.test.ts, netx-static.test.ts, netx-ws.test.ts；时钟例外只给 netx-ws.test.ts / netx-serve.test.ts（仅看门狗）
nst/10 扫 webui 全部 5 个 .ts：价格算式只在 webui/netplay.ts，其内 priceOf 只调一次、三档按钮都从它取数
nui/01 快照 20 个字段两边一致；联机快照排版出 39 图元 / 0 命中区
nui/03 两整手：第 1 手池 0，第 2 手庄家=座位1，终局台账 512
nui/04 未看牌 / 别家牌面 / 开牌之后三个阶段各自都拿整棵快照搜过（含正、反向对照）
nui/05 三类可见反馈各自可辨认：伪造下行→停手；leak_blocked→漏牌；replaced→顶号
nui/06 三条重连形状各自真实走到：断线→(seq,now] 增量、同局刷新→(0,now] 增量、跨局→全量快照；台账全程守恒 512
nui/07 per-tab 存储各占一座；换成共享存储时"甲"被接回座位1（=乙的座位）
nui/08 UI 日志里 6 条 timeout→call；末条：#007 call      甲 出 1 @注级1｜timeout→call dark×stake
nui/09 按钮只列候选意图；cost 恒 null；不轮到自己时全灰且发不出去
nui/10 份额随凭据存住 ⇒ 刷新重连后局末核对照样通过，且服务端不再向它重复收份额
nui/11 (a) 三种行动各自对账通过：raise=4@注级1 / call=4@注级2 / compare=4@注级2
nui/12 (b) 注级 1：闷 1 → 明 2，两个数都由 priceOf 现算
nui/13 (c) 穷座筹码 1 对 8 的跟价：仍可点、发得出、服务端拒、页面照实说
nui/14 (d) 两条路对同一 state 逐按钮相等：25 次、11 种组合
nui/16 入口层只有接线与显示：netx 进口为零，规则与价格的判定面全在别处
nui/17 模块图 19 个文件全部可达，其中 netx 只有 4 个：netx/client.ts, netx/protocol.ts, netx/seed.ts, netx/sha256.ts
nui/18 bad_token ⇒ 清存储 + 提示 + onText 自己产出 join（一次），哑管道端到端也真把局面接回来了
proto/01 上行 6 条 / 下行 10 条往返保真且字节稳定
proto/06 net 拒绝码 5 个全部会被真正发出：bad_hand, no_seat, not_dealt, bad_nonce, nonce_late
proto/12 出口编码：6 类非法消息全部在本地被拦（服务端不能只约束客户端）
proto/13 parse() 两条报错口径互不混用：非文本非对象 / 坏 JSON / schema 缺 key 各归各
room/07 全程托管 ⇒ 六次 timeout→call、零弃牌、终局 stall；三家版见 timeout/01
room/11 三局庄家轮转 0→1→2；结束时 0:249 1:256 2:263
room/16 2~6 家全部靠"看牌+跟注"走到强制开牌，无违规、无 fault
room/17 缺席完全局的重连：承诺/快照/揭示三件齐补，种子核对通过
room/18 每一阶段的待发定时器数量恒为 1（nonce/回合/结算表都被正确取消）
room/21 应用层心跳：三条 ping 各自回显，局面一字未动（3 条 pong）
room/26 连接清单 = A2, B3, C2, a10, c1, c10（码点序；locale 序会是 a10, A2, B3, c1, c10, C2）
room/28 到点开不齐人 ⇒ 本局作废 + 局号不回卷 + 台账零扣减；重开后份额重新收
room/29 庄家缺席 ⇒ 挪到座位1、牌局开出来、进程没炸；缺席家筹码原样
seed/11 合成 seed=1498111553（份额明文见 netx-seed.test.ts 顶部 SHARES）
seed/11 固定向量 hand=1 shares=[seat:0:49af21ae…, seat:1:4ec39f40…, seat:2:e4aa43f9…, server:12be698b…]
seed/12 4096 组份额合成 4096 个互不相同的种子，最大值 4294600091
seed/13 码点序=A,Seat:10,a,seat:2,server / locale 序=a,A,Seat:10,seat:2,server ⇒ 向量取前者，权威路径同键（seed=3577986836）
seed/14 前缀相撞的 party 名：权威 = 向量 = seat:1,seat:10,seat:2,server（seed=2391714912）
srv/02 真 socket 走完一手：19 步，两家各自核对通过（端口由内核挑，不印进输出）
srv/05 默认端口 8790：进程与页面两处一致；存储与熵源口径也钉住
timeout/06 托管与自主跟注只差 note：timeout→call seen/dark×stake vs dark×stake
ws/01 真实 socket + Node 内置 WebSocket 客户端跑完一手牌：11 个 seq，三家各自核对通过
ws/04 断线期间牌局由托管走完；重连后 seq 从 0 追到 9，揭示核对通过
ws/05 9 条非法握手各自被拒（400/404/426 按来源分档），零连接残留
ws/06 控制帧：ping(122,104,33,0,255) 原样回显、零长度边界、客户端 pong 不回声（管道里恰好一个 pong）、非法帧 1002

RUNNER files=29 cases=393
SUMMARY pass=393 fail=0 total=393
RESULT=ALL_PASS
```

## 10.6 `npx tsc --noEmit`

exit=0，无诊断（`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `erasableSyntaxOnly` 全开，
`netx/**` 与 `webui/**` 都在 `include` 里 —— `nst/05`/`nst/06` 守着）。

## 10.7 真浏览器实测（逐条证据在 `evidence/m5-browser-live.txt`）

跑法：`node netx/serve.ts 8790`（一条命令，页面与 ws 同端口）+ 浏览器里一个标签页当"甲"，
对面那一家是 `node .scratch/r10-peer.ts ws://127.0.0.1:8790 乙`（真 socket、**同一份 `netx/client.ts`**）。

拿到的是什么：

| 口径 | 页面上读到的原文（摘要） |
|---|---|
| 两整手 + 结算面板 | 第 8 手：`#009 compare 甲 → 乙 出 4 @注级2｜开牌 cmp=1 loser=0` → `panel: 结束原因…｜乙[玩家]｜J♠ A♥ T♣ 单张｜没赢（现筹码 166）｜甲[你]｜J♣ 2♣ 6♣ 同花｜赢 20（现筹码 346）｜本局序号 11｜揭示核对 通过` |
| 两侧数字一致 | 对面那一家同一刻记 `HAND 8 seat=0 verified=7 chips=0:166,1:346 violations=[]` |
| 台账守恒 | 全程 `total=512`（两笔买入），`ledgerLine=乙=166 甲=346` |
| A2 价格上页面 | 闷：`跟注（出 1）/加注（出 2）`；注级 4 时 `跟注（出 8）`，而日志里那一笔正是 `call 甲 出 8` |
| 只显示不判定 | 按加注收到 `stake_at_max` ⇒ 牌桌警告位印 `服务端拒绝：stake 16 cannot double within max 16`，按钮**没有**被页面自己禁掉 |
| 重连（验收②） | 刷新前 `seat=1 hand=9 seq=5 乙=163 甲=344`；刷新后凭 `sessionStorage` 里那份凭据 resume ⇒ `seat=1`、第 11 手日志整段补回、`total=512`、`trustLines=[]` |
| 伪造下行（验收③） | 灌一条重复 `commit` ⇒ 提示条/警告位/日志首行/按钮条**四处同时**变成"这一局不可信 / 已停手"，再点跟注返回"没发出去：peer flagged the server: …" |
| 凭据自愈 | 换一间全新房间后重连：`errors=["bad_token"]` ⇒ `netplay` 自己补发 join ⇒ `seat=0`、`staleToken=false`、房间侧 `connections=1`（这座归新房间所有） |

**没做成的两件事，以及为什么**（不写成"已做"）：

1. **真鼠标坐标点击**：这个内嵌浏览器面板的窗口是 531×559，画布只拿得到 526×484 < `MIN_VIEWPORT 560×560`，
   `webui/scene.ts` 按 rev=7 的裁定走"窗口太小"提示路径 ⇒ `scene.hits` 为空，没有可点的命中区。
   上面这些动作走的是页面自己的 `send()`（与画布点击同一个函数），坐标数学由 `ui3` 的 `hitAt` 用例与 `nui/01` 在无头侧钉。
   **验收① 的"两个标签页 + ≥720×640 真鼠标"仍归监督方那遍。**
2. **同一浏览器两个标签页同时在线**：这套 browser-use 工具没有"开新页面"的原语，`window.open` 被弹窗拦截。
   机制侧由 `nui/07`（per-tab 两份凭据互不覆盖 + 共享存储的反面对照：第一个标签页被接到第二个的座位上）
   与 `srv/05`/`nui/16`（页面必须 `sessionStorage`、`localStorage` 零出现，变异 E01 被抓）钉住。
3. 截图拿不到：`take_screenshot` 直接报 `visibilityState=hidden`。证据以文本形式留在 `evidence/m5-browser-live.txt`。

另有一段**判读修正**写在证据文件第 8 节：我一度把"页面已连接却零下行"整体归因给缺一条回落，
真凶其实是隐藏页把 `setTimeout` 钳到 ≥1s（我的探针因此超时、读数落在两次事件之间）。
三条修复（静态服务放行面、`hand=0` 非法 resume、`renew()` 丢份额）本身都成立且有独立证据，
但那段因果当时是错的，所以按实测改准写在这里，免得下一轮有人照错的归因去查。

## 10.8 本轮变更文件（相对 rev=9）

新增：`webui/netplay.ts`、`test/netx-netplay.test.ts`、`test/netx-serve.test.ts`、`evidence/m5-browser-live.txt`。
改动：`src/engine/state.ts`（抽 `priceOf`、`actionCost` 委托）、`netx/client.ts`（`resume()` 的 `hand<1` 闸 + `renew()`）、
`netx/room.ts`（`dealerAmong` 两条路共用 + 缺席剔除时挪庄家并广播一句）、`netx/ws.ts`（`onHttpRequest` 钩子）、
`netx/serve.ts`（组合根：`startRoom`、默认端口、`quit` 收尾）、`webmin/serve.ts`（`serveStatic` 可复用 + netx 四个文件的放行名单）、
`webui/main.ts`（模式开关、真 WebSocket、`sessionStorage` 端口、安全随机、纯管道 + 重连退避）、`webui/index.html`（模式/房间/名字控件 + 两模式各藏一半守住竖向预算）、
`webui/scene.ts`（`remote` 那一家印 `[玩家]`）、`webmin/model.ts`（`logLineOf`/`reasonLabel` 共用文案面）、
`test/netx-static.test.ts`（`nst/01`/`04`/`09` 改写，新增 `nst/10`/`nst/11`）、`test/netx-room.test.ts`（`room/27`–`room/29`）、
`test/netx-client.test.ts`（`client/12`–`client/16`）、`test/netx-seed.test.ts`、`test/netx-protocol.test.ts`、`test/netx-frames.test.ts`、
`test/netx-ws.test.ts`、`test/webui.test.ts`、`test/run.ts`（§0.5 噪声过滤）、`QUESTIONS.md`（Q6）、`BRIEF.md`/`ANSWERS.md`/`REVIEW.md` 为监督方文件。


---

# 9 · rev=9 定点返修（REVIEW.md 的五必修 + 五应修 + 覆盖补缺；工单 §4 "M4 联机"）

## 9.1 五条必修：改在哪、凭什么、配了什么钉

| 必修 | 落地位置与改法 | 新用例 | 新变异 |
|---|---|---|---|
| **1** 客户端承诺存储可覆写 | `netx/client.ts` 的 `case 'commit'`：**每 (hand, party) 写一次**。同值重发放过（断线 catchup 会补发承诺，`room/17`、`ws/04` 依赖它）；异值 ⇒ `violate('server re-committed a different value for party … in hand …')` 且**不覆写**，手里留的还是第一份承诺。非 server 的 party 那条违规判定提前到写存储之前 | `client/12`（把你 S1a 的场景搬进正式用例：改口当场识破 ⇒ `violations=1`、存储未被覆写、随后那份"自洽揭示"再被 `does not open its commitment` 拦住、`verifiedHand=null`、`act()` 停手）；`client/13`（S1b 对照组：不改口只换份额 ⇒ 承诺门独立就抓住 ⇒ 洞确实在存储不在核对）；`client/13b`（同值重发连发三条不报 + 换局重新开账 + 换局后再改口照样报）；`client/14`（别人的承诺仍算越界且不进存储） | **C13** 摘掉写一次门 ⇒ 抓；**C14** 同值也判违规（误伤 catchup）⇒ 抓（`client/13b` + `leak/01-04` + `room/06`）；**C15** 发现改口但不记违规 ⇒ 抓 |
| **2** `room.ts:287-288` 是死代码 | 删。`netx/room.ts` 的 `onNonceDeadline` 尾部现在只剩"就地发牌"，并把**为什么恒真**写成注释留在原地（`expected` 就是刚重建出来的那批已交份额的 party）。没有换成 `throw`：那同样是够不到的分支 | `room/10`（到点发牌之后 `missing` 必须清空 ⇒ 把"重建 expected"这一步钉住）、`room/25④`（同一件事的第二处：`missing=[]` 且待发定时器只剩 1 只，**没有重武装**）、`room/18`（每一阶段待发定时器恒为 1） | **R18** 不重建 `expected` ⇒ 抓（`room/10`+`room/25`）；**R19** 份额齐了直接发牌时忘记 `drop` ⇒ 抓（`room/18`）；**R19b** 到点那条路径忘记 `drop` ⇒ **存活（等价）**：那只表已经自己触发并从表上摘掉了，`drop` 是 no-op，理由见 9.7 表下注 |
| **3** HTTP 状态码不符 RFC 6455 | `netx/ws.ts`：版本字段**缺失** ⇒ 400（§4.2.2 第 3 步，它是必需字段）；版本在但不支持 ⇒ `426 Upgrade Required` + `Sec-WebSocket-Version: 13`（第 4 步，MUST）。`425 Too Early` 全面清除 | `ws/03` 的断言从"被拒"收紧到状态行逐字 = `HTTP/1.1 426 Upgrade Required` 且响应头含 `Sec-WebSocket-Version: 13`，并反向断言输出里没有 `425`；`ws/05`（新）九条非法握手按**谁答的**分档 | **X18** 改回 425 ⇒ 抓；**X19** 426 但不带版本头 ⇒ 抓；**X20** 缺版本也走 426 ⇒ 抓 |
| **4** 同一文件两套排序键 | `netx/seed.ts`：新增 `byCodepoint` 并作为**唯一**排序键，`seedVector` 与 `canonicalShares` 共用。顺手挖出同族更深的一处：`canonicalShares` 原先排的是 `party=value` **拼接串**，而两个名字互为前缀时（`seat:1` / `seat:10`）'='(61) > '0'(48) ⇒ 与"按 party 排"分叉 ⇒ 改成排 Share 对象的 `party` | `seed/13`（大小写混进的集合：向量顺序 = 硬写死的码点序、locale 序必须与它**不同**、权威路径按手拼的 canonical 文本重算种子）；`seed/14`（前缀相撞的 `seat:1`/`seat:10`：两条路径必须同序，并给出"两种排法确实给出两颗种子"的前提断言）；`seed/11` 的固定向量**一字未改**仍然命中 ⇒ 生产 party 集合的定序没被动过 | **S13** 向量改回 localeCompare ⇒ 抓；**S14** 权威路径改 localeCompare ⇒ 抓；**S15** 权威路径完全不排序 ⇒ 抓（`seed/02`+`seed/11`+`seed/13`+`seed/14`） |
| **5** Q4 裁定 = B 托管语义 | `src/engine/actions.ts`：抽出 `doFold`/`doCall` 两个出口，`case 'timeout'` ⇒ 付得起就 `doCall`（note 前缀 `timeout→call `），付不起才 `doFold('timeout→fold')`；仍是引擎既有的那一条 `timeout` 注入通道，房间层没有改成代发 `call`（可归因性保住）。`src/engine/validate.ts` 里 rev=1 那条注释改成实际语义 | `engine-timeout.test.ts`（新文件）：`timeout/01` 全员托管必走完且终局 `stall`（9 次托管留痕、钱守恒）／`02` 付不起 ⇒ 弃牌、不欠款、无负筹码，且与自主弃牌只差 note／`03` 明跟 2×、闷跟 1× 各自正确／`04` 全程无 `look`/`raise`/`compare` 事件且没人被代看牌／`05` 仍是普通行动（越界照拒、`awaitingSettle` 不许再托管）／`06` 自主跟注的 note 里不许出现 timeout。既有断言同步：`illegal/13` 重写、`room/07`（六次 `timeout→call`、零弃牌、终局 stall）、`room/10`/`room/18`/`room/20`/`ws/04` | **T01** 映射改回一律弃牌；**T02** 跟注 note 去掉 timeout 字样；**T03** 弃牌 note 去掉字样；**T04** 明/闷标记写反；**T05** 付不起也硬跟；**T06** 跟注不记账（拖延终止永不触发）；**M01** `doCall` 的 note 前缀整体剥掉 ⇒ 七条全部被抓 |

## 9.2 五条应修

| 应修 | 处置 |
|---|---|
| 1 `frames.ts:3` 引错工单编号 | 改成 **Q5**，并写明裁定结果（不扩白名单、零依赖手写） |
| 2 `sha256.ts:5` 指向不存在的测试文件 | 改成 `test/netx-crypto.test.ts` |
| 3 `static.test.ts:98` 注释过期 | 改成"交付文本里 `dependencies` 字段整体缺省 —— Q5 裁定确认缺省 ≡ 空对象"，并说明这条断言对"显式空对象"同样容忍、唯一不合规的判据是键非空 |
| 4 `Clock.now` 无调用点 | **取"去掉"这一支**（你给的两个选项里更彻底的那个）：`Clock = { after }`，`netx/ws.ts` 里唯一的 `Date.now()` 随之删除 ⇒ **整个 `netx/` 不再读真实时间**；夹具的钟面观测改由 `FakeClock.now()`（测试自己的类型成员）提供。为防止它被悄悄塞回来，`nst/08` 加了三条反向断言：room 里没有 `now(): number`、room 里没有 `clock.now(`、**ws 里没有 `\bDate\b`** |
| 5 `room.ts` 连接清单也用 `localeCompare` | 统一为 `byCodepoint`。配 `room/26`：id 里**故意混大小写**（`c1,C2,a10,B3,c10,A2`）⇒ 码点序 `A2,B3,C2,a10,c1,c10` 与 locale 序 `a10,A2,B3,c1,c10,C2` 真的分叉，插入序也分叉 |

## 9.3 你 §5 点名的覆盖缺口：补了什么、什么仍然空着

| 位置 | 处置 |
|---|---|
| `client.ts:47`、`:50`（S9） | **已移植**成 `client/15`：洞 / 错尾 / 错头 / 信封四道闸的报错文本互不相同（`Set.size === 4`）、三条非法增量一条都不合并（`stateHash` 级）、再加一条合法连续增量的正向对照。C12 的"等价"前提由此钉死 |
| `room.ts:564-567`（`ping → pong`） | **已补** `room/21`：三条 ping 各自回显自己的 `echo`（不是写死的常量）、局面 `stateHash` 一字未动、客户端不视 pong 为越界 |
| `room.ts:414-417` / `:455-458` / `:512-519` | **已补** `room/22`（already_joined，且绑座不动）／`room/23`（token_seat_mismatch，并带"自己的 token 重连自己的座"对照）／`room/24`（无牌局的 `not_dealt` 与局号错位的 `bad_hand` 是**两条不同的路**）／`room/25`（份额阶段的 `not_dealt` 与 `no_seat`，用底层房间手搓出"缺一家长在 collect"的窗口） |
| `ws.ts:145-154` / `:165-169` | **部分已补**：`ws/05` 九条非法握手逐条给状态行。**其中"缺 Upgrade""Connection 不含 upgrade"两条在本机 Node 上够不到** —— Node 的 http 根本不给这种请求派发 `upgrade` 事件，请求直接落到普通 HTTP 分支（404）。所以 `ws.ts` 里那两道 guard 是**纵深防御**（前端若换人、或前置代理放宽时才可能走到），本轮把它的位置与"由谁答 400/404/426"一起写进用例注释，不假装测到 |
| `frames.ts:171-173`、`:393` | **已补** `frame/16`（bad_mask 五种长度 + 4 字节合法对照、bad_split 两侧越界 + `0`/`length` 两个合法边界、`encodePong` 往返）、`frame/17`（64 位长度三臂：非最小 ⇒ 报**64 位那一臂**的原文、66000 字节合法帧逐字节解通、声称 0x10000 但数据没到齐 ⇒ 等而不是错） |
| `client.ts:88` | **已补**（`client/15` 的第④道） |
| `client.ts:95-97`（合并后条数 = seq） | **仍空，且按构造够不到**：`msg.since == 本地 seq` + `logShape(起点/连续/尾条)` 已蕴含条数恒等。第一手证据：变异 **C20** 单独摘掉它 ⇒ 362 条全绿（存活）；组合变异 **K01–K04**（把它连同它依赖的前提一起摘）⇒ 仍被别的闸抓住。结论：它是**纯后备**，保留的理由是"未来有人放宽前三道闸时它兜底"，代价是一行恒真判断 |
| `room.ts:168-172` / `:314-321` / `:341-344` | **仍空**，与你 rev=8 认可 R05/R13 的同一论证（自检对象是自己刚算出的值 ⇒ 恒真）。已在 `SELF-REVIEW.md` 9-D 记成"已知未覆盖 + 触发条件"：谁改了 `project()` 的出口形状、`revealMsg()` 的构造，或让 `step()` 绕过 `checkAction`，这三道就会从"等价"变成"真会触发"，届时必须先配断言再动代码 |

## 9.4 命令与退出码

| 命令 | 退出码 | 说明 |
|---|---|---|
| `npm test` | **0** | `RUNNER files=27 cases=362` / `SUMMARY pass=362 fail=0 total=362` / `RESULT=ALL_PASS` |
| `node test/run.ts` 连跑两次 | **0 / 0** | 两次 stdout+stderr 合并流**逐字节相同**（461 行）：`sha256 = 8d172a35494ad77b32057c0ee86522df2df6c2644f9cb2ddb01d15d2dc177a7d`。哈希按 `node test/run.ts` 取而不按 `npm test`：npm 会在末尾追加"有新版可升级"的提示行，那取决于网络状态与 npm 版本，不属于本项目产物（`npm test` 的正文与它逐字节相同，只是前后多几行 banner） |
| `npx tsc --noEmit` | **0** | 零输出 |
| `node .scratch/r9-mutate*.mjs` | 0 | 变异扫描工装（见 9.7）。放在 `.scratch/`：不在 manifest 内、不进 `tsconfig` 的 `include`、不被 `test/run.ts` 发现，因此不影响任何一条判定 |

## 9.5 用例分布：340 → **362**（+22，未删任何既有用例）

| 文件 | rev=8 | rev=9 | 本轮加的钉 |
|---|---|---|---|
| `test/engine-timeout.test.ts` | 0 | **6** | 必修 5 的 (a)–(d) + 可归因性 + validate 共用 |
| `test/netx-client.test.ts` | 11 | **16** | `client/12`、`13`、`13b`、`14`（必修 1）＋ `client/15`（S9 移植 + 信封闸） |
| `test/netx-room.test.ts` | 21 | **27** | `room/21`–`room/26`（ping/pong、already_joined、token_seat_mismatch、行动阶段两道门、份额阶段两道门、连接清单定序） |
| `test/netx-seed.test.ts` | 12 | **14** | `seed/13`（两套键分叉 + 权威路径同键）、`seed/14`（前缀相撞） |
| `test/netx-frames.test.ts` | 15 | **17** | `frame/16`（编码侧自检）、`frame/17`（64 位长度三臂） |
| `test/netx-ws.test.ts` | 4 | **5** | `ws/05`（九条非法握手分档）＋ `ws/03` 断言收紧到 426 |
| 其余 21 个文件 | 277 | 277 | 只有期望值随 Q4=B 同步：`illegal/13` 重写、`room/07`/`room/10`/`room/18`/`room/20`/`ws/04`；`nst/08` 内部断言加严（条数不变） |

## 9.6 完整测试输出（逐字节，`node test/run.ts` 原样）

```
=== ZJH TEST REPORT (deterministic) ===
PASS test/ai-honest.test.ts :: ai/01 牌力先验表 = 22100 手全枚举的事实
PASS test/ai-honest.test.ts :: ai/02 分位表按 classic 写死，但 a23off 下的偏差 < 2pp（所以表可以不分 preset）
PASS test/ai-honest.test.ts :: ai/03 牌力分位单调，且跨档不倒挂（弱档最强手 <= 强档最弱手）
PASS test/ai-honest.test.ts :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）
PASS test/ai-honest.test.ts :: ai/05 看过牌后才按牌力决策：强牌加注、中带跟、烂牌弃
PASS test/ai-honest.test.ts :: ai/06 池赔率真的进了决策：同一副牌，池给得大方就跟、池小就弃
PASS test/ai-honest.test.ts :: ai/07 对手数量真的进了决策：同一副牌同一赔率，人越多越保守
PASS test/ai-honest.test.ts :: ai/08 看牌/保持闷是真决策：最低注级闷着省钱，注级一抬就先转明
PASS test/ai-honest.test.ts :: ai/09 只出合法行动、闷着绝不加注也绝不比牌、比牌必是合法目标（200 组随机合法集合）
PASS test/ai-honest.test.ts :: ai/12 比牌触发率 = 1000 个 seq 上量得出来，且完全由 seq+座位决定（可重放）
PASS test/ai-honest.test.ts :: ai/10 纯函数：同一输入两次调用结果逐字相同（fuzz 与回放的前提）
PASS test/ai-honest.test.ts :: ai/11 先验与 tierOrder 挂钩：把档位排列倒过来，分位表跟着倒
PASS test/ai-honest.test.ts :: ai/13 比牌目标 = 活跃对手中已投入最高者；本局已比过则不再比
PASS test/ai-honest.test.ts :: ai/13b 投入并列时按环形序选目标，而不是按座位号大小（变异 C06 复发哨）
PASS test/ai-honest.test.ts :: ai/14 掷点只由 seq+座位决定：同输入同结果、同 seq 换座位换结果
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/classic 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/a23off 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/档位集合 六档键完全一致且无重复，计数均为非负整数
PASS test/classify.test.ts :: classify/闭式结构 trips 与 pair 与 a23 无关，其余四类随 runs 移动
PASS test/classify.test.ts :: classify/输入顺序无关 455 规范类 × 6 排列判定全同（两 preset）
PASS test/classify.test.ts :: classify/A23 一族 64 手在两 preset 下的迁移符合公式
PASS test/classify.test.ts :: classify/归一化键 顺子高点 A23=3 / 234=4 / QKA=14 且长度为 1
PASS test/classify.test.ts :: classify/归一化键 对子=[对子点, 踢脚]，穷举 3744 手
PASS test/classify.test.ts :: classify/归一化键 豹子 ranks=[r]，穷举 52 手
PASS test/classify.test.ts :: classify/NOTES 打印计数三元组（实际/闭式/锚点）供独立复算
PASS test/compare.test.ts :: compare/01 规范类数量 = C(15,3) = 455
PASS test/compare.test.ts :: compare/02 自反：每类与自身比较 = 0
PASS test/compare.test.ts :: compare/03 反对称：455^2 = 207025 全对，cmp(a,b) = -cmp(b,a)
PASS test/compare.test.ts :: compare/04 传递性穷举：(a>=b && b>=c) ⇒ a>=c，全 455^3 三元组
PASS test/compare.test.ts :: compare/05 花色不参与：全体花色平移 +1 后仍判 0
PASS test/compare.test.ts :: compare/06 与独立整数键参考实现交叉一致（455^2 全对）
PASS test/compare.test.ts :: compare/07 tierOrder 整序反转：跨档对全部翻转、同档对不变
PASS test/compare.test.ts :: compare/08 tierOrder 局部改动即刻生效（把 pair 提到 trips 之上）
PASS test/compare.test.ts :: compare/09 固定种子 1000 手排序后做全对序校验（不只是相邻）
PASS test/compare.test.ts :: compare/10 牌型序链：豹子>同花顺>同花>顺子>对子>单张（15 对全断言）
PASS test/compare.test.ts :: compare/11 tierOrder 缺档时 compare 抛错而不静默
PASS test/compare.test.ts :: compare/12 档位优先于点数：最小同花顺 > 最大普通顺等交叉断言
PASS test/deck.test.ts :: deck/01 makeDeck 长度 52 且逐位满足 index = suit*13 + (rank-2)
PASS test/deck.test.ts :: deck/02 52 张互不相同
PASS test/deck.test.ts :: deck/03 makeDeck 每次返回新数组与新对象（无共享可变状态）
PASS test/deck.test.ts :: deck/04 mulberry32 同 seed 的 1000 项序列完全一致
PASS test/deck.test.ts :: deck/05 不同 seed 的序列不同
PASS test/deck.test.ts :: deck/06 输出恒为非负 uint32 整数（1e6 次采样，覆盖边界 seed）
PASS test/deck.test.ts :: deck/07 seed 非整数抛 TypeError
PASS test/deck.test.ts :: deck/08 shuffle 原地：返回值与入参是同一个数组引用
PASS test/deck.test.ts :: deck/09 shuffle 结果是原牌堆的一个排列
PASS test/deck.test.ts :: deck/10 同 seed 两次洗牌逐位一致，不同 seed 至少一处不同
PASS test/deck.test.ts :: deck/11 52 张牌恰好调用 rng 51 次
PASS test/deck.test.ts :: deck/12 rng 返回浮点/负数/非数一律抛 TypeError
PASS test/deck.test.ts :: deck/13 空牌堆与单元素牌堆不调用 rng、不抛
PASS test/deck.test.ts :: deck/14 发牌烟雾：seed=1 洗完发 6 家，每手都可判定
PASS test/deck.test.ts :: deck/16 洗牌分布公平性：固定种子 20000 轮，52 个落点计数都在容差内
PASS test/deck.test.ts :: deck/17 三张牌穷举 144 种 rng 输出：每张牌的落点计数恰为 48
PASS test/deck.test.ts :: deck/18 NOTES 打印 PRNG 与洗牌的规范向量（供跨端复算）
PASS test/deck.test.ts :: deck/19 与独立誊写的参考 mulberry32 逐位一致（钉住结构与常数）
PASS test/deck.test.ts :: deck/20 rng 恒为 0 时输出等于牌堆左旋一格（钉住从尾往前的遍历方向）
PASS test/edge.test.ts :: edge/01 §3.5 A♠2♦3♣ < 3♠4♦5♣（A23 是最小顺）
PASS test/edge.test.ts :: edge/02 §3.5 A♥2♥3♥ 是同花顺且 > 4♣5♦6♣（档位优先于点数）
PASS test/edge.test.ts :: edge/03 §3.5 2♦2♣2♥ > A♠K♠Q♠（豹子 > 同花顺）
PASS test/edge.test.ts :: edge/04 §3.5 A♦A♣3♠ > K♦K♣A♠（对子点优先，踢脚再大也没用）
PASS test/edge.test.ts :: edge/05 §3.5 同点同级 → 0（花色完全不参与）
PASS test/edge.test.ts :: edge/06 绕 A 不成顺：A♠K♦2♣ 是单张而不是顺子
PASS test/edge.test.ts :: edge/07 最大豹子 > 最小豹子 > 任意同花顺
PASS test/edge.test.ts :: edge/08 a23off 下 A♥2♥3♥ 降为同花、A♠2♦3♣ 降为单张
PASS test/edge.test.ts :: edge/09 A 在非顺子牌型里取 14
PASS test/edge.test.ts :: edge/10 归一化键长度按档固定：豹子/顺 1 位、对子 2 位、同花/单张 3 位
PASS test/edge.test.ts :: edge/11 非法手牌：长度≠3 抛 TypeError
PASS test/edge.test.ts :: edge/12 非法手牌：两张同一牌（同点同花）抛 TypeError
PASS test/edge.test.ts :: edge/13 非法牌面：rank / suit 越界、非整数、NaN 都抛 TypeError
PASS test/edge.test.ts :: edge/14 非法手牌容器：非数组 / 元素非对象 / 缺字段抛 TypeError
PASS test/edge.test.ts :: edge/15 compare 两侧都继承 classify 的非法输入检查
PASS test/edge.test.ts :: edge/16 rules 结构缺失时不静默：缺 handEval 抛 TypeError
PASS test/edge.test.ts :: edge/17 单张的型内比较只看归一化后的三点
PASS test/engine-core.test.ts :: core/01 startHand 不变量：底注入池、每人扣 ante、游标在庄家下家、计数归零
PASS test/engine-core.test.ts :: core/02 发牌互不重叠且都来自标准 52 张
PASS test/engine-core.test.ts :: core/03 发牌顺序 = 独立复算的洗牌结果（庄家下家起连续取牌）
PASS test/engine-core.test.ts :: core/04 庄家必须在座位表里
PASS test/engine-core.test.ts :: core/05 配置非法一律抛 TypeError（人数越界 / 重复座位 / 付不起底注 / seed 非整数）
PASS test/engine-core.test.ts :: core/06 apply 是纯函数：对旧状态深冻结后再推进行动，不抛（说明没有原地写）
PASS test/engine-core.test.ts :: core/07 stateHash 对状态变化敏感、对重放稳定
PASS test/engine-core.test.ts :: core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值
PASS test/engine-core.test.ts :: core/09 资金守恒：开局到结算，筹码 + 池恒等于买入总额
PASS test/engine-core.test.ts :: core/10 同一配置重复开局得到同一状态（引擎里没有隐藏全局态）
PASS test/engine-core.test.ts :: core/11 日志单调：seq 逐条 +1，type 全部来自固定集合
PASS test/engine-core.test.ts :: core/12 引擎对 2 人与 6 人都能开局（人数只受 rules.players 约束，不硬编码）
PASS test/engine-core.test.ts :: core/13 终止阈值不多不少：注级 8 上各家满 2 次仍在局里，满 3 次才 stall
PASS test/engine-fuzz.test.ts :: fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码
PASS test/engine-fuzz.test.ts :: fuzz/02 三种终止条件都能被随机行动打到（换策略覆盖 ②③）
PASS test/engine-fuzz.test.ts :: fuzz/03 2–6 人局全部跑通且守恒
PASS test/engine-fuzz.test.ts :: fuzz/04 非法行动注入：一律抛 InvalidActionError，且状态指纹不变
PASS test/engine-fuzz.test.ts :: fuzz/05 回放确定性：同 seed + 同行动序列 ⇒ 同指纹（20 局）
PASS test/engine-fuzz.test.ts :: fuzz/06 结算幂等：settle 前后指纹稳定，且只入账一次
PASS test/engine-illegal.test.ts :: illegal/01 不轮到你 → not_current_turn（三种动作各一例）
PASS test/engine-illegal.test.ts :: illegal/02 座位不存在 → bad_seat
PASS test/engine-illegal.test.ts :: illegal/03 行动对象本身不合法 → unknown_action
PASS test/engine-illegal.test.ts :: illegal/04 首圈禁比：任何人第一次行动之前都不能比牌，全员各一次后立刻放开
PASS test/engine-illegal.test.ts :: illegal/05 比牌目标非法：自己 / 已弃牌 / 不存在的座位
PASS test/engine-illegal.test.ts :: illegal/06 重复看牌被拒；看牌不消耗行动数也不推进游标
PASS test/engine-illegal.test.ts :: illegal/07 注级顶格不能再加注
PASS test/engine-illegal.test.ts :: illegal/08 钱不够 ⇒ 唯一合法行动是弃牌（全押禁用，§1 全押行）
PASS test/engine-illegal.test.ts :: illegal/09 已弃牌的座位不会再被要求行动，硬塞则 seat_not_active
PASS test/engine-illegal.test.ts :: illegal/10 终局后所有下注类行动被拒（phase_not_betting）
PASS test/engine-illegal.test.ts :: illegal/11 结算时机：没终局不能 settle；已结算再 settle 是幂等 no-op
PASS test/engine-illegal.test.ts :: illegal/12 legalActions 与 checkAction 判据完全一致（不轮到你时给出的是当前 turn 的动作集）
PASS test/engine-illegal.test.ts :: illegal/13 timeout 是普通行动：买得起 ≡ 跟注、买不起 ≡ 弃牌，且都过同一道 validate
PASS test/engine-money.test.ts :: money/01 底注：pool = ante × 人数，每人筹码与 committed 各扣/记一份
PASS test/engine-money.test.ts :: money/02 闷跟 = stake×bet.dark，明跟 = stake×bet.seen（三种注级各验）
PASS test/engine-money.test.ts :: money/03 加注：注级翻倍并按新注级付跟价（Q1 读法 B），且全员当前注级行动数清零
PASS test/engine-money.test.ts :: money/04 比牌费 = fee × stake 入池，与闷/明无关（注级 1/2/4 各验一次）
PASS test/engine-money.test.ts :: money/05 不变量：pot 恒等于各家 committed 之和；每步增量恰是 actionCost
PASS test/engine-money.test.ts :: money/06 弃牌不花钱也不退钱：弃牌者的 committed 留在池里（无边池无退款）
PASS test/engine-money.test.ts :: money/07 分池：整除时人人等份；有余数时给"距庄家下家最近"的赢家
PASS test/engine-money.test.ts :: money/08 幂等结算：入账只发生一次，重放 settle 不重复扣/发钱
PASS test/engine-money.test.ts :: money/09 任何时刻都不出现负筹码（全押禁用的直接后果）
PASS test/engine-money.test.ts :: money/10 结算后赢家所得 = 池，且各家 committed 之和 = 结算前 pot
PASS test/engine-project.test.ts :: project/01 谁都没看过牌：本人也是 unknown，他人一律 unknown（§1 看牌行）
PASS test/engine-project.test.ts :: project/02 序列化后仍然搜不到任何他人牌面（整条 view 一起查，含日志）
PASS test/engine-project.test.ts :: project/03 强制开牌后：活跃家全部可见，弃牌/被淘汰者仍然 unknown
PASS test/engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
PASS test/engine-project.test.ts :: project/05 seed 只在结算后才暴露（否则任何客户端都能反算整副牌）
PASS test/engine-project.test.ts :: project/06 公开信息一字不漏：池/注级/游标/计数/闷明/committed 全部同步
PASS test/engine-project.test.ts :: project/07 观战视角（viewer 不在座位表里）看不到任何未开的牌
PASS test/engine-project.test.ts :: project/08 视图是拷贝，改它不会污染引擎状态
PASS test/engine-project.test.ts :: project/09 终局信息公开：赢家集合、份额、余数归属都可投影
PASS test/engine-project.test.ts :: project/10 startHand 之后立刻投影：轮到行动也没看过牌 ⇒ 本人同样无牌可看
PASS test/engine-project.test.ts :: project/11 负向：未看牌时整条 view 序列化后搜不到本人牌面
PASS test/engine-project.test.ts :: project/12 revealed 优先于 looked：本人没看牌，被强制开牌后照样看得见自己的牌
PASS test/engine-scripts.test.ts :: scripts/01 弃至通吃（§1①）：只剩一人即结束，且不开牌
PASS test/engine-scripts.test.ts :: scripts/02 比牌链：连续两次比牌各淘汰一家，输家的牌永不公开
PASS test/engine-scripts.test.ts :: scripts/03 封顶开牌（§1②）：注级 16 且活跃各家再完成 1 次行动 ⇒ 强制开牌
PASS test/engine-scripts.test.ts :: scripts/04 stall 强开（§1③）：同一注级下活跃各家各满 3 次行动；加注会把计数清零重计
PASS test/engine-scripts.test.ts :: scripts/05 平局分池：两家打平 ⇒ 平分池，除不尽的余数给距庄家下家最近者
PASS test/engine-scripts.test.ts :: scripts/06 挑战者输：比牌平局时挑战者出局（§1 比牌行）
PASS test/engine-scripts.test.ts :: scripts/07 剩两家比牌 = 直接开牌定胜负（两家牌都亮）
PASS test/engine-scripts.test.ts :: scripts/08 三条终止路径各自都要能到达（覆盖性，不是只测一条）
PASS test/engine-scripts.test.ts :: scripts/09 每个脚本重放得到同一状态指纹（回放确定性）
PASS test/engine-timeout.test.ts :: timeout/01 (a) 全员托管的一手牌必然走完，且终局原因是 stall
PASS test/engine-timeout.test.ts :: timeout/02 (b) 付不起跟价的那一家回退成弃牌，且不欠款、不出现负筹码
PASS test/engine-timeout.test.ts :: timeout/03 (c) 已看牌者付明注价、未看牌者付闷注价
PASS test/engine-timeout.test.ts :: timeout/04 (d) 托管不产生 look / raise / compare 事件，也不替玩家看牌
PASS test/engine-timeout.test.ts :: timeout/05 托管仍是普通行动：同一道 validate，越界照样被拒
PASS test/engine-timeout.test.ts :: timeout/06 可归因性：玩家自主跟注的 note 里不许出现 timeout
PASS test/m2-fuzz.test.ts :: m2/01 随机合法行动 1000 局：守恒 / 无负筹码 / 无重复结算 / 有限步终止
PASS test/m2-fuzz.test.ts :: m2/02 诚实 AI 1000 局：只出合法行动、闷着不加注、决策数非零且必然终止
PASS test/m2-fuzz.test.ts :: m2/03 AI 臂与随机臂都打到全部三类终止条件（覆盖不是单边运气）
PASS test/m2-fuzz.test.ts :: m2/04 四类非法行动必被 validate 拒（不轮到你 / 钱不够 / 比已弃牌者 / 首圈禁比时段比牌）
PASS test/m2-fuzz.test.ts :: m2/05 牌力分位 ≈ 真实胜率，且档内端点随 a23 正确移动（两 preset 全枚举对拍）
PASS test/netx-client.test.ts :: client/01 收到 collect 里"还缺我"就立刻交一份份额，且一局只交一次
PASS test/netx-client.test.ts :: client/02 行动防呆：只有"轮到我且局面干净"才放行
PASS test/netx-client.test.ts :: client/03 服务端越界第一类：消息本身不合法 ⇒ 记录违规并拒绝继续
PASS test/netx-client.test.ts :: client/04 增量对不上号 ⇒ 不合并并记违规
PASS test/netx-client.test.ts :: client/05 快照的日志有洞 = 不可信
PASS test/netx-client.test.ts :: client/06 揭示核对的几类造假都会被当场发现
PASS test/netx-client.test.ts :: client/07 结算之前收到 deal 载荷（种子提前泄露）⇒ 违规并停手
PASS test/netx-client.test.ts :: client/08 error 分两类：漏牌即停手，普通回执不停手
PASS test/netx-client.test.ts :: client/09 重连消息带的是"我看到的 hand/seq"，没凭据时不发
PASS test/netx-client.test.ts :: client/11 揭示"自洽"但不是发牌用的那颗种子 ⇒ 仍然要报
PASS test/netx-client.test.ts :: client/10 旁观者的揭示（本局没参与、也没拿到过承诺）不报违规，也不算核对通过
PASS test/netx-client.test.ts :: client/12 收完份额之后改口重发承诺 ⇒ 当场识破，且那份"自洽揭示"随后也过不了（必修 1 主案）
PASS test/netx-client.test.ts :: client/13 对照组：不改口、只揭示另一个份额 ⇒ 承诺门独立就能抓住（洞在存储，不在核对逻辑）
PASS test/netx-client.test.ts :: client/13b 同值重发承诺要放过（断线补承诺），换局则重新开账
PASS test/netx-client.test.ts :: client/14 别人的承诺混进来仍然算越界（写一次门不改变这一条）
PASS test/netx-client.test.ts :: client/15 logShape 三道闸门报错文本互不相同，合法增量则一条不报（移植复审 S9）
PASS test/netx-crypto.test.ts :: netx/01 SHA-256 命中 FIPS 180-4 公开向量
PASS test/netx-crypto.test.ts :: netx/02 与 node:crypto 逐字节差分（覆盖补齐边界与多字节 UTF-8）
PASS test/netx-crypto.test.ts :: netx/03 雪崩：改一个字符，256 位里至少一半上下变化
PASS test/netx-crypto.test.ts :: netx/04 base64 命中经典向量（长度余数 0/1/2 三条路径都走到）
PASS test/netx-crypto.test.ts :: netx/05 握手 accept 命中 RFC 6455 §1.3 向量，非法 key 抛错
PASS test/netx-crypto.test.ts :: netx/06 十六进制与字节的往返（承诺/份额的编码面）
PASS test/netx-crypto.test.ts :: netx/07 摘要入口对空输入与非空输入给出不同长度一致的输出
PASS test/netx-crypto.test.ts :: netx/08 SHA-1（握手用）与 node:crypto 差分，且命中 RFC 6455 §1.3 向量
PASS test/netx-frames.test.ts :: frame/01 编码的三档长度字段逐字节符合规范
PASS test/netx-frames.test.ts :: frame/02 客户端方向必须掩码，且 XOR 逐字节可复算
PASS test/netx-frames.test.ts :: frame/03 客户端→服务端：掩码帧能解，逐字节喂也要能解
PASS test/netx-frames.test.ts :: frame/04 掩码方向判反：客户端不掩码 / 服务端掩码 都拒
PASS test/netx-frames.test.ts :: frame/05 长度必须最小编码，64 位长度不得越出 32 位
PASS test/netx-frames.test.ts :: frame/06 RSV 位非 0 一律拒（没谈扩展就不许出现）
PASS test/netx-frames.test.ts :: frame/07 控制帧规则：ping/pong 原样交回，close 解析状态码
PASS test/netx-frames.test.ts :: frame/08 非法 close 一律拒（1 字节载荷 / 保留码 / 越界码）
PASS test/netx-frames.test.ts :: frame/09 控制帧不得分片、载荷不得过 125
PASS test/netx-frames.test.ts :: frame/10 文本分片可重组，控制帧插在中间也不丢序
PASS test/netx-frames.test.ts :: frame/11 跨分片的多字节字符不会解坏（UTF-8 状态在帧边界上延续）
PASS test/netx-frames.test.ts :: frame/12 非法帧序与未知操作码一律拒
PASS test/netx-frames.test.ts :: frame/13 巨帧、巨消息与编码侧都有上限
PASS test/netx-frames.test.ts :: frame/14 非法 UTF-8 文本帧拒收
PASS test/netx-frames.test.ts :: frame/15 握手 accept：已知向量 + key 边界
PASS test/netx-frames.test.ts :: frame/16 编码侧的三道参数自检：掩码键长度、分片点、pong 帧
PASS test/netx-frames.test.ts :: frame/17 64 位长度字段：非最小编码要拒、合法长帧要收、高 32 位不许越界
PASS test/netx-leak.test.ts :: leak/01 真实牌面在"亮牌"之前不出现在任何一条下行字节里（三家、跑完整一手）
PASS test/netx-leak.test.ts :: leak/02 种子与各家份额在揭示之前不外泄
PASS test/netx-leak.test.ts :: leak/03 中途加入的旁观者：既不在投影里，也没发现任何越界
PASS test/netx-leak.test.ts :: leak/04 增量重连与全量快照两条路收敛：日志逐条一致、数字一致
PASS test/netx-leak.test.ts :: leak/05 客户端第二道墙：服务端把别人的牌塞进投影 ⇒ 当场发现并拒绝再行动
PASS test/netx-leak.test.ts :: leak/06 上行 nonce 各交一份、互不相同，且承诺里读不出份额
PASS test/netx-protocol.test.ts :: proto/01 双向消息 encode→check 往返保真，且字节稳定
PASS test/netx-protocol.test.ts :: proto/02 未知 key 一律拒（顶层、嵌套 move、嵌套 view、rules 内部）
PASS test/netx-protocol.test.ts :: proto/03 缺 key 与类型不符一律拒
PASS test/netx-protocol.test.ts :: proto/04 数值与长度越界一律拒
PASS test/netx-protocol.test.ts :: proto/05 引擎拒绝码全集与 src/engine/validate.ts 逐字对齐（防契约漂移）
PASS test/netx-protocol.test.ts :: proto/06 服务端实际发出的 net 拒绝码都在声明集合里，且声明集合没有空转项
PASS test/netx-protocol.test.ts :: proto/07 checkViewLeak 拦住五种越界投影，放过两种合法情形
PASS test/netx-protocol.test.ts :: proto/08 已看牌但未亮牌的"别人"仍然算泄漏（rev=4 口径在网络层同样生效）
PASS test/netx-protocol.test.ts :: proto/09 toAction 只能用绑定的座位，compare 才带 target
PASS test/netx-protocol.test.ts :: proto/10 校验错误信息带路径，便于线上定位
PASS test/netx-protocol.test.ts :: proto/11 巨帧保护：超过上限的字符串直接拒
PASS test/netx-protocol.test.ts :: proto/12 出口编码也过同一套校验：服务端构造出非法消息时本地就炸，不发到线上
PASS test/netx-room.test.ts :: room/01 两家入座即开局：hello→承诺→份额→发牌，第三条连接中途加入不参与本局
PASS test/netx-room.test.ts :: room/02 承诺先于任何份额被接受（线上顺序可查，且承诺不是份额本身）
PASS test/netx-room.test.ts :: room/03 没凑齐份额就不发牌；凑齐的那一刻发牌，且发牌后种子仍不外泄
PASS test/netx-room.test.ts :: room/04 发牌之后再交份额一律被拒，且局面一字不动
PASS test/netx-room.test.ts :: room/04b 收份额阶段：错局号与"不在这局里"的家都被拒
PASS test/netx-room.test.ts :: room/05 座位由连接绑定：上行里没有 seat 字段，越界与伪造一律无副作用
PASS test/netx-room.test.ts :: room/06 完整一手：行动、结算、揭示核对，客户端零违规、总筹码守恒
PASS test/netx-room.test.ts :: room/07 全程没人动手：超时托管把一手牌走到结算，且走的是"自动跟注"这条臂
PASS test/netx-room.test.ts :: room/08 断线重连·seq 对得上 ⇒ 只补增量，补齐后三家视图与日志逐条一致
PASS test/netx-room.test.ts :: room/09 断线跨了一局再回来 ⇒ 拿的是新一局的快照，且本局种子对它合法可见
PASS test/netx-room.test.ts :: room/10 掉线者不交份额 ⇒ 到点改成两人局，牌局照常走完
PASS test/netx-room.test.ts :: room/11 多局连续：轮庄、筹码结转、每一局的揭示都对得上
PASS test/netx-room.test.ts :: room/12 桌上凑不齐两家就收桌：破产者下一局不再入池，筹码一颗不少
PASS test/netx-room.test.ts :: room/13 重连凭据的保护：乱 token 不绑座，真 token 回原位并顶掉旧连接
PASS test/netx-room.test.ts :: room/14 承诺与揭示双向绑定：打得开、合得出、换一家就对不上
PASS test/netx-room.test.ts :: room/15 房间层的门槛：最小买入与满座都不占座
PASS test/netx-room.test.ts :: room/16 driveToSettle 走的一手牌必然在有限步内终止（引擎不变量在联机层同样成立）
PASS test/netx-room.test.ts :: room/17 结算之后才回来的那一家，承诺+快照+揭示一起补回（审计材料不因断线丢失）
PASS test/netx-room.test.ts :: room/20 阶段门在房间层：awaitingSettle 之后的行动被房间挡下（不是丢给引擎）
PASS test/netx-room.test.ts :: room/19 没绑上座位的连接：任何游戏消息都只会拿到 no_seat，不会碰到局面
PASS test/netx-room.test.ts :: room/18 定时器不泄漏：发牌后 nonce 表必须取消，结算后只剩局间那一只
PASS test/netx-room.test.ts :: room/21 应用层 ping→pong 端到端（rev=8 里这条路径零覆盖）
PASS test/netx-room.test.ts :: room/22 已经绑上座位的连接再 join ⇒ already_joined，座位绑定不动
PASS test/netx-room.test.ts :: room/23 拿别人座位的 token 在已绑座的连接上重连 ⇒ token_seat_mismatch
PASS test/netx-room.test.ts :: room/24 行动阶段的两道门：没有牌局 ⇒ not_dealt，局号错位 ⇒ bad_hand
PASS test/netx-room.test.ts :: room/25 份额阶段的两道门：没有牌局 ⇒ not_dealt，不在本局名单里的 party ⇒ no_seat
PASS test/netx-room.test.ts :: room/26 诊断面的连接清单按码点序给出（与份额定序同一把尺，rev=8 应修 5）
PASS test/netx-seed.test.ts :: seed/01 承诺把 hand / party / 份额三者绑在一起
PASS test/netx-seed.test.ts :: seed/02 合成与提交顺序无关（任何一端都能独立复算）
PASS test/netx-seed.test.ts :: seed/03 改任何一家的份额，种子必变（没有旁观者）
PASS test/netx-seed.test.ts :: seed/04 没有任何一家能决定种子：固定其余各家，逐家扫描 32 个候选
PASS test/netx-seed.test.ts :: seed/05 局号参与合成：同一批份额在不同局给出不同种子
PASS test/netx-seed.test.ts :: seed/06 合成结果是引擎接受的 uint32 整数
PASS test/netx-seed.test.ts :: seed/07 非法份额输入一律抛错（含能造成拼接歧义的字符）
PASS test/netx-seed.test.ts :: seed/08 揭示核对：一一对上才算通过
PASS test/netx-seed.test.ts :: seed/09 承诺文本是单射的：改一个字符就换摘要（雪崩在这里体现为不可伪造）
PASS test/netx-seed.test.ts :: seed/10 座位方命名在 party charset 内，且与"server"不撞
PASS test/netx-seed.test.ts :: seed/12 合成用的是完整 32 位（截断成 16 位会被这条抓到）
PASS test/netx-seed.test.ts :: seed/13 定序只用码点键：seedVector 与 canonicalShares 是同一把尺（rev=8 必修 4）
PASS test/netx-seed.test.ts :: seed/14 互为前缀的 party 名（seat:1 与 seat:10）：定序排的是 party，不是拼接串
PASS test/netx-seed.test.ts :: seed/11 固定向量：复审可照抄复算
PASS test/netx-static.test.ts :: nst/01 扫描范围覆盖 netx 下全部源文件
PASS test/netx-static.test.ts :: nst/02 零第三方依赖：netx 里每个 import 都是相对路径或 node: 内置
PASS test/netx-static.test.ts :: nst/03 协议核心里没有时钟、随机与 IO（引擎的确定性口径延续到联机层）
PASS test/netx-static.test.ts :: nst/04 分层：src/ 与 webui/、webmin/（连子目录一起扫）都不反向依赖 netx/
PASS test/netx-static.test.ts :: nst/05 tsconfig 的 include 覆盖 netx，且沿用同一条可擦除语法约束
PASS test/netx-static.test.ts :: nst/06 netx 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）
PASS test/netx-static.test.ts :: nst/07 M4 之后依赖面仍然没扩：dependencies 空、devDependencies 仍在白名单内
PASS test/netx-static.test.ts :: nst/08 房间层的时钟与随机全部来自注入（RoomOptions 是唯一的入口）
PASS test/netx-static.test.ts :: nst/09 M4 的测试文件自己也不许用时钟与随机（否则双跑必然不一致）
PASS test/netx-ws.test.ts :: ws/01 三个独立 WebSocket 客户端打进来，跑完整一手并各自核对揭示
PASS test/netx-ws.test.ts :: ws/02 /health 可读；普通 HTTP 请求不会误入升级分支
PASS test/netx-ws.test.ts :: ws/03 握手与帧的严格性在真 socket 上生效：合法 101、旧版本 426、未掩码被 1002 关掉
PASS test/netx-ws.test.ts :: ws/05 非法握手的每一条都被拒，且拒绝不在房间里留下连接
PASS test/netx-ws.test.ts :: ws/04 真 socket 断线：牌局在托管下走完，凭 token 重连后拿到完整局面并核对揭示
PASS test/rules.test.ts :: rules/01 presets.classic 幂等通过 validateRules
PASS test/rules.test.ts :: rules/02 presets.a23off 幂等通过 validateRules
PASS test/rules.test.ts :: rules/03 两个 preset 仅在 handEval.a23 上不同
PASS test/rules.test.ts :: rules/04 classic 的每个数值逐项等于工单 §1 表格
PASS test/rules.test.ts :: rules/05 未知顶层 key special235=true 抛 TypeError
PASS test/rules.test.ts :: rules/06 未知 key 即使值为 false 也抛（不在 v1 schema）
PASS test/rules.test.ts :: rules/07 未知嵌套 key 抛（handEval / bet 内）
PASS test/rules.test.ts :: rules/08 缺 key 抛（顶层与嵌套各一例）
PASS test/rules.test.ts :: rules/09 值类型错抛（字符串数字 / null / 非布尔）
PASS test/rules.test.ts :: rules/10 version 必须是字面量 1
PASS test/rules.test.ts :: rules/11 字面量域的非法值抛（allIn / compare.tie / showdown.*）
PASS test/rules.test.ts :: rules/12 tierOrder 必须是 6 档无重复排列
PASS test/rules.test.ts :: rules/13 非对象输入一律抛
PASS test/rules.test.ts :: rules/14 validateRules 返回值深冻结（顶层/嵌套/数组都改不动）
PASS test/rules.test.ts :: rules/15 validateRules 返回深拷贝，输入事后被改不影响副本
PASS test/rules.test.ts :: rules/16 presets 本身深冻结
PASS test/rules.test.ts :: rules/17 错误消息点名违规所在路径与 key
PASS test/rules.test.ts :: rules/18 dealer.next 三档各自合法，且 preset 默认 = rotate
PASS test/rules.test.ts :: rules/19 dealer 的非法形态一律抛（枚举外值 / 缺字段 / 多余 key / 非对象 / 大小写）
PASS test/static.test.ts :: static/00 扫描范围覆盖 cards / rules / engine / ai 全部源文件
PASS test/static.test.ts :: static/01 src 里不出现时钟与随机全局态
PASS test/static.test.ts :: static/02 src 里不出现文件、网络与控制台 IO
PASS test/static.test.ts :: static/03 src 不引用任何运行时全局可变对象
PASS test/static.test.ts :: static/04 import 只允许相对路径；M0 两文件只允许 import type ./rules.ts
PASS test/static.test.ts :: static/05 src 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）
PASS test/static.test.ts :: static/06 零运行时依赖：dependencies 必须为空（或整体不存在）
PASS test/static.test.ts :: static/07 devDependencies 落在工单白名单内
PASS test/static.test.ts :: static/08 npm test 是单命令，且不依赖任何已安装依赖
PASS test/static.test.ts :: static/09 tsconfig 打开 strict 与 erasableSyntaxOnly
PASS test/static.test.ts :: static/10 输出生产者 test/run.ts 不引用时钟（保证两次运行一致）
PASS test/static.test.ts :: static/11 测试目录可被 runner 发现且无空目录
PASS test/static.test.ts :: static/12 M0 冻结接口：cards/rules 的导出名恰好是 §2.7 契约（不夹带私有实现的导出）
PASS test/static.test.ts :: static/13 src/ai 只用投影信息：越界引用与运行时依赖一律为 0 命中
PASS test/webmin-dealer.test.ts :: dealer/01 rotate：庄家的下家接任（手推座位号）
PASS test/webmin-dealer.test.ts :: dealer/02 winner：单赢家通吃即该赢家坐庄
PASS test/webmin-dealer.test.ts :: dealer/03 winner：平局分池先给拿到余数的那位，无余数才按环形最近
PASS test/webmin-dealer.test.ts :: dealer/04 loser：非赢家中距庄家下家最近者；其离桌则环形顺延到下一家输家
PASS test/webmin-dealer.test.ts :: dealer/05 loser 档无在桌输家时退回轮庄（Q2 已裁定 A）
PASS test/webmin-dealer.test.ts :: dealer/06 三档都没有可留的座位时返回 null（调用方该收桌）
PASS test/webmin-dealer.test.ts :: dealer/07 createSession：三档都合法、默认 rotate、非法值抛 TypeError
PASS test/webmin-dealer.test.ts :: dealer/08 会话层：winner 档 ⇒ 每局庄家 = 上一局赢家
PASS test/webmin-dealer.test.ts :: dealer/09 会话层：loser 档 ⇒ 庄家来自上一局非赢家（除非无在桌输家）
PASS test/webmin-dealer.test.ts :: dealer/10 会话层：rotate 档仍是老行为（庄位逐局换人），且三档结果互不相同
PASS test/webmin-dealer.test.ts :: dealer/11 选庄不改钱：三档各自跨局守恒
PASS test/webmin-model.test.ts :: ui/01 createSession 建立座位、首局与台账
PASS test/webmin-model.test.ts :: ui/02 非法开局参数一律抛 TypeError
PASS test/webmin-model.test.ts :: ui/03 deriveSeed 确定、逐局不同、不用时钟
PASS test/webmin-model.test.ts :: ui/04 没轮到真人时点按钮 → 拒绝且状态指纹不变
PASS test/webmin-model.test.ts :: ui/05 真人+机器人打完一整局：走到结算，台账守恒
PASS test/webmin-model.test.ts :: ui/06 真人发起合法比牌恰好淘汰一家；期间确证首圈禁比挡过
PASS test/webmin-model.test.ts :: ui/07 乱点不崩：非法意图 ok:false 且指纹不变；整桌重来永远可点
PASS test/webmin-model.test.ts :: ui/08 再来一局：局号 +1、庄家轮转到下家、总额守恒
PASS test/webmin-model.test.ts :: ui/09 连打 12 局：每局有限步结束、总额恒定
PASS test/webmin-model.test.ts :: ui/10 机器人走 AI：只出合法意图、闷着不加注不比牌、注级抬高先转明
PASS test/webmin-model.test.ts :: ui/10b 机器人走 AI：强牌加注 / 同一副牌随赔率翻转 / 闷着遇高注级先转明
PASS test/webmin-model.test.ts :: ui/10c 未看牌的机器人决策与手牌无关（同一局面只换牌）
PASS test/webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
PASS test/webmin-model.test.ts :: ui/11b 整桌重来要请回破产离桌的人，并保留庄家规则档位（M2 实测抓到的两个缺陷）
PASS test/webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
PASS test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
PASS test/webmin-model.test.ts :: ui/14 分层边界：model 不碰 DOM/时钟/随机，app 不碰 node 内置也不自己判规则
PASS test/webmin-model.test.ts :: ui/15 页面接线：html 与各模块 import 路径都能被服务放行
PASS test/webmin-model.test.ts :: ui/16 一整局的可见性推进：局中暗牌、终局按规则亮
PASS test/webmin-model.test.ts :: ui/17 页面显示的牌型名与 classify 判定一致（且以看过牌为前提）
PASS test/webmin-model.test.ts :: ui/18 未看牌时 view() 全树序列化与座位行都搜不到真人牌面
PASS test/webmin-model.test.ts :: ui/19 结算信息一条不丢：每家的账就地进座位板，结算块只留原因与指纹（rev=7 ④的前提）
PASS test/webmin-model.test.ts :: ui/20 亮牌文本行：ASCII 记法逐张对得上，且只列真亮出来的牌（验收④给机器的读法）
PASS test/webui.test.ts :: ui3/01 层次：webui 只 import 彼此与 webmin/model，绝不直接碰引擎或 src
PASS test/webui.test.ts :: ui3/02 层次：只有入口层能碰 DOM；UI 侧一行规则判定都没有
PASS test/webui.test.ts :: ui3/03 bridge：开桌后快照结构化，未看牌 ⇒ 每一行都是隐藏位
PASS test/webui.test.ts :: ui3/04 bridge：三档庄家规则都开得出桌并回显在快照里
PASS test/webui.test.ts :: ui3/04b 页面接线：开桌控件与 StartOptions 一一对应，庄家三档不许在 M3 这一版丢掉
PASS test/webui.test.ts :: ui3/05 bridge：非法意图走引擎拒绝路径，计数与状态指纹都对
PASS test/webui.test.ts :: ui3/06 bridge：真人点看牌 ⇒ 只有自己那行亮牌，且快照里搜不到任何别家牌面
PASS test/webui.test.ts :: ui3/07 bridge：把一局打完 ⇒ 结算区有内容、日志在长、桌上总额守恒
PASS test/webui.test.ts :: ui3/08 scene 是纯函数：同一输入两次布局逐字节相同
PASS test/webui.test.ts :: ui3/09 scene 布局不变量：命中区与按钮一一对应、互不重叠、都在画布内（三种视口）
PASS test/webui.test.ts :: ui3/09b 低于最小视口时不做布局、只画提示，且不留下任何可点区（不装作能玩）
PASS test/webui.test.ts :: ui3/09c 竖向预算先给牌桌：候选 10 个时按钮条至多 3 行，座位板照旧不挤不越界（变异 U05 复发哨）
PASS test/webui.test.ts :: ui3/10 scene 命中测试：中心与四条边角都算命中，边界外 1px 不命中
PASS test/webui.test.ts :: ui3/11 scene 不泄露未看过的牌：开局整棵图元树里没有任何牌面字符
PASS test/webui.test.ts :: ui3/11b 看牌前后：整棵图元树从 0 张牌面变成正好 3 张（且就是本人那手）
PASS test/webui.test.ts :: ui3/12 paint 只执行图元：假 ctx 下调用次数与图元数一一对应
PASS test/webui.test.ts :: ui3/13 静态服务放行 webui（不装 vite 也跑得起），根路径仍指向 M1.5
PASS test/webui.test.ts :: ui3/14b 没轮到真人时"整桌重来"仍报合法（U01 复发哨：灰按钮不许谎报会被拒）
PASS test/webui.test.ts :: ui3/15 翻牌动画：进度过半之前一张牌面都不许出现，之后才亮
PASS test/webui.test.ts :: ui3/16 动画进度是纯入参：同一 (快照, anim) 两次布局逐字节相同；不给 anim 时直接终态
PASS test/webui.test.ts :: ui3/17 没配 since 的座位视为已翻开；换局后重新亮牌的座位会重新起算
PASS test/webui.test.ts :: ui3/14 灰按钮点了必被引擎拒（验收③在 M3 侧的等价形态）
PASS test/webui.test.ts :: ui3/18 牌面放大：每张亮牌 ≥48×64、点数 ≥18px，本人手牌再大一档（工单 rev=7 ①）
PASS test/webui.test.ts :: ui3/19 2–6 家都排得开：座位板数量对得上、互不重叠、不越界、不压按钮（工单 rev=7 ②）
PASS test/webui.test.ts :: ui3/19b 极端候选数下只许二选一：要么明说装不下，要么座位板/按钮/底部条互不重叠（不许硬排）
PASS test/webui.test.ts :: ui3/20 结算块不许盖住任何一张亮出来的牌（牌刚亮完就被盖住 = rev=7 要修的老毛病）
PASS test/webui.test.ts :: ui3/21 顶栏不许被牌桌盖住：状态行是整句，被木轨吃掉就等于丢信息（rev=7 实测缺陷复发哨）
PASS test/webui.test.ts :: ui3/22 按钮文案一个字都不许丢：折行只改行数，且每行都得待在自己那颗按钮里
PASS test/webui.test.ts :: ui3/23 牌角不许爬到邻牌脸上：每个点数/花色图元必须待在"自己那张牌露出来的那一条"里
PASS test/webui.test.ts :: ui3/24 桌面中央的"亮牌"文本行：每张亮牌都在里面、字号够读、且不压任何座位板

=== NOTES (fixed vectors, recompute-able independently) ===
AI-CALIB max|est-true|=0.3pp over 24 anchors
AI02 tier-percentile max diff=0.27pp
AI09 compare=1/200 组（其中有资格比牌的才 9 组）
AI12 trigger=14.6% over 1000 seqs
CANONICAL mulberry32 seed=1 float_first=0.6270739405881613
CMP 2S 2D 9C vs 3S 4D 5C = -1
CMP 2S 3D 4C vs AS KS QS = -1
CMP 4S 9S JS vs AS 2S 3S = -1
CMP 9S 9D 2C vs 9C 9S 2D = 0
CMP AS 2S 3S vs QD KC JS = 1
DEAL seat=0 hand=T♠2♠J♠ tier=flush ranks=[11,10,2]
DEAL seat=1 hand=5♠9♣J♥ tier=highCard ranks=[11,9,5]
DEAL seat=2 hand=3♠6♦A♦ tier=highCard ranks=[14,6,3]
DEAL seat=3 hand=6♠K♥7♣ tier=highCard ranks=[13,7,6]
DEAL seat=4 hand=2♥7♠T♣ tier=highCard ranks=[10,7,2]
DEAL seat=5 hand=Q♥J♣7♦ tier=highCard ranks=[12,11,7]
DEALER08 winner 0>2=>2 2>0=>0 0>1=>1 1>0=>0 0>0=>0 0>3=>3
DEALER09 loser hands=6 fallback=0
DEALER10 rotate=0,1,2,3,0 winner=0,2,0,1,0 loser=0,1,3,1,2
ENUM a23off actual   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off anchor   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off closed   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM classic actual   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic anchor   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic closed   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
FUZZ-ILLEGAL probes=3645 rejected=3247
FUZZ-ILLEGAL4 probes=15589 not_current_turn=5592 cannot_afford=2796 bad_target=2921 compare_forbidden_before_first_actions=2672
FUZZ-MODE reasons=oneLeft,stakeCap,stall
FUZZ-ai hands=1000 maxSteps=17 decisions=9262 look=1231 compare=117 有比牌的局=113 reasons=oneLeft=300 stakeCap=42 stall=658
FUZZ-random hands=1000 maxSteps=22 decisions=0 look=0 compare=0 有比牌的局=0（decisions/look/compare 只统计 decideAi 的决策，随机臂不经过 AI ⇒ 恒为 0，不是"随机臂不打比牌"） reasons=oneLeft=755 stakeCap=233 stall=12
FUZZ200 maxSteps=19 reasons=oneLeft=169 stakeCap=27 stall=4
HASH seed11-3calls=c654f607d89ce8c9
REPLAY cap seed=1 hash=03adaa7bef0f0d99
REPLAY cap seed=2 hash=2d3f6f85ce3ae82f
REPLAY cap seed=5 hash=0966c43c35d04a96
REPLAY foldout seed=1 hash=f6ebdc809abcb74a
REPLAY foldout seed=2 hash=aceb2772ab74efc0
REPLAY foldout seed=5 hash=096e62b78da9c34d
REPLAY stall seed=1 hash=1730bb61755d018f
REPLAY stall seed=2 hash=80606e936d104725
REPLAY stall seed=5 hash=286b96c25face2b4
SCRIPT02 seed=1 loser1=2 loser2=0
SCRIPT05 seed=1061 pot=13 shares=7,6
SCRIPT06 seed=622 tie hands: 1=[{"rank":8,"suit":1},{"rank":14,"suit":0},{"rank":7,"suit":3}] 2=[{"rank":7,"suit":1},{"rank":8,"suit":2},{"rank":14,"suit":3}]
SEED base=20260925 h1=3776361071 h2=1243603819
SETTLE seed1-stall chips=96,108,96 pot0 total=300
SHUFFLE-FAIR trials=20000 expected=384.61538461538464 min=331 max=431
SORT1000 seed=20260925 ties=2182 first=[{"rank":10,"suit":3},{"rank":10,"suit":1},{"rank":10,"suit":0}]
TRANS full_triples=94196375 implied_triples=47201700
UI05 steps=5 结束原因：同一注级下各家各完成 3 次行动 → 强制开牌
UI06 合法比牌达成，且首圈禁比确凿生效过
UI07 rejected=7/7
UI09 hands=12 total=768 over=null
UI10 botSteps=253 raise=10 call=110 fold=43 look=77 compare=13
UI11 收桌于第 3 局：只剩 1 家还付得起底注（最少需要 2 家），牌局结束
UI16 reason=stall
UI19 待结算样本：phase=awaitingSettle 赢家=1
UI20 亮牌：你 8C 3S KS 单张 / 电脑1 5S TC 5H 对子 / 电脑3 QS 3H 7D 单张
UI307 结算行=5 日志行=12 点击=3 被拒=0
VECTOR mulberry32 seed=1 first8=2693262067,11749833,2265367787,4213581821,4159151403,1207330352,2632122864,3095568220
VECTOR mulberry32 seed=2 first8=3153583793,1395857638,1225337227,2310499808,3759333107,2709408573,2144054433,1534354113
VECTOR mulberry32 seed=4294967295 first8=3850105811,813802916,3073704848,4054706436,3630262831,2315588663,2922715533,2042566601
VECTOR shuffle seed=1 first12=TS 2S JS 5S 9C JH 3S 6D AD 6S KH 7C
VECTOR shuffle seed=1 last6=2D 3C QC KC 8D 4H
frame/15 握手向量 = RFC 6455 §1.3（SHA-1 + GUID 258EAFA5-E914-47DA-95CA-C5AB0DC85B11）
frame/17 64 位长度三臂：非最小拒 / 66000 字节合法帧解通 / 0x10000 声明走"等数据"分支
leak/01 按 seed 独立复算三家的牌面，逐条扫描"别人看到且尚未亮牌"的下行（96 次检查）：零命中
leak/02 结算视图前扫描 35 条下行：种子字段/种子数字零命中；揭示前份额明文零命中
leak/04 抖动重连 8 次之后仍与稳定路径逐条收敛
netx/02 SHA-256 与 node:crypto 差分 208 条输入全部一致
netx/08 SHA-1 与 node:crypto 差分 202 条一致；握手向量 = RFC 6455 §1.3
nst/07 依赖面：dependencies={}，devDependencies=@types/node,typescript,vite
nst/09 M4 测试文件 10 份：netx-client.test.ts, netx-crypto.test.ts, netx-fixtures.ts, netx-frames.test.ts, netx-leak.test.ts, netx-protocol.test.ts, netx-room.test.ts, netx-seed.test.ts, netx-static.test.ts, netx-ws.test.ts；时钟例外只给 netx-ws.test.ts（仅看门狗）
proto/01 上行 6 条 / 下行 10 条往返保真且字节稳定
proto/06 net 拒绝码 5 个全部会被真正发出：bad_hand, no_seat, not_dealt, bad_nonce, nonce_late
proto/12 出口编码：6 类非法消息全部在本地被拦（服务端不能只约束客户端）
room/07 全程托管 ⇒ 六次 timeout→call、零弃牌、终局 stall；三家版见 timeout/01
room/11 三局庄家轮转 0→1→2；结束时 0:249 1:256 2:263
room/16 2~6 家全部靠"看牌+跟注"走到强制开牌，无违规、无 fault
room/17 缺席完全局的重连：承诺/快照/揭示三件齐补，种子核对通过
room/18 每一阶段的待发定时器数量恒为 1（nonce/回合/结算表都被正确取消）
room/21 应用层心跳：三条 ping 各自回显，局面一字未动（3 条 pong）
room/26 连接清单 = A2, B3, C2, a10, c1, c10（码点序；locale 序会是 a10, A2, B3, c1, c10, C2）
seed/11 合成 seed=1498111553（份额明文见 netx-seed.test.ts 顶部 SHARES）
seed/11 固定向量 hand=1 shares=[seat:0:49af21ae…, seat:1:4ec39f40…, seat:2:e4aa43f9…, server:12be698b…]
seed/12 4096 组份额合成 4096 个互不相同的种子，最大值 4294600091
seed/13 码点序=A,Seat:10,a,seat:2,server / locale 序=a,A,Seat:10,seat:2,server ⇒ 向量取前者，权威路径同键（seed=3577986836）
seed/14 前缀相撞的 party 名：权威 = 向量 = seat:1,seat:10,seat:2,server（seed=2391714912）
timeout/06 托管与自主跟注只差 note：timeout→call seen/dark×stake vs dark×stake
ws/01 真实 socket + Node 内置 WebSocket 客户端跑完一手牌：11 个 seq，三家各自核对通过
ws/04 断线期间牌局由托管走完；重连后 seq 从 0 追到 9，揭示核对通过
ws/05 9 条非法握手各自被拒（400/404/426 按来源分档），零连接残留

RUNNER files=27 cases=362
SUMMARY pass=362 fail=0 total=362
RESULT=ALL_PASS
```

## 9.7 变异扫描 rev=9：41 条逐条结果

口径说明（把限制写在明面上）：rev=8 那 76 条**没有重跑** —— 工装脚本随 rev=8 交付删除，锚点只以描述形式留在 8.6 表里，逐条重构会把时间花在抄写而不是找洞上。本轮 41 条覆盖的是**被改动触及的每一道门**（引擎 timeout 通道、承诺存储、定序键、握手状态码、Clock 接口、死代码删除处周边的重建/取消动作，以及新用例自己的断言）；未被改动的面（`protocol.ts`、`sha256.ts` 等）由 362 条全绿间接保证，这句话的强度到此为止。

```
| 变异 | 打坏的那一道门 | 结果 | 依据（当次运行里真实的 FAIL 行 / 静态检查） |
| --- | --- | --- | --- |
| T01 | timeout 映射改回"一律弃牌"（Q4=A 复辟） | caught | test/engine-illegal.test.ts→illegal/13；test/engine-timeout.test.ts→timeout/01；test/engine-timeout.test.ts→timeout/03；test/engine-timeout.test.ts→timeout/04；test/engine-timeout.test.ts→timeout/06；test/netx-room.test.ts→room/07 |
| T02 | 托管跟注的 note 里去掉 timeout 字样 | caught | test/engine-illegal.test.ts→illegal/13；test/engine-timeout.test.ts→timeout/01；test/engine-timeout.test.ts→timeout/03；test/engine-timeout.test.ts→timeout/06；test/netx-room.test.ts→room/07；test/netx-ws.test.ts→ws/04 |
| T03 | 托管弃牌的 note 里去掉 timeout 字样 | caught | test/engine-timeout.test.ts→timeout/02 |
| T04 | 明/闷注价的标记写反（价格仍对，日志说谎） | caught | test/engine-illegal.test.ts→illegal/13；test/engine-timeout.test.ts→timeout/03；test/netx-ws.test.ts→ws/04 |
| T05 | 付不起也硬跟（弃牌臂被摘掉） | caught | test/engine-fuzz.test.ts→fuzz/01；test/engine-timeout.test.ts→timeout/02 |
| T06 | 跟注不记账（bump 丢失 ⇒ 拖延终止永远不触发） | caught | test/engine-core.test.ts→core/08；test/engine-core.test.ts→core/09；test/engine-core.test.ts→core/11；test/engine-core.test.ts→core/13；test/engine-fuzz.test.ts→fuzz/02；test/engine-illegal.test.ts→illegal/04 |
| M01 | 跟注 note 的前缀（timeout 字样所在的那一段）被整体剥掉 | caught | test/engine-illegal.test.ts→illegal/13；test/engine-timeout.test.ts→timeout/01；test/engine-timeout.test.ts→timeout/03；test/engine-timeout.test.ts→timeout/06；test/netx-room.test.ts→room/07 |
| C13 | 承诺存储改回可覆写（第二道墙上的洞复辟） | caught | test/netx-client.test.ts→client/12；test/netx-client.test.ts→client/13b |
| C14 | 同值重发也判违规（误伤 catchup 补承诺） | caught | test/netx-client.test.ts→client/13b；test/netx-leak.test.ts→leak/01；test/netx-leak.test.ts→leak/02；test/netx-leak.test.ts→leak/03；test/netx-leak.test.ts→leak/04；test/netx-room.test.ts→room/06 |
| C15 | 改口被发现但不记录违规 | caught | test/netx-client.test.ts→client/12；test/netx-client.test.ts→client/13b |
| C16 | logShape 的"中间有洞"闸门摘掉（C12 等价论证的前提之一） | caught | test/netx-client.test.ts→client/15 |
| C17 | logShape 的"尾条 != 信封 seq"闸门摘掉（C12 等价论证的另一半前提） | caught | test/netx-client.test.ts→client/15 |
| C18 | logShape 的"起点 != since+1"闸门摘掉 | caught | test/netx-client.test.ts→client/04；test/netx-client.test.ts→client/05；test/netx-client.test.ts→client/15 |
| C19 | checkView 的信封对账（view.seq != 信封 seq）摘掉 | caught | test/netx-client.test.ts→client/15 |
| C20 | 合并后"条数 = seq"这条（client.ts:95-97）摘掉 ⇒ 验证它是否真的按构造够不到 | survived | 无 FAIL 行（SUMMARY pass=362 fail=0） |
| K01 | 条数闸门 + 尾条闸门一起摘掉（服务端少给一段日志） | caught | test/netx-client.test.ts→client/15 |
| K02 | 条数闸门 + 信封对账一起摘掉（patch 谎报 seq） | caught | test/netx-client.test.ts→client/15 |
| K03 | 条数闸门 + 起点闸门 + 尾条闸门一起摘掉（整段错位） | caught | test/netx-client.test.ts→client/04；test/netx-client.test.ts→client/05；test/netx-client.test.ts→client/15 |
| K04 | 条数闸门 + logShape 三道全摘掉（只剩条数这道后备） | caught | test/netx-client.test.ts→client/04；test/netx-client.test.ts→client/05；test/netx-client.test.ts→client/15 |
| S13 | seedVector 改回 localeCompare | caught | test/netx-seed.test.ts→seed/13 |
| S14 | 权威路径 canonicalShares 改用 localeCompare | caught | test/netx-seed.test.ts→seed/13 |
| S15 | 权威路径完全不排序（定序由提交先后决定） | caught | test/netx-seed.test.ts→seed/02；test/netx-seed.test.ts→seed/13；test/netx-seed.test.ts→seed/14；test/netx-seed.test.ts→seed/11 |
| S16 | 房间诊断面的连接清单改回 localeCompare | caught | test/netx-room.test.ts→room/26 |
| R18 | 剔掉缺席者之后不重建 expected | caught | test/netx-room.test.ts→room/10；test/netx-room.test.ts→room/25 |
| R19 | 份额齐了直接发牌时忘记 drop 未触发的 nonce 表（定时器泄漏） | caught | test/netx-room.test.ts→room/18 |
| R19b | 到点发牌那条路径忘记 drop（此时表已自己触发了 ⇒ 预期是等价变异） | survived | 无 FAIL 行（SUMMARY pass=362 fail=0） |
| R20 | 回合到点不注入 timeout 行动（托管通道被摘掉） | caught | test/netx-room.test.ts→room/07；test/netx-room.test.ts→room/18；test/netx-ws.test.ts→ws/04 |
| R24 | 已绑座的连接再 join 不再被拒（already_joined 门摘掉） | caught | test/netx-room.test.ts→room/22 |
| R25 | token 与已绑座位不符不再被拒（token_seat_mismatch 门摘掉） | caught | test/netx-room.test.ts→room/23 |
| R26 | 应用层 ping 不再回 pong | caught | test/netx-room.test.ts→room/21 |
| R27 | 行动消息的局号不再核对（bad_hand 门摘掉 ⇒ 跨局行动会打到当前局） | caught | test/netx-room.test.ts→room/24 |
| R28 | 份额阶段不再核对"这一局算不算你"（no_seat 门摘掉） | caught | test/netx-room.test.ts→room/25 |
| X18 | 版本不符回 425（rev=8 的错法复辟） | caught | test/netx-ws.test.ts→ws/03；test/netx-ws.test.ts→ws/05 |
| X19 | 426 但不带 Sec-WebSocket-Version 响应头 | caught | test/netx-ws.test.ts→ws/03 |
| X20 | 缺版本字段也走 426（而不是 400） | caught | test/netx-ws.test.ts→ws/05 |
| X21 | 把读钟方法塞回 Clock 接口与 socket 层 | caught | test/netx-static.test.ts→nst/08 |
| X22 | 房间层重新读钟（Clock 接口加回 now） | caught | test/netx-static.test.ts→nst/08 |
| F17 | 编码侧不再核对掩码键长度（bad_mask 门摘掉） | caught | test/netx-frames.test.ts→frame/16 |
| F18 | 分片点越界不再被拒（bad_split 门摘掉） | caught | test/netx-frames.test.ts→frame/16 |
| F19 | 64 位长度的最小编码不再核对 | caught | test/netx-frames.test.ts→frame/17 |
| N01 | 引擎反向依赖联机层（src/engine 里 import netx，且走两层 ../ 的路径） | caught | test/netx-static.test.ts→nst/04 |
```

两条存活的等价论证：
- **R19b**（到点发牌那条路径忘记 `drop(nonceCancel)`）：那只定时器此刻**已经自己触发**并从虚拟时钟的表上摘除，`drop` 是 no-op ⇒ 行为完全相同。它旁边那条**有**意义的同形变异 R19（份额齐了就地发牌、表还没触发）被抓（`room/18`）。
- **C20**（`client.ts:95-97` 合并后条数）：见 9.3 最后一行 —— 组合变异 K01–K04 说明它既不需要也不碍事，是纯后备。

## 9.8 先逃后抓（本轮三条，都是"检查面自己有空洞"）

1. **S16**（连接清单改回 `localeCompare`）第一轮**逃过**：`room/26` 最初的 id 集合是全小写 + 数字，两套键在上面不分叉 ⇒ 用例空转。把 id 换成大小写混合（并加一条"两套键必须给出不同顺序"的前提断言）之后重跑，被抓。
2. **N01**（`src/engine/actions.ts` 里 `import '../../netx/seed.ts'`）第一轮**逃过**：`nst/04` 只扫 `src/`、`webui/`、`webmin/` 三个目录的**顶层文件**，且正则只认单层 `../netx/` ⇒ 一句两层 `../../netx/` 同时躲过目录与正则。改成递归遍历 + 匹配任何含 `netx/` 的说明符，并加一条"扫描清单里必须真的有 `src/engine/actions.ts`"的自检，重跑被抓。
3. **T06**（跟注不记账）第一次跑成了**进程崩溃**（我把 `let next` 顺手改成 `const` 又留着后面的赋值 ⇒ `TypeError`），"被抓"的证据类型不对。换成合法的可执行变异（只摘掉 `bump`）重跑：`core/08`、`core/09`、`core/11`、`core/13`、`fuzz/02`、`illegal/04` 等 **58 条**同时炸 —— 拖延终止那道口子的连带面比预想大得多，这条也是本轮单次变异炸得最多的一条。

## 9.9 变更文件清单（相对 rev=8）

- **`src/` 两处**（Q4=B 的预期影响面）：`src/engine/actions.ts`（`doFold`/`doCall` + timeout 映射）、`src/engine/validate.ts`（rev=1 那条注释改成实际语义）。`src/` 的"零运行时依赖、无时钟/随机/IO"不变：`static/13`、`static/05`、`nst/02`/`nst/03` 全绿，且新增了 N01 那条分层反例的封堵。
- **`netx/` 六处**：`client.ts`（写一次门）、`seed.ts`（`byCodepoint` + 按 party 定序）、`room.ts`（删死代码、`Clock` 去 `now`、连接清单定序）、`ws.ts`（400/426 分档、去 `Date.now`）、`frames.ts`/`sha256.ts`（注释）
- **`test/` 九处**：新文件 `engine-timeout.test.ts`；改 `engine-illegal.test.ts`、`netx-client.test.ts`、`netx-seed.test.ts`、`netx-room.test.ts`、`netx-frames.test.ts`、`netx-ws.test.ts`、`netx-static.test.ts`、`netx-fixtures.ts`、`static.test.ts`
- **文档**：`TEST-OUTPUT.md`（本节）、`SELF-REVIEW.md`（rev=9 节 9-A…9-E）、`DELIVERY.md`（rev=9）
- **刻意未动**：`webmin/**`、`webui/**`、`package.json`（依赖面一字未改）、`evidence/**`（`m4-ws-interop.txt` 那场实测 `turnMs=600s`，全程不靠超时 ⇒ 不含 `timeout` 痕迹，语义变更不影响其有效性，故不重生成）、`netx/protocol.ts`、`netx/serve.ts`

# 8 · M4 联机（权威服务端 + 多方 commit-reveal 种子 + 快照/增量重连 + 超时托管；工单 §4 M4）

## 8.1 范围与验收对照

新增一层 `netx/`（8 个源文件）与 `test/netx-*.test.ts`（10 个文件 + 1 个工装）；`src/`、`webmin/`、`webui/` 一字未动。

| §4 M4 要求 | 落地 | 证据（用例 / 变异） |
|---|---|---|
| Node ws 权威服务端 | `netx/ws.ts`（`node:http` upgrade）+ `netx/frames.ts`（手写 RFC 6455 子集）+ `netx/room.ts`（唯一写者）。**没有安装 `ws`**：`dependencies` 仍是空对象（Q5 待裁定；换过去只动 `ws.ts` 一个文件） | `ws/01`–`ws/04`（真 socket）、`frame/01`–`frame/15`（逐字节帧规则）、`nst/02`/`nst/07`（零第三方依赖机检）；变异 P06、F01–F16、R17/X17b、R18/R19/R20 |
| commit-reveal **多方**合成 seed（服务端先 commit → 各家交 nonce → 合成 → 局末揭示全部份额；单方选 seed 不合格） | `netx/seed.ts`：承诺 = `SHA-256(tag\|hand\|party\|value)`；seed = `SHA-256(按 party 字典序拼接的全部份额)` 前 32 bit | `seed/01`–`seed/12`（改任一家必变 / 单方扫 32 个候选各不相同 / 顺序无关 / 承诺打得开）、`room/02`（线上顺序：commit 必在首份 nonce 之前）、`room/03`（没齐不发牌）、`leak/02`（揭示前种子与份额明文不上线）；变异 S01–S12、R01/R15/R16、C01–C04 |
| stateSeq 快照 + 增量重连 | `view` = 全量快照；`patch` = 权威数字 + `(since,seq]` 日志增量；跨局或对不上号 ⇒ 快照；重连补发承诺/收集进度/（已结算则）揭示 | `room/08`（seq 对得上→只给 patch）、`room/09`/`room/17`（跨局→快照、揭示齐补）、`leak/04`（抖动重连与稳定路径**逐条收敛**）、`client/04`/`client/05`（seq 倒退/有洞不合并）；变异 R06/X06c、R07/R08、C05/C06/C12 |
| 超时托管 | 注入式 `Clock` + `turnMs`，到点走引擎既有的 `{kind:'timeout',seat}`（⇒ `timeout→fold`）；掉线者同样被接管，不卡桌 | `room/07`（**零上行**跑完整手）、`room/10`（掉线者到点被剔，牌局继续）、`room/18`（每阶段待发定时器恒 1 只）；变异 R02/R03 |
| 不削弱既有防泄漏（含 rev=4 的"没看牌时自己的牌也不可见"） | 第一道墙仍是 `src/engine/project.ts`；第二道 = `checkViewLeak`（服务端出口前 + 客户端收信后各一次） | `proto/07`/`proto/08`（五种越界投影 + 两种合法）、`leak/01`（**用揭示后公开的 seed 独立复算每家三张牌**，逐条扫描"别人看到且未亮牌"的下行：96 次检查零命中）、`leak/03`/`leak/05`/`client/07`/`client/08`；变异 R05、C11 |
| 引擎确定性与分层不破 | `src/**` 未改；房间只做调度，`step()` 前必过 `checkAction`；选庄复用 `webmin/model.ts::nextDealerOf`（同一出处，不另写一套） | M0–M3 全部用例仍绿（新文件不动旧期望）；`nst/04`（src/webui/webmin 不反向依赖 netx）、`room/11`（三局轮庄 0→1→2 + 筹码守恒）、`room/16`（2–6 家必然终止） |

用例数 242 → **340**（+97），未删除任何既有用例，也未改动任何既有期望值。

## 8.2 命令与退出码

| 命令 | 退出码 | 说明 |
|---|---|---|
| `npm test` | **0** | `RUNNER files=26 cases=340` / `SUMMARY pass=340 fail=0` / `RESULT=ALL_PASS` |
| `npm test`（紧接着再跑一次） | **0** | 两次的 stdout+stderr 合并流**逐字节相同**（435 行）：`sha256 = 9b516eb4a181b761faabf997491247aeb03d7911047c53a4c8c0610e56a9eec1` |
| `npx tsc --noEmit` | **0** | `tsconfig.json` 的 `include` 增加 `netx/**/*.ts`（本轮唯一一处对既有源文件的改动） |
| `node netx/serve.ts 8790` | — | 房间入口；`GET /health` 回 `{protocol:"zjh-m4-1",hand,phase,seated,connections,over,fault}` |

双跑一致的前提由机检守着：`static/10`（runner 无时钟）、`nst/03`（联机核心无时钟/随机/IO）、`nst/09`（M4 测试文件无 `Math.random`/`Date.now`；唯一例外是 `netx-ws.test.ts` 的 20 秒看门狗 —— 只防挂死、不参与判定，且这条例外本身被反向断言写死）。

## 8.3 用例分布

| 文件 | 用例数 | 覆盖 |
|---|---|---|
| `test/netx-crypto.test.ts` | 8 | SHA-256 公开向量 + 与 `node:crypto` 差分 208 条 + 雪崩 + base64 向量 + 握手向量 + SHA-1 差分 202 条 |
| `test/netx-seed.test.ts` | 12 | 承诺绑定 / 顺序无关 / 每家都有影响力 / 32 候选扫描 / 局号参与 / uint32 / 非法输入 / 揭示核对 / 单射 / party 命名 / 固定向量 / 32 位全覆盖 |
| `test/netx-protocol.test.ts` | 12 | 双向 16 条消息往返且字节稳定 / 未知 key / 缺 key / 越界 / **引擎拒绝码与源码逐字对齐** / 网络层拒绝码无空转项 / 五种越界投影 / 座位伪造 / 错误路径 / 巨帧 / 出口编码必校验 |
| `test/netx-frames.test.ts` | 15 | 三档长度字段逐字节 / 掩码 XOR 可复算 / 分包喂入 / 掩码方向 / 最小编码 / RSV / 控制帧规则与 close 码 / 分片重组与交错 / 跨分片 UTF-8 / 上限 / 非法 UTF-8 / 握手向量 |
| `test/netx-room.test.ts` | 20 | 入座即开局 / 承诺先于份额 / 没齐不发牌 / 迟到与重复 nonce / 座位绑定 / 客户端催不动结算 / 整手对账 / 零上行托管 / 增量重连收敛 / 跨局快照 / 掉线剔除 / 三局轮庄 / 破产收桌 / token 保护 / 承诺-揭示双向绑定 / 房间门槛 / 2–6 家终止 / 缺席重连齐补 / 定时器卫生 / 未绑座 |
| `test/netx-leak.test.ts` | 6 | 牌面零泄露扫描 / 种子与份额不上线 / 旁观者 / 两条路径收敛 / 客户端第二道墙 / nonce 计数与承诺不可反推 |
| `test/netx-client.test.ts` | 11 | 份额只交一次 / 行动防呆 / 非法下行 / 增量对不上号 / 日志有洞 / 揭示几类造假 / 种子提前泄露 / error 分类 / 重连消息 / 旁观者 / 自洽假种子 |
| `test/netx-ws.test.ts` | 4 | 真实 socket 三客户端整手 / health / 握手严格性 + 1002 / 断线重连接得上 |
| `test/netx-static.test.ts` | 9 | 扫描范围 / 零裸包名 / 核心无时钟随机 IO / 分层 / tsconfig / 可擦除语法 / **依赖面未扩** / 注入面 / 测试自身确定性 |
| 既有 16 个 `*.test.ts` | 242 | 一条未改，期望值也未改 |

## 8.4 完整测试输出（逐字节）

下面是 `node test/run.ts`（= `npm test` 的实际命令）的原样输出，未经手工转写。
`npm test` 只在其前面多 4 行 npm 自己的 banner（`> zjh@0.0.0 test` 等，同样不含时间戳）；
8.2 里的双跑哈希就是按 `npm test` 整体取的。

```
=== ZJH TEST REPORT (deterministic) ===
PASS test/ai-honest.test.ts :: ai/01 牌力先验表 = 22100 手全枚举的事实
PASS test/ai-honest.test.ts :: ai/02 分位表按 classic 写死，但 a23off 下的偏差 < 2pp（所以表可以不分 preset）
PASS test/ai-honest.test.ts :: ai/03 牌力分位单调，且跨档不倒挂（弱档最强手 <= 强档最弱手）
PASS test/ai-honest.test.ts :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）
PASS test/ai-honest.test.ts :: ai/05 看过牌后才按牌力决策：强牌加注、中带跟、烂牌弃
PASS test/ai-honest.test.ts :: ai/06 池赔率真的进了决策：同一副牌，池给得大方就跟、池小就弃
PASS test/ai-honest.test.ts :: ai/07 对手数量真的进了决策：同一副牌同一赔率，人越多越保守
PASS test/ai-honest.test.ts :: ai/08 看牌/保持闷是真决策：最低注级闷着省钱，注级一抬就先转明
PASS test/ai-honest.test.ts :: ai/09 只出合法行动、闷着绝不加注也绝不比牌、比牌必是合法目标（200 组随机合法集合）
PASS test/ai-honest.test.ts :: ai/12 比牌触发率 = 1000 个 seq 上量得出来，且完全由 seq+座位决定（可重放）
PASS test/ai-honest.test.ts :: ai/10 纯函数：同一输入两次调用结果逐字相同（fuzz 与回放的前提）
PASS test/ai-honest.test.ts :: ai/11 先验与 tierOrder 挂钩：把档位排列倒过来，分位表跟着倒
PASS test/ai-honest.test.ts :: ai/13 比牌目标 = 活跃对手中已投入最高者；本局已比过则不再比
PASS test/ai-honest.test.ts :: ai/13b 投入并列时按环形序选目标，而不是按座位号大小（变异 C06 复发哨）
PASS test/ai-honest.test.ts :: ai/14 掷点只由 seq+座位决定：同输入同结果、同 seq 换座位换结果
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/classic 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/a23off 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/档位集合 六档键完全一致且无重复，计数均为非负整数
PASS test/classify.test.ts :: classify/闭式结构 trips 与 pair 与 a23 无关，其余四类随 runs 移动
PASS test/classify.test.ts :: classify/输入顺序无关 455 规范类 × 6 排列判定全同（两 preset）
PASS test/classify.test.ts :: classify/A23 一族 64 手在两 preset 下的迁移符合公式
PASS test/classify.test.ts :: classify/归一化键 顺子高点 A23=3 / 234=4 / QKA=14 且长度为 1
PASS test/classify.test.ts :: classify/归一化键 对子=[对子点, 踢脚]，穷举 3744 手
PASS test/classify.test.ts :: classify/归一化键 豹子 ranks=[r]，穷举 52 手
PASS test/classify.test.ts :: classify/NOTES 打印计数三元组（实际/闭式/锚点）供独立复算
PASS test/compare.test.ts :: compare/01 规范类数量 = C(15,3) = 455
PASS test/compare.test.ts :: compare/02 自反：每类与自身比较 = 0
PASS test/compare.test.ts :: compare/03 反对称：455^2 = 207025 全对，cmp(a,b) = -cmp(b,a)
PASS test/compare.test.ts :: compare/04 传递性穷举：(a>=b && b>=c) ⇒ a>=c，全 455^3 三元组
PASS test/compare.test.ts :: compare/05 花色不参与：全体花色平移 +1 后仍判 0
PASS test/compare.test.ts :: compare/06 与独立整数键参考实现交叉一致（455^2 全对）
PASS test/compare.test.ts :: compare/07 tierOrder 整序反转：跨档对全部翻转、同档对不变
PASS test/compare.test.ts :: compare/08 tierOrder 局部改动即刻生效（把 pair 提到 trips 之上）
PASS test/compare.test.ts :: compare/09 固定种子 1000 手排序后做全对序校验（不只是相邻）
PASS test/compare.test.ts :: compare/10 牌型序链：豹子>同花顺>同花>顺子>对子>单张（15 对全断言）
PASS test/compare.test.ts :: compare/11 tierOrder 缺档时 compare 抛错而不静默
PASS test/compare.test.ts :: compare/12 档位优先于点数：最小同花顺 > 最大普通顺等交叉断言
PASS test/deck.test.ts :: deck/01 makeDeck 长度 52 且逐位满足 index = suit*13 + (rank-2)
PASS test/deck.test.ts :: deck/02 52 张互不相同
PASS test/deck.test.ts :: deck/03 makeDeck 每次返回新数组与新对象（无共享可变状态）
PASS test/deck.test.ts :: deck/04 mulberry32 同 seed 的 1000 项序列完全一致
PASS test/deck.test.ts :: deck/05 不同 seed 的序列不同
PASS test/deck.test.ts :: deck/06 输出恒为非负 uint32 整数（1e6 次采样，覆盖边界 seed）
PASS test/deck.test.ts :: deck/07 seed 非整数抛 TypeError
PASS test/deck.test.ts :: deck/08 shuffle 原地：返回值与入参是同一个数组引用
PASS test/deck.test.ts :: deck/09 shuffle 结果是原牌堆的一个排列
PASS test/deck.test.ts :: deck/10 同 seed 两次洗牌逐位一致，不同 seed 至少一处不同
PASS test/deck.test.ts :: deck/11 52 张牌恰好调用 rng 51 次
PASS test/deck.test.ts :: deck/12 rng 返回浮点/负数/非数一律抛 TypeError
PASS test/deck.test.ts :: deck/13 空牌堆与单元素牌堆不调用 rng、不抛
PASS test/deck.test.ts :: deck/14 发牌烟雾：seed=1 洗完发 6 家，每手都可判定
PASS test/deck.test.ts :: deck/16 洗牌分布公平性：固定种子 20000 轮，52 个落点计数都在容差内
PASS test/deck.test.ts :: deck/17 三张牌穷举 144 种 rng 输出：每张牌的落点计数恰为 48
PASS test/deck.test.ts :: deck/18 NOTES 打印 PRNG 与洗牌的规范向量（供跨端复算）
PASS test/deck.test.ts :: deck/19 与独立誊写的参考 mulberry32 逐位一致（钉住结构与常数）
PASS test/deck.test.ts :: deck/20 rng 恒为 0 时输出等于牌堆左旋一格（钉住从尾往前的遍历方向）
PASS test/edge.test.ts :: edge/01 §3.5 A♠2♦3♣ < 3♠4♦5♣（A23 是最小顺）
PASS test/edge.test.ts :: edge/02 §3.5 A♥2♥3♥ 是同花顺且 > 4♣5♦6♣（档位优先于点数）
PASS test/edge.test.ts :: edge/03 §3.5 2♦2♣2♥ > A♠K♠Q♠（豹子 > 同花顺）
PASS test/edge.test.ts :: edge/04 §3.5 A♦A♣3♠ > K♦K♣A♠（对子点优先，踢脚再大也没用）
PASS test/edge.test.ts :: edge/05 §3.5 同点同级 → 0（花色完全不参与）
PASS test/edge.test.ts :: edge/06 绕 A 不成顺：A♠K♦2♣ 是单张而不是顺子
PASS test/edge.test.ts :: edge/07 最大豹子 > 最小豹子 > 任意同花顺
PASS test/edge.test.ts :: edge/08 a23off 下 A♥2♥3♥ 降为同花、A♠2♦3♣ 降为单张
PASS test/edge.test.ts :: edge/09 A 在非顺子牌型里取 14
PASS test/edge.test.ts :: edge/10 归一化键长度按档固定：豹子/顺 1 位、对子 2 位、同花/单张 3 位
PASS test/edge.test.ts :: edge/11 非法手牌：长度≠3 抛 TypeError
PASS test/edge.test.ts :: edge/12 非法手牌：两张同一牌（同点同花）抛 TypeError
PASS test/edge.test.ts :: edge/13 非法牌面：rank / suit 越界、非整数、NaN 都抛 TypeError
PASS test/edge.test.ts :: edge/14 非法手牌容器：非数组 / 元素非对象 / 缺字段抛 TypeError
PASS test/edge.test.ts :: edge/15 compare 两侧都继承 classify 的非法输入检查
PASS test/edge.test.ts :: edge/16 rules 结构缺失时不静默：缺 handEval 抛 TypeError
PASS test/edge.test.ts :: edge/17 单张的型内比较只看归一化后的三点
PASS test/engine-core.test.ts :: core/01 startHand 不变量：底注入池、每人扣 ante、游标在庄家下家、计数归零
PASS test/engine-core.test.ts :: core/02 发牌互不重叠且都来自标准 52 张
PASS test/engine-core.test.ts :: core/03 发牌顺序 = 独立复算的洗牌结果（庄家下家起连续取牌）
PASS test/engine-core.test.ts :: core/04 庄家必须在座位表里
PASS test/engine-core.test.ts :: core/05 配置非法一律抛 TypeError（人数越界 / 重复座位 / 付不起底注 / seed 非整数）
PASS test/engine-core.test.ts :: core/06 apply 是纯函数：对旧状态深冻结后再推进行动，不抛（说明没有原地写）
PASS test/engine-core.test.ts :: core/07 stateHash 对状态变化敏感、对重放稳定
PASS test/engine-core.test.ts :: core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值
PASS test/engine-core.test.ts :: core/09 资金守恒：开局到结算，筹码 + 池恒等于买入总额
PASS test/engine-core.test.ts :: core/10 同一配置重复开局得到同一状态（引擎里没有隐藏全局态）
PASS test/engine-core.test.ts :: core/11 日志单调：seq 逐条 +1，type 全部来自固定集合
PASS test/engine-core.test.ts :: core/12 引擎对 2 人与 6 人都能开局（人数只受 rules.players 约束，不硬编码）
PASS test/engine-core.test.ts :: core/13 终止阈值不多不少：注级 8 上各家满 2 次仍在局里，满 3 次才 stall
PASS test/engine-fuzz.test.ts :: fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码
PASS test/engine-fuzz.test.ts :: fuzz/02 三种终止条件都能被随机行动打到（换策略覆盖 ②③）
PASS test/engine-fuzz.test.ts :: fuzz/03 2–6 人局全部跑通且守恒
PASS test/engine-fuzz.test.ts :: fuzz/04 非法行动注入：一律抛 InvalidActionError，且状态指纹不变
PASS test/engine-fuzz.test.ts :: fuzz/05 回放确定性：同 seed + 同行动序列 ⇒ 同指纹（20 局）
PASS test/engine-fuzz.test.ts :: fuzz/06 结算幂等：settle 前后指纹稳定，且只入账一次
PASS test/engine-illegal.test.ts :: illegal/01 不轮到你 → not_current_turn（三种动作各一例）
PASS test/engine-illegal.test.ts :: illegal/02 座位不存在 → bad_seat
PASS test/engine-illegal.test.ts :: illegal/03 行动对象本身不合法 → unknown_action
PASS test/engine-illegal.test.ts :: illegal/04 首圈禁比：任何人第一次行动之前都不能比牌，全员各一次后立刻放开
PASS test/engine-illegal.test.ts :: illegal/05 比牌目标非法：自己 / 已弃牌 / 不存在的座位
PASS test/engine-illegal.test.ts :: illegal/06 重复看牌被拒；看牌不消耗行动数也不推进游标
PASS test/engine-illegal.test.ts :: illegal/07 注级顶格不能再加注
PASS test/engine-illegal.test.ts :: illegal/08 钱不够 ⇒ 唯一合法行动是弃牌（全押禁用，§1 全押行）
PASS test/engine-illegal.test.ts :: illegal/09 已弃牌的座位不会再被要求行动，硬塞则 seat_not_active
PASS test/engine-illegal.test.ts :: illegal/10 终局后所有下注类行动被拒（phase_not_betting）
PASS test/engine-illegal.test.ts :: illegal/11 结算时机：没终局不能 settle；已结算再 settle 是幂等 no-op
PASS test/engine-illegal.test.ts :: illegal/12 legalActions 与 checkAction 判据完全一致（不轮到你时给出的是当前 turn 的动作集）
PASS test/engine-illegal.test.ts :: illegal/13 timeout 是普通行动：等价于弃牌，并且要过同一道 validate
PASS test/engine-money.test.ts :: money/01 底注：pool = ante × 人数，每人筹码与 committed 各扣/记一份
PASS test/engine-money.test.ts :: money/02 闷跟 = stake×bet.dark，明跟 = stake×bet.seen（三种注级各验）
PASS test/engine-money.test.ts :: money/03 加注：注级翻倍并按新注级付跟价（Q1 读法 B），且全员当前注级行动数清零
PASS test/engine-money.test.ts :: money/04 比牌费 = fee × stake 入池，与闷/明无关（注级 1/2/4 各验一次）
PASS test/engine-money.test.ts :: money/05 不变量：pot 恒等于各家 committed 之和；每步增量恰是 actionCost
PASS test/engine-money.test.ts :: money/06 弃牌不花钱也不退钱：弃牌者的 committed 留在池里（无边池无退款）
PASS test/engine-money.test.ts :: money/07 分池：整除时人人等份；有余数时给"距庄家下家最近"的赢家
PASS test/engine-money.test.ts :: money/08 幂等结算：入账只发生一次，重放 settle 不重复扣/发钱
PASS test/engine-money.test.ts :: money/09 任何时刻都不出现负筹码（全押禁用的直接后果）
PASS test/engine-money.test.ts :: money/10 结算后赢家所得 = 池，且各家 committed 之和 = 结算前 pot
PASS test/engine-project.test.ts :: project/01 谁都没看过牌：本人也是 unknown，他人一律 unknown（§1 看牌行）
PASS test/engine-project.test.ts :: project/02 序列化后仍然搜不到任何他人牌面（整条 view 一起查，含日志）
PASS test/engine-project.test.ts :: project/03 强制开牌后：活跃家全部可见，弃牌/被淘汰者仍然 unknown
PASS test/engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
PASS test/engine-project.test.ts :: project/05 seed 只在结算后才暴露（否则任何客户端都能反算整副牌）
PASS test/engine-project.test.ts :: project/06 公开信息一字不漏：池/注级/游标/计数/闷明/committed 全部同步
PASS test/engine-project.test.ts :: project/07 观战视角（viewer 不在座位表里）看不到任何未开的牌
PASS test/engine-project.test.ts :: project/08 视图是拷贝，改它不会污染引擎状态
PASS test/engine-project.test.ts :: project/09 终局信息公开：赢家集合、份额、余数归属都可投影
PASS test/engine-project.test.ts :: project/10 startHand 之后立刻投影：轮到行动也没看过牌 ⇒ 本人同样无牌可看
PASS test/engine-project.test.ts :: project/11 负向：未看牌时整条 view 序列化后搜不到本人牌面
PASS test/engine-project.test.ts :: project/12 revealed 优先于 looked：本人没看牌，被强制开牌后照样看得见自己的牌
PASS test/engine-scripts.test.ts :: scripts/01 弃至通吃（§1①）：只剩一人即结束，且不开牌
PASS test/engine-scripts.test.ts :: scripts/02 比牌链：连续两次比牌各淘汰一家，输家的牌永不公开
PASS test/engine-scripts.test.ts :: scripts/03 封顶开牌（§1②）：注级 16 且活跃各家再完成 1 次行动 ⇒ 强制开牌
PASS test/engine-scripts.test.ts :: scripts/04 stall 强开（§1③）：同一注级下活跃各家各满 3 次行动；加注会把计数清零重计
PASS test/engine-scripts.test.ts :: scripts/05 平局分池：两家打平 ⇒ 平分池，除不尽的余数给距庄家下家最近者
PASS test/engine-scripts.test.ts :: scripts/06 挑战者输：比牌平局时挑战者出局（§1 比牌行）
PASS test/engine-scripts.test.ts :: scripts/07 剩两家比牌 = 直接开牌定胜负（两家牌都亮）
PASS test/engine-scripts.test.ts :: scripts/08 三条终止路径各自都要能到达（覆盖性，不是只测一条）
PASS test/engine-scripts.test.ts :: scripts/09 每个脚本重放得到同一状态指纹（回放确定性）
PASS test/m2-fuzz.test.ts :: m2/01 随机合法行动 1000 局：守恒 / 无负筹码 / 无重复结算 / 有限步终止
PASS test/m2-fuzz.test.ts :: m2/02 诚实 AI 1000 局：只出合法行动、闷着不加注、决策数非零且必然终止
PASS test/m2-fuzz.test.ts :: m2/03 AI 臂与随机臂都打到全部三类终止条件（覆盖不是单边运气）
PASS test/m2-fuzz.test.ts :: m2/04 四类非法行动必被 validate 拒（不轮到你 / 钱不够 / 比已弃牌者 / 首圈禁比时段比牌）
PASS test/m2-fuzz.test.ts :: m2/05 牌力分位 ≈ 真实胜率，且档内端点随 a23 正确移动（两 preset 全枚举对拍）
PASS test/netx-client.test.ts :: client/01 收到 collect 里"还缺我"就立刻交一份份额，且一局只交一次
PASS test/netx-client.test.ts :: client/02 行动防呆：只有"轮到我且局面干净"才放行
PASS test/netx-client.test.ts :: client/03 服务端越界第一类：消息本身不合法 ⇒ 记录违规并拒绝继续
PASS test/netx-client.test.ts :: client/04 增量对不上号 ⇒ 不合并并记违规
PASS test/netx-client.test.ts :: client/05 快照的日志有洞 = 不可信
PASS test/netx-client.test.ts :: client/06 揭示核对的几类造假都会被当场发现
PASS test/netx-client.test.ts :: client/07 结算之前收到 deal 载荷（种子提前泄露）⇒ 违规并停手
PASS test/netx-client.test.ts :: client/08 error 分两类：漏牌即停手，普通回执不停手
PASS test/netx-client.test.ts :: client/09 重连消息带的是"我看到的 hand/seq"，没凭据时不发
PASS test/netx-client.test.ts :: client/11 揭示"自洽"但不是发牌用的那颗种子 ⇒ 仍然要报
PASS test/netx-client.test.ts :: client/10 旁观者的揭示（本局没参与、也没拿到过承诺）不报违规，也不算核对通过
PASS test/netx-crypto.test.ts :: netx/01 SHA-256 命中 FIPS 180-4 公开向量
PASS test/netx-crypto.test.ts :: netx/02 与 node:crypto 逐字节差分（覆盖补齐边界与多字节 UTF-8）
PASS test/netx-crypto.test.ts :: netx/03 雪崩：改一个字符，256 位里至少一半上下变化
PASS test/netx-crypto.test.ts :: netx/04 base64 命中经典向量（长度余数 0/1/2 三条路径都走到）
PASS test/netx-crypto.test.ts :: netx/05 握手 accept 命中 RFC 6455 §1.3 向量，非法 key 抛错
PASS test/netx-crypto.test.ts :: netx/06 十六进制与字节的往返（承诺/份额的编码面）
PASS test/netx-crypto.test.ts :: netx/07 摘要入口对空输入与非空输入给出不同长度一致的输出
PASS test/netx-crypto.test.ts :: netx/08 SHA-1（握手用）与 node:crypto 差分，且命中 RFC 6455 §1.3 向量
PASS test/netx-frames.test.ts :: frame/01 编码的三档长度字段逐字节符合规范
PASS test/netx-frames.test.ts :: frame/02 客户端方向必须掩码，且 XOR 逐字节可复算
PASS test/netx-frames.test.ts :: frame/03 客户端→服务端：掩码帧能解，逐字节喂也要能解
PASS test/netx-frames.test.ts :: frame/04 掩码方向判反：客户端不掩码 / 服务端掩码 都拒
PASS test/netx-frames.test.ts :: frame/05 长度必须最小编码，64 位长度不得越出 32 位
PASS test/netx-frames.test.ts :: frame/06 RSV 位非 0 一律拒（没谈扩展就不许出现）
PASS test/netx-frames.test.ts :: frame/07 控制帧规则：ping/pong 原样交回，close 解析状态码
PASS test/netx-frames.test.ts :: frame/08 非法 close 一律拒（1 字节载荷 / 保留码 / 越界码）
PASS test/netx-frames.test.ts :: frame/09 控制帧不得分片、载荷不得过 125
PASS test/netx-frames.test.ts :: frame/10 文本分片可重组，控制帧插在中间也不丢序
PASS test/netx-frames.test.ts :: frame/11 跨分片的多字节字符不会解坏（UTF-8 状态在帧边界上延续）
PASS test/netx-frames.test.ts :: frame/12 非法帧序与未知操作码一律拒
PASS test/netx-frames.test.ts :: frame/13 巨帧、巨消息与编码侧都有上限
PASS test/netx-frames.test.ts :: frame/14 非法 UTF-8 文本帧拒收
PASS test/netx-frames.test.ts :: frame/15 握手 accept：已知向量 + key 边界
PASS test/netx-leak.test.ts :: leak/01 真实牌面在"亮牌"之前不出现在任何一条下行字节里（三家、跑完整一手）
PASS test/netx-leak.test.ts :: leak/02 种子与各家份额在揭示之前不外泄
PASS test/netx-leak.test.ts :: leak/03 中途加入的旁观者：既不在投影里，也没发现任何越界
PASS test/netx-leak.test.ts :: leak/04 增量重连与全量快照两条路收敛：日志逐条一致、数字一致
PASS test/netx-leak.test.ts :: leak/05 客户端第二道墙：服务端把别人的牌塞进投影 ⇒ 当场发现并拒绝再行动
PASS test/netx-leak.test.ts :: leak/06 上行 nonce 各交一份、互不相同，且承诺里读不出份额
PASS test/netx-protocol.test.ts :: proto/01 双向消息 encode→check 往返保真，且字节稳定
PASS test/netx-protocol.test.ts :: proto/02 未知 key 一律拒（顶层、嵌套 move、嵌套 view、rules 内部）
PASS test/netx-protocol.test.ts :: proto/03 缺 key 与类型不符一律拒
PASS test/netx-protocol.test.ts :: proto/04 数值与长度越界一律拒
PASS test/netx-protocol.test.ts :: proto/05 引擎拒绝码全集与 src/engine/validate.ts 逐字对齐（防契约漂移）
PASS test/netx-protocol.test.ts :: proto/06 服务端实际发出的 net 拒绝码都在声明集合里，且声明集合没有空转项
PASS test/netx-protocol.test.ts :: proto/07 checkViewLeak 拦住五种越界投影，放过两种合法情形
PASS test/netx-protocol.test.ts :: proto/08 已看牌但未亮牌的"别人"仍然算泄漏（rev=4 口径在网络层同样生效）
PASS test/netx-protocol.test.ts :: proto/09 toAction 只能用绑定的座位，compare 才带 target
PASS test/netx-protocol.test.ts :: proto/10 校验错误信息带路径，便于线上定位
PASS test/netx-protocol.test.ts :: proto/11 巨帧保护：超过上限的字符串直接拒
PASS test/netx-protocol.test.ts :: proto/12 出口编码也过同一套校验：服务端构造出非法消息时本地就炸，不发到线上
PASS test/netx-room.test.ts :: room/01 两家入座即开局：hello→承诺→份额→发牌，第三条连接中途加入不参与本局
PASS test/netx-room.test.ts :: room/02 承诺先于任何份额被接受（线上顺序可查，且承诺不是份额本身）
PASS test/netx-room.test.ts :: room/03 没凑齐份额就不发牌；凑齐的那一刻发牌，且发牌后种子仍不外泄
PASS test/netx-room.test.ts :: room/04 发牌之后再交份额一律被拒，且局面一字不动
PASS test/netx-room.test.ts :: room/04b 收份额阶段：错局号与"不在这局里"的家都被拒
PASS test/netx-room.test.ts :: room/05 座位由连接绑定：上行里没有 seat 字段，越界与伪造一律无副作用
PASS test/netx-room.test.ts :: room/06 完整一手：行动、结算、揭示核对，客户端零违规、总筹码守恒
PASS test/netx-room.test.ts :: room/07 全程没人动手：超时托管把一手牌走到结算，并在日志里留痕
PASS test/netx-room.test.ts :: room/08 断线重连·seq 对得上 ⇒ 只补增量，补齐后三家视图与日志逐条一致
PASS test/netx-room.test.ts :: room/09 断线跨了一局再回来 ⇒ 拿的是新一局的快照，且本局种子对它合法可见
PASS test/netx-room.test.ts :: room/10 掉线者不交份额 ⇒ 到点改成两人局，牌局照常走完
PASS test/netx-room.test.ts :: room/11 多局连续：轮庄、筹码结转、每一局的揭示都对得上
PASS test/netx-room.test.ts :: room/12 桌上凑不齐两家就收桌：破产者下一局不再入池，筹码一颗不少
PASS test/netx-room.test.ts :: room/13 重连凭据的保护：乱 token 不绑座，真 token 回原位并顶掉旧连接
PASS test/netx-room.test.ts :: room/14 承诺与揭示双向绑定：打得开、合得出、换一家就对不上
PASS test/netx-room.test.ts :: room/15 房间层的门槛：最小买入与满座都不占座
PASS test/netx-room.test.ts :: room/16 driveToSettle 走的一手牌必然在有限步内终止（引擎不变量在联机层同样成立）
PASS test/netx-room.test.ts :: room/17 结算之后才回来的那一家，承诺+快照+揭示一起补回（审计材料不因断线丢失）
PASS test/netx-room.test.ts :: room/20 阶段门在房间层：awaitingSettle 之后的行动被房间挡下（不是丢给引擎）
PASS test/netx-room.test.ts :: room/19 没绑上座位的连接：任何游戏消息都只会拿到 no_seat，不会碰到局面
PASS test/netx-room.test.ts :: room/18 定时器不泄漏：发牌后 nonce 表必须取消，结算后只剩局间那一只
PASS test/netx-seed.test.ts :: seed/01 承诺把 hand / party / 份额三者绑在一起
PASS test/netx-seed.test.ts :: seed/02 合成与提交顺序无关（任何一端都能独立复算）
PASS test/netx-seed.test.ts :: seed/03 改任何一家的份额，种子必变（没有旁观者）
PASS test/netx-seed.test.ts :: seed/04 没有任何一家能决定种子：固定其余各家，逐家扫描 32 个候选
PASS test/netx-seed.test.ts :: seed/05 局号参与合成：同一批份额在不同局给出不同种子
PASS test/netx-seed.test.ts :: seed/06 合成结果是引擎接受的 uint32 整数
PASS test/netx-seed.test.ts :: seed/07 非法份额输入一律抛错（含能造成拼接歧义的字符）
PASS test/netx-seed.test.ts :: seed/08 揭示核对：一一对上才算通过
PASS test/netx-seed.test.ts :: seed/09 承诺文本是单射的：改一个字符就换摘要（雪崩在这里体现为不可伪造）
PASS test/netx-seed.test.ts :: seed/10 座位方命名在 party charset 内，且与"server"不撞
PASS test/netx-seed.test.ts :: seed/12 合成用的是完整 32 位（截断成 16 位会被这条抓到）
PASS test/netx-seed.test.ts :: seed/11 固定向量：复审可照抄复算
PASS test/netx-static.test.ts :: nst/01 扫描范围覆盖 netx 下全部源文件
PASS test/netx-static.test.ts :: nst/02 零第三方依赖：netx 里每个 import 都是相对路径或 node: 内置
PASS test/netx-static.test.ts :: nst/03 协议核心里没有时钟、随机与 IO（引擎的确定性口径延续到联机层）
PASS test/netx-static.test.ts :: nst/04 分层：src/ 与 webui/、webmin/ 都不反向依赖 netx/
PASS test/netx-static.test.ts :: nst/05 tsconfig 的 include 覆盖 netx，且沿用同一条可擦除语法约束
PASS test/netx-static.test.ts :: nst/06 netx 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）
PASS test/netx-static.test.ts :: nst/07 M4 之后依赖面仍然没扩：dependencies 空、devDependencies 仍在白名单内
PASS test/netx-static.test.ts :: nst/08 房间层的时钟与随机全部来自注入（RoomOptions 是唯一的入口）
PASS test/netx-static.test.ts :: nst/09 M4 的测试文件自己也不许用时钟与随机（否则双跑必然不一致）
PASS test/netx-ws.test.ts :: ws/01 三个独立 WebSocket 客户端打进来，跑完整一手并各自核对揭示
PASS test/netx-ws.test.ts :: ws/02 /health 可读；普通 HTTP 请求不会误入升级分支
PASS test/netx-ws.test.ts :: ws/03 握手与帧的严格性在真 socket 上生效：版本过旧被拒、未掩码被 1002 关掉
PASS test/netx-ws.test.ts :: ws/04 真 socket 断线：牌局在托管下走完，凭 token 重连后拿到完整局面并核对揭示
PASS test/rules.test.ts :: rules/01 presets.classic 幂等通过 validateRules
PASS test/rules.test.ts :: rules/02 presets.a23off 幂等通过 validateRules
PASS test/rules.test.ts :: rules/03 两个 preset 仅在 handEval.a23 上不同
PASS test/rules.test.ts :: rules/04 classic 的每个数值逐项等于工单 §1 表格
PASS test/rules.test.ts :: rules/05 未知顶层 key special235=true 抛 TypeError
PASS test/rules.test.ts :: rules/06 未知 key 即使值为 false 也抛（不在 v1 schema）
PASS test/rules.test.ts :: rules/07 未知嵌套 key 抛（handEval / bet 内）
PASS test/rules.test.ts :: rules/08 缺 key 抛（顶层与嵌套各一例）
PASS test/rules.test.ts :: rules/09 值类型错抛（字符串数字 / null / 非布尔）
PASS test/rules.test.ts :: rules/10 version 必须是字面量 1
PASS test/rules.test.ts :: rules/11 字面量域的非法值抛（allIn / compare.tie / showdown.*）
PASS test/rules.test.ts :: rules/12 tierOrder 必须是 6 档无重复排列
PASS test/rules.test.ts :: rules/13 非对象输入一律抛
PASS test/rules.test.ts :: rules/14 validateRules 返回值深冻结（顶层/嵌套/数组都改不动）
PASS test/rules.test.ts :: rules/15 validateRules 返回深拷贝，输入事后被改不影响副本
PASS test/rules.test.ts :: rules/16 presets 本身深冻结
PASS test/rules.test.ts :: rules/17 错误消息点名违规所在路径与 key
PASS test/rules.test.ts :: rules/18 dealer.next 三档各自合法，且 preset 默认 = rotate
PASS test/rules.test.ts :: rules/19 dealer 的非法形态一律抛（枚举外值 / 缺字段 / 多余 key / 非对象 / 大小写）
PASS test/static.test.ts :: static/00 扫描范围覆盖 cards / rules / engine / ai 全部源文件
PASS test/static.test.ts :: static/01 src 里不出现时钟与随机全局态
PASS test/static.test.ts :: static/02 src 里不出现文件、网络与控制台 IO
PASS test/static.test.ts :: static/03 src 不引用任何运行时全局可变对象
PASS test/static.test.ts :: static/04 import 只允许相对路径；M0 两文件只允许 import type ./rules.ts
PASS test/static.test.ts :: static/05 src 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）
PASS test/static.test.ts :: static/06 零运行时依赖：dependencies 必须为空（或整体不存在）
PASS test/static.test.ts :: static/07 devDependencies 落在工单白名单内
PASS test/static.test.ts :: static/08 npm test 是单命令，且不依赖任何已安装依赖
PASS test/static.test.ts :: static/09 tsconfig 打开 strict 与 erasableSyntaxOnly
PASS test/static.test.ts :: static/10 输出生产者 test/run.ts 不引用时钟（保证两次运行一致）
PASS test/static.test.ts :: static/11 测试目录可被 runner 发现且无空目录
PASS test/static.test.ts :: static/12 M0 冻结接口：cards/rules 的导出名恰好是 §2.7 契约（不夹带私有实现的导出）
PASS test/static.test.ts :: static/13 src/ai 只用投影信息：越界引用与运行时依赖一律为 0 命中
PASS test/webmin-dealer.test.ts :: dealer/01 rotate：庄家的下家接任（手推座位号）
PASS test/webmin-dealer.test.ts :: dealer/02 winner：单赢家通吃即该赢家坐庄
PASS test/webmin-dealer.test.ts :: dealer/03 winner：平局分池先给拿到余数的那位，无余数才按环形最近
PASS test/webmin-dealer.test.ts :: dealer/04 loser：非赢家中距庄家下家最近者；其离桌则环形顺延到下一家输家
PASS test/webmin-dealer.test.ts :: dealer/05 loser 档无在桌输家时退回轮庄（Q2 已裁定 A）
PASS test/webmin-dealer.test.ts :: dealer/06 三档都没有可留的座位时返回 null（调用方该收桌）
PASS test/webmin-dealer.test.ts :: dealer/07 createSession：三档都合法、默认 rotate、非法值抛 TypeError
PASS test/webmin-dealer.test.ts :: dealer/08 会话层：winner 档 ⇒ 每局庄家 = 上一局赢家
PASS test/webmin-dealer.test.ts :: dealer/09 会话层：loser 档 ⇒ 庄家来自上一局非赢家（除非无在桌输家）
PASS test/webmin-dealer.test.ts :: dealer/10 会话层：rotate 档仍是老行为（庄位逐局换人），且三档结果互不相同
PASS test/webmin-dealer.test.ts :: dealer/11 选庄不改钱：三档各自跨局守恒
PASS test/webmin-model.test.ts :: ui/01 createSession 建立座位、首局与台账
PASS test/webmin-model.test.ts :: ui/02 非法开局参数一律抛 TypeError
PASS test/webmin-model.test.ts :: ui/03 deriveSeed 确定、逐局不同、不用时钟
PASS test/webmin-model.test.ts :: ui/04 没轮到真人时点按钮 → 拒绝且状态指纹不变
PASS test/webmin-model.test.ts :: ui/05 真人+机器人打完一整局：走到结算，台账守恒
PASS test/webmin-model.test.ts :: ui/06 真人发起合法比牌恰好淘汰一家；期间确证首圈禁比挡过
PASS test/webmin-model.test.ts :: ui/07 乱点不崩：非法意图 ok:false 且指纹不变；整桌重来永远可点
PASS test/webmin-model.test.ts :: ui/08 再来一局：局号 +1、庄家轮转到下家、总额守恒
PASS test/webmin-model.test.ts :: ui/09 连打 12 局：每局有限步结束、总额恒定
PASS test/webmin-model.test.ts :: ui/10 机器人走 AI：只出合法意图、闷着不加注不比牌、注级抬高先转明
PASS test/webmin-model.test.ts :: ui/10b 机器人走 AI：强牌加注 / 同一副牌随赔率翻转 / 闷着遇高注级先转明
PASS test/webmin-model.test.ts :: ui/10c 未看牌的机器人决策与手牌无关（同一局面只换牌）
PASS test/webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
PASS test/webmin-model.test.ts :: ui/11b 整桌重来要请回破产离桌的人，并保留庄家规则档位（M2 实测抓到的两个缺陷）
PASS test/webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
PASS test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
PASS test/webmin-model.test.ts :: ui/14 分层边界：model 不碰 DOM/时钟/随机，app 不碰 node 内置也不自己判规则
PASS test/webmin-model.test.ts :: ui/15 页面接线：html 与各模块 import 路径都能被服务放行
PASS test/webmin-model.test.ts :: ui/16 一整局的可见性推进：局中暗牌、终局按规则亮
PASS test/webmin-model.test.ts :: ui/17 页面显示的牌型名与 classify 判定一致（且以看过牌为前提）
PASS test/webmin-model.test.ts :: ui/18 未看牌时 view() 全树序列化与座位行都搜不到真人牌面
PASS test/webmin-model.test.ts :: ui/19 结算信息一条不丢：每家的账就地进座位板，结算块只留原因与指纹（rev=7 ④的前提）
PASS test/webmin-model.test.ts :: ui/20 亮牌文本行：ASCII 记法逐张对得上，且只列真亮出来的牌（验收④给机器的读法）
PASS test/webui.test.ts :: ui3/01 层次：webui 只 import 彼此与 webmin/model，绝不直接碰引擎或 src
PASS test/webui.test.ts :: ui3/02 层次：只有入口层能碰 DOM；UI 侧一行规则判定都没有
PASS test/webui.test.ts :: ui3/03 bridge：开桌后快照结构化，未看牌 ⇒ 每一行都是隐藏位
PASS test/webui.test.ts :: ui3/04 bridge：三档庄家规则都开得出桌并回显在快照里
PASS test/webui.test.ts :: ui3/04b 页面接线：开桌控件与 StartOptions 一一对应，庄家三档不许在 M3 这一版丢掉
PASS test/webui.test.ts :: ui3/05 bridge：非法意图走引擎拒绝路径，计数与状态指纹都对
PASS test/webui.test.ts :: ui3/06 bridge：真人点看牌 ⇒ 只有自己那行亮牌，且快照里搜不到任何别家牌面
PASS test/webui.test.ts :: ui3/07 bridge：把一局打完 ⇒ 结算区有内容、日志在长、桌上总额守恒
PASS test/webui.test.ts :: ui3/08 scene 是纯函数：同一输入两次布局逐字节相同
PASS test/webui.test.ts :: ui3/09 scene 布局不变量：命中区与按钮一一对应、互不重叠、都在画布内（三种视口）
PASS test/webui.test.ts :: ui3/09b 低于最小视口时不做布局、只画提示，且不留下任何可点区（不装作能玩）
PASS test/webui.test.ts :: ui3/09c 竖向预算先给牌桌：候选 10 个时按钮条至多 3 行，座位板照旧不挤不越界（变异 U05 复发哨）
PASS test/webui.test.ts :: ui3/10 scene 命中测试：中心与四条边角都算命中，边界外 1px 不命中
PASS test/webui.test.ts :: ui3/11 scene 不泄露未看过的牌：开局整棵图元树里没有任何牌面字符
PASS test/webui.test.ts :: ui3/11b 看牌前后：整棵图元树从 0 张牌面变成正好 3 张（且就是本人那手）
PASS test/webui.test.ts :: ui3/12 paint 只执行图元：假 ctx 下调用次数与图元数一一对应
PASS test/webui.test.ts :: ui3/13 静态服务放行 webui（不装 vite 也跑得起），根路径仍指向 M1.5
PASS test/webui.test.ts :: ui3/14b 没轮到真人时"整桌重来"仍报合法（U01 复发哨：灰按钮不许谎报会被拒）
PASS test/webui.test.ts :: ui3/15 翻牌动画：进度过半之前一张牌面都不许出现，之后才亮
PASS test/webui.test.ts :: ui3/16 动画进度是纯入参：同一 (快照, anim) 两次布局逐字节相同；不给 anim 时直接终态
PASS test/webui.test.ts :: ui3/17 没配 since 的座位视为已翻开；换局后重新亮牌的座位会重新起算
PASS test/webui.test.ts :: ui3/14 灰按钮点了必被引擎拒（验收③在 M3 侧的等价形态）
PASS test/webui.test.ts :: ui3/18 牌面放大：每张亮牌 ≥48×64、点数 ≥18px，本人手牌再大一档（工单 rev=7 ①）
PASS test/webui.test.ts :: ui3/19 2–6 家都排得开：座位板数量对得上、互不重叠、不越界、不压按钮（工单 rev=7 ②）
PASS test/webui.test.ts :: ui3/19b 极端候选数下只许二选一：要么明说装不下，要么座位板/按钮/底部条互不重叠（不许硬排）
PASS test/webui.test.ts :: ui3/20 结算块不许盖住任何一张亮出来的牌（牌刚亮完就被盖住 = rev=7 要修的老毛病）
PASS test/webui.test.ts :: ui3/21 顶栏不许被牌桌盖住：状态行是整句，被木轨吃掉就等于丢信息（rev=7 实测缺陷复发哨）
PASS test/webui.test.ts :: ui3/22 按钮文案一个字都不许丢：折行只改行数，且每行都得待在自己那颗按钮里
PASS test/webui.test.ts :: ui3/23 牌角不许爬到邻牌脸上：每个点数/花色图元必须待在"自己那张牌露出来的那一条"里
PASS test/webui.test.ts :: ui3/24 桌面中央的"亮牌"文本行：每张亮牌都在里面、字号够读、且不压任何座位板

=== NOTES (fixed vectors, recompute-able independently) ===
AI-CALIB max|est-true|=0.3pp over 24 anchors
AI02 tier-percentile max diff=0.27pp
AI09 compare=1/200 组（其中有资格比牌的才 9 组）
AI12 trigger=14.6% over 1000 seqs
CANONICAL mulberry32 seed=1 float_first=0.6270739405881613
CMP 2S 2D 9C vs 3S 4D 5C = -1
CMP 2S 3D 4C vs AS KS QS = -1
CMP 4S 9S JS vs AS 2S 3S = -1
CMP 9S 9D 2C vs 9C 9S 2D = 0
CMP AS 2S 3S vs QD KC JS = 1
DEAL seat=0 hand=T♠2♠J♠ tier=flush ranks=[11,10,2]
DEAL seat=1 hand=5♠9♣J♥ tier=highCard ranks=[11,9,5]
DEAL seat=2 hand=3♠6♦A♦ tier=highCard ranks=[14,6,3]
DEAL seat=3 hand=6♠K♥7♣ tier=highCard ranks=[13,7,6]
DEAL seat=4 hand=2♥7♠T♣ tier=highCard ranks=[10,7,2]
DEAL seat=5 hand=Q♥J♣7♦ tier=highCard ranks=[12,11,7]
DEALER08 winner 0>2=>2 2>0=>0 0>1=>1 1>0=>0 0>0=>0 0>3=>3
DEALER09 loser hands=6 fallback=0
DEALER10 rotate=0,1,2,3,0 winner=0,2,0,1,0 loser=0,1,3,1,2
ENUM a23off actual   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off anchor   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off closed   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM classic actual   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic anchor   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic closed   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
FUZZ-ILLEGAL probes=2520 rejected=2240
FUZZ-ILLEGAL4 probes=11137 not_current_turn=3956 cannot_afford=1978 bad_target=2081 compare_forbidden_before_first_actions=2510
FUZZ-MODE reasons=oneLeft,stakeCap,stall
FUZZ-ai hands=1000 maxSteps=17 decisions=9262 look=1231 compare=117 有比牌的局=113 reasons=oneLeft=300 stakeCap=42 stall=658
FUZZ-random hands=1000 maxSteps=21 decisions=0 look=0 compare=0 有比牌的局=0（decisions/look/compare 只统计 decideAi 的决策，随机臂不经过 AI ⇒ 恒为 0，不是"随机臂不打比牌"） reasons=oneLeft=804 stakeCap=189 stall=7
FUZZ200 maxSteps=19 reasons=oneLeft=169 stakeCap=27 stall=4
HASH seed11-3calls=c654f607d89ce8c9
REPLAY cap seed=1 hash=03adaa7bef0f0d99
REPLAY cap seed=2 hash=2d3f6f85ce3ae82f
REPLAY cap seed=5 hash=0966c43c35d04a96
REPLAY foldout seed=1 hash=f6ebdc809abcb74a
REPLAY foldout seed=2 hash=aceb2772ab74efc0
REPLAY foldout seed=5 hash=096e62b78da9c34d
REPLAY stall seed=1 hash=1730bb61755d018f
REPLAY stall seed=2 hash=80606e936d104725
REPLAY stall seed=5 hash=286b96c25face2b4
SCRIPT02 seed=1 loser1=2 loser2=0
SCRIPT05 seed=1061 pot=13 shares=7,6
SCRIPT06 seed=622 tie hands: 1=[{"rank":8,"suit":1},{"rank":14,"suit":0},{"rank":7,"suit":3}] 2=[{"rank":7,"suit":1},{"rank":8,"suit":2},{"rank":14,"suit":3}]
SEED base=20260925 h1=3776361071 h2=1243603819
SETTLE seed1-stall chips=96,108,96 pot0 total=300
SHUFFLE-FAIR trials=20000 expected=384.61538461538464 min=331 max=431
SORT1000 seed=20260925 ties=2182 first=[{"rank":10,"suit":3},{"rank":10,"suit":1},{"rank":10,"suit":0}]
TRANS full_triples=94196375 implied_triples=47201700
UI05 steps=5 结束原因：同一注级下各家各完成 3 次行动 → 强制开牌
UI06 合法比牌达成，且首圈禁比确凿生效过
UI07 rejected=7/7
UI09 hands=12 total=768 over=null
UI10 botSteps=253 raise=10 call=110 fold=43 look=77 compare=13
UI11 收桌于第 3 局：只剩 1 家还付得起底注（最少需要 2 家），牌局结束
UI16 reason=stall
UI19 待结算样本：phase=awaitingSettle 赢家=1
UI20 亮牌：你 8C 3S KS 单张 / 电脑1 5S TC 5H 对子 / 电脑3 QS 3H 7D 单张
UI307 结算行=5 日志行=12 点击=3 被拒=0
VECTOR mulberry32 seed=1 first8=2693262067,11749833,2265367787,4213581821,4159151403,1207330352,2632122864,3095568220
VECTOR mulberry32 seed=2 first8=3153583793,1395857638,1225337227,2310499808,3759333107,2709408573,2144054433,1534354113
VECTOR mulberry32 seed=4294967295 first8=3850105811,813802916,3073704848,4054706436,3630262831,2315588663,2922715533,2042566601
VECTOR shuffle seed=1 first12=TS 2S JS 5S 9C JH 3S 6D AD 6S KH 7C
VECTOR shuffle seed=1 last6=2D 3C QC KC 8D 4H
frame/15 握手向量 = RFC 6455 §1.3（SHA-1 + GUID 258EAFA5-E914-47DA-95CA-C5AB0DC85B11）
leak/01 按 seed 独立复算三家的牌面，逐条扫描"别人看到且尚未亮牌"的下行（96 次检查）：零命中
leak/02 结算视图前扫描 35 条下行：种子字段/种子数字零命中；揭示前份额明文零命中
leak/04 抖动重连 8 次之后仍与稳定路径逐条收敛
netx/02 SHA-256 与 node:crypto 差分 208 条输入全部一致
netx/08 SHA-1 与 node:crypto 差分 202 条一致；握手向量 = RFC 6455 §1.3
nst/07 依赖面：dependencies={}，devDependencies=@types/node,typescript,vite
nst/09 M4 测试文件 10 份：netx-client.test.ts, netx-crypto.test.ts, netx-fixtures.ts, netx-frames.test.ts, netx-leak.test.ts, netx-protocol.test.ts, netx-room.test.ts, netx-seed.test.ts, netx-static.test.ts, netx-ws.test.ts；时钟例外只给 netx-ws.test.ts（仅看门狗）
proto/01 上行 6 条 / 下行 10 条往返保真且字节稳定
proto/06 net 拒绝码 5 个全部会被真正发出：bad_hand, no_seat, not_dealt, bad_nonce, nonce_late
proto/12 出口编码：6 类非法消息全部在本地被拦（服务端不能只约束客户端）
room/11 三局庄家轮转 0→1→2；结束时 0:249 1:256 2:263
room/16 2~6 家全部靠"看牌+跟注"走到强制开牌，无违规、无 fault
room/17 缺席完全局的重连：承诺/快照/揭示三件齐补，种子核对通过
room/18 每一阶段的待发定时器数量恒为 1（nonce/回合/结算表都被正确取消）
seed/11 合成 seed=1498111553（份额明文见 netx-seed.test.ts 顶部 SHARES）
seed/11 固定向量 hand=1 shares=[seat:0:49af21ae…, seat:1:4ec39f40…, seat:2:e4aa43f9…, server:12be698b…]
seed/12 4096 组份额合成 4096 个互不相同的种子，最大值 4294600091
ws/01 真实 socket + Node 内置 WebSocket 客户端跑完一手牌：11 个 seq，三家各自核对通过
ws/04 断线期间牌局由托管走完；重连后 seq 从 0 追到 4，揭示核对通过

RUNNER files=26 cases=340
SUMMARY pass=340 fail=0 total=340
RESULT=ALL_PASS
```

## 8.5 真实 socket 互操作（`ws/01`–`ws/04` 在测什么）

- **对端不是我自己写的客户端**：`ws/01`/`ws/04` 用 Node 24 内置的全局 `WebSocket`（undici 实现，另一套独立代码）连接本仓库手写的服务端，走 TCP 回环。握手、掩码、长度分档、控制帧、关闭握手由**两套独立实现**互相验证。
- `ws/01`：三个客户端各自 join → 收服务端承诺 → 各交一份 nonce → 服务端合成 seed 发牌 → 轮到自己就 look/call → 强制开牌 → 自动结算 → 揭示。断言：三家各自 `verifiedHand = 1`（承诺打得开、自己那份在场、合成结果 = 真正发牌那颗）、三家权威数字与日志逐条一致、总筹码 768 守恒、`room.info().fault = null`。实测这一手走了 11 个 seq。
- `ws/03`：裸 socket 手写 upgrade —— 版本 8 被拒；版本 13 得 `101` 且 `Sec-WebSocket-Accept` 逐字节等于 `s3pPLMBiTxaQ9kYGzzhZRbK+xOo=`（RFC 6455 §1.3），子协议 `zjh-m4-1` 被回显；随后发一个**未掩码**文本帧 ⇒ 服务端按标准回 `close(1002)` 并断开。
- `ws/04`：甲在发牌后掐线；乙的回合到点被托管，牌局在甲缺席时走完并揭示；甲凭 token 重连 ⇒ 承诺/快照/揭示三件齐补，seq 从 0 追到 4，核对通过。
- 时间处理：服务端用真实 `setTimeout`（在 `netx/ws.ts` 里落地注入的 `Clock`），测试端用 `await` 驱动；唯一的定长量是 20 秒看门狗，只用于"流程死了要报错"而不是"慢一点就判不过"。

## 8.6 变异扫描：76 条逐条结果

每条 = 把一道新加的门故意打坏一处（改前记 sha，跑完整 `npm test`，跑完还原并核对 sha）；锚点对不上记 SKIPPED（不算抓，改锚点后重跑）。"依据"列取自当次运行真实的 FAIL 行。

```
| 变异 | 打坏的那一道门 | 结果 | 依据 |
| --- | --- | --- | --- |
| C01 | 揭示不核对承诺能否打开 | caught | **被抓**：client.test.ts→client/06 揭示核对的几类造假都会被当场发现 |
| C02 | 揭示不核对我的份额在场 | caught | **被抓**：client.test.ts→client/06 揭示核对的几类造假都会被当场发现 |
| C03 | 揭示不核对合成结果 | caught | **被抓**：client.test.ts→client/06 揭示核对的几类造假都会被当场发现 |
| C04 | 揭示不核对"用的就是这个种子" | caught | **被抓**：client.test.ts→client/11 揭示"自洽"但不是发牌用的那颗种子 ⇒ 仍然要报 |
| C05 | 不做日志连续性检查 | caught | **被抓**：client.test.ts→client/04 增量对不上号 ⇒ 不合并并记违规；client.test.ts→client/05 快照的日志有洞 = 不可信 |
| C06 | 增量 seq 不匹配也合并 | caught | **被抓** |
| C07 | 发现越界之后照常行动 | caught | **被抓**：client.test.ts→client/08 error 分两类：漏牌即停手，普通回执不停手；leak.test.ts→leak/05 客户端第二道墙：服务端把别人的牌塞进投影 ⇒ 当场发现并拒绝再行动 |
| C08 | 承诺没到手也交份额 | caught | **被抓**：client.test.ts→client/01 收到 collect 里"还缺我"就立刻交一份份额，且一局只交一次 |
| C09 | 同一局重复交份额 | caught | **被抓**：client.test.ts→client/01 收到 collect 里"还缺我"就立刻交一份份额，且一局只交一次；leak.test.ts→leak/03 中途加入的旁观者：既不在投影里，也没发现任何越界 |
| C10 | 不校验下行的协议合法性 | caught | **被抓**：client.test.ts→client/03 服务端越界第一类：消息本身不合法 ⇒ 记录违规并拒绝继续 |
| C11 | 不检查别人未亮牌的牌面（第二道墙失守） | caught | **被抓**：client.test.ts→client/07 结算之前收到 deal 载荷（种子提前泄露）⇒ 违规并停手；leak.test.ts→leak/05 客户端第二道墙：服务端把别人的牌塞进投影 ⇒ 当场发现并拒绝再行动 |
| C12 | 合并后不检查日志总条数与 seq 相符 | 存活 | 等价变异 — 等价：since 必须等于本地 seq + delta 必须从 since+1 连续到 seq，两条已蕴含"合并后条数 = seq" |
| F01 | 不要求客户端掩码 | caught | **被抓**：frames.test.ts→frame/04 掩码方向判反：客户端不掩码 / 服务端掩码 都拒 |
| F02 | 不查 RSV 位 | caught | **被抓**：frames.test.ts→frame/06 RSV 位非 0 一律拒（没谈扩展就不许出现）；ws.test.ts→ws/03 握手与帧的严格性在真 socket 上生效：版本过旧被拒、未掩码被 1002 关掉 |
| F03 | 允许非最小编码长度 | caught | **被抓**：frames.test.ts→frame/05 长度必须最小编码，64 位长度不得越出 32 位 |
| F04 | 控制帧允许分片 | caught | **被抓**：frames.test.ts→frame/09 控制帧不得分片、载荷不得过 125 |
| F05 | 控制帧不限长度 | caught | **被抓**：frames.test.ts→frame/09 控制帧不得分片、载荷不得过 125 |
| F06 | close code 不校验 | caught | **被抓**：frames.test.ts→frame/08 非法 close 一律拒（1 字节载荷 / 保留码 / 越界码） |
| F07 | 分片不重组 | caught | **被抓**：frames.test.ts→frame/10 文本分片可重组，控制帧插在中间也不丢序；frames.test.ts→frame/11 跨分片的多字节字符不会解坏（UTF-8 状态在帧边界上延续） |
| F08 | 允许数据帧交错 | caught | **被抓**：frames.test.ts→frame/12 非法帧序与未知操作码一律拒 |
| F09 | 允许无主续帧 | caught | **被抓**：frames.test.ts→frame/12 非法帧序与未知操作码一律拒 |
| F10 | 收二进制帧 | caught | **被抓**：frames.test.ts→frame/12 非法帧序与未知操作码一律拒 |
| F11 | 不查单帧长度上限 | caught | **被抓**：frames.test.ts→frame/13 巨帧、巨消息与编码侧都有上限 |
| F12 | UTF-8 用非 fatal 解码 | caught | **被抓**：frames.test.ts→frame/14 非法 UTF-8 文本帧拒收 |
| F13 | 握手忘了拼接 GUID（本轮真实修过的同类错） | caught | **被抓**：crypto.test.ts→netx/05 握手 accept 命中 RFC 6455 §1.3 向量，非法 key 抛错；crypto.test.ts→netx/08 SHA-1（握手用）与 node:crypto 差分，且命中 RFC 6455 §1.3 向量 |
| F14 | 握手 GUID 写错一位 | caught | **被抓**：crypto.test.ts→netx/05 握手 accept 命中 RFC 6455 §1.3 向量，非法 key 抛错；crypto.test.ts→netx/08 SHA-1（握手用）与 node:crypto 差分，且命中 RFC 6455 §1.3 向量 |
| F15 | 编码漏写掩码键（本轮真实修过的错） | caught | **被抓**：frames.test.ts→frame/02 客户端方向必须掩码，且 XOR 逐字节可复算；frames.test.ts→frame/03 客户端→服务端：掩码帧能解，逐字节喂也要能解 |
| F16 | 16 位长度字段字节序写反 | caught | **被抓**：frames.test.ts→frame/01 编码的三档长度字段逐字节符合规范；frames.test.ts→frame/03 客户端→服务端：掩码帧能解，逐字节喂也要能解 |
| P01 | obj 校验不查未知 key | caught | **被抓**：client.test.ts→client/03 服务端越界第一类：消息本身不合法 ⇒ 记录违规并拒绝继续；protocol.test.ts→proto/02 未知 key 一律拒（顶层、嵌套 move、嵌套 view、rules 内部） |
| P02 | obj 校验不查缺失 key | caught | **被抓**：protocol.test.ts→proto/03 缺 key 与类型不符一律拒；protocol.test.ts→proto/12 出口编码也过同一套校验：服务端构造出非法消息时本地就炸，不发到线上 |
| P03 | 整数不查上界 | caught | **被抓**：protocol.test.ts→proto/04 数值与长度越界一律拒 |
| P04 | 字符串不查长度 | caught | **被抓**：protocol.test.ts→proto/04 数值与长度越界一律拒；protocol.test.ts→proto/12 出口编码也过同一套校验：服务端构造出非法消息时本地就炸，不发到线上 |
| P05 | rules 不走 validateRules | caught | **被抓**：protocol.test.ts→proto/02 未知 key 一律拒（顶层、嵌套 move、嵌套 view、rules 内部） |
| P06 | Move 允许 settle（客户端能催结算） | caught | **被抓**：protocol.test.ts→proto/10 校验错误信息带路径，便于线上定位 |
| P07 | 防泄漏不看 revealed 门 | caught | **被抓**：leak.test.ts→leak/01 真实牌面在"亮牌"之前不出现在任何一条下行字节里（三家、跑完整一手）；leak.test.ts→leak/02 种子与各家份额在揭示之前不外泄 |
| P08 | 防泄漏不看本人 looked 门 | caught | **被抓**：protocol.test.ts→proto/07 checkViewLeak 拦住五种越界投影，放过两种合法情形 |
| P09 | 防泄漏不查投影对象是否本人 | caught | **被抓**：protocol.test.ts→proto/07 checkViewLeak 拦住五种越界投影，放过两种合法情形 |
| P10 | 防泄漏不查结算前种子 | caught | **被抓**：client.test.ts→client/07 结算之前收到 deal 载荷（种子提前泄露）⇒ 违规并停手；protocol.test.ts→proto/07 checkViewLeak 拦住五种越界投影，放过两种合法情形 |
| P11 | 防泄漏不查事件备注夹带 | caught | **被抓**：protocol.test.ts→proto/07 checkViewLeak 拦住五种越界投影，放过两种合法情形 |
| P12 | 数组不查长度上限 | caught | **被抓**：protocol.test.ts→proto/04 数值与长度越界一律拒 |
| P13 | 出口编码不校验（服务端能乱发） | caught | **被抓**：protocol.test.ts→proto/12 出口编码也过同一套校验：服务端构造出非法消息时本地就炸，不发到线上 |
| R01 | 份额没齐也发牌 | caught | **被抓**：room.test.ts→room/01 两家入座即开局：hello→承诺→份额→发牌，第三条连接中途加入不参与本局；room.test.ts→room/03 没凑齐份额就不发牌；凑齐的那一刻发牌，且发牌后种子仍不外泄 |
| R02 | 超时不注入任何行动（牌局卡住） | caught | **被抓**：room.test.ts→room/07 全程没人动手：超时托管把一手牌走到结算，并在日志里留痕；room.test.ts→room/10 掉线者不交份额 ⇒ 到点改成两人局，牌局照常走完 |
| R03 | 托管走 call 而不是引擎的 timeout 通道 | caught | **被抓**：room.test.ts→room/07 全程没人动手：超时托管把一手牌走到结算，并在日志里留痕；room.test.ts→room/10 掉线者不交份额 ⇒ 到点改成两人局，牌局照常走完 |
| R04 | 发牌后不取消 nonce 定时器（定时器泄漏） | caught | **被抓**：room.test.ts→room/18 定时器不泄漏：发牌后 nonce 表必须取消，结算后只剩局间那一只 |
| R05 | 出口不做防泄漏自检 | 存活 | 等价变异 — 等价：project() 生成的可达投影本身就不可能越界（第一道墙由 engine-project / proto/07 钉死）；同一函数的第二道墙在客户端，去掉它由 C11 抓住 |
| R06 | 增量判定不看局号（跨局也走 patch） | 存活 | 等价变异 — 等价：mark.hand 门与"beginHand 清 mark"互为冗余；两条一起撤 = X06c，仍等价（新一局首推 seq=1 必然走快照，差异不可达） |
| R07 | 重连不补发承诺 | caught | **被抓**：room.test.ts→room/06 完整一手：行动、结算、揭示核对，客户端零违规、总筹码守恒；room.test.ts→room/09 断线跨了一局再回来 ⇒ 拿的是新一局的快照，且本局种子对它合法可见 |
| R08 | 已结算的局重连不补揭示 | caught | **被抓**：room.test.ts→room/17 结算之后才回来的那一家，承诺+快照+揭示一起补回（审计材料不因断线丢失）；ws.test.ts→ws/04 真 socket 断线：牌局在托管下走完，凭 token 重连后拿到完整局面并核对揭示 |
| R09 | 掉线者不剔除，一直等 nonce | caught | **被抓**：room.test.ts→room/10 掉线者不交份额 ⇒ 到点改成两人局，牌局照常走完 |
| R10 | 下一局不看筹码门槛（破产者也拉进来） | caught | **被抓**：room.test.ts→room/12 桌上凑不齐两家就收桌：破产者下一局不再入池，筹码一颗不少 |
| R11 | 选庄永远用 firstDealer（轮庄失效） | caught | **被抓**：room.test.ts→room/11 多局连续：轮庄、筹码结转、每一局的揭示都对得上 |
| R12 | 结算后不结转筹码（台账丢钱） | caught | **被抓**：room.test.ts→room/12 桌上凑不齐两家就收桌：破产者下一局不再入池，筹码一颗不少 |
| R13 | 揭示前不做自检 | 存活 | 等价变异 — 等价：自检对象是服务端自己刚用的 shares，恒真；同样的核对搬到客户端由 C01/C04/client/11 抓死 |
| R14 | 承诺位上直接发份额（commit 退化成 reveal） | caught | **被抓**：leak.test.ts→leak/01 真实牌面在"亮牌"之前不出现在任何一条下行字节里（三家、跑完整一手）；leak.test.ts→leak/02 种子与各家份额在揭示之前不外泄 |
| R15 | 迟到 nonce 被接受（种子能中途变） | caught | **被抓**：protocol.test.ts→proto/06 服务端实际发出的 net 拒绝码都在声明集合里，且声明集合没有空转项；room.test.ts→room/04 发牌之后再交份额一律被拒，且局面一字不动 |
| R16 | 重复 nonce 被覆盖（一家能改种子） | caught | **被抓**：protocol.test.ts→proto/06 服务端实际发出的 net 拒绝码都在声明集合里，且声明集合没有空转项；room.test.ts→room/04b 收份额阶段：错局号与"不在这局里"的家都被拒 |
| R17 | 上行行动允许指定别人的座位 | 存活 | 等价变异 — 等价：move 里根本没有 seat 字段，协议校验先把带 seat 的 move 拒掉（proto/02）；两道门一起撤 = X17b，被 room/05 抓住 |
| R18 | 未 join 的连接也能行动 | caught | **被抓**：room.test.ts→room/19 没绑上座位的连接：任何游戏消息都只会拿到 no_seat，不会碰到局面 |
| R19 | 客户端能催结算（阶段门失守） | caught | **被抓**：room.test.ts→room/20 阶段门在房间层：awaitingSettle 之后的行动被房间挡下（不是丢给引擎） |
| R20 | 断线重连用任意 token 都放行 | caught | **被抓**：room.test.ts→room/13 重连凭据的保护：乱 token 不绑座，真 token 回原位并顶掉旧连接 |
| R21 | 最小买入门槛失效 | caught | **被抓**：room.test.ts→room/15 房间层的门槛：最小买入与满座都不占座 |
| R22 | 结算不再广播（别人看不到结果） | caught | **被抓**：leak.test.ts→leak/01 真实牌面在"亮牌"之前不出现在任何一条下行字节里（三家、跑完整一手）；leak.test.ts→leak/02 种子与各家份额在揭示之前不外泄 |
| S01 | 合成时忽略客户端份额（只认服务端） | caught | **被抓**：seed.test.ts→seed/03 改任何一家的份额，种子必变（没有旁观者）；seed.test.ts→seed/04 没有任何一家能决定种子：固定其余各家，逐家扫描 32 个候选 |
| S02 | 合成不按键名字典序（跟着提交顺序走） | caught | **被抓**：seed.test.ts→seed/02 合成与提交顺序无关（任何一端都能独立复算）；seed.test.ts→seed/11 固定向量：复审可照抄复算 |
| S03 | 承诺不绑局号（第 N 局的承诺能冒充第 M 局） | caught | **被抓**：seed.test.ts→seed/01 承诺把 hand / party / 份额三者绑在一起；seed.test.ts→seed/08 揭示核对：一一对上才算通过 |
| S04 | 承诺不绑提交方 | caught | **被抓**：seed.test.ts→seed/01 承诺把 hand / party / 份额三者绑在一起；seed.test.ts→seed/09 承诺文本是单射的：改一个字符就换摘要（雪崩在这里体现为不可伪造） |
| S05 | 揭示核对不查承诺是否打得开 | caught | **被抓**：seed.test.ts→seed/08 揭示核对：一一对上才算通过 |
| S06 | 揭示允许多出从未承诺的家 | caught | **被抓**：seed.test.ts→seed/08 揭示核对：一一对上才算通过 |
| S07 | 合成允许同一家交两份份额 | caught | **被抓**：seed.test.ts→seed/07 非法份额输入一律抛错（含能造成拼接歧义的字符） |
| S08 | 种子只取 16 位（高位丢失、可穷举） | caught | **被抓**：seed.test.ts→seed/12 合成用的是完整 32 位（截断成 16 位会被这条抓到） |
| S09 | 份额长度下限放宽到 1 个 hex | caught | **被抓**：protocol.test.ts→proto/04 数值与长度越界一律拒 |
| S10 | 局号不做整数校验（0 / 小数也能合成） | caught | **被抓**：seed.test.ts→seed/07 非法份额输入一律抛错（含能造成拼接歧义的字符） |
| X06c | mark 不按局号过滤 + 开局不清 mark（两道门同时失守） | 存活 | 等价变异 — 等价（见 R06）：唯一可利用的窗口是"陈旧 seq ≤ 新局当前 seq"，而新局首推 seq=1，任何陈旧 mark 都大于它 ⇒ 快照 |
| X13b | 揭示自检去掉 + 出口编码也不校验（两道防御一起撤） | 存活 | 等价变异 — 等价（见 R13）：被撤掉的两条都是对"自己刚算出的值"的自检；可达输入下恒真 |
| X17b | 协议放行 seat + 房间采信 move.seat（两道门一起撤） | caught | **被抓**：protocol.test.ts→proto/02 未知 key 一律拒（顶层、嵌套 move、嵌套 view、rules 内部）；protocol.test.ts→proto/12 出口编码也过同一套校验：服务端构造出非法消息时本地就炸，不发到线上 |

合计 76 条：**caught 69**，存活 7 条（逐条给出可达性论证，见下）。

（C05 的锚点在 checkView 重构后失效，单独重跑过一次；C13 与 C12 是同一条变异，只列一次。）
```

存活的每一条都给出**可达性论证**（为什么任何可达输入下都没有可观测差异），而不是"没找到用例"；其中 R17 / R06 / R13 三条还额外用**组合变异**（X17b / X06c / X13b，把两道冗余门一起撤）检验了论证的前提 —— X17b 确实被 `room/05` 抓住，说明"等价"依赖的是协议层那道门，不是运气。

## 8.7 本轮真实修出的缺陷（测试逼出来的，不是美化）

1. `encodeFrame` 漏写 4 字节掩码键 ⇒ 掩码 XOR 从错误偏移开始，任何客户端帧都解不回（`frame/02` 的逐字节断言抓到）。
2. 握手用成了 SHA-256，且 GUID 记错一位（`E9A4` 应为 `E914`）⇒ 任何标准客户端都会拒（`crypto/05` + `frame/15` 的公开向量抓到；RFC 6455 规定的是 SHA-1）。
3. **广播没刷到别的连接**：一条上行引起的开局/他人行动只刷了发话那一条 socket ⇒ 其余客户端永远收不到局面。环线工装天然看不见这个洞（它每轮主动取队列），**只有真 socket 测试抓得到**（`ws/01`）。
4. nonce 缺席到点后只重挂定时器，不判"剔掉缺席者之后是否已齐" ⇒ 两人局永远不开（`room/10`）。
5. 中途加入/断线重连的客户端拿不到本局承诺与已结算局的揭示 ⇒ 局末无从核对（`room/17`、`ws/04`；另把"没承诺就不交份额"钉成 `client/01` 的断言）。
6. `reject` 消息的 `hand` 字段允许 0（协议 schema 要求 ≥1） ⇒ "没有在进行的一局"这种拒绝只能用 `error` 表达，不能塞个假局号（`room/13` 暴露）。

## 8.8 先逃后抓的盲区（第一版测试没盖住，补断言后才被变异抓住）

| 逃过的变异 | 为什么第一版看不见 | 补上的哨 |
|---|---|---|
| S08 种子只取 16 位 | 只断言"整数、在 uint32 内、彼此不同"，没用到高位 | `seed/12`（4096 组互不相同 + 最大值 > 0xffff） |
| P13 出口编码不校验 | 正常流服务端永远发合法消息，差异不可见 | `proto/12`（6 类非法消息必须在 encode 阶段抛） |
| C04 揭示不核对"用的就是那颗种子" | 只查份额自洽 ⇒ 事后可编一组自洽假份额 | `client/11`（自洽但 ≠ 发牌种子 ⇒ 必须报） |
| R18 未绑座也能行动 | 局面确实不动，缺的只是回执 | `room/19`（三条上行都得 `no_seat`） |
| R04 发牌后不取消 nonce 定时器 | 功能上被阶段门兜住，泄漏不可见 | `room/18`（每阶段待发定时器恒为 1） |

另外两处是我自己写测试时踩的坑，记下来免得再犯：
① 凭记忆写长十六进制公开向量不可靠（先后记错一条 56 字节 SHA-256 向量的后半段、百万 'a' 向量的第 21 位起、以及 WebSocket 的 GUID）⇒ 常量面收窄到能独立核对的三条，其余交给与 `node:crypto` 的逐条差分；
② 用编辑工具改长文件时，`old_string` 是一条 `test(...)` 标题而 `new_string` 忘了带上它，会把后面的用例体吊空（本轮犯了三次，每次都靠紧随其后的 `grep`/`tail` + `tsc --noEmit` 才发现）。

## 8.9 变更文件清单（相对 rev=7）

- **新增 `netx/` 8 个**：`sha256.ts`（纯 TS SHA-256）、`seed.ts`（commit-reveal 合成）、`protocol.ts`（消息契约 + 严格校验 + 防泄漏自检）、`frames.ts`（RFC6455 帧与握手，含纯 TS SHA-1）、`room.ts`（权威房间：承诺→收份额→合成→行动→自动结算→揭示→下一局；seq 快照与增量重连；托管定时器）、`client.ts`（不信任服务端的客户端会话）、`ws.ts`（`node:http` upgrade 接线）、`serve.ts`（房间入口）
- **新增 `test/` 11 个**：`netx-fixtures.ts`（虚拟时钟 + 环线工装 + 驱动）与 10 个 `netx-*.test.ts`
- **改动 1 个**：`tsconfig.json`（`include` 增加 `"netx/**/*.ts"`）
- **文档 4 个**：`TEST-OUTPUT.md`（本节）、`SELF-REVIEW.md`（rev=8 节）、`QUESTIONS.md`（Q4/Q5）、`DELIVERY.md`（rev=8）
- **刻意未动**：`src/**`、`webmin/**`、`webui/**`、`package.json`（无新依赖）、`test/` 既有 16 个测试文件与 `static.test.ts`

# 7 · rev=7 观感修正（牌面放大 + 座位环/按钮/日志重排；工单 §4 rev=7）

## 7.1 范围对照

现状（rev=6 交付时的实测）：牌位 21×28px、点数字号 10，用户在 1910 宽窗口下肉眼不可读。

| §4 rev=7 要求 | 落地 | 证据 |
|---|---|---|
| ① 牌面与字号显著放大（≥48×64、点数 ≥18，本人再大一档） | 对手 `CARD = 48×64`，牌角两行 `点数 20 / 花色 18`；本人 `OWN_CARD = 56×78`，`24 / 22`。三张牌扇形叠放（pitch 30），点数贴左上角 | `ui3/18`（从图元树量矩形与字号，不看常量表）；变异 N01/N02/N03 |
| ① 附带：叠放不许互相盖住读数 | 牌角拆成"点数一行 + 花色一行"（一行两字符在 20px 下约 32px，会爬过 30px 的露出区） | `ui3/23`（牌角必须待在本牌露出区内）；变异 N04/N13（这两条第一轮逃过，补断言后被抓） |
| ② 座位环 + 按钮/日志随之重排，2–6 家放得下 | 座位环：本人固定最下方 + 对手顶部横排均分宽度 + 五家以上两侧各让一枚；竖向预算：牌桌硬需求 → 底部条 → 按钮条，日志行数会为牌桌让位（最少 1 行）；按钮条列数吃满宽度 ⇒ 行数最少；装不下就走提示路径并说明"几家桌要多大" | `ui3/19`（2–6 家 × 4 视口：板数对得上、互不重叠、不越界、不压按钮也不压底部条）、`ui3/09c`、`ui3/19b`（极端候选数下只许二选一）；变异 N05–N07、N11、N12 |
| ③ 翻牌动画 / 暗牌不露 / 命中区与绘制同步 全部保持 | 翻牌门 `flipProgress(...) >= 0.5` 未动；`ui3/11` 的漏牌扫描加严到**单个点数或花色字符**（牌角变两行后，漏点会漏成单字）；命中区闭区间与 paint 几何逐字核对原样保留 | `ui3/10`、`ui3/11`、`ui3/11b`、`ui3/12`、`ui3/15–17`；变异 U06/U07/U11/U12/U13 |
| ④ 标准窗口截图经 OCR 能读出每张已亮牌 | 真 Canvas2D 出图两张（720×640 六人桌强制开牌、560×560 局中已看牌），并给出"图上应该读到什么"的逐张清单与场景量到的尺寸/字号集合 | `evidence/m7-cards-720x640.png`、`evidence/m7-min-viewport-560x560.png`、`evidence/m7-cards-readable.txt` |
| ④ 的落地方式：给机器一行它真吃得下的文本 | 桌面中央新增一行 ASCII 记法的"亮牌"文本行（`亮牌：你 7C TH KC 单张 / 电脑4 8C 3S KS 单张 / …`），由模型算好（`revealedHandsLine`/`handAscii`），场景只排版 | `ui/20`（逐张与 `handAscii` 对得上；没亮的一张都不许出现）、`ui3/24`（这行存在、字号 ≥12、不压座位板也不压按钮）；变异 Y01–Y05 |
| ④ 的前提：验收窗口里得真画出牌桌 | 页面框架从"写死 `calc(100vh - 92px)`"改成弹性布局 + 紧凑控制条；720×640 窗口里画布从 **694×529**（不足 560，会弹"窗口太小"）变成 **714×582** | `ui3/04b`（禁 `calc(100vh`；框架竖向预算 ≤80px）；变异 X01–X03 |

用例数 232 → **242**（+10 = `webui` 22→30 的 8 条新哨 + `webmin-model` 21→23 的 `ui/19`、`ui/20`）。
未删除任何既有用例；`ui3/11b`/`ui3/15`/`ui3/16`/`ui3/17` 的期望值按新牌角形态改写（"牌面字符数"→"点数图元数"，一张牌两个图元），断言语义不变。
`ui3/11` 的漏牌扫描反而加严：牌角拆成两行后漏点会漏成单个字符，所以除了成对写法还扫单字符。

## 7.2 命令与退出码

| # | 命令 | 结果 |
|---|---|---|
| 1 | `npm test` | exit=0，**242/242**（`RUNNER files=17 cases=242`；按文件：ai-honest 15 / classify 14 / compare 12 / deck 19 / edge 17 / engine-core 13 / engine-fuzz 6 / engine-illegal 13 / engine-money 10 / engine-project 12 / engine-scripts 9 / m2-fuzz 5 / rules 19 / static 14 / webmin-dealer 11 / **webmin-model 23** / **webui 30**） |
| 2 | 紧接着再跑一次 | exit=0，逐字节相同（7.3） |
| 3 | `npx tsc --noEmit` | exit=0 |
| 4 | `npm run build:ui` | exit=0，vite v8.3.1，`webui/dist/assets/*.js 42.20 kB`（gzip 15.60 kB） |
| 5 | `node webmin/serve.ts 8133`（零依赖通道） | `/webui/index.html` 可开；根路径仍指 M1.5 |
| 6 | 变异测试（`.verify/` 副本内跑） | 70 条，69 caught，见 7.6 |
| 7 | 真 Canvas2D 出图（临时取证服务器，`POST /save` 落 PNG） | 见 7.7 |

## 7.3 §0.5 双跑一致性证据

```
run1_exit=0 run2_exit=0
DIFF=IDENTICAL
898c46d03cb78b8bc513fec1710b1bcf34e41ceb4a9e5acf2c1de6f428240f72  run1
898c46d03cb78b8bc513fec1710b1bcf34e41ceb4a9e5acf2c1de6f428240f72  run2
```

## 7.4 关键输出原文（`npm test` 的 NOTES 段，跨轮可比）

```
RUNNER files=17 cases=242
UI19 待结算样本：phase=awaitingSettle 赢家=1
UI20 亮牌：你 8C 3S KS 单张 / 电脑1 5S TC 5H 对子 / 电脑3 QS 3H 7D 单张
UI307 结算行=5 日志行=12 点击=3 被拒=0
UI10 botSteps=253 raise=10 call=110 fold=43 look=77 compare=13
FUZZ-ai hands=1000 maxSteps=17 decisions=9262 look=1231 compare=117 有比牌的局=113 reasons=oneLeft=300 stakeCap=42 stall=658
```

本轮新增的三条读法：
- **`UI20 亮牌：…`** 是本轮新加的"给机器读"的文本行（扑克 ASCII 记法：7♣ → 7C）。同一行也是 `ui/20` 的断言对象：逐张与 `handAscii` 对得上，且没亮牌的座位一个都不许出现。为什么要 ASCII，见 7.7 的 OCR 实测。
- **`UI19 待结算样本：phase=awaitingSettle 赢家=1`** —— "待结算相位只许说应赢"这条口径的活证据：种子 20260925 的四人桌确实走到了 `terminal !== null && phase !== 'settled'` 这一刻，`ui/19` 在该样本上断言每家的 `resultText` 形如"应赢 N"且 N 与分池一致。
- **`UI307 点击=3 被拒=0`** 与 rev=6 同值：放大与重排没有改变任何一次真实点击的派发结果（渲染层改版不该动语义，这条是它的反证）。

## 7.5 尺寸对照（rev=6 → rev=7）

| 量 | rev=6 | rev=7 | 工单下限 |
|---|---|---|---|
| 别家牌面 | 21×28 | **48×64** | ≥48×64 |
| 别家点数 / 花色字号 | 10 / — | **20 / 18** | ≥18 |
| 本人牌面 | 21×28 | **56×78** | 再大一档 |
| 本人点数 / 花色字号 | 10 / — | **24 / 22** | ≥18 |
| 扇形叠放 pitch | 23 | 30（本人 60） | — |
| 座位板 | 150×62 | 对手 124×110 / 本人 352×94 | — |
| 720×640 窗口里的画布 | 694×529（会弹"窗口太小"） | **714×582** | ≥560×560 |

量法：`evidence/m7-cards-readable.txt` [4] 段（把 body 限宽 720 后读 header 实高 + `#stage` 内边距 + 画布边框；修前修后各测一次）。

## 7.6 变异全表（70 条，`.verify/` 副本内跑，跑完逐文件还原并核对内容哈希）

覆盖面 = V（显示侧防泄漏门，全量复跑）+ W（会话/服务侧）+ U（M3 渲染层，锚点按 rev=7 新几何全部重写）
+ **N（rev=7：尺寸下限 / 座位环重排 / 顶栏与椭圆夹取 / 折行与缩字号）**
+ **S（rev=7：结算信息搬到座位板）** + **X（rev=7：页面框架吃掉画布高度）** + **Y（rev=7：给 OCR 的亮牌文本行）** + C（AI 比牌里与本轮同文件的三条）。
D（选庄）/A（牌力与决策）两族本轮不重复计入：所指代码与 rev=6 逐字节相同，其 73 条全量表见下一节的 M3.6。
下面整段是扫描脚本的原始输出，未手工转写。

```
BASELINE(.verify) exit=0 pass=242 fail=0 变异条目数=70
V01 去掉 looked 门（rev=4 缺陷原形态） caught failCases=17 首个: FAIL ai-honest.test.ts :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）
V02 谁看过牌就向所有视角广播 caught failCases=9 首个: FAIL engine-project.test.ts :: project/11 负向：未看牌时整条 view 序列化后搜不到本人牌面
V03 门焊死：连已亮牌也不放行 caught failCases=25 首个: FAIL engine-project.test.ts :: project/03 强制开牌后：活跃家全部可见，弃牌/被淘汰者仍然 unknown
V04 与/或写反 caught failCases=25 首个: FAIL engine-project.test.ts :: project/03 强制开牌后：活跃家全部可见，弃牌/被淘汰者仍然 unknown
V05 looked 误写成 active caught failCases=17 首个: FAIL ai-honest.test.ts :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）
V06 viewer 写死成 -1 caught failCases=23 首个: FAIL engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
V07 整张手牌无条件放行 caught failCases=23 首个: FAIL ai-honest.test.ts :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）
V08 隐藏占位符退化成空串 caught failCases=2 首个: FAIL webmin-model.test.ts :: ui/16 一整局的可见性推进：局中暗牌、终局按规则亮
V09 可见性反向 caught failCases=22 首个: FAIL engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
V10 视图提前泄露 seed caught failCases=1 首个: FAIL engine-project.test.ts :: project/05 seed 只在结算后才暴露（否则任何客户端都能反算整副牌）
V11 剩两家比牌不开牌 caught failCases=2 首个: FAIL engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
V12 页面文案回到中英混排 caught failCases=1 首个: FAIL webmin-model.test.ts :: ui/15 页面接线：html 与各模块 import 路径都能被服务放行
W01 桌上总额漏算池 caught failCases=6 首个: FAIL webmin-model.test.ts :: ui/01 createSession 建立座位、首局与台账
W03 不剔除付不起底注的座位 caught failCases=2 首个: FAIL webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
W04 每局用同一份牌序 caught failCases=1 首个: FAIL webmin-model.test.ts :: ui/03 deriveSeed 确定、逐局不同、不用时钟
W08 未结算也能开下一局 caught failCases=2 首个: FAIL webmin-model.test.ts :: ui/07 乱点不崩：非法意图 ok:false 且指纹不变；整桌重来永远可点
W09 收桌后仍可继续行动 caught failCases=1 首个: FAIL webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
W11 座位行丢掉"本局已投入" caught failCases=1 首个: FAIL webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
W12 状态行丢掉池额 caught failCases=1 首个: FAIL webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
W13 放行任意扩展名 caught failCases=2 首个: FAIL webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
W14 取消目录白名单 caught failCases=2 首个: FAIL webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
W16 .ts 不做类型剥离 caught failCases=1 首个: FAIL webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
W17 取消项目根越界检查（rev=3 已裁定等价纵深） NOT-CAUGHT <<<< failCases=0 首个:
U01 没轮到真人时 reset 不再报合法 caught failCases=1 首个: FAIL webui.test.ts :: ui3/14b 没轮到真人时"整桌重来"仍报合法（U01 复发哨：灰按钮不许谎报会被拒）
U02 按钮清单丢掉灰候选 caught failCases=4 首个: FAIL webui.test.ts :: ui3/09c 竖向预算先给牌桌：候选 10 个时按钮条至多 3 行，座位板照旧不挤不越界（变异 U05 复发哨）
U03 按钮多行叠在同一 y caught failCases=5 首个: FAIL webui.test.ts :: ui3/09 scene 布局不变量：命中区与按钮一一对应、互不重叠、都在画布内（三种视口）
U04 最小视口检查失效 caught failCases=1 首个: FAIL webui.test.ts :: ui3/09b 低于最小视口时不做布局、只画提示，且不留下任何可点区（不装作能玩）
U05 列数不看宽度（按钮条吃高度） caught failCases=14 首个: FAIL webui.test.ts :: ui3/09 scene 布局不变量：命中区与按钮一一对应、互不重叠、都在画布内（三种视口）
U06 命中区边缘不可点 caught failCases=1 首个: FAIL webui.test.ts :: ui3/10 scene 命中测试：中心与四条边角都算命中，边界外 1px 不命中
U07 paint 漏画文本图元 caught failCases=1 首个: FAIL webui.test.ts :: ui3/12 paint 只执行图元：假 ctx 下调用次数与图元数一一对应
U08 seatCells 谎报隐藏位 caught failCases=6 首个: FAIL webmin-model.test.ts :: ui/20 亮牌文本行：ASCII 记法逐张对得上，且只列真亮出来的牌（验收④给机器的读法）
U09 座位行丢掉闷/明 caught failCases=1 首个: FAIL webmin-model.test.ts :: ui/16 一整局的可见性推进：局中暗牌、终局按规则亮
U10 状态行丢掉庄位规则 caught failCases=2 首个: FAIL webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
U11 翻牌进度门永远算已翻开 caught failCases=1 首个: FAIL webui.test.ts :: ui3/15 翻牌动画：进度过半之前一张牌面都不许出现，之后才亮
U12 翻牌进度门永远不放行 caught failCases=6 首个: FAIL webui.test.ts :: ui3/11b 看牌前后：整棵图元树从 0 张牌面变成正好 3 张（且就是本人那手）
U13 paint 把椭圆半径改成 0（牌桌消失） caught failCases=1 首个: FAIL webui.test.ts :: ui3/12 paint 只执行图元：假 ctx 下调用次数与图元数一一对应
U14 静态服务不再放行 webui 目录 caught failCases=1 首个: FAIL webui.test.ts :: ui3/13 静态服务放行 webui（不装 vite 也跑得起），根路径仍指向 M1.5
U15 vite 混进 dependencies caught failCases=2 首个: FAIL static.test.ts :: static/06 零运行时依赖：dependencies 必须为空（或整体不存在）
U16 webui 页面的庄家下拉少一档 caught failCases=1 首个: FAIL webui.test.ts :: ui3/04b 页面接线：开桌控件与 StartOptions 一一对应，庄家三档不许在 M3 这一版丢掉
U17 webui 入口写死庄家档位 caught failCases=1 首个: FAIL webui.test.ts :: ui3/04b 页面接线：开桌控件与 StartOptions 一一对应，庄家三档不许在 M3 这一版丢掉
U18 快照丢掉 settleSummary（结算块变空白） caught failCases=1 首个: FAIL webui.test.ts :: ui3/20 结算块不许盖住任何一张亮出来的牌（牌刚亮完就被盖住 = rev=7 要修的老毛病）
N01 牌面退回 rev=6 的 21×28 caught failCases=1 首个: FAIL webui.test.ts :: ui3/18 牌面放大：每张亮牌 ≥48×64、点数 ≥18px，本人手牌再大一档（工单 rev=7 ①）
N02 点数字号退回 10（牌面尺寸不动） caught failCases=1 首个: FAIL webui.test.ts :: ui3/18 牌面放大：每张亮牌 ≥48×64、点数 ≥18px，本人手牌再大一档（工单 rev=7 ①）
N03 本人手牌不再放大一档 caught failCases=1 首个: FAIL webui.test.ts :: ui3/18 牌面放大：每张亮牌 ≥48×64、点数 ≥18px，本人手牌再大一档（工单 rev=7 ①）
N04 牌角往牌中间放（会爬到邻牌脸上） caught failCases=1 首个: FAIL webui.test.ts :: ui3/23 牌角不许爬到邻牌脸上：每个点数/花色图元必须待在"自己那张牌露出来的那一条"里
N13 牌角退回"点数+花色"一行（叠放时跨牌） caught failCases=6 首个: FAIL webui.test.ts :: ui3/11b 看牌前后：整棵图元树从 0 张牌面变成正好 3 张（且就是本人那手）
N05 两侧让位判错家数（5 家就挤成三排） caught failCases=2 首个: FAIL webui.test.ts :: ui3/19 2–6 家都排得开：座位板数量对得上、互不重叠、不越界、不压按钮（工单 rev=7 ②）
N06 顶部横排不均分宽度（全叠在最左） caught failCases=3 首个: FAIL webui.test.ts :: ui3/09c 竖向预算先给牌桌：候选 10 个时按钮条至多 3 行，座位板照旧不挤不越界（变异 U05 复发哨）
N07 座位板不夹在画布内（贴边出界） caught failCases=2 首个: FAIL webui.test.ts :: ui3/09c 竖向预算先给牌桌：候选 10 个时按钮条至多 3 行，座位板照旧不挤不越界（变异 U05 复发哨）
N08 椭圆不夹顶栏（状态行被木轨盖住） caught failCases=1 首个: FAIL webui.test.ts :: ui3/21 顶栏不许被牌桌盖住：状态行是整句，被木轨吃掉就等于丢信息（rev=7 实测缺陷复发哨）
N09 状态行不缩字号（长句画到画布外） caught failCases=1 首个: FAIL webui.test.ts :: ui3/21 顶栏不许被牌桌盖住：状态行是整句，被木轨吃掉就等于丢信息（rev=7 实测缺陷复发哨）
N10 按钮不折行（长文案溢出压邻钮） caught failCases=1 首个: FAIL webui.test.ts :: ui3/22 按钮文案一个字都不许丢：折行只改行数，且每行都得待在自己那颗按钮里
N11 竖向预算不为牌桌让位（日志行数固定 6） caught failCases=4 首个: FAIL webui.test.ts :: ui3/09c 竖向预算先给牌桌：候选 10 个时按钮条至多 3 行，座位板照旧不挤不越界（变异 U05 复发哨）
N12 装不下时硬排（不走提示路径） caught failCases=1 首个: FAIL webui.test.ts :: ui3/19b 极端候选数下只许二选一：要么明说装不下，要么座位板/按钮/底部条互不重叠（不许硬排）
S01 座位板拿不到结果短句（resultText 恒空） caught failCases=1 首个: FAIL webmin-model.test.ts :: ui/19 结算信息一条不丢：每家的账就地进座位板，结算块只留原因与指纹（rev=7 ④的前提）
S02 没赢被写成赢（短句与整块对不上） caught failCases=1 首个: FAIL webmin-model.test.ts :: ui/19 结算信息一条不丢：每家的账就地进座位板，结算块只留原因与指纹（rev=7 ④的前提）
S03 摘要漏掉指纹行 caught failCases=1 首个: FAIL webmin-model.test.ts :: ui/19 结算信息一条不丢：每家的账就地进座位板，结算块只留原因与指纹（rev=7 ④的前提）
S04 未结算就宣布结果（settled 判定写死） caught failCases=1 首个: FAIL webmin-model.test.ts :: ui/19 结算信息一条不丢：每家的账就地进座位板，结算块只留原因与指纹（rev=7 ④的前提）
S05 结算块退回桌面中央（会压住刚亮的牌） caught failCases=1 首个: FAIL webui.test.ts :: ui3/20 结算块不许盖住任何一张亮出来的牌（牌刚亮完就被盖住 = rev=7 要修的老毛病）
X01 画布退回固定扣高 calc(100vh - 92px) caught failCases=1 首个: FAIL webui.test.ts :: ui3/04b 页面接线：开桌控件与 StartOptions 一一对应，庄家三档不许在 M3 这一版丢掉
X02 控制条内边距回到宽松版（把画布挤到 560 以下） caught failCases=1 首个: FAIL webui.test.ts :: ui3/04b 页面接线：开桌控件与 StartOptions 一一对应，庄家三档不许在 M3 这一版丢掉
X03 stage 不再吃掉剩余高度 caught failCases=1 首个: FAIL webui.test.ts :: ui3/04b 页面接线：开桌控件与 StartOptions 一一对应，庄家三档不许在 M3 这一版丢掉
Y01 亮牌行恒空（OCR 通道被关掉） caught failCases=2 首个: FAIL webmin-model.test.ts :: ui/20 亮牌文本行：ASCII 记法逐张对得上，且只列真亮出来的牌（验收④给机器的读法）
Y02 花色 ASCII 映射错位（♠ 被写成 H） caught failCases=2 首个: FAIL webmin-model.test.ts :: ui/20 亮牌文本行：ASCII 记法逐张对得上，且只列真亮出来的牌（验收④给机器的读法）
Y03 场景不画亮牌行 caught failCases=1 首个: FAIL webui.test.ts :: ui3/24 桌面中央的"亮牌"文本行：每张亮牌都在里面、字号够读、且不压任何座位板
Y04 亮牌行不按空档折行（画出画布） caught failCases=1 首个: FAIL webui.test.ts :: ui3/24 桌面中央的"亮牌"文本行：每张亮牌都在里面、字号够读、且不压任何座位板
Y05 亮牌行把没亮的牌也列进来 caught failCases=1 首个: FAIL webmin-model.test.ts :: ui/20 亮牌文本行：ASCII 记法逐张对得上，且只列真亮出来的牌（验收④给机器的读法）
C01 去掉分位资格线 0.75 caught failCases=1 首个: FAIL ai-honest.test.ts :: ai/09 只出合法行动、闷着绝不加注也绝不比牌、比牌必是合法目标（200 组随机合法集合）
C05 比牌目标选了投入最低者 caught failCases=1 首个: FAIL ai-honest.test.ts :: ai/13 比牌目标 = 活跃对手中已投入最高者；本局已比过则不再比
C06 并列时不按环形序而按座位号最大 caught failCases=1 首个: FAIL ai-honest.test.ts :: ai/13b 投入并列时按环形序选目标，而不是按座位号大小（变异 C06 复发哨）
```

结果：**70 条 → 69 caught、1 NOT-CAUGHT（W17）、0 SKIPPED（锚点未漂移）、0 CORRUPT**；12 个被改文件跑后逐条 `RESTORE … OK` 自证还原。

三条读法：

1. **W17 仍存活，且应当存活**（rev=3 已裁定的等价纵深，`REVIEW.md` D-5）：本轮把它也拉进来复跑，结论不变。
2. **七条是先逃后抓**（详见 7.8 第 5–11 条）：N04/N13（牌角爬到邻牌脸上）、N12（装不下还硬排 —— 真实快照走不到那条分支，
   得合成 18 候选的极端快照才测得动）、S02（板上短句与整块同源，写反了一起错）、S04（只测了新开局，没测待结算相位）、
   X02（预算式子里"一行控件高"估错，98px 的框架也判合格）、U05（列数不看宽度：rev=6 的"看剩余高度"断言在新预算下失效，改写后才抓）。
   本表是全部补完断言之后的重跑结果。
3. **N01/N02/N03 只有 `ui3/18` 抓、X01–X03 与 Y 族只有 `ui3/04b`/`ui/20`+`ui3/24` 抓**：
   它们的共同点是"行为一个字没变，只是看不清 / 机器读不出"。这类缺陷只能把观感翻译成可量的几何与文本约束来兜 ——
   也正是工单 rev=7 把验收写成"OCR 读得出"的用意。
## 7.7 真 Canvas2D 出图与逐张读牌（对齐验收④）

取证通道：临时服务器复用 `webmin/serve.ts` 的 `resolveStatic` 与同一条 `stripTypeScriptTypes`，只多一条
`POST /save` 用来落图（不属交付物，随 `.scratch/` 删除）。状态推进全部走页面真实通道
（`__zjh3.newGame(...)` → `__zjh3.click(intent)`，与点按钮同一条 dispatch → act → 引擎路径）。

| 图 | 局面 | 我从图上逐张读到的 | 场景量到的 |
|---|---|---|---|
| `evidence/m7-cards-720x640.png` | 6 人桌（5 机器人 / 种子 20260925 / 轮庄），真人看牌后一路跟注到强制开牌；台账 293/299/299/299/296/314 = 1800 守恒；指纹 `44d96b9f75084c0d` | 你 **7♣ T♥ K♣**（单张·没赢）；电脑4 **8♣ 3♠ K♠**（单张·没赢）；电脑5 **6♦ 6♥ 9♣**（对子·赢 18）；电脑1/2/3 是牌背 + 「··· · 没赢」 | plates=6 hits=8；牌面矩形 9 张；尺寸集合 {56×78, 48×64}；牌角 18 个图元，字号集合 {24, 22, 20, 18} |
| `evidence/m7-min-viewport-560x560.png` | 4 人桌（种子 4242）局中，真人刚点「看自己的牌」，注级 2 / 池 8 | 你 **8♥ Q♥ 6♦**（单张）；三家对手全是牌背 + 「···」 | plates=4 hits=8；三张 56×78 牌面 + 三张 56×78 牌背 |

### 我照验收④的方法真跑了一次 OCR（结论：花色字形读不出，ASCII 文本行读得出）

本机 `Windows.Media.Ocr` 只装了一个语言包 `zh-Hans-CN`（`AvailableRecognizerLanguages` 实测 = 1）。用它跑：

| 试过什么 | OCR 实际结果 |
|---|---|
| rev=6 的老图（牌 21×28、字号 10） | 牌面一个字符都读不出（与监督方 `user-shot.txt` 里"只剩一堆筹码数字"的定性一致） |
| rev=7 的牌面大字（48×64 上 20px、56×78 上 24px） | 花色字形 ♠♥♦ **一个都读不出**；点数零星读出（`8 3 k`） |
| 12 种牌角画法对照（一行/两行 × 20/24/28/32/36/44px × 有无牌面底） | 连 **44px 的 "7♣"** 都读不出 ⇒ 不是尺寸问题，是这个引擎不吃花色字形与孤立拉丁字符 |
| 把本人三张裁出来放大 3× | 0 个词 |
| 桌面中央那行 ASCII 记法 | **九张全读到**：`7C TH kC 单 张 ／ … 8C 3S kS 单 张 ／ … 6D 6H 9C 对 子`（K 被读成小写 k 是本引擎的大小写噪声） |

所以本轮把"给机器读"做成一条正常文本行（`revealedHandsLine`，扑克 ASCII 记法），而不是继续堆字形尺寸 ——
堆字形解决不了引擎不认字形的问题。牌面上的大字仍然保留（那是给人眼的，工单 ① 的下限由 `ui3/18` 钉着）。

三条如实声明：
- **本轮仍然没有"浏览器窗口本身的截图"**（不可见表面，同 rev=3–6）。上面两张是**页面真实渲染代码在真 Canvas2D 上下文里画出来、再由 `toBlob` 落盘的 PNG** —— 它证明"这套图元在这种尺寸下画出来长这样、读得出"，不证明窗口合成路径。
- **OCR 是我在这台机器上跑的**（同一个 `Windows.Media.Ocr` 引擎），不是监督方那一次；环境若不同（语言包、DPI）结果会有差异。上表每一行都给了可复跑的对象，不是我口头断言。
- 读表里"我逐张读到的"是多模态读图，不是 OCR；它与"场景量到的尺寸/字号/文本行"互为对照，任何一边造假都会露馅。

## 7.8 本轮发现的缺陷：四个产品 + 六处检测盲区 + 一条验收方法的实测结论

产品侧四个（前三个是看图看出来的，第四个是量验收窗口算术时发现的）：

1. **木轨椭圆顶穿顶栏** —— 台面半径只按座位环算，没算顶栏，导致状态行中间那截被棕色盖成空洞
   （"池 8 · 轮到 你 · 牌型判定 A2"消失）。→ 椭圆加"不越顶栏 / 不越底部条"夹取；哨 = `ui3/21`；变异 **N08**。
2. **本人的牌型与结果那行压在牌上** —— 它原本画在牌的正下方，而本人牌是 78px 高、板只有 94px。
   → 本人板改成"说明在左、牌在右"，那行回到左栏；顺带省 28px 竖向预算（6 人桌塞进 560 的关键）。哨 = `ui3/23` + `ui3/19`；变异 **N07**。
3. **结算块与台账同一行右对齐，6 人桌时叠字** —— "结束原因：…"长句和"你=293 电脑1=299…"糊在一起。
   → 结算块多占一行放台账。哨 = `ui3/20`；变异 **S05**。
4. **验收窗口会误报"窗口太小"** —— 页面写死 `#board{height:calc(100vh-92px)}`，控制条在 720 宽下换成两行，
   实测画布只有 694×529 < 560。复审班一打开看到的就是提示页而不是牌桌。
   → 弹性布局 + 紧凑控制条，复测 714×582。哨 = `ui3/04b`（禁 `calc(100vh`、框架预算 ≤80px）；变异 **X01–X03**。

检测侧六处先逃后抓（本轮变异面 65 条里有 6 条是第一版逃掉的，全部补了断言后重跑）：

5. **N04 牌角往牌中间放** / **N13 牌角退回一行两字符** —— 原断言只数"牌面矩形尺寸 + 点数字号"，
   完全看不出"读数爬到邻牌脸上"。补 `ui3/23`（牌角必须待在本牌露出区内），并因此把牌角拆成两行。
6. **N12 装不下时硬排（不走提示路径）** —— 真实候选数最多 10 个，那条保护分支在正常快照上永远走不到，
   于是"去掉保护"没有任何测试报红。补 `ui3/19b`：合成一个 18 候选的极端快照，断言"要么明说装不下，
   要么座位板/按钮/底部条互不重叠"——两条腿都堵死。
7. **S02 把"没赢"写成"赢"** —— 原来的 `ui/19` 只比对"板上短句 vs 整块那行"，两处同源，写反了一起错。
   补独立锚点：板上说"赢"的座位集合必须恰等于 `terminal.winners`，且金额等于该家在 `shares` 里的份额。
8. **S04 未结算就宣布实赢** —— 原来只测了"新开局 resultText 全空"（那时 `terminal === null`），
   没测"terminal 已生成但相位还是 awaitingSettle"。补一个真走到该相位的样本并断言短句必须是"应赢 N"。
9. **X02 控制条内边距回到宽松版** —— 我的预算式子里"一行控件高"估成 26px，实测是 44px，于是 98px 的框架也判合格。
   用实测值重算式子（46 = 控件行 44 + 画布边框 2），这条才报红。
10. **U05 的语义换了个方向** —— rev=6 的"列数看剩余高度"在 rev=7 的新预算下不再成立（列数吃满宽度、行数因此最少），
    我把 `ui3/09c` 改成断言"按钮条至多 3 行 + 座位板不挤不越界"，并让变异 U05（列数不看宽度）照样被抓。

验收方法上的一条实测结论（不是缺陷，但决定了本轮怎么做）：

11. **本机 OCR 引擎读不出花色字形，也读不太动孤立的拉丁单字符** —— 12 种牌角画法对照里连 44px 的 "7♣" 都读不出，
    3× 放大的清晰牌面读出 0 个词；而同一张图上"成行的文本"能读。所以"字再大"并不等于"机器读得出"，
    本轮因此补了一条 ASCII 记法的亮牌文本行（`ui/20` + `ui3/24` + 变异 Y01–Y05 兜住），
    让验收④有一个真的能跑通的通道；牌面大字继续服务人眼。

## 7.9 变更文件（相对 rev=6）

- **改动 6**：`webui/scene.ts`（尺寸表 + 座位环重排 + 竖向预算 + 牌角两行 + 折行/缩字号 + 亮牌行 + 导出 `plates`/`strip`）、
  `webui/bridge.ts`（快照加 `settleSummary`、`revealedLine`）、`webui/index.html`（弹性布局 + 紧凑控制条）、
  `webmin/model.ts`（`SeatCell.resultText` + `settlementSummary` + `revealedHandsLine`/`handAscii` + 结果文案单一出处 `outcomeOf`）、
  `test/webui.test.ts`、`test/webmin-model.test.ts`
- **新增 3**：`evidence/m7-cards-720x640.png`、`evidence/m7-min-viewport-560x560.png`、`evidence/m7-cards-readable.txt`
- **刻意未动**：`src/**`（引擎、规则、cards、AI 与 rev=6 逐字节相同）、`webmin/{app.ts,serve.ts,index.html}`、
  `webui/{main.ts,paint.ts}`、`package.json`、`tsconfig.json`、`vite.config.ts`
- **不入清单**：`node_modules/`、`webui/dist/`、`package-lock.json`、`.scratch/`（取证临时目录，交付前删除）、监督方文件
- 文档：`SELF-REVIEW.md`（新增 7-A…7-E，rev=6 起改称附录）、`TEST-OUTPUT.md`（本节）、`DELIVERY.md`（rev=7，最后原子写）

# 附录：rev=6（M3 · 正式 UI + AI 主动比牌）测试记录原文

# M3 · 正式 UI（Vite + Canvas 拟物牌桌；工单 §4 M3）

## M3.1 范围对照

| §4 M3 要求 | 落地 | 证据 |
|---|---|---|
| Vite + Canvas | `webui/{index.html,main.ts}` + `vite.config.ts`（root 指 `webui/`，产物落 `webui/dist/`）；`npm run dev:ui` / `build:ui` / `preview:ui` 三条都通。**同时保留零依赖通道**：`webmin/serve.ts` 直接放行 `/webui/*`（`.ts` 由服务端做类型剥离），不装 vite 也打得开 | 命令表 M3.2 第 4/5 行；`ui3/13`（不放行 vite 也跑得起，且根路径仍指 M1.5）；`evidence/m3-table-canvas.txt` [5] |
| 只渲染 + 发意图，绝不自己判规则 | 四层拆开：`bridge`（模型→结构化快照）、`scene`（快照 + 视口 + 样式 + 动画进度 → 图元 + 命中区，纯函数）、`paint`（图元→Canvas2D，无判定）、`main`（唯一碰 DOM 与时钟的入口，只发意图） | `ui3/01`（import 面只许 `./` 与 `../webmin/model.ts`）、`ui3/02`（bridge/scene/paint 禁 DOM/时钟/`legalActions(`、`checkAction(`、`classify(`、`actionCost(`、`presets.`、`startHand(`；入口层另禁四个判定符）、`ui3/14`（灰按钮真点了必被引擎拒 ⇒ UI 没留后门） |
| vite 仅 devDependencies；`dependencies` 仍空；`npm test` 纯净不变；`package-lock` 不入清单 | `dependencies = {}`，`devDependencies = {@types/node, typescript, vite@^8.3.1}`；`npm test` 仍是 `node test/run.ts`，不经 vite；`webui/dist/` 与 `package-lock.json` 不入 manifest | `static/06`（deps 必空）、`static/07`（允许 vite 但只许在 devDependencies）、变异 **U15**（把 vite 塞进 dependencies ⇒ 抓） |
| AI 主动比牌：资格 = 已看牌 且 分位 ≥ 0.75 且比牌合法 | `src/ai/honest.ts` 的比牌分支四道门：`known && strength >= COMPARE_AT && target !== null(来自调用方给的合法目标) && !alreadyCompared(view.log) && roll < COMPARE_TRIGGER` | `ai/09`（200 组随机合法集合：只出合法行动、闷着绝不加注也绝不比牌、比牌必是合法目标）、`ai/13` |
| 约 15% 触发、禁 `Math.random`、回放确定 | `compareRoll(seq, seat)` = mulberry32 派生 ‱ 掷点（`v % 1000 < 150`），只由 `view.seq` 与座位决定 | `ai/12`（1000 个 seq 实测 **14.6%**）、`ai/14`（同输入同结果、同 seq 换座位换结果）、`ai/10`（`decideAi` 仍是纯函数）；`static/13` 继续把 `Math.random` 钉成 0 命中 |
| 同局每家 AI 至多发起 1 次 | `alreadyCompared(view, seat)` 从 `view.log` 里数本家已发起过的 compare | `ai/13`（写入一条已比牌日志 ⇒ 本局不再比）；`m2/02` 的 1000 局里每局最多一次的计数断言 |
| 目标 = 活跃对手中 `committed` 最高者 | `bestCompareTarget`：只在调用方给的合法 compare 目标里挑，并列时取环形序上距庄家下家最近的一个 | `ai/13`（投入最高者）、`ai/13b`（**并列时按环形序**，故意让"座位号最大"成为错答案）、变异 **C05/C06** |
| 原 `ai/09`、`m2/02` 的"AI 0 次比牌"断言 → 正向频率断言 | `ai/09` 改为"比牌必合法 + 频率上界"；`m2/02` 输出并断言 `compare>0`、`有比牌的局>0`、且不超上界 | `FUZZ-ai hands=1000 … compare=117 有比牌的局=113`、`AI09 compare=1/200 组（其中有资格比牌的才 9 组）`、`FUZZ-random … compare=0`（随机臂仍为 0，因为随机臂不挑比牌资格） |
| 变异覆盖新分支 | C01–C09 九条（资格线 / 每局上限 / 触发率归零与拉满 / 目标选错 / 并列序 / 掷点忽略座位 / 掷点改非确定 / 资格线抬到不可达）+ U16/U17 两条页面接线 | 全表见 M3.6 |
| 最小视口 560×560 维持不降；无头 `hitAt` 边界测试照留 | `MIN_VIEWPORT = 560×560` 原样保留；低于它不做布局、只画带当前尺寸的提示、**不留任何可点区**；`hitAt` 边界为闭区间 | `ui3/09b`、`ui3/10`（中心 + 四角都算命中、边界外 1px 不命中）；`evidence` [1]（真实内嵌面板 492×466 走的就是这条提示路径） |
| 用户决策：拟物牌桌（椭圆绿呢桌面 + 环形座位 + 翻牌动画） | `TABLE_STYLE` 调色板；两个嵌套椭圆（木色外轨 + 绿呢台面 + 台沿描边）；座位板沿椭圆环按角度均布，每家三个牌位；`cardBack`/`cardFace` 分开画；翻牌进度 `flipProgress(anim, seat)` 由入口传时钟入参，`scene` 保持纯函数 | `ui3/08`（纯函数逐字节同）、`ui3/11`/`ui3/11b`（0 张牌面 → 正好 3 张且就是本人那手）、`ui3/15`（进度过半前一张都不许出现）、`ui3/16`/`ui3/17`（进度是入参、漏记视为已翻开、换局重新起算）；`evidence` [2] 真像素落点 |
| M3 沿用同一套庄家配置 | `webui/index.html` 三档下拉 + `bridge.start()` 传 `dealerNext` + 状态行回显档位 | `ui3/04`（三档开得出桌并回显）、`ui3/04b`（控件与 `StartOptions` 一一对应、下拉值集合恰为 `DEALER_NEXT_IDS`）；变异 **U16**（下拉少一档）、**U17**（入口写死档位） |

用例数 206 → **232**（+26 = `webui` 22 例全新 + `ai/12,13,13b,14` 4 例）。未删除任何既有用例；
`ai/09` 与 `m2/02` 按工单要求从"0 次比牌"改写为正向频率断言（同一用例编号内改写，不新增不删除）。

## M3.2 命令与退出码

| # | 命令 | 结果 |
|---|---|---|
| 1 | `npm test` | exit=0，**232/232**（`RUNNER files=17 cases=232`；按文件：ai-honest 15 / classify 14 / compare 12 / deck 19 / edge 17 / engine-core 13 / engine-fuzz 6 / engine-illegal 13 / engine-money 10 / engine-project 12 / engine-scripts 9 / m2-fuzz 5 / rules 19 / static 14 / webmin-dealer 11 / webmin-model 21 / **webui 22**） |
| 2 | 紧接着再跑一次 | exit=0，逐字节相同（M3.3） |
| 3 | `npx tsc --noEmit` | exit=0（`include` 已扩到 `webui/**/*.ts`） |
| 4 | `npm run build:ui` | exit=0，`vite v8.3.1`，`✓ 17 modules transformed`，`webui/dist/index.html 2.27 kB` + `assets/*.js 38.54 kB`（gzip 14.07 kB） |
| 5 | `npx vite --port 5199 --strictPort`（等价 `npm run dev:ui`） | `VITE v8.3.1 ready`；`GET /` → 200、`GET /main.ts` → 200（转换后模块里确实引用 `scene.ts`）；用完即关 |
| 6 | `node webmin/serve.ts 8133`（零依赖通道） | `GET /webui/index.html` 可开；`/` 仍 302 → `/webmin/index.html` |
| 7 | 变异测试（`.verify/` 副本内跑） | 73 条，72 caught，见 M3.6 |

## M3.3 §0.5 双跑一致性证据

```
run1_exit=0 run2_exit=0
DIFF=IDENTICAL
b18e1b0c66d4d9c17437cd67fef00c643d4697d576f2aff02456abd53704cf0d  run1
b18e1b0c66d4d9c17437cd67fef00c643d4697d576f2aff02456abd53704cf0d  run2
```

（连跑两次是 `RUNNER files=17 cases=232 / SUMMARY pass=232 fail=0 / RESULT=ALL_PASS` 的逐字节对照；
`evidence/m3-table-canvas.txt` 里那两处指纹 `7642888e45cfcb8c` 是另一回事 —— 它是**游戏状态**指纹，
证明同一局经浏览器路径与纯 bridge 路径演算得到同一个状态。）

## M3.4 关键输出原文（`npm test` 的 NOTES 段，跨轮可比）

```
RUNNER files=17 cases=232
AI09 compare=1/200 组（其中有资格比牌的才 9 组）
AI12 trigger=14.6% over 1000 seqs
AI-CALIB max|est-true|=0.3pp over 24 anchors
AI02 tier-percentile max diff=0.27pp
FUZZ-ai hands=1000 maxSteps=17 decisions=9262 look=1231 compare=117 有比牌的局=113 reasons=oneLeft=300 stakeCap=42 stall=658
FUZZ-random hands=1000 maxSteps=21 decisions=0 look=0 compare=0 有比牌的局=0（decisions/look/compare 只统计 decideAi 的决策，随机臂不经过 AI ⇒ 恒为 0，不是"随机臂不打比牌"） reasons=oneLeft=804 stakeCap=189 stall=7
UI10 botSteps=253 raise=10 call=110 fold=43 look=77 compare=13
UI307 结算行=5 日志行=12 点击=3 被拒=0
```

三条读法：
- **`compare=117` 分布在 `有比牌的局=113` 局里**：1000 局 AI 臂里，比牌几乎不"同局重复"（比值 ≈ 1.04 次/局），正是"每家每局至多 1 次"的门在起作用；`m2/02` 同时断言每局每家不超过 1 次。
- **`AI12 trigger=14.6%`** 是 1000 个连续 `seq` 上量出来的实际触发率，对着 `COMPARE_TRIGGER=150`（‱ 制，理论 15%）；`ai/14` 另证它只由 `seq` + 座位决定，换座位换结果 ⇒ 可重放。
- **`UI307 被拒=0`**：M3 页面在真浏览器里连打一整局、3 次真实点击全部被引擎接受（灰按钮一个都没点），结算 5 行、日志 12 行。这是"UI 只发意图"的实测面，与 `ui3/14` 的机检面互为对照。

## M3.5 无头边界测试清单（复审班真鼠标终审之前的替身）

| 不变量 | 用例 |
|---|---|
| scene 是纯函数：同输入逐字节同；不给动画时直接终态（绝不卡在"翻一半"） | `ui3/08`、`ui3/16` |
| 命中区与按钮一一对应、互不重叠、都在画布内（560×560 / 960×620 / 1600×900 三种视口） | `ui3/09` |
| 低于最小视口 ⇒ 只画提示、0 个可点区、提示里带当前尺寸 | `ui3/09b` |
| 候选一多（10 个按钮）⇒ 画布变矮必须多分列，且仍不出界、不重叠 | `ui3/09c` |
| `hitAt` 闭区间：中心 + 四条边角都命中，边界外 1px 不命中 | `ui3/10` |
| 牌面图元数量随可见性推进：开局 0 张、看牌后正好 3 张、强制开牌后各家都亮 | `ui3/11`、`ui3/11b`、`ui3/15` |
| 翻牌动画进度过半之前一张牌面都不许出现 | `ui3/15` |
| 未看牌的别家牌面搜遍整棵图元树都找不到（rev=4 口径在渲染层再钉一遍） | `ui3/11` + `webmin-model` 的 `ui/18` |
| 灰按钮点了必被引擎拒、且灰/绿不改变状态指纹（验收③） | `ui3/14`、`ui3/14b` |
| paint 只搬运图元：调用次数一一对应，且几何参数逐字不改写 | `ui3/12` |

## M3.6 变异全表（73 条，`.verify/` 副本内跑，跑完还原并核对 sha256）

覆盖面 = V（rev=4 显示侧的门，确认没被 M2/M3 冲掉）+ W（会话/服务侧仍成立的 13 条）+ D（庄家三档）+ A（诚实 AI）
+ **C（AI 主动比牌，M3 新增 9 条）** + **U（M3 渲染层与页面接线，M3 新增 17 条）**。
下面整段是扫描脚本的原始输出，未手工转写。

```
BASELINE(.verify) exit=0 pass=232 fail=0 变异条目数=73
V01 去掉 looked 门（rev=4 缺陷原形态） caught   failCases=16 首个: test/ai-honest.test.ts :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）
V02 谁看过牌就向所有视角广播 caught   failCases=9 首个: test/engine-project.test.ts :: project/11 负向：未看牌时整条 view 序列化后搜不到本人牌面
V03 门焊死：连已亮牌也不放行 caught   failCases=21 首个: test/engine-project.test.ts :: project/03 强制开牌后：活跃家全部可见，弃牌/被淘汰者仍然 unknown
V04 与/或写反 caught   failCases=21 首个: test/engine-project.test.ts :: project/03 强制开牌后：活跃家全部可见，弃牌/被淘汰者仍然 unknown
V05 looked 误写成 active caught   failCases=16 首个: test/ai-honest.test.ts :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）
V06 viewer 写死成 -1 caught   failCases=19 首个: test/engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
V07 整张手牌无条件放行 caught   failCases=22 首个: test/ai-honest.test.ts :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）
V08 隐藏占位符退化成空串 caught   failCases=2 首个: test/webmin-model.test.ts :: ui/16 一整局的可见性推进：局中暗牌、终局按规则亮
V09 可见性反向 caught   failCases=21 首个: test/engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
V10 视图提前泄露 seed caught   failCases=1 首个: test/engine-project.test.ts :: project/05 seed 只在结算后才暴露（否则任何客户端都能反算整副牌）
V11 剩两家比牌不开牌 caught   failCases=2 首个: test/engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
V12 页面文案回到中英混排 caught   failCases=1 首个: test/webmin-model.test.ts :: ui/15 页面接线：html 与各模块 import 路径都能被服务放行
W01 桌上总额漏算池 caught   failCases=6 首个: test/webmin-model.test.ts :: ui/01 createSession 建立座位、首局与台账
W03 不剔除付不起底注的座位 caught   failCases=2 首个: test/webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
W04 每局用同一份牌序 caught   failCases=1 首个: test/webmin-model.test.ts :: ui/03 deriveSeed 确定、逐局不同、不用时钟
W08 未结算也能开下一局 caught   failCases=2 首个: test/webmin-model.test.ts :: ui/07 乱点不崩：非法意图 ok:false 且指纹不变；整桌重来永远可点
W09 收桌后仍可继续行动 caught   failCases=1 首个: test/webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
W10 待结算时不给结算按钮 caught   failCases=8 首个: test/webmin-model.test.ts :: ui/05 真人+机器人打完一整局：走到结算，台账守恒
W11 座位行丢掉"本局已投入" caught   failCases=1 首个: test/webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
W12 状态行丢掉池额 caught   failCases=1 首个: test/webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
W13 放行任意扩展名 caught   failCases=2 首个: test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
W14 取消目录白名单 caught   failCases=2 首个: test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
W15 根路径不再重定向 caught   failCases=2 首个: test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
W16 .ts 不做类型剥离 caught   failCases=1 首个: test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
W17 取消项目根越界检查 NOT-CAUGHT <<<< failCases=0 首个:
D01 winner 档无视余数归属 caught   failCases=1 首个: test/webmin-dealer.test.ts :: dealer/03 winner：平局分池先给拿到余数的那位，无余数才按环形最近
D02 winner 档把全桌当赢家 caught   failCases=2 首个: test/webmin-dealer.test.ts :: dealer/02 winner：单赢家通吃即该赢家坐庄
D03 loser 档取成赢家集合 caught   failCases=2 首个: test/webmin-dealer.test.ts :: dealer/04 loser：非赢家中距庄家下家最近者；其离桌则环形顺延到下一家输家
D04 环形序方向反了 caught   failCases=5 首个: test/webmin-dealer.test.ts :: dealer/01 rotate：庄家的下家接任（手推座位号）
D05 rotate 退化成座位号最小者 caught   failCases=3 首个: test/webmin-dealer.test.ts :: dealer/01 rotate：庄家的下家接任（手推座位号）
D06 loser 档无在桌输家时不给兜底 caught   failCases=1 首个: test/webmin-dealer.test.ts :: dealer/05 loser 档无在桌输家时退回轮庄（Q2 已裁定 A）
D07 createSession 无视 dealerNext caught   failCases=7 首个: test/webmin-dealer.test.ts :: dealer/07 createSession：三档都合法、默认 rotate、非法值抛 TypeError
D08 新一局沿用上局庄家 caught   failCases=1 首个: test/webmin-model.test.ts :: ui/08 再来一局：局号 +1、庄家轮转到下家、总额守恒
D09 整桌重来丢掉庄家规则档位 caught   failCases=1 首个: test/webmin-model.test.ts :: ui/11b 整桌重来要请回破产离桌的人，并保留庄家规则档位（M2 实测抓到的两个缺陷）
D10 整桌重来用被裁过的名册 caught   failCases=2 首个: test/webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
A01 分位表倒置 caught   failCases=12 首个: test/ai-honest.test.ts :: ai/01 牌力先验表 = 22100 手全枚举的事实
A02 从不认为自己没看牌 caught   failCases=8 首个: test/ai-honest.test.ts :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）
A03 去掉档内归一化 caught   failCases=1 首个: test/m2-fuzz.test.ts :: m2/05 牌力分位 ≈ 真实胜率，且档内端点随 a23 正确移动（两 preset 全枚举对拍）
A04 高牌最小端点推错成 7-4-2 caught   failCases=1 首个: test/ai-honest.test.ts :: ai/06 池赔率真的进了决策：同一副牌，池给得大方就跟、池小就弃
A05 加注阈值降到 0.5 caught   failCases=1 首个: test/ai-honest.test.ts :: ai/05 看过牌后才按牌力决策：强牌加注、中带跟、烂牌弃
A06 对手数量不折价 caught   failCases=1 首个: test/ai-honest.test.ts :: ai/07 对手数量真的进了决策：同一副牌同一赔率，人越多越保守
A07 池赔率恒为 0 caught   failCases=3 首个: test/ai-honest.test.ts :: ai/05 看过牌后才按牌力决策：强牌加注、中带跟、烂牌弃
A08 永不主动转明 caught   failCases=7 首个: test/ai-honest.test.ts :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关（真实投影，不是假 View）
A09 比牌无条件放行（绕过资格线） caught   failCases=4 首个: test/ai-honest.test.ts :: ai/09 只出合法行动、闷着绝不加注也绝不比牌、比牌必是合法目标（200 组随机合法集合）
A10 闷着先验抬成 0.95 caught   failCases=1 首个: test/ai-honest.test.ts :: ai/10 纯函数：同一输入两次调用结果逐字相同（fuzz 与回放的前提）
A11 偷看注入（只有 static/13 能抓） caught   failCases=1 首个: test/static.test.ts :: static/13 src/ai 只用投影信息：越界引用与运行时依赖一律为 0 命中
A12 静态钉失效：AI 里 import 引擎状态 caught   failCases=1 首个: test/static.test.ts :: static/13 src/ai 只用投影信息：越界引用与运行时依赖一律为 0 命中
C01 去掉分位资格线 0.75 caught   failCases=1 首个: test/ai-honest.test.ts :: ai/09 只出合法行动、闷着绝不加注也绝不比牌、比牌必是合法目标（200 组随机合法集合）
C02 去掉"每局每家至多 1 次"上限 caught   failCases=2 首个: test/ai-honest.test.ts :: ai/13 比牌目标 = 活跃对手中已投入最高者；本局已比过则不再比
C03 触发率归零（比牌成死代码） caught   failCases=5 首个: test/ai-honest.test.ts :: ai/09 只出合法行动、闷着绝不加注也绝不比牌、比牌必是合法目标（200 组随机合法集合）
C04 触发率拉满（够格就必比） caught   failCases=1 首个: test/webmin-model.test.ts :: ui/16 一整局的可见性推进：局中暗牌、终局按规则亮
C05 目标选了投入最低者 caught   failCases=1 首个: test/ai-honest.test.ts :: ai/13 比牌目标 = 活跃对手中已投入最高者；本局已比过则不再比
C06 并列时不按环形序而按座位号最大 caught   failCases=1 首个: test/ai-honest.test.ts :: ai/13b 投入并列时按环形序选目标，而不是按座位号大小（变异 C06 复发哨）
C07 掷点忽略座位（全桌齐步走） caught   failCases=2 首个: test/ai-honest.test.ts :: ai/12 比牌触发率 = 1000 个 seq 上量得出来，且完全由 seq+座位决定（可重放）
C08 掷点改成非确定性随机源 caught   failCases=6 首个: test/ai-honest.test.ts :: ai/09 只出合法行动、闷着绝不加注也绝不比牌、比牌必是合法目标（200 组随机合法集合）
C09 比牌资格线抬到 1.01（永远不够格） caught   failCases=5 首个: test/ai-honest.test.ts :: ai/09 只出合法行动、闷着绝不加注也绝不比牌、比牌必是合法目标（200 组随机合法集合）
U01 没轮到真人时 reset 不再报合法 caught   failCases=1 首个: test/webui.test.ts :: ui3/14b 没轮到真人时"整桌重来"仍报合法（U01 复发哨：灰按钮不许谎报会被拒）
U02 按钮清单丢掉灰候选 caught   failCases=2 首个: test/webui.test.ts :: ui3/09c 按钮条吃高度：候选一多，矮画布必须多分列（变异 U05 复发哨）
U03 按钮多行叠在同一 y caught   failCases=2 首个: test/webui.test.ts :: ui3/09 scene 布局不变量：命中区与按钮一一对应、互不重叠、都在画布内（三种视口）
U04 最小视口检查失效 caught   failCases=1 首个: test/webui.test.ts :: ui3/09b 低于最小视口时不做布局、只画提示，且不留下任何可点区（不装作能玩）
U05 列数不看剩余高度 caught   failCases=1 首个: test/webui.test.ts :: ui3/09c 按钮条吃高度：候选一多，矮画布必须多分列（变异 U05 复发哨）
U06 命中区边缘不可点 caught   failCases=1 首个: test/webui.test.ts :: ui3/10 scene 命中测试：中心与四条边角都算命中，边界外 1px 不命中
U07 paint 漏画文本图元 caught   failCases=1 首个: test/webui.test.ts :: ui3/12 paint 只执行图元：假 ctx 下调用次数与图元数一一对应
U08 seatCells 谎报隐藏位 caught   failCases=2 首个: test/webui.test.ts :: ui3/03 bridge：开桌后快照结构化，未看牌 ⇒ 每一行都是隐藏位
U09 座位行丢掉闷/明 caught   failCases=1 首个: test/webmin-model.test.ts :: ui/16 一整局的可见性推进：局中暗牌、终局按规则亮
U10 状态行丢掉庄位规则 caught   failCases=2 首个: test/webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
U11 翻牌进度门永远算已翻开 caught   failCases=1 首个: test/webui.test.ts :: ui3/15 翻牌动画：进度过半之前一张牌面都不许出现，之后才亮
U12 翻牌进度门永远不放行 caught   failCases=4 首个: test/webui.test.ts :: ui3/11b 看牌前后：整棵图元树从 0 张牌面变成正好 3 张（且就是本人那手）
U13 paint 不画椭圆（牌桌消失） caught   failCases=1 首个: test/webui.test.ts :: ui3/12 paint 只执行图元：假 ctx 下调用次数与图元数一一对应
U14 静态服务不再放行 webui 目录 caught   failCases=1 首个: test/webui.test.ts :: ui3/13 静态服务放行 webui（不装 vite 也跑得起），根路径仍指向 M1.5
U15 vite 混进 dependencies（破坏零运行时依赖） caught   failCases=2 首个: test/static.test.ts :: static/06 零运行时依赖：dependencies 必须为空（或整体不存在）
U16 webui 页面的庄家下拉少一档 caught   failCases=1 首个: test/webui.test.ts :: ui3/04b 页面接线：开桌控件与 StartOptions 一一对应，庄家三档不许在 M3 这一版丢掉
U17 webui 入口写死庄家档位（下拉成摆设） caught   failCases=1 首个: test/webui.test.ts :: ui3/04b 页面接线：开桌控件与 StartOptions 一一对应，庄家三档不许在 M3 这一版丢掉
RESTORE src/engine/project.ts OK
RESTORE src/engine/actions.ts OK
RESTORE src/ai/honest.ts OK
RESTORE webmin/model.ts OK
RESTORE webmin/serve.ts OK
RESTORE webmin/index.html OK
RESTORE webui/scene.ts OK
RESTORE webui/paint.ts OK
RESTORE webui/index.html OK
RESTORE webui/main.ts OK
RESTORE package.json OK
```

结果：**73 条 → 72 caught、1 NOT-CAUGHT（W17）、0 SKIPPED（锚点未漂移）、0 CORRUPT**；11 个被改文件跑后逐条 `RESTORE … OK` 自证还原。

三条读法：

1. **W17 仍存活，且应当存活**（rev=3 已裁定的等价纵深，`REVIEW.md` D-5）：`webmin/serve.ts` 里"必须落在项目根内"这一句，
   被它前面的"目录白名单 + 扩展名白名单 + 路径规范化"三道一起吃掉了 —— 取消它没有可达的反例。
   本轮不为了让表格好看去补一条假断言。
2. **三条是先逃后抓**（这正是"全量复跑"而不是"只跑新增"的价值）：
   **C06**（比牌并列时按座位号最大）第一版逃过 —— `ai/13` 一个并列样本都没有；
   **U05**（列数不看剩余高度）rev=5 时还能被 `ui3/09` 抓到，拟物牌桌改版后**退化成抓不到**，
   因为默认快照只有 5 个候选按钮、高度预算永远不吃紧；
   **U13**（把台面椭圆半径改成 0 ⇒ 牌桌消失）逃过是因为 `ui3/12` 原来只数"调了几次哪个方法"。
   三条分别补了 `ai/13b`、`ui3/09c`、`ui3/12` 的几何逐字核对 —— 本表是补完之后重跑的结果（缺陷记录见 M3.8 第 4–6 条）。
3. **U16/U17 只有 `ui3/04b` 能抓**：页面 HTML 的下拉少一档、或入口把档位写死成 `rotate`，
   行为测试全绿（三档在 bridge 层照样通），只有"控件 ↔ `StartOptions` 一一对应"这条接线检查会红。
   同族先例是 rev=5 的 A11（只有 `static/13` 能抓）。
## M3.7 真浏览器实测（零依赖通道 `node webmin/serve.ts 8133`；vite 通道见 M3.2 第 4/5 行）

原文逐字保留在 `evidence/m3-table-canvas.txt`，五段：

| 段 | 内容 | 结论 |
|---|---|---|
| [1] | 真实内嵌面板视口 492×466 < `MIN_VIEWPORT` ⇒ 走提示路径 | 0 个可点区、提示里带 `492×466`；与 `ui3/09b` 同口径（工单已裁定 560×560 不降） |
| [2] | 同一份代码在 960×620 真 Canvas2D 上画牌桌（离屏 canvas + 页面真实的 `scene`/`paint` 模块） | 54 图元 / 2 椭圆 / 30 文本 / 8 命中区 / 9 个牌背；调色板**实际落点像素数**：木轨 1631、绿呢 5897、座位板 10407、牌背 1080、绿钮 29971 ⇒ 不是只有图元列表 |
| [3] | 开局未看牌三家全隐藏，且"已看牌的机器人"对真人仍藏着 | rev=4 口径在 M3 的渲染层成立（日志里 `#002 look 电脑1 闷→明` 紧跟 `#003 call … seen×stake`） |
| [4] | 在 M3 里真打完整一局（真人一律跟注，3 次真实点击、0 次被拒） | `phase=settled`、桌上总额 768 守恒、结算 5 行、强制开牌后台面 9 张牌面、两次独立加载同为指纹 `7642888e45cfcb8c` |
| [5] | Vite 构建与依赖纪律 | `vite v8.3.1`、17 modules、`dependencies = {}`、`npm test` 不经 vite |

**本轮仍未取得截图**：页面处于不可见表面（`visibilityState = hidden` → `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`），
不为凑图强行切换用户前台。因此观感（配色、留白、动画节奏）**不由本报告判定**，归用户/监督方真鼠标终审；
本轮能给的替身证据是 [2] 的像素落点计数与 `ui3/09–12` 的几何不变量。

## M3.8 本轮发现的缺陷：先逃后抓，全部补了哨兵

产品侧三个（前两个在 M3 开发过程中真撞到，第三个撞在验收通道上）：

1. **按钮条多行叠在同一 y** —— 拟物改版后命中区按 `(col,row)` 排，`row` 一度没进 `y` 的表达式，
   导致整条按钮条压在同一行：视觉上看不出来，但命中区互相重叠，点下面那个只会命中上面那个。
   哨 = `ui3/09`（一一对应 + 互不重叠 + 三种视口）；变异 = **U03**。
2. **灰按钮谎报会被拒** —— `整桌重来` 在"没轮到真人"时被算成非法项（画成灰的），而 `act()` 其实永远放行它；
   于是 UI 上出现了一个"看着不能点、点了却生效"的按钮，验收③的语义被破坏。
   修法：`intentOptions` 恒定追加 `RESET_OPTION` 且 `legal = true`。哨 = `ui3/14b`；变异 = **U01**（第一版逃过，补 `ui3/14b` 后被抓）。
3. **首帧挂在 `requestAnimationFrame` 上** —— 后台标签页不跑 rAF，M1.5/M2 起的浏览器验收通道恰恰是隐藏表面：
   页面加载后画布永远空白（不是"看不见动画"，是"根本没画过"）。
   修法：渲染同步执行，rAF 只在"有翻牌在飞"时排下一帧；另在 scene 侧钉死"不给动画入参就直接终态"（`ui3/16`），
   这样任何渲染时机都不会出现"永远卡在翻一半"。

检测侧三个盲区（变异先跑掉、补断言后才被抓 —— 记下来是因为它们说明断言写得太宽松）：

4. **C06 并列时不按环形序** —— `ai/13` 只测了"投入最高者"，两个对手投入相同的情况一个样本都没有 ⇒ 第一版逃过。
   补 `ai/13b`（座位故意撒到 0/3/7、庄家 7 号，使"座位号最大"恰好是错答案）。
5. **U05 列数不看剩余高度** —— rev=5 的变异面里这条本来能抓，拟物牌桌改版后**失效了**：
   默认快照只有 5 个候选按钮，任何视口下高度预算都不吃紧 ⇒ 改成高度盲了也测不出来。
   补 `ui3/09c`（造一桌 10 个候选，扫 560→900 五档高度，断言"变矮必须多分列"且仍不越界、不重叠）。
6. **U13 `paint` 把椭圆半径改成 0** —— 原 `ui3/12` 只数"调用了几次 ctx 的哪个方法"，
   于是"调用了 ellipse 但半径为 0"（牌桌直接消失）照样全绿。补几何逐字核对（画出来的 `cx/cy/rx/ry` 必须等于 scene 给的图元）+ 台面尺寸下限。

输出侧一条：

7. **`FUZZ-random … compare=0` 会被读成"随机臂从不打比牌"** —— 那两个计数器其实只统计 `decideAi` 的输出，
   随机臂不经过 AI，恒为 0；同因使 `maxComparePerSeat ≤ 1` 在随机臂上成了空断言。
   修法：NOTES 行里给随机臂加限定语，并把该断言收进 `arm === 'ai'` 分支（M3-C 第 12 条）。

## M3.9 变更文件（相对 rev=5）

- **新增 8**：`webui/bridge.ts`、`webui/scene.ts`、`webui/paint.ts`、`webui/main.ts`、`webui/index.html`、
  `vite.config.ts`、`test/webui.test.ts`、`evidence/m3-table-canvas.txt`
- **改动 12**：`src/ai/honest.ts`（比牌分支四道门 + `compareRoll`）、`webmin/model.ts`（`RESET_OPTION` 恒合法 + 注释去过期）、
  `webmin/app.ts`、`webmin/serve.ts`（放行 `webui`，根路径仍指 M1.5）、`package.json`（vite 进 devDependencies）、
  `tsconfig.json`（`include` 扩到 `webui/**/*.ts`）、`test/{ai-honest,m2-fuzz,static,webmin-model,webmin-dealer,engine-money}.test.ts`
- **刻意未动**：`src/cards.ts`、`src/rules.ts`、`src/engine/*.ts`（与 rev=5 逐字节相同）、`webmin/index.html`（M1.5 页面原样，根路径入口不变）
- **不入清单**：`node_modules/`、`webui/dist/`（vite 构建产物）、`package-lock.json`（Q3 裁定 A）、监督方文件（`BRIEF/REVIEW/QUESTIONS/ANSWERS`）
- 文档：`SELF-REVIEW.md`（新增 M3-A…M3-E，rev=5 起改称附录）、`TEST-OUTPUT.md`（本节）、`DELIVERY.md`（rev=6，最后原子写）

# M2 · AI + fuzz + 庄家三档（工单 §4 M2）

## M2.1 范围对照

| §4 M2 要求 | 落地 | 证据 |
|---|---|---|
| 诚实 AI（牌力档位 + 池赔率） | `src/ai/honest.ts`：分位 = 穷举牌型计数推出的档间位置 + 档内可达键区间归一化；决策 = 分位 vs 池赔率（`cost/(pot+cost)`）并按活跃对手数折价；加注只在分位 ≥ 0.9 且未到注级上限 | `ai/01–ai/11`（11 例）、`m2/05` 标定 |
| AI 决策**只能用 `project()` 投影**，不许直读 `GameState.seats[].hand` | `decideAi(view, seat, legal)` 的入参里根本没有 `GameState`：`View` 类型无 `hand` 字段，未看牌时是 `'unknown'` ⇒ 结构上写不出偷看；合法行动表由调用方从 `legalActions`+`actionCost` 折算后传入 | `static/13`（机检 10 条禁用形态 + `engine/state.ts` 只许 type-only import）、变异 A11 证明它有牙 |
| 随机合法行动跑 1000 局（固定种子）+ 五类不变量 | `m2/01` 随机臂 1000 局（2–6 人全跨）；断言总筹码守恒 / 无负筹码 / 无重复结算 / 有限行动数内终止 / 途中 pot≡Σcommitted | 输出行 `FUZZ-random hands=1000 maxSteps=21` |
| AI 参与同一套不变量 | `m2/02` AI 臂 1000 局，除同一组不变量外另断言"零非法选择、零闷着加注、零主动比牌" | `FUZZ-ai hands=1000 decisions=9430 look=1231` |
| 非法行动必被 validate 拒（工单点名的四类） | `m2/04` 把四类注入到 300 局的每一步：不轮到你 / 钱不够 / 比已弃牌者 / 首圈禁比时段比牌，逐次核对 `RejectCode` 与状态指纹不变 | `FUZZ-ILLEGAL4 probes=11137` 四类计数均 > 0 |
| 庄家三档 `Rules.dealer.next`（schema + 两 preset 补字段，未知 key 抛错不变） | `src/rules.ts` 加 `dealer:{next}` + `DealerNextId`/`DEALER_NEXT_IDS` 导出 + 新 `oneOf` 校验形态 | `rules/18`、`rules/19`（枚举外值/缺字段/多余 key/大小写/非串 全抛）、`static/12` 导出名单同步 |
| `beginNextHand` 按档位选庄（含平局归属与离桌顺延） | 纯函数 `nextDealerOf(mode, prev, seated)` + `ringAfter` 环形序；赢家档先给拿到余数者、无余数取距庄家下家最近；输家档离桌则环形顺延到下一家输家 | `dealer/01–06`（手推座位号）、`dealer/08–11`（会话层属性断言） |
| webmin 开局面板加下拉 | `index.html` 三档下拉（轮庄/赢家坐庄/输家坐庄）+ `app.ts` 接线 + 状态行回显档位 | `ui/12`（状态行含档位）、`ui/15`（下拉 value 集合恰为三档）、浏览器实测 |
| 测试覆盖三档含平局与离桌边界 | `dealer/03`（分池余数归属）、`dealer/04`（输家离桌顺延）、`dealer/05`（无在桌输家兜底）、`dealer/06`（无可留座位返回 null） | 11 例 `webmin-dealer.test.ts` |
| 仍是占位级、不提前做 M2 之外的事 | 未做：AI 不发起比牌、无边池/无全押、无计时器 | `ai/09`、`m2/02` 断言 |

用例数 175 → **206**（+31 = `ai-honest` 11 + `m2-fuzz` 5 + `webmin-dealer` 11 + `ui/11b` + `rules/18,19` + `static/13`）。
未删除任何既有用例；`ui/10b`/`ui/10c` 因机器人改走 AI 而重写期望（"决策与手牌无关"这条不变量原样保留）。

## M2.2 命令与退出码

| # | 命令 | 结果 |
|---|---|---|
| 1 | `npm test` | exit=0，206/206（按文件：ai-honest 11 / classify 14 / compare 12 / deck 19 / edge 17 / engine-core 13 / engine-fuzz 6 / engine-illegal 13 / engine-money 10 / engine-project 12 / engine-scripts 9 / m2-fuzz 5 / rules 19 / static 14 / webmin-dealer 11 / webmin-model 21） |
| 2 | 紧接着再跑一次 | exit=0，逐字节相同（M2.3） |
| 3 | `npx tsc --noEmit` | exit=0 |
| 4 | 变异测试（`.verify/` 副本内跑） | 46 条，45 caught，见 M2.6 |
| 5 | `node webmin/serve.ts 8129` + 真浏览器 | 见 M2.7 |

整套 `npm test` 约 5 秒（含 2×1000 局 fuzz 与 3 轮 22100 手全枚举）。

## M2.3 §0.5 双跑一致性证据

```
run1_exit=0 run2_exit=0
DIFF=IDENTICAL
728b59c0e14b9084c6cfa9d9da39bc7175be6e12967b7d709fd33c52c7292d72  run1
728b59c0e14b9084c6cfa9d9da39bc7175be6e12967b7d709fd33c52c7292d72  run2
```

## M2.4 关键输出原文（`npm test` 的 NOTES 段，跨轮可比）

```
FUZZ-random hands=1000 maxSteps=21 decisions=0 look=0 reasons=oneLeft=804 stakeCap=189 stall=7
FUZZ-ai     hands=1000 maxSteps=18 decisions=9430 look=1231 reasons=oneLeft=213 stakeCap=83 stall=704
FUZZ-ILLEGAL probes=2520 rejected=2240
FUZZ-ILLEGAL4 probes=11137 not_current_turn=3956 cannot_afford=1978 bad_target=2081 compare_forbidden_before_first_actions=2510
FUZZ-MODE reasons=oneLeft,stakeCap,stall
AI02 tier-percentile max diff=0.27pp
AI-CALIB max|est-true|=0.3pp over 24 anchors
DEALER08 winner 0>2=>2 2>0=>0 0>1=>1 1>0=>0 0>0=>0 0>3=>3
DEALER09 loser hands=6 fallback=0
DEALER10 rotate=0,1,2,3,0 winner=0,2,0,1,0 loser=0,1,3,1,2
UI05 steps=5 结束原因：同一注级下各家各完成 3 次行动 → 强制开牌
UI06 合法比牌达成，且首圈禁比确凿生效过
UI07 rejected=7/7
UI09 hands=12 total=768 over=null
UI10 botSteps=268 raise=14 call=134 fold=43 look=77
UI11 收桌于第 3 局：只剩 1 家还付得起底注（最少需要 2 家），牌局结束
UI16 reason=stall
```

三条读法：
- **AI 臂的终止分布明显不同于随机臂**（stall 704 vs 7、oneLeft 213 vs 804）：AI 只在赔率合适时才留在池里，注级抬不起来 ⇒ 多数以 stall 收；随机臂乱加注乱弃 ⇒ 多数以一人存活收。两边都覆盖到全部三类终止条件（`m2/03` 钉死）。
- **`AI-CALIB max|est-true|=0.3pp`** 是牌力分位函数与"真实压过多少比例的手牌"（用 `compare` 对 22100 手全量算）在 24 个锚点上的最大偏差；`AI02` 说明共用一张 classic 推出来的表在 `a23off` 下最多偏 0.27pp。
- **`UI10 raise=14`（rev=4 是 raise=0）**：40 局随机样本里机器人第一次真的主动加过注 —— 因为 AI 会在合适的时机先看牌，看过牌才可能加注；同批 `look=77` 说明"看牌/保持闷"是条活路径而不是死代码。

## M2.5 牌力分位表的可复核性

`src/ai/honest.ts` 里只有两类常量：各档组合计数（`TIER_COUNTS`）与档内可达键端点（`proxyRange` 推导）。
两者都不是抄来的数字：
- `ai/01` 重新全枚举 22100 手，逐档比对 `share` 与前缀和（容差 1e-9）；
- `m2/05` 取每档**实际的最强/最弱手**，一头核对分位是否贴住档端（< 0.005），一头与 `compare` 全量算出的真实胜率对拍（< 0.02），**两个 preset 都跑**；
- 端点随 `a23` 的移动也被单独断言（顺子最低高点 3⇄4；高牌最小手恒为 5-3-2，因为 4-3-2 在两个 preset 下都是顺子）。

## M2.6 变异全表（46 条，`.verify/` 副本内跑，跑完还原并核对 sha256）

覆盖面 = V（rev=4 显示侧的门，确认没被 M2 冲掉）+ W（会话/服务侧仍成立的 13 条）+ D（庄家三档，M2 新增）+ A（诚实 AI，M2 新增）。

```
BASELINE(.verify) exit=0 pass=206 fail=0 变异条目数=46
V01 去掉 looked 门（rev=4 缺陷原形态）      caught  failCases=12 首个: ai-honest :: ai/04 诚实性：没看过牌 ⇒ 决策与本手真实牌完全无关
V02 谁看过牌就向所有视角广播                  caught  failCases=2  首个: engine-project :: project/11 负向：未看牌时整条 view 序列化后搜不到本人牌面
V03 门焊死：连已亮牌也不放行                  caught  failCases=14 首个: engine-project :: project/03 强制开牌后…
V04 与/或写反                              caught  failCases=14 首个: engine-project :: project/03
V05 looked 误写成 active                    caught  failCases=12 首个: ai-honest :: ai/04
V06 viewer 写死成 -1                       caught  failCases=12 首个: engine-project :: project/04
V07 整张手牌无条件放行（=旧 E26）             caught  failCases=15 首个: ai-honest :: ai/04
V08 隐藏占位符退化成空串                      caught  failCases=1  首个: webmin-model :: ui/16
V09 可见性反向                              caught  failCases=12 首个: engine-project :: project/04
V10 视图提前泄露 seed（=旧 E27）              caught  failCases=1  首个: engine-project :: project/05
V11 剩两家比牌不开牌（=旧 E09）               caught  failCases=2  首个: engine-project :: project/04
V12 页面文案回到中英混排                      caught  failCases=1  首个: webmin-model :: ui/15
W01 桌上总额漏算池                           caught  failCases=5  首个: webmin-model :: ui/01
W03 不剔除付不起底注的座位                    caught  failCases=2  首个: webmin-model :: ui/11
W04 每局用同一份牌序                         caught  failCases=1  首个: webmin-model :: ui/03
W08 未结算也能开下一局                       caught  failCases=1  首个: webmin-model :: ui/07
W09 收桌后仍可继续行动                       caught  failCases=1  首个: webmin-model :: ui/11
W10 待结算时不给结算按钮                      caught  failCases=7  首个: webmin-model :: ui/05
W11 座位行丢掉"本局已投入"                    caught  failCases=1  首个: webmin-model :: ui/12
W12 状态行丢掉池额                           caught  failCases=1  首个: webmin-model :: ui/12
W13 放行任意扩展名                           caught  failCases=1  首个: webmin-model :: ui/13
W14 取消目录白名单                           caught  failCases=1  首个: webmin-model :: ui/13
W15 根路径不再重定向                         caught  failCases=1  首个: webmin-model :: ui/13
W16 .ts 不做类型剥离                         caught  failCases=1  首个: webmin-model :: ui/13
W17 取消项目根越界检查                        NOT-CAUGHT  failCases=0（rev=3 已裁定等价变异，见 REVIEW.md D-5）
D01 winner 档无视余数归属                    caught  failCases=1  首个: webmin-dealer :: dealer/03 平局分池先给拿到余数的那位
D02 winner 档把全桌当赢家                    caught  failCases=2  首个: webmin-dealer :: dealer/02
D03 loser 档取成赢家集合                     caught  failCases=2  首个: webmin-dealer :: dealer/04
D04 环形序方向反了                           caught  failCases=5  首个: webmin-dealer :: dealer/01 rotate：庄家的下家接任
D05 rotate 退化成"座位号最小者"               caught  failCases=3  首个: webmin-dealer :: dealer/01
D06 loser 档无在桌输家时不给兜底               caught  failCases=1  首个: webmin-dealer :: dealer/05
D07 createSession 无视 dealerNext 选择        caught  failCases=6  首个: webmin-dealer :: dealer/07
D08 新一局沿用上局庄家（选庄结果没进引擎）        caught  failCases=1  首个: webmin-model :: ui/08
D09 整桌重来丢掉庄家规则档位                   caught  failCases=1  首个: webmin-model :: ui/11b
D10 整桌重来用被裁过的名册（=M2 缺陷复发）       caught  failCases=2  首个: webmin-model :: ui/11
A01 分位表倒置（豹子变最弱）                   caught  failCases=9  首个: ai-honest :: ai/01 牌力先验表 = 22100 手全枚举的事实
A02 从不认为自己没看牌（转明路径成死代码）        caught  failCases=7  首个: ai-honest :: ai/04
A03 去掉档内归一化                           caught  failCases=1  首个: m2-fuzz :: m2/05 牌力分位 ≈ 真实胜率
A04 高牌最小端点推错成 7-4-2                  caught  failCases=1  首个: ai-honest :: ai/06 池赔率真的进了决策
A05 加注阈值降到 0.5（弱牌也加注）              caught  failCases=1  首个: ai-honest :: ai/05
A06 对手数量不折价                           caught  failCases=1  首个: ai-honest :: ai/07
A07 池赔率恒为 0（只看牌力）                   caught  failCases=4  首个: ai-honest :: ai/05
A08 永不主动转明（整桌退化成只会 stall 结束）     caught  failCases=6  首个: ai-honest :: ai/04
A09 AI 主动比牌（越出 v1 划界）                caught  failCases=4  首个: ai-honest :: ai/09
A10 闷着先验抬成 0.95                        caught  failCases=1  首个: ai-honest :: ai/10
A11 偷看注入：读 view 之外的 hand              caught  failCases=1  首个: static :: static/13 src/ai 只用投影信息
RESTORE src/engine/project.ts OK
RESTORE src/engine/actions.ts OK
RESTORE src/ai/honest.ts OK
RESTORE webmin/model.ts OK
RESTORE webmin/serve.ts OK
RESTORE webmin/index.html OK
```

三条值得单独说的：

1. **A11 只能被 `static/13` 抓**。它在 `honest.ts` 里插一句 `void (me as …)?.hand` —— 决策一个字没变，所有行为测试全部放行，只有那条静态机检报红。这正是 §2.6"AI 不许偷看"要的可执行形态。
2. **A03/A04 是标定测试的产物**，不是事后补的：`A03`（去掉档内归一化）与 `A04`（把高牌最小端点写成 7-4-2）都对应我本轮**真的犯过并被抓过**的错 —— 第一次跑 `m2/05` 时报的是"最烂一手拿到 12.4pp 假胜率"，第二次报的是"a23off 高牌最小手不符 50302 ≠ 40302"。修完之后偏差 0.3pp。
3. **D09/D10 是已修缺陷的复发哨**（见 M2.8），分别由 `ui/11b` 抓住。

## M2.7 真浏览器实测

原文留档：`evidence/m2-winner-dealer-and-ai-look.txt`。截图仍取不到（页面 `visibilityState=hidden`），
没有强行切前台凑图，改用状态行 / 座位行 / 完整行动日志留证。要点：

1. 下拉选"赢家坐庄"后，状态行末直接回显 `· 庄位规则 赢家坐庄`；开局四行仍是 `牌 ···`（rev=4 的显示门未回退）。
2. 庄位走向（seed 424242，6 局）：局1–2 庄家"你"（连赢两局）⇒ 局3 赢家变电脑2 ⇒ **局4 庄家=电脑2** ⇒ 局4 赢家电脑1 ⇒ **局5–6 庄家=电脑1**。与轮庄序列 0,1,2,3,0 明显不同（`DEALER10` 同批把三档的序列并排打了出来）。
3. 机器人主动转明的日志：`#002 look 电脑2 @注级1｜闷→明` 紧跟 `#003 fold 电脑2` —— **先看牌、再决定弃**；同一时刻真人那行仍是 `牌 ···`，机器人看牌不会让别人看见它的牌。
4. 全程 rejections=0、总额恒 4×256=1024、控制台零消息。

## M2.8 本轮发现并修掉的三个真缺陷

| # | 缺陷 | 怎么发现的 | 修法 | 复发哨 |
|---|---|---|---|---|
| 1 | **`重新开始` 把破产离桌的玩家弄丢**：`beginNextHand` 中途裁过 `s.seats`，reset 又按 `s.seats.length` 重建 ⇒ 四人桌重开后只剩三人、总额从 12 变 9 | `ui/11b`（我按三档各跑一局收桌场景） | `beginNextHand` 不再裁名册：破产者只是这一局不进 `state.seats`，名册保留给 reset | `ui/11b`、变异 D10 |
| 2 | **`重新开始` 静默把庄家规则重置成轮庄**：reset 重建会话时没传 `dealerNext` | 同一条 `ui/11b` 的第二组断言（我加三档时顺手想到） | reset 传 `dealerNext: s.rules.dealer.next` | `ui/11b`、变异 D09 |
| 3 | **全员 AI 时对局退化成"只能以 §1③ stall 结束"**：闷着只在注级抬高时才看牌 ⇒ 没人肯先看牌 ⇒ 没人加注 ⇒ 注级永远停在最低 ⇒ `oneLeft`/`stakeCap` 不可达 | `m2/03` 首次运行报"AI 臂没覆盖 oneLeft" | AI 增加"早且便宜时买信息"的转明条件（本注级首次行动 + 池浅）；改后 AI 臂 1000 局打出 213/83/704 的三类终止分布 | `m2/02`/`m2/03`、变异 A08 |

另有一处**我自己的推导错**被测试拦下（不属产品缺陷，但记下来以免重犯）：档内可达键端点先写成"高牌最小手 7-4-2"，又误推 `a23off` 下会变成 4-3-2 —— 两次都是 `m2/05` 报的。事实是 4-3-2 在两个 preset 下都是顺子，高牌最小手恒为 5-3-2，`a23` 只影响 A-2-3。

## M2.9 变更文件（相对 rev=4）

| 文件 | 变更 |
|---|---|
| `src/rules.ts` | 新增 `DealerNextId` / `DEALER_NEXT_IDS` / `Rules.dealer`、`oneOf` 校验形态，两 preset 补 `dealer:{next:'rotate'}` |
| `src/ai/honest.ts` | **新增**：诚实 AI（分位表 + 池赔率 + 对手数折价 + 真实看牌决策） |
| `webmin/model.ts` | `nextDealerOf`/`ringAfter` 三档选庄、`beginNextHand` 接选庄、`createSession` 加 `dealerNext`、状态行回显档位、`chooseBotIntent` 改为委托 AI、reset 与名册两处缺陷修复 |
| `webmin/index.html` / `webmin/app.ts` | 庄家规则下拉 + 接线 + 自动化钩子 `dealer` 参数 |
| `test/ai-honest.test.ts` | **新增**（11 例） |
| `test/m2-fuzz.test.ts` | **新增**（5 例，含 2×1000 局） |
| `test/webmin-dealer.test.ts` | **新增**（11 例） |
| `test/rules.test.ts` | `rules/04` 补 dealer 锚点，新增 `rules/18`、`rules/19` |
| `test/static.test.ts` | `static/00` 覆盖 `src/ai`，新增 `static/13`，`static/12` 导出名单补两枚 |
| `test/webmin-model.test.ts` | `ui/10b`/`ui/10c` 随 AI 重写，`ui/11b`/`ui/12`/`ui/14`/`ui/15`/`ui/16` 更新 |
| `evidence/m2-winner-dealer-and-ai-look.txt` | **新增**（浏览器实测原文） |
| `TEST-OUTPUT.md` / `SELF-REVIEW.md` / `DELIVERY.md` | 本 M2 节 / M2 自评段 / rev 自增到 5 |

---



## 0. rev=4：验收后缺陷修正（工单 §1 看牌行 + §4"M1.5 验收后缺陷修正"①–⑤）

缺陷两面貌：**显示侧**未点看牌时真人自己的牌在界面可见（根因 `src/engine/project.ts` 对本人牌无条件放行）；
**决策侧**机器人全程闷着却按真实牌力决策（根因 `webmin/model.ts` 的 `chooseBotIntent` 未看牌分支直读 `me.hand`）。

### 0.1 修正项对照

| §4 要求 | 落地 | 证据 |
|---|---|---|
| ① `project()` 本人牌可见条件补 `looked`（`revealed` 照旧对所有人放行） | `cards: s.revealed \|\| (s.seat === viewer && s.looked) ? ... : 'unknown'`；顺手删掉一个恒真的死变量 `own` | 源码 diff；`project/11·12` |
| ② 测试同步 + **新增负向断言**（未看牌时投影序列化后不得出现本人牌面） | `project/01·04·08·10` 转新口径；新增 `project/11`（整条 view 序列化搜本人牌面 + 正向对照 + 跨视角）、`project/12`（`revealed` 优先于 `looked`）；`ui/16·17` 改写、新增 `ui/18`（会话层再钉一遍：`view()` 全树 + 渲染出的座位行都不许出现本人牌面） | 0.4 节用例原文 |
| ③ 变异测试覆盖新门 | 35 条（V01–V12 显示侧 + B01–B06 决策侧 + W 面 17 条全量复跑），34 caught、W17 存活（rev=3 已裁定的等价变异）、0 SKIPPED、0 CORRUPT | 0.5 节全表 |
| ④ **机器人占位策略：未看牌 ⇒ 决策与手牌完全无关** | `chooseBotIntent` 改成先过 looked 门：闷着且 `stake > 初始注级` ⇒ 只出 `look`（转不了明就 fold，绝不闷着往里投钱）；闷着且注级还在最低 ⇒ 只 `call`（付得起才 call）或 `fold`；不 raise、不读手牌。看过牌才走原档位阈值；仍绝不主动比牌。`ui/10` 改判为"闷着时不按手牌行动 + 注级抬高必先转明"；`ui/10b` 改成"已看牌三条臂"并追加闷态对照；新增 `ui/10c` **行为级断言：同一局面只换手牌，未看牌决策必须不变**（附反向对照）；`ui/14` 追加**静态一钉**：`me.hand` 只许出现在 looked 门之后 | 0.4 节 + 0.5 的 B 系列 + 0.6 第 [6] 节 |
| ⑤ 交付 DELIVERY rev=4 | `DELIVERY.md` rev: 4，manifest 重算；M1.5 其余验收项维持有效（0.6 重新真打验证） | 本文件 + DELIVERY.md |
| （UI 层无需改动） | 确认成立：`webmin/model.ts` 的 `'···'` / `'未开牌'` 渲染分支本来就在，只是此前永不被走到；④ 也只动策略函数，没碰 UI 层 | 0.6 节浏览器实测 |

用例数 171 → **175**（M0 面 92 + M1 面 63 + M1.5 面 20；新增 `project/11`、`project/12`、`ui/10c`、`ui/18`；**未删除任何用例**，被改写的 8 条只改期望值，且都是把"缺陷行为"钉成了断言）。

### 0.2 命令与退出码（rev=4 时点）

| # | 命令 | 结果 |
|---|---|---|
| 1 | `npm test` | exit=0，175/175 全过（M0 面 92 + M1 面 63 + M1.5 面 20） |
| 2 | 紧接着 `npm test` 再跑一次 | exit=0，与第 1 次逐字节相同（见 0.3） |
| 3 | `npx tsc --noEmit` | exit=0，无诊断 |
| 4 | 变异测试（`.verify/` 副本内跑，交付文件零接触） | 35 条，见 0.5 |
| 5 | `node webmin/serve.ts 8126`（显示侧）/ `8127`（决策侧）+ 真浏览器打多局 | 见 0.6 |

### 0.3 §0.5 双跑一致性证据

```
run1_exit=0 run2_exit=0
DIFF=IDENTICAL
7b243bb18d72d77a42a24abe7d1527dcedf67e019e3f3ae970a9a17942d10be5  run1
7b243bb18d72d77a42a24abe7d1527dcedf67e019e3f3ae970a9a17942d10be5  run2
```

### 0.4 本次受影响用例的原文（`npm test` 真实输出行）

```
PASS test/engine-project.test.ts :: project/01 谁都没看过牌：本人也是 unknown，他人一律 unknown（§1 看牌行）
PASS test/engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
PASS test/engine-project.test.ts :: project/08 视图是拷贝，改它不会污染引擎状态
PASS test/engine-project.test.ts :: project/10 startHand 之后立刻投影：轮到行动也没看过牌 ⇒ 本人同样无牌可看
PASS test/engine-project.test.ts :: project/11 负向：未看牌时整条 view 序列化后搜不到本人牌面
PASS test/engine-project.test.ts :: project/12 revealed 优先于 looked：本人没看牌，被强制开牌后照样看得见自己的牌
PASS test/webmin-model.test.ts :: ui/10 机器人占位策略：只出合法意图、绝不比牌、闷着时不按手牌行动
PASS test/webmin-model.test.ts :: ui/10b 占位策略三条臂点测（已看牌）：强牌加注、中等跟注、烂牌弃牌
PASS test/webmin-model.test.ts :: ui/10c 未看牌的机器人决策与手牌无关（同一局面只换牌）
PASS test/webmin-model.test.ts :: ui/14 分层边界：model 不碰 DOM/时钟/随机，app 不碰 node 内置也不自己判规则
PASS test/webmin-model.test.ts :: ui/15 页面接线：html 与各模块 import 路径都能被服务放行
PASS test/webmin-model.test.ts :: ui/16 一整局的可见性推进：局中暗牌、终局按规则亮
PASS test/webmin-model.test.ts :: ui/17 页面显示的牌型名与 classify 判定一致（且以看过牌为前提）
PASS test/webmin-model.test.ts :: ui/18 未看牌时 view() 全树序列化与座位行都搜不到真人牌面
```

固定向量与统计行（同批 `npm test` 输出，跨轮可比）：

```
UI05 steps=5 结束原因：同一注级下各家各完成 3 次行动 → 强制开牌
UI09 hands=12 total=768 over=null
UI10 botSteps=274 raise=0 call=205 fold=29 look=40      ← rev=3 是 botSteps=234 / look 恒 0
UI11 收桌于第 1 局：只剩 1 家还付得起底注（最少需要 2 家），牌局结束
UI16 reason=stall
```

改写要点（四处是"把缺陷钉成断言"，两处是"给既有用例补牙"）：

- `project/01`：原来断言"viewer 看得见自己的牌"——那正是缺陷口径，现在断言开局全员 `unknown`。
- `project/08`（视图是拷贝）：门收紧后 `own.cards` 会变成 `'unknown'`，原来那句 `if (... !== 'unknown') cards.push(...)` 会被**静默跳过**，用例退化成空跑。现在先用构造前提断言"看过牌却仍不可见"直接失败，保证 push 真的执行。这是本轮最容易漏的一处。
- `project/11`：负向断言必须**整条 view 序列化**来搜（只查 `cards` 字段搜不出"从日志/终局信息漏出去"那条路），并且同批跑正向对照（看牌后必须搜得到）——否则"把门焊死"也能通过负向断言，成为假安全。
- `project/11` 跨视角段：0 号看牌后，1 号视角与观战视角仍必须看不见 0 号那手。这条是被 V02 逼出来的（见 0.5 末尾说明）。
- `ui/10c`（④ 的行为级断言）：同一局面只换机器人手牌（豹子 / 同花顺 / 同花 / 对子 / 顺子 / 极烂 / 极好 七副），注级取 1/2/4/8，**未看牌时决策必须一模一样**（注级最低恒 `call`、抬高后恒 `look`）。同批跑**反向对照**：同样这七副牌在已看牌时决策必须分化（≥2 种），否则"决策不变"是门焊死出来的假象。
- `ui/14` 静态一钉（④ 的第二道）：`chooseBotIntent` 函数体里 `me.hand` 这个符号的下标必须大于 `if (!me.looked)` 的下标。它抓的是"偷读但不用"这类行为上看不出来的写法（对应 B05）。

### 0.5 变异全表（35 条，跑在 `.verify/` 副本，跑完还原并核对 sha256）

```
BASELINE(.verify) exit=0 pass=175 fail=0 变异条目数=35
V01 去掉 looked 门（= rev=4 缺陷原形态）      caught  failCases=7  首个: engine-project :: project/01 谁都没看过牌：本人也是 unknown，他人一律 unknown（§1 看牌行）
V02 谁看过牌就向所有视角广播                  caught  failCases=1  首个: engine-project :: project/11 负向：未看牌时整条 view 序列化后搜不到本人牌面
V03 门焊死：连已亮牌也不放行                  caught  failCases=9  首个: engine-project :: project/03 强制开牌后：活跃家全部可见…
V04 与/或写反（亮牌还得是本人且看过）          caught  failCases=9  首个: engine-project :: project/03 强制开牌后：活跃家全部可见…
V05 looked 误写成 active                    caught  failCases=7  首个: engine-project :: project/01
V06 viewer 写死成 -1（本人永不可见）           caught  failCases=7  首个: engine-project :: project/04
V07 完全不看门：整张手牌直接放行               caught  failCases=10 首个: engine-project :: project/01
V08 隐藏占位符退化成空串                      caught  failCases=1  首个: webmin-model :: ui/16 一整局的可见性推进…
V09 可见性反向：只有别人的牌可见               caught  failCases=7  首个: engine-project :: project/04
V10 (=旧 E27) 视图提前泄露 seed              caught  failCases=1  首个: engine-project :: project/05
V11 (=旧 E09) 剩两家比牌不开牌                caught  failCases=2  首个: engine-project :: project/04
V12 页面文案回到中英混排                      caught  failCases=1  首个: webmin-model :: ui/15 页面接线…
B01 未看牌分支偷读手牌决策（决策侧泄漏）        caught  failCases=4  首个: webmin-model :: ui/10b 占位策略三条臂点测（已看牌）…
B02 注级抬高也永不转明（闷跟到底）              caught  failCases=3  首个: webmin-model :: ui/10 机器人占位策略…
B03 looked 门整体失效（闷牌直走档位阈值）        caught  failCases=4  首个: webmin-model :: ui/10
B04 looked 判断反向                          caught  failCases=4  首个: webmin-model :: ui/10
B05 门前偷算牌力但不使用（行为不可见）          caught  failCases=1  首个: webmin-model :: ui/14 分层边界…
B06 闷着且最低注级时一律弃牌（把便宜跟写成走）    caught  failCases=6  首个: webmin-model :: ui/10
W01 桌上总额漏算池                           caught  failCases=4  首个: webmin-model :: ui/01
W02 庄家不轮转（原地坐庄）                    caught  failCases=1  首个: webmin-model :: ui/08
W03 不剔除付不起底注的座位                    caught  failCases=1  首个: webmin-model :: ui/11
W04 每局用同一份牌序                         caught  failCases=1  首个: webmin-model :: ui/03
W05 单张高注级也不弃                         caught  failCases=1  首个: webmin-model :: ui/10b
W06 豹子不加注                              caught  failCases=2  首个: webmin-model :: ui/10b
W07 机器人误以为比牌合法                      caught  failCases=1  首个: webmin-model :: ui/11
W08 未结算也能开下一局                       caught  failCases=1  首个: webmin-model :: ui/07
W09 收桌后仍可继续行动                       caught  failCases=1  首个: webmin-model :: ui/11
W10 待结算时不给结算按钮                      caught  failCases=6  首个: webmin-model :: ui/05
W11 座位行丢掉"本局已投入"                    caught  failCases=1  首个: webmin-model :: ui/12
W12 状态行丢掉池额                           caught  failCases=1  首个: webmin-model :: ui/12
W13 放行任意扩展名                           caught  failCases=1  首个: webmin-model :: ui/13
W14 取消目录白名单                           caught  failCases=1  首个: webmin-model :: ui/13
W15 根路径不再重定向（页面起不来）              caught  failCases=1  首个: webmin-model :: ui/13
W16 .ts 不做类型剥离直接吐给浏览器              caught  failCases=1  首个: webmin-model :: ui/13
W17 取消项目根越界检查                        NOT-CAUGHT  failCases=0（rev=3 已裁定为等价变异，非盲区；见 REVIEW.md D-5）
RESTORE src/engine/project.ts OK
RESTORE src/engine/actions.ts OK
RESTORE webmin/model.ts OK
RESTORE webmin/serve.ts OK
RESTORE webmin/index.html OK
```

变异面为什么是 35 条而不是全量 77+35：本轮只动了 `src/engine/project.ts` 一行、`webmin/model.ts` 的 `chooseBotIntent`、`webmin/index.html` 文案、以及两份测试文件。
rev=3 的 77 条 = M/E 面 60 条 + W 面 17 条。`src/cards.ts`、`src/rules.ts`、`src/engine/{state,actions,validate,settle}.ts` 与 rev=3 **逐字节相同**（manifest 哈希可直接复核），其 57 条 M/E 变异的锚点与判定用例均未受影响 ⇒ 结论沿用。
剩下 3 条（旧 E09 / E26 / E27）的捕获用例本轮被改写过，已按同锚点复跑（V07 = 旧 E26 的"无条件放行"形态、V10 = 旧 E27、V11 = 旧 E09），三条仍 caught ⇒ 改写没有削弱既有覆盖。

两条不是事后包装的"补牙"记录：

1. **V02 曾经存活**。它的形态是"谁看过牌就向所有视角广播"——在**本人视角**下与正确实现完全无法区分，我原先的断言全是本人视角，所以它一路跑到 NOT-CAUGHT。是先把这个结果拿到手，才补上 `project/11` 的跨视角两行（0 号看牌 ⇒ 1 号与观战仍看不见），复跑才 caught。
2. **B05 只有静态那道钉能抓**。它把 `void classify(me.hand, ...)` 塞在 looked 门之前——决策一个字都没变，所以 `ui/10c` 的行为级断言与全部随机样本都放行，最终由 `ui/14` 的"符号顺序"检查抓到（failCases=1）。这条正是"未看牌分支不得出现任何手牌引用"这句工单要求的可执行形态。

### 0.6 真浏览器实测（`node webmin/serve.ts 8126 / 8127 / 8128`）

原文留档：`evidence/m15-own-cards-hidden-before-look.txt`（DOM 原文 + 可访问性快照 + 完整行动日志，非手工转写）。
截图本轮**没取到**：页面当时处于不可见表面（`visibilityState=hidden` → `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`）。我没有为了凑一张图去把窗口强行切到前台，改用 DOM 文本与快照留证；rev=3 那张结算页截图仍在 manifest 里、未改动。

要点（全部走页面上真实按钮，不直接调内部函数）：

1. 开局轮到真人、未点看牌：三行全是 `牌 ···`，含真人自己那行 —— **显示侧缺陷形态已消失**。
2. 点真实"看自己的牌"：真人行 `闷 → 明`，并印出 `牌 Q♠ 3♥ 7♦ (单张)`；另两家仍是 `···`（看牌只放开本人）。
3. 该局以"同一注级各家 3 次行动 → 强制开牌"结束：三家牌面都亮出，但两家电脑的闷/明标记仍是"闷"（`revealed ≠ looked`，符合 §1）。筹码 249/267/252，桌上总额恒 **768**。
4. 另一局真人**全程没看牌就弃牌**：下注阶段每一帧都是 `牌 ···`；结算行显示 `你[你]｜未开牌｜没赢`。这是新口径的直接推论——没看过的人本来就不该知道自己在跟什么，且它由 `revealed` 优先规则（`project/12`）兜住：一旦真被打到强制开牌，照样会亮。
5. 开局快照里按钮已是"**开新一桌**"（复审非阻塞项），machine 视图 JSON 只有公开信息与合法意图，无任何牌面。
6. **决策侧（④）**：真人把注级抬到 2 之后，日志依次出现 `#005 look 电脑1 @注级2｜闷→明` → `#006 call 电脑1 出 4 @注级2｜seen×stake`，即**先转明、再按明价付、再按牌力决策**；第二家 `#007 look` → `#008 fold`（看过牌才弃，不是闷着瞎弃）。而注级还是 1 的 `#002/#003` 两条全是 `dark×stake` 出 1、**没有任何 look 事件**（最低注级闷跟便宜，不必转明），也没有 raise。真人始终闷着 ⇒ 一直付 `dark×stake`。
7. 明/闷两种价格在同一份日志里同框（`#005 你 出 2 @注级1｜seen×stake` vs `#006 电脑1 出 1 @注级1｜dark×stake`），跟 §1 注价行一致。
8. 上述 1–3 的场景在**最终代码**（含 ④）下于 8128 端口整段复跑，座位行逐字一致、结算指纹同为 `7d11762b42862f29`——顺带跨进程复核了 M1 的回放确定性。
9. 控制台零消息；累计 4 局、rejections=0、`ledgerTotal=liveTotal=768`、页面零崩溃。

### 0.7 本轮顺带项与遗留

- 顺带（REVIEW.md 非阻塞备注）：`开新session` → `开新一桌`（按钮 + 首次提示文案），并在 `ui/15` 加了一条"可见文案不许中英混排"的回归断言（V12 证明它有牙）。
- 上一轮我准备把"机器人闷着直读手牌"记作遗留、留给 M2；工单已于 2026-09-25 把它升级为 rev=4 ④（显示侧与决策侧一次修完整），**本轮已按 ④ 修完**，不再是遗留。
- 遗留（不在本轮范围，未改）：`#seats` 的 `<thead>` 在运行时被 `textContent=''` 清掉、行是 append 进 `<table>` 的 `div`，所以列头与列宽并不生效。信息是全的（"信息全优先"），纯观感问题。另：M2 要求 AI 只用 `project()` 投影——④ 之后机器人已不读未看的手牌，但 `chooseBotIntent` 仍是直取 `GameState`（只是取不到就没用过），M2 换 AI 时要按工单走投影。

### 0.8 rev=4 变更文件（相对 rev=3）

| 文件 | 变更 |
|---|---|
| `src/engine/project.ts` | 本人牌门补 `looked`；删死变量 `own`；文件头口径改写 |
| `webmin/model.ts` | ④：`chooseBotIntent` 重写为先过 looked 门（闷态不读手牌、不 raise；注级抬高先转明） |
| `test/engine-project.test.ts` | `01/04/08/10` 转新口径，新增 `11/12`，新增 `look()` 夹具 |
| `test/webmin-model.test.ts` | 新增 `toHuman()` 夹具，`ui/10`/`ui/10b` 改判、新增 `ui/10c`，`ui/14` 加静态钉，`ui/15` 加文案断言，`ui/16/17` 改写，新增 `ui/18` |
| `webmin/index.html` | 两处可见文案 |
| `evidence/m15-own-cards-hidden-before-look.txt` | 新增（浏览器实测原文 7 节） |
| `TEST-OUTPUT.md` / `SELF-REVIEW.md` / `DELIVERY.md` | 第 0 节 / rev=4 段 / rev 自增到 4 |



## 1. 环境

| 项 | 值 |
|---|---|
| Node | v24.19.0（`process.features.typescript = "strip"`；`node:module` 的 `stripTypeScriptTypes` 实测可用，experimental） |
| OS / Shell | win32 10.0.22631 / Git Bash |
| 运行时依赖 | **无新增**。`npm test` 与 `webmin/serve.ts` 只用 node 内置（http/fs/path/url/module） |
| 工具链依赖 | typescript 7.0.2 + @types/node 26.6.2（仅 `npm run typecheck`；rev 2 已获裁定接受） |

## 2. 命令与退出码

| # | 命令 | 结果 |
|---|---|---|
| 1 | `npm test` | exit=0，**171 例全过**（M0 面 92 + M1 面 61 + M1.5 页面层 18） |
| 2 | `npm test` 紧接着再跑一次 | exit=0，输出与第 1 次逐字节相同 |
| 3 | `npx tsc --noEmit` | exit=0，无诊断（`webmin/**/*.ts` 已纳入 include） |
| 4 | `node --test test/engine-money.test.ts`（node:test 兼容道） | 13 tests / 13 pass / 0 fail |
| 5 | 变异测试（脚本不随交付，全表见第 6 节） | 77 条：76 caught，1 存活（W17，成因见 6.2），0 SKIPPED，0 CORRUPT |
| 6 | `node webmin/serve.ts 8125` + 真浏览器点一局 | 见第 7 节 |

## 3. §0.5 双跑一致性证据

```
run1_exit=0 run2_exit=0
DIFF=IDENTICAL
c9277bcb2e5bc405704360af30c4fdd6299ec711ad0ea683ea2e37a383194113 *ev1.txt
c9277bcb2e5bc405704360af30c4fdd6299ec711ad0ea683ea2e37a383194113 *ev2.txt
```

## 4. `npm test` 完整输出（第 1 次运行原文）

```

> zjh@0.0.0 test
> node test/run.ts

=== ZJH TEST REPORT (deterministic) ===
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/classic 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/a23off 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/档位集合 六档键完全一致且无重复，计数均为非负整数
PASS test/classify.test.ts :: classify/闭式结构 trips 与 pair 与 a23 无关，其余四类随 runs 移动
PASS test/classify.test.ts :: classify/输入顺序无关 455 规范类 × 6 排列判定全同（两 preset）
PASS test/classify.test.ts :: classify/A23 一族 64 手在两 preset 下的迁移符合公式
PASS test/classify.test.ts :: classify/归一化键 顺子高点 A23=3 / 234=4 / QKA=14 且长度为 1
PASS test/classify.test.ts :: classify/归一化键 对子=[对子点, 踢脚]，穷举 3744 手
PASS test/classify.test.ts :: classify/归一化键 豹子 ranks=[r]，穷举 52 手
PASS test/classify.test.ts :: classify/NOTES 打印计数三元组（实际/闭式/锚点）供独立复算
PASS test/compare.test.ts :: compare/01 规范类数量 = C(15,3) = 455
PASS test/compare.test.ts :: compare/02 自反：每类与自身比较 = 0
PASS test/compare.test.ts :: compare/03 反对称：455^2 = 207025 全对，cmp(a,b) = -cmp(b,a)
PASS test/compare.test.ts :: compare/04 传递性穷举：(a>=b && b>=c) ⇒ a>=c，全 455^3 三元组
PASS test/compare.test.ts :: compare/05 花色不参与：全体花色平移 +1 后仍判 0
PASS test/compare.test.ts :: compare/06 与独立整数键参考实现交叉一致（455^2 全对）
PASS test/compare.test.ts :: compare/07 tierOrder 整序反转：跨档对全部翻转、同档对不变
PASS test/compare.test.ts :: compare/08 tierOrder 局部改动即刻生效（把 pair 提到 trips 之上）
PASS test/compare.test.ts :: compare/09 固定种子 1000 手排序后做全对序校验（不只是相邻）
PASS test/compare.test.ts :: compare/10 牌型序链：豹子>同花顺>同花>顺子>对子>单张（15 对全断言）
PASS test/compare.test.ts :: compare/11 tierOrder 缺档时 compare 抛错而不静默
PASS test/compare.test.ts :: compare/12 档位优先于点数：最小同花顺 > 最大普通顺等交叉断言
PASS test/deck.test.ts :: deck/01 makeDeck 长度 52 且逐位满足 index = suit*13 + (rank-2)
PASS test/deck.test.ts :: deck/02 52 张互不相同
PASS test/deck.test.ts :: deck/03 makeDeck 每次返回新数组与新对象（无共享可变状态）
PASS test/deck.test.ts :: deck/04 mulberry32 同 seed 的 1000 项序列完全一致
PASS test/deck.test.ts :: deck/05 不同 seed 的序列不同
PASS test/deck.test.ts :: deck/06 输出恒为非负 uint32 整数（1e6 次采样，覆盖边界 seed）
PASS test/deck.test.ts :: deck/07 seed 非整数抛 TypeError
PASS test/deck.test.ts :: deck/08 shuffle 原地：返回值与入参是同一个数组引用
PASS test/deck.test.ts :: deck/09 shuffle 结果是原牌堆的一个排列
PASS test/deck.test.ts :: deck/10 同 seed 两次洗牌逐位一致，不同 seed 至少一处不同
PASS test/deck.test.ts :: deck/11 52 张牌恰好调用 rng 51 次
PASS test/deck.test.ts :: deck/12 rng 返回浮点/负数/非数一律抛 TypeError
PASS test/deck.test.ts :: deck/13 空牌堆与单元素牌堆不调用 rng、不抛
PASS test/deck.test.ts :: deck/14 发牌烟雾：seed=1 洗完发 6 家，每手都可判定
PASS test/deck.test.ts :: deck/16 洗牌分布公平性：固定种子 20000 轮，52 个落点计数都在容差内
PASS test/deck.test.ts :: deck/17 三张牌穷举 144 种 rng 输出：每张牌的落点计数恰为 48
PASS test/deck.test.ts :: deck/18 NOTES 打印 PRNG 与洗牌的规范向量（供跨端复算）
PASS test/deck.test.ts :: deck/19 与独立誊写的参考 mulberry32 逐位一致（钉住结构与常数）
PASS test/deck.test.ts :: deck/20 rng 恒为 0 时输出等于牌堆左旋一格（钉住从尾往前的遍历方向）
PASS test/edge.test.ts :: edge/01 §3.5 A♠2♦3♣ < 3♠4♦5♣（A23 是最小顺）
PASS test/edge.test.ts :: edge/02 §3.5 A♥2♥3♥ 是同花顺且 > 4♣5♦6♣（档位优先于点数）
PASS test/edge.test.ts :: edge/03 §3.5 2♦2♣2♥ > A♠K♠Q♠（豹子 > 同花顺）
PASS test/edge.test.ts :: edge/04 §3.5 A♦A♣3♠ > K♦K♣A♠（对子点优先，踢脚再大也没用）
PASS test/edge.test.ts :: edge/05 §3.5 同点同级 → 0（花色完全不参与）
PASS test/edge.test.ts :: edge/06 绕 A 不成顺：A♠K♦2♣ 是单张而不是顺子
PASS test/edge.test.ts :: edge/07 最大豹子 > 最小豹子 > 任意同花顺
PASS test/edge.test.ts :: edge/08 a23off 下 A♥2♥3♥ 降为同花、A♠2♦3♣ 降为单张
PASS test/edge.test.ts :: edge/09 A 在非顺子牌型里取 14
PASS test/edge.test.ts :: edge/10 归一化键长度按档固定：豹子/顺 1 位、对子 2 位、同花/单张 3 位
PASS test/edge.test.ts :: edge/11 非法手牌：长度≠3 抛 TypeError
PASS test/edge.test.ts :: edge/12 非法手牌：两张同一牌（同点同花）抛 TypeError
PASS test/edge.test.ts :: edge/13 非法牌面：rank / suit 越界、非整数、NaN 都抛 TypeError
PASS test/edge.test.ts :: edge/14 非法手牌容器：非数组 / 元素非对象 / 缺字段抛 TypeError
PASS test/edge.test.ts :: edge/15 compare 两侧都继承 classify 的非法输入检查
PASS test/edge.test.ts :: edge/16 rules 结构缺失时不静默：缺 handEval 抛 TypeError
PASS test/edge.test.ts :: edge/17 单张的型内比较只看归一化后的三点
PASS test/engine-core.test.ts :: core/01 startHand 不变量：底注入池、每人扣 ante、游标在庄家下家、计数归零
PASS test/engine-core.test.ts :: core/02 发牌互不重叠且都来自标准 52 张
PASS test/engine-core.test.ts :: core/03 发牌顺序 = 独立复算的洗牌结果（庄家下家起连续取牌）
PASS test/engine-core.test.ts :: core/04 庄家必须在座位表里
PASS test/engine-core.test.ts :: core/05 配置非法一律抛 TypeError（人数越界 / 重复座位 / 付不起底注 / seed 非整数）
PASS test/engine-core.test.ts :: core/06 apply 是纯函数：对旧状态深冻结后再推进行动，不抛（说明没有原地写）
PASS test/engine-core.test.ts :: core/07 stateHash 对状态变化敏感、对重放稳定
PASS test/engine-core.test.ts :: core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值
PASS test/engine-core.test.ts :: core/09 资金守恒：开局到结算，筹码 + 池恒等于买入总额
PASS test/engine-core.test.ts :: core/10 同一配置重复开局得到同一状态（引擎里没有隐藏全局态）
PASS test/engine-core.test.ts :: core/11 日志单调：seq 逐条 +1，type 全部来自固定集合
PASS test/engine-core.test.ts :: core/12 引擎对 2 人与 6 人都能开局（人数只受 rules.players 约束，不硬编码）
PASS test/engine-core.test.ts :: core/13 终止阈值不多不少：注级 8 上各家满 2 次仍在局里，满 3 次才 stall
PASS test/engine-fuzz.test.ts :: fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码
PASS test/engine-fuzz.test.ts :: fuzz/02 三种终止条件都能被随机行动打到（换策略覆盖 ②③）
PASS test/engine-fuzz.test.ts :: fuzz/03 2–6 人局全部跑通且守恒
PASS test/engine-fuzz.test.ts :: fuzz/04 非法行动注入：一律抛 InvalidActionError，且状态指纹不变
PASS test/engine-fuzz.test.ts :: fuzz/05 回放确定性：同 seed + 同行动序列 ⇒ 同指纹（20 局）
PASS test/engine-fuzz.test.ts :: fuzz/06 结算幂等：settle 前后指纹稳定，且只入账一次
PASS test/engine-illegal.test.ts :: illegal/01 不轮到你 → not_current_turn（三种动作各一例）
PASS test/engine-illegal.test.ts :: illegal/02 座位不存在 → bad_seat
PASS test/engine-illegal.test.ts :: illegal/03 行动对象本身不合法 → unknown_action
PASS test/engine-illegal.test.ts :: illegal/04 首圈禁比：任何人第一次行动之前都不能比牌，全员各一次后立刻放开
PASS test/engine-illegal.test.ts :: illegal/05 比牌目标非法：自己 / 已弃牌 / 不存在的座位
PASS test/engine-illegal.test.ts :: illegal/06 重复看牌被拒；看牌不消耗行动数也不推进游标
PASS test/engine-illegal.test.ts :: illegal/07 注级顶格不能再加注
PASS test/engine-illegal.test.ts :: illegal/08 钱不够 ⇒ 唯一合法行动是弃牌（全押禁用，§1 全押行）
PASS test/engine-illegal.test.ts :: illegal/09 已弃牌的座位不会再被要求行动，硬塞则 seat_not_active
PASS test/engine-illegal.test.ts :: illegal/10 终局后所有下注类行动被拒（phase_not_betting）
PASS test/engine-illegal.test.ts :: illegal/11 结算时机：没终局不能 settle；已结算再 settle 是幂等 no-op
PASS test/engine-illegal.test.ts :: illegal/12 legalActions 与 checkAction 判据完全一致（不轮到你时给出的是当前 turn 的动作集）
PASS test/engine-illegal.test.ts :: illegal/13 timeout 是普通行动：等价于弃牌，并且要过同一道 validate
PASS test/engine-money.test.ts :: money/01 底注：pool = ante × 人数，每人筹码与 committed 各扣/记一份
PASS test/engine-money.test.ts :: money/02 闷跟 = stake×bet.dark，明跟 = stake×bet.seen（三种注级各验）
PASS test/engine-money.test.ts :: money/03 加注：注级翻倍并按新注级付跟价（Q1 读法 B），且全员当前注级行动数清零
PASS test/engine-money.test.ts :: money/04 比牌费 = fee × stake 入池，与闷/明无关（注级 1/2/4 各验一次）
PASS test/engine-money.test.ts :: money/05 不变量：pot 恒等于各家 committed 之和；每步增量恰是 actionCost
PASS test/engine-money.test.ts :: money/06 弃牌不花钱也不退钱：弃牌者的 committed 留在池里（无边池无退款）
PASS test/engine-money.test.ts :: money/07 分池：整除时人人等份；有余数时给"距庄家下家最近"的赢家
PASS test/engine-money.test.ts :: money/08 幂等结算：入账只发生一次，重放 settle 不重复扣/发钱
PASS test/engine-money.test.ts :: money/09 任何时刻都不出现负筹码（全押禁用的直接后果）
PASS test/engine-money.test.ts :: money/10 结算后赢家所得 = 池，且各家 committed 之和 = 结算前 pot
PASS test/engine-project.test.ts :: project/01 下注中：viewer 只看得见自己的牌，他人一律 unknown
PASS test/engine-project.test.ts :: project/02 序列化后仍然搜不到任何他人牌面（整条 view 一起查，含日志）
PASS test/engine-project.test.ts :: project/03 强制开牌后：活跃家全部可见，弃牌/被淘汰者仍然 unknown
PASS test/engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
PASS test/engine-project.test.ts :: project/05 seed 只在结算后才暴露（否则任何客户端都能反算整副牌）
PASS test/engine-project.test.ts :: project/06 公开信息一字不漏：池/注级/游标/计数/闷明/committed 全部同步
PASS test/engine-project.test.ts :: project/07 观战视角（viewer 不在座位表里）看不到任何未开的牌
PASS test/engine-project.test.ts :: project/08 视图是拷贝，改它不会污染引擎状态
PASS test/engine-project.test.ts :: project/09 终局信息公开：赢家集合、份额、余数归属都可投影
PASS test/engine-project.test.ts :: project/10 startHand 之后立刻投影，也不该泄露底牌给下一个行动者
PASS test/engine-scripts.test.ts :: scripts/01 弃至通吃（§1①）：只剩一人即结束，且不开牌
PASS test/engine-scripts.test.ts :: scripts/02 比牌链：连续两次比牌各淘汰一家，输家的牌永不公开
PASS test/engine-scripts.test.ts :: scripts/03 封顶开牌（§1②）：注级 16 且活跃各家再完成 1 次行动 ⇒ 强制开牌
PASS test/engine-scripts.test.ts :: scripts/04 stall 强开（§1③）：同一注级下活跃各家各满 3 次行动；加注会把计数清零重计
PASS test/engine-scripts.test.ts :: scripts/05 平局分池：两家打平 ⇒ 平分池，除不尽的余数给距庄家下家最近者
PASS test/engine-scripts.test.ts :: scripts/06 挑战者输：比牌平局时挑战者出局（§1 比牌行）
PASS test/engine-scripts.test.ts :: scripts/07 剩两家比牌 = 直接开牌定胜负（两家牌都亮）
PASS test/engine-scripts.test.ts :: scripts/08 三条终止路径各自都要能到达（覆盖性，不是只测一条）
PASS test/engine-scripts.test.ts :: scripts/09 每个脚本重放得到同一状态指纹（回放确定性）
PASS test/rules.test.ts :: rules/01 presets.classic 幂等通过 validateRules
PASS test/rules.test.ts :: rules/02 presets.a23off 幂等通过 validateRules
PASS test/rules.test.ts :: rules/03 两个 preset 仅在 handEval.a23 上不同
PASS test/rules.test.ts :: rules/04 classic 的每个数值逐项等于工单 §1 表格
PASS test/rules.test.ts :: rules/05 未知顶层 key special235=true 抛 TypeError
PASS test/rules.test.ts :: rules/06 未知 key 即使值为 false 也抛（不在 v1 schema）
PASS test/rules.test.ts :: rules/07 未知嵌套 key 抛（handEval / bet 内）
PASS test/rules.test.ts :: rules/08 缺 key 抛（顶层与嵌套各一例）
PASS test/rules.test.ts :: rules/09 值类型错抛（字符串数字 / null / 非布尔）
PASS test/rules.test.ts :: rules/10 version 必须是字面量 1
PASS test/rules.test.ts :: rules/11 字面量域的非法值抛（allIn / compare.tie / showdown.*）
PASS test/rules.test.ts :: rules/12 tierOrder 必须是 6 档无重复排列
PASS test/rules.test.ts :: rules/13 非对象输入一律抛
PASS test/rules.test.ts :: rules/14 validateRules 返回值深冻结（顶层/嵌套/数组都改不动）
PASS test/rules.test.ts :: rules/15 validateRules 返回深拷贝，输入事后被改不影响副本
PASS test/rules.test.ts :: rules/16 presets 本身深冻结
PASS test/rules.test.ts :: rules/17 错误消息点名违规所在路径与 key
PASS test/static.test.ts :: static/00 扫描范围覆盖 cards / rules / engine 全部源文件
PASS test/static.test.ts :: static/01 src 里不出现时钟与随机全局态
PASS test/static.test.ts :: static/02 src 里不出现文件、网络与控制台 IO
PASS test/static.test.ts :: static/03 src 不引用任何运行时全局可变对象
PASS test/static.test.ts :: static/04 import 只允许相对路径；M0 两文件只允许 import type ./rules.ts
PASS test/static.test.ts :: static/05 src 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）
PASS test/static.test.ts :: static/06 零运行时依赖：dependencies 必须为空（或整体不存在）
PASS test/static.test.ts :: static/07 devDependencies 落在工单白名单内
PASS test/static.test.ts :: static/08 npm test 是单命令，且不依赖任何已安装依赖
PASS test/static.test.ts :: static/09 tsconfig 打开 strict 与 erasableSyntaxOnly
PASS test/static.test.ts :: static/10 输出生产者 test/run.ts 不引用时钟（保证两次运行一致）
PASS test/static.test.ts :: static/11 测试目录可被 runner 发现且无空目录
PASS test/static.test.ts :: static/12 M0 冻结接口：cards/rules 的导出名恰好是 §2.7 契约（不夹带私有实现的导出）
PASS test/webmin-model.test.ts :: ui/01 createSession 建立座位、首局与台账
PASS test/webmin-model.test.ts :: ui/02 非法开局参数一律抛 TypeError
PASS test/webmin-model.test.ts :: ui/03 deriveSeed 确定、逐局不同、不用时钟
PASS test/webmin-model.test.ts :: ui/04 没轮到真人时点按钮 → 拒绝且状态指纹不变
PASS test/webmin-model.test.ts :: ui/05 真人+机器人打完一整局：走到结算，台账守恒
PASS test/webmin-model.test.ts :: ui/06 真人发起合法比牌恰好淘汰一家；期间确证首圈禁比挡过
PASS test/webmin-model.test.ts :: ui/07 乱点不崩：非法意图 ok:false 且指纹不变；整桌重来永远可点
PASS test/webmin-model.test.ts :: ui/08 再来一局：局号 +1、庄家轮转到下家、总额守恒
PASS test/webmin-model.test.ts :: ui/09 连打 12 局：每局有限步结束、总额恒定
PASS test/webmin-model.test.ts :: ui/10 机器人占位策略：只出合法意图、绝不比牌/看牌
PASS test/webmin-model.test.ts :: ui/10b 占位策略三条臂点测：强牌加注、中等跟注、烂牌弃牌
PASS test/webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
PASS test/webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
PASS test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
PASS test/webmin-model.test.ts :: ui/14 分层边界：model 不碰 DOM/时钟/随机，app 不碰 node 内置也不自己判规则
PASS test/webmin-model.test.ts :: ui/15 页面接线：html 与各模块 import 路径都能被服务放行
PASS test/webmin-model.test.ts :: ui/16 一整局的可见性推进：局中暗牌、终局按规则亮
PASS test/webmin-model.test.ts :: ui/17 页面显示的牌型名与 classify 判定一致

=== NOTES (fixed vectors, recompute-able independently) ===
CANONICAL mulberry32 seed=1 float_first=0.6270739405881613
CMP 2S 2D 9C vs 3S 4D 5C = -1
CMP 2S 3D 4C vs AS KS QS = -1
CMP 4S 9S JS vs AS 2S 3S = -1
CMP 9S 9D 2C vs 9C 9S 2D = 0
CMP AS 2S 3S vs QD KC JS = 1
DEAL seat=0 hand=T♠2♠J♠ tier=flush ranks=[11,10,2]
DEAL seat=1 hand=5♠9♣J♥ tier=highCard ranks=[11,9,5]
DEAL seat=2 hand=3♠6♦A♦ tier=highCard ranks=[14,6,3]
DEAL seat=3 hand=6♠K♥7♣ tier=highCard ranks=[13,7,6]
DEAL seat=4 hand=2♥7♠T♣ tier=highCard ranks=[10,7,2]
DEAL seat=5 hand=Q♥J♣7♦ tier=highCard ranks=[12,11,7]
ENUM a23off actual   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off anchor   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off closed   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM classic actual   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic anchor   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic closed   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
FUZZ-ILLEGAL probes=2520 rejected=2240
FUZZ-MODE reasons=oneLeft,stakeCap,stall
FUZZ200 maxSteps=19 reasons=oneLeft=169 stakeCap=27 stall=4
HASH seed11-3calls=6915e0325b2dfd7c
REPLAY cap seed=1 hash=ca5e79a6317a9c14
REPLAY cap seed=2 hash=8df9d534e5dcfd76
REPLAY cap seed=5 hash=328737418e1c3e4b
REPLAY foldout seed=1 hash=f1fc029958ad090b
REPLAY foldout seed=2 hash=e7da3e2fd2a5b7d5
REPLAY foldout seed=5 hash=13f474c82b467bc6
REPLAY stall seed=1 hash=a2f4ccda6fb02d88
REPLAY stall seed=2 hash=67df30641b7eb34e
REPLAY stall seed=5 hash=2891e805f4e35c97
SCRIPT02 seed=1 loser1=2 loser2=0
SCRIPT05 seed=1061 pot=13 shares=7,6
SCRIPT06 seed=622 tie hands: 1=[{"rank":8,"suit":1},{"rank":14,"suit":0},{"rank":7,"suit":3}] 2=[{"rank":7,"suit":1},{"rank":8,"suit":2},{"rank":14,"suit":3}]
SEED base=20260925 h1=3776361071 h2=1243603819
SETTLE seed1-stall chips=96,108,96 pot0 total=300
SHUFFLE-FAIR trials=20000 expected=384.61538461538464 min=331 max=431
SORT1000 seed=20260925 ties=2182 first=[{"rank":10,"suit":3},{"rank":10,"suit":1},{"rank":10,"suit":0}]
TRANS full_triples=94196375 implied_triples=47201700
UI05 steps=5 结束原因：同一注级下各家各完成 3 次行动 → 强制开牌
UI06 合法比牌达成，且首圈禁比确凿生效过
UI07 rejected=7/7
UI09 hands=12 total=768 over=null
UI10 botSteps=234 raise=0 call=205 fold=29
UI11 收桌于第 1 局：只剩 1 家还付得起底注（最少需要 2 家），牌局结束
UI16 reason=stall
VECTOR mulberry32 seed=1 first8=2693262067,11749833,2265367787,4213581821,4159151403,1207330352,2632122864,3095568220
VECTOR mulberry32 seed=2 first8=3153583793,1395857638,1225337227,2310499808,3759333107,2709408573,2144054433,1534354113
VECTOR mulberry32 seed=4294967295 first8=3850105811,813802916,3073704848,4054706436,3630262831,2315588663,2922715533,2042566601
VECTOR shuffle seed=1 first12=TS 2S JS 5S 9C JH 3S 6D AD 6S KH 7C
VECTOR shuffle seed=1 last6=2D 3C QC KC 8D 4H

RUNNER files=13 cases=171
SUMMARY pass=171 fail=0 total=171
RESULT=ALL_PASS
```

## 5. `npx tsc --noEmit`

```
（无诊断输出，exit=0）
```

## 6. 变异测试（M0 面 + M1 引擎面 + M1.5 webmin 面）

```
BASELINE exit=0 pass=171 fail=0 变异条目数=77
M01 顺子常规分支失效 caught   failCases=12 exit=1 首个: test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
M02 A23 判顺失效 caught   failCases=8 exit=1 首个: test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
M03 A23 高点记成 14 caught   failCases=3 exit=1 首个: test/classify.test.ts :: classify/归一化键 顺子高点 A23=3 / 234=4 / QKA=14 且长度为 1
M04 豹子判定失效 caught   failCases=11 exit=1 首个: test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
M05 对子踢脚取错 caught   failCases=3 exit=1 首个: test/classify.test.ts :: classify/归一化键 对子=[对子点, 踢脚]，穷举 3744 手
M06 对子归一化颠倒 caught   failCases=3 exit=1 首个: test/classify.test.ts :: classify/归一化键 对子=[对子点, 踢脚]，穷举 3744 手
M07 同花顺降为顺子 caught   failCases=9 exit=1 首个: test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
M08 同花判定反转 caught   failCases=13 exit=1 首个: test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
M09 跨档比较反向 caught   failCases=10 exit=1 首个: test/compare.test.ts :: compare/06 与独立整数键参考实现交叉一致（455^2 全对）
M10 同档点数比较反向 caught   failCases=7 exit=1 首个: test/compare.test.ts :: compare/06 与独立整数键参考实现交叉一致（455^2 全对）
M12 重复牌不检查 caught   failCases=2 exit=1 首个: test/edge.test.ts :: edge/12 非法手牌：两张同一牌（同点同花）抛 TypeError
M13 rank 范围不检查 caught   failCases=1 exit=1 首个: test/edge.test.ts :: edge/13 非法牌面：rank / suit 越界、非整数、NaN 都抛 TypeError
M14 makeDeck 内层反向 caught   failCases=3 exit=1 首个: test/deck.test.ts :: deck/01 makeDeck 长度 52 且逐位满足 index = suit*13 + (rank-2)
M15 mulberry32 常数被改 caught   failCases=2 exit=1 首个: test/deck.test.ts :: deck/19 与独立誊写的参考 mulberry32 逐位一致（钉住结构与常数）
M16 mulberry32 返回有符号 caught   failCases=82 exit=1 首个: test/compare.test.ts :: compare/09 固定种子 1000 手排序后做全对序校验（不只是相邻）
M17 shuffle 取模用全长 caught   failCases=2 exit=1 首个: test/deck.test.ts :: deck/16 洗牌分布公平性：固定种子 20000 轮，52 个落点计数都在容差内
M18 shuffle 正向遍历 caught   failCases=2 exit=1 首个: test/deck.test.ts :: deck/20 rng 恒为 0 时输出等于牌堆左旋一格（钉住从尾往前的遍历方向）
M19 未知 key 不拒绝 caught   failCases=4 exit=1 首个: test/rules.test.ts :: rules/05 未知顶层 key special235=true 抛 TypeError
M20 深冻结关闭 caught   failCases=2 exit=1 首个: test/rules.test.ts :: rules/14 validateRules 返回值深冻结（顶层/嵌套/数组都改不动）
M21 tierOrder 重复不检查 caught   failCases=1 exit=1 首个: test/rules.test.ts :: rules/12 tierOrder 必须是 6 档无重复排列
M22 posInt 整数性不检查 caught   failCases=1 exit=1 首个: test/rules.test.ts :: rules/09 值类型错抛（字符串数字 / null / 非布尔）
M23 字面量字符串不校验 caught   failCases=1 exit=1 首个: test/rules.test.ts :: rules/11 字面量域的非法值抛（allIn / compare.tie / showdown.*）
M24 classic 的 a23 写成 false caught   failCases=9 exit=1 首个: test/classify.test.ts :: classify/classic 穷举 22100 手 = 锚点表
M25 classify 无视 rules 恒按 a23 判 caught   failCases=5 exit=1 首个: test/classify.test.ts :: classify/a23off 穷举 22100 手 = 闭式期望
M26 tierIndex 缺档不报错 caught   failCases=1 exit=1 首个: test/compare.test.ts :: compare/11 tierOrder 缺档时 compare 抛错而不静默
M27 同花键改成升序 caught   failCases=1 exit=1 首个: test/edge.test.ts :: edge/08 a23off 下 A♥2♥3♥ 降为同花、A♠2♦3♣ 降为单张
M28 单张键改成升序 caught   failCases=4 exit=1 首个: test/edge.test.ts :: edge/06 绕 A 不成顺：A♠K♦2♣ 是单张而不是顺子
M29 preset 深拷贝改浅拷贝 caught   failCases=1 exit=1 首个: test/rules.test.ts :: rules/15 validateRules 返回深拷贝，输入事后被改不影响副本
M30 缺 key 检查关闭 caught   failCases=1 exit=1 首个: test/rules.test.ts :: rules/08 缺 key 抛（顶层与嵌套各一例）
E01 游标不跳过已弃牌/出局者 caught   failCases=11 exit=1 首个: test/engine-fuzz.test.ts :: fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码
E02 底注没扣到人头上 caught   failCases=16 exit=1 首个: test/engine-core.test.ts :: core/01 startHand 不变量：底注入池、每人扣 ante、游标在庄家下家、计数归零
E03 首行动者变成庄家自己 caught   failCases=47 exit=1 首个: test/engine-core.test.ts :: core/01 startHand 不变量：底注入池、每人扣 ante、游标在庄家下家、计数归零
E04 发牌不按庄家下家轮转 caught   failCases=2 exit=1 首个: test/engine-core.test.ts :: core/03 发牌顺序 = 独立复算的洗牌结果（庄家下家起连续取牌）
E05 明闷跟价对调 caught   failCases=5 exit=1 首个: test/engine-illegal.test.ts :: illegal/06 重复看牌被拒；看牌不消耗行动数也不推进游标
E06 比牌费不随注级 caught   failCases=1 exit=1 首个: test/engine-money.test.ts :: money/04 比牌费 = fee × stake 入池，与闷/明无关（注级 1/2/4 各验一次）
E07 弃牌不计行动数 caught   failCases=1 exit=1 首个: test/engine-money.test.ts :: money/06 弃牌不花钱也不退钱：弃牌者的 committed 留在池里（无边池无退款）
E08 平局算被挑战者输 caught   failCases=1 exit=1 首个: test/engine-scripts.test.ts :: scripts/06 挑战者输：比牌平局时挑战者出局（§1 比牌行）
E09 剩两家比牌不开牌 caught   failCases=2 exit=1 首个: test/engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
E10 加注后不清零计数 caught   failCases=7 exit=1 首个: test/engine-core.test.ts :: core/13 终止阈值不多不少：注级 8 上各家满 2 次仍在局里，满 3 次才 stall
E11 加注不翻倍注级 caught   failCases=11 exit=1 首个: test/engine-core.test.ts :: core/13 终止阈值不多不少：注级 8 上各家满 2 次仍在局里，满 3 次才 stall
E12 终止② 丢掉注级前提 caught   failCases=28 exit=1 首个: test/engine-core.test.ts :: core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值
E13 终止③ 阈值写错成 2 caught   failCases=16 exit=1 首个: test/engine-core.test.ts :: core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值
E14 通吃也强行开牌 caught   failCases=1 exit=1 首个: test/engine-scripts.test.ts :: scripts/01 弃至通吃（§1①）：只剩一人即结束，且不开牌
E15 结算不幂等 caught   failCases=4 exit=1 首个: test/engine-fuzz.test.ts :: fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码
E16 结算后池不清零（重复入账） caught   failCases=13 exit=1 首个: test/engine-core.test.ts :: core/09 资金守恒：开局到结算，筹码 + 池恒等于买入总额
E17 余数给最后一个赢家 caught   failCases=2 exit=1 首个: test/engine-money.test.ts :: money/07 分池：整除时人人等份；有余数时给"距庄家下家最近"的赢家
E18 份额全按赢家[0] 是否拿余数发放 caught   failCases=2 exit=1 首个: test/engine-money.test.ts :: money/07 分池：整除时人人等份；有余数时给"距庄家下家最近"的赢家
E19 赢家判定不看牌力（取首家） caught   failCases=1 exit=1 首个: test/engine-scripts.test.ts :: scripts/03 封顶开牌（§1②）：注级 16 且活跃各家再完成 1 次行动 ⇒ 强制开牌
E20 首圈禁比永久解禁 caught   failCases=3 exit=1 首个: test/engine-illegal.test.ts :: illegal/04 首圈禁比：任何人第一次行动之前都不能比牌，全员各一次后立刻放开
E21 首圈禁比永不解禁 caught   failCases=9 exit=1 首个: test/engine-illegal.test.ts :: illegal/04 首圈禁比：任何人第一次行动之前都不能比牌，全员各一次后立刻放开
E22 轮次检查失效（谁都能行动） caught   failCases=4 exit=1 首个: test/engine-fuzz.test.ts :: fuzz/04 非法行动注入：一律抛 InvalidActionError，且状态指纹不变
E23 钱不够仍可跟注 caught   failCases=2 exit=1 首个: test/engine-fuzz.test.ts :: fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码
E24 注级顶格仍可加注 caught   failCases=2 exit=1 首个: test/engine-illegal.test.ts :: illegal/07 注级顶格不能再加注
E25 比牌可以打自己 caught   failCases=2 exit=1 首个: test/engine-fuzz.test.ts :: fuzz/04 非法行动注入：一律抛 InvalidActionError，且状态指纹不变
E26 视图泄露他人手牌 caught   failCases=7 exit=1 首个: test/engine-project.test.ts :: project/01 下注中：viewer 只看得见自己的牌，他人一律 unknown
E27 视图提前泄露 seed caught   failCases=1 exit=1 首个: test/engine-project.test.ts :: project/05 seed 只在结算后才暴露（否则任何客户端都能反算整副牌）
E28 终局判定被跳过 caught   failCases=31 exit=1 首个: test/engine-core.test.ts :: core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值
E29 加注退回读法 A（付旧注级跟价） caught   failCases=1 exit=1 首个: test/engine-money.test.ts :: money/03 加注：注级翻倍并按新注级付跟价（Q1 读法 B），且全员当前注级行动数清零
E30 加注按新注级但忽略闷/明 caught   failCases=1 exit=1 首个: test/engine-money.test.ts :: money/03 加注：注级翻倍并按新注级付跟价（Q1 读法 B），且全员当前注级行动数清零
E31 加注不花钱 caught   failCases=2 exit=1 首个: test/engine-illegal.test.ts :: illegal/08 钱不够 ⇒ 唯一合法行动是弃牌（全押禁用，§1 全押行）
W01 桌上总额漏算池 caught   failCases=4 exit=1 首个: test/webmin-model.test.ts :: ui/01 createSession 建立座位、首局与台账
W02 庄家不轮转（原地坐庄） caught   failCases=1 exit=1 首个: test/webmin-model.test.ts :: ui/08 再来一局：局号 +1、庄家轮转到下家、总额守恒
W03 不剔除付不起底注的座位 caught   failCases=1 exit=1 首个: test/webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
W04 每局用同一份牌序 caught   failCases=1 exit=1 首个: test/webmin-model.test.ts :: ui/03 deriveSeed 确定、逐局不同、不用时钟
W05 单张高注级也不弃 caught   failCases=1 exit=1 首个: test/webmin-model.test.ts :: ui/10b 占位策略三条臂点测：强牌加注、中等跟注、烂牌弃牌
W06 豹子不加注 caught   failCases=1 exit=1 首个: test/webmin-model.test.ts :: ui/10b 占位策略三条臂点测：强牌加注、中等跟注、烂牌弃牌
W07 机器人误以为比牌合法 caught   failCases=1 exit=1 首个: test/webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
W08 未结算也能开下一局 caught   failCases=1 exit=1 首个: test/webmin-model.test.ts :: ui/07 乱点不崩：非法意图 ok:false 且指纹不变；整桌重来永远可点
W09 收桌后仍可继续行动 caught   failCases=1 exit=1 首个: test/webmin-model.test.ts :: ui/11 桌上只剩一家付不起底注时收桌，且只允许整桌重来
W10 待结算时不给结算按钮 caught   failCases=6 exit=1 首个: test/webmin-model.test.ts :: ui/05 真人+机器人打完一整局：走到结算，台账守恒
W11 座位行丢掉"本局已投入" caught   failCases=1 exit=1 首个: test/webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
W12 状态行丢掉池额 caught   failCases=1 exit=1 首个: test/webmin-model.test.ts :: ui/12 视图字符串满足"信息全优先"
W13 放行任意扩展名 caught   failCases=1 exit=1 首个: test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
W14 取消目录白名单 caught   failCases=1 exit=1 首个: test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
W15 根路径不再重定向（页面起不来） caught   failCases=1 exit=1 首个: test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
W16 .ts 不做类型剥离直接吐给浏览器 caught   failCases=1 exit=1 首个: test/webmin-model.test.ts :: ui/13 静态服务的白名单与路径穿越防护
W17 取消项目根越界检查 NOT-CAUGHT <<<< failCases=0 exit=0
RESTORE src/cards.ts OK a9ed6efde3cf
RESTORE src/rules.ts OK f162a6a35708
RESTORE src/engine/state.ts OK 14a86cf4c7dd
RESTORE src/engine/validate.ts OK f78d93c5abfb
RESTORE src/engine/actions.ts OK 23a203c3c3fe
RESTORE src/engine/settle.ts OK ff205d18b553
RESTORE src/engine/project.ts OK c1939eb71650
RESTORE webmin/model.ts OK 661ebfbf0c2b
RESTORE webmin/serve.ts OK f77c41f9a040
```

### 6.1 本轮新增的存活史（先逃掉、补断言后才被抓）

- **W05 / W06（机器人策略的弃牌臂、加注臂）**：`ui/10` 原来只用随机对局采样，而豹子/同花顺每手概率约 0.45%，234 次机器人决策里 `raise` 一次都没出现 ⇒ 加注臂**根本没被验证过**。改成把策略当纯函数点测：直接构造一手豹子/对子/单张 + 指定注级，逐条断言它选 raise/call/fold（`ui/10b`）。补完之后 W05、W06 都被抓。
- **W15（根路径不再 302）**：见第 7 节，这是浏览器里真实踩到并修掉的 bug，`ui/13` 现在有专门断言。

### 6.2 唯一存活项 W17 的说明（不是盲区）

`W17 取消项目根越界检查` 没被抓到，原因是 `resolveStatic` 里有**两道独立防线**：先判"解析后是否仍在项目根内"，再判"是否落在 `webmin`/`src` 白名单目录内"。去掉第一道后，第二道仍然拒掉所有越界路径 ⇒ 行为无差别，测试自然看不到。
这是纵深防御而非漏洞：第二道防线本身是被测过的（`W14 取消目录白名单` → caught；`ui/13` 的 12 条越界/越目录/未知扩展名全部断言拒绝）。
另外 `ui/13` 补了两条**反向**断言：归一化后仍落在允许目录内的路径（`/webmin/../src/cards.ts`）必须放行，避免"见 `..` 就拒"这种假安全实现。

## 7. 真浏览器实测（对齐验收 ② ③）

启动：`node webmin/serve.ts 8125` → 浏览器打开 `http://127.0.0.1:8125/`（自动 302 到 `/webmin/index.html`）。
操作全部通过**真实 DOM 按钮点击**完成（`button[data-kind]` + `data-legal` + `data-target`），页面侧另留了 `window.__zjh` 只读钩子便于取状态。

### 7.1 一整局（1 真人 + 2 电脑，种子 20260925，买入 256）

真实点击序列（脚本按"合法才可点"筛按钮）：

```
非法点击 settle → 被拒（nothing_to_settle，rejections=1，页面继续可操作）
真人发起比牌 → 座位1        （比牌按钮 data-target="1"）
settle                     （结算面板出现"结束原因…"+ 各人牌型 + 指纹）
nextHand                   （第 2 局开始，庄家由"你"轮转到"电脑1"）
```

回读到的关键状态：

```
compared=true  settledSeen=true  handIndex=2  phase=betting
ledgerTotal=768  liveTotal=768  clicks=5  rejections=1
status=第 2 局 · 庄家 电脑1 · 注级 1 · 池 4 · 轮到 你 · 牌型判定 A23=最小顺
seats=
  ◀  你[你] | 筹码 251 | 本局已投入 1 | 闷 | 行动中 | 牌 3♦ K♠ 8♦ (单张)
  庄  电脑1[电脑] | 筹码 263 | 本局已投入 1 | 闷 | 局中 | 牌 ···
      电脑2[电脑] | 筹码 250 | 本局已投入 2 | 闷 | 局中 | 牌 ···
```

### 7.2 另一局（1 真人 + 3 电脑，种子 777，买入 300）验证看牌/加注/结算文案

```
看牌 → 加注（日志 #006 raise 你 出 4 @注级2｜stake 1→2）→ 三家弃牌
#010 terminal — 出 11 @注级2｜oneLeft:0
#011 settle   — 出 11 @注级2｜oneLeft:0:remainder=-1
结算面板：
  结束原因：其他人都不在了 → 不开牌通吃
  你[你]｜5♦ 7♥ A♠ 单张｜赢 11（现筹码 306）
  电脑1[电脑]｜未开牌｜没赢（现筹码 298）
  电脑2[电脑]｜未开牌｜没赢（现筹码 298）
  电脑3[电脑]｜未开牌｜没赢（现筹码 298）
  指纹 424d62b43336f6be
台账：你=306 电脑1=298 电脑2=298 电脑3=298 ｜ 桌上总额 1200（= 4×300，守恒）
```

其中"加注出 4"正是 Q1 裁定读法 B 的现场体现：明牌玩家把注级从 1 加到 2 ⇒ 付新注级 2 × `bet.seen` 2 = 4。

截图：`evidence/m15-page-after-settlement.png`（整页，含座位/行动/结算/日志/机器状态各区）。

### 7.3 浏览器实测真实抓到并修掉的两个缺陷

1. **页面根本起不来**：服务把 `/` **就地**返回 `webmin/index.html`，文档 URL 仍是 `/`，于是 `<script src="./app.ts">` 被浏览器解析成 `/app.ts` → 命中白名单 403 → 控制台报错、`window.__zjh` 不存在。修法：`/`、`/index.html`、`/webmin/` 一律 **302 到 `/webmin/index.html`**（`redirectTarget()` 纯函数 + `ui/13` 断言 + 变异项 W15）。
2. **比牌按钮会误导**：按钮目标取自一个下拉框，而每次重渲染后合法目标可能已变，点下去得到的是 `bad_target`（我第一轮自动化就是这么误点了"无合法目标"的演示按钮）。修法：**每个合法目标各渲染一个比牌按钮**（带 `data-target`），删掉下拉框；没有合法目标时那个按钮明确标成"比牌（无合法目标）"且 `data-legal=false`。


---

# 附录 A：rev 2（M1）交付记录原文

# TEST-OUTPUT.md —— M1 完整测试输出与复现证据（DELIVERY rev 2）

> 交付物之一（工单 §0.3）。自评表在 `SELF-REVIEW.md`（M1 在前，M0 原文保留在附录）。
> 下面所有输出都是命令的真实产物，未手工转写。本文件不含时间戳。
> rev 1（M0）的输出是本文第 4 节全量输出的子集（M0 面 92 例全部包含在内），M0 的裁定记录在 `REVIEW.md`。

## 1. 环境

| 项 | 值 |
|---|---|
| Node | v24.19.0（`process.features.typescript = "strip"`） |
| OS / Shell | win32 10.0.22631 / Git Bash |
| 运行时依赖 | 无（`npm test` 不需要 node_modules） |
| 工具链依赖 | typescript 7.0.2 + @types/node 26.6.2，仅 `npm run typecheck` 用 |

## 2. 命令与退出码

| # | 命令 | 结果 |
|---|---|---|
| 1 | `npm test` | exit=0，153 例全过（原文见第 4 节） |
| 2 | `npm test` 紧接着再跑一次 | exit=0，输出与第 1 次逐字节相同 |
| 3 | `npx tsc --noEmit` | exit=0，无诊断 |
| 4 | `node --test test/engine-money.test.ts`（node:test 兼容道） | 10 tests / 10 pass / 0 fail |
| 5 | 变异测试（脚本不随交付，全文见第 6 节） | 60/60 caught，0 NOT-CAUGHT，0 SKIPPED，0 CORRUPT |

## 3. §0.5 双跑一致性证据

```
run1_exit=0 run2_exit=0
DIFF=IDENTICAL
456f6b47d156d1da55767e4eea239b53d0eaf512b589e9f263709850e6061bec *ev1.txt
456f6b47d156d1da55767e4eea239b53d0eaf512b589e9f263709850e6061bec *ev2.txt
```

两次运行 sha256 相同 ⇒ 输出里没有耗时、时间戳、随机顺序（`fuzz`/`compare` 的全部随机性都是固定种子）。
自持 reporter 的原因写在 `test/harness.ts` 顶部注释（node 内置 reporter 会打印 `(1.234ms)` 与 `duration_ms`；自定义 `--test-reporter` 在进程隔离下拿不到子测试事件、`test:fail.data.error` 为空 —— 本机实测）。

## 4. `npm test` 完整输出（第 1 次运行原文）

```

> zjh@0.0.0 test
> node test/run.ts

=== ZJH TEST REPORT (deterministic) ===
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/classic 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/classic 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 闭式期望
PASS test/classify.test.ts :: classify/a23off 穷举 22100 手 = 锚点表
PASS test/classify.test.ts :: classify/a23off 枚举手数与六类之和都等于 22100
PASS test/classify.test.ts :: classify/档位集合 六档键完全一致且无重复，计数均为非负整数
PASS test/classify.test.ts :: classify/闭式结构 trips 与 pair 与 a23 无关，其余四类随 runs 移动
PASS test/classify.test.ts :: classify/输入顺序无关 455 规范类 × 6 排列判定全同（两 preset）
PASS test/classify.test.ts :: classify/A23 一族 64 手在两 preset 下的迁移符合公式
PASS test/classify.test.ts :: classify/归一化键 顺子高点 A23=3 / 234=4 / QKA=14 且长度为 1
PASS test/classify.test.ts :: classify/归一化键 对子=[对子点, 踢脚]，穷举 3744 手
PASS test/classify.test.ts :: classify/归一化键 豹子 ranks=[r]，穷举 52 手
PASS test/classify.test.ts :: classify/NOTES 打印计数三元组（实际/闭式/锚点）供独立复算
PASS test/compare.test.ts :: compare/01 规范类数量 = C(15,3) = 455
PASS test/compare.test.ts :: compare/02 自反：每类与自身比较 = 0
PASS test/compare.test.ts :: compare/03 反对称：455^2 = 207025 全对，cmp(a,b) = -cmp(b,a)
PASS test/compare.test.ts :: compare/04 传递性穷举：(a>=b && b>=c) ⇒ a>=c，全 455^3 三元组
PASS test/compare.test.ts :: compare/05 花色不参与：全体花色平移 +1 后仍判 0
PASS test/compare.test.ts :: compare/06 与独立整数键参考实现交叉一致（455^2 全对）
PASS test/compare.test.ts :: compare/07 tierOrder 整序反转：跨档对全部翻转、同档对不变
PASS test/compare.test.ts :: compare/08 tierOrder 局部改动即刻生效（把 pair 提到 trips 之上）
PASS test/compare.test.ts :: compare/09 固定种子 1000 手排序后做全对序校验（不只是相邻）
PASS test/compare.test.ts :: compare/10 牌型序链：豹子>同花顺>同花>顺子>对子>单张（15 对全断言）
PASS test/compare.test.ts :: compare/11 tierOrder 缺档时 compare 抛错而不静默
PASS test/compare.test.ts :: compare/12 档位优先于点数：最小同花顺 > 最大普通顺等交叉断言
PASS test/deck.test.ts :: deck/01 makeDeck 长度 52 且逐位满足 index = suit*13 + (rank-2)
PASS test/deck.test.ts :: deck/02 52 张互不相同
PASS test/deck.test.ts :: deck/03 makeDeck 每次返回新数组与新对象（无共享可变状态）
PASS test/deck.test.ts :: deck/04 mulberry32 同 seed 的 1000 项序列完全一致
PASS test/deck.test.ts :: deck/05 不同 seed 的序列不同
PASS test/deck.test.ts :: deck/06 输出恒为非负 uint32 整数（1e6 次采样，覆盖边界 seed）
PASS test/deck.test.ts :: deck/07 seed 非整数抛 TypeError
PASS test/deck.test.ts :: deck/08 shuffle 原地：返回值与入参是同一个数组引用
PASS test/deck.test.ts :: deck/09 shuffle 结果是原牌堆的一个排列
PASS test/deck.test.ts :: deck/10 同 seed 两次洗牌逐位一致，不同 seed 至少一处不同
PASS test/deck.test.ts :: deck/11 52 张牌恰好调用 rng 51 次
PASS test/deck.test.ts :: deck/12 rng 返回浮点/负数/非数一律抛 TypeError
PASS test/deck.test.ts :: deck/13 空牌堆与单元素牌堆不调用 rng、不抛
PASS test/deck.test.ts :: deck/14 发牌烟雾：seed=1 洗完发 6 家，每手都可判定
PASS test/deck.test.ts :: deck/16 洗牌分布公平性：固定种子 20000 轮，52 个落点计数都在容差内
PASS test/deck.test.ts :: deck/17 三张牌穷举 144 种 rng 输出：每张牌的落点计数恰为 48
PASS test/deck.test.ts :: deck/18 NOTES 打印 PRNG 与洗牌的规范向量（供跨端复算）
PASS test/deck.test.ts :: deck/19 与独立誊写的参考 mulberry32 逐位一致（钉住结构与常数）
PASS test/deck.test.ts :: deck/20 rng 恒为 0 时输出等于牌堆左旋一格（钉住从尾往前的遍历方向）
PASS test/edge.test.ts :: edge/01 §3.5 A♠2♦3♣ < 3♠4♦5♣（A23 是最小顺）
PASS test/edge.test.ts :: edge/02 §3.5 A♥2♥3♥ 是同花顺且 > 4♣5♦6♣（档位优先于点数）
PASS test/edge.test.ts :: edge/03 §3.5 2♦2♣2♥ > A♠K♠Q♠（豹子 > 同花顺）
PASS test/edge.test.ts :: edge/04 §3.5 A♦A♣3♠ > K♦K♣A♠（对子点优先，踢脚再大也没用）
PASS test/edge.test.ts :: edge/05 §3.5 同点同级 → 0（花色完全不参与）
PASS test/edge.test.ts :: edge/06 绕 A 不成顺：A♠K♦2♣ 是单张而不是顺子
PASS test/edge.test.ts :: edge/07 最大豹子 > 最小豹子 > 任意同花顺
PASS test/edge.test.ts :: edge/08 a23off 下 A♥2♥3♥ 降为同花、A♠2♦3♣ 降为单张
PASS test/edge.test.ts :: edge/09 A 在非顺子牌型里取 14
PASS test/edge.test.ts :: edge/10 归一化键长度按档固定：豹子/顺 1 位、对子 2 位、同花/单张 3 位
PASS test/edge.test.ts :: edge/11 非法手牌：长度≠3 抛 TypeError
PASS test/edge.test.ts :: edge/12 非法手牌：两张同一牌（同点同花）抛 TypeError
PASS test/edge.test.ts :: edge/13 非法牌面：rank / suit 越界、非整数、NaN 都抛 TypeError
PASS test/edge.test.ts :: edge/14 非法手牌容器：非数组 / 元素非对象 / 缺字段抛 TypeError
PASS test/edge.test.ts :: edge/15 compare 两侧都继承 classify 的非法输入检查
PASS test/edge.test.ts :: edge/16 rules 结构缺失时不静默：缺 handEval 抛 TypeError
PASS test/edge.test.ts :: edge/17 单张的型内比较只看归一化后的三点
PASS test/engine-core.test.ts :: core/01 startHand 不变量：底注入池、每人扣 ante、游标在庄家下家、计数归零
PASS test/engine-core.test.ts :: core/02 发牌互不重叠且都来自标准 52 张
PASS test/engine-core.test.ts :: core/03 发牌顺序 = 独立复算的洗牌结果（庄家下家起连续取牌）
PASS test/engine-core.test.ts :: core/04 庄家必须在座位表里
PASS test/engine-core.test.ts :: core/05 配置非法一律抛 TypeError（人数越界 / 重复座位 / 付不起底注 / seed 非整数）
PASS test/engine-core.test.ts :: core/06 apply 是纯函数：对旧状态深冻结后再推进行动，不抛（说明没有原地写）
PASS test/engine-core.test.ts :: core/07 stateHash 对状态变化敏感、对重放稳定
PASS test/engine-core.test.ts :: core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值
PASS test/engine-core.test.ts :: core/09 资金守恒：开局到结算，筹码 + 池恒等于买入总额
PASS test/engine-core.test.ts :: core/10 同一配置重复开局得到同一状态（引擎里没有隐藏全局态）
PASS test/engine-core.test.ts :: core/11 日志单调：seq 逐条 +1，type 全部来自固定集合
PASS test/engine-core.test.ts :: core/12 引擎对 2 人与 6 人都能开局（人数只受 rules.players 约束，不硬编码）
PASS test/engine-core.test.ts :: core/13 终止阈值不多不少：注级 8 上各家满 2 次仍在局里，满 3 次才 stall
PASS test/engine-fuzz.test.ts :: fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码
PASS test/engine-fuzz.test.ts :: fuzz/02 三种终止条件都能被随机行动打到（换策略覆盖 ②③）
PASS test/engine-fuzz.test.ts :: fuzz/03 2–6 人局全部跑通且守恒
PASS test/engine-fuzz.test.ts :: fuzz/04 非法行动注入：一律抛 InvalidActionError，且状态指纹不变
PASS test/engine-fuzz.test.ts :: fuzz/05 回放确定性：同 seed + 同行动序列 ⇒ 同指纹（20 局）
PASS test/engine-fuzz.test.ts :: fuzz/06 结算幂等：settle 前后指纹稳定，且只入账一次
PASS test/engine-illegal.test.ts :: illegal/01 不轮到你 → not_current_turn（三种动作各一例）
PASS test/engine-illegal.test.ts :: illegal/02 座位不存在 → bad_seat
PASS test/engine-illegal.test.ts :: illegal/03 行动对象本身不合法 → unknown_action
PASS test/engine-illegal.test.ts :: illegal/04 首圈禁比：任何人第一次行动之前都不能比牌，全员各一次后立刻放开
PASS test/engine-illegal.test.ts :: illegal/05 比牌目标非法：自己 / 已弃牌 / 不存在的座位
PASS test/engine-illegal.test.ts :: illegal/06 重复看牌被拒；看牌不消耗行动数也不推进游标
PASS test/engine-illegal.test.ts :: illegal/07 注级顶格不能再加注
PASS test/engine-illegal.test.ts :: illegal/08 钱不够 ⇒ 唯一合法行动是弃牌（全押禁用，§1 全押行）
PASS test/engine-illegal.test.ts :: illegal/09 已弃牌的座位不会再被要求行动，硬塞则 seat_not_active
PASS test/engine-illegal.test.ts :: illegal/10 终局后所有下注类行动被拒（phase_not_betting）
PASS test/engine-illegal.test.ts :: illegal/11 结算时机：没终局不能 settle；已结算再 settle 是幂等 no-op
PASS test/engine-illegal.test.ts :: illegal/12 legalActions 与 checkAction 判据完全一致（不轮到你时给出的是当前 turn 的动作集）
PASS test/engine-illegal.test.ts :: illegal/13 timeout 是普通行动：等价于弃牌，并且要过同一道 validate
PASS test/engine-money.test.ts :: money/01 底注：pool = ante × 人数，每人筹码与 committed 各扣/记一份
PASS test/engine-money.test.ts :: money/02 闷跟 = stake×bet.dark，明跟 = stake×bet.seen（三种注级各验）
PASS test/engine-money.test.ts :: money/03 加注：注级翻倍并按新注级付跟价（Q1 读法 B），且全员当前注级行动数清零
PASS test/engine-money.test.ts :: money/04 比牌费 = fee × stake 入池，与闷/明无关（注级 1/2/4 各验一次）
PASS test/engine-money.test.ts :: money/05 不变量：pot 恒等于各家 committed 之和；每步增量恰是 actionCost
PASS test/engine-money.test.ts :: money/06 弃牌不花钱也不退钱：弃牌者的 committed 留在池里（无边池无退款）
PASS test/engine-money.test.ts :: money/07 分池：整除时人人等份；有余数时给"距庄家下家最近"的赢家
PASS test/engine-money.test.ts :: money/08 幂等结算：入账只发生一次，重放 settle 不重复扣/发钱
PASS test/engine-money.test.ts :: money/09 任何时刻都不出现负筹码（全押禁用的直接后果）
PASS test/engine-money.test.ts :: money/10 结算后赢家所得 = 池，且各家 committed 之和 = 结算前 pot
PASS test/engine-project.test.ts :: project/01 下注中：viewer 只看得见自己的牌，他人一律 unknown
PASS test/engine-project.test.ts :: project/02 序列化后仍然搜不到任何他人牌面（整条 view 一起查，含日志）
PASS test/engine-project.test.ts :: project/03 强制开牌后：活跃家全部可见，弃牌/被淘汰者仍然 unknown
PASS test/engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
PASS test/engine-project.test.ts :: project/05 seed 只在结算后才暴露（否则任何客户端都能反算整副牌）
PASS test/engine-project.test.ts :: project/06 公开信息一字不漏：池/注级/游标/计数/闷明/committed 全部同步
PASS test/engine-project.test.ts :: project/07 观战视角（viewer 不在座位表里）看不到任何未开的牌
PASS test/engine-project.test.ts :: project/08 视图是拷贝，改它不会污染引擎状态
PASS test/engine-project.test.ts :: project/09 终局信息公开：赢家集合、份额、余数归属都可投影
PASS test/engine-project.test.ts :: project/10 startHand 之后立刻投影，也不该泄露底牌给下一个行动者
PASS test/engine-scripts.test.ts :: scripts/01 弃至通吃（§1①）：只剩一人即结束，且不开牌
PASS test/engine-scripts.test.ts :: scripts/02 比牌链：连续两次比牌各淘汰一家，输家的牌永不公开
PASS test/engine-scripts.test.ts :: scripts/03 封顶开牌（§1②）：注级 16 且活跃各家再完成 1 次行动 ⇒ 强制开牌
PASS test/engine-scripts.test.ts :: scripts/04 stall 强开（§1③）：同一注级下活跃各家各满 3 次行动；加注会把计数清零重计
PASS test/engine-scripts.test.ts :: scripts/05 平局分池：两家打平 ⇒ 平分池，除不尽的余数给距庄家下家最近者
PASS test/engine-scripts.test.ts :: scripts/06 挑战者输：比牌平局时挑战者出局（§1 比牌行）
PASS test/engine-scripts.test.ts :: scripts/07 剩两家比牌 = 直接开牌定胜负（两家牌都亮）
PASS test/engine-scripts.test.ts :: scripts/08 三条终止路径各自都要能到达（覆盖性，不是只测一条）
PASS test/engine-scripts.test.ts :: scripts/09 每个脚本重放得到同一状态指纹（回放确定性）
PASS test/rules.test.ts :: rules/01 presets.classic 幂等通过 validateRules
PASS test/rules.test.ts :: rules/02 presets.a23off 幂等通过 validateRules
PASS test/rules.test.ts :: rules/03 两个 preset 仅在 handEval.a23 上不同
PASS test/rules.test.ts :: rules/04 classic 的每个数值逐项等于工单 §1 表格
PASS test/rules.test.ts :: rules/05 未知顶层 key special235=true 抛 TypeError
PASS test/rules.test.ts :: rules/06 未知 key 即使值为 false 也抛（不在 v1 schema）
PASS test/rules.test.ts :: rules/07 未知嵌套 key 抛（handEval / bet 内）
PASS test/rules.test.ts :: rules/08 缺 key 抛（顶层与嵌套各一例）
PASS test/rules.test.ts :: rules/09 值类型错抛（字符串数字 / null / 非布尔）
PASS test/rules.test.ts :: rules/10 version 必须是字面量 1
PASS test/rules.test.ts :: rules/11 字面量域的非法值抛（allIn / compare.tie / showdown.*）
PASS test/rules.test.ts :: rules/12 tierOrder 必须是 6 档无重复排列
PASS test/rules.test.ts :: rules/13 非对象输入一律抛
PASS test/rules.test.ts :: rules/14 validateRules 返回值深冻结（顶层/嵌套/数组都改不动）
PASS test/rules.test.ts :: rules/15 validateRules 返回深拷贝，输入事后被改不影响副本
PASS test/rules.test.ts :: rules/16 presets 本身深冻结
PASS test/rules.test.ts :: rules/17 错误消息点名违规所在路径与 key
PASS test/static.test.ts :: static/00 扫描范围覆盖 cards / rules / engine 全部源文件
PASS test/static.test.ts :: static/01 src 里不出现时钟与随机全局态
PASS test/static.test.ts :: static/02 src 里不出现文件、网络与控制台 IO
PASS test/static.test.ts :: static/03 src 不引用任何运行时全局可变对象
PASS test/static.test.ts :: static/04 import 只允许相对路径；M0 两文件只允许 import type ./rules.ts
PASS test/static.test.ts :: static/05 src 只用可擦除语法（禁 enum / namespace / 装饰器 / 构造参数属性）
PASS test/static.test.ts :: static/06 零运行时依赖：dependencies 必须为空（或整体不存在）
PASS test/static.test.ts :: static/07 devDependencies 落在工单白名单内
PASS test/static.test.ts :: static/08 npm test 是单命令，且不依赖任何已安装依赖
PASS test/static.test.ts :: static/09 tsconfig 打开 strict 与 erasableSyntaxOnly
PASS test/static.test.ts :: static/10 输出生产者 test/run.ts 不引用时钟（保证两次运行一致）
PASS test/static.test.ts :: static/11 测试目录可被 runner 发现且无空目录
PASS test/static.test.ts :: static/12 M0 冻结接口：cards/rules 的导出名恰好是 §2.7 契约（不夹带私有实现的导出）

=== NOTES (fixed vectors, recompute-able independently) ===
CANONICAL mulberry32 seed=1 float_first=0.6270739405881613
CMP 2S 2D 9C vs 3S 4D 5C = -1
CMP 2S 3D 4C vs AS KS QS = -1
CMP 4S 9S JS vs AS 2S 3S = -1
CMP 9S 9D 2C vs 9C 9S 2D = 0
CMP AS 2S 3S vs QD KC JS = 1
DEAL seat=0 hand=T♠2♠J♠ tier=flush ranks=[11,10,2]
DEAL seat=1 hand=5♠9♣J♥ tier=highCard ranks=[11,9,5]
DEAL seat=2 hand=3♠6♦A♦ tier=highCard ranks=[14,6,3]
DEAL seat=3 hand=6♠K♥7♣ tier=highCard ranks=[13,7,6]
DEAL seat=4 hand=2♥7♠T♣ tier=highCard ranks=[10,7,2]
DEAL seat=5 hand=Q♥J♣7♦ tier=highCard ranks=[12,11,7]
ENUM a23off actual   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off anchor   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM a23off closed   trips=52 straightFlush=44 flush=1100 straight=660 pair=3744 highCard=16500
ENUM classic actual   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic anchor   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
ENUM classic closed   trips=52 straightFlush=48 flush=1096 straight=720 pair=3744 highCard=16440
FUZZ-ILLEGAL probes=2520 rejected=2240
FUZZ-MODE reasons=oneLeft,stakeCap,stall
FUZZ200 maxSteps=19 reasons=oneLeft=169 stakeCap=27 stall=4
HASH seed11-3calls=6915e0325b2dfd7c
REPLAY cap seed=1 hash=ca5e79a6317a9c14
REPLAY cap seed=2 hash=8df9d534e5dcfd76
REPLAY cap seed=5 hash=328737418e1c3e4b
REPLAY foldout seed=1 hash=f1fc029958ad090b
REPLAY foldout seed=2 hash=e7da3e2fd2a5b7d5
REPLAY foldout seed=5 hash=13f474c82b467bc6
REPLAY stall seed=1 hash=a2f4ccda6fb02d88
REPLAY stall seed=2 hash=67df30641b7eb34e
REPLAY stall seed=5 hash=2891e805f4e35c97
SCRIPT02 seed=1 loser1=2 loser2=0
SCRIPT05 seed=1061 pot=13 shares=7,6
SCRIPT06 seed=622 tie hands: 1=[{"rank":8,"suit":1},{"rank":14,"suit":0},{"rank":7,"suit":3}] 2=[{"rank":7,"suit":1},{"rank":8,"suit":2},{"rank":14,"suit":3}]
SETTLE seed1-stall chips=96,108,96 pot0 total=300
SHUFFLE-FAIR trials=20000 expected=384.61538461538464 min=331 max=431
SORT1000 seed=20260925 ties=2182 first=[{"rank":10,"suit":3},{"rank":10,"suit":1},{"rank":10,"suit":0}]
TRANS full_triples=94196375 implied_triples=47201700
VECTOR mulberry32 seed=1 first8=2693262067,11749833,2265367787,4213581821,4159151403,1207330352,2632122864,3095568220
VECTOR mulberry32 seed=2 first8=3153583793,1395857638,1225337227,2310499808,3759333107,2709408573,2144054433,1534354113
VECTOR mulberry32 seed=4294967295 first8=3850105811,813802916,3073704848,4054706436,3630262831,2315588663,2922715533,2042566601
VECTOR shuffle seed=1 first12=TS 2S JS 5S 9C JH 3S 6D AD 6S KH 7C
VECTOR shuffle seed=1 last6=2D 3C QC KC 8D 4H

RUNNER files=12 cases=153
SUMMARY pass=153 fail=0 total=153
RESULT=ALL_PASS
```

## 5. `npx tsc --noEmit`

```
（无诊断输出，exit=0）
```

## 6. 变异测试：测试脚本自身被验证

做法：把 `src/`（含 `src/engine/`）逐条改坏 → 跑同一套测试 → 要求 exit≠0 且出现 FAIL → 立即还原并核对 sha256。
`SKIPPED` = 变异锚点在源码中出现次数≠1；`NOT-CAUGHT` = 测试盲区；`CORRUPT` = 还原失败。

```
BASELINE exit=0 pass=153 fail=0
M01 顺子常规分支失效 caught   failCases=12 exit=1 首个: test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
M02 A23 判顺失效 caught   failCases=8 exit=1 首个: test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
M03 A23 高点记成 14 caught   failCases=3 exit=1 首个: test/classify.test.ts :: classify/归一化键 顺子高点 A23=3 / 234=4 / QKA=14 且长度为 1
M04 豹子判定失效 caught   failCases=10 exit=1 首个: test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
M05 对子踢脚取错 caught   failCases=3 exit=1 首个: test/classify.test.ts :: classify/归一化键 对子=[对子点, 踢脚]，穷举 3744 手
M06 对子归一化颠倒 caught   failCases=3 exit=1 首个: test/classify.test.ts :: classify/归一化键 对子=[对子点, 踢脚]，穷举 3744 手
M07 同花顺降为顺子 caught   failCases=9 exit=1 首个: test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
M08 同花判定反转 caught   failCases=12 exit=1 首个: test/classify.test.ts :: classify/classic 穷举 22100 手 = 闭式期望
M09 跨档比较反向 caught   failCases=10 exit=1 首个: test/compare.test.ts :: compare/06 与独立整数键参考实现交叉一致（455^2 全对）
M10 同档点数比较反向 caught   failCases=7 exit=1 首个: test/compare.test.ts :: compare/06 与独立整数键参考实现交叉一致（455^2 全对）
M12 重复牌不检查 caught   failCases=2 exit=1 首个: test/edge.test.ts :: edge/12 非法手牌：两张同一牌（同点同花）抛 TypeError
M13 rank 范围不检查 caught   failCases=1 exit=1 首个: test/edge.test.ts :: edge/13 非法牌面：rank / suit 越界、非整数、NaN 都抛 TypeError
M14 makeDeck 内层反向 caught   failCases=3 exit=1 首个: test/deck.test.ts :: deck/01 makeDeck 长度 52 且逐位满足 index = suit*13 + (rank-2)
M15 mulberry32 常数被改 caught   failCases=2 exit=1 首个: test/deck.test.ts :: deck/19 与独立誊写的参考 mulberry32 逐位一致（钉住结构与常数）
M16 mulberry32 返回有符号 caught   failCases=69 exit=1 首个: test/compare.test.ts :: compare/09 固定种子 1000 手排序后做全对序校验（不只是相邻）
M17 shuffle 取模用全长 caught   failCases=2 exit=1 首个: test/deck.test.ts :: deck/16 洗牌分布公平性：固定种子 20000 轮，52 个落点计数都在容差内
M18 shuffle 正向遍历 caught   failCases=2 exit=1 首个: test/deck.test.ts :: deck/20 rng 恒为 0 时输出等于牌堆左旋一格（钉住从尾往前的遍历方向）
M19 未知 key 不拒绝 caught   failCases=4 exit=1 首个: test/rules.test.ts :: rules/05 未知顶层 key special235=true 抛 TypeError
M20 深冻结关闭 caught   failCases=2 exit=1 首个: test/rules.test.ts :: rules/14 validateRules 返回值深冻结（顶层/嵌套/数组都改不动）
M21 tierOrder 重复不检查 caught   failCases=1 exit=1 首个: test/rules.test.ts :: rules/12 tierOrder 必须是 6 档无重复排列
M22 posInt 整数性不检查 caught   failCases=1 exit=1 首个: test/rules.test.ts :: rules/09 值类型错抛（字符串数字 / null / 非布尔）
E31 加注不花钱（Q1 读法 B 的退化解） caught   failCases=2 exit=1 首个: test/engine-illegal.test.ts :: illegal/08 钱不够 ⇒ 唯一合法行动是弃牌（全押禁用，§1 全押行）
M23 字面量字符串不校验 caught   failCases=1 exit=1 首个: test/rules.test.ts :: rules/11 字面量域的非法值抛（allIn / compare.tie / showdown.*）
M24 classic 的 a23 写成 false caught   failCases=9 exit=1 首个: test/classify.test.ts :: classify/classic 穷举 22100 手 = 锚点表
M25 classify 无视 rules 恒按 a23 判 caught   failCases=5 exit=1 首个: test/classify.test.ts :: classify/a23off 穷举 22100 手 = 闭式期望
M26 tierIndex 缺档不报错 caught   failCases=1 exit=1 首个: test/compare.test.ts :: compare/11 tierOrder 缺档时 compare 抛错而不静默
M27 同花键改成升序 caught   failCases=1 exit=1 首个: test/edge.test.ts :: edge/08 a23off 下 A♥2♥3♥ 降为同花、A♠2♦3♣ 降为单张
M28 单张键改成升序 caught   failCases=4 exit=1 首个: test/edge.test.ts :: edge/06 绕 A 不成顺：A♠K♦2♣ 是单张而不是顺子
M29 preset 深拷贝改浅拷贝 caught   failCases=1 exit=1 首个: test/rules.test.ts :: rules/15 validateRules 返回深拷贝，输入事后被改不影响副本
M30 缺 key 检查关闭 caught   failCases=1 exit=1 首个: test/rules.test.ts :: rules/08 缺 key 抛（顶层与嵌套各一例）
E01 游标不跳过已弃牌/出局者 caught   failCases=9 exit=1 首个: test/engine-fuzz.test.ts :: fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码
E02 底注没扣到人头上 caught   failCases=10 exit=1 首个: test/engine-core.test.ts :: core/01 startHand 不变量：底注入池、每人扣 ante、游标在庄家下家、计数归零
E03 首行动者变成庄家自己 caught   failCases=44 exit=1 首个: test/engine-core.test.ts :: core/01 startHand 不变量：底注入池、每人扣 ante、游标在庄家下家、计数归零
E04 发牌不按庄家下家轮转 caught   failCases=2 exit=1 首个: test/engine-core.test.ts :: core/03 发牌顺序 = 独立复算的洗牌结果（庄家下家起连续取牌）
E05 明闷跟价对调 caught   failCases=5 exit=1 首个: test/engine-illegal.test.ts :: illegal/06 重复看牌被拒；看牌不消耗行动数也不推进游标
E06 比牌费不随注级 caught   failCases=1 exit=1 首个: test/engine-money.test.ts :: money/04 比牌费 = fee × stake 入池，与闷/明无关（注级 1/2/4 各验一次）
E07 弃牌不计行动数 caught   failCases=1 exit=1 首个: test/engine-money.test.ts :: money/06 弃牌不花钱也不退钱：弃牌者的 committed 留在池里（无边池无退款）
E08 平局算被挑战者输 caught   failCases=1 exit=1 首个: test/engine-scripts.test.ts :: scripts/06 挑战者输：比牌平局时挑战者出局（§1 比牌行）
E09 剩两家比牌不开牌 caught   failCases=2 exit=1 首个: test/engine-project.test.ts :: project/04 剩两家比牌 = 开牌 ⇒ 视图里两家都可见（含被淘汰的那家）
E10 加注后不清零计数 caught   failCases=7 exit=1 首个: test/engine-core.test.ts :: core/13 终止阈值不多不少：注级 8 上各家满 2 次仍在局里，满 3 次才 stall
E11 加注不翻倍注级 caught   failCases=9 exit=1 首个: test/engine-core.test.ts :: core/13 终止阈值不多不少：注级 8 上各家满 2 次仍在局里，满 3 次才 stall
E12 终止② 丢掉注级前提 caught   failCases=28 exit=1 首个: test/engine-core.test.ts :: core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值
E13 终止③ 阈值写错成 2 caught   failCases=16 exit=1 首个: test/engine-core.test.ts :: core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值
E14 通吃也强行开牌 caught   failCases=1 exit=1 首个: test/engine-scripts.test.ts :: scripts/01 弃至通吃（§1①）：只剩一人即结束，且不开牌
E15 结算不幂等 caught   failCases=4 exit=1 首个: test/engine-fuzz.test.ts :: fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码
E16 结算后池不清零（重复入账） caught   failCases=9 exit=1 首个: test/engine-core.test.ts :: core/09 资金守恒：开局到结算，筹码 + 池恒等于买入总额
E17 余数给最后一个赢家 caught   failCases=2 exit=1 首个: test/engine-money.test.ts :: money/07 分池：整除时人人等份；有余数时给"距庄家下家最近"的赢家
E18 份额全按赢家[0] 是否拿余数发放 caught   failCases=2 exit=1 首个: test/engine-money.test.ts :: money/07 分池：整除时人人等份；有余数时给"距庄家下家最近"的赢家
E19 赢家判定不看牌力（取首家） caught   failCases=1 exit=1 首个: test/engine-scripts.test.ts :: scripts/03 封顶开牌（§1②）：注级 16 且活跃各家再完成 1 次行动 ⇒ 强制开牌
E20 首圈禁比永久解禁 caught   failCases=2 exit=1 首个: test/engine-illegal.test.ts :: illegal/04 首圈禁比：任何人第一次行动之前都不能比牌，全员各一次后立刻放开
E21 首圈禁比永不解禁 caught   failCases=8 exit=1 首个: test/engine-illegal.test.ts :: illegal/04 首圈禁比：任何人第一次行动之前都不能比牌，全员各一次后立刻放开
E22 轮次检查失效（谁都能行动） caught   failCases=2 exit=1 首个: test/engine-fuzz.test.ts :: fuzz/04 非法行动注入：一律抛 InvalidActionError，且状态指纹不变
E23 钱不够仍可跟注 caught   failCases=2 exit=1 首个: test/engine-fuzz.test.ts :: fuzz/01 200 局随机合法行动：必然终止、资金守恒、无负筹码
E24 注级顶格仍可加注 caught   failCases=1 exit=1 首个: test/engine-illegal.test.ts :: illegal/07 注级顶格不能再加注
E25 比牌可以打自己 caught   failCases=2 exit=1 首个: test/engine-fuzz.test.ts :: fuzz/04 非法行动注入：一律抛 InvalidActionError，且状态指纹不变
E26 视图泄露他人手牌 caught   failCases=6 exit=1 首个: test/engine-project.test.ts :: project/01 下注中：viewer 只看得见自己的牌，他人一律 unknown
E27 视图提前泄露 seed caught   failCases=1 exit=1 首个: test/engine-project.test.ts :: project/05 seed 只在结算后才暴露（否则任何客户端都能反算整副牌）
E28 终局判定被跳过（永不满 3 次也终局） caught   failCases=24 exit=1 首个: test/engine-core.test.ts :: core/08 阶段推进：betting → awaitingSettle → settled，且没有别的取值
E29 加注退回读法 A（付旧注级跟价） caught   failCases=1 exit=1 首个: test/engine-money.test.ts :: money/03 加注：注级翻倍并按新注级付跟价（Q1 读法 B），且全员当前注级行动数清零
E30 加注按新注级但忽略闷/明 caught   failCases=1 exit=1 首个: test/engine-money.test.ts :: money/03 加注：注级翻倍并按新注级付跟价（Q1 读法 B），且全员当前注级行动数清零
RESTORE src/cards.ts OK a9ed6efde3cf
RESTORE src/rules.ts OK f162a6a35708
RESTORE src/engine/state.ts OK 14a86cf4c7dd
RESTORE src/engine/validate.ts OK f78d93c5abfb
RESTORE src/engine/actions.ts OK 23a203c3c3fe
RESTORE src/engine/settle.ts OK ff205d18b553
RESTORE src/engine/project.ts OK c1939eb71650
```

### 6.1 两条"先逃掉、补断言后才被抓"的记录

- **E06 比牌费不随注级**（`compare` 费用写成常数 2）：原本 `money/04` 只在注级 1 上断言，而 stake=1 时"2×stake"与常数 2 同值 ⇒ 逃过。改成在注级 1/2/4 三档上分别断言"费 = fee × stake 且实际入池额相同"，现在由 `money/04` 抓住。
- **E12 终止条件②丢掉"注级到顶"前提**（任何注级下各家做过 1 次就强制开牌）：原本的脚本都是"按脚本推进到底"，中途被提前终局也会被当成通过 ⇒ 逃过。新增 `core/13`：把注级推到 8，让活跃各家各做满 2 次后**显式断言仍在局中**，再满 3 次断言以 `stall` 终局 —— 阈值少 1 或多 1 都会炸。

另有两条与 Q1 金额口径直接相关的回归（`E29 加注退回读法 A`、`E30 加注忽略闷/明`、`E31 加注不花钱`）均由 `money/03` 的**独立数值锚点**（闷加付 2、明家加注到 4 付 8）抓住；这些锚点不复用 `actionCost()`，否则口径 A/B 互换测不出来。

### 6.2 本轮发现并修掉的两个测试工装缺陷

1. **死循环**：`money/02`、`money/04` 里用 `while (s.stake < level) s = apply(s, raise(s.turn));`，在"加注不翻倍注级"（E11）这类变异下永不前进 ⇒ 整个变异跑挂死（实测一次 10 分钟超时）。已全部换成带硬上界的 for + 显式断言。
2. **锚点漂移**：`E05` 的变异锚点因把跟价计算抽成 `callPriceAt()` 而变成 0 命中（会静默少测一条）。现在扫描结果里出现 `SKIPPED` 会被明确拒绝交付。
