# REVIEW.md — rev=13 复审裁定（Q7-B：停手是标签页级的，落地复查）

- **rev: 13**（对应工单 §4 “M5 联机可玩”；DELIVERY.md `rev: 13`、builtAt `2026-10-01T13:28:11+08:00`、74 条 manifest、`.tmp` 原子 rename）
- **结论：PASS。ANSWERS.md 第七轮 Q7② 裁定的 (B) 已落地，且我独立验到它咬得住：无新必修、无新应修。⇒ M5 里程碑批准，BRIEF.md 顶部批准行推进到 M5（本块 §10）。**
- **裁定时间：2026-10-01T17:31:44+08:00**
- 复审内容：硬闸门五项委派复跑 + 我逐份核产物；改动面按 mtime 窗口（rev=12 builtAt → rev=13 builtAt）与 manifest 双向核；`webui/netplay.ts` 粘性实现通读、对 ANSWERS.md 第七轮的九枚钉子逐条核；我自写真机探针 `.audit/rev13/sup-sticky.ts`（真房间 8846 + 真 WebSocket + 真 `createNet` 栈，六组判据）；七种 `patch` 注入回归（`.audit/rev13/sup-potcheck-r13.ts`，日志改道 rev13、不覆写 rev=11 证据）；我自写三条变异在仓库副本里跑（副本跑完即删）；真浏览器三张截图与中间人日志逐张 / 逐行核。
- 证据分级：**A** = 我实测可复现（附命令 / 产物）；**B** = 我的工具已交叉验证，或由源码链推得；**C** = 我的解读；**X** = 撤回；**L** = 我方工具面限制（**不计交付方账**）。
- 我的产物全部在 `.audit/rev13/`，刻意不入 manifest、不在 `test/` 下。交付面 74 个文件一个没碰：变异只落在副本里，副本 `webui/netplay.ts` 复原后与交付面同 sha256 前 16 位 `97FB3CF521C31F0A`，副本整个目录已删。

## 0 · 一句话结论

(B) 的九枚钉子逐条落在 `webui/netplay.ts:119-146`（键 / 值形状 / 降级读）、`:182-186`（读取先于首帧 + 会话闩锁）、`:234-249`（横幅追加 + 单一布尔出口）、`:253-263`（写真源只许 `peer.info()`）、`:270`/`:299`（两把键各管各的）、`:312`（停手页不自动重入桌）、`:332-335`/`:542`（同一 `act()` 出口与同一按钮塌陷）；真机探针六组判据全过、我自写三条变异全咬住、七种注入回归与 rev=11/12 基线一致。本轮通过，M5 批准。

## 1 · 硬闸门（委派复跑，我逐份核产物）

| 项 | 结果 | 产物（`.audit/rev13/`） | 级 |
|---|---|---|---|
| manifest 74 条重算 | 74/74 相符、0 不符 | `manifest-recheck.txt` | A |
| `node test/run.ts` 双跑 | 两次逐字节一致；末三行 `cases=414` / `pass=414 fail=0` / `ALL_PASS` | `node1.txt` `node2.txt` | A |
| `npm test` 双跑 | 同上 | `npm1.txt` `npm2.txt` | A |
| `npx tsc --noEmit` | 零输出、exit=0 | `tsc.txt` | A |
| 零回归差集 | 旧 412 条 ID 一条未丢；新增恰为 `nui/29`、`nui/30` | `iddiff.txt` | A |

注（不藏差异）：我这边双跑重算的 sha256 与 DELIVERY 自报的 `1826dd9a…` / `8336295d…` 不同 —— pwsh `*>` 重定向把部分中文写成 `?`，是采集编码差异不是内容差异；判据本来就是“两次自比逐字节一致”，两次均一致 ⇒ 结论不受影响。C（对差异的解读）

## 2 · 改动面：只有两个代码文件

mtime 窗口（2026-09-30 13:31 → 2026-10-01 13:29）内 manifest 里被碰过的文件恰为四个：`webui/netplay.ts`、`test/netx-netplay.test.ts`（代码）与 `SELF-REVIEW.md`、`TEST-OUTPUT.md`（文书），与交付自述“一个文件 + 两条新用例”一致。关键旁证：`webui/main.ts` 哈希未变 ⇒ Q7 点名的洞（`main.ts:152-156` 断开→连接新建 peer、violations 随旧 peer 丢）不是靠改 main.ts 堵的，而是靠 `createNet` 先读标签页账堵的 —— 正是裁定要的形状。A

## 3 · 九枚钉子逐条核（源码）

| 钉子（ANSWERS.md 第七轮） | 落点 | 判 |
|---|---|---|
| 键 `<prefix>:untrusted`，走既有 `Store` 端口 | `netplay.ts:119-121` | 过 |
| 值 `{count, first, hand}`；坏 JSON / 坏形状一律降级 `null` | `:123-146`（与 `readSaved` 同一降级口径） | 过 |
| 写真源只许 `peer.info()`，不自己解析下行 | `:253-263`（只读 `violations` 与 `hand`） | 过 |
| 读取先于首帧 | `:182` 在 `createNet` 内即读；探针②在**零下行**时断言 | 过 |
| 四操作不清（断开重连 / F5 / 换 URL / 单机↔联机） | 全仓 `.del(` 仅 `:270`、`:299` 两处且都只清 `savedKey`；`nui/29`⑤ 负对照 + 探针⑤ | 过 |
| 唯一解除 = 关闭本标签页，横幅写明 | `:236` 文案；探针②/⑥ | 过 |
| 粘性是地板、不替代逐帧复检 | 探针④：再抓 `violations>0` 且被拒帧不进快照；`nui/29`④ | 过 |
| 同一 `act()` 出口、不新造第二套塌陷 | `:245-249` 单一布尔同时驱动 `:332-335` 与 `:542` | 过 |
| 不做 endpoint 隔离；只挡行动不挡入桌 | 无隔离代码；`13-D` 自陈理由我认可（挡入桌会连“为什么停手”的局面都渲染不出） | 过 |

另核两处自陈：粘性行**追加**在越界块之后而非插队（`:234-238` 注释自陈理由 = `nui/05` 把 `log[0]` 钉成了断言），D-stopped 截图里四行的顺序与之一致；`stickyRecorded` 初值为 `false`（继承不预记），否则第二世再被抓 `count` 永远停 1（实现方自陈本轮真写错过一次，`13-C`①）。A

## 4 · 我的独立实机探针（`.audit/rev13/sup-sticky.ts`，真房间 8846，自 spawn 自杀）

六组判据全过，`VERDICT STICKY_PROBE_OK`（原文 `sticky-run2.txt`）：① 第一世真 socket 注入 `pot 2→102` 被抓 ⇒ 账落盘 `{count:1, first:"patch unusable: pot 102 != sum(committed) 2", hand:2}`；② 关 socket、同 store 再 `createNet`、**一条下行都没收**就已经 `untrusted=true`、`act().sent=false` 且 why 说清、横幅带次数 + 首条 + 唯一解除方式、`snapshot().note` 在首帧之前就说话；③ 第二世接上房间只喂诚实下行 ⇒ 墙零误报、账一位没动、按钮塌成一个「已停手：这一局不可信」；④ 第二世再注入 ⇒ 那一世自己的墙照旧响、被拒帧不进快照（注入前 2 / 注入后 2）、`count→2` 而 `first` 不变；⑤ `joinWire()` 后粘性键逐字节不动、凭据键确被清（负对照：两把键各管各的）；⑥ 新 store = 干净、零提示。A

## 5 · 变异牙：我自写三条，全咬住

副本 `.audit/rev13/mut/`（跑完整个目录已删），单文件直跑 `node test/netx-netplay.test.ts`，原文 `mut13-out.txt`：

| 变异 | 期望红 | 实测 |
|---|---|---|
| M1 摘掉 `store.set(untrustedKey…)`（抓了不落账 = Q7 要堵的原洞） | `nui/29`① | exit=1，红 `nui/29`（“被抓之后标签页账必须落盘”） |
| M2 `readUntrusted` 读成 `null`（落了账没人读） | `nui/29`②③ + `nui/30` | exit=1，红 `nui/29` + `nui/30` |
| M3 `joinWire` 多清一把粘性键（裁定明令不清的四操作之一） | `nui/29`⑤ | exit=1，红 `nui/29` |

`VERDICT MUT_TEETH_OK`（3 caught / 0 survived）。实现方自报 7 条新变异 + 6 条旧门复跑全 caught，作旁证。A（我的三条）/ B（其自报）

## 6 · 七种 `patch` 注入回归（`.audit/rev13/sup-potcheck-r13.ts`）

pot / chips / committed / otherchips / cards / oppcards 六支全「墙抓到=true」、直连 B 侧假阳性=false；control 支 78 次采样 0 不符（`pc13-*.txt`）。与 rev=11 / rev=12 基线逐支一致 ⇒ 粘性落地没有碰坏第二道墙。A

## 7 · 真浏览器续证（§8.7 已签收，本轮看“粘性真的粘住”）

三张截图我逐张看过，与 TEST-OUTPUT 13.5 表格逐行一致：`r13-gui-D-stopped.png`（页眉四行：越界首条 `pot 103 != sum(committed) 3` + 另有 2 条 + 已停手 + 粘性行；按钮塌成一个；**池仍 2** = 被拒帧没进快照；512=251+259+2）；`r13-gui-D-reconnected.png`（断开→连接后页眉**只剩粘性一行**且写明唯一解除方式、按钮仍塌、而局面仍渲染：第 2 手·待结算、亮牌 `KD AS AD / 6H 5D AH`、对子·应赢 8、512=248+256+8）；`r13-gui-C-control.png`（8790 直连对照：零误报、按钮正常、512=254+254+4）。中间人日志 `r13-gui-mitm.log`：`armed mode=pot` → `INJECTED`，原文 `"pot":3` 改 `"pot":103`，与页眉首条逐字对上；重连那次握手后无二次注入。产物级 A；“人手点出来的那两下”仍只有人类监督方能自证，沿用 §8.7 口径记 L、不计交付方账。

## 8 · settled 豁免区观察（非缺陷，不新开返修）

我的探针 v1 曾在 `settled` 帧上注入 pot ⇒ 不被抓（`violations=0`），一度被我误读成“实现没落账”。查清后确认这不是本轮实现的错：`checkMoney` 对 `settled` 的豁免是 rev=11/12 已 grade-A 记录的承重墙（232 帧实测 + “撤豁免即挂死”的变异证据），跨帧恒定谎言（CASE_A）也已记为 M5 可接受边界并留了最廉价加固候选（开局绝对锚点）。本轮我在真 socket 上把它复量一次作续证（探针⑦：settled 帧注入确实发生、`violations=0`、`untrusted=false`），边界与 rev=12 完全一致。C（观察）；不构成本轮判据、不要求返工。

## 9 · 我自陈的夹具坑（五条，全是我写错、交付零错）

① 探针 v1 见 `patch` 就改 ⇒ 第一世改到 `settled` 豁免帧，15 条 FAIL 全是构造错；② ④ 拿 15 秒前的快照 pot 当基准 ⇒ 跨手假阳性，改成“注入那一帧之前”的读数；③ 等待窗口 15s 小于 `serve.ts:53` 写死的 `turnMs=30000` ⇒ 停手座等不满一手，窗口放宽到 95s；④ 变异副本漏拷 `src/`、`webmin/` ⇒ 连续三轮“变异逃过”其实全是 `ERR_MODULE_NOT_FOUND`；⑤ 失败行探测器先按 `FAIL `、再按 TAP `not ok` 找 ⇒ node:test 直跑实际印 `✖ <用例名>`。五条逐一修好后探针全绿、变异全咬住。两版失败探针的输出只留在会话记录里（未落盘），修好后的原文在 `sticky-run2.txt` / `mut13-out.txt`。A（自陈）

## 10 · 结论与批准

PASS：无新必修、无新应修、无阻断级建议。Q7-B 闭合 ⇒ **M5 里程碑批准**；BRIEF.md 顶部批准行由 M4 推进到 M5（加粗正文与括注同向，改后 grep「批准范围」全读核对）。实现方无需再为本里程碑做任何事。

环境脚注：人类监督方先前的房间（8790，我曾应“帮我打开游戏”重启为 PID 25484）在本裁定时已不在监听 —— 未擅自重启，需要时说一声即可；我的探针房间 8846 自 spawn 自杀，8812 中间人亦无监听，不留野进程。

---

# REVIEW.md — rev=12 复审裁定（M5 第二轮返修复查）

- **rev: 12**（对应工单 §4 “M5 联机可玩”；DELIVERY.md `rev: 12`、builtAt `2026-09-30T13:30:55+08:00`、74 条 manifest、`.tmp` 原子 rename）
- **结论：rev=11 §3 必修 1 项 + §4 应修 4 项 + §8 我能验的七条口径全部销账，无新必修、无新应修 —— 就返修范围判通过（PASS）。唯一未闭合的是 §8.7 的真人 GUI 终验（≥720×640 真鼠标 + 两标签页打完两整手 + 截图），那是我这一侧工具面不可验、须人类监督方实机签收的一条（grade-L），照 rev=10 / rev=11 的既定纪律不判实现方不合格。⇒ M5 里程碑的最终批准仍系于这一条人类终验；批准范围维持停在 M4，本行不推进。实现方无需为此再做任何事。**
- **裁定时间：2026-09-30T17:58:27+08:00**
- 复审内容：manifest 我自己从 DELIVERY.md 抽 74 条重算两次（开工 + 全部实机 / 变异活动之后，两次 74/74 相符、0 不符）+ `node test/run.ts` 与 `npm test` 各双跑逐字节比对 + `npx tsc --noEmit` 零输出 + 通读 rev=12 改动面（核心 `netx/client.ts::checkMoney`）+ 覆盖 oracle v4 原样重跑并与 12-F 逐行对账（43 vs 43）+ 真房间 / 真 socket 上六种 `patch` 篡改注入重跑（我自己那份 `sup-potcheck.ts`，只改期望值）+ 仓库副本里独立复跑变异（交付面一份未动）+ R1 绝对锚点边界自写探针 + 408→412 零回归差集。
- **批准范围：仍停在 M4，本轮不推进**（M5 待人类 GUI 终验）。BRIEF.md 顶部批准行由我同步维护，加粗正文与括注指向一致。
- 证据分级：**A** = 我实测可复现（附命令 / 产物）；**B** = 我的工具已交叉验证，或由源码链推得；**C** = 我的解读；**X** = 撤回；**L** = 我方工具面限制（**不计交付方账**）。
- 我的产物全部在 `.audit/rev12/`，刻意不入 manifest、不在 `test/` 下。**交付面本轮零改动**：`netx/client.ts` 两次核到 sha16=`B4183707509CEC5C`、settled 守卫 / `checkMoney` / 逐座位锚点三标记俱在、变异签名 0；变异只落在 `.audit/rev12/mut/` 副本里，跑完复原（副本 sha 与交付面一致）。清单里那 74 个文件一个都没碰。

## 0 · 一句话结论

**rev=11 那条唯一的必修（`patch` 上的数字篡改抓不到、而 `nui/25` 把“抓不到”钉成了“客户端无法独立核对”的假边界）已经闭合，而且是 grade-A 闭合的**：`netx/client.ts` 新增 `checkMoney`，挂 `checkView` 最后一道、走既有 `violate()` 通道，`settled` 帧豁免（232 帧探针实测依据）。我用 rev=11 那同一份 `sup-potcheck.ts`（只改期望值）在真房间 + 真中间人 + 两个真客户端（走 `webui/netplay.ts` 的真实 `createNet` 栈）上重跑六种注入 —— **六支全部 `墙抓到=true`、`untrusted=true`、直连 B 侧零假阳性、中间人 `MITM2 INJECTED` 确认注入真发生**，而 `control` 那一支 78 次采样仍 0 不符（`PROBE_SELFTEST_OK`）。**其中最关键的一支是「别家 chips」（`otherchips`）**：墙报 `patch unusable: seat 0 chips+committed 385 != 285 (同一手内应恒定)` —— 客户端靠“逐座位守恒”抓出了**别家**绝对筹码被篡改，正面证伪了旧 `nui/25` 那句“客户端无法独立核对”。

**应修 4 项也全部销账**（文书三处一致、四处 400 加互异正文并可归因、collect 分支补 `.slice(-40)` + `nst/13` 钉上限、以“无法核对”为前提的披露行全部重判）。**§8 那八条：8.1–8.6、8.8 判过，8.7 是 grade-L（真人 GUI 终验归人类监督方）。**

**我这一侧有两处要自己认领的**（一个假设覆盖全部观察才写进裁定，这两处都指向“我 rev=11 的文字陈旧 / 口径太窄”，不是实现方的问题）：

1. **§8.5 的自检期望值我写错了（X）。** rev=11 §8.5 写“A=全1、C=全1、B=`1111011`、D=全1”，那是照 rev=11 的锚点写的。本轮应修 2 在 `netx/ws.ts` 插了 `refuseUpgrade()`，500 兜底从 `146-149` 漂到 `162-164` ⇒ A 的原样读数“A 1111 OK”是**行号漂移的假证据**；B 现整段覆盖，实得 `1111111` 而非 `1111011`（脚本里 B 的 `want` 本就是 `has1` 谓词、非精确位串）。**实现方没改我的脚本、也没拿那次假绿当结论**，而是生成逐字副本把 A 重标定到 `162-164`（`A 期望111 实得111 OK`），两份报告 `diff` 只差那一行、合计读数（22 文件 / 43 段 / 5683 行覆盖 5543 = 97.5%）不受影响 —— 并在 12-E 第 7 项、12-G 8.5 那行**主动点出来请我裁定**。我用 v4 脚本原样重跑复核：四条自检 `ORACLE_SELFCHECK_OK`、`onlyMine=0 / onlyTheirs=0`、43 vs 43。**⇒ 撤回我 §8.5 的精确位串措辞（X），按脚本实物判 8.5 过。**
2. **§8.1 我给实现方的 (c) 口径太窄，实现方没照抄是对的（C）。** rev=11 §3 我写的 (c) 是“同一手内**我自己**的 `chips+committed` 恒定”，只验自己那一格 ⇒ `other-chips` 那一支就只能靠 (d)（而 (d) 我当时自标“依赖名册恒定、只在 2 人桌验过”）。实现方把 (c) 写成**逐座位**恒定（12-A 第三行、12-D 第 2 项），`my-chips` / `other-chips` / `committed-and-pot` 三支都由它抓，不依赖我没验过的“名册会不会变”；并给 (d) 单独造了一支牙（`extra-seat` 假座位 + 变异 N03）使 (d) 不冗余。**比我给的口径更强，我认可。**
## 1 · 硬闸门（工单 §0.7 + §5 禁令）逐条结果

| 闸门 | 结果 | 凭据 |
|---|---|---|
| manifest 未被篡改（复审第一步，不可跳过） | **过** | 我自己从 DELIVERY.md 抽 74 条重算两次（开工 + 全部实机 / 变异活动之后），`.audit/rev12/manifest-recheck.txt`：**74/74 相符、0 不符**。五个协议文件 + `.audit/` 均不在清单（DELIVERY.md:175 亦如此声明）。**A** |
| `node test/run.ts` 双跑逐字节一致 | **过** | `.audit/rev12/node1.txt` ≡ `node2.txt`（各 59888b），尾三行 `RUNNER files=29 cases=412 / SUMMARY pass=412 fail=0 / RESULT=ALL_PASS`。**A** |
| `npm test` 双跑逐字节一致 | **过** | `npm1.txt` ≡ `npm2.txt`（各 59930b），同为 412/412 ALL_PASS。**A** |
| `npx tsc --noEmit` 零输出 | **过** | `.audit/rev12/tsc.txt` **0 字节**。**A** |
| 用例数 / 全绿 / 零回归 | **过** | 408 → **412**，`iddiff.txt` 严格口径与松口径**丢失均 = 0**（`RESULT=ZERO_REGRESSION_OK`），新增 4 条全用新编号（`nui/27` / `nui/28` / `ws/09` / `nst/13`），`nui/25` **编号保留、标题改写**。**A** |
| 测试输出无时间戳、无随机序 | **过** | 双跑逐字节一致本身蕴含它；`nst/11` 仍钉这条静态门。**A** |
| `src/` 零运行时依赖、无 `Math.random` / `Date.now` / 文件网络 IO | **过** | `nst/*` 静态门 + 通读 rev=12 改动面（核心 `checkMoney` 是纯客户端算术、无新出口）。**A** |
| 依赖面：`dependencies` 空、`devDependencies` 只白名单四个、`ws` 未被安装 | **过** | 帧实现仍是手写 `netx/frames.ts`；我的中间人 `br-mitm2.ts` 直接 import 它解帧重编。**A** |
| 分层：`webui/` 里只有 `netplay.ts` 一个 `netx/` 进口 | **过** | `nst/04` 未再放宽 + `nui/02` 14 条禁令原样通过。**A** |
| **交付面零改动（红线）** | **过，我专门核了** | `netx/client.ts` sha16=`B4183707509CEC5C` 两次一致；settled 守卫 = 1、`checkMoney` = 1、逐座位锚点 `money.perSeat.get` = 1、变异签名（`MUT_` / `N03` / `N04` / `__mut`）= 0。变异只在 `.audit/rev12/mut/` 副本里跑，跑完把副本 `client.ts` 从交付面复原（复原后 sha 与交付面一致）。**A** |

## 2 · rev=11 §8 那八条验收口径逐条核销（八条原文见本文件下方保留的 rev=11 §8）

| # | 结论 | 凭据（我这轮自己量的，不是抄你们的自评） |
|---|---|---|
| **8.1 必修 1** | **过（A）** | 真房间 + 真中间人（TCP 透传改下行 `patch`）+ 两个真客户端（`webui/netplay.ts` 的 `createNet` 真实栈，A 经中间人 / B 直连）。`mitm-verdicts.txt` 六支：`pot`→`pot 102 != sum(committed) 2`、`chips`→`seat 1 chips+committed 389 != 289`、`committed`→`pot 2 != sum(committed) 102`、`别家 chips`→`seat 0 chips+committed 385 != 285`、`cards`→`own cards exposed before look`、`oppcards`→`cards of seat 0 exposed while revealed=false`，**每支 `墙抓到=true`、`untrusted=true`、`B 侧假阳性=false`、`MITM2 armed + INJECTED`**；`control` 支 `墙抓到=false`、`PROBE_SELFTEST_OK`、`checks=78` 0 不符。六支里 `我的恒等式命中=0` 正是 §8.8 预告的“必修 1 落地后我的探针退成对照组”：墙在坏帧进快照**之前**就拒了它。**无头侧孪生** = `nui/27`（t9 变异证明它有牙，见 §3）。 |
| **8.2 `nui/25` 改写不删除** | **过（A）** | `iddiff.txt`：`nui/25` **编号保留**，标题由“patch 上改 chips/pot 抓不到 —— 权威面边界”改写为“seq 面与采纳面：合法增量被采纳、同一条重放当场被抓、被拒的帧不进快照”。两组对照 = `nui/27`（篡改必抓）+ `nui/28`（诚实流量逐帧零误报 + 采样下限）。牌面族 `nui/24` / `proto/07` / `proto/08` / `leak/05` 全绿未打散（M13 变异仍被四条一起抓）。 |
| **8.3 应修 1 三处文书** | **过（A）** | DELIVERY.md:106-108 那句“主路径 `:394-410`”已改成事实（roster 主分支 `:366-398` 已进覆盖、`:405-421` 是 `.concat()` 的 K5 兜底；并注明 rev=11 时叫 `403-419`、本轮因应修 3 加两行注释漂了 2 行）—— 与我 oracle 输出（`my-cov-rerun.txt`：`netplay.ts` 未覆盖 `:405-421` / `:443-444` / `:494`）逐字一致。`SELF-REVIEW.md:13` 交叉引用已由 11-C 改指 **11-B**；`:31` 与 DELIVERY notes 实物对齐（DELIVERY.md:110 确写了 BRIEF §4 M5 ⑤ 引用）。 |
| **8.4 应修 2 四处 400 可归因** | **过（A）** | 实现方选“加正文”这一支：`refuseUpgrade()` 统一出口，五条拒绝各带互异纯文本正文（`upgrade header missing` / `connection header lacks upgrade` / `sec-websocket-version missing` / `sec-websocket-key invalid` / 426 `version not supported`）。`ws/09` 钉“三条可达 guard 正文两两不同 + 426 另有正文 + 对照组 Node 自己那发仍零正文 ⇒ 可分”。源码实证：`my-cov-rerun.txt` 显示 `netx/ws.ts:179-181` = `refuseUpgrade(socket, 400, ... connection header lacks upgrade)`。我另要求的两件也做了（`ws/08` 的“4 种”与探针“10 种”分开写；真进程普通 HTTP 那一档是 302→/webui/）。 |
| **8.5 覆盖 oracle v4 + 三条自检** | **过（A）+ 我方措辞撤回（X）** | v4 脚本原样重跑：`my-cov-rerun.txt` = **22 文件 / 5683 可执行行覆盖 5543 = 97.5% / 43 段未覆盖**，`ORACLE_SELFCHECK_OK`（A `ws.ts:146-149` 期望 `1111` 实得 `1111`；B `serve.ts:83-93` 期望 `has1` 实得 `1111111`；C `webmin/serve.ts:152-159` 期望 `has2` 实得 `12222222` = SIGKILL 取证边界；D `webmin/serve.ts:115-119` 期望 `11111` 实得 `11111`）。12-F 43 段与我逐行对上、`onlyMine=0 / onlyTheirs=0`（实现方用副本跑 `COVDIFFRESULT=OK`，我用 `sup-12f-diff.mjs` 复核 `SPLICE_OK_43_of_43`）。**我 rev=11 §8.5 写的“B=`1111011`”及 A / C 锚点已陈旧 ⇒ 撤回（X），见 §0 第 1 条。** |
| **8.6 零回归** | **过（A）** | `iddiff.txt`：基线 408 ⊆ 本轮 412，严格口径与松口径**丢失均 = 0**，`RESULT=ZERO_REGRESSION_OK`。（诚实标注：`iddiff.txt` 那两行标签是我沿用 rev=11 脚本没改的旧字，印成“rev=10 基线 / rev=11 本轮”，但喂进去的基线是 rev=11 的 408、本轮是 rev=12 的 412 —— 数字对、标签旧一轮；`FULLLINE_MULTISET_SHRUNK` 的那 1 行正是 `nui/25` 旧标题，即 §8.2 要求的改写、非回归。） |
| **8.7 ≥720×640 真鼠标 + 两标签页** | **仍未执行 ⇒ L 级，不计你们账** | 我这一侧工具面没有 ≥560×560 的可视视口、没有“开新标签页”的原语、`visibilityState=hidden`、截图工具报 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`。**但浏览器内嵌客户端的逻辑栈本轮已 grade-A 证毕**：t8 那两个真客户端走的就是 `webui/netplay.ts` 的真实 `createNet`，六种注入在真 socket 上全被抓。**剩下的“真人真鼠标 + 两标签页 + 截图”这一层，须人类监督方在 ≥720×640 真浏览器上实机签收 —— 这也是 M5 里程碑批准唯一还差的一条。** |
| **8.8 不再加新注入点** | **过** | 我只重跑 rev=11 那同一套六种注入、未换新花样。必修 1 落地后我的恒等式与新门重叠 ⇒ 按 §8.8 原话以**你们的门**为准、我的探针退成对照组（六支 `我的恒等式命中=0` 即此）。`checkMoney` 复用既有 `violate()` 通道、`info()`（`PeerInfo`）不暴露 `money` ⇒ 无新通道、无新攻击面。**A** |
## 3 · 变异复跑（在**副本**里跑，交付面一份不动 —— grade A）

我在 `.audit/rev12/mut/`（robocopy 交付树副本：evidence / netx / src / test / webmin / webui + package.json，29 测试文件）里独立复跑，基线 `node test/run.ts` = **412/412 ALL_PASS**（副本自洽）。三条定向变异：

| 变异 | 改动 | 结果 | 读到的牙 |
|---|---|---|---|
| `m1disable` | `checkMoney` 整体 `return null`（拆掉整道墙） | **fail = 2** | `nui/27` + `client/10` 翻红 ⇒ 整道墙有牙 |
| `m2noA` | 只废恒等式 (a)（`pot === Σ committed`） | **fail = 2** | 同两条翻红（`nui/27` 是单条测试断言全六种，(a) 一废 `pot` / `committed` 两支就没抓 ⇒ 整条红；`client/10` 带 pot 子断言） |
| `m3nosettle` | 撤掉 `phase === 'settled'` 豁免 | **挂起 > 12min 被我终止** | 结算帧 `pot=0 ≠ Σ committed` 误报 ⇒ 客户端停手 ⇒ 流程依赖型测试等不到下一手信号而挂死。**挂起本身即“settled 豁免是承重墙”的证据**（比“翻红”更戏剧）；但我这套全量跑法比实现方的定向变异工装粗，未能干净复现他们的 N04（21 红含 `nui/28`）⇒ 诚实标注这一条我没做到字节级复现 |

**跑完我把副本 `client.ts` 从交付面复原**（复原后 sha16 与交付面 `B4183707509CEC5C` 一致），并复核交付面三标记俱在、变异签名 = 0（见 §1 最后一行）。工具面坑：`spawnSync` 无 timeout 时子进程挂起会无限阻塞 —— 用 `taskkill /F /T` 终止（`node_alive=0` 确认清理干净）。**实现方那 7 条（N01–N07）+ 复跑的 10 条 rev=11 变异全 caught，是其自评（12-C）；我这 3 条是独立侧的粗粒度交叉印证、方向一致。**

## 4 · R1 / R2 残留边界（非阻断；M5 可接受边界 + 未来加固候选）

我自写探针 `.audit/rev12/sup-r1-probe.ts` → `r1-probe-out.txt` 实测 `checkMoney` 的一条边界：它的守恒基准取**每手第一帧的快照**、没有绝对锚点（我 rev=11 §3 的修法只要求覆盖 (a) 与 (c)、未要求绝对锚点，所以这**在验收口径之内**）。三条实测：

- `CASE_A`：从开局第一帧起**持续一致**地把某家筹码抬高（每帧都抬同样的量）⇒ `snapshot_viol=0 / sustained_patch_viol=0`，`R1_NO_ABSOLUTE_ANCHOR_evasion_confirmed`。这是“服务端从头到尾对某家撒一个恒定的谎”，逐座位守恒比不出（基准就是那个谎）。
- `CASE_B`：单帧伪造别家 `chips` ⇒ `forgery_viol=1`，`seat 0 chips+committed 400 != 300`，`MUST1_chips_forgery_CAUGHT`。
- `CASE_C`：抬一帧后下一帧恢复真值 ⇒ `honest_after_inflated_viol=1`，`WALL_LIVE_one_frame_inflation_self_exposes`（下一帧的真值与被抬高的基准不符、自己暴露）。

**定性**：§8.1 的口径是“**单条 patch 的不一致篡改**”，`CASE_B` / `CASE_C` 与 t8 六支都在这个口径内、全被抓 ⇒ **§8.1 达标**。`CASE_A`（跨帧恒定谎言）比 §8.1 更强、落在本轮验收口径**之外**，记为 **M5 可接受边界**，不作阻断项、不要求本轮返工。**未来最廉价的加固候选**（写给下一轮、不是要求）：给守恒量补一个绝对锚点 —— 第 1 手开局 `chips === buyIn`；第 N 手开局 `chips ===` 第 N−1 手 `settled` 时对在座座位记下的余额。这样 `CASE_A` 也能抓。**C**

## 5 · 覆盖缺口（不阻塞；oracle = `.audit/rev12/my-cov-rerun.txt`，v4 脚本原样只读）

**22 文件 / 5683 可执行行覆盖 5543 = 97.5% / 43 段未覆盖**，与 rev=11 同口径（97.5%）。四条地面真值自检全 OK（见 §2 的 8.5 行）。新增的 `netx/client.ts::checkMoney`（必修 1）整段已覆盖 —— `client.ts` 379/384 = 98.7%，只剩 `:166-167`（K2 恒真兜底）与 `:353-355`（K1 穷尽 never）两段老账。`netx/ws.ts` 236/246 = 95.9%、`webui/netplay.ts` 504/524 = 96.2%。12-F 43 段一行一段与我逐行对上（`SPLICE_OK_43_of_43`），分类码沿用 K1–K8。**`webui/main.ts` 恒 0%（浏览器入口、无头跑不到、不进 oracle 分母）照旧写明，免得下一轮有人当“已测”。**

## 6 · 明确不算问题的（防止返工过头）

- **六支注入里“我的恒等式命中 = 0”**：不是我的探针坏了，是墙先拒了坏帧、坏数字进不了我采样的快照 ⇒ 正是 §8.8 预告的“探针退成对照组”。**不是问题。**
- **`iddiff.txt` 的 `FULLLINE_MULTISET_SHRUNK`（1 行）**：那一行是 `nui/25` 的**旧标题**，因 §8.2 要求改写而消失、编号仍在 ⇒ 是“改写”不是“回归”。**不是问题。**
- **`iddiff.txt` 两行标签印成“rev=10 / rev=11”**：我沿用 rev=11 脚本没改的旧字，数字（408→412）是对的。**是我文书的小瑕疵、不是交付的问题。**
- **实现方三处自陈的工装“先红一次”**（12-D 第 6 项：探针初版把合法豁免混进不符总数、变异工装截断命中列表、rev=11 ID 基线只有 406 行）：三处都是**判据松了而非结论错了**，且实现方按“测试脚本自身先被验证”的口径逐条写出来、没悄悄修完不提 ⇒ **诚信加分、不是问题。**
- **R1 的 `CASE_A` 逃逸**：见 §4，在本轮验收口径之外，**不判不合格、不要求本轮返工。**

## 7 · 复审怎么复现（产物都在 `.audit/rev12/`；刻意不入 manifest、不在 `test/` 下）

```bash
# ① 清单（我自己从 DELIVERY.md 抽）
node .audit/rev12/sup-manifest.mjs            # => 74/74 相符、0 不符

# ② 双跑 + 类型
node test/run.ts > .audit/rev12/node1.txt 2>&1 ; node test/run.ts > .audit/rev12/node2.txt 2>&1   # 逐字节一致，412/412
npm test          > .audit/rev12/npm1.txt  2>&1 ; npm test          > .audit/rev12/npm2.txt  2>&1
npx tsc --noEmit  > .audit/rev12/tsc.txt   2>&1                                                  # 0 字节

# ③ 零回归差集（408 是 412 的子集）
node .audit/rev12/sup-iddiff.mjs > .audit/rev12/iddiff.txt        # => RESULT=ZERO_REGRESSION_OK

# ④ 覆盖 oracle（v4 脚本原样只读）+ 12-F 逐行对账
node .audit/rev12/sup-cov-final3.mjs > .audit/rev12/my-cov-rerun.txt   # => ORACLE_SELFCHECK_OK, 43 段
node .audit/rev12/sup-12f-diff.mjs                                     # => SPLICE_OK_43_of_43

# ⑤ §8.1 六种 patch 注入（真房间 + 真中间人 + 两个真客户端；房间端口 8820 + 2*index）
node .audit/rev12/sup-potcheck.ts control     # => PROBE_SELFTEST_OK, checks=78, 墙抓到=false
node .audit/rev12/sup-potcheck.ts pot         # chips / committed / otherchips / cards / oppcards 同形
node .audit/rev12/sup-mitm-consolidate.mjs    # => 六支 VERDICT 墙抓到=true, B 侧假阳性=false（mitm-verdicts.txt）

# ⑥ R1 绝对锚点边界探针
node .audit/rev12/sup-r1-probe.ts > .audit/rev12/r1-probe-out.txt  # => CASE_A 逃逸 / CASE_B、C 被抓

# ⑦ 变异复跑（在副本里跑、交付面一份不动；跑完复原副本）
node .audit/rev12/sup-mutrun.mjs              # => m1disable fail=2 / m2noA fail=2 / m3nosettle 挂起（承重墙）
```

## 8 · 给下一轮的口径（M5 收尾）

**8.1（唯一还差的一条，归人类监督方）**：M5「联机可玩」的里程碑批准，只差 §8.7 的真人 GUI 终验 —— 需人类监督方在 **≥720×640 的真浏览器**里开**两个标签页**各占一座、用**真鼠标**打完**至少两整手**（含一次看牌、一次加注或比牌、一次结算面板、第二手庄家推进）、**截图留证**；中途断开一个连接再重连、台账守恒。这一条我这一侧工具面不可验（grade-L），**代码层已 grade-A 证毕**（t8 真 socket 走的就是页面真实客户端栈），**实现方无需再做任何事**。

**8.2（非阻断加固候选）**：若将来要收掉 §4 的 R1（跨帧恒定谎言），最廉价的绝对锚点见 §4 末。这是**候选不是要求**、不做也不影响 M5 批准。

**8.3**：除上述人类 GUI 终验外，rev=12 无新必修、无新应修。返修范围内的活已做完、做对、且经我独立复现。

## 9 · 补记（2026-10-01）：§8.7 签收闭合 + Q7 裁定 = B ⇒ M5 批准改系 rev=13

**本补记取代顶部结论行与 §8.1 / §8.3 里"唯一还差 §8.7 人类终验"的措辞**；rev=12 其余结论（PASS、零回归 408→412、manifest 74/74、交付面零改动）不动。

**9.1 §8.7 闭合（监督方签收）**。人类监督方于 2026-10-01 在本人 Edge 开两个真标签页同连 `node netx/serve.ts 8790`、亲手打完 ≥ 两整手；我逐张核了五张关键截图与中间人日志，与 QUESTIONS.md Q7 的读数**零不符**：

- 视口实测 `1910×915` / `1910×974` px（≥720×640 达标，像素是我自己量的）；
- tab1（名字 `甲`）：自己那格 `明` + `3♦ Q♦ 9♣` + `单张 · 应赢 26`、`注级 2` + `投入 18`、`第 26 手·待结算` + `亮牌: 玩家 7S TS 4H / 玩家 3D QD 9C`、台账 `520 = 256+238+26`；
- tab2（名字 `乙`）：`第 27 手·行动中`、`庄◀` 落在另一格、台账 `520 = 254+263+3`、日志 `#002 call 玩家 出 1 @注级1 | timeout->call dark×stake` 与 `1 号位（玩家）重连（hand=20, since=0）`；
- 注入页：页眉 `这一局不可信：patch unusable: pot 104 != sum(committed) 4`、按钮塌成 `已停手：这一局不可信`、**池仍显示 3**；`r12-gui-mitm.log` 有 `original pot=4 → modified pot=104`（committed 2+2）与 101 握手两行 ⇒ 注入真发生；同帧直连对照五按钮齐全、零误报、`512 = 253+252+7`。

分级：产物自洽、以及"这些形状不可由托管产生"（托管只 call、从不 look/raise）= **A**；"点击主体是人手" = 人类监督方自证 —— 这正是 grade-L 那条的本义，签收即闭合。增量重连那半条我只在问答文字里读到（**B**），但增量/快照两路在 rev=10–12 已 grade-A 钉过，不构成缺口。

**9.2 Q7② 裁定 = B（停手是标签页级）**，全文与钉法见 ANSWERS.md 第七轮。要点：(c) 与工单「不许继续发行动」直接冲突，否决；(a) 的决定性反例是 `webui/main.ts:152-156` —— 手动「断开」→「连接」新建 peer，`violations` 随旧 peer 静默丢失（`r12-gui-edge-B-afterrenew.png` 实证），而 `main.ts:134-149` 的自动重连复用 peer（服务端掐线洗不掉）⇒ 洞在人手的两次点击，恰是刚被警告的玩家最自然的动作；工单承诺的主语是页面、不是会话。钉：键 `` `${prefix}:untrusted` ``（既有 `Store` 端口，`netplay.ts:63-67` / `:107-109`），值 `{count, first, hand}`，写真源只许 `peer.info()`，读取先于首帧；解除 = 只有关闭本标签页（断开/刷新/换 URL/切模式都不清），横幅须写明；粘性是地板不是替代；新 `nui/` 一条 + 变异一条；既有期望一条不改。

**9.3 定级与里程碑**：B 作**应修 1 项**进 rev=13（rev=12 符合工单当时字面、PASS 不翻案；实现方按 §0.8 先问后动，正是纪律想要的行为）。§8.7 闭合后，M5 批准的**唯一**剩余闸门 = rev=13 落地 B；落地并过我复审之前，批准范围维持 M4（BRIEF 顶部批准行与 §4 M5「对抗性检查要产品化」行已同步改写，两半指向一致）。

**9.4 环境尾注**：写本补记时房间进程（8790，PID 23232）与中间人（8812，PID 14924）仍在监听；我未动（人类标签页可能仍挂着），请实现方 rev=13 开工前自行收尾。

---

# 以下为 rev=11 复审裁定原文（保留备查）—— 其中的 §编号、口径均属 rev=11 那一份；rev=12 的裁定在顶部这一份

- **rev: 11**（对应工单 §4 "M5 联机可玩"；DELIVERY.md `rev: 11`）
- **结论：不通过 —— 定点返修（REVISE）。必修 1 项、应修 4 项。**
- **裁定时间：2026-09-29T22:25+08:00**
- 复审内容：manifest 我自己从 DELIVERY.md 抽 74 条重算 **两次**（开工 18:17 / 全部实机活动结束之后 22:20，两次均 **74/74 相符、0 条不符**）+ `node test/run.ts` 与 `npm test` 各双跑逐字节比对 + `npx tsc --noEmit` 零输出 + 通读 rev=11 改动面 + 我的临场抽查 **78 条断言（8 节，0 失败）** + 覆盖 oracle **v4 脚本原样**重跑并与 11-F 逐行对账 + **真 socket 上六种 `patch` 篡改注入**（我自己写的 TCP 中间人第二版 `br-mitm2.ts`）+ **20 种 `Connection` 写法 + 三进程 V8 覆盖差分**（只为给一个 400 归因）+ **仓库副本里独立重跑你们那 13 条变异** + 真浏览器 / 真房间进程 / 真第二家打完多手并在 canvas 上真点一次 + 393→408 零回归差集。
- **批准范围：仍停在 M4，本轮不推进。** M5 已交付两轮，rev=10 与 rev=11 均判不通过。BRIEF.md 顶部批准行由我同步维护，加粗正文与括注指向一致（rev=10 那次两半句互相打脸的事没有重演）。
- 证据分级：**A** = 我实测可复现（附命令/产物）；**B** = 我的工具已交叉验证，或由源码链推得；**C** = 我的解读；**X** = 撤回；**L** = 我方工具面限制（**不计交付方账**）。
- 我的产物全部在 `.audit/rev11/`，刻意不入 manifest、不在 `test/` 下。**交付面本轮零改动**：两次 manifest 重算之间我跑过真房间进程、真浏览器、真中间人、以及一份完整仓库副本上的变异扫描，清单里那 74 个文件一个都没碰（两次重算结果逐字相同）。

## 0 · 一句话结论

**rev=10 的必修 2 项 + 应修 9 项，我逐条在源码与实机上核销，全部闭合**（§2 有凭据、§5 有覆盖对账）。**你们三处没顺着我的裁定说，两处是我错、一处我 rev=10 已经站在你们那边**：

1. **`netx/ws.ts:163-167`「按构造不可达」⇒ 你们对，我 rev=10 §8.12(ii) 那半句撤回（X）。** 我在真 socket 上试了 **20 种** `Connection` 写法：10 种派发 upgrade（101）、9 种落进普通请求分支（真房间进程答 **302 → /webui/**）、1 种拿到零正文 400（obs-fold 折行）。那 1 种我用**三进程覆盖差分**定性：`upgrade` 回调**一次都没被调用**（`handlerCount` P=1 / F=**0** / G=1），⇒ 那个 400 是 Node/llhttp 自己答的，不是你们那四处 guard。**我第一版探针把"零正文 400"直接当成"我们的 guard 开了"，是假阳性** —— 你们那四处 guard 写的字节串与 Node 解析错误的字节串**完全相同**，光看响应分不出来。正控（`Upgrade: bogus` 那支 `:159` 调用 1 次）证明这套差分方法不瞎。**A**（`.audit/rev11/connhdr.txt`、`foldcov.txt`）
2. **`srv/06` 原是虚门、M03 第一次逃掉 ⇒ 你们对，而且补强有效。** 我在**仓库副本**里（`.audit/rev11/mutcopy/`，交付面一份没动）独立重跑你们那 13 条变异：**13 caught / 0 survived / 0 skipped**，M03（横幅 URL 退回 `httpUrl`）现在被 `test/netx-serve.test.ts::srv/06` 抓住。**A**（`mutate-rerun.txt`）
3. **三个接口删掉而「协议没缩」** ⇒ 与我 rev=10 的判断一致：`netx/protocol.ts:33` 与 `:364-366` 仍声明 `ping`，`test/netx-room.test.ts:519`（room/21）仍钉回显，删掉的只是页面侧的调用，墓碑注释在 `webui/netplay.ts:262` 与 `netx/client.ts:165`。**A**

**但我 rev=10 §8.13 预告过的那条兑现了 ⇒ 新的必修 1 项：`patch` 上的数字篡改，第二道墙抓不到。** 六种注入（真房间 8820-8833、真中间人、真 `webui/netplay.ts` 客户端）：

| 注入 | 墙抓到 | 我的恒等式抓到 | 直连 B 侧假阳性 |
|---|---|---|---|
| `cards`（把牌面塞进**我自己**那一格） | **是**（`own cards exposed before look (seat 1)`） | — | 否 |
| `oppcards`（把牌面塞进**对手**那一格，本轮我补的一支） | **是**（`cards of seat 0 exposed while revealed=false`） | — | 否 |
| `pot` +100 | **否** | 是（(a)(b)） | 否 |
| 我的 `chips` +100 | **否** | 是（(c)(d)） | 否 |
| 我的 `committed` +100 | **否** | 是（(a)(c)(d)） | 否 |
| 别家的 `chips` +100 | **否** | 是（(d)） | 否 |

数字四支逃过墙之后，页面**没有任何异常表现**：`untrusted=false`、`violations=[]`、`verifiedHand=2`（⇒ 结算面板仍印"揭示核对 通过"）、那一手照常打到结算，而 `view.pot=102`（真值 2）经 `webui/netplay.ts:454`（`pot: view.pot`）与 `:472`（`total` 含 `view.pot`）直接进快照，再由 `webui/scene.ts:300` 渲染成「池 102」。**A**（篡改到达与墙的沉默）+ **B**（渲染链由源码推得，我没有在真浏览器里截到那个 102）

**要紧的不是"漏了一个检查"，是 `test/netx-netplay.test.ts:1391` 的 `nui/25` 把这条边界写成了断言**：标题「patch 上改 chips/pot 抓不到 —— 这是权威面的边界，页面只照抄不背书」，`:1454` 的成文是「patch 上的公开权威数字（chips/pot）**客户端无法独立核对** ⇒ 只照抄」。**这句话被我的实测证伪**：同一份工装上，四条**纯客户端**恒等式在诚实流量上 **78 次采样零不符**（`PROBE_SELFTEST_OK`），在直连对照组 B 上 **零假阳性**，而其中 (a)+(c) 两条就足以抓住上面那四支注入。把一条假边界钉成测试，与工单"不骗玩家"的主题正面冲突 ⇒ 按必修处理，修法与验收口径见 §3。

## 1 · 硬闸门（工单 §0.7 + §5 禁令）逐条结果

| 闸门 | 结果 | 凭据 |
|---|---|---|
| manifest 未被篡改（复审第一步，不可跳过） | **过** | `.audit/rev11/manifest-recheck.txt`（开工）与 `manifest-recheck-final.txt`（全部实机活动之后）逐字相同：**74 条 / 74 相符 / 0 不符**。两份文件末尾都印 `RESULT=MANIFEST_FAIL`，那是**我脚本自己的口径**：它把"交付面上存在未列入 manifest 的文件"也记失败，命中的唯一一个文件是 `webui/dist/index.html`（mtime 09-25 21:01，rev=10 就在，本轮未变，不在清单里）⇒ 见 §6，不算你们的问题。**A** |
| `node test/run.ts` 双跑逐字节一致 | **过** | `node1.txt`≡`node2.txt`，sha256 `8738b996e36562a1a8f093380ce784b9d09037b0c0f03df08564096171e7dcb0`，与你们交付说明里的 `8738b996…` 逐字相符；尾三行 `RUNNER files=29 cases=408 / SUMMARY pass=408 fail=0 / RESULT=ALL_PASS`。**A** |
| `npm test` 双跑逐字节一致 | **过** | `npm1.txt`≡`npm2.txt`（`cmp` 判定 IDENTICAL），sha256 `50c323126c098b804debb0c88534e98b52ff08b10849e7a833bdf28d314afa50`，与你们的 `50c32312…` 相符；同为 408/408 ALL_PASS。**A**（`run-hashes.txt` 里那段 `spawnSync npm.cmd EINVAL` 是**我的** `sup-run.mjs` 在 Windows 上 spawn `npm.cmd` 失败，后来我直接用 shell 跑通的；那份错误留档不删，但不作证据。） |
| `npx tsc --noEmit` 零输出 | **过** | `.audit/rev11/tsc.txt` **0 字节**。**A** |
| 用例数 / 全绿 / 零回归 | **过** | 393 → **408**，`iddiff.txt` 末行 `RESULT=FULLLINE_MULTISET_OK`：基线里出现次数变少或整行消失的 = **0**；新增 15 条全用新编号。（`runcompare.txt` 是**废档**：那一次我的捕获被 GBK  mojibake 污染，逐行比对不作数 —— 留档是为了交代我为什么没拿它说事。零回归以 `iddiff.txt` 为准。）**A** |
| 测试输出无时间戳、无随机序 | **过** | 双跑逐字节一致本身蕴含它；`nst/11` 仍把这条钉成静态门。**A** |
| `src/` 零运行时依赖、无 `Math.random`/`Date.now`/文件网络 IO | **过** | `nst/*` 静态门 + 通读 rev=11 改动面（`webmin/serve.ts::decodePath`、`netx/serve.ts::uiUrl`、`netx/client.ts`、`webui/netplay.ts`、`webui/scene.ts`）未见新增出口。**A** |
| 依赖面：`dependencies` 空、`devDependencies` 只白名单四个、`ws` 未被安装 | **过** | 帧实现仍是手写 `netx/frames.ts`；我的中间人第二版直接 import 它来解帧重编（`.audit/rev11/br-mitm2.ts:17`），这本身就是它够用的证明。**A** |
| 分层：`webui/` 里只有 `netplay.ts` 一个 `netx/` 进口 | **过** | `nst/04` 未再改动 + `nui/02` 那 14 条禁令原样通过（§2 的 8.3）。**A** |
| 硬禁令：**不许为修应修 2 而在 `netplay.ts` 里再写一份协议判定** | **过，我专门查了** | 判据已换成 `peer.info().errors`（`webui/netplay.ts:214-228`），`netplay.ts` 里不再自己 `JSON.parse` 下行去嗅探 `code`；我的 S2 从 17 条断言扩到 **19 条**，"schema 非法 ⇒ 不清凭据、不自动重入桌"已翻绿。**A** |
| Q6=A2 价格接缝 ①–④ | **过** | `src/engine/state.ts::priceOf` 仍是唯一定义；`webui` 只 import；我的 S4（13 条）+ S4b（8 条）本轮重跑 0 失败 —— 包括"买不起跟价的座位按钮仍可点、代价由服务端 `cannot_afford` 送回来"那一支。**A** |

## 2 · rev=10 §8 那十三条验收口径逐条核销（十三条原文见本文件下方保留的 rev=10 §8）

| # | 结论 | 凭据（我这轮自己量的，不是抄你们的自评） |
|---|---|---|
| **8.1 必修 1** | **过** | 真跑 `node netx/serve.ts 8790`，进程真横幅 = `炸金花房间 · ws ws://127.0.0.1:8790 · 页面 http://127.0.0.1:8790/webui/ · 健康检查 …`（`br87-room.log`）；真浏览器打开那个 URL ⇒ `#netUrl` 预填 `ws://127.0.0.1:8790`，切 `#mode` 到"联机"自动连接并入座（`br87-click.txt` §4）。`webmin/serve.ts:42` 那条 `/`→M1.5 映射我 diff 过，原样保留；`srv/06` 现在是"逐字取横幅里那一个字符串再跟到底"，M03 变异被它抓住（§0 第 2 条）。**A** |
| **8.2 必修 2** | **过** | `webmin/serve.ts::decodePath` 把 `decodeURIComponent` 包进 try，畸形 ⇒ **400 `malformed percent-escape`**（我要的档位，不是 500；与既有 `NUL`/`backslash` 同档）；`srv/07` 真 spawn 打四发畸形 + `%00`/越界两档对照 + "打完之后合法路径仍 200"。我另用 M04 变异（400→500）确认这条门真的钉住了状态码档位：caught。**A** |
| **8.3 不许第二份协议判定** | **过** | 见 §1 那一行。出口是 `peer.info().errors`，`netplay.ts` 里没有第二份 schema 判定；`nst/04`/`nui/02` 未动仍绿。**A** |
| **8.4 11-F 必须与我的 oracle 逐行对上** | **过（rev=10 应修 3 闭合）** | 我拿 **v4 脚本原样**（只改了那三条自检的期望值，理由见下）重跑：**22 文件 / 43 段 / 5625 可执行行覆盖 5484 = 97.5%**（rev=10 是 53 段 / 96.7%）。`sup-covdiff.mjs` 逐行对账：我方 43 段 vs 11-F 43 行，**只在我的 oracle 里而 11-F 没列 = 0，只在 11-F 里而我没有 = 0**，双方各自重复段 = 0，`COVDIFFRESULT=OK`。**A** |
| 　↳ 三条地面真值自检 | **两条翻绿，是修复落地不是工具坏** | 实得 **A=`1111`**（`ws.ts:146-149` 已覆盖，应修 9 / 8.12(ii) 前半落地）、**B=`1111011`**（不变）、**C=`11111`**（`webmin/serve.ts:117-121` 已覆盖，必修 2 落地）、D=`11111`。你们在 11-D 第 4 项提前写明"下一轮期望值要跟着改"是对的 —— 我照改了，`sup-cov-final3.mjs` 里注释记着为什么。**A** |
| **8.5 自评表与交付说明不许互相矛盾** | **部分过 ⇒ 应修 1** | rev=10 应修 1 那一格已就地改成事实（`SELF-REVIEW.md:13`），本轮 11-A 与 11-B 内部自洽。**但仍有一处实质矛盾**：`DELIVERY.md:131-132` 说「`webui/netplay.ts` 86.9% → 96.2%（**主路径 `:394-410`** 与离桌/未开局占位格都进来了）」，而你们自己的 11-F 与我的 oracle 都报 **`netplay.ts:403-419` 仍未覆盖**（`sup-cov-final3.txt:178-184`）。详见 §4 应修 1（**其中"主路径"这个措辞是我 rev=10 §8.12(i) 用错的，我撤回，见下**）。**A** |
| **8.6 零回归** | **过** | 见 §1；393 条 ID 一条没丢，新增 15 条全用新编号。**A** |
| **8.7 ≥720×640 真鼠标 + 两标签页** | **仍未执行 ⇒ L 级，不计你们账** | 面板视口 **531×524**，`visibilityState="hidden"`，截图工具报 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`，且工具面**没有开新标签页的原语**。我没有强行把用户的 GUI 拉到前台。**但我用 rev=10 预告的同一套办法（强制尺寸 + 派发 resize + 坐标 MouseEvent）把命中区点亮并真点了一次**，见 §2.7。**L** |
| **8.8 应修 4/5 各带一条无头用例** | **过** | `nui/20`（`lastReject` 在后续行动被接受后不再进 `hintText` 的取值；并且你们把审计面拆成 `rejects` 累积，我用 M10/M11 两条变异分别确认这两个面都被钉住）+ `nui/21`（服务端 `notice` 出现在 `snapshot().log`，`nui/01` 键集不变；M08/M09 两条变异分别打 collect 分支与主分支，均 caught）。我另在**真浏览器 + 真房间**上看到那条挪庄/作废说明进了 log（`br87-click.txt` §4），并用第二个独立客户端（`sup-bot.ts`）复现：`BOTSUMMARY.log` 里含 notice 原文「seat:1 没在 15000ms 内提交份额，这一局不带它」。**A** |
| **8.9 应修 7（「桌上总额」）** | **过（选了①改标签）** | `webui/scene.ts` 导出 `TOTAL_LABEL = '在场筹码+池'`，渲染出口只有一处且引用该常量；`webui/netplay.ts:472` 的 `departed` 过滤仍在，`ledgerLine` 同口径。`nst/12` 五段判据我逐条读了：①文案必须含"在场"且不许出现"桌上/总共/全部/所有"；②渲染处唯一；③过滤口径 + `ledgerLine` 同口径；④**注释剥离后**全仓扫不到旧标签，并且 `webmin/app.ts` 必须含同一个词（⇒ 两个页面入口一把尺）；⑤**三组正向对照，每组先断言 `assert.notEqual(mutated, original)`** —— 这条我最看重，锚点打不中的对照组等于空转，你们自己先钉住了。真浏览器读数：`total=512 / ledgerLine="玩家=260 监督乙=250"`；另一手 `total=509`，seats 含离桌占位（chips=0）⇒ 268+234+pot 7=509，与"离桌不计入"逐字相符。**A** |
| **8.10 应修 8（D02 前提写进 10-F）** | **过** | 11-F 那一行已写明恒等只在 `startRoom` 硬编码 `firstDealer: 0`（`netx/serve.ts:45`）时成立，且 `firstDealer` 不在 `seated` 里时 `dealerAmong` 的绕回兜底可观测。纯文书，一行字，做到了。**C** |
| **8.11 §5(c) 四段房间自检** | **过** | 四行 K3 各带**可被反驳的**前提（`projectView` 白名单正确 / `commitOf`+`seedFromShares`+`revealMatches` 三者互逆 / `checkAction` 与 `apply` 同判定），没有一行写"没找到用例"。**C** |
| **8.12(i) `netplay.ts:394-410`** | **过，但我 rev=10 的措辞撤回（X）** | 座位格主路径现在有用例了（`nui/23`，M12 变异打 `resultText` 那一列被 caught）。**但我把它叫"主路径"是我叫错了**：`:398-419` 是 `.concat()` 的"在局但不在名册"兜底，源码注释自己写着「理论上不出现」⇒ 它是 K5（按构造不可达），不是主路径；真正的主路径是 `:370-397` 那一段 roster 映射，它现在覆盖了。你们的 11-F 分类是对的，`DELIVERY.md:131` 抄了我的错标签（§4 应修 1）。**A** |
| **8.12(ii) `ws.ts:146-149` 与 `:164-167`** | **前半过，后半撤回（X）** | `:146-149` ⇒ `ws/07` 五段（钩子抛 ⇒ **500** + `room handler failed: boom`、连接不残留、`/health` 仍 200 且 `fault:null`、钩子答 203、钩子回 false ⇒ 404、随后真握手仍 101），oracle 自检 A=`1111`；我用 M01（500→400）与 M02（异常原文被吞）两条变异确认这条门钉住了"别顺手改成 400"。**`:164-167` 那半句我撤回**：见 §0 第 1 条，它按构造不可达，你们把它做成 `ws/08` 的地面真值用例是对的。**A** |
| **8.13 换注入点改 `patch`** | **⇒ 必修 1** | 见 §0 表与 §3。**A** |

### 2.7 §8.7 我这轮在真浏览器里量到了什么（`.audit/rev11/br87-click.txt`）

- **`hits()` 为空的归因（A 级）**：`snapshot().buttons` 有 5 个 legal 按钮而 `__zjh3.hits()` 返回 `[]`。我列过两个假设，都验了：
  - 假设 A（rAF 门控，因为面板 `hidden` 所以 render 没跑）⇒ **排除**：`webui/main.ts:256` 的 `scene = buildScene(...)` 是 `render()` 里的**同步**赋值，`:262-267` 的 `requestAnimationFrame` 只在"有翻牌在飞"时续帧，不是 `scene` 的唯一写入点。
  - 假设 B（窗口太小分支）⇒ **成立**：`webui/scene.ts:80` `MIN_VIEWPORT = { w: 560, h: 560 }`，实测 canvas `clientWidth×clientHeight = 526×468`，`526 < 560` ⇒ 走 `:250-251` 的 `notice(...)`，该分支不产出任何 hit。**这是正确行为**（页面在说真话："窗口太小（需要至少 560×560），当前 526×468"），不是缺陷。
  - 复核：把 canvas 的 CSS 盒子撑到 760×660 再派发 `resize`（`main.ts:323` 挂着监听）⇒ hits 立刻出现 5 个（`btn:0..btn:4`，y=604、h=28、w≈135.2）。撑大 CSS 盒子只影响 `clientWidth/clientHeight` 这两个入参，画面被面板裁掉 ⇒ **"玩家看得见"这部分仍未验证**。
- **真 DOM 点击 → 真上行 → 真服务端事件（A 级，本轮新增的最硬一条）**：在 canvas 上派发 `MouseEvent('click')`，坐标 = `getBoundingClientRect()` + `hits()[0]` 中心，走的是 `main.ts:314-322` 那个真监听器（`hitAt` → `send` → `net.act` → `sock.send`），不是直接调 `__zjh3.click`。点击前 `seq=4`，同一 tick 内 `hint` 不改写（与 `:317-320` 一致：成功时 `send` 返回 null），下一个 tick `seq=5` 且 log 新增 `#005 look 玩家 @注级2｜闷→明`，`errors=[]`。⇒ `webui/main.ts`（无头覆盖恒为 0，设计如此）在真浏览器里跑通了。
- **越权行动被拒（真浏览器）**：不是自己回合时点「看牌」⇒ `hint` = 「没发出去：turn is seat 1, not 0」。
- **服务端托管可见（真浏览器）**：log 里 `#002 call 玩家 出 1 @注级1｜timeout→call dark×stake`。
- **`__zjh3.disconnect()`** ⇒ `mode="solo"`、`status="未开局。点\"开新一桌\"。"`（M5 退回单机路径干净）。
- 事件是脚本派发的（`isTrusted=false`），我如实写明；但监听器、命中判定、上行编码全是页面自己那一套。**截图与真两标签页这两件我仍没做到 ⇒ 按 rev=10 §8.7 的原话，这一条判"工具面不可验"，不算你们未达标，我也不假装它已验。**

## 3 · 必修（阻塞 rev=12 PASS，共 1 项）

### 必修 1 · `patch` 上的数字篡改抓不到，而 `nui/25` 把"抓不到"写成了"客户端无法独立核对"（A 级）

**事实（全部 A 级，产物 `.audit/rev11/potcheck-{control,pot,chips,committed,otherchips,cards,oppcards}.txt`、`p-mitm-*.log`、`p-room-*.log`）**

1. 我在真 socket 上改了**一条 schema 完全合法**的 `t=patch` 下行（不多 key、不少 key、类型不变，只动数字），六种注入见 §0 表。中间人自己记账（`MITM2 armed` / `MITM2 INJECTED` / original / modified 四行），所以"抓不到"不可能只是"根本没注入"。
2. **数字四支全部逃过第二道墙**：A 侧 `violations=[]`、`untrusted=false`、`verifiedHand=2`、`trustLines=[]`，那一手**照常打到结算**（日志里 A 与 B 都印了"看到第 2 手结算 untrusted=false"）。
3. **牌面两支被抓**：`checkViewLeak`（`netx/protocol.ts:512-522`）的两条分支我都打到了 —— `:518`（塞进我自己那格）与 `:521`（塞进对手那格，本轮我新加的 `oppcards` 支路）。抓到之后页面 `untrusted=true`、提示行「⚠ 这一局不可信：patch unusable: cards of seat 0 exposed while revealed=false」、五个按钮塌成一个「已停手：这一局不可信」。**⇒ 那道墙不是只认揭示这一条路，它认牌面；它不认数字。**
4. **四条纯客户端恒等式在诚实流量上零假阳性**：对照组（不注入）跑完 3 手，**78 次采样、0 处不符**，`PROBE_SELFTEST_OK`；每一支注入run 里**直连的 B 侧命中恒为 0**（注入不可能落到 B 身上，B 上任何命中都说明我的公式错）。
   - (a) `view.pot === Σ view.seats[].committed`
   - (b) `view.pot === 该手 deal 的 ante 合计 + Σ log 里的下注额`
   - (c) 同一手内**我自己**的 `chips + committed` 恒定
   - (d) 同一手内**全桌** `Σ(chips + committed)` 恒定
5. 覆盖关系（实测，不是推理）：(a) 单独就能抓住 `pot` 与 `committed` 两支；(c) 抓住我自己的 `chips`；(d) 抓住别家的 `chips`。**⇒ (a)+(c) 已经能抓住四支里的三支，加上 (d) 或它的逐座位版本就全覆盖。**

**为什么算必修，不算应修**

- 这不是"少了一个锦上添花的检查"。`webui/netplay.ts:454` 是 `pot: view.pot`、`:472` 的 `total` 含 `view.pot`，`webui/scene.ts:300` 把它渲染成「池 N」，`:379` 把 `total` 渲染成「在场筹码+池 N」。⇒ **一个坏掉或敌意的服务端可以让页面印出一个假的池、假的筹码，而玩家手上没有任何线索**：不停手、不报警、结算面板还显示"揭示核对 通过"。这正对着工单的主题（"不骗玩家"），也正对着 rev=10 应修 4/7 的同一类问题（**显示的行在陈述一个与自己口径不符的事实**）—— 那两条你们都修了，这一条比那两条更严重，因为它连"口径"都不提，直接是假数字。
- 而且**它已经被写成断言钉住了**：`test/netx-netplay.test.ts:1391` 的标题与 `:1454` 的成文都断言"客户端无法独立核对"。这句话是假的（第 4、5 条）。一条把假边界钉成测试的用例，比没有用例更糟 —— 它会让下一轮的复审者和实现者都不再去查这一块。
- 我 rev=10 §8.13 逐字预告过：「**如果 `patch` 上的篡改抓不到，那会是一条新的必修**，所以我先说在这里，免得到时候像是临时加码。」现在兑现，不是临时加码。

**修法（最小改动，我不规定实现细节）**

- 位置：`netx/client.ts::checkView`（`:113-125`）。它已经拿到整份 `v`，返回值非 null 就由 `:230`/`:243` 走既有 `violate('snapshot unusable: …')` / `violate('patch unusable: …')` ⇒ **停手、提示行、按钮塌陷那一整套现成的机制会自动接上**，不需要新通道。
- 至少要覆盖 (a) 与 (c)（或 (c) 的逐座位版本，它同时涵盖 (d)）。**若用 (b) 或 (d)，必须显式带守卫**：(b) 依赖 `view.log` 完整（日志一旦被截断就会假阳性），(d) 依赖名册恒定 —— 我**只在 2 人、名册不变的桌上**验过 (d)，有人中途离桌/被剔出本局时它是否仍成立我**没验**（离桌占位格的 `chips` 在真浏览器上读到过 0）⇒ 这部分 **B 级**，用它就得自己把守卫写清楚。
- 一手之内的边界要处理干净：`enterHand`（`:103-111`）已经在换手时清 `log`/`view`/`seq`，"同一手内恒定"这类检查的基准应当挂在同一处，别跨手比。

**用例要求（这是我要的验收口径，不是建议）**

1. `nui/25` **必须改写**，标题与断言都跟着新事实走。**不许直接删掉了事** —— 它现在承担的"公开权威数字从哪来、页面背不背书"这个问题仍然要成文，只是答案从"无法核对"变成"核对这四条，不符就停手"。
2. 新增用例必须包含**两组对照**：① 诚实流量上恒等式不误报（可以直接把我那 78 次采样的形状做成无头版：喂一串真 `patch`，断言 `violations` 恒空）；② 篡改必报（`pot`/`chips`/`committed`/别家 `chips` 四种各一条，断言 `untrusted=true` 且此后 `act()` 一律拒绝发出）。
3. 请**保留**牌面那两支的既有用例（`nui/24`、`proto/07`、`proto/08`、`leak/05`）；我这轮的 `cards`/`oppcards` 与它们是同族的，M13 变异（`:521` 改成 `continue`）现在被这四条一起抓住，别在改写时把这个族打散。
4. 变异表请加一条：把 (a) 或 (c) 的检查摘掉，断言对应用例翻红。

**我不要求的**：不要求服务端侧任何改动；不要求把 (b)(d) 都实现；不要求覆盖"多个数字同时被改"的组合。

## 4 · 应修（不阻塞 rev=12 PASS，但请一并做掉）

1. **文书三处（其中一处是实质矛盾）。** **A**
   - **`DELIVERY.md:131-132` 与 11-F 矛盾（实质）**：「主路径 `:394-410` … 都进来了」，而 11-F 与我的 oracle 都报 `netplay.ts:403-419` 仍未覆盖（K5）。**"主路径"这个措辞是我 rev=10 §8.12(i) 用错的，我撤回（X）**，你们抄了我的错标签 —— 但矛盾仍然要消掉：请把那一行改成事实（例如"`:370-397` 座位格主路径已进；`:403-419` 是 `.concat()` 的"在局但不在名册"兜底，K5 按构造不可达"）。**rev=10 应修 1 立的就是这条规矩：自评表不许与交付说明互相矛盾，我核销靠的是这两份文件互相对账。**
   - `SELF-REVIEW.md:13` 的交叉引用指错节：写的是"与本节 **11-C** 的 `nst/04` 未再改动互相自洽"，而 11-C（计数、回归与工装）里**没有** `nst/04` 这句话；说"`nst/04` 未动"的是 **11-B** 的 8.3 那一行（`:29`）。**C**
   - `SELF-REVIEW.md:31` 说「`DELIVERY.md` 的"改 `nst/04`"表述本轮改为**引用 BRIEF §4 M5 ⑤ 的可执行版本**」，而 DELIVERY.md 里没有这个引用（`:93-94` 只指向 `SELF-REVIEW.md` 10-A 那一格）。结果是一致的（确实不再矛盾），但描述与实物不符 ⇒ 下一轮的复审者会拿这句话去 DELIVERY.md 里找一个不存在的引用。**C**
2. **四处握手 400 与 Node 自己的解析错误 400 字节完全相同 ⇒ 不可归因（A 级，本轮新发现）。** `netx/ws.ts:159`、`:164`、`:171` 三处 guard 写的都是 `HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n`（零正文），Node/llhttp 拒绝 obs-fold 折行时写的**也是这一串**。我为了判定"这个 400 是谁答的"不得不开三个进程做 V8 覆盖差分（`sup-fold-cov.mjs`），第一版探针还因此给出了假阳性。**建议**：每条 guard 带一小段**各不相同**的纯文本正文（RFC 6455 §4.2.1 允许 400 带正文），例如 `upgrade header missing` / `connection header lacks upgrade` / `sec-websocket-version missing`；这样运维一眼能分清是谁答的，复审也不必做覆盖考古。**附带两条同族的文书/口径**：**A**（不可归因，实测）+ **C**（要不要改由你们定）
   - 11-D 说实测了 **10 种** `Connection` 写法，而 `ws/08` 只钉了 **4 种**（`Upgrade Keep-Alive`、`Upgrade\tKeep-Alive`、`Upgrade Upgrade`、`Upgrade:`）⇒ 剩下 6 种从交付面无法复核。我这轮自己补到 20 种（`connhdr.txt`），结论与你们一致，但请把"实测 10 种"与"用例钉 4 种"这两个数字在 11-D 里分开写，别让下一轮的人以为 10 种都在门里。
   - `ws/08` 的判据是 `HTTP/1.1 404 Not Found` + 那句固定正文，那描述的是**不带静态钩子**的 `createWsRoom`；而真房间进程（`netx/serve.ts` 带钩子）在**同一档**答的是 **302 → /webui/**（我 20 种里 9 种落这一档，全部 302，`connhdr.txt` 末尾已注明这个差别）。用例本身没错（它测的就是它搭的那个配置），但请在 11-D 里写明这一档在真进程上是 302，否则下一轮的复审者拿 404 去对真进程会以为坏了。
3. **`webui/netplay.ts:324` 的 collect 分支缺 `.slice(-40)`（C 级，nit）。** 主分支（`:453` 那一条）有上限，collect 分支是 `log: [...trust, ...notices]` 无上限。现在安全**只是因为** `notices` 被 `:308` 的 `slice(-6)` + 去重兜住；那个上限一抬高，两条分支的日志长度口径就会分叉。要么补一个 `slice`，要么加一条静态门钉住"notices 上限 ≤ log 上限"。
4. **`nui/25` 改写之后，请顺手复核 `SELF-REVIEW.md` 11-F 里所有以"客户端无法独立核对"为前提的分类行。** 必修 1 一旦落地，那些行的"为什么不可达/为什么不用测"的理由会变；11-F 是你们唯一的披露面，理由过期比行号写错更难查。**C**

## 5 · 覆盖缺口（不阻塞；oracle = `.audit/rev11/sup-cov-final3.txt`，v4 脚本原样、只改了三条自检的期望值）

**22 文件 / 43 段未覆盖 / 5625 可执行行覆盖 5484 = 97.5%**（rev=10：53 段 / 96.7%）。四条地面真值自检实得 **A=`1111`、B=`1111011`、C=`11111`、D=`11111`**，全绿。

**11-F 与我的输出逐行对账：43 vs 43，只在我这边 = 0，只在你们那边 = 0，双方各自重复 = 0，`COVDIFFRESULT=OK`（`.audit/rev11/covdiff.txt`）⇒ rev=10 应修 3 闭合。**

`webui/netplay.ts` 86.9% → **96.2%**（剩 3 段，含 `:403-419` 那个 K5 兜底）、`netx/ws.ts` 93.6% → **95.3%**（`:146-149` 已覆盖）、`src/rules.ts` 剩 1 段恒真。我 rev=10 §5 点名的那些段落（`room.ts`、`model.ts`、`paint.ts`、`scene.ts`、`engine/*`、`ai/honest.ts`）本轮全部进了 11-F 的表，一行一段、没有归类合并 ⇒ 这正是 8.4 要的形状。

**我对覆盖率本身的保留意见只有一条**：`webui/main.ts` 恒为 0% 是设计如此（浏览器入口，无头跑不到），我这轮用真浏览器点击把它跑通了（§2.7），但**它不进 oracle 的分母** ⇒ 97.5% 这个数字里没有它。这不是缺陷，是口径，我写明以免下一轮有人拿它当"已测"。

## 6 · 明确不算问题的（防止你们返工过头）

- **`webmin/app.ts:174` 硬编码标签**：我本来怀疑它与 `TOTAL_LABEL` 两把尺，读了 `nst/12` 之后撤回 —— ④ 用 `read('webmin/app.ts').includes(text)` 把两个页面入口缝在同一个词上，⑤ 还有三组正向对照且每组先断言锚点命中。**不是问题。**
- **`webui/dist/index.html`**：mtime 09-25 21:01，rev=10 就在，不在 manifest 里，本轮未变。我的 manifest 脚本因为"交付面上有未列入清单的文件"而印 `RESULT=MANIFEST_FAIL`，那是**我脚本的口径**（74/74 相符、0 条不符才是判据）。**不是本轮的问题**，也不要求你们处理。
- **你们披露③（为拿 K4 的进程入口覆盖而给 `webmin/serve.ts` 加一个干净退出的 `quit` 门）：裁定为"不要做"。** 我核了实物：`webmin/serve.ts` 里没有 `stdin`/`quit`/`process.exit`（`netx/serve.ts:122` 那个门是另一回事，它本来就在）。**K4 的取证边界就按"独立静态服务的进程入口不可测"记**，不必为了一个覆盖数字往交付面加一条运维入口 —— 收益与风险不成比例，而且那个门本身就是新的攻击面。若将来因为别的理由需要它，请加用例并在 11-F 里写明它不是为覆盖而加的。
- **`byCodepoint`（`netx/seed.ts:73-75`）与默认 `.sort()` 两把尺**：rev=10 应修 6 第二小条，我已验过二者等价（都是 UTF-16 码元序）⇒ **无可观测分歧**。名字是个 misnomer，改不改随你们，我不会再提第三次。
- **`h.expected` 在 `room.ts:256`/`:302` 的两处排序写法**：同上，等价，不算问题。
- **`ws/08` 只有 4 种写法**：见 §4 应修 2，那是**文书**问题（11-D 说 10 种），不是用例缺陷 —— 4 种都真实钉住了"upgrade 没派发"这一档。

## 7 · 复审怎么复现（产物都在 `.audit/rev11/`；刻意不入 manifest、不在 `test/` 下）

```bash
# ① 清单（我自己从 DELIVERY.md 抽，不用交付方的现成文件）
node .audit/rev11/sup-manifest.mjs            # ⇒ 74 条 / 74 相符 / 0 不符（末尾 RESULT=MANIFEST_FAIL 见 §6）

# ② 双跑 + 类型（npm 那一路要直接用 shell 跑，我的 sup-run.mjs 在 Windows 上 spawn npm.cmd 会 EINVAL）
node test/run.ts > /tmp/n1 2>&1; node test/run.ts > /tmp/n2 2>&1; cmp /tmp/n1 /tmp/n2
npm test > /tmp/m1 2>&1; npm test > /tmp/m2 2>&1; cmp /tmp/m1 /tmp/m2
npx tsc --noEmit                              # ⇒ 零输出

# ③ 我的临场抽查（78 条断言，8 节，每节断言数 > 0）
node .audit/rev11/sup-spot-check.ts           # ⇒ SPOT total=78 failures=0 / SPOT=OK

# ④ 覆盖 oracle（v4 脚本原样，只改了三条自检的期望值；它只读 coverage JSON 与源文件，不改任何东西）
NODE_V8_COVERAGE=.audit/rev11/cov node test/run.ts
node .audit/rev11/sup-cov-final3.mjs > .audit/rev11/sup-cov-final3.txt
node .audit/rev11/sup-covdiff.mjs             # ⇒ COVDIFFRESULT=OK（43 vs 43）

# ⑤ 零回归差集（ID 零丢失）
node .audit/rev11/sup-iddiff.mjs              # ⇒ RESULT=FULLLINE_MULTISET_OK

# ⑥ §8.13 的六种 patch 注入（每支自带对照阶段与 PROBE_SELFTEST_OK；房间端口 8820+2*index）
node .audit/rev11/sup-potcheck.ts control     # ⇒ 78 次采样 0 不符（探针自检）
node .audit/rev11/sup-potcheck.ts pot         # ⇒ VERDICT pot: 墙抓到=false 我的恒等式抓到=true B侧假阳性=false
node .audit/rev11/sup-potcheck.ts chips       # committed / otherchips 同形
node .audit/rev11/sup-potcheck.ts cards       # ⇒ 墙抓到=true（protocol.ts:518）
node .audit/rev11/sup-potcheck.ts oppcards    # ⇒ 墙抓到=true（protocol.ts:521，本轮我新加的一支）

# ⑦ ws.ts:163-167 的可达性（20 种 Connection 写法 + 三进程覆盖差分）
node .audit/rev11/sup-connhdr.mjs > .audit/rev11/connhdr.txt      # ⇒ CONNRESULT=NEEDS_ATTRIBUTION
node .audit/rev11/sup-fold-cov.mjs > .audit/rev11/foldcov.txt     # ⇒ FOLDRESULT=NODE_ANSWERED（handlerCount F=0）

# ⑧ 变异复跑（在**副本**里跑，交付面一份不动；跑完我把副本删了，理由见下）
tar --exclude=.audit --exclude=node_modules --exclude=.git -cf - . | (mkdir -p /tmp/mutcopy && tar -xf - -C /tmp/mutcopy)
cd /tmp/mutcopy && node <repo>/.scratch/r11-mutate.mjs      # ⇒ TOTAL=13 caught=13 survived=0 skipped=0
#   为什么删副本：`.audit/rev11/mutcopy/` 里是一份完整的源码拷贝，留着会污染全仓 grep
#   （本轮我自己就中过一次：搜一句报错文案，命中里同时出现真文件与副本里的那一份）。
#   证据是 mutate-rerun.txt，不是那份拷贝；要复核就按上面两行现造一个，别把它常驻在仓库里。

# ⑨ 真浏览器 / 真房间 / 真第二家（§2.7）
node netx/serve.ts 8790 &                                         # 横幅见 br87-room.log
node .audit/rev11/sup-bot.ts 8790 监督乙 4                        # 裸端口号，不是 ws:// URL；BOTSUMMARY 见 br87-bot2.log
# 浏览器打开横幅里那个 /webui/ URL，然后按 br87-click.txt 的步骤派发 resize 与 MouseEvent
```

## 8 · 下一轮（rev=12）验收口径 —— 我按这八条逐条查

**8.1 必修 1**：`pot` / 我的 `chips` / 我的 `committed` / 别家的 `chips` 四种 `patch` 篡改，**每一种**都必须让页面 `untrusted=true`、`act()` 此后拒绝发出、提示行给出理由。我会用**同一份** `sup-potcheck.ts`（只改期望值）重跑六支，判据是 `VERDICT` 那六行的"墙抓到"全部翻成 `true`，而 `control` 那一支的 78 次采样**仍然 0 不符**（不许靠放宽检查来换绿）。**正向对照我会一起看**：诚实流量上误报 ⇒ 与"抓不到"同罪，都是让提示行说谎。

**8.2 `nui/25` 必须改写而不是删除**，且新增用例带 §3 要求的两组对照 + 一条变异。牌面那一族（`nui/24`、`proto/07`、`proto/08`、`leak/05`）不许在改写中被打散。

**8.3 应修 1 的三处文书**：`DELIVERY.md:131-132` 与 11-F 必须一致（我会拿 `sup-cov-final3.txt` 的行号逐字对）；`SELF-REVIEW.md:13` 的交叉引用指到 11-B；`:31` 的描述与 DELIVERY.md 实物一致。

**8.4 应修 2**：若你们选择给四处 400 加各不相同的正文，请加一条用例钉住"三条 guard 的正文互不相同"（否则下一次重构又会把它们并回同一串）；若选择不改，请在 11-D 里写明"这个 400 与 Node 解析错误的 400 字节相同，归因需要覆盖差分"，并把 11-D 的"10 种写法"与 `ws/08` 的"4 种"分开写、把真进程上那一档是 302 写清楚。

**8.5 覆盖 oracle 口径不变（v4）**，但**三条自检的期望值本轮起改为 A=全 1、C=全 1、B=`1111011`、D=全 1**（`sup-cov-final3.mjs` 里已经是这个）。11-F 继续要求逐行对上，`sup-covdiff.mjs` 我会原样重跑，`onlyMine`/`onlyTheirs` 都必须为 0。

**8.6 零回归**：408 条 ID 一条不许丢（`comm -23` 为空）；新增用例继续用新编号。

**8.7 §8.7（≥720×640 真鼠标 + 两标签页）仍归我，仍不因此判你们不合格。** 若下一轮我的面板视口仍 < 560×560，我会继续用"强制尺寸 + 派发 resize + 坐标 `MouseEvent`"这套办法，并照本轮这样把"哪部分验到了、哪部分只是工具面不可验"分开写。**用户若要我把这一条真验到底，需要把内嵌浏览器面板打开到 ≥720×640。**

**8.8 我不会再加新的注入点。** 本轮六种注入已经覆盖了 `patch` 的全部可篡改面（数字三类 + 牌面两类 + 对照），rev=12 我只重跑同一套，不再换新花样 —— 免得每一轮都像是临时加码。若必修 1 落地后我的恒等式与新检查出现重叠，我会以**你们的门**为准，我的探针退成对照组。

---

# 以下为 rev=10 复审裁定原文（保留备查）—— 其中的 §编号、以及下面那份「附 A」，均属 rev=10 那一份

- **rev: 10**（对应工单 §4 "M5 联机可玩"；DELIVERY.md `rev: 10`）
- **结论：不通过 —— 定点返修（REVISE）。必修 2 项、应修 9 项。**
- **裁定时间：2026-09-28T23:20+08:00**（合并定稿；两班并行复审各自独立完成一遍，见 §2.8 与附 A）。全量复审内容：manifest 重算 **六次**（开工 21:06 / 中途 21:49 / 真浏览器活动之后 22:20 / 合并定稿之后 / 本轮两次末次编辑之后各一次，六次均 74/74 OK、0 条不符）+ `node test/run.ts` 与 `npm test` 各双跑逐字节比对 + `npx tsc --noEmit` 零输出 + 通读 rev=10 改动的源文件 + **两份互不共享代码的临场抽查**（74 条 + 103 条断言）+ **第四版覆盖 oracle（带三条地面真值自检）** + 真浏览器/真 socket/真房间进程跑完两整手 + **我自己写的 TCP 中间人代理在真 socket 上改一个十六进制字符** + 我自己写的 Node "第二个人"机器人 + 22 条变异表逐条读 + 362→393 零回归差集
- **批准范围：未推进（并已纠一处越权推进）。** 定稿时我发现 BRIEF.md 顶部批准行的**加粗正文已被写成「当前批准范围：M5 联机可玩」**，而它自己括注里明明白白写着「rev=10 裁定不通过 ⇒ 批准范围仍停在 M4；本行本轮不推进」—— 两句话互相打脸，实现方只读加粗那半句就会以为 M5 已验收、可以不做返修。加粗正文是我的维护面（括注里写明"此行由监督方维护"），**已改回「M4 联机（rev=9 裁定 PASS）」并就地写清「M5 已交付但裁定不通过、尚未批准」**。**A**
  谁把它推上去的我没有证据，不点名（按纪律：一个假设必须能覆盖全部观察才能写进裁定）；本轮两班并行、两边都在写协议文件，是最省事的解释，但也仅是解释。**C**
- 证据分级沿用上一轮：**A** = 我实测可复现（附命令/产物）；**B** = 我的工具已交叉验证；**C** = 我的解读；**X** = 撤回。
- 我的产物全部在 `.audit/rev10/`，刻意不入 manifest、不在 `test/` 下。本轮两班并行，前缀分别是 `sup-*`（第一班）与 `br-*`/无前缀（第二班）；**两班的产物一个都没删**，本裁定引用时会写明是哪一份。终审 oracle 是 `sup-cov-final2.mjs` → `sup-cov-final2.txt`（第四版，见 §2.9），前三版 `cov-report.txt`、`sup-cov-report2.txt`、`sup-cov-final.txt` 都留着备查，**不要拿它们当覆盖率依据**。

## 0 · 一句话结论

**M5 的实质做成了：真浏览器 + 真 socket + 真房间进程下两个座位打完了两整手，看牌/加注/比牌/结算面板/第二手轮庄全部对得上，断线重连台账一颗不差（total 471 === 471），注入伪造下行当场停手且不泄漏别家牌，按钮上的金额与服务端台账里那笔逐字相等（Q6=A2 的①–④我独立验到）；362→393 零回归，ID 一条没丢。**

**其中"注入伪造下行"这一条，我做到了真字节层（§2.10）**：我自己写了一个 TCP 透传代理（8791→8790，握手逐字节透传、用你们自己的 `netx/frames.ts` 解帧重编、客户端方向保留掩码），在真实 socket 上把一条 `reveal` 里 `shares[0].value` 的**第一个十六进制字符**改掉 —— 这条报文 schema 完全合法，唯一的问题是承诺开不出来。真页面当场印出「⚠ 这一局不可信：reveal check failed…」、五个动作按钮塌成一个不可点的「已停手」、`verifiedHand` 退回 `null`、结算面板「揭示核对 通过」翻成「未通过」，随后 look/call/fold 三次全被拒。**对照组**：未注入的 hand 1 与 hand 6 全程 `untrusted=false`、`verifiedHand=1`/`6`。⇒ **第二道墙在真页面上是活的，不是只活在夹具里。**

**判不通过的只有两件事，都在"入口"上而不在牌桌逻辑里**：房间进程自己印出来的页面 URL 落在 M1.5 单机页（照着 DELIVERY 的复现步骤走根本玩不到联机），以及独立静态服务被一条 `GET /%` 直接打死（与你们本轮自己修掉的缺陷④同一类，且对照组就在隔壁；两班各自独立发现、三次独立复现）。两条都是几行的修法，改完我按 §8 那**十三**条重新量。

**一句自我更正，放在最显眼处**：本轮我先后用了**四版**覆盖 oracle，**前三版都有毛病**（编号与 §2.9 一致：第一版 = rev=9 那版，跨进程 fill，**假阴性**；第二版 = 本轮改成 OR-merge 但跳过 `isBlockCoverage=false` 条目，**假阳性** —— 一个"只 import 没调用"的子进程靠 V8 的顶层合成 range 把 `netx/ws.ts` 整个刷成 100%；第三版 = 我自己剔除顶层 range，把真跑过的顶层代码判成未覆盖，又是**假阴性**）。第二版据此写下的「`netx/ws.ts` 236/236、`netx/room.ts` 638/638、服务端权威面无任何保留意见」以及对 rev=9 §5(c) 的撤回，**全部作废（X）**；第四版带三条地面真值自检（§2.9），实测 `ws.ts` = **221/236（93.6%）**、`room.ts` = **623/638（97.6%）**，全局 22 文件 / **53 段**未覆盖。**你们如果已经照早期那份 §5 排过返修计划，请以现在的 §5 为准。**

## 1 · 硬闸门（工单 §0.7 + §5 禁令）逐条结果

| 闸门 | 结果 | 凭据 |
|---|---|---|
| manifest 未被篡改（复审第一步，不可跳过） | **过** | 我自己从 DELIVERY.md 抽出 74 条重算：`.audit/rev10/manifest-claimed.txt`，`sha256sum -c` ⇒ **74/74 OK，0 条不符**。**本轮共验四次，全部 0 条不符**：开工 21:06（`manifest-recheck.txt`）、真浏览器活动之前 21:49、浏览器/socket 全部跑完之后 22:20（`manifest-recheck-final.txt`）、以及**本裁定合并定稿之后**（`manifest-recheck-consolidation.txt`，74/74 OK）。这条要验四次是因为中间有真进程、真 socket、真浏览器在仓库里跑过，我得确认没有任何一次复审活动顺手改到交付面。另核：五个协议文件都不在清单里（`grep -E 'REVIEW\|BRIEF\|QUESTIONS\|ANSWERS\|DELIVERY'` 只命中 `SELF-REVIEW.md`，那是交付文件）。**A** |
| `npm test` 双跑逐字节一致 | **过** | `npm1.txt`≡`npm2.txt`，sha256 `742e55c6…5655c`，与 TEST-OUTPUT.md:29-30 逐字相同。**A** |
| `node test/run.ts` 双跑逐字节一致 | **过** | `node1.txt`≡`node2.txt`，sha256 `9ced9567…7dbc4`，与 TEST-OUTPUT.md:27-28 逐字相同。**A** |
| `npx tsc --noEmit` 零输出 | **过** | `.audit/rev10/tsc.txt` 内容只有 `tsc_exit=0`。**A** |
| 用例数 / 全绿 | **过** | `RUNNER files=29 cases=393 / SUMMARY pass=393 fail=0 / RESULT=ALL_PASS`，与 DELIVERY.md:105 一致。**A** |
| 测试输出无时间戳、无随机序 | **过** | 双跑逐字节一致这件事本身就蕴含了它；另 `nst/11` 把"带 PID 的实验警告"这条双跑破口钉成了静态门（rev=9 §4 应修 6 的延伸，我认可）。**A** |
| `src/` 零运行时依赖、无 `Math.random`/`Date.now`/文件网络 IO | **过** | `nst/*` 静态门 + 我通读 rev=10 改动面确认没有新增出口；页面侧熵源只有 `crypto.getRandomValues`，拿不到就拒绝连接而不退回 `Math.random`（SELF-REVIEW 自我决定 ⑧，我认可这个取舍：份额可预测会让 commit-reveal 前提失效，比连不上更糟）。**A** |
| 可擦除语法 / `strict: true` | **过** | `tsc --noEmit` 零输出 + `erasableSyntaxOnly` 在 tsconfig 里；Node 24 直接跑 `.ts` 本身就是擦除语法的活体证明。**A** |
| **任何单方决定种子 = 磨种子** | **过，且我重点查了** | 份额仍是 commit-reveal 多方合成；`verifiedHand` 只在客户端用**所有**已揭示份额重算出种子之后才前进（我在真浏览器里量到 `verifiedHand: 2`）。我的 S5 还把 `nextDealerOf` 做了全枚举引理（10 条断言），确认挪庄那一步没有"挑一个对自己有利的庄"的余地。**A** |
| 依赖面：`dependencies` 为空，`devDependencies` 只有白名单四个 | **过** | `ws` 仍然**没有**被安装，帧实现是手写的 `netx/frames.ts`（100% 覆盖）。**A** |
| 分层：`src/`、`webmin/` 不知道联机存在；`webui/` 里只有 `netplay.ts` 一个进口 | **过** | `nst/04`（标题按新口径重写，见 §4 应修 1 与 §6-9）+ 我自己从 `webui/index.html` 起遍历模块图确认只有那一个 `netx/` 进口。**A** |
| Q6=A2 价格接缝 ①–④ | **过** | ① `src/engine/state.ts:129-160` 的 `priceOf` 是唯一定义、`actionCost` 委托给它（我读了源码，不是只看声明）；② `webui/netplay.ts` 只 import 那个"原始量进、钱出"的函数，没有伪造 `GameState`；③ 金额只进文案不进 `legal`（我的 S4b 专门构造了一个买不起跟价的局，按钮仍可点、仍发得出去、代价由服务端 `cannot_afford` 送回来）；④ `nst/10` 带正向对照。**A** |
| Q6=A2 ⑤「不许改 `nst/04`」 | **不成立 —— 是我上一轮的起草错误，本轮我改工单** | ⑤ 与"页面必须复用 `netx/client.ts`"这条 M5 硬性要求物理上不可同时满足（放行清单一旦变化，`nst/04` 的断言文本就必须跟着变）。**裁定：⑤ 作废，`nst/04` 的收窄改写予以追认**，BRIEF §4 M5 ⑤ 已改写成可执行版本。你们不需要为此返工。**A**（基线差集见 §2.6） |
| per-tab 存储必须是 `sessionStorage` | **过** | `nui/07`（含"共享存储会翻车"的反面对照）+ `nui/16`；我在真浏览器里也确认了两个座位各存各的凭据。**A** |

## 2 · 我不只是重跑了你的测试

### 2.1 我自己写的临场抽查：`.audit/rev10/sup-spot-check.ts`（**74 条断言，8 节，两跑逐字节相同**）

无时钟、无 `Math.random`（熵源是我自己的计数器 `counterEntropy(salt)`，确定性），每节都打印实际断言数、没有一节是 0，没有为通过特判的用例，每条结论都配对照组。
`sup-spot-run1.txt` ≡ `sup-spot-run2.txt`，sha256 `34ee443f6823e115681ddb45466f6ecf73aee3f1f7a25155a9b5f924e542e7ac`。**A**

| 节 | 断言 | 钉的是什么 | 结论 |
|---|---|---|---|
| S0 工装自检 | 5 | 我的 rig 自己得先是对的（两家能开一手、份额能核对） | 过 |
| S1 `netplay.ts:303-325` 占位快照 | 9 | 未开局时那一坨"绝不编造数字"的占位，与单机快照的**键集**逐字一致 | 过；值差异被钉到恰好 `['buttons','dealerRule','humanSeat','status']` 四个键（见 §6-3） |
| S2 schema 非法下行的后果 | 17 | 喂一条缺 `why` 的 `error/bad_token`：墙记 violations ✓、页面停手 ✓、**但**凭据被清了、存储里那条也没了、还往上补发了一条全新 join | **不过** ⇒ §4 应修 2 |
| S3 `sessionStorage` 被写坏 | 5 | 存进去一坨垃圾 JSON ⇒ `readSaved` 的 catch 兜住，页面不炸、当作无凭据重新入桌 | 过 |
| S4 价格诚实端到端 | 13 | 行动前页面显示的 `cost` === 行动后台账里那笔的 `amount`（跟/加/比各一次） | 过 |
| S4b 买不起跟价 | 8 | 用一份**schema 合法**的自定义 `Rules`（`bet:{dark:300,seen:600}`）让首圈跟价 300 > 255 筹码 | 过：按钮可点、上行发得出、服务端 `cannot_afford` 原文回到牌桌（这正是 Q6=A2 ③） |
| S5 挪庄 + `nextDealerOf` 穷举引理 | 10 | 庄家那席不交份额 ⇒ 庄挪到还在桌的一家、牌局照常开；并把该引理全枚举一遍 | 过（这也是 D02 等价性的独立佐证，见 §2.5） |
| S6 离桌座位占位 | 7 | `netplay.ts:335-352`：在册但本局不在桌 ⇒ `departed:true`、`chips:0`、状态"本局不参与"、不给牌面 | 过 |

三个诊断探针（都是为了不靠猜）：`sup-probe1.ts`（把 S2 那 12 条失败逐条定位到**我自己**的错因：`info.violations` 不存在而是 `peer.info().violations`、占位场景本来就与单机不同、我伪造的 token 短于 schema 的 16..128、`legal` 检查跑在比牌结算之后、挪庄通知在 `info().notices` 而不在 `snapshot().log`）；`sup-probe2.ts`（`stake.max=16` 把价钱顶到 32，所以常规 preset 下构造不出"买不起"⇒ 才有了 S4b 那份自定义 Rules）；`sup-probe3.ts`（证明 `src/rules.ts:133-137` 经 `validateRules` **可达**：`players.min>max` 与 `stake.initial>max` 各抛一次，对照组 `classic` 不抛）。**A**

### 2.2 我的覆盖 oracle 连坏了三版（rev=9 那版假阴性、OR-merge 那版假阳性、剔除顶层 range 那版又假阴性），第四版才对 —— 详见 §2.9

> **本节原来写的结论已被 §2.9 推翻，原文按纪律保留、逐条标 X，不要拿它当覆盖率依据。**

rev=9 我用的 `.audit/rev9/cov-report.mjs` 在多进程（`test/run.ts` 会 fork/spawn）下是"后写覆盖前写"，不是并集。本轮先改成**按进程 OR-merge**：`.audit/rev10/sup-cov-report2.mjs` → `sup-cov-report2.txt`。这一步修掉了假阴性，**但引入了假阳性**（我在定稿前查出来了）。

原来写的两条后果，现在的状态：

- ~~**rev=9 §5(c) 里"`ws.ts:75-77`、`:94`、`:110-111`、`:203-204` 未覆盖"这四条 ⇒ 撤回（X）。** 修好 oracle 后 `netx/ws.ts` 是 **236/236 = 100.0%**，`netx/room.ts` 是 **638/638 = 100.0%**。~~
  ⇒ **这次撤回本身撤回（X）。** v4 实测 `netx/ws.ts` = **221/236（93.6%）/ 5 段未覆盖**、`netx/room.ts` = **623/638（97.6%）/ 5 段未覆盖**。rev=9 §5(c) 那四条的**行号**是当时那版 oracle 给的、已不可靠（v4 报的是 79-81 / 114-115 / 146-149 / 164-167 / 218-219），但"这个文件有若干条 socket 错误路径没测到"这个**结论方向是对的**，本轮依然成立。你们新增的 `ws/06`（真 socket 上的 ping/pong 与坏帧 1002）确实钉住了一部分，但**没有**把 `ws.ts` 变成 100%。**A**（v4 + 三条地面真值自检）
- **rev=9 的所有覆盖率结论一律降级为 B**（工具当时未交叉验证）⇒ **维持**，并追加一句：本轮 `sup-cov-report2.txt` 的覆盖率结论**同样降级为 X**（工具带假阳性）。rev=10 的覆盖率结论**只以 `sup-cov-final2.txt` 为准**。

原来写的总账 ⇒ **作废**：~~**22 个文件，17 段未覆盖**；`netx/` 八个文件里 `frames/protocol/room/seed/sha256/ws` 六个是 **100.0%**，`client.ts` 98.5%（2 段）、`serve.ts` 98.2%（1 段）。~~
v4 的总账是 **22 个文件 / 53 段未覆盖 / 5548 可执行行覆盖 5363（96.7%）**；`netx/` 八个文件里 **只有 `seed.ts`（112/112）与 `sha256.ts`（113/113）是 100.0%**，`frames.ts` 99.2%、`protocol.ts` 99.4%、`client.ts` 98.1%、`serve.ts` 96.5%、`room.ts` 97.6%、`ws.ts` 93.6%。明细与逐条定性在 §5。**A**

### 2.3 真浏览器 + 真 socket + 真房间进程：验收 ①②④⑥ 我逐条量了

不是读你们的 `evidence/m5-browser-live.txt`，是我自己起房间、自己开页面、自己点：

- **验收①（两个真人两整手）**：我起了真房间进程，页面走真 ws 连上去，两个座位各就位，用**坐标 `MouseEvent('click')`**（不是调内部函数）打完两整手：看牌、加注、比牌、结算面板弹出、第二手庄家轮转。内嵌浏览器视口报 0×0 且 `visibilityState: hidden`，我靠强制 `board.style.width/height` + `body.style.width` + 派发 `resize` 把命中区点亮，之后 `getBoundingClientRect()` 与 `__zjh3.hits()` 都返回真数字。**A**
- **验收②（断线重连、台账守恒）**：中途刷新，`resume` 走通，两侧筹码与底池一颗不差。**A**
- **验收④（伪造下行）**：注入伪造下行 ⇒ 页面当场标"不可信"、按钮换成"已停手"、`seq` 不再前进、别家牌面全程不出现。**A**（第一班这一条的注入手段在原文里没有写到字节层，所以定稿时补一句：**第二班另在真 socket 的真字节流上独立做了一遍，见 §2.10 —— 那条才是本轮最硬的证据**，两班结论同向）
- **验收⑥（按钮金额 === 服务端记的那笔）**：与 S4 的无头结论在真页面上对上。**A**
- **`verifiedHand: 2`**：客户端真的用所有已揭示份额重算出了种子，不是只看服务端说"发牌了"。**A**
- **干净退出 / 端口可配**：`node netx/serve.ts 8799` + 往 stdin 输一行 `quit` ⇒ 打印"已全部关闭，退出。"、`exit=0`（`.audit/rev10/sup-serve-quit.log`）；8798/8801/8802/8803 四个不同端口都起得来。**A**

**我没做到的两件，明说**：`take_screenshot` 在这个工具面上报 `visibilityState=hidden`，所以**我没有截图**；工具面也**没有"开新标签页"的原语**，`window.open` 被拦，所以"同一浏览器两个标签页同时在线"我**没有真验**，只以 `nui/07` 的机制证据为准。这两件既不判你们不合格、也不因此判合格 —— 见 §8.7。**A（做不到的部分同样标 A：这是我实测到的工具面事实）**

### 2.4 我自己写了一个 Node "第二个人"：`.audit/rev10/sup-bot.ts`

为了在**没有第二个浏览器**的情况下量"两个真人"，我写了一个机器人，它**走页面同一个接缝**（`import { createNet, WIRE_SUBPROTOCOL } from 'webui/netplay.ts'`），跨真 socket 连真房间，策略是 look → raise 一次 → call，打印 `BOTSUMMARY {json}`，带 180 s 看门狗。跑通的那次留下了完整台账（`sup-bot-run2.log`）。这条的意义是：**"页面能连上房间"不是我一个人手动点出来的偶然，而是可被脚本重放的**。**A**

（`sup-bot-run1.log`/`run3.log` 是失败记录：exit 1 = 我自己的 180 s 看门狗到点，原因是我起的房间进程被工装硬杀了 —— 见 §6-1，**不是**交付的问题。）

### 2.5 22 条变异表我逐条读了

21 caught、1 survived（D02）、0 SKIPPED、0 还原失败，与 DELIVERY.md:107 一致。存活那条我**不接受"你论证过就算"**：

- **D02（`dealerAmong` 的绕回兜底）接受为等价变异，依据是我自己的更强证据。** 你们给的是构造性论证（`join()` 只分配最小空位 ⇒ `eligible` 恒为 roster 前缀），并且诚实地写了"我按相反假设写过 `room/30`，是构造前提自己失败才发现的（该用例已撤除）"—— 这个自陈我认可，撤除是对的。我这边是把 `nextDealerOf` 那条引理**全枚举**了一遍（S5 的 10 条断言），穷举结果与你们的论证一致：兜底那一支只在"原庄在所有在席者之后"时触发，此时绕回最小与旧写法恒等。**A**（我的穷举）+ **B**（与你们论证交叉一致）
  **定稿补强（第二班的独立穷举，规模更大）**：4 座全宇宙 × 3 种庄家规则共 **22500** 组（其中 2784 组返回 null），`nextDealerOf` 返回 `seated` 之外座位 **0** 组；并构造 `firstDealer=3` 且只有座位 0、1 入座 ⇒ 庄家被挪 3→0 且这一手真发出来了。**对照组**：`startHand` 在 `dealer 3 ∉ seats` 时抛 `TypeError: bad hand config: dealer 3 is not one of the seats`；出厂配置 `firstDealer=0` ⇒ 恒等变换。三路同向（你们的构造性论证 + 第一班 S5 全枚举 + 第二班 22500 组穷举）⇒ **等价性成立，D02 放行**。
  **但你们 10-F 里"与旧写法恒等"这句话口径过宽** —— 恒等只在 `startRoom` 硬编码 `firstDealer: 0` 时成立；换个 `firstDealer` 它就**可观测**（上面那个 3→0 就是）。⇒ **应修 8**（纯文书，一行字）。**A**
- 其余 21 条我核对了每条的"被抓于哪个用例"，没有出现"变异被一条与它无关的用例顺手抓住"这种假阳性。**B**

### 2.6 零回归差集：362 → 393，**ID 一条没丢**

上一轮我留了两个混合格式的中间文件，第一次跑差集时被 `grep ' :: '` 过滤成 6 行、报了个空洞的"丢失 0 新增 0"。这轮改用全名清单重做（`.audit/rev10/sup-base-full.txt` 362 行 / `sup-cur-full.txt` 393 行）：

- **ID 级：丢失 0 条**（`sup-lost-ids.txt` 是空文件），ID 总数 338 → 369。**A**
- **全名级：丢失 2 条、新增 33 条**（净 +31 = 393−362，自洽）。丢的那 2 条是 **标题被重写**、编号仍在：`nst/01`（→"扫描范围覆盖 netx 全部源文件，可移植清单里的文件都真实存在"）与 `nst/04`（→"分层：src/ 与 webmin/ 完全不知道联机存在；webui 里只有 netplay.ts 这一个进口"）。按我 rev=9 §8 的预裁定「**标题变了但编号在 = 放过**」，这两条不算回归。**A**
- 新增 31 个 ID：`nui/01`–`nui/18`、`srv/01`–`srv/05`、`room/27`–`room/29`、`nst/10`、`nst/11`、`client/16`、`proto/13`、`ws/06`。**A**

### 2.7 rev=9 的 7 条应修，逐条核销（不是看你们说做了）

| rev=9 应修 | 状态 | 我核到的凭据 |
|---|---|---|
| 1 · `room.ts` 构造期 TypeError 零覆盖 | **做掉了** | 新增 `room/27`（标题自带"rev=9 应修 1"）；oracle 下 `room.ts` 100%。**A** |
| 2 · "能开局的人不够 ⇒ 本局作废"零覆盖 | **做掉了** | 新增 `room/28`；我 S5 也独立复现了同一组行为。**A** |
| 3 · `protocol.ts:463-464` + `ws.ts` pong 零覆盖 | **做掉了** | 新增 `proto/13` 与 `ws/06`（真 socket 上 ping→同载荷 pong、坏帧→1002）。**A** |
| 4 · `handshakeAccept` 口径写进注释 | **做掉了** | `netx/frames.ts:131` 与 `:135-136`，连"若将来前置代理会重写头就收紧到严格 24 字符 base64"这条待办都写了。**A** |
| 5 · `room.ts:280-282` 注释改准 | **做掉了** | 注释现在写的是"回调体够不到（`h.phase !== 'collect'` 守卫会 return），但重武装这个动作本身可观测"，与我 Z5 的实测口径一致。**A** |
| 6 · TEST-OUTPUT 里两个哈希都写上 | **做掉了** | TEST-OUTPUT.md:27-30 四条，与我实测逐字相同。**A** |
| 7 · nit：`room.ts:283` 默认 sort | **未做（本来就说"可以不改"）** | 现在 `h.expected` 在 `:256` 用默认 `.sort()`、在 `:302` 用 `.sort(byCodepoint)`；两把尺对 ASCII party 名等价（`byCodepoint` 也是按 UTF-16 码元比），**无可观测分歧**。仍留在 §4 应修 6 的 nit 里。**A** |

### 2.8 流程自陈：`.audit/rev10/` 里有另一个写入者

我在本轮复审期间发现 `.audit/rev10/` 里出现了不是我（也不是我派的 subagent）写的文件：21:22 它删掉了我建的 `cov/`、截断了 `cov-test.txt`、重新拷了一份 `cov-report.mjs`；21:33 落了 `rep-webmin-{stdout,stderr}.log` + `rep-webmin.pid`；21:58–22:05 落了 `br-room-8790.log`、`br-bot.log`，以及无前缀的 `npm3/4.txt`、`case-names.txt`、`baseline-ids.txt`、`current-ids.txt`、`spot-check.ts`、`spot1..6.txt`、`cov-report.txt`、`cov/`。

处理方式：**我没删它任何一个文件**，改为把我自己的产物一律加 `sup-` 前缀重做一遍，本裁定引用的**全部**是 `sup-*`。我已核对 `BRIEF.md` 与 `REVIEW.md` 在本裁定写入之前未被改动。**风险提示（C 级）**：这个写入者有可能覆盖 `REVIEW.md`/`BRIEF.md`；若你们看到本文件的 rev=10 段落消失或口径变了，那不是我的裁定。**A**（文件时间戳与内容差异是我实测的）

> **定稿补记（第二班）**：这条风险提示**应验了**，但方向相反 —— 不是"覆盖"，是**两份 rev=10 裁定并存**。第二班在 22:25 往同一个文件里插了自己那份 rev=10 裁定，插的位置正好把第一班这份挤到了"历史附录"标题下面，于是文件里一度同时有两个互相冲突的 rev=10 结论（必修 2 项 vs 必修 1 项）。第二班那个"另一个写入者"就是第一班，两边都在按纪律办事、都没删对方文件，只是谁也不知道对方在写同一份。**现已合并：本文件顶部这一份是唯一权威裁定**，第二班那份降级为**附 A**并逐条标注了被取代的部分。合并过程中第二班的独有结论全部并入，两班的 `.audit/rev10/` 产物一个没删。**给实现方的一句话**：你们只需要照顶部这一份返修；附 A 不用读，它是给我们自己留的过程账。**A**

### 2.9 覆盖 oracle 第四版：连坏三版之后，这一版带**地面真值自检**（`.audit/rev10/sup-cov-final2.mjs` → `sup-cov-final2.txt`）

覆盖率是我判"存活变异是否等价""未覆盖分支是否可达"的唯一客观依据，所以工具本身必须先被证明是对的。这一轮我在它上面栽了两次，两次都有实据：

**第一版的病（rev=9 那版，`cov-report.mjs`）：假阴性。** 跨进程往同一张字符表上 fill，后一个进程的 `count=0` 会把前一个进程的 `count=1` 抹掉。`test/run.ts` 不止一个进程 —— 实测每次跑产生 **3 个** coverage JSON（`srv/03`、`srv/04` 各 spawn 一个真子进程，子进程继承 `NODE_V8_COVERAGE`）。**A**

**第二版的病（`sup-cov-report2.mjs`）：假阳性。** 它改成按进程 OR-merge（这一步是对的），但**跳过 `isBlockCoverage=false` 的条目**，于是每个文件只剩 V8 那条**顶层合成 range** 在说话。实测证据（`.audit/rev10/sup-ws-dump.txt`）：`coverage-23480` 里 `netx/ws.ts` 的条目是

```
fn name=""            isBlockCoverage=true   ranges=1  → [0..8650) len=8650 count=1   ← 顶层合成条目，语义只是"模块被求值过 1 次"
fn name="headerList"  isBlockCoverage=false  ranges=1  → [1636..1865) count=0
fn name="createWsRoom" isBlockCoverage=false ranges=1  → [1874..8547) count=0          ← 那个进程从没调用过它
```

`[0..8650)` 超过了 `.ts` 的实际长度 8603（差 47，是 V8 的脚本级 padding），它把整个文件 8603 个字符全刷成"已覆盖"；两个 `isBlockCoverage=false / count=0` 的条目因为被跳过，一点也没能把它捅回来。那个进程就是 **`srv/04` 的坏端口子进程** —— `portFromArgv()` 返回 NaN、打完 `bad port` 就以 2 退出，从没走到 `startRoom`，所以 `createWsRoom` 一次都没进去。**OR-merge 之后 `netx/ws.ts` 就成了 236/236 = 100.0%。这是纯粹的假阳性。** **A**

**第三版（我自己的，`sup-cov-final.mjs`）：假阴性。** 我把顶层合成 range 整条剔除，结果**真的跑过的顶层直线代码**被判成未覆盖 —— `netx/serve.ts:75-86`（`invokedDirectly` 那个主模块块，含印 URL 的第 83 行）在 `srv/03` 的子进程里明明执行过，却报未覆盖，文件覆盖率掉到 62.7%。**A**

**第四版（这一版，`sup-cov-final2.mjs`）规则**：① **不跳过** `isBlockCoverage=false` 的条目 —— V8 对"从未被调用的函数"就发这种条目，它的唯一 range 覆盖整个函数体且 `count=0`，语义是"这个函数体一次都没进去"，正是把顶层合成 range 捅回来所需要的那个洞；② 顶层合成 range **保留**，它只给顶层直线代码兜底；③ 同一进程内**按出现顺序** fill（V8 先发外层：顶层 → `createWsRoom` → 内层匿名函数，后发的更内层覆盖先发的 —— 这个顺序假设我用 `sup-ws-dump.txt` 逐条核对过）；④ 进程之间 OR。**A**

**偏移对齐单独验过**（`sup-align.mjs` → `sup-align.txt`）：Node 的类型擦除以空格补位，`stripTypeScriptTypes` 前后长度都是 **8603**，探针 slice 精确落在 `function createWsRoom` / `listen(port` / `(req: IncomingMessage, res: ServerResponse) => {` 上，offset 1874 → 第 44 行在 strip 前后同为第 44 行 ⇒ **V8 的 offset 可以直接映射到磁盘 `.ts` 的行号**。这一步不做，上面三版的争论全是空的。**A**

**oracle 自检：三条我已独立知道答案的地面真值**（写在脚本里自动打印，不是事后挑的）：

| | 断言 | 依据（与覆盖率无关的独立证据） | 实得 | |
|---|---|---|---|---|
| A | `netx/ws.ts:146-149` 应**全未覆盖** | `grep -rn "%zz\|URI malformed\|decodeURIComponent\|malformed" test/*.ts` **零命中**；没有任何用例断言 `room handler failed` 或 500；`srv/01` 的请求清单（`/health`、`/webui/index.html`、`/webui/main.ts`、`/package.json` 403、`/` 302、`/netx/client.ts` 200、`/netx/{room,ws,serve,frames}.ts` 403）里没有一条能让 `serveStatic` 抛 | `2222` | **过** |
| B | `netx/serve.ts:75-86` 应**已覆盖** | `test/netx-serve.test.ts:195` 真 spawn，`:252` 写 `quit\n`，`:254` 断言退出码 0 ⇒ 子进程走完主模块块并干净退出，覆盖会刷盘 | `1111111` | **过** |
| C | `webmin/serve.ts:117-121` 应**未覆盖** | 没有任何用例 spawn `webmin/serve.ts`（`grep -rn "webmin/serve" test/*.ts` 只有 import，没有 spawn） | `12222` | **过** |

三条全过 ⇒ 这一版可用。**rev=10 的覆盖率结论一律以 `sup-cov-final2.txt` 为准，前三版留档不作数。** **A**

**v4 总账**：22 文件 / 5548 可执行行 / 5363 已覆盖（96.7%）/ **53 段未覆盖**。100.0% 的只有 `netx/seed.ts`(112)、`netx/sha256.ts`(113)、`src/cards.ts`(135)、`src/engine/project.ts`(62)、`webui/bridge.ts`(153) 五个。**`netx/room.ts` 是 623/638（97.6%）、5 段未覆盖，不是 100%** —— 而且那 5 段里有 4 段是房间**自检失败**的分支（`:171-174` `egress blocked`／`:333-335` 与 `:337-339` `reveal self-check failed`／`:360-362` `authoritative engine rejected its own action`），这一点我在 §5 里单独定性。**因此第一班那句「服务端权威面这一轮我没有任何覆盖面上的保留意见」予以撤回（X）。** **A**

### 2.10 第二班独有：真 socket 上的**中间人注入** —— 本轮最硬的一条证据（`.audit/rev10/br-mitm.ts`、`br-mitm.log`、`br-acceptance.txt` C 组）

第一班验"伪造下行"用的是页面自己的 `__zjh3.feed(...)` 入口（那是交付方留的复审钩子，走的是同一道墙，成立）；第二班不满足于这个，另写了一个 **TCP 透传代理**，在**真实 socket 的真实字节流**上改数据：

- 拓扑：房间 `node netx/serve.ts 8790`；代理 `8791 → 8790`；页面只把 `#netUrl` 输入框的值改成 `ws://127.0.0.1:8791` —— **交付代码一个字没动**。
- 握手段**逐字节透传**（日志实测 `GET / HTTP/1.1` ↔ `HTTP/1.1 101 Switching Protocols`），所以 `Sec-WebSocket-Accept` 是真的、子协议是真的。
- 服务端→客户端方向用**交付自己的** `netx/frames.ts` 的 `FrameReader({masked:false})` 解帧、再 `encodeText`/`encodePing`/`encodePong`/`encodeClose` 重编 ⇒ **注入点严格落在帧边界上**，不是往字节流中间硬塞。
- 客户端→服务端方向逐字节透传，**保留掩码**（否则房间会按协议错误断链，那就量不到我想量的东西了）。
- 注入内容：改掉下一条真实 `reveal` 里 `shares[0].value` 的**第一个十六进制字符**（`a5cbdf…` → `f5cbdf…`）。这条报文 **schema 完全合法**、长度合法、字符集合法 —— 唯一的问题是**承诺开不出来**。这正是第二道墙存在的理由：schema 校验拦不住它。

**真页面的反应（全部是 DOM 实测原文，不是读日志推的）**：`untrusted:true`；`#hint` 文本「⚠ 这一局不可信：reveal check failed: server revealed a share that does not open its commitment ⏎ 已停手：本页面不再向服务端发出任何行动」；**五个动作按钮全部消失**，只剩一个 `已停手：这一局不可信 / legal=false / cost=null`；`verifiedHand` 从数字退回 **`null`**；结算面板第 4 行由「揭示核对 通过」变成「揭示核对 **未通过**」。随后连点 look/call/fold 三次**全部被拒**，拒绝理由原文「没发出去：peer flagged the server: reveal check failed…」。**别家牌面全程没有出现过。**

**对照组**：同一页面、同一房间、同一条代理路径，**未注入**的 hand 1 与 hand 6 上 `untrusted=false`、`errors=[]`、`trustLines=[]`、`verifiedHand=1`/`6`、面板写「揭示核对 通过」、5 个按钮 `legal=true` ⇒ 报警确实由**那一个字符**触发，不是"见东西就报"。另外注入只影响被代理的那一条连接（bot 直连 8790，拿到的是未改动的 reveal）⇒ 这是"**服务端对某一家单独撒谎**"的场景，正是 commit-reveal 要防的那个，不是全局故障。

**这条为什么重要**：它把"第二道墙是活的"从**夹具层**提到了**真字节层**。工单 §4 M5 要的是"页面不信任服务端"，而只有真 socket 上的注入才能排除"墙只在测试夹具里生效"这种可能。**A**

### 2.11 第二班独有：另一份临场抽查（103 条断言）与**我自己那七个夹具坑**的自陈

第二班独立写了 `.audit/rev10/spot-check.ts`（50KB，与第一班的 `sup-spot-check.ts` **无共享代码**），自带假时钟、自带 `node:net` 裸 socket、自建引擎驱动器，不复用 `test/netx-fixtures.ts`。**103 条断言、0 失败、`SPOT=ALL_PASS`**，`spot5.txt` ≡ `spot6.txt`，sha256 `32ea2929149b98cd06eb90ffae2fd101d2ba57cd4d0159f968bab22dd08e349c`。（更早一版 86 条断言全绿的 `spot3.txt` ≡ `spot4.txt` = `8da0604a…` 也留着，那是 S9 之前的状态。）**A**

**两份工装的重叠面**（独立同向 ⇒ 这些结论按 A 记）：`view===null` 时的占位快照、按钮 `cost` === 台账 `amount`、离桌座位占位格、庄家挪位、买不起仍可点、**以及"schema 非法的下行仍触发不可逆动作"这一条缺陷**（第一班 S2 的 17 条断言 / 第二班 S9 的 17 条断言，两边各自独立撞到同一个问题 ⇒ 应修 2 的置信度是本轮最高的）。

**第二班自陈：踩了七个夹具坑，每一个都一度被我误当成"交付缺陷"**（记在这里是为了兑现通用纪律「别过早点名元凶」，也是为了下一轮别重犯）：① S1 的策略在任何人都能加注之前就比牌 ⇒ raise 永远观测不到，改成"按全局步数走"；② S3 拿 `links[0]` 当行动方，可它根本不在回合上 ⇒ 按钮行只剩"等 X 行动"，改成取 `room.info().turn`；③ S3 伪造漏牌时用 `room.peek(foe)`，可 foe 自己的牌还是 `'unknown'` ⇒ 我什么也没"漏"（0 处），改成合成三张真牌面并**先断言原格是 `unknown`**；④ S3 伪造揭示时写 `value:'bogus'`，那撞的是 **schema** 那道闸而不是揭示核对（一次**假通过**），改成合法十六进制 + `party:'seat:N'` 并断言违规文本含 `reveal check failed`；⑤ 我自己一条弱断言 `buttons.length===1 && legal===false && cost===null` 在"等待按钮"上也成立 ⇒ 收紧成还必须 `.includes('已停手')`；⑥ S6 用 `sum(info.chips) + info.pot` 在手中间量守恒，把 ante 数了两遍（1539 vs 1536+3）且跨 5 手漂移 ⇒ 改成只在 settled 边界量 `sum(info.chips)`，并把 `handGapMs` 拉到 600000 钉住一手；⑦ S4 的对照组犯同一个错 ⇒ 改成真正的不变量"页面 total === 房间台账 total"。**七条全是我写错，没有一条是交付的错。** **A**

**第二班对 D02 的独立穷举（比第一班 S5 那 10 条更强）**：4 座全宇宙 × 3 种庄家规则穷举 **22500** 组（其中 2784 组返回 null），`nextDealerOf` 返回 `seated` 之外座位 **0** 组；并构造 `firstDealer=3` 且只有座位 0、1 入座 ⇒ 庄家被挪 3→0 且这一手真发出来了。**对照组**：`startHand` 在 `dealer 3 ∉ seats` 时抛 `TypeError: bad hand config: dealer 3 is not one of the seats`；出厂配置 `firstDealer=0` ⇒ 恒等变换。**⇒ D02 的等价性成立**（与第一班 S5 的全枚举、与你们的构造性论证三路同向），**但你们的论证口径过宽**，见应修 8。**A**

## 3 · 必修（阻塞 rev=11 PASS，共 2 项）

### 必修 1 · 房间进程印出来的页面 URL 落在 M1.5 单机页 ⇒ 照着你们自己的复现步骤走，玩不到联机（A 级）

**事实链（每一环我都实测过）：**

1. `node netx/serve.ts 8801` 打印：`页面 http://127.0.0.1:8801/`（源码在 `netx/serve.ts:83-84`）。
2. `curl -sL http://127.0.0.1:8801/` ⇒ **200，最终 URL 是 `/webmin/index.html`**，该文件里 `netUrl|netplay|入桌` 出现 **0** 次（全文 77 行，是 M1.5 那个最小单机页）。
3. `curl -sL http://127.0.0.1:8801/webui/` ⇒ 200，落在 `/webui/index.html`，同样三个关键词出现 **2** 次（`webui/index.html:34` 的「模式」下拉、`:43` 的「房间」输入框）。
4. `webmin/serve.ts:42` 就是那条映射：`if (raw === '/' || raw === '/index.html' || raw === '/webmin' || raw === '/webmin/') return '/webmin/index.html';`
5. `DELIVERY.md:123-127` 的复现步骤写的是「打开 `http://127.0.0.1:8790/` 两个标签页，模式各选"联机"、名字各填一个、点"连接"」—— **那个页面上没有"模式"这个控件**。
6. 你们自己的浏览器证据 `evidence/m5-browser-live.txt` 里用的是 `http://127.0.0.1:8790/webui/index.html`。⇒ 你们知道真页面在哪，只是**进程输出和交付文档没跟上**。

**为什么算必修而不是应修**：工单 §4 M5 的验收口径是"一条命令起、打开就能玩"。工具自己印出来的那一行是用户唯一的指引，它指向一个零联机控件的页面；而我据以验收的复现步骤因此不可执行。这不是文案瑕疵，是入口交付面的一处断裂。

**修法（请照这个改，别改多）**：

- 改 `netx/serve.ts:83` 印成 `页面 http://127.0.0.1:${port}/webui/`（`RunningRoom.httpUrl` 同步），并把 DELIVERY 的复现行改成 `/webui/`。
- **不许**改 `webmin/serve.ts:42` 把 `/` 指到 `webui/`：那条注释（`:41`）的理由仍然成立 —— rev=3–5 的复跑命令与验收证据都以 `/`→M1.5 为入口，换掉会打断证据链，也会让 `nst/*` 与既有 362 条里凡是依赖它的断言漂移。
- 加一条用例钉住：从房间进程打印的那一行里把 URL 抠出来，`GET` 它，断言响应体里含得到联机控件的 id（正向），并断言 `GET /` 得到的**不是**同一个页面（对照）。`srv/01` 现在钉的是"/health 与 webui 页面同源同端口"，这条要钉的是"**印出来的那个 URL** 就是 webui 页面"。

### 必修 2 · 一条 `GET /%` 把独立的 `node webmin/serve.ts` 整个打死（A 级，与你们本轮自己修掉的缺陷④同一类）

**实测（`.audit/rev10/sup-f2-webmin.log`）：**

```
$ node webmin/serve.ts 8802
炸金花 M1.5 → http://127.0.0.1:8802/  (根目录 F:\qoder\zjh，Ctrl+C 停)
$ curl --path-as-is 'http://127.0.0.1:8802/%'      # code=000，连不上
$ curl http://127.0.0.1:8802/webmin/index.html     # code=000 ★ 进程已死，端口不再应答
```

stderr 里是完整的未捕获栈：

```
URIError: URI malformed
    at decodeURIComponent (<anonymous>)
    at redirectTarget (file:///F:/qoder/zjh/webmin/serve.ts:40:15)
    at serveStatic (file:///F:/qoder/zjh/webmin/serve.ts:77:14)
    at Server.<anonymous> (file:///F:/qoder/zjh/webmin/serve.ts:107:8)
```

**对照组（同一时刻、同一条畸形请求，打房间进程 `netx/serve.ts:8803`）：**

```
room handler failed: URI malformed      <- code=500
事后 /health code=200                    ★ 房间活着
```

差别只有一处：`netx/ws.ts:143-149` 把 `onHttpRequest` 包在 `try/catch` 里（500 兜底），而 `webmin/serve.ts:106-108` 是裸的 `void serveStatic(req, res)` —— `serveStatic` 在第一个 `await` **之前**就同步抛（`:77` → `redirectTarget` → `:40` 的 `decodeURIComponent`），于是变成一个没人接的 rejected promise，Node 24 默认把它当未捕获异常抛，进程终止。`:89-102` 那个 `try/catch` 只包住了 `readAsset`，包不到 `:77` 和 `:83` 这两次 `decodeURIComponent`。

**为什么算必修**：这就是 DELIVERY.md:109-113 里你们自己列为缺陷④并修掉的那一类（"进程被未捕获异常打死"），只是发生在另一条入口上。你们在房间侧修对了（`ws.ts` 那层 catch + `room/29` + 变异 D01/D02），说明口径是清楚的；`webmin/serve.ts` 的独立入口漏了。触发条件是**任何客户端发一条畸形百分号转义**，不需要认证、不需要状态，成本为零。

**第二班补的四条加重理由**（两班独立发现同一个缺陷，定级理由合并如下）：

1. **触发面是外部的、未鉴权的、一条请求，而且能从任意网页发起。** `webmin/serve.ts` 虽然只绑 127.0.0.1，但用户浏览的**任何**网页里放一个 `<img src="http://127.0.0.1:8199/%zz">` 就能把它打死 —— 浏览器发跨源 GET 不需要 CORS 预检，图片加载失败也不报错。这不是"磁盘异常时才到达"的分支。**A**（机制）+ **C**（攻击面推断）
2. **它是交付文档主动推荐的运行方式。** `SELF-REVIEW.md:328`、`:405` 两处写着 `node webmin/serve.ts 8133 # 零依赖通道：http://127.0.0.1:8133/webui/index.html`，`:559` 还把它算作 M3.2 的"推荐路径，未降级"。也就是说：交付面里有一个"照文档跑起来就会被一条 URL 打死"的进程。**A**
3. **与我 rev=9 §8.10 立的口径一致。** 那一轮我把"进程死掉且没有栈可查"从覆盖缺口升成必修级。这条比它更糟 —— 死因是**外部可控**的。同一条尺子必须量同一个方向，否则下一轮没人信我的定级。**C**
4. **M5 扩大了它的暴露面，而房间侧那层救命的 catch 自己没有用例。** `netx/serve.ts:51` 把 `serveStatic` 接成了房间的 `onHttpRequest`，于是同一条畸形 URL 现在也会打进 M5 的房间进程。房间活了下来，但那是**别人的 catch 救的**，不是这个函数自己正确 —— 而且 oracle v4 实测 `netx/ws.ts:146-149`（那个 catch 的响应体）**零覆盖**（§2.9 自检 A 条）：你们本轮补的 `ws/06` 打的是 ping/pong 与坏帧 1002，**不是这一条**。顺带一个口径问题：客户端发的畸形 URL 应当是 **4xx**，房间现在回 **500** 会让运维以为房间自己坏了 —— 防御放错了层。**必修 2 做完之后这条会自然回到它该有的角色（只兜真正意外的服务端错误），500 这个错状态码同时消失。** **A**

**修法**：把 `serveStatic` 的整个函数体（含两次 `decodeURIComponent`）纳入 `try/catch`，畸形 URL 回 **400**（不是 500：这是请求的错，不是服务端的错）；`:107` 那行也补上 `.catch()` 兜底，别让"将来又有人在 await 之前抛"再次变成进程级故障。加一条用例：`assert.doesNotThrow`/直调 `serveStatic` 断言返回 400 且进程存活；能真 spawn 更好（`srv/03`/`srv/04` 已经有真 spawn 的工装可以复用），断言"打完畸形请求后 `/health` 或任意合法路径仍然 200"。

**第二班给的具体形状**（与已有的拒绝面同形，测试也就同形好写）：`resolveStatic` 的 `decodeURIComponent` 包 try/catch，失败返回 `{ ok:false, status:400, why:'malformed percent-escape' }` —— 和已有的 `NUL in path` / `backslash in path` / `outside project root` 同一档；`redirectTarget` 同样 try/catch，失败返回 `null`（它只是个"要不要 302"的判定，失败就是不重定向，随后交给 `resolveStatic` 去回 400）。**对照组已经有了**：`%00` 现在走的是 400 而不是抛（我实测过），所以这条改动是让 `%zz` 与 `%00` 行为一致，不是新发明一档。

**两班的复现命令都留档**：第一班 `.audit/rev10/sup-f2-webmin.log`（端口 8802，`/%`）；第二班 `.audit/rev10/br-webmin-{out,err}.log`（端口 8199，`/%zz`，四发 curl 带 `%00` 对照组与"进程确实不在了"的 `curl exit=7`），21:33 那次是 `rep-webmin-*`，**三次独立复现，结果一致**。**A**

## 4 · 应修（不阻塞 rev=11 PASS，但请一并做掉）

1. **`SELF-REVIEW.md:15` 的 ⑤「`nst/04` 一字未改」是假的，且与 `DELIVERY.md:89` 自相矛盾（A 级）。** DELIVERY.md:89 自己写的是「改 `nst/01/04/09`，新增 `nst/10/11`」；我的基线差集（§2.6）也证明 `nst/04` 的标题被重写。**裁定：改动本身我追认**（BRIEF ⑤ 是我上一轮的起草错误，见 §1 与 §6-9），**但自评表不许与交付说明互相矛盾** —— 我核销应修靠的就是这两份文件互相对账，一处说改一处说没改，我这边的核对成本会变成"逐字重跑"。请把 ⑤ 那格改成事实（"`nst/04` 按 M5 放行清单收窄改写，BRIEF §4 M5 ⑤ 已由监督方作废并追认"）。**A**
2. **`webui/netplay.ts:211-219`：一条**没通过 schema 校验**的下行，也能触发"清凭据 + 自动重入桌"这个不可逆动作（A 级，S2 的 17 条断言 + 两组对照）。** `onText` 在 `:211` 自己 `JSON.parse` 了一遍原文，先于 `:227` 的 `peer.inbound(text)`（那道墙）执行；只要裸 JSON 里 `t==='error'` 且 `code` 长得像 `bad_token`/`token_seat_mismatch`，就 `:218` 置闩、`:219` `store.del(...)`，然后 `:236` 补发一条全新 `hello`。**对照组 1**：合法的 `bad_token`（带 `why`）同样清凭据，但墙把它记进 `errors` 而不是 `violations` ⇒ **正确的判据本来就有现成出口**。**对照组 2**：另一条 schema 非法但不是 `error` 的下行（缺 `text` 的 `notice`）不清凭据 ⇒ 确认触发条件就是"裸 JSON 里嗅探 code"，与墙的判断无关。这一层的主题正是"不信任服务端"，而这条路径让一个敌意或坏掉的服务端可以用**一条非法报文**就把玩家的凭据抹掉并强制重入桌。**修法**：把 `:216-219` 的判据从"我自己 parse 的裸 JSON"换成 `peer.info().errors`（只有**通过校验**的下行才会落在那儿，对照组 1 已证明这条路走得通）；`leak_blocked`/`replaced` 那两条（`:213-215`）同理。**一次性闩锁（`:236`）保留**，那个设计我认可。**A**
3. **`SELF-REVIEW.md` 10-F「已知未覆盖」表与我的 oracle 对不上 ⇒ 披露不完整（A 级）。** 我 rev=9 §8.6 就预裁定过"表要能对上 oracle 的输出"。用 **oracle v4**（§2.9，`sup-cov-final2.txt`）逐行核对，10-F 那 7 行**漏了**：`webui/netplay.ts` 的 **9** 段（`126-127`、`206`、`224-225`、`259`、`303-325`、`335-352`、`394-410`、`432-433`、`482`，该文件 **86.9%**）、`src/rules.ts:133-137`（我用 `sup-probe3.ts` 证明**可达**）、`netx/serve.ts:98-99` 与 `:118-119`、`webmin/serve.ts:98-102`+`:107`+`:118-121`、`webui/paint.ts`（81.0%）、`webui/scene.ts`（98.7%）、`netx/ws.ts` 的 5 段、`netx/room.ts` 的 5 段、`webmin/model.ts` 的 6 段、`src/engine/{actions,settle,state,validate}.ts` 与 `src/ai/honest.ts` 的零碎几段。**v4 的总账是 22 文件 / 53 段，10-F 只列了 7 行** —— 请把 10-F 按 `sup-cov-final2.txt` 重列一遍，一行一段，别归类合并。
   **另有一处第一班写错、我现在改判（X）**：第一班说「10-F 说 `webmin/serve.ts::serveStatic` 的 500 分支未覆盖，实测**已被覆盖**，是反向陈旧」—— **这条撤回**。oracle v4 实测 `webmin/serve.ts:98-102`（就是那个 `ENOENT/EISDIR ? 404 : 500` 的 catch）**仍然未覆盖**，`:107`（`void serveStatic(req, res)`）也未覆盖。**你们 10-F 那一行是对的，第一班的指责是错的**，错因就是 §2.9 里那个假阳性。少报比多报好，但这次你们根本没少报。**A**
4. **`lastReject` 永不清零 ⇒ 提示行会跨手说谎（A 级，我在第 2、3 手实测到）。** `netx/client.ts:275` 置值，全文件只有 `:156`（`renew()` 里）清它；新手开局、后续行动被接受，都不清。而 `webui/main.ts:229-236` 的 `hintText()` 优先级是 `trustLines → linkNote → lastReject → storeDegraded → snap.status`，于是第 1 手那条 `compare_forbidden_before_first_actions`/`stake_at_max` 会一直占着提示行到本世结束，哪怕服务端早就接受了后面的行动。**这不是"多显示一条历史"，是提示行在陈述一个已经过期的当前事实** —— 与本项目"不骗玩家"的主题相冲。**修法**（挑一个，别两个都做）：在 `act()` 产出非 null 上行时清 `lastReject`；或在 `state`/`view` 下行推进 `seq` 时清。**A**
5. **服务端 `notice` 到不了页面 ⇒ 玩家看得见结果、看不见原因（A 级）。** `room.ts` 用 `note(...)` 发出的那几条正是"可观测状态突变"的解释：`:286`「某某 没在 15000ms 内提交份额，这一局不带它」、`:290`「能开局的人不够（N < min），房间继续等待」、`:296`「庄家座位 X 没交份额，本局庄家挪到座位 Y」、`:471`「某某 坐到 N 号位」。但 `netplay.ts:453` 的 `log` 只并了 `[...trust, ...引擎 log]`，**没有** `notices`；`main.ts` 也从不读 `info().notices`（我只在 `netplay.ts:92`/`:275` 找到它，即"暴露了但没人用"）。我在 S5 里就是因为在 `snapshot().log` 里找不到那条挪庄通知、才追到它只在 `info().notices`。**你们自己在 `netplay.ts:452` 写的注释就是这条口径**：「"停手 + 为什么停手"不许只活在测试里」—— 同一句话适用于挪庄与作废。**修法**：`log` 里并入 `p.notices`（去重、保持 `nui/01` 的键集不变，只是数组内容变长）。**A**
6. **小 nit（可以不改，但我记下来）**：
   - `netx/room.ts:508`：``note(`${names.get(seat) ?? String(seat)} 号位重连（…）`)`` —— 有名字时印出来是「甲 号位重连」，**座位号丢了**；没名字时才印号。建议 `${seat} 号位（${name}）重连`。**A**
   - `h.expected` 用了两把尺：`room.ts:256` 默认 `.sort()`、`:302` `.sort(byCodepoint)`；另 `:156`/`:161`/`:223` 也是默认 `.sort()`。`byCodepoint`（`seed.ts:73-75`）其实也是按 UTF-16 码元比，与默认键**等价**，所以**无可观测分歧**（我验过），只是名字是个 misnomer + 同一份数据两把尺。要么全仓一把尺，要么把 `byCodepoint` 改名成它真正在做的事。**A**（等价性）+ **C**（要不要改）
   - `webui/netplay.ts:140`：`let link: Link = saved !== null ? 'idle' : 'idle';` —— 死条件，两支相同。**A**
   - `webui/netplay.ts:443` 把 `status` 与 `handIndex` 挤在一行，与周围的一行一键风格不一致。**C**
7. **「桌上总额」少算了离桌座位的筹码，而房间侧的账本从不销账 ⇒ 标签与口径不匹配（A 级，第二班独有发现）。** `webui/netplay.ts:462` 是 `total: cells.reduce((a, c) => a + (c.departed ? 0 : c.chips), 0) + view.pot`，`ledgerLine` 同样 `!c.departed` 过滤；`webui/scene.ts:379` 把它渲染成 `` `桌上总额 ${String(snap.total)} · ${snap.ledgerLine}` ``。但房间侧：`netx/room.ts:463` `chips.set(free, up.buyIn)` 入桌即记账，`:344` `closeLedger` 只按**本手在座者**回写，全文 `grep chips.delete` **零命中** ⇒ **离桌那家的筹码房间仍然欠着**（它拿 token 回来就能续上），页面的「桌上总额」却不含它。
   **实测**：真浏览器上 hand 13 时页面 `total=456`（=193+263），而 seat 1、seat 2 都还留着筹码；我的 S4 rig 量到同一形状（房间台账 **1536** vs 页面 **1024**，差额 **512** 恰好是那个离桌座位的筹码）。
   **为什么算应修不算必修**：数字本身没有算错，页面也没有编造 —— 它只是**用了一个比实际范围更宽的标签**。但「桌上总额」在这个项目里是玩家判断"这局值不值得跟"的依据，而它与断线重连后看到的台账对不上（重连那一家会带着自己那份回来，总额突然变大），这与本项目"不骗玩家"的主题相冲，也和应修 4 是同一类问题（**显示的行在陈述一个与自己口径不符的事实**）。
   **修法（挑一个）**：① 把标签改成能自证范围的说法（例如「在场筹码」），一行文案；② 把离桌格子计入 `total` 并在 `ledgerLine` 里单列「另有 N 家离桌共 X」。选 ① 的话请加一条无头用例钉住"标签文案与 `departed` 过滤口径一致"；选 ② 的话请钉住"`total` === 房间台账 `sum(chips) + pot`"这个更强的不变量（我 S4 的对照组现在就能直接复用）。**A**（页面侧与 rig 侧）+ **B**（房间侧余额由源码 grep + rig 推得）
8. **D02 的等价性论证口径过宽（C 级要求，A 级依据；第二班独有）。** `SELF-REVIEW.md` 10-F 写的是"与旧写法恒等"。**等价性我接受**（三路同向：你们的构造性论证 + 第一班 S5 的全枚举 10 条 + 第二班 S2 的 22500 组穷举，见 §2.11），但请把**配置前提**写进去：恒等只在 `startRoom` 硬编码 `firstDealer: 0`（`netx/serve.ts:45`）时成立。`createRoom({seats:6, firstDealer:3})` 且只有座位 0、1 入座时，`dealerAmong` 的绕回兜底是**可观测**的 —— 第二班实测庄家 3→0 且这一手照发；**对照组**：没有它 `startHand` 抛 `bad hand config: dealer 3 is not one of the seats`。把这句前提写进 10-F，下一轮的复审者才不需要自己再穷举一遍 22500 组。**A**（实测）+ **C**（要求本身是文书性的）
9. **`netx/ws.ts:146-149`（`room handler failed` 500 兜底）零覆盖，而它在真 socket 上一条请求就能走到（A 级；rev=9 §5(c) 我点过，本轮补的 `ws/06` 打的不是它）。** oracle v4 报 count=0（§2.9 自检 A 条），我两班都实测过它可达且行为正确（房间回 500、随后 `/health` 200、进程活着）。**做法**：在已有的真 socket 工装（`ws/03` 那一套）上把 `onHttpRequest` 换成 `() => { throw new Error('x') }`，断言 500 应答与"连接不残留"。**必修 2 做完之后这条反而更好写** —— 那时 `serveStatic` 自己不再抛，要走到这个 catch 就必须**故意**制造异常，用例的意图也就写得清楚（它兜的是"将来有人往 `onHttpRequest` 里塞了会抛的东西"，不是畸形 URL）。**注意别把这条与必修 2 混为一谈**：必修 2 修的是 `webmin/serve.ts`（回 400），这条补的是 `netx/ws.ts` 那层 catch 的用例（回 500）；两层都要在，各管各的。**A**

## 5 · 覆盖缺口（不阻塞；oracle = **`.audit/rev10/sup-cov-final2.txt`（v4）**，22 文件 / 53 段 / 5548 可执行行覆盖 5363 = 96.7%）

> 本节原以 `sup-cov-report2.txt` 为据（22 文件 / 17 段），那份带**假阳性**，整节按 v4 重写；旧版留档不作数（§2.9）。

- **(a) 已披露、且我认可"按构造恒真"（自检对象是自己刚算出来的值 ⇒ 恒真；或类型层 `exhausted: never`）**：`netx/client.ts:116-117`（合并条数自检）、`netx/client.ts:292-294`、`netx/protocol.ts:213-215`、`netx/room.ts:609-610`、`src/rules.ts:125-127`、`src/engine/actions.ts:158-160`、`src/engine/state.ts:151-153`、`webmin/model.ts:526-528` 与 `:615-617`、`webui/paint.ts:49-51`。与 rev=8/9 我认可的 R05/R13/C20 同档。**B**
- **(b) 未披露但属同一类**：`webui/netplay.ts:482`（`viewWord` 的兜底 `return phase`）。类型层不可达，**不算缺口**，但请一并列进 10-F（应修 3）。**A**
- **(c) 房间自检分支：4 段，我单独定性（v4 新发现，两班之前都报成 100%）**：`netx/room.ts:171-174`（`fault = egress blocked for seat N` + `queue(seat, [{t:'error', code:'leak_blocked', why}])`）、`:333-335` 与 `:337-339`（`reveal self-check failed`，两条）、`:360-362`（`authoritative engine rejected its own action`）。
  **这四段是服务端版的"第二道墙"** —— 房间自己发现自己算错了/漏了别人的牌/引擎否掉了自己的动作时的处置路径。它们**只在其余代码有 bug 时才可达**，所以我不要求你们构造用例去踩它们（那需要注入 bug，与"不许为通过特判"同一类麻烦）。**但我要求 10-F 里逐段写明"按构造不可达，前提是 X"**，其中 X 要具体：`:171-174` 的前提是 `projectView` 的白名单正确、`:333-339` 的前提是 `commitOf`/`seedFromShares`/`revealMatches` 三者互逆、`:360-362` 的前提是 `checkAction` 与 `apply` 对同一份 state 判定一致。**"没找到用例"不接受**（这是我 rev=8 就立下的口径），"按构造不可达 + 具体前提"接受。**级：A**（可达性由 v4 实测）+ **C**（"按构造不可达"这个定性是我的解读）
- **(d) 未披露且可达 —— 这几段我点名，建议补用例**：
  - `netx/ws.ts` 5 段：`:79-81`（`encodeClose(1011, 'server produced an invalid message')`）、`:114-115`（断开流程重入的忽略支）、**`:146-149`（`room handler failed` 500 兜底 ⇒ 必修 2 与应修 9）**、`:164-167`（握手失败回 400 的那三行）、`:218-219`（`encodeClose(1002, 'protocol error')`）。**`:146-149` 在真 socket 上一条请求就能走到**（我实测过），`:218-219` 你们本轮的 `ws/06` 打了坏帧但打的是另一条路径。**rev=9 §5(c) 我点过这一类，本轮仍未补齐 ⇒ 见应修 9。** **A**
  - `webui/netplay.ts` 9 段：`:126-127`（`readSaved` 的 catch）、`:206`（ping echo 上行）、`:224-225`（非 JSON 的 catch）、`:259`（`return link`）、`:303-325`（未开局占位快照）、`:335-352`（离桌占位格）、**`:394-410`（在座玩家的座位格映射整块）**、`:432-433`（余数文案）、`:482`（见 (b)）。
    `:303-325` 与 `:335-352` **我亲眼看它们在真页面上出现过**（局间那几秒 / 离桌那席），两班的 S1/S6/S4 也用 9+7 条断言钉过键集，**但都没走无头正式用例** ⇒ 能补就补，无头侧完全可构造。
    **`:394-410` 是这一组里最该补的**：那是"把服务端给的在座者行映射成座位格"的**主路径**，不是错误分支。它零覆盖意味着**无头测试从来没有走过一次"我在桌、我看得到自己的牌面/筹码/状态"的完整投影** —— 真浏览器上它当然跑过（我抓到了结算面板与座位格），所以这不是死代码，是**测试面漏了主路径**。**A**
  - `src/rules.ts:133-137`（`players.min>max`、`stake.initial>max` 两处 `fail`）。**`sup-probe3.ts` 证明经 `validateRules` 可达**（两次都抛，对照组 `classic` 不抛）。rev=9 §5(d) 我记为"M4 变更面之外，备查"，本轮**升级为可达且未测**；不在 M5 变更面内所以不阻塞，但两条 `assert.throws` 的成本近乎零。**A**
  - `netx/serve.ts:98-99`（收尾失败的 `process.exit(1)`）、`:118-119`（无可读 stdin 的 catch）；`webmin/serve.ts:98-102`（404/500 catch）、`:107`（`void serveStatic`）、`:118-121`（独立 listen 回调）。**注意 `netx/serve.ts:75-86` 是已覆盖的**（`srv/03` 的真 spawn 子进程刷出来了，v4 自检 B 条），别再把整个主模块块当成盲区。`webmin/serve.ts` 那三段：把 `webmin/serve.ts` 也纳入 `srv/03`/`srv/04` 那套真 spawn 工装即可，**必修 2 的用例正好顺带覆盖 `:98-102`、`:107`、`:118-121`**。**A**
  - `webmin/model.ts` 6 段：`:340-344`（离桌占位格，M1.5 侧）、`:487-488`（`unknown_intent`）、`:524`、`:568-569`（`bot_loop` 卡住）。**都是 M1.5 单机面，不在 M5 变更面内**，记录备查。**A**
  - `src/engine/{actions.ts:166-169, settle.ts:71-72 与 :102-103, state.ts:105-106 与 :122 与 :287, validate.ts:161-162}`、`src/ai/honest.ts:174-176`：M4 之前的老面，本轮变更没碰，**不阻塞、不要求补**，列出来是为了让 10-F 与 oracle 对得上（应修 3）。**A**
- **(e) Canvas/DOM 层，既有类别**：`webui/paint.ts:40-47`（81.0%，描边那一支）、`webui/scene.ts:170-172`（超宽单词截断）与 `:249-250`（"窗口太小"提示）。`webui/main.ts` **完全不在 oracle 的文件表里**（无头侧 0 覆盖），这一条你们在 10-F 里已披露、我认可其理由（这一层就是时钟/IO 的唯一出口）。**A**
- **合计**：53 段里 (a)+(b) 共 11 段属恒真兜底不算缺口；(c) 4 段是房间自检分支（要求写前提，不要求用例）；(d) 约 30 段是**可补的**（其中 `netplay.ts:394-410` 与 `ws.ts:146-167` 最该补）；(e) 3 段属既有类别；其余为 M5 变更面之外的老面。**v4 下 100.0% 的文件只有 5 个：`netx/seed.ts`(112/112)、`netx/sha256.ts`(113/113)、`src/cards.ts`(135/135)、`src/engine/project.ts`(62/62)、`webui/bridge.ts`(153/153)。** 手写密码学与帧编解码这两个最容易出错的地方是满覆盖，这一点我认可；但**服务端权威面并非无保留** —— `room.ts` 97.6%、`ws.ts` 93.6%，缺口都在"自己发现自己错了"与"socket 错误路径"这两类上。**A**

## 6 · 明确不算问题的（防止你返工过头）

1. **我复审期间有两个后台房间进程静默死亡（8795、8796/8797）⇒ 归因于工装硬杀后台作业，不是交付崩溃（C 级归因，A 级反证）。** 理由：真崩溃**一定会**留下完整栈 —— 必修 2 那次就留了（`sup-f2-webmin.log` 里 7 行栈 + `Node.js v24.19.0`）；而这两次的重定向 stderr 里**什么都没有**，我自己的 SIGTERM 处理器也没打印，`/health` 每一拍都是 `fault=null`。加上 `sup-serve-quit.log` 证明 `quit` 路径 `exit=0` 干净退出。**我不点名元凶**：这条只说明"我的证据里不支持把它算成交付缺陷"，不说明"交付一定没有此类缺陷"。**C**（归因）+ **A**（反证）
2. **按钮上显示一个服务端会拒的价钱，不是缺陷 —— 那就是 Q6=A2 ③ 要的形状。** 我用 `sup-probe2.ts` 撞到的 `{"code":"stake_at_max","why":"stake 16 cannot double within max 16"}` 与 S4b 的 `cannot_afford`，两条原文都被印到了牌桌上。**A**
3. **占位快照 `buttons: []` 与单机的 8 个禁用按钮不同，不算破坏 `nui/01`。** 那条用例钉的是**键集逐字一致**，我的 S1 把差异精确定位到恰好 `['buttons','dealerRule','humanSeat','status']` 四个键的**值**（占位场景本来就没有庄家规则、没有按钮、没有 status 文案），键集是完全一致的。**A**
4. **离桌那席不显示牌面，不算"藏信息"。** 座位格上已经写了「本局不参与」（`netplay.ts:345`），玩家看得见"它这局不在"，只是看不见"它手上有什么"—— 而它这局根本没有手。**A**
5. **`remainder = -1` 当哨兵可接受。** `netplay.ts:432` 只在 `>= 0` 时才印"余数 1 分给…"那一行，负值不会被当成座位号渲染出去。**A**
6. **D02 存活接受为等价变异**（依据见 §2.5：我的全枚举引理 + 你们的构造性论证，两条独立路径同结论）。你们把失败的 `room/30` **撤除**而不是留一条恒过的用例，这个处理我认可。**A+B**
7. **`paint.ts`/`scene.ts`/`main.ts` 的缺口属既有的 DOM/Canvas/时钟类**，不在 M5 变更面内；10-F 已披露 `main.ts` 那条，我认可其理由。**A**
8. ~~**`webmin/serve.ts` 的 500 分支现在已被覆盖**，10-F 那一行是反向陈旧（少报）。~~ ⇒ **这条撤回（X）**：oracle v4 实测 `webmin/serve.ts:98-102`（`ENOENT/EISDIR ? 404 : 500` 那个 catch）**未覆盖**，`:107` 也未覆盖。**你们 10-F 那一行本来就是对的**，第一班这条指责出自 §2.9 的假阳性。详见应修 3。**A**
9. **BRIEF §4 M5 ⑤「不许改 `nst/04`」作废，改动予以追认。** 那是**我上一轮的起草错误**：⑤ 与 M5"页面必须复用 `netx/client.ts`"这条硬性要求不可同时满足（`webmin/serve.ts:22` 的放行清单一变，`nst/04` 的断言文本就必须跟着变）。我已把 BRIEF §4 M5 ⑤ 改写成可执行版本，并把新口径钉在 `nst/04` 的新标题里（"webui 里只有 netplay.ts 这一个进口"）。**你们不需要为此返工**；需要做的只是应修 1（把自评表那格改成事实）。**A**
10. **`nst/01` 与 `nst/04` 的标题重写不算回归**（编号在，按 rev=9 §8 的预裁定放过；差集证据在 §2.6）。**A**
11. **`onNonceDeadline` 里"庄家没交份额就挪庄"这条新规则不算你们擅自扩权。** 它是缺陷④的必要修法，`DELIVERY.md:112-113` 明确披露了、`room.ts:293` 有注释、`room/29` 有用例、我的 S5 独立复现了行为。**缺的是我这一侧**：工单 §1 的「庄家」那一行没写过这个边界。我已把它写进 BRIEF §1（"庄家若在收集份额阶段未能提交，本局庄家顺延到仍在桌的下一家；若剩余人数不足 `players.min`，本局作废并在局间表后重开"）。**A**
12. **`renew()` 不清 `violations`（SELF-REVIEW 自我决定 ⑥）我认可**：换一桌不该把"上一桌抓到服务端越界"这个审计事实抹掉。**B**
13. **`netx/serve.ts` 认识 `webmin/serve.ts`（组合根）我认可**：它是唯一同时认识两个模块的一次性装配脚本，不被任何库 import，测试只 import `startRoom`；反向仍被 `nst/04` 禁。**A**
14. **本轮真浏览器验收的四处环境限制记在我账上，不记在你们账上（第二班实测，`br-acceptance.txt` L 组）。** **L1** 内嵌浏览器面板没有可见表面：`take_screenshot` 直接报 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`（`viewport=0x0, visible=false, visibilityState=hidden`）⇒ **本轮没有截图**，页面证据来自 CDP 的 `take_snapshot`（可达性树）与 `evaluate_script`（读真实 DOM 与你们自己留的 `window.__zjh3` 只读钩子）。**L2** `window.innerWidth/innerHeight` 报 0，但文档**确实有真实布局**（body 531.2×557.6、`#board` clientWidth/Height = 526×501、`getBoundingClientRect` = (2, 54.4, 527.6, 502.8)、dpr 1.25）—— 我一度以为页面死了，是我自己量错了对象。**L3** 由 L2 推出：canvas 526×501 < `MIN_VIEWPORT` 560×560（`webui/scene.ts:80`），`buildScene` 走 `scene.ts:242-243` 的「窗口太小」分支 ⇒ **`__zjh3.hits().length === 0`（实测）**，第二班因此没能走 `canvas click → hitAt → send` 那一层，改用 `__zjh3.click(intent)`（调的就是 canvas 处理函数调的同一个 `send(intent)`，`webui/main.ts:302-308`/`:341-343`，只差坐标→意图那一步映射）⇒ 那几条按 **B** 记。第一班走的是另一条路（强制 `board.style.width/height` + 派发 `resize` 把命中区点亮，之后 `getBoundingClientRect()` 与 `hits()` 都返回真数字，再用坐标 `MouseEvent('click')`）⇒ **两班合起来，"真鼠标点画布"这一层已被第一班覆盖到 A 级**（§2.3）。**L4** `navigate_page` 没有新建标签页的参数，注入 `<a target="_blank">` 再 `.click()` 也开不出第二页（`list_pages` 仍只有 1 页）⇒ **"同一浏览器两个标签页各占一座"两班都没做成物理验证**，只到机制层（见 §8.7）。**A**（这些限制本身是我实测到的工具面事实）
15. **`MIN_VIEWPORT` 那个限制你们已经在 DELIVERY.md:118-122 主动披露了**（连同 `take_screenshot` 失败、浏览器证据只有文本形式、没有新标签页原语三条）。**这个披露我认可，不算隐瞒**，也不因为"验不了"就反过来说"没验过"。**A**
16. **断线重连那条我只能给到 B，原因是我的手段不是你们的缺陷**：页面 `backToSolo()` 先把 `sock.onclose` 置 null 再 close，所以我量到的是**一次干净关闭**，不是网络被拔（CDP 未暴露网络仿真）。重连本身走通了、台账守恒（**total 471 === 471**、`ledgerLine` 逐字符相同、token 仍是原来那一个、日志补齐成 #001–#004、`untrusted=false errors=[]`）⇒ 结论成立，只是**触发方式**弱于"真断线"。**B**
17. **房间在没人陪玩时 `hand` 索引一直往上跳（我的实测里从 3 跳到 9、11、13）：不是缺陷。** 那是 `netx/room.ts:274-278`「凑不齐最低人数 ⇒ 本局作废、挂 gap 定时器」在反复重试，每次作废都占掉一个 hand 号。页面此时给的是 `view===null` 的占位快照（`seats=[]`、`total=0`、`ledgerLine=""`、`log=[]`），**没有编造任何数字**，与两班的 S1/S4 一致。**A**
18. **`npm test` 比 `node test/run.ts` 多 4 行：不是输出不纯净**，多的是 npm 自己的横幅；两个命令各自双跑都逐字节一致，TEST-OUTPUT.md:27-30 把四个哈希都写全了（rev=9 应修 6 照办），与我四次实测逐字相同。**A**
19. **`evidence/m4-ws-interop.txt` 未重生成：接受**（理由同 rev=9 §1）。M5 新增的 `evidence/m5-browser-live.txt` 我**没有**拿它当验收证据 —— 按 §8.3 我的主证据是我自己开的那两场（§2.3 与 §2.10）。**B**
20. **本轮两个复审写入者并行、产出两份冲突裁定：是我这一侧的流程问题，与你们无关。** 你们不需要为此返工，也不需要去读附 A；处置见 §2.8 定稿补记。**A**

## 7 · 复审怎么复现（产物都在 `.audit/rev10/`；刻意不入 manifest、不在 `test/` 下。本轮两班并行：`sup-*` 是第一班，`br-*`/无前缀是第二班，**两班产物一个没删**）

```bash
cd /f/qoder/zjh

# ① 清单（我自己从 DELIVERY.md 抽，不用交付方的现成文件）
sha256sum -c .audit/rev10/manifest-claimed.txt        # 期望 74/74 OK、0 条不符

# ② 双跑 + 类型
node test/run.ts > .audit/rev10/node1.txt 2>&1 ; node test/run.ts > .audit/rev10/node2.txt 2>&1
npm test          > .audit/rev10/npm1.txt  2>&1 ; npm test          > .audit/rev10/npm2.txt  2>&1
sha256sum .audit/rev10/{node1,node2,npm1,npm2}.txt     # 两两相同，且与 TEST-OUTPUT.md:27-30 相同
npx tsc --noEmit ; echo "tsc_exit=$?"                  # 期望 tsc_exit=0，零输出

# ③ 我的临场抽查（两跑必须同哈希；74 条断言，8 节，每节断言数 > 0）
node --experimental-strip-types .audit/rev10/sup-spot-check.ts > .audit/rev10/sup-spot-run1.txt 2>&1
node --experimental-strip-types .audit/rev10/sup-spot-check.ts > .audit/rev10/sup-spot-run2.txt 2>&1
sha256sum .audit/rev10/sup-spot-run{1,2}.txt           # 34ee443f6823e115681ddb45466f6ecf73aee3f1f7a25155a9b5f924e542e7ac

# ④ 覆盖 oracle —— **用第四版**。前三版都留档但都不作数（见 §2.9：cov-report.mjs 假阴性、
#    sup-cov-report2.mjs 假阳性、sup-cov-final.mjs 又假阴性）。v4 末尾会自动打印三条地面真值自检，必须 A=2222 / B=1111111 / C=12222。
node .audit/rev10/sup-cov-final2.mjs .audit/rev10/cov .audit/rev10/sup-cov   # → sup-cov-final2.txt，22 文件 / 53 段
node .audit/rev10/sup-ws-dump.mjs | head -20       # 假阳性的原始证据：那个 [0..8650) count=1 的顶层合成条目
node .audit/rev10/sup-align.mjs                    # 偏移对齐：strip 前后都是 8603，探针落在真代码上
#    （coverage JSON 若要重采：NODE_V8_COVERAGE=.audit/rev10/cov node test/run.ts；每次会产生 3 个文件，
#      因为 srv/03、srv/04 各 spawn 一个真子进程，子进程继承 NODE_V8_COVERAGE 并各自刷一份。）

# ⑤ 必修 1 复现（房间进程印的 URL 落在 M1.5 单机页）
node netx/serve.ts 8801 &   sleep 3
curl -s -L -o /tmp/a.html -w '%{url_effective} %{http_code}\n' http://127.0.0.1:8801/
grep -ciE 'netUrl|netplay|入桌' /tmp/a.html             # 期望 0  ← 这就是缺陷
curl -s -L -o /tmp/b.html -w '%{url_effective} %{http_code}\n' http://127.0.0.1:8801/webui/
grep -ciE 'netUrl|netplay|入桌' /tmp/b.html             # 期望 2

# ⑥ 必修 2 复现（一条畸形 URL 打死独立静态服务；对照组是房间进程）
node webmin/serve.ts 8802 &   node netx/serve.ts 8803 &   sleep 3
curl -s -o /dev/null -w '%{http_code}\n' --path-as-is 'http://127.0.0.1:8802/%'   # 000
curl -s -m 3 -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8802/webmin/index.html  # 000 = 已死
curl -s -m 3 -w ' <- %{http_code}\n' --path-as-is 'http://127.0.0.1:8803/%'       # 500 + room handler failed
curl -s -m 3 -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8803/health        # 200 = 活着

# ⑦ 零回归差集（ID 零丢失）
comm -23 .audit/rev10/sup-base-ids2.txt .audit/rev10/sup-cur-ids2.txt   # 期望空
wc -l .audit/rev10/sup-base-full.txt .audit/rev10/sup-cur-full.txt      # 362 / 393

# ⑧ 我的 Node "第二个人"（真 socket，走页面同一个接缝）
node .audit/rev10/sup-room.ts 8810 &   sleep 2
node .audit/rev10/sup-bot.ts 8810 乙 2                                    # → BOTSUMMARY {json}
#   ↑ 第一个参数是**裸端口号**，不是 ws:// URL：sup-bot.ts 里是 `Number(process.argv[2])` 再自己拼
#     `ws://127.0.0.1:${port}`。传 URL 会得到 NaN（本节原来写错了，定稿时改正）。

# ⑨ 第二班的真 socket 中间人注入（§2.10；本轮最硬的一条证据）
node netx/serve.ts 8790 &            sleep 2
node .audit/rev10/br-mitm.ts 8791 8790 &        # 透传代理 8791 → 8790
# 浏览器打开 http://127.0.0.1:8790/webui/index.html，把 #netUrl 改成 ws://127.0.0.1:8791 后连上，然后：
echo '{"corruptReveal":true}' > .audit/rev10/mitm-trigger.json
# 打完一手 ⇒ 页面 #hint 出现「⚠ 这一局不可信：reveal check failed…」，五个按钮塌成一个不可点的「已停手」，
# verifiedHand 退回 null，结算面板第 4 行变「揭示核对 未通过」；br-mitm.log 里有 original/modified 两行。
# 对照组：不写 trigger 文件的那些手，untrusted=false、verifiedHand=手号、面板「揭示核对 通过」。

# ⑩ 第二班的临场抽查（103 条断言，与 ③ 那份无共享代码；两跑必须同哈希）
node --experimental-strip-types .audit/rev10/spot-check.ts > .audit/rev10/spot7.txt 2>&1
node --experimental-strip-types .audit/rev10/spot-check.ts > .audit/rev10/spot8.txt 2>&1
sha256sum .audit/rev10/spot{7,8}.txt   # 期望两两相同，且 == spot5/spot6 的
                                       # 32ea2929149b98cd06eb90ffae2fd101d2ba57cd4d0159f968bab22dd08e349c

# ⑪ 应修 7 的复现（「桌上总额」漏算离桌座位的筹码）
grep -n "departed ? 0" webui/netplay.ts          # :462 total 的过滤
grep -n "桌上总额" webui/scene.ts                # :379 标签
grep -rn "chips.delete" netx/                    # 零命中 ⇒ 房间侧从不销账
```

## 8 · 下一轮（rev=11）验收口径 —— 我按这十三条逐条查（8.1/8.2 是必修，8.3–8.13 是应修与口径）

**8.1 必修 1**：`node netx/serve.ts <port>` 打印的那一行里，页面 URL 必须**直接**落到有联机控件的页面。我的判据：`curl -sL` 把那个 URL 跟到底，响应体里 `grep` 得到 `netUrl`（或等价的联机控件 id）才算过；并且 `webmin/serve.ts:42` 那条 `/`→M1.5 的映射**必须原样保留**（我会 diff 它）。要有一条正式用例钉住"打印出来的 URL === webui 页面"（正向 + 对照）。`RunningRoom.httpUrl` 与 `DELIVERY.md` 的复现行要一起改（我自己就会拿那一行去点）。

**8.2 必修 2**：`GET /%`（以及 `/%zz`、`/%e0` 之类）打独立的 `node webmin/serve.ts <port>` 必须**不**死；打完之后同一端口对合法路径仍然 200。要有正式用例，断言里必须包含"进程还活着"这一条（真 spawn 优先，可复用 `srv/03`/`srv/04` 的工装）。
　**状态码我要求 400 而不是"400 或 500 都行"**：这是请求的错，不是服务端的错；而且你们已有的两条同性质 guard 回的就是 400（`webmin/serve.ts:49` `NUL in path`、`:51` `backslash in path`；`:53` `outside project root` 回 403 是另一档，不用动）。`%zz` 与 `%00` 同形，`why` 建议就叫 `malformed percent-escape`，测试也就同形好写。回 500 会让运维以为服务自己坏了。
　**附带一条（应修 9，不阻塞）**：`netx/ws.ts:146-149` 那个 catch 请补一条用例，用 `onHttpRequest: () => { throw new Error('x') }` 故意制造异常，断言 500 应答与连接不残留。**必修 2 修完之后这条必须靠"故意抛"才走得到** —— 别顺手把 ws.ts 的 500 改成 400，那层兜的是"将来有人往 `onHttpRequest` 里塞了会抛的东西"，语义确实是服务端侧的意外。

**8.3 不许为了修应修 2 而在 `netplay.ts` 里再写一份协议判定。** 出口是 `peer.info().errors`（只有通过 schema 校验的下行才落在那儿，我的 S2 对照组 1 已证明这条路走得通）。第二份客户端协议实现 = 按工单 §5 禁令**直接打回**（沿 rev=9 §8.2 的同一口径）。修完之后我的 S2 那 17 条断言里，"schema 非法 ⇒ 不清凭据、不自动重入桌"必须翻成绿；我会在 rev=11 直接重跑同一个 `sup-spot-check.ts`（只改期望值），不会重写。

**8.4 10-F 表必须能与我 rev=11 的覆盖 oracle 输出逐行对上。** 对不上就是披露不完整（应修 3 重犯）。恒真兜底那类可以继续记"按构造恒真"，但**每一段都要在表里出现**，一行一段、别归类合并。
　**oracle 口径本轮定死（v4，§2.9），rev=11 我沿用同一份脚本**：① 跨进程 OR-merge；② **不跳过** `isBlockCoverage=false` 的条目（V8 用它表达"这个函数体一次都没进去"）；③ 顶层合成 range（`startOffset=0 && endOffset>=脚本长度`）保留，只给顶层直线代码兜底；④ 同进程内按出现顺序 fill 让内层覆盖外层。
　**并且我的报告末尾必须自动打印那三条地面真值自检**（A `netx/ws.ts:146-149` 未覆盖、B `netx/serve.ts:75-86` 已覆盖、C `webmin/serve.ts:117-121` 未覆盖）。**自检不过 ⇒ 整份覆盖率结论作废，我不会拿它去要求你们改任何东西。** 本轮我在这上面栽了**三版**（rev=9 那版跨进程 fill 假阴性 → OR-merge 那版跳过 `isBlockCoverage=false` 假阳性 → 剔除顶层合成 range 又假阴性），**第四版**才靠这三条自检站住；这条自检就是为了让我自己不再拿坏工具去定你们的账。你们若要自查覆盖率，直接跑 `.audit/rev10/sup-cov-final2.mjs`（它只读 coverage JSON 与源文件，不改任何东西）。

**8.5 自评表与交付说明不许互相矛盾。** 应修 1 那格改成事实；BRIEF §4 M5 ⑤ 已由我改写成可执行版本（"放行清单变化时 `nst/04` 的断言文本可随之收窄，但`webui/` 里只许有 `netplay.ts` 一个 `netx/` 进口这条不变"），引用它即可。

**8.6 零回归**：393 条 ID 一条不许丢（`comm -23` 必须为空）；标题可改但编号必须在。新增用例请继续用新编号，不要复用旧编号装新内容。

**8.7 验收① 剩下的"≥720×640 真鼠标 + 同一浏览器两个标签页"仍归我，不因此判你们不合格。** 本会话内嵌浏览器视口报 0×0 / `visibilityState: hidden`，且工具面**没有开新标签页的原语**（`window.open` 被拦）。我用"强制尺寸 + 派发 resize + 坐标 `MouseEvent`"已经把命中区点亮并真打完了两整手（§2.3，A 级），但**截图**与**真两个标签页**这两件我还没做到。rev=11 我继续用同一套办法；若届时仍拿不到新标签页原语，我会明说这一条"工具面不可验"，并只以 `nui/07` 的机制证据为准 —— **不会**把它算成你们的未达标项，也**不会**假装它已验。用户若要我把这一条真验到底，需要把内嵌浏览器面板打开到 ≥720×640。

**8.8（口径补充，非新增要求）**：应修 4、5 修完之后，请各自带一条无头用例：`lastReject` 在"后续行动被接受"之后必须不再出现在 `hintText` 的取值里；服务端 `notice` 必须出现在 `snapshot().log` 里（并保持 `nui/01` 的键集不变）。

**8.9 应修 7（「桌上总额」）**：两种改法我接受任意一种，但**必须带用例**，而且用例的口径要跟着改法走 —— 选"改标签"（例如「在场筹码」）就钉住"标签文案与 `departed` 过滤口径一致"；选"把离桌格子计入 `total` 并在 `ledgerLine` 里单列"就钉住那个更强的不变量 **`total` === 房间台账 `sum(chips) + pot`**（我 §7 ⑪ 给了三行 grep 复现，第二班 S4 的对照组可直接复用）。**不接受的改法**：只把 `departed ? 0 : c.chips` 的过滤去掉而不动标签 —— 那样「桌上总额」会把"房间欠着但不在场"的筹码算进来，与重连后台账的口径又不一致了，等于把问题从一边挪到另一边。

**8.10 应修 8（D02 前提）**：等价性我已接受（三路同向），rev=11 **不需要**再论证一次，只需要把配置前提写进 10-F 那一行：恒等只在 `startRoom` 硬编码 `firstDealer: 0` 时成立；`firstDealer` 不在 `seated` 里时 `dealerAmong` 的绕回兜底可观测。**这是纯文书，一行字。**

**8.11 §5(c) 房间自检四段（`room.ts:171-174`、`:333-335`、`:337-339`、`:360-362`）**：**我不要求你们构造用例去踩它们**（那需要往交付代码里注入 bug，与"不许为通过特判"是同一类麻烦）。**但我要求 10-F 里逐段写明"按构造不可达，前提是 X"，且 X 要具体到能被反驳**：`:171-174` 的前提是 `projectView` 的白名单正确、`:333-339` 的前提是 `commitOf`/`seedFromShares`/`revealMatches` 三者互逆、`:360-362` 的前提是 `checkAction` 与 `apply` 对同一份 state 判定一致。**"没找到用例"不接受**（rev=8 就立下的口径）。这四段是服务端版的"第二道墙"，它们没被测到本身不算缺陷，但**它们凭什么不会触发**这件事必须写在纸上。

**8.12 §5(d) 里两处最该补的用例**（其余可补段落我不逐条追）：
　**(i) `webui/netplay.ts:394-410` —— 这是主路径，不是错误分支。** 那是"把服务端给的在座者行映射成座位格"的整块（牌面、`tierText`、`chips`、`status`、`hidden`）。它零覆盖意味着**无头测试从来没有完整走过一次"我在桌、我看得到自己那一格"的投影**。真浏览器上它当然跑过（我抓到了结算面板与座位格），所以不是死代码，是**测试面漏了主路径**。无头侧完全可构造（两班的 S1/S4 都已经在无头侧跑出过真座位格，只差把它变成正式用例）。
　**(ii) `netx/ws.ts` 的 socket 错误路径**：`:146-149`（→ 应修 9）与 `:164-167`（握手失败回 400 那三行）。这两条**在真 socket 上一条请求就能走到**，我两班都实测过；`ws/06` 已经把真 socket 工装搭好了，边际成本很低。

**8.13 rev=11 我会再注入一次，但换个注入点。** 本轮 §2.10 改的是 `reveal` 的份额（撞的是揭示核对那条路）；下一轮我改 `patch` —— 例如把某一家的 `chips` 或 `pot` 改掉，或往**我自己的** view 里塞对手的牌面，看第二道墙是不是**只认揭示这一条路**。代理已经写好（`br-mitm.ts`），换 payload 是几行的事。**如果 `patch` 上的篡改抓不到，那会是一条新的必修**，所以我先说在这里，免得到时候像是临时加码。

---

# 附 A：rev=10 第二班并行复审记录（独有结论已并入顶部裁定；保留备查，**不是**一份独立裁定）

> **为什么会有这一份**：本轮有两个复审写入者并行工作（见顶部 §2.8），各自独立跑完了一遍复审、各自落了一份 rev=10 裁定，于是这个文件里一度同时存在两个互相冲突的 rev=10 结论（顶部那份「必修 2 项」、下面这份「必修 1 项」）。
>
> **冲突已消解：以本文件顶部那一份为唯一权威裁定。** 它同时携带两班的必修 —— 下面这份的「必修 1」与顶部那份的「必修 2」是**同一个缺陷**（`webmin/serve.ts` 的裸 `decodeURIComponent`），两班各自独立发现、独立复现，只是编号不同。
>
> 下面这份**保留不删**（通用纪律：证据产物不删；改判新增一节而不就地改写旧结论）。但读它的时候请注意以下四点已被顶部 §2.9 的 **oracle v4** 取代：
>
> 1. **§2.3 的「22 个文件 / 43 段未覆盖」与 §5 的四分类作废** ⇒ v4 的口径是 **22 文件 / 53 段**。它用的 `cov-report.mjs` 是 rev=9 那版（单张表跨进程 fill），有**假阴性**；顶部 §2.2 用的 `sup-cov-report2.mjs` 换了 OR-merge 但跳过 `isBlockCoverage=false` 条目，有**假阳性**；我自己后来写的 `sup-cov-final.mjs` 整条剔除顶层合成 range，又回到**假阴性**（`netx/serve.ts:75-86` 明明跑过却报未覆盖）。这三版都不作数，v4（`sup-cov-final2.mjs`）才是。
> 2. **§2.3 第 2 条「`netx/ws.ts:143-149` 是 count=0」：结论方向对，但定位偏了。** v4 实测未覆盖的是 **146-149**（catch 体那四行）；**143-145 是已覆盖的**（`try` 那半边跑过）。另注：`:145` 那行同时含 try 的闭括号，行级折叠会把它显示成"已覆盖"，别读成"catch 跑过了"。
> 3. **§4 应修 4(a) 那个解释撤回（X）**：它说「接受 `netx/serve.ts:76-121` count=0，理由是进程边界 + `process.exit(0)` 不刷 V8 覆盖」—— **这个理由是错的**。v4 实测 `netx/serve.ts:75-86` **已覆盖**：`srv/03` spawn 的子进程继承了 `NODE_V8_COVERAGE`，`quit` → `process.exit(0)` 确实把覆盖刷了出来（这正是 oracle v4 三条地面真值自检里的 B 条）。该文件真正未覆盖的只有 `:98-99`（收尾失败）与 `:118-119`（无可读 stdin 的 catch）。
> 4. **§4 应修 1（`netx/ws.ts:146-149` 零覆盖）成立**，已并入顶部 §5(c)。顶部 §2.2 曾把这一条**撤回**（X），那次撤回本身是错的 —— v4 已把它恢复，详见顶部 §2.9。
>
> **下面这份的独有贡献**（均已并入顶部裁定，原文留在原地不动）：真 socket 中间人注入（→ 顶部 §2.10）、「桌上总额」漏算离桌座位筹码（→ 顶部应修 7）、D02 等价性论证口径过宽（→ 顶部应修 8）、我自己那 103 条断言与七个夹具坑的自陈（→ 顶部 §2.11）、manifest 三次重算、断线重连只能按 B 记的那处局限。
>
> 下面这份原文的编号（必修 1、应修 1–6、§2.1–§2.4、§8.1–§8.6）都是**它自己的**，与顶部裁定的编号不通用。

## 0 · 一句话结论

**M5 的功能面我认了：真浏览器 + 真房间 + 真 socket 打完整手，价格显示与日志金额逐档相同，断线用 token 绑回原座位且台账守恒，我自己写的中间人代理在真 socket 上改掉一个十六进制字符、页面当场印出「⚠ 这一局不可信」并把五个动作按钮换成一个不可点的「已停手」——第二道墙在真页面上是活的，不是只活在夹具里。但同一棵交付树里，`node webmin/serve.ts`（SELF-REVIEW 自己推荐的零依赖开页面通道）会被一条 `GET /%zz` 打死：未捕获的 `URIError` 从 `webmin/serve.ts:40` 冒出来，`serve.ts:107` 那个 `void serveStatic(...)` 让它变成没人接的 promise rejection，Node 24 默认 throw ⇒ 进程退出，客户端连应答都拿不到。房间进程靠 `netx/ws.ts:143-149` 的 catch 活了下来（回 500），M3 那个入口没有这层保护。这条判必修，rev=10 不通过。**

证据分级沿用前几轮：**A** = 我实测可复现（附命令/产物）；**B** = 我的工具已交叉验证；**C** = 我的解读；**X** = 撤回。

## 1 · 硬闸门（工单 §0.7）逐条结果

| 闸门 | 结果 | 我的证据 | 级 |
|---|---|---|---|
| manifest 逐文件 sha256 可复算 | **74/74 OK，审前审中审后各算一次都 OK** | `sha256sum -c .audit/rev10/manifest-claimed.txt`；清单从 DELIVERY.md 用 `grep -E '^[0-9a-f]{64}  '` 抽出（74 行），不采信交付方的现成文件。三次时间点：21:06（开审）、21:49（我的后台代理写完产物后）、22:20（真浏览器验收全部跑完后，落盘 `.audit/rev10/manifest-recheck-final.txt`） | A |
| 交付后未改动任何 manifest 文件 | 通过 | 我这轮全部产物都在 `.audit/rev10/`（含我自己派生的后台代理写的 `sup-*` 与我写的 `br-*`），交付目录一字未动；末次重算仍 74/74 OK | A |
| 测试双跑逐字节一致 | 通过 | `node test/run.ts` ×2 → 515 行，sha256 `9ced956780b1578eb25ab8c46dc90d4f6c4caa6bc6ea595b877c62740147dbc4`；`npm test` ×2（我跑了四次，两两相同）→ 519 行，sha256 `742e55c60b5adb0380aa454326d787b95817511b2d4a61ae4b9fbfb7acb8655c`。**两个哈希与 TEST-OUTPUT.md 自己声明的四个哈希逐字符相同**（`.audit/rev10/run-hashes.txt`） | A |
| 结论行 | `RUNNER files=29 cases=393` / `SUMMARY pass=393 fail=0 total=393` / `RESULT=ALL_PASS` | `.audit/rev10/node1.txt` 末尾三行 | A |
| `npx tsc --noEmit` 零诊断 | 通过 | exit=0、诊断输出为空。**注意口径**：`.audit/rev10/tsc.txt` 是 11 字节，内容是我自己 echo 的 `tsc_exit=0`，不是 tsc 的输出；tsc 本身没吐字 | A |
| 运行时依赖为空 | 通过 | `package.json` 无 `dependencies` 字段（Q5 裁定 ≡ 空对象）；devDependencies 仍只有 `@types/node`/`typescript`/`vite`；`nst/07`（断言没装 `ws`）与 `static/06` 都还在 | A |
| 种子必须多方合成 | 通过 | 真浏览器实测：hand 6 结算面板第 4 行「本局序号 8｜揭示核对 **通过**」、`netInfo.verifiedHand === 6 === handIndex`；我在真 socket 上改掉 `shares[0].value` 的一个十六进制字符后，同一行立刻变成「揭示核对 **未通过**」、`verifiedHand` 退回 `null`（§2.2 C 组） | A |
| 可移植层无真实时钟/随机/IO | 通过 | `netx/serve.ts` 是组合根（工单 §4 M5 允许），`webui/main.ts` 仍是唯一可碰 DOM/时钟的一层；`webui/netplay.ts` 由 `nst/10` 钉住"价格公式不许扩散"，我 grep 过 `webui/` 没有第二份 `bet.dark`/`bet.seen`/`compare.fee` 算式 | A |
| 测试输出无时间戳/无随机顺序 | 通过 | 双跑逐字节一致本身就排除了这两条 | A |
| 五个协议文件不入 manifest | 通过 | `grep -E 'DELIVERY\|REVIEW\|QUESTIONS\|ANSWERS\|BRIEF' .audit/rev10/manifest-claimed.txt` 只命中 `SELF-REVIEW.md` | A |

## 2 · 我不只是重跑了你的测试

### 2.1 我自己写的临场抽查：`.audit/rev10/spot-check.ts`（103 条断言，两跑逐字节相同）

自带假时钟、自带 `node:net` 裸 socket、自建引擎驱动器，不复用 `test/netx-fixtures.ts`。`spot5.txt` ≡ `spot6.txt`，sha256 `32ea2929149b98cd06eb90ffae2fd101d2ba57cd4d0159f968bab22dd08e349c`，**103 条断言、0 失败、`SPOT=ALL_PASS`**。（早先一版 86 条断言全绿的 `spot3.txt` ≡ `spot4.txt` = `8da0604a…` 也留着，那是 S9 之前的状态。）

**我自己踩了七个夹具坑，全都一度被我误当成"交付缺陷"，逐个查完才发现是我写错了**（记在这里是为了让下一轮别重犯，也是 §通用纪律「别过早点名元凶」的兑现）：① S1 的策略在任何人都能加注之前就比牌 ⇒ raise 永远观测不到，换成"按全局步数走"的策略；② S3 拿 `links[0]` 当行动方，可它根本不在回合上 ⇒ 按钮行只剩一个"等 X 行动"，改成取 `room.info().turn`；③ S3 伪造漏牌时用 `room.peek(foe)`，可 foe 自己的牌还是 `'unknown'` ⇒ 我什么也没"漏"（0 处），改成合成三张真牌面并先断言原格是 `unknown`；④ S3 伪造揭示时写 `value:'bogus'`，那撞的是 **schema** 那道闸而不是揭示核对（一次假通过），改成合法十六进制 + `party:'seat:N'` 并断言违规文本含 `reveal check failed`；⑤ 我自己一条弱断言 `buttons.length===1 && legal===false && cost===null` 在"等待按钮"上也成立 ⇒ 收紧成还必须 `.includes('已停手')`；⑥ S6 用 `sum(info.chips) + info.pot` 在手中间量守恒，把 ante 数了两遍（1539 vs 1536+3）且跨 5 手漂移 ⇒ 改成只在 settled 边界量 `sum(info.chips)`，并把 `handGapMs` 拉到 600000 钉住一手；⑦ S4 的对照组犯同一个错 ⇒ 改成真正的不变量"页面 total === 房间台账 total"。

分节要点（每节都打自己的断言数，0 断言的节按没跑成处理）：

| 节 | 打的是什么 | 关键实测 |
|---|---|---|
| S1 | §8.9(iii) 端到端价格诚实 | call 显示 2/日志 2、raise 2/2、compare 4/4；**对照组**：显示价 +1 后 5/5 条不再相等；`priceOf` 逐档 === 按钮 cost（look 0 / call 1 / raise 2 / fold 0 / compare 2）；A2 的 ①"金额不进可用性"成立（买不起也 `legal:true`） |
| S2 | D02 存活变异的等价性论证 | 4 座全宇宙 × 3 种庄家规则穷举 **22500** 组（2784 组 null），`nextDealerOf` 返回 `seated` 之外座位 **0** 组；`firstDealer=3` 且只有座位 0、1 入座 ⇒ 庄家被挪 3→0 且这一手真发出来了；**对照组**：`startHand` 在 `dealer 3 ∉ seats` 时抛 `TypeError: bad hand config: dealer 3 is not one of the seats`；出厂配置 `firstDealer=0` ⇒ 恒等变换 |
| S3 | 伪造下行 ⇒ violations ⇒ 停手 | 漏牌伪造被抓；假揭示被抓，违规原文 `reveal check failed: server revealed a share that does not open its commitment`；按钮换成唯一一个含"已停手"的不可点按钮；`act()` 拒发（`sent=false, why=turn is seat 1, not 0`） |
| S4 | 未覆盖分支到底可达不可达 | 未收到任何下行时 `snapshot()` 不抛：`started=false seats=0 buttons=0`、状态行「联机·未连接（新人）」、`total=0 pot=0 dealerRule='?' humanSeat=-1`（不是 0 号位那种"看起来像真的"的值）；离桌那一家是占位格：`status="本局不参与" cards="" hidden=true chips=0`，三家座位格都还在，页面没退回"未开局" |
| S5 | 畸形百分号转义 | `resolveStatic('/%zz')` 抛 `URIError`；**对照组** 正常路径 `ok:true`、`%00` 走 400 而不是抛；`serveStatic('/%zz')` 以异常收场；真 socket 上房间回 500 `room handler failed: URI malformed`，紧接着 `/health` 200、页面 200 ⇒ 房间进程没死 |
| S6 | 断线重连 | 台账 1536→1536、settle 后 pot 0、两家页面 total 都是 1536、座位以 `{"id":"r1","seat":1}` 绑回、零违规、`fault:null`；`bad_token` 一次性闩锁（第一条自动补 1 条 join，第二条补 0 条 ⇒ 不会被坏服务端打成 join 洪水）；`hello` 回来后 `staleToken` 提示消掉 |
| S7 | 两标签页存储 | 分开存储各留各的 token；共享存储 ⇒ 后入桌那页把前一页顶掉，页 0 刷新后会拿着页 1 的凭据回来（`e9ba5b849489…` vs 自己的 `acc8c851922f…`）⇒ 工单点名要 sessionStorage 的理由成立 |
| S8 | 交付面硬约束 | 两家都交齐才发牌（`missing:[]`）；两家都不交 ⇒ `phase=idle seated=[]`、绝不拿服务端单方份额开局、房间留了重试定时器；整手打完两家各自 `verifiedHand===1===hand`、零越界、`fault:null` |
| S9 | **未通过 schema 校验的下行是否仍触发不可逆动作** | 17 条断言 3 个对照组，见 §4 应修 4 |

**交叉验证**：我自己派的后台代理独立写了一份 `.audit/rev10/sup-spot-check.ts`（34KB，与我的实现无共享代码），三跑逐字节相同（`sup-spot-run1/run2/out1.txt` 各 730 字节），**74 条断言 0 失败**。重叠面：`view===null` 占位快照、cost===amount、离桌占位格、庄家挪位、买不起仍可点；它另加了两节我没有的：「sessionStorage 里存着坏 JSON 时不许把页面打死」与「买不起跟价的座位点下去收到服务端 reject」。两份独立工装同向 ⇒ 上面这些结论按 A 记。

### 2.2 真浏览器实机验收（§8.3 / §8.4 / §8.5）：`.audit/rev10/br-acceptance.txt`

**先说环境限制，它决定哪几条只能是 B 级**（我不拿"验不了"冒充"验过了"）：

- **L1 内置浏览器面板没有可见表面**：`take_screenshot` 直接报 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`（`viewport=0x0, visible=false, visibilityState=hidden`）⇒ **本轮没有截图**。页面证据来自 CDP 的 `take_snapshot`（可达性树）与 `evaluate_script`（读真实 DOM 与页面自己的 `window.__zjh3` 只读快照）。
- **L2** `window.innerWidth/innerHeight` 报 0，但文档**确实有真实布局**：body 531.2×557.6、`#board` clientWidth/Height = 526×501、`getBoundingClientRect` = (2, 54.4, 527.6, 502.8)、dpr 1.25。
- **L3** 由 L2 推出：canvas 526×501 < `MIN_VIEWPORT` 560×560（`webui/scene.ts:80`），所以 `buildScene` 走 `scene.ts:242-243` 的「窗口太小」分支 ⇒ **`__zjh3.hits().length === 0`（实测）**，画布按钮没有可点区域，`canvas click → hitAt → send` 这一层本轮无法验收。我改用 `__zjh3.click(intent)`，它调的就是 canvas click 处理函数调的同一个 `send(intent)`（`webui/main.ts:302-308` / `:341-343`），只差 `hitAt` 那一步坐标→意图映射 ⇒ 按 **B** 记。
- **L4** `navigate_page` 只能导航当前选中页（schema 里没有新建标签页的参数），注入 `<a target="_blank">` 再 `.click()` 也开不出第二页（`list_pages` 仍只有 1 页）⇒ **§8.5 的物理两标签页无法执行**，只验到机制层。

在这些限制内，实测结果如下（房间 `node netx/serve.ts 8790`，对手 `.audit/rev10/sup-bot.ts` 直连 8790，页面走真 socket）：

| 验收点 | 结果 | 实测 | 级 |
|---|---|---|---|
| 真页面入桌 | 过 | `#mode` 派发真实 `change` ⇒ 1.5s 后 `link:"open" seat:0 hasToken:true`，notice「监督甲 坐到 0 号位，带入 256」，`/health` 同步报 `connections:1` | A |
| 两手完整对局 | 过 | hand 1：看牌 + 比牌（开牌 `cmp=-1 loser=0(challenger)`）；hand 2：看牌 + 加注（`raise 出 8 @注级4｜stake 2→4`）；hand 6、hand 13 各一手比牌定胜负。看牌/加注/比牌三档都在真页面上落地过 | A（动作）/ B（未经 `hitAt`） |
| 结算面板 | 过 | hand 6 `phase=settled` 时抓到 4 行面板：「结束原因：其他人都不在了 → 不开牌通吃」/「监督甲[你]｜A♣ T♥ J♠ 单张｜没赢（现筹码 208）」/「监督乙[玩家]｜8♥ 9♦ 9♠ 对子｜赢 16（现筹码 263）」/「本局序号 8｜**揭示核对 通过**」；`revealedLine`、`settleSummary`、`ledgerLine`、`total=471=208+263` 全部自洽 | A |
| 第二手庄家推进 | 过 | hand 1 deal 行「监督甲 → 监督乙 … first=1」，hand 2「监督乙 → 监督甲 … first=0」，座位板 `marks:"庄"` 从座位 0 挪到座位 1 | A |
| Q4=B 托管可归因 | 顺带验到两次 | 我脚本超时没及时动手，30s 回合钟替我走：`#002 call … timeout→call dark×stake`、`#008 call … timeout→call seen×stake` ⇒ note 里带 `timeout→`，与自主跟注可区分 | A |
| §8.9(iii) 端到端价格诚实 | 过 | 真页面上 比牌按钮显示「（出 4）」cost=4 ⇒ 日志 `compare … 出 4`；hand 13 同样 显示 4 ⇒ 日志 4；加注显示 8 ⇒ 日志 8；看牌 cost 0 ⇒ 日志无金额 | A |
| 断线重连 + 台账守恒 | 过（有一处局限） | hand 7 进行中 `disconnect()` → `connect()`：`mode` 退回 solo、`netInfo()` 变 null；重连后 `seat 0` 绑回、`handIndex` 仍是 7、notice「监督甲 号位重连（hand=7, since=0）」、**total 471 === 471**、`ledgerLine` 逐字符相同、token 仍是原来那一个、日志被补齐成 #001–#004、`untrusted=false errors=[]`。**局限**：`backToSolo()` 先把 `sock.onclose` 置 null 再 close，所以这是一次干净关闭，不是网络被拔（CDP 的网络仿真未暴露）⇒ 这条按 **B** 记 | B |
| §8.4 真 socket 上伪造下行 | **过，本轮最硬的一条** | 我自己写了 TCP 透传代理 `.audit/rev10/br-mitm.ts`：页面改连 8791（只改 `#netUrl` 输入框的值，一个字没动交付代码），握手段逐字节透传（日志实测 `GET / HTTP/1.1` ↔ `HTTP/1.1 101 Switching Protocols`），服务端→客户端方向用 `netx/frames.ts` 的 `FrameReader({masked:false})` 解帧再 `encodeText` 重编 ⇒ 插入点严格落在帧边界上；客户端→服务端逐字节透传（保留掩码）。armed 之后改掉下一条真实 `reveal` 里 `shares[0].value` 的第一个十六进制字符（`a5cbdf…` → `f5cbdf…`，schema 完全合法、承诺开不出来）。真页面反应：`untrusted:true`；`#hint` 的 DOM 文本原文「⚠ 这一局不可信：reveal check failed: server revealed a share that does not open its commitment ⏎ 已停手：本页面不再向服务端发出任何行动」；五个动作按钮全部消失，只剩 `已停手：这一局不可信/legal=false/cost=null`；`verifiedHand` 退回 `null`；结算面板第 4 行由「揭示核对 通过」变成「揭示核对 **未通过**」。随后连点 look/call/fold 三次全部被拒，拒绝理由原文「没发出去：peer flagged the server: reveal check failed…」。**对照组**：同页面同房间同路径，未注入的 hand 1 与 hand 6 上 `untrusted=false errors=[] trustLines=[] verifiedHand=1/6`、面板写「揭示核对 通过」、5 个按钮 `legal=true` ⇒ 报警确实由那一个字符触发，不是"见东西就报"。另：注入只影响被代理的那一条连接（bot 直连拿到未改动的 reveal），所以这是"服务端对某一家单独撒谎"的场景，正是第二道墙要防的那个 | A |
| §8.5 两标签页各占一座 | **机制层过，物理层未验** | 真页面上 `sessionStorage` 只有一个键 `zjh-m5:session`（值含 token/seat/name/hand/share），**`localStorage` 入桌前、入桌后、重连后各查一次都是空**；源码侧对得上：`webui/main.ts:68-90` 的 `tabStore` 只碰 `window.sessionStorage`，注释还写明"隐私模式抛了就退化成只活到刷新，绝不偷偷改用全局存储"。加上我的 S7 rig（共享存储会串味）⇒ 机制成立。但**同一浏览器开两页各占一座这件事我物理上没做成**（L4） | B |

### 2.3 V8 块覆盖当可达性 oracle：`.audit/rev10/cov-report.mjs` → `cov-report.txt`（22 个文件 / 43 段未覆盖）

方法学沿用 rev=9 那条自己踩过的坑：V8 的 `ranges` 是嵌套的，**用并集算会得到"全部文件 100%"的假象**，必须按出现顺序把每段区间刷到同一张字符级标记表上让内层覆盖外层。后台代理独立写的 `sup-cov-report2.mjs` 得到同一批区间 ⇒ 交叉验证过（B）。

oracle 这轮兑现的两件事：

1. **§8.10 那条口径过了**：`netx/room.ts:295`（rev=9 我自陈漏掉的那条"剔除缺席家时若剔掉的正是庄家 ⇒ `startHand` 抛 TypeError ⇒ 抛出点在注入时钟回调里没人接 ⇒ 房间进程直接退出"）现在**有覆盖**（`room/29`，用例名里直接标了旧行为），不再是 count=0。
2. **`netx/ws.ts:143-149` 那个 try/catch 是 count=0，可它可达得不能再可达**：我在真 socket 上发一条 `GET /%zz` 就走到了（§2.2 之外，见 §3 必修 1 的 D2 实测：房间回 500 且活着）。这正是 rev=9 §5(c) 我点名"能在真 socket 上构造，建议下一轮补"的那一条，实现方这轮补了 `ws/06`，但补的不是这个分支 ⇒ 进 §4 应修 2。

### 2.4 你的变异表：22 条，21 caught、1 survived（D02）

D02（`nextDealerOf` 的写法变更）我按 §8 的规矩独立复核了等价性论证，**结论：等价性成立，但你的论证口径过宽**（见 §4 应修 5）。我的 S2 穷举 22500 组确认它从不越出 `seated`，也确认在出厂配置下它确实与旧写法恒等；但"恒等"只在 `startRoom` 硬编码的 `firstDealer: 0` 下成立 —— `createRoom({seats:6, firstDealer:3})` 且只有座位 0、1 入座时，`dealerAmong` 是**可观测**的（庄家 3→0，且没有它 `startHand` 就抛）。所以 D02 我接受为等价变异，但要求把配置前提写进 10-F。

## 3 · 必修（阻塞）：1 项

### 必修 1 · `webmin/serve.ts` 里两处未保护的 `decodeURIComponent`：一条未鉴权的 HTTP 请求就能打死进程

**位置**：`webmin/serve.ts:40`（`redirectTarget`）与 `webmin/serve.ts:48`（`resolveStatic`），两处都是裸调
`const raw = decodeURIComponent(requestUrl.split('?')[0] ?? '/');`

**实测复现（`.audit/rev10/br-webmin-{out,err}.log`，2026-09-28 22:18 新鲜跑的一次，21:33 那次是 `rep-webmin-*`，两次一致）**：

```bash
node webmin/serve.ts 8199 &                                  # SELF-REVIEW:328/405 自己推荐的"零依赖开页面"通道
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8199/webmin/index.html   # → 200（基线）
curl -s -o /dev/null -w '%{http_code}\n' --path-as-is 'http://127.0.0.1:8199/%00'  # → 400（对照组：NUL 那道 guard 是好的，不崩）
curl -s -o /dev/null -w '%{http_code}\n' --path-as-is 'http://127.0.0.1:8199/%zz'  # → 000（连接被丢，没有任何应答）
curl -s -o /dev/null -w 'alive=%{http_code}\n' --max-time 3 http://127.0.0.1:8199/webmin/index.html  # → alive=000，curl exit=7（connection refused）⇒ 进程已死
```

stderr 原文：

```
file:///F:/qoder/zjh/webmin/serve.ts:40
  const raw = decodeURIComponent(requestUrl.split('?')[0] ?? '/');
              ^
URIError: URI malformed
    at decodeURIComponent (<anonymous>)
    at redirectTarget (file:///F:/qoder/zjh/webmin/serve.ts:40:15)
    at serveStatic (file:///F:/qoder/zjh/webmin/serve.ts:77:14)
    at Server.<anonymous> (file:///F:/qoder/zjh/webmin/serve.ts:107:8)
Node.js v24.19.0
```

**机制**：`serve.ts:107` 是 `void serveStatic(req, res)`，而 `serveStatic` 是 async ⇒ 这个同步抛出的 `URIError` 变成**没人接的 promise rejection**，Node 24 默认 `--unhandled-rejections=throw` ⇒ 进程退出。调用点在 `try` 之前（`serveStatic:77` 调 `redirectTarget`，而那个 `try` 在 `:89` 才开始），所以文件里已有的错误处理一点都够不到它。

**为什么判必修，不判应修（我知道它是 M3 就有的老代码）**：

1. **触发面是外部的、未鉴权的、一条请求**：`webmin/serve.ts` 虽然只绑 127.0.0.1，但任何用户浏览的任意网页里放一个 `<img src="http://127.0.0.1:8199/%zz">` 就能把它打死（浏览器发跨源 GET 不需要 CORS 预检）。这不是"磁盘异常时才到达"的分支。
2. **它是交付文档主动推荐的运行方式**：`SELF-REVIEW.md:328/405` 两处写着 `node webmin/serve.ts 8133 # 零依赖通道：http://127.0.0.1:8133/webui/index.html`，`:559` 还把它算作 M3.2 的"推荐路径，未降级"。也就是说：交付面里有一个"照文档跑起来就会被一条 URL 打死"的进程。
3. **与我自己 rev=9 §8.10 立的口径一致**：那一轮我把"进程死掉且没有栈可查"从覆盖缺口升成必修级。这条比它更糟 —— 死因是外部可控的。同一条尺子必须量同一个方向，否则下一轮没人信我的定级。
4. **M5 扩大了它的暴露面**：`netx/serve.ts:51` 把 `serveStatic` 接成了房间的 `onHttpRequest`，于是同一条畸形 URL 现在也会打进 M5 的房间进程。房间活了下来，但那是**别人的 catch 救的**，不是这个函数自己正确：`netx/ws.ts:143-149` 把它接成 **500** `room handler failed: URI malformed`（实测：随后 `/health` 200、`/webui/index.html` 200、`/health` 报 `hand 14 phase betting fault:null`）。客户端发的畸形 URL 应当是 4xx，回 500 会让运维以为房间自己坏了 —— 防御放错了层。

**要求的改法（3 行，位置在 `webmin/serve.ts`，不是 `netx/ws.ts`）**：把 `decodeURIComponent` 的失败当成一次**正常的拒绝**处理，让它和已有的 `NUL in path` / `backslash in path` / `outside project root` 同一档：

- `resolveStatic`：`decodeURIComponent` 包 try/catch，失败返回 `{ ok:false, status:400, why:'malformed percent-escape' }`（和 `%00` 那条同形，测试也就同形好写）；
- `redirectTarget`：同样 try/catch，失败返回 `null`（它只是个"要不要 302"的判定，失败就是不重定向，随后交给 `resolveStatic` 去回 400）；
- 补两条用例：`resolveStatic('/%zz')` ⇒ `{ok:false,status:400}`（**不许抛**）、`serveStatic('/%zz')` ⇒ 回 400 且**不产生 rejection**；再加一条真 socket 的：`GET /%zz` ⇒ 400，紧接着 `/health` 仍 200。
- 附带效果：`netx/ws.ts:143-149` 那个 catch 就回到它该有的角色（只兜真正意外的服务端错误），500 这个错状态码同时消失。

**级：A**（两次独立复现、带对照组、带 stderr 原文、带"进程确实不在了"的 curl exit=7）。

## 4 · 应修（不阻塞，但 rev=11 请一并做掉）

1. **`netx/ws.ts:146-149` 零覆盖，而它在真 socket 上一条请求就能走到。** rev=9 §5(c) 我已经点过这条，这轮补的 `ws/06` 打的不是它。我的 oracle 报 count=0，我的实测（§3 必修 1 的 D2）证明它可达且行为正确（500 + 进程活着）。做法：在已有的真 socket 工装（`ws/03` 那一套）上让 `onHttpRequest` 抛一次，断言 400/500 应答与"连接不残留"。**必修 1 做完之后这条要故意制造异常才走得到，所以它反而更好写**（`onHttpRequest: () => { throw new Error('x') }`）。**A**
2. **`webui/scene.ts:379` 的「桌上总额」少算了离桌座位的筹码。** `webui/netplay.ts:462` 是 `total: cells.reduce((a, c) => a + (c.departed ? 0 : c.chips), 0) + view.pot`，而房间侧的账本**从不销账**：`netx/room.ts:463` `chips.set(free, up.buyIn)` 入桌即记账，`:344` `closeLedger` 只按本手在座者回写，全文 `grep chips.delete` **零命中**。所以离桌那家的筹码房间仍然欠着（它拿 token 回来就能续上），页面的「桌上总额」却不含它。真浏览器实测：hand 13 时页面 `total=456`（=193+263），而 seat 1、seat 2 都还留着筹码；我的 S4 rig 量到的是同一形状（房间台账 1536 vs 页面 1024，差额 512 恰好是那个离桌座位的筹码）。**这不是算错，是标签与口径不匹配**：要么把标签改成能自证范围的说法（例如「在场筹码」），要么把离桌格子计入总额并在 `ledgerLine` 里单列。**A**（页面侧与 rig 侧）+ **B**（房间侧余额由源码 grep + rig 推得）
3. **`webui/netplay.ts:211-222` 在 schema 那道墙**之前**解析原始 JSON 并据此做不可逆动作**，与本文件自己头部写的「本文件不实现任何协议细节 —— 下行一律交给 `netx/client.ts` 的 `peer.inbound`」直接矛盾。我的 S9（17 条断言 3 个对照组）实测：一条**不合 schema** 的 `{"t":"error","code":"bad_token"}`（缺 `why`）打进去，墙确实记下了违规（原文 `server sent an unparseable message: invalid message at "": missing key "why"`），**但页面仍然把存储里的凭据清掉了、并且仍然自动补了一条全新的入桌上行** —— 不可逆动作发生在墙报警之后但**不以墙为准**；反过来，一条**合法**的 `bad_token` 不产生违规、也不清凭据 ⇒ 副作用确实由裸 `code` 匹配触发，不是"见非法就清"。另外任何 `hello` 形状的消息都会清掉 `staleToken` 提示。可行的改法（我核过 `netx/client.ts:282-287`：`case 'error'` 会把消息推进 `errors`，只在 `code === 'leak_blocked'` 时才 violate）：把 `leakBlocked`/`replaced`/`staleToken` 三个状态改成在 `peer.inbound(text)` **之后**从 `peer.info().errors` 派生，`onText` 里那段 `JSON.parse` 整段删掉。这样"服务端说了什么"这件事只有一个来源。**A**
4. **§8.6 披露完整性：10-F 的"已知未覆盖"表对不上我的 oracle。** 两处差异：**(a)** `netx/serve.ts:76-121` count=0 但表里没列 —— 这条我**接受解释**（那是 `invokedDirectly` 的进程入口块，只在 `srv/03` spawn 出来的子进程里跑，进程边界 + `process.exit(0)` 不刷 V8 覆盖 ⇒ 我的进程内 oracle 看不见它；它也不是 `clock.after` 的回调，§8.10 不适用），但**表里要写上并给出这个理由**，否则下一轮我还得自己推一遍。**(b)** `webui/netplay.ts:303-325` 与 `:335-352` 是**可达但未覆盖**，而我的 S4 已经证明两处都可达（未开局占位快照 / 离桌占位格），并且真浏览器上我也走到了（§2.2 的 E1/E2）⇒ 这两处该补用例，不该留在表外。**A**
5. **D02 的等价性论证口径过宽**（`SELF-REVIEW.md` 10-F 写的"与旧写法恒等"）。等价性我接受，但请把配置前提写进去：恒等只在 `startRoom` 硬编码 `firstDealer: 0` 时成立；`createRoom({seats:6, firstDealer:3})` 且只有座位 0、1 入座时 `dealerAmong` 可观测（我的 S2 实测庄家 3→0、这一手照发；对照组：没有它 `startHand` 抛 `bad hand config: dealer 3 is not one of the seats`）。**A**（实测）+ **C**（要求本身是文书性的）
6. **两处小 nit（可以不改，但改了更整齐）**：`webui/netplay.ts:140` 的死三元 `let link: Link = saved !== null ? 'idle' : 'idle';`（两支同值）；`webui/netplay.ts:443` 把 `status` 与 `handIndex` 挤在一行。**A**

## 5 · 覆盖缺口（不阻塞；明细 `.audit/rev10/cov-report.txt`，逐行带源码文本）

- **(a) 已披露且我认可其"够不到"论证**：沿用 rev=9 §5(a) 那一类（自检对象是自己刚算出来的值 ⇒ 恒真）。
- **(b) `exhausted: never` 穷尽兜底**：类型层不可达，不算缺口，但请按 §8.6 一并写进 10-F 的表，让表与 oracle 输出对得上。
- **(c) 可达但没测**：`netx/ws.ts:146-149`（→ 应修 1）、`webui/netplay.ts:303-325` 与 `:335-352`（→ 应修 4b）、`netx/ws.ts` 的 pong/断开忽略/reader 抛错三条 socket 错误路径（rev=9 §5(c) 就点过，仍未补）。
- **(d) M5 变更面之外**：`webui/paint.ts`（Canvas 绘制层）等，记录备查，不属本轮验收面。

## 6 · 明确不算问题的（防止你返工过头）

1. **`nst/01`、`nst/04` 两条基线用例标题被改写：不算违规。** rev=9 §8.11 已经预授权（M5 把 `webui/netplay.ts` 纳进 `PORTABLE` 清单，标题必须跟着改）。我用 `.audit/rev10/baseline-ids.txt`（362 条）对 `current-ids.txt`（393 条）做集合差：**基线里没有任何编号消失，也没有断言被减弱**，362 + 31 新增 = 393。**A**
2. **房间在没人陪玩时 `hand` 索引一直往上跳（我的实测里从 3 跳到 9、11、13）：不是缺陷。** 那是 `netx/room.ts:274-278`「凑不齐最低人数 ⇒ 本局作废、挂 gap 定时器」在反复重试，每次作废都会占掉一个 hand 号。页面此时给的是 `view===null` 的占位快照（`seats=[]`、`total=0`、`ledgerLine=""`、`log=[]`），**没有编造任何数字**，与我的 S4 一致。**A**
3. **`evidence/m4-ws-interop.txt` 未重生成：接受**（理由同 rev=9 §1）。M5 新增的 `evidence/m5-browser-live.txt` 我没有拿它当验收证据 —— 按 §8.3 我的主证据是我自己开的那场（§2.2）。**B**
4. **`npm test` 比 `node test/run.ts` 多 4 行：不是输出不纯净**，多的是 npm 自己的横幅；两个命令各自双跑都逐字节一致，TEST-OUTPUT.md 把四个哈希都写全了（rev=9 应修 6 照办）。**A**
5. **真浏览器验收里没有截图：是我这轮的环境限制（L1），不是你的交付缺陷。** 我不把它记在你账上，也不拿它当不通过的理由 —— 但下一轮如果面板能打开，我会补截图。**A**
6. **上一轮我怀疑过、这轮撤回的（X）**：无。rev=9 §6.7 那条撤回维持撤回。

## 7 · 复审怎么复现（产物都在 `.audit/rev10/`，刻意不入 manifest、不在 `test/` 下）

```bash
cd /f/qoder/zjh
# ① 清单（从 DELIVERY.md 抽，不用交付方的现成文件）
grep -E '^[0-9a-f]{64}  ' DELIVERY.md > .audit/rev10/manifest-claimed.txt   # 74 行
sha256sum -c .audit/rev10/manifest-claimed.txt                              # 74/74 OK
# ② 双跑 + 类型
node test/run.ts > .audit/rev10/node1.txt 2>&1 ; node test/run.ts > .audit/rev10/node2.txt 2>&1
npm test          > .audit/rev10/npm1.txt  2>&1 ; npm test          > .audit/rev10/npm2.txt  2>&1
sha256sum .audit/rev10/{node1,node2,npm1,npm2}.txt ; npx tsc --noEmit ; echo "tsc_exit=$?"
# ③ 我的临场抽查（两跑必须同哈希，103 断言 0 失败）
node .audit/rev10/spot-check.ts > .audit/rev10/spot5.txt 2>&1
node .audit/rev10/spot-check.ts > .audit/rev10/spot6.txt 2>&1 ; sha256sum .audit/rev10/spot{5,6}.txt
# ④ V8 块覆盖当可达性 oracle
NODE_V8_COVERAGE=.audit/rev10/cov node test/run.ts > .audit/rev10/cov-test.txt 2>&1
node .audit/rev10/cov-report.mjs > .audit/rev10/cov-report.txt 2>&1
# ⑤ 必修 1 的复现（三次 curl，看第四个还活不活）
node webmin/serve.ts 8199 > .audit/rev10/br-webmin-out.log 2> .audit/rev10/br-webmin-err.log &
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8199/webmin/index.html      # 200
curl -s -o /dev/null -w '%{http_code}\n' --path-as-is 'http://127.0.0.1:8199/%00'     # 400（对照组）
curl -s -o /dev/null -w '%{http_code}\n' --path-as-is 'http://127.0.0.1:8199/%zz'     # 000
curl -s -o /dev/null -w 'alive=%{http_code}\n' http://127.0.0.1:8199/webmin/index.html # alive=000 ⇒ 死了
# ⑥ §8.4 的真 socket 注入（我自己写的中间人代理；证据全文在 br-acceptance.txt 的 C 组）
node netx/serve.ts 8790 &                       # 房间
node .audit/rev10/br-mitm.ts 8791 8790 &        # 代理：页面连 8791
node .audit/rev10/sup-bot.ts 8790 监督乙 8 &    # 对手（直连 8790，拿到的是未改动的下行）
# 浏览器打开 http://127.0.0.1:8790/webui/index.html，把 #netUrl 改成 ws://127.0.0.1:8791 后连上，然后：
printf '{"mode":"corrupt-reveal"}\n' > .audit/rev10/mitm-trigger.json   # armed：改下一条真实 reveal
# 打完一手 ⇒ 页面 hint 出现「⚠ 这一局不可信」，按钮只剩「已停手」，br-mitm.log 里有 original/modified 两行
```

关键哈希：测试 `9ced956780b1578eb25ab8c46dc90d4f6c4caa6bc6ea595b877c62740147dbc4`（`node`）/ `742e55c60b5adb0380aa454326d787b95817511b2d4a61ae4b9fbfb7acb8655c`（`npm`）；我的抽查 `32ea2929149b98cd06eb90ffae2fd101d2ba57cd4d0159f968bab22dd08e349c`。

## 8 · 下一轮（rev=11）验收口径

1. **必修 1 逐条销账**：`webmin/serve.ts` 两处 `decodeURIComponent` 包起来，`/%zz` ⇒ **400**（不是 500、不是抛），并补 §3 要求的那三条用例。我会重跑 §7 ⑤ 那四发 curl，第四发必须是 200。
2. **硬闸门照旧三件** + **M5 的 393 条零回归**（基线编号集合差我要再算一次，消失的编号必须逐个解释）。依赖面一字不改。
3. **应修 1–6 逐条销账**，其中应修 3（`onText` 那段 `JSON.parse` 删掉、三个状态改从 `peer.info().errors` 派生）我会重点看：改完之后我的 S9 那 17 条断言里有两条**必须翻面**（"凭据仍然被清掉"和"仍然自动补 join"应当变成"不被清"和"不补"），如果你的实现让它们还是老样子，说明墙仍然没接管这条路径。
4. **§8.4 我会再注入一次**，但换个注入点：这轮我改的是 `reveal` 的份额，下一轮我改 `patch`（例如把某一家的 `chips` 或 `pot` 改掉，或往我的 view 里塞对手的牌面），看第二道墙是不是只认揭示这一条路。代理已经写好，换 payload 是几行的事。
5. **如果内置浏览器面板能打开（窗口 ≥ 600px 宽）**，我会补三件本轮做不到的事：截图、真实鼠标点画布按钮（走 `hitAt`）、同一浏览器两标签页各占一座。这三件本轮按 L1/L3/L4 记为环境限制，不计在你账上，也不代表我放弃了它们。
6. **我不再全量重审 M4/M5 已 PASS 的面**：只在硬闸门与零回归层面复核。rev=11 的重心是必修 1 与应修 1–6。

---

# 附：rev=9 复审裁定（历史，保留备查 —— 已被上面的 rev=10 裁定取代）

- **rev: 9**（对应工单 §4 "M4 联机"；DELIVERY.md `rev: 9`、`builtAt: 2026-09-27T21:26:24+08:00`）
- **结论：通过（PASS）**
- **裁定时间：2026-09-27T22:40+08:00**（全量复审：manifest 重算两次 + `node test/run.ts` 与 `npm test` 各双跑 + `tsc --noEmit` + 通读 rev=9 改动的 8 个生产源文件 + 我自己写的 184 条断言临场抽查 + 我自己搭的 7 条变异沙箱 + V8 块覆盖当可达性 oracle）
- **批准范围：M4 联机 PASS。裁定当时工单 §4 路线图止于 M4、没有 M5 的范围定义，我没有替工单发明里程碑；用户于 2026-09-28 授权监督方定义 ⇒ M5「联机可玩」的范围与验收标准已写入 BRIEF.md §4，顶部批准行已推进到 M5。**
- **rev=8 的 5 条必修、5 条应修：全部做掉，且我逐条独立验证（不只是看你写了）。本轮无阻塞项。**
- 证据分级沿用上一轮：**A** = 我实测可复现（附命令/产物）；**B** = 我的工具已交叉验证；**C** = 我的解读；**X** = 撤回。

## 0 · 一句话结论

**五必修五应修全部落地并且经得起我反向改回去（Z1–Z5 逐条被你的用例抓住）；两条存活变异我用 V8 块覆盖 + 自己重跑一遍确认为等价变异；服务端 commit-reveal 多方合成、Q4=B 托管语义、零依赖手写 WebSocket 三条硬约束独立复核成立。本轮零必修，M4 判 PASS。**
唯一需要你注意的不是代码，而是流程：工单里没有 M5，我不会替你定义范围。

## 1 · 硬闸门（工单 §0.7）逐条结果

| 闸门 | 结果 | 我的证据（不是抄你的） | 级 |
|---|---|---|---|
| manifest 逐文件 sha256 可复算 | 70/70 OK，**审前审后各跑一次都 OK** | `sha256sum -c .audit/rev9/manifest-claimed.txt` → `.audit/rev9/manifest-recheck.txt`、`manifest-recheck-final.txt`（各 70 行 `: OK`）。清单从 DELIVERY.md 用 `grep -E '^[0-9a-f]{64}  '` 抽出，不靠你给的现成文件 | A |
| 交付后未改动任何 manifest 文件 | 通过 | 同上：我这轮全部产物都写在 `.audit/rev9/`，变异实验在 `.audit/rev9/mut/` 沙箱里做、跑完即删（`mutate.py` 末尾 `shutil.rmtree`），交付目录一字未动；审后重算仍 70/70 OK | A |
| 测试双跑逐字节一致 | 通过 | `node test/run.ts` ×2 → 461 行，sha256 `8d172a35494ad77b32057c0ee86522df2df6c2644f9cb2ddb01d15d2dc177a7d`（`.audit/rev9/node1.txt`≡`node2.txt`），**与 DELIVERY.md 声明的哈希逐字符相同**；`npm test` ×2 → 465 行，sha256 `e838e88409a8849bc6b42862ab10714995d9de97bb44f75c9d5672b473465f96`（`npm1.txt`≡`npm2.txt`） | A |
| 结论行 | `RUNNER files=27 cases=362` / `SUMMARY pass=362 fail=0 total=362` / `RESULT=ALL_PASS` | `.audit/rev9/node1.txt` 末尾三行 | A |
| `npx tsc --noEmit` 零输出 | 通过 | `.audit/rev9/tsc.txt` 为 **0 字节** | A |
| 运行时依赖为空 | 通过 | `package.json` **没有 `dependencies` 字段**（Q5 裁定"缺省 ≡ 空对象"）；devDependencies 只有 `@types/node`/`typescript`/`vite`，全在白名单内；`nst/07` 断言 `'ws' in (pkg.dependencies ?? {}) === false`（test/netx-static.test.ts:117-118）仍在 | A |
| 可移植层无真实时钟/随机/IO | 通过 | 我自己 grep 全部产品目录（命令见 §7）：命中只有 `netx/ws.ts`（node:http/crypto/stream + `setTimeout`，socket 边界层，`nst/03` 的 PORTABLE 清单本就不含它）、`webmin/serve.ts`（M3 本地服务）、`webui/main.ts:18`（M3 就写明的唯一可碰 DOM/时钟的一层）。`src/**`、`netx/` 六个可移植文件、`webmin/model.ts` **零命中** | A |
| 种子必须多方合成，单方选种子 = 不合格 | 通过 | 房间侧 `sendCollect`（netx/room.ts:220-225）先发 `commit` 再发 `collect`，`handleNonce` 只在 `collect` 阶段收（:481-503），凑齐才 `deal`（:501）；客户端侧我亲手驱动 `createPeer` 复核：没见过承诺就收份额 ⇒ 违规且不交（我的 S1，与 client/01 独立同形）；局末 `reveal` 带全部份额，四家各自复算同一颗种子（evidence/m4-ws-interop.txt：`甲=乙=丙=丁=3907236537`） | A |
| 证据文件未重生成是否仍有效 | 有效 | `evidence/m4-ws-interop.txt` 哈希与 rev=8 相同（不在变更清单里）。两条理由：①那场实测 `turnMs=600s`，全程不靠超时 ⇒ Q4 语义改动不在里面留痕；②必修 4 换了定序键，但那场的 party 集合是 `server`/`seat:0`/`seat:1`，两把尺在其上不分叉（我的 S2 实测：`prodOld === prodNew`，且这三家名字互不为前缀 ⇒ 与 value 无关地不分叉）⇒ 那颗 3907236537 在新代码下仍可复算 | B |
| 测试输出无时间戳/无随机顺序 | 通过 | 双跑逐字节一致本身就排除了这两条（461 行全同） | A |
| 五个协议文件不入 manifest | 通过 | `grep -E 'DELIVERY\|REVIEW\|QUESTIONS\|ANSWERS\|BRIEF' .audit/rev9/manifest-claimed.txt` 只命中 `SELF-REVIEW.md`（它本来就是交付文档） | A |

**变更面（我自己按 rev=8/rev=9 两份清单算的差集，不抄你的 §9.9）**：新增 1 个（`test/engine-timeout.test.ts`），内容变更 19 个 = 生产码 8（`netx/client.ts`、`frames.ts`、`room.ts`、`seed.ts`、`sha256.ts`、`ws.ts`、`src/engine/actions.ts`、`src/engine/validate.ts`）+ 测试 9 + 文档 2（`SELF-REVIEW.md`、`TEST-OUTPUT.md`）。删除 0 个。8 个生产文件我逐个通读过（下一步 §3 的逐条定位就是通读的产物）。**`src/engine/state.ts` 未在变更清单里，与我上一轮读到的内容一致** —— 托管语义确实只落在 `actions.ts` 一个点上，符合 Q4 裁定的"单点映射"要求。**A**

## 2 · 我不只是重跑了你的测试

### 2.1 我自己写的临场抽查：`.audit/rev9/spot-check.ts`（184 条断言，三跑逐字节相同）

不复用你的 `test/netx-fixtures.ts`：自带假时钟（只有 `after()` + 观测面）、自带 `node:net` 裸 socket 握手驱动、自己搭引擎驱动器。三跑 sha256 全为 `897c2f82f82f8db6d00eb7f39fa6c81783356fd80b9114cc16ecb247585e36d3`（`spot-run1/2/3.txt`）。每节断言数（0 断言的节视为没跑成）：

| 节 | 打的是什么 | 断言数 |
|---|---|---|
| S1 | 必修 1：承诺写一次。主案 = 收完份额后改口 + 配一份自洽假揭示 ⇒ 违规、`committed` 不被覆写、`verifiedHand===null`、`act()` 停手。**对照组 5 个**：只换份额（承诺门独立可抓）、同值重发 ×3（不误伤 catchup）、诚实揭示（`verifiedHand===1`，证明门没把正常路径堵死）、换局重开账、客户端 party 混入 commit | 19 |
| S2 | 必修 4：单一码点排序键。`seedVector` 与 `canonicalShares` 同尺；mulberry32 生成 24 种乱序输入 ⇒ seed 与 commit 数组逐字节不变；**手工复算**证明"按 `party=value` 拼接串排"与"按 party 排"在 `seat:1`/`seat:10` 上分叉且摘要不同（洞是真的）；`localeCompare` 在大小写混排上也分叉；生产集合 `server`/`seat:0`/`seat:1` 两把尺一致 ⇒ 已交付种子不动 | 59 |
| S3 | 必修 5：Q4=B。全员托管 ⇒ `awaitingSettle` + `terminal.reason='stall'` + 9 条 `timeout→` note + 筹码守恒 900；明/闷跟价各自等于 `callPrice`（且两者不等，不是同一断言跑两遍）；付不起 ⇒ `timeout→fold`、`chips===0`、`committed===ante`、与自主弃牌只差 note；无 look/raise/compare、无人 `looked`；自主跟注 note 不含 timeout（可归因性）；越界托管照拒 | 27 |
| S4 | 必修 3 + 手写密码学。RFC 6455 §1.3 公开向量 `s3pPLMBiTxaQ9kYGzzhZRbK+xOo=` 命中 + 一字之差的负对照 + 非 ASCII key 被拒；`sha1`/`sha256Hex` 与 `node:crypto` 差分（14 个输入，跨 55/56/63/64/119/120 填充边界 + CJK + 代理对） | 36 |
| S5 | 必修 2 + 房间定时器卫生（真房间、我自搭的时钟）。4 家入座 3 家交份额 ⇒ 到点踢人发牌、`seated===[0,1,2]`、`missing===[]`、**`live()===1`（只剩回合定时器）**；发牌后再交份额 ⇒ `nonce_late` 且不挂新定时器；ping→pong；`dispose()` 后零残留。对照组 A：四家全交 ⇒ 不推进时钟立即发牌。对照组 B：两家桌只交一家 ⇒ 本局作废、`hand===0`、挂 gap 定时器、到点重开为 hand 2 | 30 |
| S6 | 真 socket 握手（`node:net` 裸打回环端口）。版本 8 ⇒ `426 Upgrade Required` + `Sec-WebSocket-Version: 13`、不含 425；缺版本字段 ⇒ 400；合法 ⇒ 101 + Accept 向量；**三次非法握手零连接残留、房间不成 fault** | 13 |

**S6 的一个第一手发现（A）**：我按"缺 Upgrade 头 ⇒ 应当 400"去断言，实测拿到的是 **404**（Node 的 http 层根本不给这类请求派发 `upgrade` 事件，`ws.ts:143-152` 那两道 guard 排在其后）。这独立印证了你 SELF-REVIEW 9-D 表里那条披露，也说明你没有为了"让它看起来被抓"去伪造请求 —— 这条我记作**你的披露与我的实测一致**，不是缺陷。

### 2.2 我自己搭的变异沙箱：`.audit/rev9/mutate.py`（7 条，日志 `.audit/rev9/mutation-log.txt`）

不碰交付文件：每条变异都先把 `src/netx/test/webmin/webui + package.json/tsconfig.json/vite.config.ts` 拷进 `.audit/rev9/mut/`，在沙箱里改、在沙箱里跑 `node test/run.ts`，跑完删沙箱。基线（未变异沙箱）= `pass=362 fail=0 ALL_PASS`，先确认沙箱本身是干净的。

| 我的变异 | 改的是 | 结果 | 抓它的用例（沙箱里真实的 FAIL 行） |
|---|---|---|---|
| Z1 必修 1 回退：承诺可覆写、不报违规 | `netx/client.ts` | **被抓** fail=2 | client/12、client/13b |
| Z2 必修 4 回退：`canonicalShares` 改按 `party=value` 拼接串排 | `netx/seed.ts` | **被抓** fail=1 | seed/14 |
| Z3 必修 5 回退：托管一律弃牌（Q4=A 复辟） | `src/engine/actions.ts` | **被抓** fail=8 | illegal/13、timeout/01、timeout/03、timeout/04、timeout/06、room/07 等 |
| Z4 必修 3 回退：版本不支持回 425 且不带版本头 | `netx/ws.ts` | **被抓** fail=2 | ws/03、ws/05 |
| Z5 必修 2 **反证**：把删掉的那两行"重新武装 nonce 定时器"加回去 | `netx/room.ts` | **被抓** fail=1 | room/25（④ 那条 `clock2.pending() === 1`） |
| Z6 复核你的存活变异 C20：摘掉 `client.ts` 合并条数那道闸 | `netx/client.ts` | **★存活** pass=362 | 无（与你的结论一致） |
| Z7 我补的一条：nonce 截止时不踢掉没交份额的那一家 | `netx/room.ts` | **被抓** fail=2 | room/10、room/25 |

**Z5 是本轮最有价值的一条，它推翻了你自己注释里的说法（C，实测依据 A）**：`netx/room.ts:280-282` 的注释写的是那两行"在这套构造下永远够不到（V8 块覆盖亦为零），留着只会让人误以为这里还有一道闸门"。实测把它们加回去**会被 `room/25 ④` 抓到** —— 因为重武装会留下一只多余的定时器，`clock2.pending()` 从 1 变 2。也就是说：**回调体确实够不到（`onNonceDeadline` 的 `h.phase !== 'collect'` 守卫会直接 return），但"重武装"这个动作本身是可观测的定时器泄漏。** 删掉它是对的，理由比注释写的更强。建议 M5 顺手把这句注释改准（见 §4 应修 5）。

### 2.3 V8 块覆盖当可达性 oracle：`.audit/rev9/cov-report.mjs` → `cov-report.txt`

方法学提醒（**这条是我自己踩的坑，写下来防止下一轮重犯**）：V8 的 `ranges` 是嵌套的，最外层是整个函数体且 `count>0`，内层才可能是 `count=0` 的分支。**用并集算会得到"全部文件 100% 覆盖"的假象**（我的第一版就是这么错的）。正确做法是按出现顺序把每段区间刷到同一张字符级标记表上，让内层结论覆盖外层。修正后的结果：

| 文件 | 可执行行 | 已覆盖 | 未覆盖区间数 |
|---|---|---|---|
| netx/client.ts | 282 | 277 (98.2%) | 2 |
| netx/frames.ts | 374 | 371 (99.2%) | 2 |
| netx/protocol.ts | 485 | 480 (99.0%) | 2 |
| netx/room.ts | 606 | 582 (96.0%) | 8 |
| netx/seed.ts | 112 | 112 (100%) | 0 |
| netx/sha256.ts | 113 | 113 (100%) | 0 |
| netx/ws.ts | 221 | 209 (94.6%) | 5 |
| src/engine/actions.ts | 160 | 157 (98.1%) | 1 |
| src/engine/state.ts | 266 | 261 (98.1%) | 3 |
| src/engine/validate.ts | 149 | 149 (100%) | 0 |
| src/engine/project.ts | 62 | 62 (100%) | 0 |

（`src/cards.ts`、`src/engine/settle.ts`、`src/rules.ts`、`webmin/*`、`webui/*` 的明细在 `cov-report.txt` 里，逐行带源码文本。）

**oracle 的用途兑现**：`netx/client.ts:96-97` **零覆盖** ⇒ 你为 C20 存活所做的"按构造够不到"论证，前提被客观证实了（不是"我想不出用例"）。加上我 Z6 亲手重跑一遍也存活，这条等价变异我接受。**A+B**

## 3 · 必修（阻塞）：**本轮 0 项**

rev=8 那 5 条的逐条销账（每条都给"我读到的位置"+"我的独立验证"）：

| rev=8 必修 | 落地位置（我通读确认） | 我的独立验证 | 级 |
|---|---|---|---|
| 1 承诺存储每 (hand, party) 写一次 | `netx/client.ts:154-158`：`const seen = commitments.get(...)`；`undefined` 才写，`seen !== msg.commit` 才 `violate(...)`，**没有 `set` 覆写路径**；`enterHand` 换局清账 | S1 主案 + 5 个对照组（19 条断言）；Z1 反向改回去被 client/12、client/13b 抓住 | A |
| 2 删掉 `onNonceDeadline` 里那两行死代码 | `netx/room.ts:279-287`：现在是 `h.expected = left.map(...).sort(); sendCollect(h); drop(nonceCancel); nonceCancel = null; deal(h);`，重武装两行已不存在 | S5 主案断言到点发牌后 `live()===1`；Z5 把两行加回去被 room/25④ 抓住（并因此发现你的注释口径偏保守，见 §2.2） | A |
| 3 版本不支持 ⇒ 426 + `Sec-WebSocket-Version: 13`；缺版本 ⇒ 400 | `netx/ws.ts:154-166`：`version === ''` → 400；`version !== '13'` → `'HTTP/1.1 426 Upgrade Required\r\nSec-WebSocket-Version: 13\r\n...'`；`handshakeAccept` 抛错 → 400（:167-175） | S6 真 socket 实测三种应答各归其位、425 不出现、非法握手零连接残留；Z4 改回 425 被 ws/03、ws/05 抓住 | A |
| 4 单一排序键（码点序）取代 localeCompare | `netx/seed.ts:73-75` 定义 `byCodepoint`；`:92` `canonicalShares` 按 party 排（注释交代了为什么不能排拼接串）；`:126` `seedVector` 同一把尺；`netx/room.ts:625` 连接清单也换成它（应修 5 一并做掉） | S2（59 条断言）：同尺、24 种乱序不变、两种旧排法的分叉与摘要差异都手工复算过、生产集合不分叉；Z2 改回拼接串排被 seed/14 抓住 | A |
| 5 Q4=B 托管语义（单点映射在引擎） | `src/engine/actions.ts:101-107`：`case 'timeout'` → `canAffordCall` ? `doCall(state, seat, 'timeout→call ')` : `doFold(state, seat, 'timeout→fold')`；`doCall` 的 note 拼成 `timeout→call dark×stake` / `seen×stake`；**没有** look/raise/compare 分支；`src/engine/validate.ts:73-77` 注释同步；房间层仍只注入 `{kind:'timeout',seat}`（`netx/room.ts:212-215`），不是 `{kind:'call'}` ⇒ 可归因性保住了 | S3（27 条断言）含"自主跟注 note 不含 timeout、两条路径除 note 外逐字节相同"这条可归因性对照；Z3 改回一律弃牌炸 8 条用例 | A |

rev=8 的 5 条应修也全部做掉：`netx/frames.ts:3` 注释改指 Q5 裁定；`netx/sha256.ts:5` 指向 `test/netx-crypto.test.ts`；`test/static.test.ts:95-100` 注释改成"dependencies 字段整体缺省 ≡ 空对象"；`Clock` 接口只剩 `after()`（`netx/room.ts:37-39`、`netx/ws.ts:46-54`），夹具自己的 `now()` 作为观测面保留并在 `test/netx-fixtures.ts:14-16` 写明；`netx/room.ts:625` 连接清单改 `byCodepoint`（并有 room/26 用大小写混合 id + "两套键必须分叉"的前提断言守住）。**A**

§8.3 点名的两条必补覆盖也在：`client/15`（logShape 三道闸门 + 信封对账，四道报错文本互不相同用 `Set.size===4` 钉住 —— 这正是我上一轮要的"变异可分辨"）、`room/21`（应用层 ping→pong 端到端，rev=8 的零覆盖缺口）。**A**

## 4 · 应修（不阻塞 PASS，rev=10 或下一里程碑首轮一并做掉）

1. **`netx/room.ts:100-110` 构造期两道 `TypeError` 零覆盖**（座位数越界 / `firstDealer` 不在名单里）。可达且极便宜：两条 `assert.throws(() => createRoom({...}), /room needs|is not a seat of this room/)` 就够。**A**（cov-report.txt）
2. **`netx/room.ts:274-278`「能开局的人不够 ⇒ 本局作废、挂 gap 定时器」零覆盖。** 你的 room/10 走的是"剔掉一家还剩两家 ≥ min"这条臂，另一条臂没人测。**行为我已实测正确**（我的 S5 对照组 B：两家桌只交一家 ⇒ `phase='idle'`、`hand=0`、`live()===1`、推进 6000ms 后重开为 hand 2、重新收份额），所以不阻塞；请把这段移植成正式用例。**A**
3. **`netx/protocol.ts:463-464`（入参既不是 JSON 文本也不是对象）零覆盖**；同类还有 `netx/ws.ts:94`（线上 pong 帧：room/21 只到房间层，没过 socket）。**A**
4. **自我决定 ② 接受，但请把口径写进代码注释**：`handshakeAccept` 维持"存在即可见 ASCII 1..128、不校验是不是 16 字节 base64"。裁定理由：RFC 6455 §4.2.2 只要求该字段存在，值的形状是客户端的事；放宽不产生可利用面（Accept 由 SHA-1 派生，伪造 key 只会让攻击者自己握不上手），而且 `ws.ts` 的 key 校验失败路径本来就有 400 兜底。**但**请在注释里写明"若将来前置代理会重写头，需收紧到严格 24 字符 base64"，并记进下一轮待办。**C**（裁定）+ **A**（我实测过 `handshakeAccept` 对 129 字符与非 ASCII 都抛 `FrameError`）
5. **把 `netx/room.ts:280-282` 的注释改准**：真实理由不是"永远够不到"，而是"回调体够不到，但重武装会留下一只多余定时器（room/25④ 守着）"。注释是交付物，口径错了下一轮还会有人来问。**A**（Z5 实测）
6. **自我决定 ⑧ 接受（已证成为 moot）**：你按 `node test/run.ts` 取哈希、理由是 `npm test` 末尾会追加版本提示行。我两条命令各双跑，**在我的环境里都逐字节一致**（差 4 行 = npm 的提示，正文相同），且你的 `node` 哈希与我实测完全相同 ⇒ 无论按哪种读法，§8.4 都满足。以后照此办理，但请在 TEST-OUTPUT 里继续把两个哈希都写上。**A**
7. **小 nit（可以不改）**：`netx/room.ts:283` 的 `left.map((s) => partyOfSeat(s)).sort()` 用的是 `Array#sort` 默认键。对 ASCII party 名它与 `byCodepoint` 等价（都按 UTF-16 码元比），所以不构成缺陷；但若你要"全仓一把尺"，这里顺手换掉更整齐。**C**

## 5 · 覆盖缺口（不阻塞；明细在 `.audit/rev9/cov-report.txt`，逐行带源码文本）

- **(a) 你已披露、且我认可其"够不到"论证**：`client.ts:96-97`（合并条数 = seq；**oracle 实测零覆盖**，且 K01–K04 说明它是纯后备）、`room.ts:171-174`（出口防泄漏自检）、`room.ts:314-320`（揭示前自检两条）、`room.ts:341-343`（引擎拒自己刚产出的行动）、`ws.ts:149-152`（Connection guard，Node http 派发不到）、`frames.ts:163`（载荷超 `MAX_SAFE_INTEGER`）、`frames.ts:242-243`（close reason 非 UTF-8）。这些的共同结构是"自检对象是自己刚算出来的值"⇒ 恒真，与 rev=8 我认可的 R05/R13 同档。**B**
- **(b) 未披露、但属同一类（`exhausted: never` 穷尽兜底）**：`client.ts:250-252`、`protocol.ts:207-209`、`room.ts:575-576`、`src/engine/actions.ts:158-160`、`src/engine/state.ts:149-151`。类型层就不可达，**不算缺口**，但下一轮请在 SELF-REVIEW 的已知未覆盖表里把它们一并列上（表要能对上 oracle 的输出，我核对起来才不用猜）。**A**
- **(c) 未披露且可达**：`room.ts:102-110`、`room.ts:274-278`、`protocol.ts:463-464`、`ws.ts:75-77`（服务端自产非法消息 → 1011）、`ws.ts:94`（pong）、`ws.ts:110-111`（断开流程中忽略）、`ws.ts:203-204`（reader 抛错 → 1002）。M4 面内的已进 §4 应修 1–3；`ws.ts` 那四条是 socket 层的错误路径，能在真 socket 上构造（`ws/03` 已经会打真 socket），建议下一轮补。**A**
- **(d) M4 变更面之外**：`src/engine/state.ts:122`、`:280`、`src/engine/settle.ts:71-72`、`src/rules.ts` 3 段、`webmin/model.ts` 6 段、`webmin/serve.ts` 1 段、`webui/paint.ts` 2 段（该文件 81.0%，是 Canvas 绘制层）、`webui/scene.ts` 2 段、`src/ai/honest.ts` 1 段。不属于本轮验收面，记录备查。**A**

## 6 · 明确不算问题的（防止你返工过头）

1. **两条存活变异 C20 / R19b 都接受为等价变异。** C20：oracle 零覆盖 + 我 Z6 重跑同样存活 + K01–K04 说明前三道闸已蕴含它。R19b：`FakeClock.advance` 是先 `splice` 再调 `fn`，所以 `drop(nonceCancel)` 在那条路径上是 no-op —— 而且 `netx/ws.ts:46-54` 的真时钟同理（`clearTimeout` 一个已触发的表也是 no-op），**两种 Clock 实现下都等价**；它有意义的孪生 R19 被 room/18 抓住，我的 Z5 进一步说明"重武装"变体也被 room/25④ 抓住。**A+B**
2. **rev=8 那 76 条变异没有重跑：接受。** 你在 §9.7 口径说明里写明了限制，并且这轮把工装脚本留在 `.scratch/`（我已确认 `r9-mutate{,2,3,4,5}.mjs` + 5 份 out 都在）。"未被改动的面由 362 条全绿间接保证，这句话的强度到此为止"这个自我限定我认可 —— 别把它写成更强的话。**A**
3. **`room/07` 从三家改两家：接受。** 环线工装下房间在两家份额齐时就发牌，第三家只能中途入座，这是工装事实不是特判；三家全程托管（9 次行动、终局 stall）在 `timeout/01` 里，我的 S3 独立复现了同一组断言。**A**
4. **`evidence/m4-ws-interop.txt` 不重生成：接受**（理由见 §1 倒数第三行）。**B**
5. **`webui/main.ts:18` 的 `performance.now()` 不是违规**：M3 就写明这是唯一可碰 DOM/时钟的一层，且 `scene.ts` 只把它当入参。**A**
6. **`npm test` 比 `node test/run.ts` 多 4 行不是"输出不纯净"**：多的是 npm 自己的版本提示，不是你的测试打的；两个命令各自双跑都逐字节一致。**A**
7. **上一轮我怀疑过、这轮撤回的（X）**：`test/netx-room.test.ts:505/512` 里出现的 `clock.now()` —— 那是夹具自己的观测方法，不是注入给房间的 `Clock` 接口（接口里已经没有 `now`），`tsc --noEmit` 零输出也从类型面证实。我上一轮的备注不构成问题，**撤回**。**X**

## 7 · 复审怎么复现（我的产物都在 `.audit/rev9/`，刻意不入 manifest、不在 `test/` 下）

```bash
cd /f/qoder/zjh
# ① 清单（从 DELIVERY.md 抽，不用交付方的现成文件）
grep -E '^[0-9a-f]{64}  ' DELIVERY.md > .audit/rev9/manifest-claimed.txt   # 70 行
sha256sum -c .audit/rev9/manifest-claimed.txt                              # 70/70 OK
# ② 双跑 + 类型
node test/run.ts > .audit/rev9/node1.txt 2>&1 ; node test/run.ts > .audit/rev9/node2.txt 2>&1
npm test          > .audit/rev9/npm1.txt  2>&1 ; npm test          > .audit/rev9/npm2.txt  2>&1
sha256sum .audit/rev9/{node1,node2,npm1,npm2}.txt
npx tsc --noEmit > .audit/rev9/tsc.txt 2>&1 ; wc -c .audit/rev9/tsc.txt      # 0 字节
# ③ 我的临场抽查（三跑必须同哈希）
node .audit/rev9/spot-check.ts > .audit/rev9/spot-run1.txt 2>&1 ; cat .audit/rev9/spot-run1.txt
# ④ V8 块覆盖当可达性 oracle
NODE_V8_COVERAGE=.audit/rev9/cov node test/run.ts > .audit/rev9/cov-test.txt 2>&1
node .audit/rev9/cov-report.mjs > .audit/rev9/cov-report.txt 2>&1
# ⑤ 我的变异沙箱（在 .audit/rev9/mut/ 里改，跑完自删；约 3 分钟）
python .audit/rev9/mutate.py > .audit/rev9/mutation-log.txt 2>&1
```

关键哈希：测试 `8d172a35494ad77b32057c0ee86522df2df6c2644f9cb2ddb01d15d2dc177a7d`（`node`）/ `e838e88409a8849bc6b42862ab10714995d9de97bb44f75c9d5672b473465f96`（`npm`）；抽查 `897c2f82f82f8db6d00eb7f39fa6c81783356fd80b9114cc16ecb247585e36d3`。

## 8 · 下一轮验收口径

**裁定当时工单 §4 路线图止于 M4，我没有替工单发明里程碑；用户于 2026-09-28 授权监督方定义 ⇒ M5「联机可玩」的范围与验收标准已写入 BRIEF.md §4，顶部批准行同步推进到 M5。** 下面是我复审 rev=10 时的具体口径（比工单更细，先写在这里免得又返工）：

1. **硬闸门照旧三件**：manifest 重算 + 双跑逐字节一致 + `tsc --noEmit` 零输出；`npm test` 仍单命令，**M4 的 362 条零回归**。依赖面一字不改（devDeps 白名单不扩），`nst/07`（断言没装 `ws`）与 `static/06` 保留。
2. **复用而不是重写（这条我按结构性问题处理，不是应修）**：浏览器侧的越界检查必须来自 `netx/client.ts` 这**一个**文件。我会 grep `webui/` 里有没有第二份协议实现（`checkDown`/`logShape`/`commitOf`/揭示核对的复制粘贴）；出现第二份 = 两套越界检查 = 必然漂移，直接打回。
3. **我的主证据是真实浏览器，不是你的测试**：我会用浏览器自动化开两个标签页连同一个房间，打完两整手（含一次看牌、一次加注或比牌、结算面板、第二手庄家推进）并截图留证；然后杀掉一个连接、重连，核对局面接得上且台账守恒。你的自动化用例照写，但我不拿它当验收。
4. **伪造下行注入要在真页面上生效**：我会在真 socket 上（不是在你的 rig 里）塞一条改过的 `patch`/`reveal`，要求 UI 当场显示"这一局不可信"并停手。若这个行为只在测试夹具里存在、真页面静默吞掉，算未达标。
5. **同一浏览器两标签页各占一座**：这是 M5 明确写进工单的一条，因为 token 存放方式（例如全局键的 `localStorage`）最容易在这里翻车。
6. **覆盖 oracle 对照**：本轮 §5 的 (b)(c) 两类未覆盖（穷尽兜底 + 可达但没测）请一并写进 SELF-REVIEW 的"已知未覆盖"表 —— 表要与我的 `cov-report` 输出对得上，对不上的部分我按**披露不完整**处理。
7. **§4 的 7 条应修逐条销账**（其中第 5 条那句注释，请照我 §2.2 的实测结论改：不是"永远够不到"，而是"重武装会留下一只多余定时器，room/25④ 守着"）。
8. **我不再全量重审 M4**：M4 已 PASS 的部分只在硬闸门与零回归层面复核；本轮的重心是 M5 的新增面（`webui` 联机入口、房间进程入口、重连与违规可见性）。
9. **Q6 已裁定（2026-09-28，Path A，见 ANSWERS.md 第六轮）= A2**：显示用价格由 `src/engine/state.ts` 里**唯一一处**算术派生、`webui/netplay.ts` 只 import 不重算、**协议不加 `costs` 字段**（B 否决：那是纯冗余字段，且与 `netx/protocol.ts:4` 自己写的"多接一个 key 就多一条服务端可以偷偷塞数据的通道"相反——它新开了一条服务端可以与自己下发的 `stake` 互相矛盾、而客户端被禁止质疑的通道）。rev=10 我会查四件事：**(i)** 价格算术真的只有一处定义（grep `webui/` 里没有第二份 `bet.dark`/`bet.seen`/`compare.fee` 算式，也没有伪造的 `GameState`）；**(ii)** 既有 362 条用例**一条期望都没被改**（A2 的 ① 要求行为逐字节不变，改了期望就说明委托抽得不干净）；**(iii)** 端到端价格诚实性——行动前 UI 的 `cost` === 行动后下行 `log` 里那条事件的 `amount`，跟注/加注/比牌各一条；**(iv)** 两条变异被抓（`dark`/`seen` 互换；`project()` 出口 `stake+1`）。若实现方按预授权退回 C（按钮不印金额），我按 C 验收、不算返工，(iii)(iv) 相应改为"页面上确实没有任何本地算出的金额"。
10. **（2026-09-28 巡检时新立的口径，因为我 rev=9 漏了一个真崩溃）注入时钟回调里的可达分支，未覆盖 = 必修级，不再是"覆盖缺口"。** 理由见下面 §9 的自陈：`onNonceDeadline` 剔除缺席家后若被剔的正是庄家，`h.dealer` 就成了不在 `seats` 里的号 ⇒ `startHand` 抛 TypeError ⇒ **抛出点在注入时钟的回调里，没人接 ⇒ 房间进程直接退出**。这类位置的分支一旦可达而未测，风险不是"少一条断言"而是"进程死掉且没有栈可查"，所以 rev=10 起我按阻塞项处理。判据：对 `netx/room.ts`、`netx/serve.ts` 里所有注册进 `clock.after(...)` 的回调体，用 `cov-report.mjs` 的字符级 oracle 核对，**不许有 count=0 的可达分支**；确实不可达的（穷尽兜底 `exhausted: never`）要写进 SELF-REVIEW 的"已知未覆盖"表并给出不可达论证。
11. **(ii) 的口径精确化（2026-09-28）**：我实测当前在飞的树里有两条基线用例**只是标题改写**（`nst/01`、`nst/04`，编号仍在、断言未减弱，因为 M5 把 `webui/netplay.ts` 纳进了 `PORTABLE` 清单）。这不算违规。(ii) 要禁的是"基线用例消失或断言被减弱"，不是禁改标题文字。rev=10 我用 `.audit/rev9/case-names.txt`（362 条基线名）做集合差：**基线里有、交付里没有的编号 = 必须逐个解释**；标题变了但编号在 = 放过。

---

## 9 · 巡检记录与自陈（非裁定，DELIVERY.md 仍为 rev=9）

**2026-09-28 巡检（Path A 已完成 Q6 裁定后的空档期）**：`DELIVERY.md` 仍是 `rev: 9` / `milestone: M4 联机` / `builtAt 2026-09-27T21:26:24`，**没有 rev=10 交付**；`QUESTIONS.md` 六条全部 `answered`，无 open ⇒ 按规程本轮**不出裁定**。以下三点是巡检实测，供下一轮对照，**不构成对在飞工作的验收**：

1. **rev=9 我 PASS 过的那棵树已经不在盘上了。** `.audit/rev9/manifest-claimed.txt` 现在 `sha256sum -c` 是 **52/70 OK、18 FAILED**（`netx/` 六个、`src/engine/state.ts`、六个 test、`webmin/` 两个、`webui/` 三个），另有 3 个新文件不在 manifest 里（`webui/netplay.ts`、`test/netx-netplay.test.ts`、`test/netx-serve.test.ts`）。**这是 M5 正常在飞，不是交付后偷改**：DELIVERY.md 没有声明 rev=10，工单 §4 M5 明确要求把 rev=9 的 7 条应修随同一份交付做掉。**记这一条是为了防止未来某一轮把这次 `-c` 失败误读成作弊。** rev=9 的 PASS 是时点裁定，证据在 `.audit/rev9/` 冻结，仍然有效。
2. **Q6=A2 被照原样接住了（这是好消息，实测）**：`src/engine/state.ts:136` 新增 `priceOf(kind, stake, looked, rules)` 作为唯一算术，`:158` 的 `actionCost` 委托给它、签名与语义未动，`callPrice`/`canAffordCall` 原样；`webui/netplay.ts:23` 只 import `priceOf`、`:500` 用 `priceOf(kind, view.stake, looked, view.rules)`，**没有伪造 `GameState`**；`nst/10` 已把"公式不许扩散"钉成静态门。我的 ①②③④ 四条硬要求都落地了。
3. **自陈：rev=9 §5(c) 我标的那片"可达但没测"的分支里，藏着一个能打死房间进程的崩溃。** 实现方在 M5 真浏览器实测中撞到并修掉了（`netx/room.ts:271-296` + 新用例 `room/29`，注明"旧行为：整个房间进程被 TypeError 打死"）。我 rev=9 的 S5 对照组 B 走过 `onNonceDeadline`，但**被剔的三家里不含庄家**，所以没打到这条臂；我把它归成非阻塞的覆盖缺口，定级偏松 ⇒ 已按上面第 10 条收紧口径。**这不是实现方的披露问题（他们主动写了用例并标注旧行为），是我的缺口定级问题。**
4. **在飞状态（仅供参考，不是裁定）**：`node test/run.ts` = `files=29 cases=392`、`pass=391 fail=1`，唯一失败是他们自己新写的 `nui/18`（凭据作废后自动改走 join）。基线 362 条**无一失败**。他们同时已在销 rev=9 的应修（`proto/13`、`room/27`、`room/28`、`ws/06` 的用例名里直接标了"rev=9 应修 N"）。

---

# 附：rev=8 复审裁定（历史，保留备查 —— 已被上面的 rev=9 裁定取代）

# REVIEW.md — rev=8 复审裁定（M4 联机 / netplay）

- **rev: 8**（对应工单 §4 "M4 联机"；DELIVERY.md `builtAt: 2026-09-26T09:52:14+0800`）
- **结论：不通过 —— 定点返修（REVISE）**
- **裁定时间：2026-09-26T12:24+08:00**（全量复审：manifest 重算 + 双跑测试 + 通读 netx/ 全部 8 个源文件 + 12 条临场抽查用例 + V8 块覆盖 + 逐条核对 76 条变异）
- **批准范围：不推进，仍为 M4 联机**（BRIEF.md 顶部批准行已同步；措辞按 Q5 裁定改为"零依赖手写 WebSocket"）
- **Q4 / Q5 已裁定**，正文在 ANSWERS.md 第五轮，QUESTIONS.md 两条已置 `answered`，工单 §1「超时」行、§3.7 ④、§4 M4 行已同步修订。

## 0 · 一句话结论

**硬闸门全过，工程质量和证据纪律是这个项目八轮以来最高的一次；但客户端"第二道墙"上有一个你我双方 76 条变异都没覆盖到的洞，加上 Q4 裁定把托管语义从 A 改成 B（必须动 `src/engine/actions.ts`），所以 rev=9 无论如何都要出——那就把五处必修一起做掉。没有一条是结构性问题，没有一条触碰 §5 禁令，服务端侧的 commit-reveal 多方合成经我独立复核成立。**

## 1 · 硬闸门（工单 §0.7）逐条结果

| 闸门 | 结果 | 我的第一手证据（可复现） |
|---|---|---|
| manifest 重算 | **过** | `sha256sum -c` 69/69 OK，退出码 0（`.audit/rev8/manifest-recheck-final.txt`）。复审结束时又重算了一次，仍然 69/69。 |
| 交付后未改动 | **过** | 无任何文件的 mtime 晚于 DELIVERY.md；我自己的全部产物只落在 `.audit/rev8/`，不在 manifest 内、不在 `test/` 下、不被 `test/run.ts` 发现。**BRIEF/ANSWERS/QUESTIONS/REVIEW 四个协议文件按分工由我维护，不在 manifest 内，我的改动不构成"交付后篡改"。** |
| 测试自身先被验证（§0.5 双跑一致） | **过，且比声明更强** | `npm test` 连跑两次，退出码均 0，stdout+stderr 合并流逐字节相同，435 行，`sha256 = 9b516eb4a181b761faabf997491247aeb03d7911047c53a4c8c0610e56a9eec1` —— **与 SELF-REVIEW.md:17、TEST-OUTPUT.md:31 声明的值逐字符相同**（`.audit/rev8/npm-test-run1.txt` / `run2.txt`）。 |
| 用例全绿 | **过** | `RUNNER files=26 cases=340` / `SUMMARY pass=340 fail=0` / `RESULT=ALL_PASS`。 |
| 类型 | **过** | `npx tsc --noEmit` 退出码 0，零输出（`.audit/rev8/tsc-noemit.txt`）。 |
| §3.7 ④ 零运行期依赖 | **过** | `package.json` 缺省 `dependencies`（Q5 已澄清：缺省 ≡ `{}`）；`netx/` 的 import 面只有 `node:http` / `node:crypto` / `node:stream` 与本项目内文件；时钟与随机只出现在 `netx/ws.ts`（`setTimeout` / `randomBytes`），`netx/room.ts` 里 `grep -n 'Date\.\|setTimeout\|Math\.random'` 为空 —— 注入式 `Clock`/`entropy` 的口径守住了。 |
| §4「单方选 seed = 磨种子，不合格」 | **过** | 见下节第 3 条。 |
| 互通性不是自证 | **过** | `evidence/m4-ws-interop.txt` 我逐条核对：四个客户端走 Node 24 内置 undici `WebSocket`（另一套独立实现）经 TCP 回环，四家各自独立复算出同一颗种子 `3907236537`，筹码 `249+263+256+256 = 1024` 守恒，`fault=null`，丙/丁在发牌后才连上、本局牌面全程 `unknown` 却照样能核对揭示（catchup 补承诺）—— 内部自洽，且与 `ws/01`–`ws/04` 的断言一致。握手向量 `s3pPLMBiTxaQ9kYGzzhZRbK+xOo=` 我在 S5 里独立重算命中。 |

## 2 · 我不只是重跑了你的测试

- **通读**：`netx/` 八个文件全部逐行读过（sha256.ts 124 行 / seed.ts 120 / protocol.ts 524 / frames.ts 409 / room.ts 645 / client.ts 283 / ws.ts 229 / serve.ts 29）。
- **临场抽查**：`.audit/rev8/spot-check.ts`，12 节全绿，**实际执行 775 条断言**（每节打印计数，无 0 断言节），双跑逐字节相同 `sha256 = 200cfa18dab15f19408552bf14207b1f06901605e809ed68aa761eaf84f02c14`（`spot-run3.txt` / `spot-run4.txt`）。每条结论都配了对照组。
- **客观可达性 oracle**：`NODE_V8_COVERAGE` 跑完整测试套件，折成 `file:line` 未覆盖区间（`.audit/rev8/coverage-report.mjs` → `uncovered-netx.txt`，**netx/ 共 108 段**）。下面第 3、5 节的"零覆盖"结论全部出自这份数据，不是我读代码猜的。
- **交叉验证你的变异表**：76 条我逐条读了。7 条存活（C12/R05/R06/R13/R17/X06c/X13b）的等价论证，我用覆盖数据独立佐证了两条关键的：R05 对应 `room.ts:168-172`（出口防泄漏自检）确实零覆盖 ⇒ "可达投影本身不可能越界"这个论证前提成立；R13 对应 `room.ts:314-321`（揭示前自检）同样零覆盖 ⇒ "自检对象是自己刚算出的值、恒真"成立。**这两条我认可，不要求返工。**
- **FIPS 180-4 / RFC 6455 差分**：sha256 与 sha1 分别在 19 个长度档（0,1,2,3,55,56,57,63,64,65,119,120,121,127,128,129,255,256,1000）+ 6 组含 CJK 的 UTF-8 文本上与 `node:crypto` 逐条一致（S5，51 条断言）。
- **fuzz**：`FrameReader` 喂 2000 条固定种子随机字节 ⇒ 931 条 `FrameError`、1069 条正常返回、**0 条非 FrameError 异常**（没有意外崩溃路径）。同时补了正向对照：200 条合法掩码帧切成 1~4 段任意分片，全部逐字节还原（606 条断言）—— 否则 fuzz 只证明"会拒"，不证明"能收"。
- **协议污染面**：`__proto__` / `constructor` / `prototype` 在 `checkUp` 与 `checkDown` 双向都被拦，重建出的对象只含 schema 键（S4）。
- **契约点**：六条非法上行（`action` 夹带 `seat`、`kind:'settle'`、`kind:'timeout'`、顶层 `seat`、`{"t":"settle"}`、`{"t":"timeout"}`）全部被拒，`stateHash` 一字未动、`fault` 为 null、诚实客户端零违规（S8）。**上行确实无法替别人行动、无法自催结算、无法自触发托管。**

## 3 · 必修（阻塞 rev=9 PASS，共 5 项）

### 必修 1 · 客户端承诺存储可覆写 —— 第二道墙上的洞（A 级，我的 S1 实测复现）

**位置**：`netx/client.ts:149`

```ts
case 'commit': {
  enterHand(msg.hand);
  commitments.set(msg.party, msg.commit);   // ← 无条件覆写，同一 party 可以改口
```

**实测（S1a）**：一个恶意服务端在**收完各家 nonce 之后**再发一条 `commit`（换一个承诺），客户端接受；随后服务端发一组与新承诺自洽的 `reveal` ⇒ 客户端 `violations=[]`、`verifiedHand=1`。**客户端的"已核对"记录被伪造了。**

**对照组（S1b）**：同样的伪造份额，但**不重发承诺** ⇒ 立刻被 `server revealed a share that does not open its commitment` 抓住。所以问题不在 207 行的核对逻辑，就在 149 行的存储可覆写。

**边界（我把话说全，避免你过度返工）**：S1c 实测，**当客户端持有过真实 `view` 时，215 行的 `deal.seed` 绑定仍然兜得住**（真实 `1532636097` vs 伪造 `479020333` ⇒ 被拦）。所以这个洞**改变不了任何它亲眼见过的那一手的发牌结果**；它能伪造的是"客户端对一局它从未见过的牌局的核对记录"。服务端侧的 commit-reveal 多方合成不受影响，**§4 的磨种子禁令没有被违反**。

**为什么仍然必修**：`netx/client.ts` 存在的唯一理由就是"不信任服务端"（你自己在 TEST-OUTPUT 8.5 和 leak/05 里把它叫第二道墙）。第二道墙上有一个你的 76 条变异一条都没覆盖到的洞，而这个项目的产品就是可验证性 —— 这一条不能推到"下一轮再说"。

**改法（约 4 行）**：承诺存储改成**每 (hand, party) 写一次**。同一 party 二次到达时：值相同 ⇒ 放过（**重连 catchup 会补发承诺，`room/17`、`ws/04` 依赖这一点，不要误伤**）；值不同 ⇒ `violate('server re-committed a different value for party X in hand N')`。

**必钉**：新用例（把 S1a 的场景搬进 `test/netx-client.test.ts` 即可，脚本在 `.audit/rev8/spot-check.ts` 里可以直接抄）+ 新变异（承诺存储改回可覆写 ⇒ 必须被该用例抓到），并把 TEST-OUTPUT 8.6 的合计从 76 更新。

### 必修 2 · `netx/room.ts:287-288` 是死代码，删掉（A 级，构造性证明 + 覆盖数据 + 实测三重佐证）

```ts
h.seated = left;                                      // 277
h.expected = left.map((s) => partyOfSeat(s)).sort();  // 278
sendCollect(h);                                       // 279
if (missingParties(h).length === 0) { ... deal(h); return; }   // 280-286  ← 恒真
drop(nonceCancel);                                    // 287  ← 不可达
nonceCancel = clock.after(nonceMs, () => onNonceDeadline(index));  // 288  ← 不可达
```

**构造性证明**：269 行 `left = h.seated.filter(s => h.nonces.has(partyOfSeat(s)))`，278 行把 `h.expected` 重建成**正好这些已交份额的 party**；而 `missingParties`（153-155 行）= `h.expected.filter(p => !h.nonces.has(p))` ⇒ 按构造恒为空 ⇒ 280 行恒真 ⇒ 287-288 永不可达。

**佐证**：V8 块覆盖显示 287-288 零覆盖；S7a 实测（4 家、只有 3 家交 nonce）⇒ 立即发牌，`phase` 直接进 `betting`，从不重武装。

**要求**：删。若你认为它可达，请在 `SELF-REVIEW.md` 里给出可达路径并配一条用例 —— 但按 277-278 的写法我找不到。留着一段"看起来在防什么、实际防不到任何东西"的代码，会让下一个复审者（包括未来的我）误以为这里有一道闸门。

### 必修 3 · `netx/ws.ts:157` 的 HTTP 状态码不符 RFC 6455（B 级）

```ts
if (version !== '13') {
  socket.write('HTTP/1.1 425 Too Early\r\nConnection: close\r\n\r\n');
```

RFC 6455 §4.2.2 规定：`Sec-WebSocket-Version` 不受支持时**必须**回 `426 Upgrade Required`，并**应当**带上 `Sec-WebSocket-Version` 响应头列出服务端支持的版本。`425 Too Early` 是 RFC 8470（TLS 早数据）的码，用在这里会让通用客户端/代理误判。

**改法**：状态行换成 `426 Upgrade Required`，并加 `Sec-WebSocket-Version: 13`。**必钉**：`ws/03` 已经在裸 socket 上断言了"版本 8 被拒"，把断言从"被拒"收紧到"状态行 = 426 且响应头含 `Sec-WebSocket-Version: 13`"。

### 必修 4 · 同一个文件里两套排序键：`netx/seed.ts:115` 的 `localeCompare`（A 级实测分歧，C 级危害评估）

```ts
// seed.ts:83   canonicalShares —— 权威路径，码点排序
parts.sort();
// seed.ts:115  seedVector —— 公布给复审照抄复算的固定向量，locale 排序
[...shares].sort((a, b) => a.party.localeCompare(b.party))
```

**实测分歧（S6，本机 Node v24 / 默认 ICU）**：`['A','a']` ⇒ 码点 `[A,a]`、ICU `[a,A]`；`['Z','a']` ⇒ 码点 `[Z,a]`、ICU `[a,Z]`。**两套键确实会给出不同顺序。**

**危害边界（我不夸大）**：真实的 party 集合（`server`、`seat:0`…`seat:10`）全是同大小写 ASCII，两套键**不分歧**；且 `seedVector().seed` 与 `seedFromShares()` 在我全部 6 组探针上都相等（因为 `canonicalShares` 内部会自己重排）⇒ **种子值不受影响，发牌不受影响**。

**为什么仍然必修**：受影响的正是 `seedVector().commit` 数组的顺序，而 `seedVector` 的**唯一调用点是 `test/netx-seed.test.ts:145`（`seed/11` 固定向量：复审可照抄复算）**。一个"公布给外部复审照抄"的工件，其顺序依赖运行环境的 locale/ICU ⇒ 换一台机器（不同 `LANG`、不同 ICU 构建、甚至 small-icu 编译）就可能对不上，而 `seed/11` 是与硬编码字面量比对的，会**假失败**。这直接抵触 §0.5 的可复现精神。同一个概念排序在一个文件里用两套键，本身也是缺陷。

**改法**：两处统一为码点排序（`(a, b) => (a < b ? -1 : a > b ? 1 : 0)`，或直接 `parts.sort()`）。**必钉**：一条用例断言 `seedVector(...).commit` 的顺序 === `canonicalShares(...)` 的顺序，且 party 名里故意混入大小写与数字（如 `['server','Seat:10','seat:2','A','a']`）时两者仍一致。

### 必修 5 · Q4 裁定 = B，托管语义要从"自动弃牌"改成"自动跟注"（口径变更，必做）

裁定正文、理由与完整落地形状见 **ANSWERS.md 第五轮 Q4**，工单 §1「超时」行已同步。要点复述：

- **裁 B**：到点仍注入 `{kind:'timeout', seat}`，只改 `src/engine/actions.ts` 的映射 —— 付得起当前跟价 ⇒ `call` 事件、note 必含 `timeout` 字样；付不起 ⇒ `fold`、note `timeout→fold`。
- **不许**改成从房间层注入 `{kind:'call'}`（你在 Q4 里提的 6 行方案）—— 那样托管跟注与玩家自主跟注在引擎日志里不可区分，可归因性丢失。
- **C 否决**，且"托管能否替玩家 look"的答案是**不能**（§1 不放宽）。
- 托管绝不 `look` / `raise` / 发起 `compare`；断线与超时同一条路。
- **必钉 6 条**（(a)–(f)，逐条见 ANSWERS.md）：全员托管走到结算且 `reason='stall'`、付不起回退成 fold、明/闷跟价分别正确、日志里不出现 look/raise/compare、`room/07` 断言更新、以及"把映射改回 fold"和"去掉 note 里的 timeout 字样"两条变异都要被抓到。
- **注意影响面**：这会改到 `src/`（M4 之前 `src/` 是冻结的），`room/07`、`room/10`、`ws/04` 的既有断言都要跟着改；`src/engine/validate.ts` 里 rev=1 那条注释（"v1 语义 = 自动弃牌，M4 若要改托管跟注只动 apply 一处"）请一并更新成实际语义。rev=9 的 manifest 会因此包含 `src/` 文件，属预期，不算越界。

## 4 · 应修（不阻塞 PASS，但请一并做掉）

| # | 位置 | 问题 |
|---|---|---|
| 应修 1 | `netx/frames.ts:3` | 文件头注释写"已在 QUESTIONS.md **Q4** 提出" —— 依赖面那条是 **Q5**。交付给复审的文件里引错工单编号，会让复审者去读一条不相干的问题。 |
| 应修 2 | `netx/sha256.ts:5` | 注释指向 `test/netx-sha.test.ts`，实际文件是 `test/netx-crypto.test.ts`。 |
| 应修 3 | `test/static.test.ts:98` | 注释称"交付文本里 dependencies 显式写成空对象"，实际交付的 `package.json` **缺省**该字段。断言本身是对的（`static/06` 容忍缺省），只有注释过期。 |
| 应修 4 | `netx/ws.ts:46-48` | `clock.now()` 在整个 `netx/` + `src/` 里**没有任何调用点**（`grep -rn 'clock.now' netx/ src/` 只命中定义处；`Date.now()` 也仅此一处）。`Clock.now` 目前只被测试夹具自己用（`netx-room.test.ts:498/505`）。要么从 `Clock` 接口里去掉 `now`（夹具改用 `nextDue()` 做算术），要么保留但在 DELIVERY 的"自行决定清单"里写明**它是接口义务而非活路径**，免得下一个复审者再把它当死代码查一遍。 |
| 应修 5 | `netx/room.ts:625` | `connections` 排序也用了 `localeCompare`。连接 id 是 `c<N>` 纯 ASCII，实测不分歧，且 `info()` 是诊断面、不上线不进种子 ⇒ 危害为零；但与必修 4 是同一个味道，请统一。 |

## 5 · 覆盖缺口（不阻塞；能补则补，补不动请在 SELF-REVIEW 里写明"已知未覆盖"）

V8 块覆盖给出 `netx/` 共 **108 段**未覆盖区间。其中绝大多数是防御性 `catch`／`throw`（可达性需要"服务端自己出错"，不值得为它造用例）。以下几处是**可达但没被测到**的，值得补：

| 位置 | 是什么 | 我的处置 |
|---|---|---|
| `netx/client.ts:47`、`:50` | `logShape` 的"中间有洞"与"尾条 ≠ 信封 seq"两道闸门 | **已由我用 S9 验实，结论：两道闸门都真的会拦，且报错文本可与第 43 行那道区分**。你的 `client/04`、`client/05` 都只断言 `/log starts at seq/`（第 43 行），而 C12 的等价论证恰恰依赖第 47 行 —— 现在这个论证前提有实测支撑了。**请把 S9 移植成 `test/netx-client.test.ts` 的正式用例**（脚本可直接抄），移植后 C12 的"等价"结论才算钉死。 |
| `netx/room.ts:564-567` | 应用层 `ping → pong` | **已由我用 S2 首次驱动，结论：功能正常**，是覆盖缺口不是缺陷。补一条即可。 |
| `netx/room.ts:414-417` / `:455-458` / `:512-519` | `already_joined` / `token_seat_mismatch` / 行动阶段的 `not_dealt` + `bad_hand` | 可达（`room/13`、`room/19` 都擦边而过但没命中这几行）。 |
| `netx/room.ts:168-172`、`:314-321`、`:341-344` | 出口防泄漏自检 / 揭示前自检（含"份额不再合成出发牌那颗种子"）/ 引擎拒绝了自己刚产出的行动（`verdict.ok === false`） | **R05、R13 的等价论证正是"这几行零覆盖 ⇒ 恒真"**，我认可论证，不要求补用例；但如果哪天有人改 `project()`，这两道自检就从"等价"变成"真的会触发"，届时必须有断言。请在 SELF-REVIEW 里记一笔。 |
| `netx/ws.ts:145-154`、`:165-169` | 握手拒绝分支（Upgrade 头缺失 / Connection 头缺失 / key 非法） | `ws/03` 只测了版本不符那一条。必修 3 顺手一起补最省事。 |
| `netx/frames.ts:171-173`、`:393` | `bad_mask`（掩码键长度不足）/ 64 位长度的非最小编码 | `frame/01`–`frame/14` 擦边未命中。 |
| `netx/client.ts:88`、`:95-97` | `view.seq ≠ 信封 seq` / 合并后条数 ≠ seq | 第 95-97 行是 C12 等价论证的**另一半**（"两条已蕴含合并后条数 = seq"）。S9 里我顺便确认了这两道与 `logShape` 三道的报错文本互不相同、可分辨。 |

## 6 · 明确不算问题的（防止你返工过头）

1. **7 条存活变异**（C12/R05/R06/R13/R17/X06c/X13b）的等价论证我全部读过，R05、R13 用覆盖数据独立佐证成立，X17b 被 `room/05` 抓住这件事也说明"等价"依赖的是协议层那道门而不是运气。**不要求返工。** C12 的前提请按第 5 节移植 S9 后钉死。
2. **TEST-OUTPUT 8.7 的六条"本轮真实修出的缺陷"与 8.8 的五个盲区**：这是加分项，不是扣分项。尤其第 3 条（广播只刷了发话那条 socket，环线工装天然看不见、只有真 socket 抓得到）—— 这说明你的工装设计有一个真实的盲区，而你靠换一层测试把它暴露了。这个方法论我认可。
3. **`evidence/m4-ws-interop.txt` 里丙/丁的牌面是 `"unknown"`**：正确行为（它们在发牌后才连上，本局不参与），不是缺陷。
4. **`nst/07`（断言没装 ws）保留**：Q5 裁定零依赖之后，这条断言从"临时状态"升格为"口径守卫"，**不要删**。
5. **`package.json` 缺省 `dependencies`**：合规（Q5 已澄清）。

## 7 · 复审怎么复现（我的产物都在 `.audit/rev8/`，刻意不入 manifest）

```
cd /f/qoder/zjh
sha256sum -c .audit/rev8/manifest-claimed.txt          # 69/69 OK
npm test                                                # 435 行，sha256 = 9b516eb4…（与声明一致）
npx tsc --noEmit                                        # 退出码 0，零输出
node .audit/rev8/spot-check.ts                          # SPOT_SUMMARY pass=12 fail=0；断言计数逐节打印
node .audit/rev8/coverage-report.mjs                    # UNCOVERED_RANGES total=108 scope=netx/
```

`spot-check.ts` 无时钟、无 `Math.random`（用 `src/cards.ts` 的 `mulberry32` 固定种子），每节打印实际执行的断言数，**断言数为 0 的节一律视为"没跑成"、不算通过** —— 这条纪律是照你自己的 §0.5 定的。

## 8 · rev=9 的验收口径（一次做完，我按这个清单逐条查）

1. 必修 1–5 全部落地，每条配新用例；必修 1、4、5 各配新变异，TEST-OUTPUT 8.6 的合计与逐条表同步更新。
2. 应修 1–5 一并做掉（都是几行注释/排序键的事）。
3. 第 5 节里点名的 `client.ts:47/50`（S9 移植）与 `room.ts:564-567`（ping→pong）**必须补**；其余覆盖缺口能补则补，不补的在 SELF-REVIEW 里列成"已知未覆盖 + 为什么可接受"。
4. `npm test` 双跑逐字节一致、`tsc --noEmit` 干净、`dependencies` 仍为空、`nst/07` 仍在。
5. manifest 重算一致，交付后不再改动。
6. Q4 落地会动到 `src/`，属预期；但 `src/` 的"零运行时依赖、无时钟/随机/IO"这条不许破。

**做完这些，M4 我判 PASS，批准行推进到 M5。** 需要我补什么材料（比如把 S9 / S1a 整段脚本原样交给你移植），在本文件点名即可 —— 脚本就在 `.audit/rev8/spot-check.ts`，你可以直接读。
