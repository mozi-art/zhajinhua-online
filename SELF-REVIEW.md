# SELF-REVIEW.md —— rev=13 自评表（本轮交付：Q7 裁定 = B，停手改成标签页级）

对应裁定：`ANSWERS.md` 第七轮（Q7）+ `REVIEW.md` rev=12 §9 补记 + `BRIEF.md` §4 M5「客户端的对抗性检查要产品化」修订行。
测试输出原文：`TEST-OUTPUT.md` 第 13 节。覆盖明细：`.scratch/r13-cov-report.txt`（监督方 `sup-cov-final3.mjs` 原样跑，未改它）。
本轮范围只有一条，既有用例的期望一条未改（裁定明令），412 → 414 全部是加法。

## 13-A. 裁定钉的每一颗钉子，逐条自评

| 裁定原文的钉子 | 自评 | 凭据（第一手） |
|---|---|---|
| 键 = `` `${prefix}:untrusted` ``，走既有 `Store` 端口（sessionStorage），与凭据同一个 prefix 机制 | **过** | `webui/netplay.ts::untrustedKey`；`nui/29` ① 直接按字面键名 `zjh-m5:untrusted` 断言（不是"某个键"），`nui/30` 钉坏值；`nui/07` 既有的"不许 localStorage"照旧在守 |
| 值 = JSON `{count, first, hand}` | **过** | 同一处；`nui/29` ① 断三个字段各是什么（`count=1`、`first` 逐字等于那条 violation 原文、`hand` 是数字） |
| 写入 = peer 首次报出非空 violations 的那一帧；**唯一真源 = `peer.info()`**，不许 netplay 自己解析帧来判 | **过** | `recordUntrusted()` 只读 `peer.info().violations`，全函数没有一处 `JSON.parse`；调用点在 `onText` 里紧跟 `peer.inbound` 之后（放在 errors 嗅探之前，免得以后有人在那段加 `return` 把记账跳过去）。`nst/02` 那条"不许有第二份协议判定"的静态门本轮仍然绿 |
| 读取 = `createNet` 之前 / 页面加载时，**先于任何下行帧** | **过** | `createNet` 第一句之后就读；`nui/29` ② 断的是"新 net 一条下行都没喂"就已经 `untrusted=true`、`act()` 发不出去、警告位已把解除方式说出来 |
| 解除只有关闭本标签页；**断开→连接、F5/刷新、换房间 URL、单机↔联机切换一律不清** | **过（无头侧四支都钉）** | `joinWire()` 只 `del(savedKey)`，源码里没有任何一处 `del(untrustedKey)`；`nui/29` ③ 用"再建一个 net（= 那两下点击）"和"`joinWire()` 之后账一位没动"两支钉住，并用 `store.get(':session')===null` 反向对照证明不是"顺手一起清"。刷新与单机↔联机切换在实现上就是"同一 store 上重建 net"这一条路径，被同一支覆盖 |
| 新标签页 / 新窗口 / 重启浏览器 = 干净 | **过** | `nui/29` ⑥：换一份 store 建 net ⇒ `untrusted=false` 且 `trustLines` 为空 |
| 横幅必须把解除方式说出来 | **过（并有一处形状要报备）** | 追加行原文：`⚠ 本标签页曾判不可信 N 次（首条：<原文>），已停手；只有关闭本标签页才能解除`。页面那条提示行是 `main.ts::hintText` 把 `trustLines` **整段用 ` ⏎ ` 拼起来**（`main.ts:232`），所以刚被抓和继承两种情况下它都会出现在页眉；牌桌警告位（`note = trust[0]`）在继承态时就是这一行。**唯一要说清的形状**：本会话刚被抓时，它在提示行里排在越界行之后 —— 因为 `nui/05` 把"越界提示必须是日志区第一行"钉成了断言（`snap.log[0]`），插队等于改既有期望 ⇒ 写进 13-D 第 1 项，不藏 |
| 不做 endpoint 级隔离（不按 ws URL 分键） | **过** | 键里没有任何 URL 成分；`nui/29` ⑤ 里"换房间 URL"走的就是同一把键不清 |
| 粘性是地板不是替代：逐帧复检一条不减；新会话再抓 ⇒ `count` 递增、`first` 不变 | **过** | `checkView`/`checkMoney`/揭示三查一行未动（本轮没碰 `netx/client.ts`）；`nui/29` ④ 断的是"第二世再篡改 ⇒ 那一世自己的墙仍然响、被拒帧仍然不进快照，同时 `count` 1→2、`first` 逐字不变" |
| 行动阻断走同一条出口，不许新造第二条按钮塌陷逻辑 | **过** | 塌陷仍然只由 `untrusted()` 这一个布尔驱动（`snapshot()` 的 `blocked` 参数没改形状）；`act()` 多出来的那一支返回的是同一个 `{sent:false, why, wire:null}` 形状，与 `peer.act` 拒发时一模一样。变异 P04 摘掉 `untrusted()` 里那半条 ⇒ 两条用例立刻翻红，证明这条出口真的在承重 |
| 新增一条 `nui/` + 变异一条；既有用例期望一条不许改 | **过（两条用例 + 七条变异）** | `nui/29`、`nui/30`；变异 P01–P07 见 TEST-OUTPUT 13.3；`comm -23` 空、414 全绿 ⇒ 既有条一条没改也没丢 |
| 定级：应修，不是必修；rev=12 的 PASS 不翻案 | **收到** | 本轮不动 rev=12 已交付的判定；只把 (B) 补上。`DELIVERY.md` 的 `milestone` 写明本轮唯一范围 |

## 13-B. 计数、回归与工装

- **用例**：`RUNNER files=29 cases=414`、`SUMMARY pass=414 fail=0 total=414`、`RESULT=ALL_PASS`（rev=12 交付时 412）。
- **双跑**：`node test/run.ts` ×2 与 `npm test` ×2 各自逐字节一致（`cmp` 过）；
  sha256 = `1826dd9ad457231ed5c94eb3d1d45c461bb458f723a136aae31289f46ed28dab`（node）
  与 `8336295d0dfec4359830d13c791ba5c00eac9f9e3ab567bec8d10e45135f3e00`（npm）。`npx tsc --noEmit` 零输出。
- **零回归**：`comm -23 .scratch/r12-ids-extract.txt .scratch/r13-ids.txt` = **空**；
  `comm -13` 只有 `nui/29`、`nui/30` 两条新编号。基线同样从 `PASS` 行机械抽取（rev=12 那 412 条），
  既有条目一条没丢、没改名、没改期望。
- **变异**：本轮 7 条（P01–P07）**全部 caught**；另把宿主文件（`webui/netplay.ts`）本轮被改过的
  6 条老门（M06/M07/M08/M09/M12/N05）全部复跑，**也全部 caught** ⇒ 合计 13 条，0 survived、0 还原失败。
  其余老门的宿主文件本轮一字未动，故不复跑（理由写在 TEST-OUTPUT 13.3）。
- **覆盖**（监督方 oracle v4 原样只读 + A 条锚点逐字副本重标定）：22 文件 / 43 段 /
  5758 可执行行覆盖 5618 = **97.6%**；本轮唯一改动的交付文件 `webui/netplay.ts` 579/599 = 96.7%，
  **新增的粘性那几段全部在覆盖里**（未覆盖仍是那三段老账）。四条地面真值自检全 OK，
  其中 **A 条仍是行漂移的假绿**（rev=12 已报过一次，本轮 `ws.ts` 未动 ⇒ 漂移还在），
  我没有拿它当结论，重标定到 `ws.ts:162-164` 复核为 `111`，两份报告 `diff` 只差那一行。
- **真浏览器续证**：注入 → 停手 → **断开重连仍然停手**（rev=12 那一次同一动作是"横幅消失、行动恢复"），
  三张截图 + 代理日志（`"pot":3 → "pot":103`）记在 TEST-OUTPUT 13.5；房间与代理跑完已停，无残留监听。
- **13-F 与 oracle 逐行对账**：用监督方 `sup-covdiff.mjs` 的**副本**（`.scratch/r13-mk-diffcopy.mjs` →
  `.scratch/repin/r13-covdiff.mjs`，只改报告路径与节标签，判据一字未改）自跑一遍，原文
  `.scratch/r13-covdiff-run.txt`：**`COVDIFFRESULT=OK`，`onlyMine=0` / `onlyTheirs=0`**，双方段数 43 vs 43、
  与 13-F 标题自称一致；`ranges=0` 的那 5 个文件也与表尾那句逐字对上。

## 13-C. 本轮被"证据"逼出来的三件事

1. **我自己把计数语义写反过一次，是变异把它钉回来的。** 第一版写的是 `let stickyRecorded = sticky !== null`
   —— 意思是"继承来的账就算已经记过了"。后果：第二世再被抓时 `recordUntrusted()` 直接早退，`count` 永远停在 1，
   裁定要的"再抓递增"变成空转。`nui/29` ④ 跑红之后才看清：**每一世都该从 false 起算**，
   "已记"指的是本世。今天我把它反过来写成 P07 那条变异，让这条语义有一个"改回去就翻红"的门。
2. **我的测试夹具自己错过一次顺序。** `nui/29` 第一版在断"重连不涨数"之前先调了 `joinWire()`，
   而那一步按设计会清凭据 ⇒ 后面回放下行时新会话已经"无座"，`checkView` 报的是
   `view is projected for seat 0, not -1`。红的是我的构造，不是实现：把 `joinWire()` 挪到断完之后再演，
   并补一条 `store.get(':session') === null` 的反向对照，让"两把键各管各的"这件事本身成为断言对象。
3. **回放一条 view 不够，得回放一段。** 第二版只把当年那条诚实 `view` 喂给新会话，结果 `snapshot().started`
   仍是 false —— 因为 `rules` 是 hello 回执带回来的，只喂 view 会停在 collect 那一段。改成"按原顺序回放到第一条
   view 为止"，并加一条 `honest.length > 1` 的构造前提断言：**前提不成立时用例要红得说明白，不许悄悄空转**。

## 13-D. 自行决定清单（工单 §0.8：实现细节可自决，报备备查）

1. 粘性那一行**追加**在越界块之后而不是插到最前 —— 受 `nui/05` 既有断言（`snap.log[0]` 必须是越界提示）约束。
   继承态时它自然成为 `trust[0]`，警告位照样说得出解除方式。
2. 粘性只挡**行动**出口（`act()`），不挡 `joinWire()` / `resumeWire()` 本身。理由：连入桌都挡的话，页面连
   "为什么停手"那块局面都渲染不出来，玩家只会看到一个空白页 + 一句警告；裁定要的是"不许继续发行动"。
   顺带一个后果写清楚：`onText` 里那条"凭据作废 ⇒ 自动重入桌"的支路，对已停手的标签页不再触发
   （它本来就带 `!untrusted()` 门），这正是想要的。
3. `readUntrusted` 的降级判据取"读不出一个形状正确的记录就当作没有"，与 `readSaved` 同一口径：
   坏存储不许凭空判人有罪，也不许把页面搞崩；但只要读得出来，就一律停手，不掺"这条像不像真的"的猜测。
4. `count` 只统计"本标签页累计停手次数"，不按手号去重；`hand` 记的是**首次**停手的手号（递增时不变），
   这样横幅里"N 次 + 当年那一条"两个信息都齐，不必再开第三个字段。
5. 测试写成两条而不是一条：`nui/29` 管生命周期（落账/继承/不清/递增/新页干净），`nui/30` 管读取判据
   （坏值降级、合法账照实、两把键互不牵连）。裁定只要求一条，拆开是为了让"红的时候说得出红在哪一层"。
6. 变异给到 7 条（裁定只要求 1 条）：P01 写、P02 读、P03 行动拦截、P04 塌陷驱动、P05 重新入桌顺手清、
   P06 首条被覆盖、P07 计数初值。这一门的每一行都有人"好心改坏"的可能，我不想留没牙的角落。

## 13-E. 与 rev=12 的关系：哪些东西我一行没碰

`netx/client.ts`（那道墙本身）、`netx/protocol.ts`、`netx/room.ts`、`netx/ws.ts`、`src/**`、`webui/scene.ts`、
`webui/paint.ts`、`webui/main.ts`、`webmin/**` 本轮**零改动**；改动面只有 `webui/netplay.ts` 一个文件加
`test/netx-netplay.test.ts` 两条用例。`nui/27`、`nui/28` 与 rev=12 的全部既有用例期望逐字未动。

## 13-F. 已知未覆盖 / 边界（43 段，一行一段，与 `.scratch/r13-cov-report.txt` 逐行对上）

分类码：**K1** 类型层穷尽（`exhausted: never`）；**K2** 恒真兜底（判据对象是自己刚算出来的量）；
**K3** §5(c) 房间自检分支（按构造不可达，前提写成可反驳的形式）；**K4** 进程入口面（子进程被 SIGKILL ⇒ V8 不刷 coverage）；
**K5** 被更外一层先拦住（按构造不可达）；**K6** 画布 / DOM 既有类别；**K7** 本轮变更面之外的老面；**K8** 可补未补（成本已量过）。

| `netx/client.ts:166-167` | return after merging I hold ${String(totalSoFar + v.log | K2 | 合并后条数自检：比的量是自己刚算出来的 `totalSoFar + v.log.length`，恒真兜底（rev=10 §5(a) 同档） |
| `netx/client.ts:353-355` | const exhausted: never = msg; | K1 | `exhausted: never = msg`：Down 的全部 tag 都在 switch 里有分支。前提 = `DOWN_SPEC` 的 tag 集合与 `inbound` 的分支集合一致（proto/05/06 两侧集合都在断言里）；只有加新 tag 忘了处理才可达，而那正是它的用途（编译期拦） |
| `netx/frames.ts:171` | throw new FrameError('too_large', payload ${String(len) | K8 | `too_large`：需要一个 8 字节长度字段 > 2^53 的帧头，真客户端发不出这种帧。可补（raw 写 14 字节头即可），本轮未做 |
| `netx/frames.ts:250-251` | throw new FrameError('bad_close', 'close reason is not v | K8 | `bad_close`：close 帧载荷不是合法 UTF-8。可补（ws/06 的 raw 工装改 3 行），本轮未做 |
| `netx/protocol.ts:213-215` | const exhausted: never = spec; | K1 | `exhausted: never = spec`：Spec 的 kind 全集都在 `check()` 里；新增 kind 忘了分支就编译不过 —— 这条段的"零覆盖"正是它在工作 |
| `netx/room.ts:171-174` | fault = egress blocked for seat ${String(seat)}: ${why} | K3 | §5(c) ①：`fault = egress blocked for seat N`。前提 = `src/engine/project.ts` 的白名单正确（别家牌、未看牌时自己的牌、settled 前的种子三类都进不了投影）；由 `engine-project` 的正负两极断言 + `nui/04` 三阶段整文本搜索 + `leak/*` 守。只有投影自己写错才可达 |
| `netx/room.ts:333-335` | fault = reveal self-check failed: ${why}; | K3 | §5(c) ②：`reveal self-check failed`。前提 = `commitOf` / `seedFromShares` / `revealMatches` 三者互逆（sha256 无碰撞；seed/11 固定向量 + seed/12 的 4096 组互不相同 + proto/12 出口自检）。只有三者之一被改坏才可达 |
| `netx/room.ts:337-339` | fault = 'reveal self-check failed: revealed shares no lo | K3 | §5(c) ③：同一族的第二条（"揭示出来的份额不再合成出当初那个种子"）。前提同上，多出的一条是 `seedFromShares` 的 party 排序稳定（seed/13/14 钉码点序与前缀相撞） |
| `netx/room.ts:360-362` | fault = fault ?? authoritative engine rejected its own  | K3 | §5(c) ④：`authoritative engine rejected its own action`。前提 = `checkAction` 与 `apply` 对同一份 state 判定一致（`illegal/*` 全集 + `m2-fuzz` 1000 局的五类不变量在守这条）。只有两者判定分叉才可达 |
| `netx/room.ts:610-611` | const exhausted: never = up; | K1 | `exhausted: never = up`：Up 的 tag 全集都在分发里（join/nonce/action/resume/ping/pong） |
| `netx/serve.ts:106-107` | process.stderr.write(收尾失败：${String(err)}\n); | K4 | 收尾失败的 `process.exit(1)`：需要 listening server 的 `close()` 自己 reject。`srv/03` 走的是干净退出那一支 ⇒ 这一支没进去 |
| `netx/serve.ts:126-127` | // 没有可读的 stdin（被重定向关掉了）⇒ 只剩信号那两条路 | K8 | 无可读 stdin 那一支：`runNode` 给子进程留了可写的 stdin 管道，所以走的是"读到 quit"那条。可补（spawn 时把 stdin 设成 ignore），本轮未做 |
| `netx/ws.ts:95-97` | dropLink(link, encodeClose(1011, 'server produced an inv | K5 | 服务端 produce 出非法下行 ⇒ 1011 关闭。前提 = `room` 发出的每一条 down 都先过 `encodeDown`/`DOWN_SPEC`（proto/12 专门钉这个出口自检）；只有那两处一起坏掉才可达 |
| `netx/ws.ts:130-131` | // 已经在断开流程里，忽略 | K8 | 断开流程重入时忽略第二次 close。我没有构造出"同一 link 两次 close 事件"的路径（Node 的 socket 通常只派发一次），也没实测过它会不会派发两次 ⇒ 归"可补未补 + 我未验证"，不写成按构造不可达 |
| `netx/ws.ts:179-181` | refuseUpgrade(socket, 400, 'Bad Request', 'connection he | K5 | `Connection` 不含 upgrade ⇒ 我们答 400 那三行（rev=12 应修 2 之后统一走 `refuseUpgrade()`，正文 `connection header lacks upgrade`）。前提 = 本机 Node（v24.19.0，llhttp）在把请求派发成 `upgrade` 事件**之前**已经要求该头以 `upgrade` 成词；`ws/08` 用 10 种写法实测，全部停在 Node 层的 404。这一档**改法之后仍然够不到**，但正文差了一件事：`ws/09` 现在能证明"我们的 400 与 Node 的 400 可分"（零正文 vs 有正文），rev=11 时不能 |
| `netx/ws.ts:229-230` | dropLink(link, encodeClose(1002, 'protocol error')); | K8 | `encodeClose(1002, protocol error)`：`ws/06` 第④打的是"未掩码的数据帧"那条 1002 出口，这里是同一档的另一条出口（合法掩码 + 未分配 opcode / 非法 RSV 位）。可补，本轮未做 |
| `src/ai/honest.ts:174-176` | const first = legal[0]; | K7 | 老面（M2 起就在）：`legal[0]` 兜底。前提是"引擎在终局之前至少给一个合法行动（fold）"，与 `illegal/*` 的必拒清单互相印证；不在 M5 变更面内 |
| `src/engine/actions.ts:158-160` | const exhausted: never = action; | K1 | `exhausted: never = action`：ActionKind 全集 |
| `src/engine/actions.ts:166-169` | let state = startHand(config); | K7 | 老面：`startHand` 的另一支，M5 变更没碰它 |
| `src/engine/settle.ts:71-72` | throw new TypeError(settle() called in phase ${state.ph | K7 | 老面：`settle()` 的相位守卫（非终局相位调用才抛）；`engine-money` 全部按合法相位调用 |
| `src/engine/settle.ts:102-103` | return seatAt(state, seat).chips; | K7 | 老面：分池时读某个座位筹码的一支，脚本与 fuzz 都没走到那个组合 |
| `src/engine/state.ts:105-106` | return seatAt(state, seat).active; | K7 | 老面：`isActive` 之类的小助手，实际调用点都走别的分支 |
| `src/engine/state.ts:122` | return -1; | K7 | 老面：找不到时 `return -1` 的兜底 |
| `src/engine/state.ts:151-153` | const exhausted: never = kind; | K1 | `exhausted: never = kind`：`priceOf` 的 ActionKind 全集（A2 ① 把 `actionCost` 改成委托给它之后，这一支仍然是穷尽检查，不是运行时路径） |
| `src/engine/state.ts:287` | return String(value); | K7 | 老面：哈希里对未知值 `String(value)` 那一支（构造不出这种值） |
| `src/engine/validate.ts:161-162` | return checkAction(state, action).ok; | K7 | 老面：`checkAction(...).ok` 的薄封装零调用点 —— 严格说也是死接口，但它在 M5 变更面之外（工单口径：一次只做当前批准的里程碑），本轮**不动**，记在这里备查 |
| `src/rules.ts:125-127` | const exhausted: never = spec; | K1 | `exhausted: never = spec`：Spec 的 kind 全集（rev=10 §5(a) 同档） |
| `webmin/model.ts:340-344` | return { | K7 | M1.5 单机侧的"离桌占位格"。这一段正是应修 7 那条论证的依据：**在 M1.5 里它按构造不触发**（`ledger()` 与 `seatCells()` 的 departed 分支零覆盖即此证据），所以单机页那个标签当前不会被自己的口径证伪 |
| `webmin/model.ts:487-488` | return { ok: false, session: { ...s, note: 不认识的意图 ${Str | K7 | M1.5：`unknown_intent`（页面只会发六种意图，构造这种输入要绕过 UI） |
| `webmin/model.ts:524` | return null; | K7 | M1.5：机器人候选为空时 `return null` |
| `webmin/model.ts:526-528` | const exhausted: never = intent; | K1 | M1.5：`exhausted: never = intent` |
| `webmin/model.ts:568-569` | return { ok: false, session: { ...cur, note: 机器人走了 ${St | K7 | M1.5：`bot_loop` 卡住的兜底（需要机器人永远不让位） |
| `webmin/model.ts:615-617` | const exhausted: never = mode; | K1 | M1.5：`exhausted: never = mode` |
| `webmin/serve.ts:123-132` | // 兜底：以上任何一步将来有人在 await 之前抛出，都不许再变成进程级故障（必修 2 的那一类）。 | K4 | `serveStatic` 外层兜底（必修 2 那一类防的"将来有人在第一个 await 之前抛"）。现在没有任何输入能走到这里：畸形转义在 `resolveStatic` 就回 400，读文件失败在 `readAsset` 的 catch 里回 404。可补的只有"故意往里塞会抛的代码"——那是变异测试的活，不是用例 |
| `webmin/serve.ts:136-140` | // .catch 不是装饰：serveStatic 现在自己不会抛，但"将来有人往 await 之前塞进会 | K4 | `createServer` 回调里那层 `.catch`：**每一个请求都真的经过这一行**（`srv/07` 真 spawn 打了 7 发），但子进程是被 `SIGKILL` 送走的 ⇒ V8 不落 coverage ⇒ 报告里显示未覆盖。这是"跑到了但取证不到"，不是"没跑到" |
| `webmin/serve.ts:153-159` | server.listen(port, '127.0.0.1', () => { | K4 | 独立运行时的 `listen` 回调（印 `炸金花 M1.5 → http://127.0.0.1:<真端口>/` 那一段）：同上，`srv/07` 确实让它印过。要拿到这段的覆盖，子进程必须**干净退出**（对照 `netx/serve.ts:75-86` 那条：靠 `quit` 退出才刷出来，oracle 自检 B 条） |
| `webui/netplay.ts:484-500` | const cards: Card[] / null = row.cards === 'unknown' ? n | K5 | "在局但不在名册"那一支（`view.seats` 里有、`rosterOf()` 里没有）。前提 = 服务端每条 `view`/`patch` 都带全量 roster（`room.ts` 的 sendView/sendCollect 都带），所以物理上不出现；这一支是"真出现了也不许悄悄丢掉一家"的保险。**rev=12 撤回的旧前提**：这里曾写"客户端无从独立核对" ⇒ 那个说法已被 `checkMoney` 证伪（见 12-A/12-D），但它与本段是否可达无关，本段的定性不变 |
| `webui/netplay.ts:522-523` | settlement.push(余数 1 分给距庄家下家最近的赢家：${nameOfSeat(terminal | K8 | 余数文案：需要一手牌打出"多个赢家 + 池不能被人数整除"（showdown 平局按 `split` + `remainderTo >= 0`）。本轮没能构造出这个形状，不是按构造不可达。可补：定向挑一组牌面（`classify` 相等）再结算 |
| `webui/netplay.ts:573` | return phase; | K1 | `viewWord` 的兜底 `return phase`：三个 phase 都在前面被覆盖，类型层不可达（rev=10 §5(b) 已定性"不算缺口，但要列出来"） |
| `webui/paint.ts:40-47` | ctx.strokeStyle = p.color; | K6 | 描边那一支：无头侧只数"调用几何参数"（`ui3/12` 那一族），真正走到描边需要一张能画出 stroke 的 canvas；属既有 Canvas/DOM 类别 |
| `webui/paint.ts:49-51` | const exhausted: never = p; | K1 | `exhausted: never = p`：Primitive 的 kind 全集（rect/ellipse/text/line） |
| `webui/scene.ts:178-180` | lines.push(word.slice(0, Math.max(1, Math.floor(avail /  | K6 | 超宽"单词"截断那一支：需要日志里出现一个长度超过整行宽度的连续 token；本轮的文案都被 `fitSize` 缩字号解决了，没走到 slice 那一支 |
| `webui/scene.ts:257-258` | return notice(w, h, st, ${String(n)} 人桌的放大的牌面需要至少 ${Str | K6 | "窗口太小"的另一条文案（放大牌面宽度不够那一支）：需要 `< OWN_PLATE.w + pad*2` 的极窄窗口，无头 `buildScene` 的既有用例走的是"高度不够"那一支 |

另有 5 个文件在 oracle 里是 **100.0%**（netx/seed.ts 112/112、netx/sha256.ts 113/113、src/cards.ts 135/135、src/engine/project.ts 62/62、webui/bridge.ts 153/153），无未覆盖段。

**说明段 1（§5(c) 的定性）**：上表 K3 那四行是服务端版的"第二道墙"。按裁定 8.11，我不构造用例去踩它们（那需要往交付代码里注入 bug，与"不许为通过特判"同一类麻烦），但每一行都写出了**可被反驳的前提**；任何一条前提被证伪，对应的 K3 立刻变成真缺口。

**说明段 2（K4 的取证边界）**：`webmin/serve.ts` 那三段里至少有 `:136-140` 与 `:153-159` **本轮确实执行过**（`srv/07` 真 spawn 打了七发请求、监听行也印过）。它们显示未覆盖的原因是子进程被 `SIGKILL` 送走、V8 不刷 coverage。这与 `netx/serve.ts:83-93` 那条自检正好互为反证：**要拿到进程入口面的覆盖，子进程必须干净退出**（行号按 rev=11 重标定后的 oracle 记；rev=10 时同一条叫 75-86）。下一轮如果有人要我把这两段变成真覆盖，办法是给 `webmin/serve.ts` 也加一条 `quit` 入口（那是交付面扩口子，不是测试能自己解决的）。

**说明段 3（D02 / 应修 8 的配置前提）**：`dealerAmong` 与旧写法的恒等，只在 `startRoom` 硬编码 `firstDealer: 0`（`netx/serve.ts`）时成立。若配置成 `createRoom({ seats: 6, firstDealer: 3 })` 而只有座位 0、1 入了座，`dealerAmong` 的绕回兜底是**可观测**的：庄家会从 3 挪到 0，且这一手照发；对照组是没有兜底时 `startHand` 抛 `bad hand config: dealer 3 is not one of the seats`。等价性本身我不再论证一次（8.10 说三路同向已足够）。

**说明段 4（`ws/08` 仍无行为变异，但 rev=12 给了它半条源码牙）**：`ws/08` 钉的是"本机 Node 的分档事实"，纵深防御的 `ws.ts:179-181` 够不到 ⇒ **行为**上把整段删掉也不会有用例变红（这一条与 rev=11 同口径，我不改判）。要说清的是变了的那一半：应修 2 之后 `ws/09` 把这句 guard 的**正文文本**钉在源码上（五条拒绝的文本互不相同），所以"删掉那三行"现在会让 `ws/09` 红 —— 但那是**文本判据**，不是"这条分支被走到的证据"。行为面仍然是地面真值记录。

**说明段 5（`webui/main.ts` 仍然 0 覆盖）**：与 rev=10 同口径 —— 那一层是时钟、socket、DOM、`crypto.getRandomValues` 的唯一出口，无头侧不进它。它的正确性由真浏览器验收（8.7，归监督方）+ `nui/17` 的模块图遍历（进口只有一个 `netx/`）+ `nst/10`/`nst/12` 的源码判据三件一起支撑；本轮新增的 `onText` 纯管道断言（`main.ts` 的 `onmessage` 只做 `for (const up of net.onText(...)) ws.send(up)`）也在 11-A 应修 2 那行的凭据链里。

**说明段 6（oracle 自检 A 本轮发生行漂移，我没有拿它当"覆盖变好了"）**：final3 的 A 条把行号**写死**在 `netx/ws.ts:146-149`，而 rev=12 应修 2 在同一个文件里新增了 `refuseUpgrade()`，500 兜底整体下移 ⇒ 146-149 现在落在 `/health` 的 JSON 体上（那几行本来就全覆盖）。所以原样跑出来的 `A 期望 1111 实得 1111 OK` 是**行号漂移的假证据**，正是 final3 头部自己警告过的那种失效（rev=11 的 C 条就栽在这里）。处理方式：不改他们的脚本（`.audit/` 只读），用 `.scratch/r12-mk-covcopy.mjs` 生成一份**逐字副本**（diff 只有 A 那一行），把锚点重标定到 `162-164` ⇒ `A 期望 111 实得 111 OK`。两份报告都留着（`r12-cov-report.txt` / `r12-cov-report-repin.txt`），`diff` 只差 A 那一行 ⇒ **合计读数（22 文件 / 43 段 / 5683 行覆盖 5543 = 97.5%）不受重标定影响**。结论没变：ws/07 真打到了 500 兜底；变的是"我知道这件事的证据行号换了地方"。

# SELF-REVIEW.md —— rev=12 自评表（本轮交付：rev=11 裁定的必修 1 项 + 应修 4 项 + §8 那八条验收口径）

对应裁定：`REVIEW.md` 顶部那份 **rev=11 裁定**（§3 必修 1、§4 应修 1–4、§5 覆盖对账、§8 八条）。
测试输出原文：`TEST-OUTPUT.md` 第 12 节。覆盖明细：`.scratch/r12-cov-report.txt`（用监督方 `.audit/rev11/sup-cov-final3.mjs` 原样跑，未改它）。

## 12-A. 必修 1 逐条自评（含"我上一轮那条断言为什么是假的"）

| 条目 | 自评 | 凭据（第一手） |
|---|---|---|
| 那条假边界：**"chips/pot 客户端无法独立核对"** | **已撤回并改写** | 我 rev=11 的 `nui/25` 把"我那一刻没想出办法"写成了"没有办法"。复审用四条恒等式证伪之后我自己复算：三条恒等式全部只依赖投影自身，不需要第二个来源。**改的是断言的形状**：`nui/25` 改写为"seq 面与采纳面"（合法帧被采纳 / 同一条重放被 seq 抓住 / 被拒帧不进快照），数字那一面交给 `nui/27`/`nui/28`，两个面都不含糊 |
| (a) `pot === Σ committed` | **过** | `netx/client.ts::checkMoney`；`nui/27` 的 `pot` 与 `my-committed` 两支由它抓 |
| (c) 同一手内**每一家** `chips+committed` 恒定（逐座位版） | **过** | 同一处。**没照抄我手上的建议字面**：复审给的 (c) 只验"我自己那一格"，那会漏掉 `other-chips` 那一支（复审自己的表里那一支是靠 (d) 抓的）⇒ 我把 (c) 写成逐座位恒定，`my-chips` / `other-chips` / `committed-and-pot` 三支都由它抓 |
| (d) 全桌 `Σ(chips+committed)` 恒定 | **过，且有自己的牙** | 逐座位版本抓不到"凭空多一个假座位"（新座位没有基准可比）⇒ (d) 不是冗余。`nui/27` 的第六支 `extra-seat` 专门钉它，变异 N03 确认摘掉 (d) 那一支就翻红 |
| 成立区间（守卫不许拍脑袋写） | **过：量出来的** | 探针 `.scratch/r12-invariants.ts` 跑 6 手 × 3 家 = **232 帧**（看牌 / 跟注 / 加注 / 比牌淘汰 / 弃牌 / 托管到点 / 结算 / 换手），逐帧记 (a)(c)(d) 与在座集合：**只有 `settled` 那一帧合法地破**（池分发完毕归零、`committed` 记的仍是本手投入、赢家余额同时进账），`betting` 与 `awaitingSettle` 全程 0 处不符 ⇒ `phase === 'settled'` 这道守卫有实测依据，不是为了让用例变绿 |
| 复用既有停手机制，不新开通道 | **过** | 检查挂在 `checkView` 的**最后一道**（`logShape` 与条数自检之后），返回值走既有 `violate('snapshot unusable: …')` / `violate('patch unusable: …')` ⇒ 提示行、按钮塌成"已停手"、`act()` 拒发全都是现成那一套。基准只对被采纳的帧落笔（放在最后就是为此） |
| 换手/换桌重置基准 | **过** | `enterHand` 与 `renew()` 里都置 `money = null`（跨手比必然假阳性：上一手的池已进账） |
| 误报对照（"不许靠放宽检查换绿"） | **过** | `nui/28`：三手真房间流量、看牌/跟注/加注/比牌轮着来，**逐帧**断言 `violations` 恒空 + 采样数下限（防空转）。变异 N04（撤掉 settled 守卫）正是被这条用例翻红 ⇒ 守卫不是装饰 |
| 牌面那一族不许打散 | **过** | `nui/24`、`proto/07`、`proto/08`、`leak/05` 原样保留且全绿；变异 M13（`checkViewLeak` 里那支 `return` 改成 `continue`）现在被四条一起抓（本轮重跑，见 TEST-OUTPUT 12.3） |
| §8.1 的判据形式 | **过（无头侧）** | 六支注入各自断言：被抓 ⇒ `untrusted=true`、被拒帧不进快照（`snap.pot` 停在上一帧的好数字）、按钮塌成"已停手"、`act()` 返回 `sent:false`；同一条 patch 的诚实原件重喂仍能接上 seq（⇒ "被拒"不吞 seq）；注入只落到被注入那一条连接，另一家零越界 |

## 12-B. rev=11 应修 1–4 逐条自评

| 条目 | 自评 | 凭据 |
|---|---|---|
| **应修 1** 三处文书（一处实质矛盾） | **过** | ① `DELIVERY.md` 里"主路径 `:394-410` 都进来了"那句已改成事实：**roster 映射那一段（`netplay.ts` 主分支返回座位格的 `:366-398`）确实已进覆盖**（本轮 oracle 里 `netplay.ts` 只剩 `:405-421`、`:443-444`、`:494` 三段未覆盖），而 `:405-421` 是 `.concat()` 的"在局但不在名册"兜底 = K5 按构造不可达 —— 行号与 12-F 逐字一致（rev=11 时它叫 `403-419`，本轮因应修 3 加了两行注释而漂移 2 行，我按 oracle 输出记，不手抄旧号）；② `SELF-REVIEW` 11-A 的交叉引用由"11-C"改指 **11-B 的 8.3 那一行**；③ 11-B 里"DELIVERY 改为引用 BRIEF §4 M5 ⑤ 的可执行版本"那句与实物不符 —— 已按实物改写（本轮 DELIVERY 的 notes 里就真的写了这句引用，描述与实物对齐） |
| **应修 2** 四处 400 不可归因 | **过（选了"加正文"这一支）** | 我先用 `.scratch/r12-fold.ts` 把两边的字节量清楚：obs-fold 折行、坏请求行、我们那四处 guard **全部逐字相同**（`HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n`，零正文）⇒ 复审"归因要开三个进程做覆盖差分"这句话是实测。改法：新增 `refuseUpgrade()` 统一形状、五条拒绝各带一句互不相同的纯文本正文（`upgrade header missing` / `connection header lacks upgrade` / `sec-websocket-version missing` / `sec-websocket-key invalid` / 426 的 `version not supported`），RFC 6455 §4.2.1 允许带正文。用例 `ws/09`：三条**可达** guard 的正文两两不同 + 426 另有自己的正文 + **对照组**是 Node 自己答的那两发仍然零正文 ⇒ 我们的正文与它必然不同；够不到的那一条（`:164`，`ws/08` 已给出分档实测）钉在源码上，五者互不相同。变异 N06（把 version 那条正文并回 upgrade 那句）被 `ws/09` 抓 |
| **应修 3** collect 分支缺 `.slice(-40)` | **过（两条都做）** | `webui/netplay.ts` collect 分支补 `.slice(-40)`；`nst/13` 钉三件事：两条 `log:` 装配语句**同一个**上限、`notices` 窗口 ≤ 上限、外加一组"摘掉上限/把窗口撑到 999"的对照。顺手把同族的一个洞也钉了：`nst/13` 断言 `test/netx-ws.test.ts` 里 `setTimeout` 的**精确数量**仍是 3 处，因为 `nst/09` 的时钟例外是按下限给的（">=3"），有人加看门狗就会悄悄把例外面撑宽。变异 N05 被 `nst/13` 抓 |
| **应修 4** 复核以"无法独立核对"为前提的披露行 | **过** | 12-F 里所有理由重写：`netx/client.ts` 新增段的覆盖情况如实列出；`webui/netplay.ts:405-421` 的 K5 前提改写（"服务端每条 view/patch 都带全量 roster"）；被撤回的旧前提（"公开数字没有第二来源可核对"）在 12-F 说明段里点名作废，并写明它错在哪 —— 而不是悄悄删掉 |

## 12-C. 计数与回归

- **用例**：`RUNNER files=29 cases=412`、`SUMMARY pass=412 fail=0 total=412`、`RESULT=ALL_PASS`（rev=11 交付时 408）。
- **零回归**：`comm -23 <rev=11 的 408 条 ID> <本轮 412 条>` = **空**（两边都从 `PASS` 行机械抽取、`sort` 后比，见 TEST-OUTPUT 12.2）。
  本轮新增 4 条：`nui/27`、`nui/28`、`ws/09`、`nst/13`。`nui/25` **改写但编号保留**（§8.2 要求），`client/10` 是**加强既有条**而非复用编号。
- **基线文件本身有一处缺陷，我一并修了**：`.scratch/r11-ids.txt` 只有 406 行 —— `nui/26` 与 `srv/08` 是在它生成之后才落地的，所以它不是 rev=11 交付时的 408。本轮从 `PASS` 行重新抽出规范基线 `.scratch/r11-ids-extract.txt`（408 行、其中 3 个 key 各出现两次 = `classify/*` 那三个带参数的用例名，两文件一致 ⇒ 不影响 `comm` 判据），零回归以它为准。**旧文件保留未删**。
- **双跑**：`node test/run.ts` ×2 与 `npm test` ×2 各自逐字节一致，四个 sha256 记在 TEST-OUTPUT 12.1；`npx tsc --noEmit` 零诊断。
- **变异**：本轮 7 条（N01–N07）**全部 caught**，另把 rev=11 那 13 条里宿主文件本轮被改过的 10 条全部复跑，**也全部 caught**（0 survived / 0 还原失败）。
  过程里有两件事值得单独看：N07 第一次跑出 `SKIPPED`（我的锚点缩进写错，工装拒绝执行 —— 判对了）；N04 的命中列表曾被工装截断到 8 条，导致"期望 `nui/28` 翻红"这句话拿不到证据 ⇒ 已改成不截断并重跑，实得 **21 条红、`nui/28` 在内**（逐条列表见 TEST-OUTPUT 12.3）。
- **覆盖**（监督方 oracle v4 原样只读 + A 条锚点重标定副本）：22 文件 / 43 段 / 5683 可执行行覆盖 5543 = **97.5%**；`netx/client.ts` 379/384 = 98.7%（新增的 `checkMoney` 整段已覆盖）、`netx/ws.ts` 236/246 = 95.9%、`webui/netplay.ts` 504/524 = 96.2%。
  四条地面真值自检全 OK；**其中 A 条本轮发生行漂移**，我没有拿假的那一次读数当结论，见 12-F 说明段 6。
- **探针**：`.scratch/r12-invariants.ts` 232 帧 / 非 `settled` 不符 **0** / `settled` 豁免 **42** / 真墙 violations **0** / `PROBE_SELFTEST_PASS`。
  这件工装的自检**第一次是 FAIL**（三类账混成一个数），经过写在 TEST-OUTPUT 12.5 末段。

## 12-D. 本轮被"证据"逼出来的六件事（都不是我自己想加的）

1. **我上一轮写了一条假边界。** `nui/25` 那句"客户端无法独立核对"不是笔误，是**把"我没想出办法"写成了"没有办法"**，而且钉成了断言 —— 后果比没有用例更糟：下一轮的实现者和复审者都会因此不去查这块。
   我自己的探针在诚实流量上跑出 232 帧零不符之后，这件事没有回旋余地：**该改的是我的断言，不是数据**。同步把 12-F 里以它为由的披露行全部重判（应修 4）。
2. **(c) 不能照抄"只验我自己那一格"。** 复审给的 (c) 字面只覆盖自己，那么 `other-chips` 就只剩 (d) 一条腿；而 (d) 又被提醒"依赖名册恒定、我没验过"。我把它写成**逐座位恒定**：`my-chips`/`other-chips`/`committed-and-pot` 三支都由它抓，不需要依赖"名册会不会变"这种我没验的东西。
3. **(d) 一开始真的没有牙。** 逐座位恒定 + (a) 已经把前五支全覆盖，(d) 是"看起来更严格其实冗余"的那条。为了不交付一条没被钉住的检查，我构造了第六支 `extra-seat`（凭空多一个 `committed=0` 的假座位：(a) 仍然成立、新座位没有基准可比 ⇒ 只有 (d) 能抓），并用变异 N03 确认摘掉 (d) 那一支就翻红。
4. **夹具里躺着一个真实房间发不出的形状。** 新的算术检查第一次跑全量就把 `client/10` 判红了：那条夹具是"拿两家的投影再把 0 号位那一行删掉"，于是 `pot=2` 而 `Σcommitted=1`。这不是检查太严 —— 诚实房间发不出这种投影（池就是各家投入之和）。修法是把旁观者形状改成"这一手本来就没有 0 号位"，而不是放宽检查。
5. **oracle 的"地面真值"也会假绿 —— 因为锚点是写死的行号。** 自检 A 钉 `netx/ws.ts:146-149`，而我本轮为了应修 2 在同一个文件里插了 `refuseUpgrade()`，500 兜底漂到 `162-164`；146-149 现在落在 `/health` 的 JSON 体上，本来就全覆盖 ⇒ **原样跑照样打印 "A 1111 OK"，但它说的已经不是那三行了**。这正是 final3 头部自己警告、rev=11 的 C 条栽过的模式。我没有改他们的脚本，而是生成一份逐字副本重标定 A（`111 OK`），两份报告的 `diff` 只差 A 那一行 ⇒ 合计读数没被污染。**教训：拿行号当锚的地面真值，每次改动宿主文件都必须重新核一遍。**
6. **我自己这三件工装的自检，本轮全都先红过一次。** ① 探针初版把"合法豁免"和"存活标记跳变"混进"不符"总数，跑出 `PROBE_SELFTEST_FAIL`（75 条），分类改对之后才是 232 帧 / 非 `settled` 0 处 / 豁免 42 次；② 变异工装把命中列表截到 8 条，于是"N04 被 `nui/28` 翻红"这句话在报表里看不到证据，改成不截断重跑才拿到 21 条；③ rev=11 的 ID 基线 `.scratch/r11-ids.txt` 只有 406 行（`nui/26`、`srv/08` 在它生成之后才落地），本轮从 rev=11 的原始运行产物重抽 408 行当规范基线。**三条都是判据松了而不是结论错了**，但按工单"测试脚本自身先被验证"的口径，松了的判据等于没有判据，所以逐条写在这里而不是悄悄修完不提。

## 12-E. 自行决定清单（本轮新增）

1. `checkMoney` 挂在 `checkView` 的**最后一道**，而不是紧跟 `checkViewLeak`。理由：它会落一个"这一手"的基准；一条只因 `logShape`/条数就被拒的投影若顺手改掉基准，后面拿假基准去比，报出来的就是"我自己的状态机拧了"而不是"服务端越界"。
2. (c) 实现为**逐座位**恒定（覆盖每一行），(d) 保留为全桌恒定并对 `extra-seat` 这一支负责。两条互补，都有用例与变异。
3. 六支注入而不是五支：多出来那支专门给 (d) 造牙；`committed-and-pot` 那支专门让 (a) 失效，逼出手内恒定那条腿。
4. "被拒不吞 seq"这件事用**同一条 patch 的诚实原件重喂**来证，不依赖 `turnMs`/托管定时器形状（第一版我用"推进到托管再收一帧"来验，本机跑出来 seq 根本没推进 —— 那是一个时序假设，不是判据；改成确定性构造之后才站得住）。
5. 握手拒绝统一到 `refuseUpgrade()` 一个出口（形状一致、正文各异），而不是四处各写一遍字符串 —— 少了复制粘贴，正文就不会哪天又被并回同一串。
6. `nst/13` 里对 `setTimeout` 数量取**精确等式**而非下限：时钟例外是这个项目唯一允许用真实计时的地方，撑宽例外的最好时机就是它被加进来的那一次。
7. 覆盖取证仍用监督方那份脚本（`sup-cov-final3.mjs` 原样，只读），不改它、不纳进交付面。**但本轮它的自检 A 发生了行漂移**（应修 2 在 `netx/ws.ts` 插了 `refuseUpgrade()`，500 兜底从 146-149 漂到 162-164），我没有拿那一次 "OK" 当结论，而是用逐字副本重标定后复核（`A 期望 111 实得 111 OK`）。三条地面真值自检本轮按 §8.5 记：A/C/D 全为 1、B 为 `1111111`（脚本里 B 的 `want` 是 `has1`，与裁定文字写的 `1111011` 不符 —— 已在 12-G 8.5 那行点出来请判）。
8. "被拒不采纳"这件事现在有**两条**变异分别钉：N07 打 `case 'patch'`（`client.ts:290-296`）、N08 打 `case 'view'`（`:277-283`）。起因是我把 N07 的期望写成了"`nui/27` + `client/10`"，实得里没有 `client/10` —— 查下去不是用例没牙，而是**它盯的是另一条分支**（`client/10` 注入的是快照）。两条分支各给一条变异，比一条变异覆盖两件事更省事，也更难被下一次重构悄悄合并。

## 12-F. 已知未覆盖 / 边界（43 段，一行一段，与 `.scratch/r12-cov-report.txt` 逐行对上）

分类码：**K1** 类型层穷尽（`exhausted: never`）；**K2** 恒真兜底（判据对象是自己刚算出来的量）；
**K3** §5(c) 房间自检分支（按构造不可达，前提写成可反驳的形式）；**K4** 进程入口面（子进程被 SIGKILL ⇒ V8 不刷 coverage）；
**K5** 被更外一层先拦住（按构造不可达）；**K6** 画布 / DOM 既有类别；**K7** M5 变更面之外的老面；**K8** 可补未补（成本已量过）。

读数（oracle v4 原样跑）：**22 个文件、43 段、可执行行 5683 覆盖 5543 = 97.5%**；
本轮新增的 `netx/client.ts::checkMoney`（必修 1）整段都在覆盖里 —— `client.ts` 只剩 `:166-167`（K2 恒真兜底）
与 `:353-355`（K1 穷尽）两段老账；`webui/netplay.ts` 的 `.slice(-40)`（应修 3）在 collect 主路径上，已覆盖。

| 段 | 源码那一句（截断） | 分类 | 为什么没测到 / 前提 |
|---|---|---|---|

| `netx/client.ts:166-167` | return after merging I hold ${String(totalSoFar + v.log | K2 | 合并后条数自检：比的量是自己刚算出来的 `totalSoFar + v.log.length`，恒真兜底（rev=10 §5(a) 同档） |
| `netx/client.ts:353-355` | const exhausted: never = msg; | K1 | `exhausted: never = msg`：Down 的全部 tag 都在 switch 里有分支。前提 = `DOWN_SPEC` 的 tag 集合与 `inbound` 的分支集合一致（proto/05/06 两侧集合都在断言里）；只有加新 tag 忘了处理才可达，而那正是它的用途（编译期拦） |
| `netx/frames.ts:171` | throw new FrameError('too_large', payload ${String(len) | K8 | `too_large`：需要一个 8 字节长度字段 > 2^53 的帧头，真客户端发不出这种帧。可补（raw 写 14 字节头即可），本轮未做 |
| `netx/frames.ts:250-251` | throw new FrameError('bad_close', 'close reason is not v | K8 | `bad_close`：close 帧载荷不是合法 UTF-8。可补（ws/06 的 raw 工装改 3 行），本轮未做 |
| `netx/protocol.ts:213-215` | const exhausted: never = spec; | K1 | `exhausted: never = spec`：Spec 的 kind 全集都在 `check()` 里；新增 kind 忘了分支就编译不过 —— 这条段的"零覆盖"正是它在工作 |
| `netx/room.ts:171-174` | fault = egress blocked for seat ${String(seat)}: ${why} | K3 | §5(c) ①：`fault = egress blocked for seat N`。前提 = `src/engine/project.ts` 的白名单正确（别家牌、未看牌时自己的牌、settled 前的种子三类都进不了投影）；由 `engine-project` 的正负两极断言 + `nui/04` 三阶段整文本搜索 + `leak/*` 守。只有投影自己写错才可达 |
| `netx/room.ts:333-335` | fault = reveal self-check failed: ${why}; | K3 | §5(c) ②：`reveal self-check failed`。前提 = `commitOf` / `seedFromShares` / `revealMatches` 三者互逆（sha256 无碰撞；seed/11 固定向量 + seed/12 的 4096 组互不相同 + proto/12 出口自检）。只有三者之一被改坏才可达 |
| `netx/room.ts:337-339` | fault = 'reveal self-check failed: revealed shares no lo | K3 | §5(c) ③：同一族的第二条（"揭示出来的份额不再合成出当初那个种子"）。前提同上，多出的一条是 `seedFromShares` 的 party 排序稳定（seed/13/14 钉码点序与前缀相撞） |
| `netx/room.ts:360-362` | fault = fault ?? authoritative engine rejected its own  | K3 | §5(c) ④：`authoritative engine rejected its own action`。前提 = `checkAction` 与 `apply` 对同一份 state 判定一致（`illegal/*` 全集 + `m2-fuzz` 1000 局的五类不变量在守这条）。只有两者判定分叉才可达 |
| `netx/room.ts:610-611` | const exhausted: never = up; | K1 | `exhausted: never = up`：Up 的 tag 全集都在分发里（join/nonce/action/resume/ping/pong） |
| `netx/serve.ts:106-107` | process.stderr.write(收尾失败：${String(err)}\n); | K4 | 收尾失败的 `process.exit(1)`：需要 listening server 的 `close()` 自己 reject。`srv/03` 走的是干净退出那一支 ⇒ 这一支没进去 |
| `netx/serve.ts:126-127` | // 没有可读的 stdin（被重定向关掉了）⇒ 只剩信号那两条路 | K8 | 无可读 stdin 那一支：`runNode` 给子进程留了可写的 stdin 管道，所以走的是"读到 quit"那条。可补（spawn 时把 stdin 设成 ignore），本轮未做 |
| `netx/ws.ts:95-97` | dropLink(link, encodeClose(1011, 'server produced an inv | K5 | 服务端 produce 出非法下行 ⇒ 1011 关闭。前提 = `room` 发出的每一条 down 都先过 `encodeDown`/`DOWN_SPEC`（proto/12 专门钉这个出口自检）；只有那两处一起坏掉才可达 |
| `netx/ws.ts:130-131` | // 已经在断开流程里，忽略 | K8 | 断开流程重入时忽略第二次 close。我没有构造出"同一 link 两次 close 事件"的路径（Node 的 socket 通常只派发一次），也没实测过它会不会派发两次 ⇒ 归"可补未补 + 我未验证"，不写成按构造不可达 |
| `netx/ws.ts:179-181` | refuseUpgrade(socket, 400, 'Bad Request', 'connection he | K5 | `Connection` 不含 upgrade ⇒ 我们答 400 那三行（rev=12 应修 2 之后统一走 `refuseUpgrade()`，正文 `connection header lacks upgrade`）。前提 = 本机 Node（v24.19.0，llhttp）在把请求派发成 `upgrade` 事件**之前**已经要求该头以 `upgrade` 成词；`ws/08` 用 10 种写法实测，全部停在 Node 层的 404。这一档**改法之后仍然够不到**，但正文差了一件事：`ws/09` 现在能证明"我们的 400 与 Node 的 400 可分"（零正文 vs 有正文），rev=11 时不能 |
| `netx/ws.ts:229-230` | dropLink(link, encodeClose(1002, 'protocol error')); | K8 | `encodeClose(1002, protocol error)`：`ws/06` 第④打的是"未掩码的数据帧"那条 1002 出口，这里是同一档的另一条出口（合法掩码 + 未分配 opcode / 非法 RSV 位）。可补，本轮未做 |
| `src/ai/honest.ts:174-176` | const first = legal[0]; | K7 | 老面（M2 起就在）：`legal[0]` 兜底。前提是"引擎在终局之前至少给一个合法行动（fold）"，与 `illegal/*` 的必拒清单互相印证；不在 M5 变更面内 |
| `src/engine/actions.ts:158-160` | const exhausted: never = action; | K1 | `exhausted: never = action`：ActionKind 全集 |
| `src/engine/actions.ts:166-169` | let state = startHand(config); | K7 | 老面：`startHand` 的另一支，M5 变更没碰它 |
| `src/engine/settle.ts:71-72` | throw new TypeError(settle() called in phase ${state.ph | K7 | 老面：`settle()` 的相位守卫（非终局相位调用才抛）；`engine-money` 全部按合法相位调用 |
| `src/engine/settle.ts:102-103` | return seatAt(state, seat).chips; | K7 | 老面：分池时读某个座位筹码的一支，脚本与 fuzz 都没走到那个组合 |
| `src/engine/state.ts:105-106` | return seatAt(state, seat).active; | K7 | 老面：`isActive` 之类的小助手，实际调用点都走别的分支 |
| `src/engine/state.ts:122` | return -1; | K7 | 老面：找不到时 `return -1` 的兜底 |
| `src/engine/state.ts:151-153` | const exhausted: never = kind; | K1 | `exhausted: never = kind`：`priceOf` 的 ActionKind 全集（A2 ① 把 `actionCost` 改成委托给它之后，这一支仍然是穷尽检查，不是运行时路径） |
| `src/engine/state.ts:287` | return String(value); | K7 | 老面：哈希里对未知值 `String(value)` 那一支（构造不出这种值） |
| `src/engine/validate.ts:161-162` | return checkAction(state, action).ok; | K7 | 老面：`checkAction(...).ok` 的薄封装零调用点 —— 严格说也是死接口，但它在 M5 变更面之外（工单口径：一次只做当前批准的里程碑），本轮**不动**，记在这里备查 |
| `src/rules.ts:125-127` | const exhausted: never = spec; | K1 | `exhausted: never = spec`：Spec 的 kind 全集（rev=10 §5(a) 同档） |
| `webmin/model.ts:340-344` | return { | K7 | M1.5 单机侧的"离桌占位格"。这一段正是应修 7 那条论证的依据：**在 M1.5 里它按构造不触发**（`ledger()` 与 `seatCells()` 的 departed 分支零覆盖即此证据），所以单机页那个标签当前不会被自己的口径证伪 |
| `webmin/model.ts:487-488` | return { ok: false, session: { ...s, note: 不认识的意图 ${Str | K7 | M1.5：`unknown_intent`（页面只会发六种意图，构造这种输入要绕过 UI） |
| `webmin/model.ts:524` | return null; | K7 | M1.5：机器人候选为空时 `return null` |
| `webmin/model.ts:526-528` | const exhausted: never = intent; | K1 | M1.5：`exhausted: never = intent` |
| `webmin/model.ts:568-569` | return { ok: false, session: { ...cur, note: 机器人走了 ${St | K7 | M1.5：`bot_loop` 卡住的兜底（需要机器人永远不让位） |
| `webmin/model.ts:615-617` | const exhausted: never = mode; | K1 | M1.5：`exhausted: never = mode` |
| `webmin/serve.ts:123-132` | // 兜底：以上任何一步将来有人在 await 之前抛出，都不许再变成进程级故障（必修 2 的那一类）。 | K4 | `serveStatic` 外层兜底（必修 2 那一类防的"将来有人在第一个 await 之前抛"）。现在没有任何输入能走到这里：畸形转义在 `resolveStatic` 就回 400，读文件失败在 `readAsset` 的 catch 里回 404。可补的只有"故意往里塞会抛的代码"——那是变异测试的活，不是用例 |
| `webmin/serve.ts:136-140` | // .catch 不是装饰：serveStatic 现在自己不会抛，但"将来有人往 await 之前塞进会 | K4 | `createServer` 回调里那层 `.catch`：**每一个请求都真的经过这一行**（`srv/07` 真 spawn 打了 7 发），但子进程是被 `SIGKILL` 送走的 ⇒ V8 不落 coverage ⇒ 报告里显示未覆盖。这是"跑到了但取证不到"，不是"没跑到" |
| `webmin/serve.ts:153-159` | server.listen(port, '127.0.0.1', () => { | K4 | 独立运行时的 `listen` 回调（印 `炸金花 M1.5 → http://127.0.0.1:<真端口>/` 那一段）：同上，`srv/07` 确实让它印过。要拿到这段的覆盖，子进程必须**干净退出**（对照 `netx/serve.ts:75-86` 那条：靠 `quit` 退出才刷出来，oracle 自检 B 条） |
| `webui/netplay.ts:405-421` | const cards: Card[] / null = row.cards === 'unknown' ? n | K5 | "在局但不在名册"那一支（`view.seats` 里有、`rosterOf()` 里没有）。前提 = 服务端每条 `view`/`patch` 都带全量 roster（`room.ts` 的 sendView/sendCollect 都带），所以物理上不出现；这一支是"真出现了也不许悄悄丢掉一家"的保险。**rev=12 撤回的旧前提**：这里曾写"客户端无从独立核对" ⇒ 那个说法已被 `checkMoney` 证伪（见 12-A/12-D），但它与本段是否可达无关，本段的定性不变 |
| `webui/netplay.ts:443-444` | settlement.push(余数 1 分给距庄家下家最近的赢家：${nameOfSeat(terminal | K8 | 余数文案：需要一手牌打出"多个赢家 + 池不能被人数整除"（showdown 平局按 `split` + `remainderTo >= 0`）。本轮没能构造出这个形状，不是按构造不可达。可补：定向挑一组牌面（`classify` 相等）再结算 |
| `webui/netplay.ts:494` | return phase; | K1 | `viewWord` 的兜底 `return phase`：三个 phase 都在前面被覆盖，类型层不可达（rev=10 §5(b) 已定性"不算缺口，但要列出来"） |
| `webui/paint.ts:40-47` | ctx.strokeStyle = p.color; | K6 | 描边那一支：无头侧只数"调用几何参数"（`ui3/12` 那一族），真正走到描边需要一张能画出 stroke 的 canvas；属既有 Canvas/DOM 类别 |
| `webui/paint.ts:49-51` | const exhausted: never = p; | K1 | `exhausted: never = p`：Primitive 的 kind 全集（rect/ellipse/text/line） |
| `webui/scene.ts:178-180` | lines.push(word.slice(0, Math.max(1, Math.floor(avail /  | K6 | 超宽"单词"截断那一支：需要日志里出现一个长度超过整行宽度的连续 token；本轮的文案都被 `fitSize` 缩字号解决了，没走到 slice 那一支 |
| `webui/scene.ts:257-258` | return notice(w, h, st, ${String(n)} 人桌的放大的牌面需要至少 ${Str | K6 | "窗口太小"的另一条文案（放大牌面宽度不够那一支）：需要 `< OWN_PLATE.w + pad*2` 的极窄窗口，无头 `buildScene` 的既有用例走的是"高度不够"那一支 |

另有 5 个文件在 oracle 里是 **100.0%**（netx/seed.ts 112/112、netx/sha256.ts 113/113、src/cards.ts 135/135、src/engine/project.ts 62/62、webui/bridge.ts 153/153），无未覆盖段。

**说明段 1（§5(c) 的定性）**：上表 K3 那四行是服务端版的"第二道墙"。按裁定 8.11，我不构造用例去踩它们（那需要往交付代码里注入 bug，与"不许为通过特判"同一类麻烦），但每一行都写出了**可被反驳的前提**；任何一条前提被证伪，对应的 K3 立刻变成真缺口。

**说明段 2（K4 的取证边界）**：`webmin/serve.ts` 那三段里至少有 `:136-140` 与 `:153-159` **本轮确实执行过**（`srv/07` 真 spawn 打了七发请求、监听行也印过）。它们显示未覆盖的原因是子进程被 `SIGKILL` 送走、V8 不刷 coverage。这与 `netx/serve.ts:83-93` 那条自检正好互为反证：**要拿到进程入口面的覆盖，子进程必须干净退出**（行号按 rev=11 重标定后的 oracle 记；rev=10 时同一条叫 75-86）。下一轮如果有人要我把这两段变成真覆盖，办法是给 `webmin/serve.ts` 也加一条 `quit` 入口（那是交付面扩口子，不是测试能自己解决的）。

**说明段 3（D02 / 应修 8 的配置前提）**：`dealerAmong` 与旧写法的恒等，只在 `startRoom` 硬编码 `firstDealer: 0`（`netx/serve.ts`）时成立。若配置成 `createRoom({ seats: 6, firstDealer: 3 })` 而只有座位 0、1 入了座，`dealerAmong` 的绕回兜底是**可观测**的：庄家会从 3 挪到 0，且这一手照发；对照组是没有兜底时 `startHand` 抛 `bad hand config: dealer 3 is not one of the seats`。等价性本身我不再论证一次（8.10 说三路同向已足够）。

**说明段 4（`ws/08` 仍无行为变异，但 rev=12 给了它半条源码牙）**：`ws/08` 钉的是"本机 Node 的分档事实"，纵深防御的 `ws.ts:179-181` 够不到 ⇒ **行为**上把整段删掉也不会有用例变红（这一条与 rev=11 同口径，我不改判）。要说清的是变了的那一半：应修 2 之后 `ws/09` 把这句 guard 的**正文文本**钉在源码上（五条拒绝的文本互不相同），所以"删掉那三行"现在会让 `ws/09` 红 —— 但那是**文本判据**，不是"这条分支被走到的证据"。行为面仍然是地面真值记录。

**说明段 5（`webui/main.ts` 仍然 0 覆盖）**：与 rev=10 同口径 —— 那一层是时钟、socket、DOM、`crypto.getRandomValues` 的唯一出口，无头侧不进它。它的正确性由真浏览器验收（8.7，归监督方）+ `nui/17` 的模块图遍历（进口只有一个 `netx/`）+ `nst/10`/`nst/12` 的源码判据三件一起支撑；本轮新增的 `onText` 纯管道断言（`main.ts` 的 `onmessage` 只做 `for (const up of net.onText(...)) ws.send(up)`）也在 11-A 应修 2 那行的凭据链里。

**说明段 6（oracle 自检 A 本轮发生行漂移，我没有拿它当"覆盖变好了"）**：final3 的 A 条把行号**写死**在 `netx/ws.ts:146-149`，而 rev=12 应修 2 在同一个文件里新增了 `refuseUpgrade()`，500 兜底整体下移 ⇒ 146-149 现在落在 `/health` 的 JSON 体上（那几行本来就全覆盖）。所以原样跑出来的 `A 期望 1111 实得 1111 OK` 是**行号漂移的假证据**，正是 final3 头部自己警告过的那种失效（rev=11 的 C 条就栽在这里）。处理方式：不改他们的脚本（`.audit/` 只读），用 `.scratch/r12-mk-covcopy.mjs` 生成一份**逐字副本**（diff 只有 A 那一行），把锚点重标定到 `162-164` ⇒ `A 期望 111 实得 111 OK`。两份报告都留着（`r12-cov-report.txt` / `r12-cov-report-repin.txt`），`diff` 只差 A 那一行 ⇒ **合计读数（22 文件 / 43 段 / 5683 行覆盖 5543 = 97.5%）不受重标定影响**。结论没变：ws/07 真打到了 500 兜底；变的是"我知道这件事的证据行号换了地方"。

## 12-G. §8 那八条验收口径逐条自评

| 口径 | 自评 | 凭据 / 我这一侧能看到的部分 |
|---|---|---|
| **8.1** 四种 `patch` 篡改每一种都要：`untrusted=true` + `act()` 拒发 + 提示行给理由；正向对照不许拿放宽换绿 | **过（无头侧）** | `nui/27` 六支注入逐支断言这三件 + "被拒帧不进快照"（`snap.pot` 停在上一帧的好数字）；`nui/28` 是三手诚实流量**逐帧**零误报 + 采样下限（`sampled >= 60`）。另有探针 `.scratch/r12-invariants.ts` 独立复算：232 帧里**非 `settled` 相位 0 处不符**、`settled` 豁免命中 42 次、同一批流量上真墙 `violations=0` ⇒ 守卫既没漏也没宽。**你那一份 `sup-potcheck.ts` 的六支重跑不在我手里**，我不预先替它记"过"。 |
| **8.2** `nui/25` 改写不删除；新增用例带两组对照 + 一条变异；牌面那一族不许打散 | **过** | `nui/25` 改成 seq 面/采纳面（合法帧被采纳、同一条重放被 seq 抓、被拒帧不进快照）；对照 = `nui/27`（六支必抓）+ `nui/28`（诚实流量必不抓）；变异 = N01–N04 四条各摘一条腿。`nui/24`、`proto/07`、`proto/08`、`leak/05` 四条全绿，M13 复跑仍由这四条一起抓 |
| **8.3** 三处文书一致 | **过（两处已改成事实，第三处依赖本轮 DELIVERY 实物）** | ① `DELIVERY.md` 那句"主路径 `:394-410`"已按 rev=12 的实际行号改写（`:370-397` 已进、`:405-421` 是 K5 兜底 —— 行号本轮因 `.slice(-40)` 又漂了 2 行，我以 oracle 输出为准，不手抄）；② `SELF-REVIEW.md:13` 已改指 11-B；③ `:31` 那句与实物对齐 —— 本轮 `DELIVERY.md` notes 里确实写了 BRIEF §4 M5 ⑤ 的引用。**提醒一处行号漂移**：你 8.3 说的"拿 `sup-cov-final3.txt` 逐字对"，对的是 rev=11 那份报告；本轮 `netplay.ts` 的 K5 段从 `403-419` 漂到 `405-421`（见 12-F 说明段 6 同一类问题） |
| **8.4** 选了"加正文"这一支 ⇒ 要有用例钉住"三条 guard 的正文互不相同" | **过** | `ws/09` 钉三条**可达** guard 的正文两两不同 + 426 另有自己的正文 + **对照组**：Node 自己答的那一发仍然零正文 ⇒ 我们的 400 与它可分（这才是"归因不再需要覆盖差分"的确切含义）。够不到的那一条按源码文本钉住。你另外要求的两件事也做了：`ws/08` 的"4 种"与探针的"10 种"分开写；真进程上普通 HTTP 那一档是 **302 → /webui/**（`ws/08` 用的是没挂静态钩子的 `createWsRoom`，那一档才是 404）—— 两条都写进 DELIVERY notes 与 12-B |
| **8.5** oracle 口径不变；`onlyMine`/`onlyTheirs` 必须为 0 | **过（并有一处要你裁定的文字不符）** | 12-F 43 段与 `.scratch/r12-cov-report.txt` 逐行对上，本轮用它的**副本**自跑一遍（`.scratch/r12-mk-diffcopy.mjs` → `.scratch/repin/r12-covdiff.mjs`，只改报告路径与节标签，判据一字未改），原文在 `.scratch/r12-covdiff-run.txt`：**`COVDIFFRESULT=OK`，`onlyMine=0` / `onlyTheirs=0`**，双方段数都是 43、与 12-F 标题自称一致，`netplay`/`client`/`ws` 三段读数与 oracle 合计行（22 文件 / 5683 行覆盖 5543 = 97.5%）逐字对上。**两点与裁定文字不符，我按脚本实物记，不改口**：① `sup-cov-final3.mjs` 里 B 条的 `want` 是 `has1`，不是 `1111011`（本轮实得 `1111111`）；② A 条行号写死在 `ws.ts:146-149`，本轮应修 2 在同文件加了 `refuseUpgrade()` ⇒ 500 兜底漂到 `162-164`，**原样跑出来的 "A 1111 OK" 是行漂移的假证据**。我没有动你的脚本，改用逐字副本把 A 重标定到 `162-164`（`A 期望 111 实得 111 OK`），两份报告 `diff` 只差那一行 ⇒ 合计读数不受影响。详见 12-F 说明段 6 |
| **8.6** 零回归：408 条 ID 一条不许丢 | **过** | `comm -23 .scratch/r11-ids.txt .scratch/r12-ids.txt` = 空；本轮 412 条，新增全部用新编号（`nui/27`、`nui/28`、`ws/09`、`nst/13`、`srv/08`、`client/10` 是既有编号的**加强**不是复用） |
| **8.7** 真鼠标 + 两标签页仍归你，不判我不合格 | **仍归你** | 本轮我这一侧**没有**新增浏览器证据（恒等式与六种注入全是无头实测）。上一轮你那次"强制尺寸 + 坐标 `MouseEvent`"真点，我记在 12-F 说明段 5 的同一口径里 |
| **8.8** 你不再加新注入点；若你的恒等式与我的门重叠，以我的门为准，你的探针退成对照组 | **知悉，且我把重叠面写清** | 我的 (a)(c′)(d) 与你的探针用的是**同一批恒等式**，这不矛盾：你的 `control` 那支证"不误报"，我的 `nui/28` 证同一件事在交付代码里也成立；变异 N04 说明我这条不是装饰。真正的差别在**名册**：你给的 (c) 只验我自己那一格，我实现成逐座位恒定，因此 `other-chips` 那一支由 (c′) 抓而不是由 (d) 抓 —— 这一点在 12-A 第三行写明了，避免你重跑时按 rev=11 的分工去预期是哪条判据报出来的 |

# SELF-REVIEW.md —— rev=11 自评表（本轮交付：rev=10 裁定的必修 2 项 + 应修 9 项 + §8 那十三条验收口径）

对应裁定：`REVIEW.md` 顶部那份 **rev=10 合并定稿**（§3 必修 1–2、§4 应修 1–9、§5 覆盖缺口、§8 十三条）。
测试输出原文：`TEST-OUTPUT.md` 第 11 节（含 408 例全量原文、四个双跑哈希、13 条变异表、覆盖 oracle v4 读数）。
覆盖明细产物：`.scratch/r11-cov-report.txt`（用监督方那份 `sup-cov-final2.mjs` 只读跑出来，未改它、未纳进交付面）。

## 11-A. rev=10 必修 2 项 + 应修 9 项 逐条自评

| 条目 | 自评 | 凭据（第一手，全部可重跑） |
|---|---|---|
| **必修 1** 房间进程印出来的页面 URL 落在 M1.5 | **过** | `netx/serve.ts` 新增 `uiUrl = origin + 'webui/'`，横幅改印它；`srv/06` 逐字取子进程横幅里那一个字符串：`pathname === '/webui/'` + 原样跟到底正文含 `id="netUrl"`，**对照** `/`→`/webmin/index.html` 那条 302 一字未动（`root.headers.location` 逐字相等）。`DELIVERY.md` 的复现行也跟着改成 `/webui/`。**A** |
| **必修 2** 一条 `GET /%` 打死独立静态服务 | **过** | `webmin/serve.ts::decodePath` 把 `decodeURIComponent` 包进 try，畸形 ⇒ `resolveStatic` 回 **400 `malformed percent-escape`**（与既有 `NUL in path`/`backslash in path` 同档，不是 500）；`serveStatic` 外层再套一层 catch（那才是 500 档，兜"将来有人在 await 之前抛"）；`createServer` 里 `.catch(() => res.destroy())`。`srv/07` 真 spawn 打四发畸形 + `%00`/越界两档对照 + **打完之后 `/webmin/index.html` 仍 200**（进程存活是断言里的第一条）。**A** |
| **应修 1** 自评表与交付说明互相矛盾（⑤「`nst/04` 一字未改」是假的） | **过（已改成事实）** | 本文 `10-A` 那一格已就地改成："`nst/04` 按 M5 放行清单**收窄改写**，BRIEF §4 M5 ⑤ 已由监督方作废并追认（REVIEW rev=10 §1 与 §6-9）"；与本节 **11-B** 的 8.3 那一行互相自洽（那一行才写着"`nst/04` 未动"）；11-C 只有计数、回归与工装，不含这句话 ⇒ rev=11 应修 1 的第二处，rev=12 就地改指。**A** |
| **应修 2** 没过 schema 校验的下行也能清凭据 + 强制重入桌 | **过** | 判据换成 `peer.info().errors`（只有通过校验的下行才落得进去）；`nui/19` 两条对照：缺 `why` 的 `error/bad_token` ⇒ 不清凭据、不重入桌；合法 `bad_token` ⇒ 清 + 补一次 join（一次性闩锁仍在）；抓到 `leak_blocked`（停手）那一侧绝不自动重入桌。**没有**在 `netplay.ts` 里新写第二份协议判定（8.3 的红线）。**A** |
| **应修 3** 10-F 与 oracle 对不上 ⇒ 披露不完整 | **过** | 见本文 **11-F**：43 段、一行一段，与 `.scratch/r11-cov-report.txt` 逐行对上（含 rev=10 漏掉的 `netplay.ts`、`ws.ts`、`room.ts`、`model.ts`、`paint.ts`、`scene.ts`、`rules.ts` 等）。分类合并只在**说明列**做，行不合并。**A** |
| **应修 4** `lastReject` 永不清零 ⇒ 提示行跨手说谎 | **过** | 选裁定给的第一个修法：`netx/client.ts::act()` 产出非 null 上行时清 `lastReject`；同时把**审计面**拆成只增不减的 `rejects`（`test/netx-fixtures.ts::rejectOf` 改读它，`room/12` 等既有用例语义不动）。`nui/20` 钉两面分工：提示行过期、审计面仍在。**A** |
| **应修 5** 服务端 `notice` 到不了页面 | **过** | `log: [...trust, ...notices, ...引擎 log].slice(-40)`，去重 + 只取最近 6 条；**未开局（collect）那段占位分支同样带 notices**（裁定说的那句"同一句话适用于挪庄与作废"）。`nui/21` 三类 notice（入座 / 没交份额 / 挪庄）都上屏、键集与单机逐字一致、40 行上限不破。**A** |
| **应修 6** 四条 nit + 一把尺 | **过** | 重连文案从“有名字就丢座位号”改成「N 号位（名字）重连」；`room.ts` 五处默认 `.sort()` 全部换成 `byCodepoint`（同一份数据一把尺）；`let link: Link = 'idle'` 的死三元删掉；`status` 与 `handIndex` 拆回两行。**A** |
| **应修 7** 「桌上总额」标签比算法范围宽 | **过（选裁定给的①"改标签"）** | 见 11-E 第 1–2 项：文案改成「在场筹码+池」并导出成 `TOTAL_LABEL`；`nui/22` 钉行为口径、`nst/12` 钉"文案↔过滤"互锁（三组正向对照：只改文案 / 只改过滤 / 绕开常量，各命中一条）。**没有**采用裁定点名的"只摘过滤不改标签"那种改法。**A** |
| **应修 8** D02 等价性论证口径过宽 | **过（纯文书）** | 写进 11-F 最后一节的说明段：恒等只在 `startRoom` 硬编码 `firstDealer: 0`（`netx/serve.ts`）时成立；`firstDealer` 不在 `seated` 里时 `dealerAmong` 的绕回兜底**可观测**。**A**（裁定给的三条独立证据我未重复论证，8.10 说不需要） |
| **应修 9** `netx/ws.ts:146-149` 零覆盖 | **过** | `ws/07`：`onHttpRequest` 故意抛 ⇒ 断言 500 + 原文 + `/health` 仍 200 + 真 WebSocket 升级照常 + 连接不残留；**两组对照**（钩子自己应答 ⇒ 203 说了算；钩子答"没处理" ⇒ 仍是那句 404）。ws.ts 那层 500 没被顺手改成 400（M01 变异专门打这一档，被 `ws/07` 抓到）。oracle v4 实测该段 **225/236 = 95.3%**、`:146-149` 已覆盖。**A** |

## 11-B. §8 那十三条验收口径逐条自评

| §8 | 自评 | 凭据 |
|---|---|---|
| 8.1 必修 1 | **过** | `srv/06` 两条判据（逐字取横幅 + 跟到底含 `netUrl`）；`RunningRoom.httpUrl` 与 `uiUrl` 分开，DELIVERY 复现行写 `/webui/` |
| 8.2 必修 2 | **过** | `srv/07`：状态码就是 400、`why` 就叫 `malformed percent-escape`、真 spawn、断言含"进程还活着" |
| 8.3 不许第二份协议判定 | **过** | 判据走 `peer.info().errors`；`nui/02` 那 14 条禁令原样通过；`nst/04` 未动 |
| 8.4 11-F 必须与 oracle 逐行对上 | **过** | 43 段一行一段；脚本沿用监督方 v4，末尾三条地面真值自检的读数与改判写在 11-D 第 4 项（**A/C 两条本轮被翻绿，是修复落地，不是工具坏**） |
| 8.5 自评表与交付说明不许互相矛盾 | **过** | 11-A 应修 1 那格已改成事实；`DELIVERY.md` 的 notes 里现在**确实**写着"`nst/04` 按 M5 放行清单收窄改写、BRIEF §4 M5 ⑤ 已由监督方作废"（rev=11 那一份 DELIVERY 里并没有这段引用，描述与实物不符 ⇒ rev=12 起两边一致：这句话以 `DELIVERY.md` notes 的原文为准） |
| 8.6 零回归：393 条 ID 一条不许丢 | **过** | `comm -23` 差集为空；393 → **408**，新增 15 条全部用新编号 |
| 8.7 真浏览器 ≥720×640 + 两标签页 | **不归我，未声称验过** | 按裁定原样待监督方；本轮把那一行标签的渲染证据改成无头对照（`nui/22` 读 `buildScene` 图元树：底部那一行以 `TOTAL_LABEL` 开头且带着同一个数） |
| 8.8 应修 4/5 各带一条无头用例 | **过** | `nui/20` / `nui/21` |
| 8.9 应修 7 的改法与用例 | **过（选①）** | `nui/22` + `nst/12`；用例口径跟着改法走（钉的是"标签文案 ↔ `departed` 过滤"，不是更强的 `total === 房间台账` 那条 —— 那是选②才需要的） |
| 8.10 应修 8 的配置前提 | **过** | 11-F 说明段第 3 条 |
| 8.11 §5(c) 四段"按构造不可达 + 具体前提" | **过** | 11-F 里 `room.ts:171-174 / 333-335 / 337-339 / 360-362` 四行各写前提，且前提写成**可被反驳**的形式 |
| 8.12 (i) `netplay` 座位格主路径无头用例 | **过** | `nui/23`（三时刻 × 逐格 × 9 个字段 = 27 次比对）；(ii) `ws.ts:146-149` 有 `ws/07`，`:164-167` 有 `ws/08` 的实测分档（结论：**按构造不可达**，与裁定"这两条一条请求就能走到"里的后半条不同 —— 我给了判据与 10 种写法的实测，见 11-D 第 3 项） |
| 8.13 `patch` 上的注入 | **过** | `nui/24`（塞别家牌面 ⇒ 被抓、不采纳、停手、`act` 发不出去）+ `nui/25`（改 `chips`/`pot` ⇒ 如实记录"抓不到"并给出为什么，重放同一条则当场被抓）。M13 变异证明这条门不是虚的 |

## 11-C. 计数、回归与工装

| 项 | 值 |
|---|---|
| 用例 | `RUNNER files=29 cases=408`、`SUMMARY pass=408 fail=0 total=408`、`RESULT=ALL_PASS` |
| 相对 rev=10 交付时 | 393 → 408（**+15**，`comm -23` 差集为空 ⇒ 一条 ID 没丢） |
| 双跑 | `node test/run.ts` ×2 ⇒ sha256 `8738b996…e7dcb0`；`npm test` ×2 ⇒ `50c32312…4afa50`；四次退出码全 0 |
| 类型 | `npx tsc --noEmit` 零输出（`strict` 四开关 + `erasableSyntaxOnly` 全开） |
| 新增门 | `srv/06`、`srv/07`、`srv/08`、`ws/07`、`ws/08`、`nui/19`–`nui/26`、`nst/12`、`rules/20` |
| 变异 | 本轮 13 条：13 caught / 0 survived / 0 skipped（M03 第一次**逃掉**，补强 `srv/06` 后被抓，经过写在 11-D 第 1 项） |
| 时钟例外 | `nst/09` 的 `TIMER_EXCEPTIONS` 未扩：`netx-ws` 仍是 3 处、`netx-serve` 仍是 1 处，新增的 `runNode` 段落没有引入新的 `setTimeout` |

## 11-D. 本轮被"证据"逼出来的四件事（都不是我自己想加的）

1. **`srv/06` 原本是一道虚门（变异 M03 逃掉）**。第一版把横幅的正则写成"只捕获源，然后测试自己再拼 `webui/`"，
   于是横幅里到底印 `/` 还是 `/webui/` 从没进断言 —— 把 `uiUrl` 改回 `httpUrl` 照样全绿。
   改成**逐字**取横幅那一个字符串，再按 8.1 给的判据跟到底，M03 立刻被抓。⇒ 我交付的"必修 1 已闭"这句话，
   在补强之前是**没有凭据的**；这也是我为什么把这段写进交付文件而不是只写在 commit 里。
2. **跑测进程"全绿但不退出"**。`srv/06` 的断言失败发生在 `kid.write('quit')` 之前 ⇒ 房间子进程活着，
   父进程握着那条 stdout 管道 ⇒ `node test/run.ts` 打完 `RESULT=ALL_PASS` 之后永远不返回（本机撞了两次，
   表现为命令超时）。现在那一段包进 `try/finally`，无论断言成不成都把子进程送走。
3. **`ws.ts:164-167` 的可达性与裁定的说法不一致**。裁定 §8.12(ii) 写"这两条在真 socket 上一条请求就能走到"。
   对 `:146-149` 成立（`ws/07` 就是这么打的）；对 `:164-167` 我用 10 种 `Connection` 写法实测
   （`Upgrade`、`Upgrade Keep-Alive`、`Upgrade\tKeep-Alive`、`Upgrade,`、`Upgrade Upgrade`、`Upgrade, Keep-Alive`、
   `UPGRADE`、两端空格、`Upgrade:`、重复头数组）：**Node 的 http 解析层先答 404**（判据是正文那句
   `this endpoint is a websocket room`，我们自己的 400 没有正文），没有一种落到我们那三行里。
   所以这一段是**按构造不可达**，我把实测做成正式用例（`ws/08`）而不是留一句"没找到用例"。
4. **覆盖 oracle 的三条地面真值自检，本轮有两条被翻绿**（A 与 C）。自检脚本期望的是 rev=10 时点的事实；
   A 翻绿 = `ws/07` 落地，C 翻绿 = `srv/08` 在进程内真打了 `serveStatic`。
   我不改脚本（那是监督方的证据），只在 11-F 与本节写明"下一轮沿用时这两条的期望值应改成'全为 1'"，
   免得下一次被误读成"工具坏了"。

## 11-E. 自行决定清单（工单 §0.8：实现细节可自决，报备备查）

1. **应修 7 选①"改标签"，并且把 M1.5 DOM 那一行也改成同一个词**。理由：两个入口印同一个数（`tableTotal` 与 `netplay.total`
   本来就是同一条式子），只改画布那一侧会变成"同一件事两种说法"，与本轮 §5 应修 6 的"一把尺"同味。
   成本 = 一行文案；`nst/12` 第④道判据把两个入口锁在一起，漂回去就红。
2. **把标签做成导出的 `TOTAL_LABEL` 常量**（超出"改一行文案"的最低要求）。理由：裁要求钉"文案 ↔ 过滤口径一致"，
   文案散在插值里就钉不住；导出之后 `nui/22` 能把"渲染那一行的开头字符串"和"算法算的数"放在同一条断言里比。
3. **删掉三个零调用点的接口**：`webui/netplay.ts::pingWire`、`webui/netplay.ts::linkState`、`netx/client.ts::ping`。
   判据沿用 rev=9 必修 2（死接口不留）与 rev=9 应修 4（"接口义务"要写清，别让人当死代码再查一遍）：
   `main.ts` 不做保活调度、全仓零调用点，`grep` 证据与删除理由就地写在 `client.ts` 的注释里。
   **协议本身没缩**：`protocol.ts` 的 `UP_SPEC` 仍声明 `ping`，房间的回显路径仍由 `room/21` 钉着。
4. **`nui/24`/`nui/25` 的底稿用"真发下来过的 patch"**，而不是手工造一条 payload；并且**先从待发队列里取走**再喂
   （`room.pending()` 是取走语义）。理由：会话一旦先看过原件，再喂就会撞上"seq 接不上号"那道闸，
   测到的就不是泄漏判据 —— 第一版正是这样红的，`ws/08` 那条 400 也是靠"正文有没有那句 404"来区分谁答的。
5. **`nui/25` 的"抓不到"写成断言而不是省略**。如果哪天墙扩了面、这类篡改真的被抓，那条会**变红**，
   提示要改口径 —— 而不是悄悄把一个边界藏进注释。
6. **覆盖复核不改监督方的脚本、也不纳进交付面**：`node .audit/rev10/sup-cov-final2.mjs .scratch/r11-cov`，只读跑，
   报告落在 `.scratch/`。这样"我用的工具"和"你用的工具"是同一份二进制，不会有第二套口径。
7. **历史证据文件不回改**：`evidence/*.txt`、`TEST-OUTPUT.md` 的 §10 及更早各节里出现的旧文案「桌上总额」
   按"证据不删不改"原样留着（本轮的 `nst/12` 只扫交付源码，不扫历史证据）。

## 11-F. 已知未覆盖 / 边界（43 段，一行一段，与 `.scratch/r11-cov-report.txt` 逐行对上）

分类码：**K1** 类型层穷尽（`exhausted: never`）；**K2** 恒真兜底（判据对象是自己刚算出来的量）；
**K3** §5(c) 房间自检分支（按构造不可达，前提写成可反驳的形式）；**K4** 进程入口面（子进程被 SIGKILL ⇒ V8 不刷 coverage）；
**K5** 被更外一层先拦住（按构造不可达）；**K6** 画布 / DOM 既有类别；**K7** M5 变更面之外的老面；**K8** 可补未补（成本已估）。

| 段 | 源码那一句（截断） | 分类 | 为什么没测到 / 前提 |
|---|---|---|---|

| `netx/client.ts:122-123` | return after merging I hold ${String(totalSoFar + v.log | K2 | 合并后条数自检：比的量是自己刚算出来的 `totalSoFar + v.log.length`，恒真兜底（rev=10 §5(a) 同档） |
| `netx/client.ts:305-307` | const exhausted: never = msg; | K1 | `exhausted: never = msg`：Down 的全部 tag 都在 switch 里有分支。前提 = `DOWN_SPEC` 的 tag 集合与 `inbound` 的分支集合一致（proto/05/06 两侧集合都在断言里）；只有加新 tag 忘了处理才可达，而那正是它的用途（编译期拦） |
| `netx/frames.ts:171` | throw new FrameError('too_large', payload ${String(len) | K8 | `too_large`：需要一个 8 字节长度字段 > 2^53 的帧头，真客户端发不出这种帧。可补（raw 写 14 字节头即可），本轮未做 |
| `netx/frames.ts:250-251` | throw new FrameError('bad_close', 'close reason is not v | K8 | `bad_close`：close 帧载荷不是合法 UTF-8。可补（ws/06 的 raw 工装改 3 行），本轮未做 |
| `netx/protocol.ts:213-215` | const exhausted: never = spec; | K1 | `exhausted: never = spec`：Spec 的 kind 全集都在 `check()` 里；新增 kind 忘了分支就编译不过 —— 这条段的"零覆盖"正是它在工作 |
| `netx/room.ts:171-174` | fault = egress blocked for seat ${String(seat)}: ${why} | K3 | §5(c) ①：`fault = egress blocked for seat N`。前提 = `src/engine/project.ts` 的白名单正确（别家牌、未看牌时自己的牌、settled 前的种子三类都进不了投影）；由 `engine-project` 的正负两极断言 + `nui/04` 三阶段整文本搜索 + `leak/*` 守。只有投影自己写错才可达 |
| `netx/room.ts:333-335` | fault = reveal self-check failed: ${why}; | K3 | §5(c) ②：`reveal self-check failed`。前提 = `commitOf` / `seedFromShares` / `revealMatches` 三者互逆（sha256 无碰撞；seed/11 固定向量 + seed/12 的 4096 组互不相同 + proto/12 出口自检）。只有三者之一被改坏才可达 |
| `netx/room.ts:337-339` | fault = 'reveal self-check failed: revealed shares no lo | K3 | §5(c) ③：同一族的第二条（"揭示出来的份额不再合成出当初那个种子"）。前提同上，多出的一条是 `seedFromShares` 的 party 排序稳定（seed/13/14 钉码点序与前缀相撞） |
| `netx/room.ts:360-362` | fault = fault ?? authoritative engine rejected its own  | K3 | §5(c) ④：`authoritative engine rejected its own action`。前提 = `checkAction` 与 `apply` 对同一份 state 判定一致（`illegal/*` 全集 + `m2-fuzz` 1000 局的五类不变量在守这条）。只有两者判定分叉才可达 |
| `netx/room.ts:610-611` | const exhausted: never = up; | K1 | `exhausted: never = up`：Up 的 tag 全集都在分发里（join/nonce/action/resume/ping/pong） |
| `netx/serve.ts:106-107` | process.stderr.write(收尾失败：${String(err)}\n); | K4 | 收尾失败的 `process.exit(1)`：需要 listening server 的 `close()` 自己 reject。`srv/03` 走的是干净退出那一支 ⇒ 这一支没进去 |
| `netx/serve.ts:126-127` | // 没有可读的 stdin（被重定向关掉了）⇒ 只剩信号那两条路 | K8 | 无可读 stdin 那一支：`runNode` 给子进程留了可写的 stdin 管道，所以走的是"读到 quit"那条。可补（spawn 时把 stdin 设成 ignore），本轮未做 |
| `netx/ws.ts:79-81` | dropLink(link, encodeClose(1011, 'server produced an inv | K5 | 服务端 produce 出非法下行 ⇒ 1011 关闭。前提 = `room` 发出的每一条 down 都先过 `encodeDown`/`DOWN_SPEC`（proto/12 专门钉这个出口自检）；只有那两处一起坏掉才可达 |
| `netx/ws.ts:114-115` | // 已经在断开流程里，忽略 | K8 | 断开流程重入时忽略第二次 close。我没有构造出"同一 link 两次 close 事件"的路径（Node 的 socket 通常只派发一次），也没实测过它会不会派发两次 ⇒ 归"可补未补 + 我未验证"，不写成按构造不可达 |
| `netx/ws.ts:164-167` | socket.write('HTTP/1.1 400 Bad Request\r\nConnection: cl | K5 | `Connection` 不含 upgrade ⇒ 我们答 400 那三行。前提 = 本机 Node（v24.19.0，llhttp）在把请求派发成 `upgrade` 事件**之前**已经要求该头以 `upgrade` 成词；`ws/08` 用 10 种写法实测，全部停在 Node 层的 404（判据：那句 404 正文只有我们的 HTTP 分支会印） |
| `netx/ws.ts:218-219` | dropLink(link, encodeClose(1002, 'protocol error')); | K8 | `encodeClose(1002, protocol error)`：`ws/06` 第④打的是"未掩码的数据帧"那条 1002 出口，这里是同一档的另一条出口（合法掩码 + 未分配 opcode / 非法 RSV 位）。可补，本轮未做 |
| `src/ai/honest.ts:174-176` | const first = legal[0]; | K7 | 老面（M2 起就在）：`legal[0]` 兜底。前提是"引擎在终局之前至少给一个合法行动（fold）"，与 `illegal/*` 的必拒清单互相印证；不在 M5 变更面内 |
| `src/engine/actions.ts:158-160` | const exhausted: never = action; | K1 | `exhausted: never = action`：ActionKind 全集 |
| `src/engine/actions.ts:166-169` | let state = startHand(config); | K7 | 老面：`startHand` 的另一支，M5 变更没碰它 |
| `src/engine/settle.ts:71-72` | throw new TypeError(settle() called in phase ${state.ph | K7 | 老面：`settle()` 的相位守卫（非终局相位调用才抛）；`engine-money` 全部按合法相位调用 |
| `src/engine/settle.ts:102-103` | return seatAt(state, seat).chips; | K7 | 老面：分池时读某个座位筹码的一支，脚本与 fuzz 都没走到那个组合 |
| `src/engine/state.ts:105-106` | return seatAt(state, seat).active; | K7 | 老面：`isActive` 之类的小助手，实际调用点都走别的分支 |
| `src/engine/state.ts:122` | return -1; | K7 | 老面：找不到时 `return -1` 的兜底 |
| `src/engine/state.ts:151-153` | const exhausted: never = kind; | K1 | `exhausted: never = kind`：`priceOf` 的 ActionKind 全集（A2 ① 把 `actionCost` 改成委托给它之后，这一支仍然是穷尽检查，不是运行时路径） |
| `src/engine/state.ts:287` | return String(value); | K7 | 老面：哈希里对未知值 `String(value)` 那一支（构造不出这种值） |
| `src/engine/validate.ts:161-162` | return checkAction(state, action).ok; | K7 | 老面：`checkAction(...).ok` 的薄封装零调用点 —— 严格说也是死接口，但它在 M5 变更面之外（工单口径：一次只做当前批准的里程碑），本轮**不动**，记在这里备查 |
| `src/rules.ts:125-127` | const exhausted: never = spec; | K1 | `exhausted: never = spec`：Spec 的 kind 全集（rev=10 §5(a) 同档） |
| `webmin/model.ts:340-344` | return { | K7 | M1.5 单机侧的"离桌占位格"。这一段正是应修 7 那条论证的依据：**在 M1.5 里它按构造不触发**（`ledger()` 与 `seatCells()` 的 departed 分支零覆盖即此证据），所以单机页那个标签当前不会被自己的口径证伪 |
| `webmin/model.ts:487-488` | return { ok: false, session: { ...s, note: 不认识的意图 ${Str | K7 | M1.5：`unknown_intent`（页面只会发六种意图，构造这种输入要绕过 UI） |
| `webmin/model.ts:524` | return null; | K7 | M1.5：机器人候选为空时 `return null` |
| `webmin/model.ts:526-528` | const exhausted: never = intent; | K1 | M1.5：`exhausted: never = intent` |
| `webmin/model.ts:568-569` | return { ok: false, session: { ...cur, note: 机器人走了 ${St | K7 | M1.5：`bot_loop` 卡住的兜底（需要机器人永远不让位） |
| `webmin/model.ts:615-617` | const exhausted: never = mode; | K1 | M1.5：`exhausted: never = mode` |
| `webmin/serve.ts:123-132` | // 兜底：以上任何一步将来有人在 await 之前抛出，都不许再变成进程级故障（必修 2 的那一类）。 | K4 | `serveStatic` 外层兜底（必修 2 那一类防的"将来有人在第一个 await 之前抛"）。现在没有任何输入能走到这里：畸形转义在 `resolveStatic` 就回 400，读文件失败在 `readAsset` 的 catch 里回 404。可补的只有"故意往里塞会抛的代码"——那是变异测试的活，不是用例 |
| `webmin/serve.ts:136-140` | // .catch 不是装饰：serveStatic 现在自己不会抛，但"将来有人往 await 之前塞进会 | K4 | `createServer` 回调里那层 `.catch`：**每一个请求都真的经过这一行**（`srv/07` 真 spawn 打了 7 发），但子进程是被 `SIGKILL` 送走的 ⇒ V8 不落 coverage ⇒ 报告里显示未覆盖。这是"跑到了但取证不到"，不是"没跑到" |
| `webmin/serve.ts:153-159` | server.listen(port, '127.0.0.1', () => { | K4 | 独立运行时的 `listen` 回调（印 `炸金花 M1.5 → http://127.0.0.1:<真端口>/` 那一段）：同上，`srv/07` 确实让它印过。要拿到这段的覆盖，子进程必须**干净退出**（对照 `netx/serve.ts:75-86` 那条：靠 `quit` 退出才刷出来，oracle 自检 B 条） |
| `webui/netplay.ts:403-419` | const cards: Card[] / null = row.cards === 'unknown' ? n | K5 | "在局但不在名册"那一支（`view.seats` 里有、`rosterOf()` 里没有）。前提 = 服务端每条 `view`/`patch` 都带全量 roster（`room.ts` 的 sendView/sendCollect 都带），所以物理上不出现；这一支是"真出现了也不许悄悄丢掉一家"的保险 |
| `webui/netplay.ts:441-442` | settlement.push(余数 1 分给距庄家下家最近的赢家：${nameOfSeat(terminal | K8 | 余数文案：需要一手牌打出"多个赢家 + 池不能被人数整除"（showdown 平局按 `split` + `remainderTo >= 0`）。本轮没能构造出这个形状，不是按构造不可达。可补：定向挑一组牌面（`classify` 相等）再结算 |
| `webui/netplay.ts:492` | return phase; | K1 | `viewWord` 的兜底 `return phase`：三个 phase 都在前面被覆盖，类型层不可达（rev=10 §5(b) 已定性"不算缺口，但要列出来"） |
| `webui/paint.ts:40-47` | ctx.strokeStyle = p.color; | K6 | 描边那一支：无头侧只数"调用几何参数"（`ui3/12` 那一族），真正走到描边需要一张能画出 stroke 的 canvas；属既有 Canvas/DOM 类别 |
| `webui/paint.ts:49-51` | const exhausted: never = p; | K1 | `exhausted: never = p`：Primitive 的 kind 全集（rect/ellipse/text/line） |
| `webui/scene.ts:178-180` | lines.push(word.slice(0, Math.max(1, Math.floor(avail /  | K6 | 超宽"单词"截断那一支：需要日志里出现一个长度超过整行宽度的连续 token；本轮的文案都被 `fitSize` 缩字号解决了，没走到 slice 那一支 |
| `webui/scene.ts:257-258` | return notice(w, h, st, ${String(n)} 人桌的放大的牌面需要至少 ${Str | K6 | "窗口太小"的另一条文案（放大牌面宽度不够那一支）：需要 `< OWN_PLATE.w + pad*2` 的极窄窗口，无头 `buildScene` 的既有用例走的是"高度不够"那一支 |

另有 5 个文件在 oracle 里是 **100.0%**（netx/seed.ts 112/112、netx/sha256.ts 113/113、src/cards.ts 135/135、src/engine/project.ts 62/62、webui/bridge.ts 153/153），无未覆盖段。

**说明段 1（§5(c) 的定性）**：上表 K3 那四行是服务端版的"第二道墙"。按裁定 8.11，我不构造用例去踩它们（那需要往交付代码里注入 bug，与"不许为通过特判"同一类麻烦），但每一行都写出了**可被反驳的前提**；任何一条前提被证伪，对应的 K3 立刻变成真缺口。

**说明段 2（K4 的取证边界）**：`webmin/serve.ts` 那三段里至少有 `:136-140` 与 `:153-159` **本轮确实执行过**（`srv/07` 真 spawn 打了七发请求、监听行也印过）。它们显示未覆盖的原因是子进程被 `SIGKILL` 送走、V8 不刷 coverage。这与 `netx/serve.ts:75-86` 那条自检正好互为反证：**要拿到进程入口面的覆盖，子进程必须干净退出**。下一轮如果有人要我把这两段变成真覆盖，办法是给 `webmin/serve.ts` 也加一条 `quit` 入口（那是交付面扩口子，不是测试能自己解决的）。

**说明段 3（D02 / 应修 8 的配置前提）**：`dealerAmong` 与旧写法的恒等，只在 `startRoom` 硬编码 `firstDealer: 0`（`netx/serve.ts`）时成立。若配置成 `createRoom({ seats: 6, firstDealer: 3 })` 而只有座位 0、1 入了座，`dealerAmong` 的绕回兜底是**可观测**的：庄家会从 3 挪到 0，且这一手照发；对照组是没有兜底时 `startHand` 抛 `bad hand config: dealer 3 is not one of the seats`。等价性本身我不再论证一次（8.10 说三路同向已足够）。

**说明段 4（没有对应变异的那条门）**：`ws/08` 钉的是"本机 Node 的分档事实"，纵深防御的 `ws.ts:164-167` 够不到 ⇒ 把它整段删掉也不会有用例变红。它是**地面真值记录**，不是行为门。这一条与 11-D 第 3 项同向：我不假装它有牙。

**说明段 5（`webui/main.ts` 仍然 0 覆盖）**：与 rev=10 同口径 —— 那一层是时钟、socket、DOM、`crypto.getRandomValues` 的唯一出口，无头侧不进它。它的正确性由真浏览器验收（8.7，归监督方）+ `nui/17` 的模块图遍历（进口只有一个 `netx/`）+ `nst/10`/`nst/12` 的源码判据三件一起支撑；本轮新增的 `onText` 纯管道断言（`main.ts` 的 `onmessage` 只做 `for (const up of net.onText(...)) ws.send(up)`）也在 11-A 应修 2 那行的凭据链里。

# SELF-REVIEW.md —— rev=10 自评表（本轮交付：M5 联机可玩 + Q6=A2 价格接缝 + rev=9 §4 七条应修销账）

对应工单：`BRIEF.md` §4「M5 联机可玩」全条 + §4「价格接缝（Q6=A2 的落地形状）」+ §6 验收①–⑥。
裁定与必钉用例：`ANSWERS.md` 第六轮 Q6（A2）、`REVIEW.md` rev=9 §4（七条应修）。
测试输出原文：`TEST-OUTPUT.md` 第 10 节。真浏览器逐条证据：`evidence/m5-browser-live.txt`。

## 10-A. 工单 §4 M5 每条硬约束 + §6 验收口径 逐条自评

| 条目 | 自评 | 凭据（第一手） |
|---|---|---|
| 零新依赖、白名单不扩、没装 `ws` | **过** | `package.json` 的 `dependencies` 仍整体缺省、`devDependencies` 只有 typescript/@types/node/vite/tsx 白名单内；`nst/07` 两条"没装 ws"断言原样保留并通过（**协议没加 `costs` 字段**，B 已按裁定否决） |
| `netx/client.ts` 直接作为浏览器侧会话被复用，不许第二份协议实现 | **过** | 页面侧唯一 netx 进口是 `webui/netplay.ts`，且只认 `client.ts`/`protocol.ts`（`nst/04`）；`nui/02` 用 14 条判据 + 一份"坏实现"正向对照钉"没有第二道墙"，`nui/17` 从 `index.html` 遍历整张模块图 |
| `nst/03` 可移植面纳入 webui 新增联机文件 | **过** | `PORTABLE` 含 `webui/netplay.ts`；`nst/01` 改成"每个 netx 文件必须被覆盖 + 清单里每个文件必须真实存在"两头都查 |
| UI 只渲染 + 发意图；合法性以服务端 `reject`/`error` 为准 | **过** | `legal` 只由服务端 `phase`/`turn` 决定（`nui/09`）；买不起那一家按钮仍 `legal=true`、点下去由服务端 `cannot_afford` 拒、原话上牌桌（`nui/13`）；`webui/` 里 `canAffordCall`/`actionCost`/`callPrice` 零出现（`nst/10`，变异 A04 被抓） |
| **Q6=A2 落地形状 ①–⑤** | **过，未退回 C** | ① `src/engine/state.ts::priceOf` 是唯一定义，`actionCost` 委托给它，签名语义不变、**既有 362 条一条期望都没改**；② 页面不伪造 `GameState`（只 import 那个"原始量进、钱出"的函数，入参是投影里的 `stake`/`looked`/`rules`）；③ 只显示不判定；④ `nst/10` 机检算式不扩散（含正向对照，变异 A03 被抓）；⑤ `nst/04` 按 M5 放行清单**收窄改写**（标题与放行集合都变了），BRIEF §4 M5 ⑤ 已由监督方作废并追认（REVIEW rev=10 §1、§6-9）—— 原文这一格写的是“一字未改”，那是假的，rev=11 按应修 1 就地改成事实 |
| Q6 必钉用例 (a)(b)(c)(d) | **过** | (a) `nui/11` 跟/加/比各一次"行动前页面 cost === 行动后 log 里那条 amount"；(b) `nui/12` 闷→明差价可见且两数都由 `priceOf` 现算（无手写常量）；(c) `nui/13`；(d) `nui/14` 同一个 state 两条路逐按钮相等（25 次比较、11 种组合） |
| (e) 两条变异必须都被抓 | **过** | A01（明/闷乘数互换）→ `illegal/06`+`money/02`+`money/03`+`nui/11`+`nui/12`；A02（`project()` 出口 `stake+1`，只改投影）→ `project/06`+`nui/11`+`nui/13` |
| 信息来源只有投影 + 负向断言 | **过** | `nui/04` 在未看牌 / 挨家看过 / 强制开牌三个阶段各搜一遍**整棵快照序列化文本**（正向"自己的牌必须在"与反向"别家的牌必须不在"两极性都断），并按 `handText`/`handAscii` 两种排版搜 |
| `violations` 产品化（不可信 + 停手，不许只活在测试里） | **过** | `nui/05` 四处可见：提示条、警告位、日志首两行、按钮条塌成一条灰说明；再点返回"没发出去：peer flagged the server…"；真浏览器同一组现象见 evidence §6 |
| `leak_blocked` 与 `replaced` 可区分 | **过** | `nui/05` 后半：两条文案不同、只有 `leak_blocked` 判整局不可信、顶号不牵连信任面 |
| 断线重连：增量与快照两条路都真走到 | **过** | `nui/06` 三种形状各自真实到达：断线→`(seq,now]` 增量、同局刷新→`(0,now]` 全量增量（并断言**不是** view）、跨局→全量 `view`（并断言**不是** patch）；台账全程 512 守恒 |
| 同一浏览器两个标签页各占一座 | **过（机制侧）** | `nui/07` per-tab 两份凭据互不覆盖 + 共享存储反面对照（"甲"被接回乙的座位）；页面侧 `localStorage` 零出现由 `srv/05`/`nui/16` 钉、变异 E01 被抓 |
| 超时托管 `timeout` 字样带到 UI | **过** | `nui/08` 六条 `timeout→call`；真浏览器日志同样印出 `#010 call 甲 出 8 @注级4｜timeout→call seen×stake` |
| 房间进程：一条命令起 / 干净退出 / 端口可配置且默认值写进 UI 输入框 / `/health` 保持 / 不做服务端 AI 填座 | **过** | `node netx/serve.ts [端口]`（`DEFAULT_ROOM_PORT=8790`，页面连接框预填同一值）；`srv/01` 同端口端 `/health` 与页面、越界拒；`srv/03` 一句 `quit` ⇒ 退出码 0 且打"已全部关闭"；`srv/04` 坏参数 ⇒ 码 2；未加任何填座逻辑 |
| §5 禁令（引擎禁 `Math.random`/`Date.now`/IO/全局态；规则分歧走 `Rules`；禁边池/全押/退款；禁"下注轮结束"检测） | **过** | `src/` 侧本轮只动了 `state.ts` 的抽函数（纯计算、无新分支）；`priceOf` 的三个乘数全部来自 `Rules`；`static/*` 家族全绿 |
| ④ `npm test` 仍单命令、零回归、每条都有新用例 | **过** | `npm test` = `node test/run.ts` 一条；393 例全绿；10.2 那张表逐条对上"哪条硬约束配哪条用例" |
| 并对**新增的门**做变异证明 | **过** | 22 条变异（10.3），21 被抓、1 条附等价性论证（D02） |
| ⑥ 价格诚实性 | **过** | 见上面 A2 两行；端到端"两个独立来源对同一个数"在真页面上也读到（evidence §4：注级 4 时按钮 `跟注（出 8）`，日志里正是 `call 甲 出 8`） |
| ① 两真人两标签页真鼠标打完两整手 | **偏差（环境所限，归你那一遍）** | 见 10-F 第 1、2 行；我把能自己拿的都拿了：真浏览器 + 真 socket + 真房间跑完两整手、结算面板、断线重连、伪造下行停手、凭据自愈（evidence 全文） |

## 10-B. rev=9 §4 七条应修逐条销账

| 应修 | 自评 | 落点 |
|---|---|---|
| 1 构造期两道 `TypeError` 零覆盖 | **过** | `room/27`：座位数越界、`firstDealer` 不在名册，两条 `assert.throws` |
| 2「能开局的人不够 ⇒ 本局作废 + 只挂 gap 表」零覆盖 | **过** | `room/28`：两家桌只交一家 ⇒ `phase=idle`、`hand=0`、`clock.pending()===1`、推进后重开为第 2 手并重新收份额、台账零扣减 |
| 3 `protocol.ts` 非文本非对象 / 线上 pong 帧零覆盖 | **过** | `proto/13`（三条报错口径互不混用）+ `ws/06`（真 socket 上 ping 原样回显、零长度边界、客户端 pong 不回声、坏帧 1002） |
| 4 `handshakeAccept` 口径写进注释并记待办 | **过** | `netx/frames.ts:131-136`：为什么放宽、"若前置代理会重写头字段则收紧到严格 24 字符 base64"的待办 |
| 5 `room.ts` 那段注释口径改准 | **过** | `netx/room.ts:280-283` 改成"回调体够不到，但重武装会留下一只多余定时器（room/25④ 守着）"，即你 Z5 的实测结论 |
| 6 `TEST-OUTPUT` 里 `node` 与 `npm` 两条哈希都写 | **过** | `TEST-OUTPUT.md` 10.1：四个 64 位 sha256 全写（两条命令各双跑、各自逐字节一致），并附 npm 多 4 行横幅的说明 |
| 7 `left.map(partyOfSeat).sort()` 换统一尺 | **过** | `netx/room.ts:284` 用 `byCodepoint`（顺手，不改行为） |

## 10-C. 计数与回归

| 项 | 值 |
|---|---|
| 用例 | `RUNNER files=29 cases=393`，`SUMMARY pass=393 fail=0` |
| 相对 rev=9 | 362 → 393（+31：`nui` 18、`srv` 5、`nst/10`、`nst/11`、`client/16`、`room/29`，另有 rev=9 应修带来的 12 条并入 M4 家族） |
| 既有期望 | **一条都没改**（A2 ① 的硬要求）。`money/02`、`money/03`、`illegal/06`、`project/06` 等原样通过，且 10.3 的 A01/A02 会让它们响 ⇒ 不是空过 |
| `npx tsc --noEmit` | exit=0，无诊断 |
| 变异 | 22 条：21 caught、1 survived（D02 等价论证）、0 SKIPPED、0 还原失败 |
| 双跑 | `node test/run.ts` 两次同哈希；`npm test` 两次同哈希 |

## 10-D. 本轮由"真浏览器实测"逼出的四个缺陷（都已修 + 都可重跑）

| # | 缺陷 | 危害 | 修法 | 用例 | 变异 |
|---|---|---|---|---|---|
| 1 | 静态服务不认识 `netx/` 里那四个可移植模块 | 浏览器 fetch `/netx/client.ts` 得 403 ⇒ **整张模块图加载失败**：画布 0 高、`__zjh3` 不存在，只在控制台报错，页面看起来"白了" | 放行面从"只有目录白名单"改成"目录白名单 + **逐个点名**的文件白名单"；房间/传输/进程入口三个文件继续拒（D04 证明写成目录会被抓） | `nui/17`、`srv/01` | D03、D04 |
| 2 | 凭据作废后页面停在"已连接、零下行" | 房间重启 ⇒ 旧 token 的 `resume` 被拒 ⇒ 页面既不回落 join、也不显示原因，用户看到一张空白桌 | `netplay.onText` 认 `bad_token`/`token_seat_mismatch` ⇒ 清存储 + 提示 + **自己产出**一条全新 join（一次性闩锁）；`persist()` 在作废期间不许把旧凭据续命；`hello` 回来才消提示；`main.ts` 退化成纯管道 | `nui/18`、`nui/16` | C01、C02、C05、E02、E04 |
| 3 | `hand=0` 时 `resume()` 产出协议非法的上行 | 新标签页一刷新即 `ProtocolError: invalid message at "hand"` | `client.ts::resume()` 在 `hand < 1` 返回 null ⇒ 上层自然走 join | `client/16` | C04 |
| 4 | **房间进程被未捕获 `TypeError` 打死** | 庄家那一座没交份额 ⇒ 被剔出本局 ⇒ `h.dealer` 不在 `seats` ⇒ `startHand` 抛在**注入时钟的回调里** ⇒ 整个进程退出、`/health` 不再应答 | `room.ts` 新增 `dealerAmong(seats, preferred)`（确定性：原庄在席仍用它，否则取不小于它的第一个在席者，绕回最小），`beginHand` 的同一条兜底改为共用，不留两遍；挪位在日志里对每家说一句 | `room/29` | D01、D02（存活，见 10-F） |

另有一条**不是缺陷的设计收紧**（由变异 E02 先逃后抓逼出来的）：见 evidence §7 与 TEST-OUTPUT 10.4 第 2 条。

## 10-E. 自行决定清单（§0.8 允许自决，报备备查）

① 价格接缝的取数点写成"一个 `show(kind)` 包装 + 三档调用"，而不是每个按钮各调一次 `priceOf`；`nst/10` 因此断言接缝里 `priceOf(` 恰好出现一次、三档都走包装——两处各写一遍算式正是 A2 ④ 要防的。
② 房间进程的收尾路径除 `SIGINT/SIGTERM` 外**另给一条能被脚本驱动的** `quit`（stdin 一行）：Windows 下 SIGINT 投不给被 spawn 的子进程（libuv 只能 TerminateProcess，那是硬杀），只靠信号那条路在 Windows 上根本没法测"干净退出"。只认真正出现的 `quit` 一行，单纯 EOF 不算停机命令。
③ 房间进程同时端页面（`ws.ts` 只开一个 `onHttpRequest` 钩子，`netx/serve.ts` 把 `webmin/serve.ts` 的纯函数接上去）。工单要"一条命令起"，起两个进程不符合那句话；`ws.ts` 本身仍然不认识任何页面。
④ `netx/serve.ts` 允许认识 `webmin/serve.ts`（组合根；反向仍被 `nst/04` 禁），文件头写明它是组合根、不被任何库 import、测试只 import 其中的 `startRoom`。
⑤ 放行用**逐个点名的文件清单**而不是再开一个目录，防将来往 `netx/` 里新增的服务端文件被目录规则顺手放行；D04 就是这条的自检。
⑥ `renew()` 不清 `violations`：换一桌不该把"上一桌抓到服务端越界"这个审计事实抹掉，停手继续生效。
⑦ 服务端 reject 原文复用同一行"警告位"（优先级低于越界提示），不新增 `Snapshot` 字段 ⇒ `nui/01` 的"两条路键集逐字一致"不受影响。
⑧ 页面熵源只用 `crypto.getRandomValues`，拿不到就**拒绝连接**而不是退回 `Math.random`：份额可预测会让 commit-reveal 的前提失效，那比连不上更糟。
⑨ 凭据作废后的自动重入桌加一次性闩锁（防被坏服务端拖成 join 洪水），E04 专门盯它。
⑩ `main.ts` 的自动重连上限 5 次、退避 `800ms×N`：只决定"断网时别把 CPU 烧干"，不参与任何判定，无头用例不走它。
⑪ 测试工装在 stderr 那一侧精确过滤带 PID 的 `stripTypeScriptTypes` 实验警告（先试 `process.on('warning')`，实测拦不住默认打印），并钉成 `nst/11`。

## 10-F. 已知未覆盖 / 偏差（不藏着，按你上轮的要求列全）

| 项 | 状态 | 理由与代价 |
|---|---|---|
| 验收① 的"真鼠标坐标点击两整手" | **偏差（环境所限）** | 内嵌浏览器窗口 531×559，画布只有 526×484 < `MIN_VIEWPORT 560×560` ⇒ `scene` 按 rev=7 裁定走"窗口太小"路径、`scene.hits` 为空。已用页面同一个 `send()` 路径在真浏览器跑完两整手并留证；坐标数学由 `ui3` 的 `hitAt` 用例 + `nui/01`（960×620 下 `hits.length>0` 且 id 不重复）在无头侧钉。**请你用 setViewportSize ≥720×640 补这一遍** |
| 同一浏览器两个标签页同时在线 | **偏差（工具面无新标签页原语）** | `window.open` 被弹窗拦截，且面板 hidden 时拿不到用户激活。机制由 `nui/07`（per-tab + 共享存储反面对照）与 `srv/05`/`nui/16`（禁 `localStorage`，变异 E01 被抓）覆盖 |
| 交付截图 | **缺** | `take_screenshot` 报 `visibilityState=hidden`；证据改为文本形式落在 `evidence/m5-browser-live.txt`（含页面两侧同时读数） |
| D02 变异存活 | **等价性论证** | `join()` 只分配最小空位 ⇒ `eligible` 恒为 roster 前缀；`firstDealer` 又必须在 roster 内（否则构造期 TypeError，`room/27` 守着）⇒ 兜底只在"原庄在所有在席者之后"时触发，此时 `dealerAmong` 绕回最小，与旧写法恒等。我按相反假设写过 `room/30`，是**构造前提自己失败**才发现的（该用例已撤除）。可达的那一支由 `room/29` + D01 钉着 |
| `client.ts:96-97` 等"自检对象是自己刚算的值"几条恒真分支 | **沿 rev=9 口径继续记为按构造恒真** | 与上轮你认可的 R05/R13/C20 同档，本轮未新增此类 |
| `webui/main.ts` 里 WebSocket 事件与退避计时器本身 | 无头不覆盖 | 这一层的时钟/IO 出口就是它；语义由 `nui/06`/`nui/18` 在 netplay 层钉，形态由 `nui/16` 静态门（含"onmessage 必须是纯管道、`joinWire()` 只许出现一次"）钉住 |
| `webmin/serve.ts::serveStatic` 的 500 分支（读文件失败） | 未覆盖 | 只在磁盘异常时到达；`resolveStatic` 的拒绝面（穿越、扩展名、目录列表、netx 名单）都有用例 |

---

# SELF-REVIEW.md —— rev=9 自评表（本轮交付：M4 定点返修 —— REVIEW.md 的五必修 + 五应修 + 覆盖补缺）

对应裁定：`REVIEW.md`（rev=8 复审，结论 REVISE）。逐条验收口径就是你 §8 那六条。

## 9-A. 必修 1–5 / 应修 1–5 / §8 验收口径 逐条自评

| 条目 | 自评 | 凭据（第一手） |
|---|---|---|
| 必修 1 承诺存储写一次 | **过** | `netx/client.ts:147-160`；用例 `client/12`（你 S1a 的场景：改口即违规 + 旧承诺留在手里 + 随后的自洽揭示被 `does not open its commitment` 拦住 + `verifiedHand=null`）、`client/13`（S1b 对照）、`client/13b`（同值重发放过、换局重开账 —— 不误伤 `room/17`/`ws/04`）、`client/14`；变异 C13/C14/C15 全被抓 |
| 必修 2 死代码删除 | **过** | `netx/room.ts:279-288`（两行已删，理由写成注释留在原地）；`room/10`+`room/25④` 断言"到点发牌之后 `missing=[]` 且待发定时器只剩 1 只"；变异 R18（不重建 expected）、R19（就地发牌忘 drop）被抓，R19b（到点路径忘 drop）存活 = 等价（那只表已自行触发） |
| 必修 3 426 Upgrade Required | **过** | `netx/ws.ts:153-166`；`ws/03` 断言收紧到状态行逐字 + `Sec-WebSocket-Version: 13` + 反向断言无 `425`；`ws/05` 九条分档；变异 X18/X19/X20 全被抓。RFC 原文我按 §4.2.2 第 3/4 步核过：**缺**版本字段属必需字段缺失 ⇒ 400，**有但不支持** ⇒ MUST 426 + 版本清单 |
| 必修 4 排序键统一 | **过** | `netx/seed.ts:70-75`（`byCodepoint` 为唯一键）+ `canonicalShares` 改按 party 排 + `seedVector` 同键；`seed/13`（大小写分叉 + 权威路径手拼重算）、`seed/14`（前缀相撞的新分叉，见 9-C①）；变异 S13/S14/S15 全被抓；`seed/11` 固定向量一字未改仍命中 ⇒ 生产 party 集合的定序未被挪动 |
| 必修 5 Q4=B 落地 | **过** | `src/engine/actions.ts:63-77`（`doCall`/`doFold`）+ `:101-107`（timeout 分支）+ `validate.ts` 注释；必钉 (a)–(f) 逐条：(a) `timeout/01`+`room/07`（终局 `stall`）、(b) `timeout/02`、(c) `timeout/03`、(d) `timeout/04`、(e) `room/07` 重写 + `room/10`/`room/18`/`room/20`/`ws/04` 同步、(f) 变异 T01（改回 fold）与 T02/T03/M01（去字样）全被抓。没改成房间层代发 `call`（可归因性），托管不 look/raise/compare（`timeout/04` 对日志类型做全集断言） |
| 应修 1 `frames.ts:3` 编号 | **过** | 改为 Q5 并写明裁定结论 |
| 应修 2 `sha256.ts:5` 文件名 | **过** | 改为 `test/netx-crypto.test.ts`；顺手全仓 grep `netx-sha` 已无残留 |
| 应修 3 `static.test.ts:98` 注释 | **过** | 改成"字段整体缺省，Q5 裁定缺省 ≡ 空对象"，并说明这条对两种写法都容忍 |
| 应修 4 `Clock.now` | **过（取"去掉"这一支）** | `netx/room.ts:34-40`（接口只剩 `after`）+ `netx/ws.ts:45-53`（唯一的 `Date.now()` 删除）⇒ **`netx/` 全层不再出现 `Date`**；夹具的钟面观测降级为 `FakeClock.now()`（测试自己的类型成员，`test/netx-fixtures.ts:11-16`）；`nst/08` 加三条反向断言；变异 X21/X22 都被抓 |
| 应修 5 连接清单定序 | **过** | `netx/room.ts` 用 `byCodepoint`；`room/26` 用大小写混合的 id 让两套键真的分叉（第一轮我用的全是小写 ⇒ 变异逃过，见 9-D） |
| §8.3 点名的两处（`client.ts:47/50`、`room.ts:564-567`） | **过** | `client/15`（S9 移植 + 第四道信封闸 + 合法增量对照）、`room/21`（ping→pong 三条各自回显） |
| §8.4 双跑 / tsc / 依赖面 / `nst/07` | **过** | `node test/run.ts` 两次 461 行逐字节相同 `sha256=8d172a35…`；`npx tsc --noEmit` 退出码 0 零输出；`dependencies` 仍缺省（≡ `{}`）；`nst/07` 仍在且仍绿 |
| §8.6 `src/` 不许破 | **过** | `src/` 只改了 timeout 映射与一条注释；`static/00`/`static/05`/`static/13`（无时钟/随机/IO/全局态）与 `nst/04`（分层）全绿；新增变异 N01 第一轮逃过 ⇒ 修了 `nst/04` 的检查面后被抓（9-D） |
| §8.5 manifest 重算一致、交付后不再改动 | **过** | 见 `DELIVERY.md` rev=9：manifest 覆盖 70 个文件（rev=8 的 69 个 + 新增 `test/engine-timeout.test.ts`；`DELIVERY.md` 自身不列） |
| 其余 §5 覆盖缺口 | **偏差（部分不补，理由写在 9-D）** | `client.ts:95-97` 与 `room.ts` 三道自检：按构造恒真；分别用变异 C20（单独摘掉全绿）与 rev=8 你已认可的 R05/R13 论证支撑 |

## 9-B. §5 禁止事项（rev=9 增量自查）

| 禁令 | 自查 |
|---|---|
| 引擎禁 `Math.random`/`Date.now`/IO/全局可变态 | 未新增任何一处：`src/engine/actions.ts` 的改动只用到已有的 `actionCost`/`canAffordCall`/`seatAt`/`pay`/`advance`；`static/05`、`static/13` 绿 |
| 规则分歧必须走 `Rules`，不许写 if 分支 | 托管语义读的是 `state.rules.bet.dark/seen` 经由 `actionCost` 的既有路径，没有为联机或托管新增任何规则数值分支 |
| 禁写边池/全押/退款 | `doCall` 在"付不起"时**根本不会被调用**（`canAffordCall` 先判），所以也不存在欠款路径；`timeout/02` 断言 `chips===0` 且 `committed===ante` |
| 禁"下注轮结束"检测 / 全局圈状态 | 未动终止条件；本轮反而用 `T06`（摘掉行动计数 `bump`）证明终止③是真在兜事 |
| 交付后不得修改 manifest 已覆盖文件 | rev=9 会重算 manifest；写完后不再动 |
| 零运行时依赖 | `package.json` 一字未改；`netx/` 的 import 面仍是 `node:http`/`node:crypto`/`node:stream` + 项目内文件；`nst/02`/`nst/07` 绿 |
| 不为通过测试特判用例 | 新用例都是"构造条件 → 断言"，没有按 seed/座位号特判；`room/07` 从三家改两家是**工装事实**（房间在两家份额齐时就发牌，第三家只能中途入座），不是为凑断言 —— 三家全程托管的等价场景放在引擎层 `timeout/01`（9 次托管、终局 stall） |

## 9-C. 自行决定清单（rev=9，§0.8 允许自决、报备备查）

1. **必修 4 往下挖了一层**：`canonicalShares` 原先排的是 `party=value` 拼接串，`seedVector` 排的是 `party`。两个名字互为前缀时（`seat:1` 与 `seat:10`，11 人桌才会出现）`'='(61) > '0'(48)` ⇒ 两种排法**真的分叉**。我把权威路径改成按 `party` 排，让两条路径同尺，并配 `seed/14` 钉住。影响面：生产 party 集合（`server` + `seat:0..5`，`rules.players.max=6`）不变 —— `seed/11` 的固定向量一字未改仍然命中，可核对。
2. **`Sec-WebSocket-Key` 的校验口径维持"存在即可见 ASCII 1..128"**，不校验它是不是 16 字节的 base64：RFC 6455 §4.2.2 只要求该字段存在（值的形状是客户端的事）。因此 `ws/05` 的 key 用例只测"缺失/空值 ⇒ 400"，不测"非 base64 ⇒ 拒"。若你判定该收紧，改一处 `handshakeAccept` 即可，其余不动。
3. **`ws/05` 里"缺 Upgrade / 缺 Connection"两条按 404 记账**：这是 Node 的 http 自己就把这类请求当普通 HTTP（不给 `upgrade` 事件），我们的 guard 在它后面。我没有为了"让它看起来被抓"去伪造请求，而是把**谁答的**写进用例注释与本节。
4. **`Clock` 接口的 `now` 选择删除而不是文档化**（你给了两支，我取更彻底的那支）：删掉后 `netx/` 全层零 `Date`，注入面只剩"到点叫我"。测试夹具保留自己的 `now()`（它需要算到期时间做断言），这属于测试侧观测，不构成产品接口。
5. **`room/07` 改成两人局并把三家场景挪到引擎层**：环线工装下第三家必然在发牌后才入座（房间在两家份额齐时就发牌），这是 rev=8 就存在的事实，旧用例只是靠"托管=弃牌"掩盖了它。三家全程托管走满 9 次行动、终局 stall 的断言放在 `timeout/01`（引擎层，无工装限制）。
6. **`engine-timeout.test.ts` 用独立文件而不是塞进 `engine-illegal.test.ts`**：托管语义是行为规格不是非法清单，放一起会让"必拒清单"混进"必成清单"。
7. **变异工装脚本这次留在 `.scratch/`（不删）**：`r9-mutate{,2,3,4,5}.mjs` + 五份 out 文件。它们不在 manifest 内、不进 `tsconfig.include`、不被 `test/run.ts` 发现，但你可以直接重跑任意一条。rev=8 我交付时删了脚本，结果本轮无法重跑那 76 条 —— 这个代价我记在 9.7 的口径说明里，脚本从此不删。
8. **TEST-OUTPUT 的双跑哈希改按 `node test/run.ts` 取**：`npm test` 末尾会追加"npm 有新版"的提示行，取决于网络与 npm 版本，拿它做哈希等于把一个不可复现的东西写进交付。`npm test` 仍然给退出码与结论行，正文与 `node test/run.ts` 逐字节相同。

## 9-D. 本轮的缺陷、先逃后抓、以及"已知未覆盖 + 为什么可接受"

**先逃后抓三条（都是检查面自己有空洞，不是产品缺陷）**
1. `S16`（连接清单改回 `localeCompare`）第一轮逃过 —— 我的 id 集合全小写，两套键不分叉，用例空转。换成大小写混合 + "两套键必须给出不同顺序"的前提断言后被抓。
2. `N01`（`src/engine/actions.ts` import `'../../netx/seed.ts'`）第一轮逃过 —— `nst/04` 只扫三个目录的**顶层**文件，正则还只认单层 `../netx/`。改成递归遍历 + 匹配任何含 `netx/` 的说明符，并加"扫描清单里必须真的有 `src/engine/actions.ts`"的自检后被抓。
3. `T06`（跟注不记账）第一次跑成进程崩溃（我顺手把 `let` 写成 `const`）⇒ "被抓"的证据类型不对。换成合法变异重跑：58 条同时炸，是本轮连带面最大的一条。

**已知未覆盖 + 为什么可接受**
| 位置 | 为什么够不到 | 触发条件（届时必须先配断言） |
|---|---|---|
| `netx/client.ts:95-97`（合并后条数 = seq） | `since == 本地 seq` 与 `logShape(起点/连续/尾条)` 已蕴含条数恒等。证据：C20 单独摘掉 ⇒ 362 全绿；K01–K04 连同前提一起摘 ⇒ 仍被别的闸抓住 | 任何人放宽前三道闸中的任意一道 |
| `netx/room.ts` 出口防泄漏自检（`viewFor` 的 `why !== null` 分支） | 投影是自己刚用 `project()` 算出来的 ⇒ 恒真（你 rev=8 已认可同一论证） | 改 `project()` 的出口形状，或让 `viewFor` 之外的路径也能拼 View |
| `netx/room.ts` 揭示前自检（含"份额不再合成出发牌那颗种子"） | 自检对象是自己刚算的值 | 改 `revealMsg()`/`shareSet()` 的构造，或允许局中往 `nonces` 里补写 |
| `netx/room.ts` 引擎拒自己刚产出的行动（`verdict.ok === false`） | `step()` 前那一道 `checkAction` 与 `apply` 用的是同一个状态与同一个行动 | 让某条路径绕过 `step()` 直接 `apply` |
| `netx/ws.ts` 的 Upgrade / Connection 两道 guard | Node 的 http 不给这类请求派发 `upgrade` 事件 ⇒ 本机走不到（`ws/05` 里按 404 记账） | 前置代理或换 HTTP 实现 |
| `netx/frames.ts:162-163`（载荷超过 `Number.MAX_SAFE_INTEGER`）、`:241-243`（close reason 非 UTF-8） | 编码侧构造不出那么大的 `Uint8Array`；reason 是 JS 字符串，`TextEncoder` 不会抛 | 引入外部构造者或改协议载荷类型 |

**本轮真实修出的东西（不是美化）**：①`canonicalShares` 与 `seedVector` 在前缀相撞的 party 名上分叉（9-C①）；②`nst/04` 的分层检查有目录深度与正则两处空洞（9-D②）；③`room/07` 的旧断言掩盖了"第三家在中途才入座 ⇒ 那一局本来就两家"这个工装事实（9-C⑤）。

## 9-E. 复现命令

```
cd /f/qoder/zjh
node test/run.ts            # 461 行；sha256 = 8d172a35494ad77b32057c0ee86522df2df6c2644f9cb2ddb01d15d2dc177a7d
node test/run.ts | tail -3  # SUMMARY pass=362 fail=0 total=362 / RESULT=ALL_PASS
npx tsc --noEmit            # 退出码 0，零输出
sed -n '/^manifest:/,/^notes:/p' DELIVERY.md | grep -E '^[0-9a-f]{64}  ' > /tmp/zjh-manifest.txt   # 或落地成文件
sha256sum -c /tmp/zjh-manifest.txt            # 71/71 OK
node .scratch/r9-mutate.mjs check             # 只校验锚点，不改文件（跑变异会就地改源码再还原，跑完核对 sha）
node .scratch/r9-mutate4.mjs                  # 第四批 10 条（房间拒绝分支 / 帧编码自检 / 分层 / note 前缀）
```

# SELF-REVIEW.md —— rev=8 自评表（本轮交付：M4 联机 —— 权威服务端 + 多方 commit-reveal 种子 + 快照/增量重连 + 超时托管）

对应工单 §0.3 与 §0.8。结论口径：**过 / 不过 / 偏差**。
证据在 `TEST-OUTPUT.md` 的 **第 8 节**（340 例、双跑同哈希、76 条变异（69 抓 / 7 条等价性论证）、真实 socket 用 Node 内置 WebSocket 客户端互通）。
本轮**只新增 `netx/` 一层与 `test/netx-*.test.ts`**；rev=7 manifest 里 50 个文件只有 `tsconfig.json` 动了一行（include 加 `netx/**/*.ts`），其余逐字节不变（哈希核对见 8-D）。

## 8-A. §4 M4 逐条

| §4 M4 要求 | 结论 | 证据 |
|---|---|---|
| Node ws 权威服务端 | 过（**未装 `ws`**，见 Q5） | `netx/ws.ts` = `node:http` 的 upgrade + `netx/frames.ts` 手写的 RFC 6455 子集；`netx/room.ts` 是唯一写者，客户端只有 5 条上行（join / nonce / action / resume / ping）。**互通不是自证**：`test/netx-ws.test.ts::ws/01` 用 Node 内置的全局 `WebSocket`（undici，另一套独立实现）打真实 socket，三个客户端各自走完一手牌并核对揭示；`ws/03` 用裸 socket 证明 accept 值逐字节命中 RFC 6455 §1.3、未掩码帧被服务端以 1002 关掉。机检 = `nst/02`（零裸包名 import）、`nst/07`（`dependencies` 仍为空且明确断言"没装 ws"）。变异 **P06/F01–F16/R17/X17b** |
| commit-reveal **必须多方合成** seed（服务端先 commit → 各家交 nonce → 合成 → 局末揭示全部份额） | 过 | `netx/seed.ts`：承诺 = `SHA-256(tag\|hand\|party\|value)`（把局号与提交方绑进去 ⇒ 第 N 局的份额冒充不了第 M 局的揭示）；seed = `SHA-256(按 party 字典序拼接的全部份额)` 前 32 bit。顺序无关、改任一家必变、单方扫描 32 个候选各不相同（**没有旁观者，也没有支配者**）。线上顺序可查：`room/02` 断言第一份 nonce 一定排在服务端 commit 之后；`room/03` 断言份额没齐就**不发牌**、`leak/02` 断言揭示之前种子与各家份额明文都不上线。摘要本身：`netx/01/02/03/08` 与 `node:crypto` 逐字节差分（208 条 SHA-256 + 202 条 SHA-1）。变异 **S01–S12、R01/R15/R16、C01–C04、client/11** |
| stateSeq 快照 + 增量重连 | 过 | `patch` = 权威数字 + `(since, seq]` 这一段日志；`view` = 全量快照。`room/08` 断言"seq 对得上的重连只拿到 patch"且补齐后三家日志逐条相同；`room/09` 断言跨局重连必须走快照且日志从第 1 条起；`leak/04` 用"每动一次就掉线重连"的抖动客户端与一路稳定的客户端对账 ⇒ 日志与数字**两条路径收敛到同一状态**；`room/17` 断言缺席完全局的人回来还能拿回承诺+快照+揭示（审计材料不因断线丢失）。客户端三条不变量各自有哨：seq 不许倒退/对不上号不合并/日志有洞不合并（`client/04`、`client/05`）。变异 **R06/X06c、R07/R08、C05/C06/C12** |
| 超时托管 | 过（语义按引擎既有口径，见 Q4） | 时钟从外面注入（`RoomOptions.clock` + `turnMs`），到点注入 `{kind:'timeout', seat}` ⇒ 引擎映射成弃牌并在日志里留 `timeout→fold`。`room/07`：**全程零上行行动**，一手牌靠托管自己走完并结算揭示；`room/18`：每一阶段待发定时器恒为 1 只（发牌后 nonce 表必须被取消）；掉线者同样由这条路接管，不会卡桌（`room/10`）。变异 **R02/R03** |
| 联机层不得削弱既有防泄漏口径 | 过 | 第一道墙仍是 `src/engine/project.ts`（一字未动）；第二道 = `netx/protocol.ts::checkViewLeak`（服务端出口前 + 客户端收到后各跑一次），把 rev=4 那条"没看牌时自己的牌也不可见"搬到线上；第三道 = 逐条字节的离线扫描：`leak/01` 用揭示后公开的种子**独立复算**每家三张牌（与投影亮出的牌逐张对账），再扫描"别人看到且该家尚未亮牌"的全部下行 ⇒ 96 次检查零命中；`leak/02` 扫种子字段/种子数字/份额明文；`leak/05` 证明被污染的投影会被当场识判并且**从此拒绝再发行动**。变异 **R05/R13、C11** |
| 引擎/规则不受联机层影响（回放确定性保持） | 过 | `src/**` 逐字节未改；`test/m2-fuzz.test.ts`、`engine-*` 全部仍绿（M4 的用例是新文件，M0–M3 的期望值一条没动）。`nst/04` 机检 src/ 与 webui/、webmin/ 都不反向依赖 netx/。选庄复用 `webmin/model.ts::nextDealerOf`（同一出处，不另写一套），`room/11` 跑三局验证 0→1→2 轮庄 + 筹码守恒 |
| 测试自身先被验证（§0.5 双跑一致） | 过 | `npm test` 连跑两次退出码均 0，输出 sha256 = `9b516eb4a181b761faabf997491247aeb03d7911047c53a4c8c0610e56a9eec1`（逐字节相同，见 TEST-OUTPUT 8.2）。真实 socket 测试不引时间戳：全部时间量走注入的虚拟时钟；唯一例外是 `netx-ws.test.ts` 的 20 秒**看门狗**（只防挂死、不参与判定），这条例外写在 `nst/09` 里并反向断言其存在 |

## 8-B. §5 禁止事项（M4 增量自查）

| 禁止项 | 自查 |
|---|---|
| 引擎/cards 内 `Math.random` / `Date.now` / 文件网络 IO / 全局可变态 | `src/**` 一字未动，`static/01/02/03` 仍全绿；新增的联机层同样不越界：`nst/03` 对 `sha256/seed/protocol/frames/client/room` 六个文件扫时钟、随机、`node:`、`process.`、`console.` 全为 0 命中（⇒ 同一份代码浏览器里也能跑） |
| 规则分歧写成 if 分支 | 本轮没引入任何规则分支；金额/合法性判定仍然只在 `src/engine/*`（房间只是转达与调度，`step()` 之前必过 `checkAction`） |
| 引入"下注轮结束"或全局"圈"状态 | `netx/room.ts` 不读也不写任何轮概念，只管"谁在什么时候能说话" |
| 测试输出含时间戳或随机顺序；随机不固定种子 | 份额与重连凭据的熵全部注入且测试里用确定性计数器（`counterEntropy`）；`nst/09` 扫 M4 测试文件里的 `Math.random` / `Date.now` / `new Date(` / `performance.` = 0 命中 |
| 为通过测试特判用例 | 无。反过来，本轮新增的 5 条断言（`seed/12`、`room/18/19`、`proto/12`、`client/11`）全是被变异逼出来的：**先逃后抓逐条列在 8-D** |
| 交付后修改 manifest 已覆盖的文件 | rev=7 的 50 个文件只有 `tsconfig.json` 改了一行（`include` 增加 `netx/**/*.ts`，否则新增文件不在 `tsc --noEmit` 的检查面里）；其余 49 个哈希逐字不变 |
| 读写 `zjh/` 之外的目录 | 未越界；变异工装与探针脚本放在仓库内 `.scratch/` 并已删除 |

## 8-C. 自行决定清单（M4，§0.8 允许自决、报备备查）

1. **一个包都不装**：手写 RFC 6455（握手用 SHA-1 —— 那是 RFC 规定的算法，不涉抗碰撞；承诺与种子用 SHA-256）。理由与替换成本见 **Q5**。
2. 上行 `action` 只带 `move` 不带 `seat`：座位由连接绑定，"替别人行动"在 schema 里**无法表达**（`room/05` + 变异 X17b）。
3. 上行 `Move` 里没有 `settle`、也没有 `timeout`：结算与托管只能是服务端/时钟的动作（`proto/02`、`room/05`、`room/07`）。
4. 承诺文本把 **hand + party + value** 三元绑定（防跨局复用），并给 party 定死 charset `[A-Za-z0-9_:.-]`、value 定死 8–256 位十六进制 ⇒ 拼接文本单射，不存在"换个分隔符凑出同一串"的路子（`seed/07`）。
5. 各家 nonce 按工单字面流程**明文**交给服务端（不二次承诺）；代价与对策写在 `netx/seed.ts` 头注释里：每家在揭示里核对"我那份原样在场"，服务端篡改本人份额当场可见。
6. 合成对 party 字典序 ⇒ 与提交顺序无关，任何一端能独立复算（`seed/02`）。
7. 到 `nonceMs` 还没交份额的那一家，**这一局不带它**（筹码原地不动）；剩余不足最低人数就继续等并广播原因（`room/10`）。
8. 通道分工：`patch` 带权威数字 + `(since,seq]` 日志增量；`view` 带全量快照。跨局或 seq 对不上 ⇒ 快照（`room/08`、`room/09`）。
9. 掉线 = 保留座位与筹码（凭 token 可回），回合定时器照常托管该座位；同座第二串有效凭据顶掉旧连接（旧连接收 `replaced`）。房间不自动清退（`room/13`）。
10. 重连一律补发：本局承诺 → 收集进度 → 局面（快照或增量）→（若已结算）揭示（`room/17`）。
11. 服务端出口也过协议校验与防泄漏自检：非法消息在本地炸、越界投影整条不发并把房间标成 `fault`（此后不再开局 —— 宁可停桌也不漏牌）。
12. 最小买入做成房间层旋钮 `minBuyIn`，默认 `256 × ante`（§1 全押行把这条划给房间层）；测试用它在两局内制造破产，从而覆盖 `over` 分支（`room/12/15`）。
13. 一座位一连接；未绑上座位的连接连 `ping` 都不受理（`room/19`）。
14. 协议 id `zjh-m4-1` 同时作为 ws 子协议回显（浏览器/中间层能一眼认出）。
15. 帧与消息硬上限 1 MiB、只接文本帧、控制帧严格校验（长度/不分片/close code 白名单）⇒ DoS 面收在传输层。
16. 时钟与熵从 `RoomOptions` 注入，`room.ts` 内不出现 `Date`/`setTimeout`/`Math.random` ⇒ 托管与超期是虚拟时钟下的字节级断言。
17. 房间提供 `dispose()`：真实服务端退出时取消全部定时器（否则进程收不了尾）。
18. 测试工装里唯一允许 `setTimeout` 的是 `netx-ws.test.ts`（看门狗），并且被 `nst/09` 反向断言写死在明面上。
19. **没做联机 UI 页面**：M4 那行只要求服务端 + 种子合成 + 重连 + 托管。想手动连进房间：`node netx/serve.ts 8790`，浏览器控制台里 `new WebSocket('ws://127.0.0.1:8790/','zjh-m4-1')` 即可（房间状态可看 `http://127.0.0.1:8790/health`）。

## 8-D. 本轮真实修出的缺陷 + 先逃后抓的盲区

**产品缺陷（5 条，全部由测试逼出，不是美化）**

1. `encodeFrame` **漏写 4 字节掩码键**（掩码 XOR 从偏移 2 开始）⇒ 任何掩码帧都解不回。抓出者 = `frame/02` 的逐字节断言。
2. 握手写成 `SHA-256` 且 GUID 记错一位（`E9A4` ≠ `E914`）⇒ accept 值与 RFC 不符，任何标准客户端都会拒。抓出者 = `crypto/05`+`frame/15` 的公开向量；顺带确认：RFC 6455 的 accept 用的是 **SHA-1**（我原先记错成 SHA-256）。
3. 广播没刷到别的连接：一条上行引发的开局/别人的行动，只刷了"发话那一条"socket ⇒ 其余客户端永远收不到局面。**只有真 socket 测试能抓到**（环线工装每轮都主动取队列，天然看不见这个洞）。抓出者 = `ws/01`。
4. nonce 缺席到点后只重挂定时器不判"是否已齐"⇒ 剔掉缺席者之后牌局永不发。抓出者 = `room/10`。
5. 中途/断线重连的客户端拿不到本局承诺（以及已结算局的揭示）⇒ 局末无从核对。抓出者 = `room/17` 与 `ws/04`（外加 `client/06` 把"没有承诺就不参与合成"钉成断言）。

**先逃后抓的盲区（第一版测试没盖住、补断言后才被变异抓住）**

| 逃过的变异 | 症状 | 补上的哨 |
|---|---|---|
| S08 种子只取 16 位 | 高位丢失仍可穷举，但没有任何断言用到高位 | `seed/12`：4096 组份额 ⇒ 4096 个互不相同的种子，且最大值 > 0xffff |
| P13 出口编码不校验 | 协议只约束客户端、服务端可乱发，而正常流永远发合法消息 | `proto/12`：6 类非法消息**在 encode 阶段**就必须抛 |
| C04 揭示不核对"用的就是那颗种子" | 只查"这组份额自洽" ⇒ 服务端事后可编一组自洽假份额 | `client/11`：造一组自洽但 ≠ 真正发牌种子的揭示，必须报 |
| R18 未绑座也能行动 | 少了 `no_seat` 回执，局面不动但客户端拿不到反馈 | `room/19`：三条上行都得 `error: no_seat` |
| R04 发牌后不取消 nonce 定时器 | 定时器泄漏在功能上不可见 | `room/18`：每阶段待发定时器数量恒为 1 |

**存活的 7 条变异 = 等价变异（每条给出可达性论证，不是"没找到用例"）**：`R05`、`R13`、`X13b`（对"自己刚算出的值"的自检，可达输入下恒真；同样的核对搬到客户端由 C01/C04/C11 抓死）；`R06`、`X06c`（mark 的局号门与"开局清 mark"互为冗余，两条一起撤时新局首推 seq=1 仍必然走快照 ⇒ 差异不可达）；`R17`（move 里根本没有 seat，协议门先拒；两道门一起撤 = X17b 被 `room/05` 抓）；`C12`（`since === 本地 seq` + "delta 从 since+1 连续到 seq" 已蕴含条数相等）。

**我自己写测试时踩到的两个坑（记下来免得再犯）**

- 公开向量凭记忆写长十六进制串不可靠：我先后记错了一条 56 字节 SHA-256 向量的后半段和百万 'a' 向量的第 21 位起，也记错了 WebSocket 的 GUID。**改法**：常量面只留能独立核对的三条，其余交给与 `node:crypto` 的逐条差分（`netx/02`、`netx/08`），差分才是主证据。
- 编辑长 markdown/测试文件时，`Edit` 的 old_string 若是一条 `test(...)` 标题行而 new_string 忘了把它带上，就会把后面的用例体"吊空"。本轮犯了三次，每次都靠紧接着 `grep`/`tail` 复核才发现 —— 交付前的 `tsc --noEmit` + 全量重跑是兜底。

## 8-E. 复现命令

```bash
cd F:/qoder/zjh
npm test                      # 340 例；exit=0；两次运行输出逐字节相同
sha256sum <(npm test) <(npm test)   # 同上两行哈希一致
npx tsc --noEmit              # exit=0（netx/ 已在 include 里）
node netx/serve.ts 8790       # 起一个 6 座房间；浏览器 new WebSocket('ws://127.0.0.1:8790/','zjh-m4-1')
curl -s http://127.0.0.1:8790/health
# 变异扫描（本轮 76 条）：脚本已随交付删除；逐条结果原文见 TEST-OUTPUT.md 8.6
```

---

# rev=7 自评表（M3 观感修正 —— 牌面放大 + 布局重排；已由 REVIEW.md 裁定 PASS）


## 7-A. §4 rev=7 逐条

| §4 rev=7 要求 | 结论 | 证据 |
|---|---|---|
| ① 牌面与字号显著放大（量级：牌 ≥48×64、点数字号 ≥18，本人再大一档） | 过 | `webui/scene.ts` 的 `CARD = 48×64 / 点数 20 + 花色 18`、`OWN_CARD = 56×78 / 24 + 22`；哨 = `ui3/18`（从图元树里量，不看常量表：每张亮牌矩形 ≥48×64、每个牌角字号 ≥18、本人档严格大于别家档）；变异 **N01/N02/N03**（退回 21×28、字号退 10、本人不放大）全部被抓 |
| ① 附带：放大后仍要"逐张读得出来" | 过（先逃后抓） | 牌角改成真实扑克那样**两行**（点数一行、花色一行）。原因不是美观：扇形叠放时每张只露出左边 30px，"T♥"写成一行在 20px 下要 32px，会爬到邻牌脸上 —— 第一版就是这样，被变异 **N04/N13** 抓到后才改。哨 = `ui3/23`（每个牌角图元必须待在本牌露出区内） |
| ② 座位环与按钮/日志布局随之重排，2–6 家都放得下 | 过 | 座位环 = 本人在最下方 + 对手沿顶部横排均分宽度 + 五家以上两侧各让一枚（`placePlates`）；竖向预算改成"先满足牌桌硬需求，再给底部条，最后按钮条"（`ringNeed` + `roomForRing` 收缩日志行数）；按钮条列数吃满宽度 ⇒ 行数最少。哨 = `ui3/19`（2–6 家 × 四种视口：座位板数量对得上、互不重叠、不越界、不压按钮也不压底部条）、`ui3/09c`、`ui3/19b`（极端候选数下只许二选一：明说装不下，或者谁都不压谁）；变异 **N05–N07、N11、N12** |
| ③ 翻牌动画、暗牌不露、命中区与绘制同步的既有不变量全部保持 | 过 | 翻牌门 `flipProgress(...) >= 0.5` 一字未动（`ui3/15`、变异 **U11/U12**）；暗牌不露在放大之后**更严**：`ui3/11` 现在除了扫"Q♠"这种成对写法，还扫单个点数/花色字符（牌角变两行后漏点会漏成单字）；命中区闭区间 + paint 几何逐字不改写仍在（`ui3/10`、`ui3/12`，变异 **U06/U07/U13**） |
| ④ 标准窗口（≥720×640）截图经 OCR 能读出每张已亮牌 | 过（但**换了通道**才成立） | 本机 `Windows.Media.Ocr` 只装了 `zh-Hans-CN` 一个包，实测它**读不出花色字形**：12 种牌角画法对照里连 44px 的"7♣"都读不出，把本人三张裁出来放大 3× 读出 0 个词 —— 也就是说"字再大"并不等于"机器读得出"。于是桌面中央补一行 ASCII 记法的亮牌文本（`revealedHandsLine`：`亮牌：你 7C TH KC 单张 / 电脑4 8C 3S KS 单张 / 电脑5 6D 6H 9C 对子`），同一张图 OCR 实测九张全读到（`7C TH kC … 8C 3S kS … 6D 6H 9C`，K 被读成小写是引擎噪声）。牌面大字仍然保留给人眼。哨 = `ui/20` + `ui3/24`；变异 **Y01–Y05** |
| ④ 的前提：验收窗口里必须真的画出牌桌（不是"窗口太小"） | 过（本轮实测抓到的第四个缺陷） | 页面原先写死 `#board{height:calc(100vh-92px)}`，控制条在 720 宽下换行 ⇒ 实测画布只有 **694×529 < 560**，复审班一打开就是提示页。改成弹性布局 + 紧凑控制条后同一量法测得 **714×582** ✓。哨 = `ui3/04b`（禁 `calc(100vh`、框架竖向预算 ≤80px，预算里的 46px 是浏览器实测值）；变异 **X01–X03** |

## 7-B. §5 禁止事项（rev=7 增量自查）

| 禁止项 | 自查 |
|---|---|
| 引擎/cards 内时钟/IO/全局可变态 | `src/**` 本轮**一个字未改**（与 rev=6 逐字节相同）；UI 侧禁令照旧：`ui3/02` 对 bridge/scene/paint 禁 `Date`/`Math.random`/`performance.`/`rAF`/DOM |
| 规则分歧写成 if 分支而不是 Rules 配置 | 本轮所有新分支都是**排版分支**（家数→座位带、宽度→列数、文本宽→字号），没有一处读规则口径做判定；每家的结算结果短句由模型算好后经 `SeatCell.resultText` 下发，scene 只印 |
| 写边池 / 全押 / 退款结算 | 未碰 |
| "下注轮结束"检测或全局"圈"状态 | 未引入 |
| 测试输出含时间戳或随机顺序；随机不固定种子 | 用例数 232→242，NOTES 只增两行计数（`UI19 待结算样本…`、`UI20 亮牌：…`）；双跑逐字节同哈希 |
| 交付后改 manifest 文件 | 本轮改动 6 个文件（`webui/{scene.ts,bridge.ts,index.html}`、`webmin/model.ts`、`test/{webui,webmin-model}.test.ts`）+ 新增 3 份证据，全部重算进 rev=7 清单；变异全程在 `.verify/` 副本，跑前跑后 `diff -rq` 证明交付树未被触碰 |
| 读写 `zjh/` 之外目录 | 未读写。本轮新增的取证通道（能收 PNG 的临时服务器）放在 `.scratch/`，随目录删除；后台命令的 stdout 由工具链写到它自己的任务目录 |

## 7-C. 自行决定清单（rev=7，§0.8 允许自决、报备备查）

1. **牌角分两行**（点数一行、花色一行），而不是一行"T♥"。理由见 7-A ① 附带行：这是让"放大"与"扇形叠放"同时成立的关键，而且比一行更接近真实扑克、更利于 OCR。
2. **本人的说明文字挪到牌的左侧**（对手仍是"文字在上、牌在下"）。省下 28px 竖向预算，正是 6 人桌塞进 560 高的前提；代价是本人板比对手板宽（352 vs 124）。
3. **座位环不再强求"椭圆上等角度"**：改为「本人底部 + 对手顶部横排均分 + 五家以上两侧各一枚」。等角度椭圆在 560 高里会让两侧座位互相压住；这一版牺牲了一点"圆"的观感，换来 2–6 家都不重叠、都不越界。
4. **竖向预算的优先级写死成：牌桌 > 底部条 > 按钮条**，日志行数会为牌桌让位（最少 1 行）；真装不下就走提示路径，且提示里带上"几家桌需要多大"。
5. **每家的结算结果搬到座位板上**（新增 `SeatCell.resultText`），结算块只留"结束原因 +（余数归属）+ 指纹"。理由：6 人桌整块结算是 8 行，塞进底部条就把牌桌挤没，画回桌面中央又必然压住刚亮的牌 —— 而"每家的账"本来就是每家一行，就地显示更合理。信息不丢由 `ui/19` 双向核对（摘要 ⊆ 整块、板上短句与整块那行逐字一致、赢家集合一致）。
6. **`resultText` 在待结算相位只说"应赢 N"**，实赢短句要等 `phase === 'settled'`；`ui/19` 专门抓了一个 `awaitingSettle` 样本钉这条（变异 S04 就是把它写死成 settled）。
7. **文字一律不截断，只缩字号或折行**：状态行、台账、结算行、按钮文案都走 `fitSize`/`wrapLabel`。按钮折行后 `ui3/22` 断言"去掉空白后逐字相同"，所以"不截字"是可证的而不是意图。
8. **`Scene` 多导出了 `plates` 与 `strip` 两个布局矩形**（paint 不读）。理由：挤不挤得下是几何问题，只靠图元数量断言不出来；rev=6 的 U05 失效就是因为布局改版后没有可断言的落位矩形。
9. **控制条文案缩短**（"每人买入"→"买入"、去掉 `classic（A23 最小顺）` 的括号说明）。`ui3/04b` 钉的是 option 的 **value** 集合，不受影响；口径说明仍在状态行里（"牌型判定 A23=最小顺"）。
10. **MIN_VIEWPORT 保持 560×560 不降**（用户裁定），本轮改为保证"验收窗口 720×640 里画布真有 560 以上"，即把问题从"下限"挪回"页面框架"。
11. **D（选庄）/A（牌力与决策）两族变异本轮不重复计入**：所指代码（`src/rules.ts`、`src/engine/*`、`src/ai/honest.ts` 的牌力与阈值）与 rev=6 逐字节相同，其 73 条全量表在 TEST-OUTPUT 的 M3.6 节；本轮扫的是"改过的面"共 **70 条**（V 12 + W 13 + U 18 + N 13 + S 5 + X 3 + Y 5 + C 3），69 caught、0 SKIPPED。
12. **取证通道**：临时服务器复用 `webmin/serve.ts` 的 `resolveStatic` 与同一条 `stripTypeScriptTypes`，只加一条 `POST /save`；它不属于交付物，取证完随 `.scratch/` 删除。这样拿到的 PNG 是**页面真实渲染代码在真 Canvas2D 上的产物**，而不是我按图元列表手工画的示意图。
13. **给机器的读法单独做一条 ASCII 文本行**（`revealedHandsLine` / `handAscii`，♠→S ♥→H ♦→D ♣→C）。这是我在照着验收④的方法真跑过 OCR 之后才做的决定：本机引擎读不出花色字形（44px 也读不出），继续加大字号是白工，而"成行的 ASCII 文本"它读得动。代价是桌面上多一行重复信息（牌面大字本来已经写着同一副牌）——我认为这个代价值得，因为验收判据是"机器读得出"。如果监督方裁定"不要这行、只要大字"，删掉 `revealedHandsLine` + `ui/20` + `ui3/24` + Y 族即可，其余不动。

## 7-D. 与既有自评冲突 / 已过期的条目

| 出处 | 现状 |
|---|---|
| rev=6 **M3-C 第 4 条**"座位沿椭圆环参数化（π/2 + i·2π/n），本人固定最下方" | **被本轮推翻**（见 7-C 第 3 条）。放大牌面后等角度环在 560 高里必然互相压住；改为分组落位 |
| rev=6 **M3-C 第 7 条**"首帧同步渲染" | 仍成立，且 `ui3/16`（不给动画入参直接终态）继续钉住"不会卡在翻一半" |
| rev=6 **M3-A**"牌面 21×28 / 字号 10 的三张牌位" | 失效。尺寸见 7-A ①；`ui3/11b`/`ui3/15` 的期望值从"牌面字符数"改成"点数图元数"（牌角两行后一张牌有两个图元） |
| rev=6 **M3-C 第 12 条**（`AiDecision.reason` 永不渲染） | 仍成立：本轮新增的 `resultText` 是**公开量**（赢家集合与筹码），不是 AI 的内部推理 |
| rev=6 **M3-B**"读写 zjh 之外目录：未读写" | 仍成立；`.scratch/` 是本轮新增的项目内取证暂存目录，交付前删除 |
| rev=6 **M3-D** 关于 Q1/Q2 措辞的清理 | 已完成，本轮无新增过期口径 |
| rev=5 **M-C 第 5 条**"AI 不发起比牌" | 已在 rev=6 推翻并实现，本轮未再触碰 |

## 7-E. 复现命令（rev=7）

```
cd F:/qoder/zjh
npm test                       # exit=0，末三行 RUNNER files=17 cases=242 / SUMMARY pass=242 fail=0 / RESULT=ALL_PASS
npm test > a.txt 2>&1; npm test > b.txt 2>&1
diff a.txt b.txt && sha256sum a.txt   # 期望与 TEST-OUTPUT 的 7.3 节同哈希
npx tsc --noEmit               # exit=0
npm run build:ui               # exit=0，vite v8.3.1
node webmin/serve.ts 8133      # 零依赖通道：http://127.0.0.1:8133/webui/index.html
                               # 验收（工单 §4 rev=7 ④）：把窗口拉到 720×640 或以上 → 选机器人 5 → 开新一桌
                               # → 真人点「看自己的牌」→ 一路跟注到强制开牌
                               # 期望：截图上每张亮牌的点数与花色肉眼可读；看牌前自己那行仍是「···」且无牌面
                               #      六家桌在 720×640 下不出现「窗口太小」（画布实测 714×582 ≥ 560×560）
```

---

# 附录：rev=6（M3 · 正式 UI + AI 主动比牌）自评原文

## M3-A. §4 M3 逐条

| §4 M3 要求 | 结论 | 证据 |
|---|---|---|
| Vite + Canvas | 过 | `vite.config.ts`（只做一件事：root 指 `webui/`）+ `webui/{index.html,main.ts}`；`npm run dev:ui`/`build:ui` 都实测通（M3.2 第 4/5 行）。**另有零依赖通道**：`webmin/serve.ts` 放行 `/webui/*`，不装 vite 也开得了 —— 复核命令 `node webmin/serve.ts 8133` → `/webui/index.html` |
| 只渲染 + 发意图，绝不自己判规则 | 过（两道机检 + 一道实测） | 层次拆成 `bridge`（模型→快照）/`scene`（快照→图元+命中区，纯函数）/`paint`（图元→ctx）/`main`（唯一 DOM+时钟入口）；`ui3/01` 钉 import 面，`ui3/02` 钉"三个纯层里既没有 DOM/时钟/随机，也没有 `legalActions(`/`checkAction(`/`classify(`/`actionCost(`/`presets.`/`startHand(`"；`ui3/14` 钉"灰按钮点了必被引擎拒"（UI 若要自己判规则，这条必红）；浏览器侧 `UI307 点击=3 被拒=0` |
| 拟物牌桌：椭圆绿呢桌面 + 环形座位 + 翻牌动画（用户 2026-09-25 指定） | 过（无头侧全绿；**观感终审待用户**） | 台面 = 两个嵌套椭圆（木轨 + 绿呢 + 台沿描边），座位板沿椭圆环按 `π/2 + i·2π/n` 均布（本人恒在最下方），每家三个牌位分 `cardBack`/`cardFace`；`ui3/15`（进度过半前 0 张牌面）、`ui3/16`（进度是入参、scene 仍纯函数、不给动画直接终态）、`ui3/17`（漏记 `since` 视为已翻开、换局重新起算）；像素证据 `evidence` [2] |
| vite 仅 devDependencies，`dependencies` 仍空，`npm test` 纯净不变，`package-lock` 不入清单 | 过 | `static/06`（deps 必空）、`static/07`（白名单含 vite，且显式断言 vite 不在 dependencies）、`static/08`（`npm test` 仍是单命令且不吃 node_modules）；变异 **U15** 把 vite 塞进 dependencies ⇒ 抓 |
| AI 主动比牌：资格 = 已看牌 且 分位 ≥ 0.75 且比牌合法 | 过 | `src/ai/honest.ts` 四道门串在一条 `if` 上；目标只能从**调用方给的合法 compare 目标**里挑，AI 没有造 target 的语法空间 |
| 约 15% 触发、禁 `Math.random`、回放确定 | 过 | `compareRoll(seq, seat)`（mulberry32 派生，‱ 制）；`ai/12` 实测 `trigger=14.6% over 1000 seqs`，`ai/14` 钉"同输入同结果 / 同 seq 换座位换结果"，`ai/10` 钉 `decideAi` 仍是纯函数 |
| 同局每家至多发起 1 次 | 过 | `alreadyCompared(view, seat)` 从 `view.log` 数本家已发起的 compare；`ai/13` 写一条已比牌日志 ⇒ 本局不再比；`m2/02` 在 1000 局上断言 `maxComparePerSeat ≤ 1` |
| 目标 = 活跃对手中 `committed` 最高者 | 过（并列语义自决并报备） | `ai/13`（投入最高者）+ `ai/13b`（**并列时取环形序上距庄家下家最近者**，故意把"座位号最大"做成错答案）；变异 C05（选最低）/C06（并列按座位号）都抓 |
| 原"AI 0 次比牌"断言 → 正向频率断言 | 过（按工单原话在同一用例内改写） | `ai/09` 改为"只出合法行动 + 闷着绝不加注也绝不比牌 + 比牌必是合法目标 + 频率上界"；`m2/02` 断言 `compare>0` 且 `有比牌的局<1000` |
| 变异覆盖新分支 | 过（其中 C06 先逃后抓） | C01–C09 + U16/U17；**C06 第一版逃过**（并列样本缺了 ⇒ 补 `ai/13b`），详见 M3.6 与本节末行 |
| 最小视口 560×560 维持不降；无头 `hitAt` 边界测试照留 | 过 | `MIN_VIEWPORT` 未动；`ui3/09b`（低于它只画提示、0 可点区、提示带当前尺寸）、`ui3/10`（中心 + 四角闭区间命中、外 1px 不命中）、`ui3/09c`（10 个候选时矮画布必须多分列） |
| M3 沿用同一套庄家配置 | 过（本轮补了页面接线钉） | `ui3/04`（三档开得出桌 + 状态行回显）、`ui3/04b`（`webui/index.html` 控件 ↔ `StartOptions` 一一对应，下拉值集合恰为 `DEALER_NEXT_IDS`/`presets` 键集）；变异 **U16**（下拉少一档）、**U17**（入口写死档位）只有 `ui3/04b` 能抓 |
| M0/M1/M1.5/M2 零回归 | 过 | `src/cards.ts`、`src/engine/{actions,project,settle,state,validate}.ts`、`src/rules.ts` 与 rev=5 **逐字节相同**；rev=5 的 206 例一条未删、一条未改期望地全绿（本轮新增 26 例） |

## M3-B. §5 禁止事项（M3 增量自查）

| 禁止项 | 自查 |
|---|---|
| 引擎/cards 内时钟/IO/全局可变态 | `src/**` 扫描面命中仍为 0（`static/01–05`）；M3 把同样的禁令**自动扩到 UI 侧**：`ui3/02` 对 `bridge/scene/paint` 禁 `Date`/`Math.random`/`performance.`/`requestAnimationFrame`/`node:`/DOM；时钟只在 `main.ts` 读一次并作为入参传进 `scene` |
| 规则分歧写成 if 分支而不是 `Rules` 配置 | UI 里没有任何规则分支：按钮文本/价格全来自 `buttonOptions()`（model 侧算好）；`TABLE_STYLE` 只是外观常量，不含判定。AI 的 `COMPARE_AT`/`COMPARE_TRIGGER` 是**策略参数**（写在哪档都不改口径），不是 §1 的规则分歧 |
| 写边池 / 全押 / 退款结算 | 未碰 |
| "下注轮结束"检测或全局"圈"状态 | 未引入。"本家这局比过牌没有"是从 `view.log` 回溯得到的按玩家量，没有新增任何全局轮边界 |
| 测试输出含时间戳或随机顺序；随机不固定种子 | 测试输出仍只有计数；双跑逐字节同哈希（M3.3）。M3 的"随机"只有两处：`deriveSeed` 沿用局号派生、比牌掷点由 `seq` 派生，两者都不吃时钟 |
| 交付后改 manifest 文件 | 变异与被测代码全程在 `.verify/` 副本；跑前跑后 `diff -rq` 证明交付树未被触碰；rev=6 的 manifest 按当前树重算（新增 8 个、改动 12 个），不在清单内：`node_modules/`、`webui/dist/`、`package-lock.json` |
| 读写 `zjh/` 之外目录 | 未读写项目外目录。探针脚本与运行输出草稿都落在项目内的 `.verify/`（随副本一起删除）；唯一例外是后台命令的 stdout 由工具链写到它自己的任务目录 |

## M3-C. 自行决定清单（M3，§0.8 允许自决、报备备查）

1. **四层拆分**：`bridge`（模型→结构化快照）/ `scene`（快照 + 视口 + 样式 + 动画进度 → 图元 + 命中区）/ `paint`（图元 → ctx）/ `main`（DOM + 时钟 + 事件）。理由：中间两层是纯函数，能在 Node 里把布局与可见性全部钉死；`paint` 薄到可以靠眼睛验收。代价：多两个文件。
2. **保留零依赖通道**：`webmin/serve.ts` 放行 `/webui/*` 并对 `.ts` 做类型剥离 ⇒ 不装 vite 也能开页面、也能用 `ui3/13` 无头验收。vite 是构建/开发体验，不是运行前提。
3. **`vite.config.ts` 只做最小一件事**（root 指 `webui/`，产物 `webui/dist/`）；`dist/` 与 `package-lock.json` 不入 manifest。
4. **座位沿椭圆环参数化**（`π/2 + i·2π/n`，本人固定最下方），而不是硬编码六宫位 —— 2–6 人一桌不用改布局代码；`n=1` 时退化保护由 `Math.max(1, count)` 兜住。
5. **翻牌进度当入参**：`flipProgress(anim, seat)` 由 `main` 把 `performance.now()` 传进去，`scene` 自己拿不到时钟 ⇒ 动画可无头断言（`ui3/15–17`）。**过半才画牌面**（不是"开始了就画"），否则动画前半程就把牌泄露了。
6. **没记 `since` 的座位视为已翻开**：宁可多亮一次，也不能因为漏记一次而把牌永久藏起来（`ui3/17`）。
7. **首帧同步渲染**，`requestAnimationFrame` 只在"有翻牌在飞"时排下一帧。理由：后台标签页不跑 rAF，M1.5/M2 的浏览器验收通道就是不可见表面 —— 若首帧挂在 rAF 上，页面会永远空白。
8. **灰按钮照样画、且带价格**（不只画合法项）：验收③"乱点不崩"要求点灰按钮必被引擎拒，画出来才点得到；`整桌重来` 恒为合法（`ui3/14b`）。
9. **`MIN_VIEWPORT = 560×560` 不降**（用户 2026-09-25 裁定：不为内嵌测试面板妥协设计）；手机竖屏适配将来单独立项。
10. **AI 比牌的三个数**：`COMPARE_AT = 0.75`（资格分位）、`COMPARE_TRIGGER = 150`（‱ 制，≈15%）、目标并列取环形序最近。前两个是策略口味，全部由测试钉住行为（`ai/09/12/13/13b`），改数只动常量。
11. **`AiDecision.reason` 只用于诊断，永不进快照**：`webmin/model.ts` 取 `d.kind`/`d.target` 后回合法集合里取一个，`reason` 不上屏、不入 `view.log`。理由：`reason` 里带 `strength=0.812` 这种**由真实手牌算出的量**，直接渲染等于把 AI 的推理泄露给玩家（哪怕只泄露"它看过牌"）。
12. **`m2/01` 的 NOTES 行加了一句限定**：随机臂那行 `compare=0` 容易被读成"随机臂从不比牌"，实际那两个计数器只统计 `decideAi` 的输出。同因把 `maxComparePerSeat ≤ 1` 收进 AI 臂分支（随机臂上它是空断言）。

## M3-D. 与既有自评冲突 / 已过期的条目

| 出处 | 现状 |
|---|---|
| rev=5 **M-C 第 5 条**"AI 不发起比牌：v1 刻意不启用" | **被本轮推翻并已实现**。工单 §4 M3（2026-09-25 追加）要求做，且改判成本正如当时预估：`decideAi` 加一支 + 放开两条断言。现 `ai/09`、`m2/02` 已翻成正向频率断言 |
| rev=5 **M-A 末行**"仍是占位级…`ai/09`、`m2/02` 断言 0 次" | 失效。该两例现在断言"比牌必合法 + 必非死分支"；"闷着绝不加注"仍在 |
| rev=5 **M-B 末行 / DELIVERY rev=5 notes**"引入新依赖：无" | 失效。本轮起 `vite@^8.3.1` 进 `devDependencies`（Q3 裁定 A）；`dependencies` 仍为 `{}`，`npm test` 仍不吃 `node_modules` |
| rev=5 **DELIVERY notes**"一个 open 口径问题：QUESTIONS.md Q2" | 已裁定 **A**（退回轮庄）。实现未变（本就是 A），本轮只把 `webmin/model.ts:553` 与 `dealer/05` 标题里的"Q2 待裁定"改成"已裁定 A"；顺带把 `test/engine-money.test.ts` 头注释里过期的"Q1 待裁定"改成"已裁定为读法 B" |
| rev=4 **R-A ①**（`project()` 的 `looked` 门）与 rev=3 的可见性口径 | 仍成立，且在 M3 多了一道渲染侧的钉：`ui3/11`（开局整棵图元树无牌面字符）、`ui3/11b`（看牌后正好 3 张且就是本人那手）、变异 U08（`seatCells` 谎报隐藏位）|
| rev=3 **§7 浏览器实测**的"DOM 文本即证据"路线 | 仍成立，但 M3 的观感验收多了 Canvas 一路：本轮仍**没拿到截图**（不可见表面），像素证据是 `getImageData` 调色板落点数（`evidence` [2]），真实观感归用户终审 |

## M3-E. 复现命令（M3）

```
cd F:/qoder/zjh
npm test                       # exit=0，末三行 RUNNER files=17 cases=232 / SUMMARY pass=232 fail=0 / RESULT=ALL_PASS
npm test > a.txt 2>&1; npm test > b.txt 2>&1
diff a.txt b.txt && sha256sum a.txt   # 期望与 TEST-OUTPUT M3.3 同哈希
npx tsc --noEmit               # exit=0
npm run build:ui               # exit=0，vite v8.3.1，✓ 17 modules transformed
npm run dev:ui                 # http://127.0.0.1:5173/（vite 通道）
node webmin/serve.ts 8133      # 零依赖通道：http://127.0.0.1:8133/webui/index.html
                               # 验收顺序：视口拉到 ≥720×640 → 选「赢家坐庄」→ 开新一桌 → 真人点「看自己的牌」
                               # 期望：看牌前自己那行是「牌 ···」；点看牌时三张牌逐张翻出；注级抬上去后机器人日志里出现「look … 闷→明」；
                               #      终局三家全亮；灰按钮点了只弹「被引擎拒绝」，状态不变
```

复审班终审要点（本轮无头侧已钉死、但真鼠标才算过的）：真实坐标点击命中区（含四角边界）、翻牌动画观感、绿呢/木轨配色。

---

# 附录：rev=5（M2 · AI + fuzz + 庄家三档）自评原文

## M-A. §4 M2 逐条

| §4 M2 要求 | 结论 | 证据 |
|---|---|---|
| 诚实 AI：牌力档位 + 池赔率 | 过 | `src/ai/honest.ts`；`ai/05` 强牌加注 / 中带跟 / 烂牌弃，`ai/06` 同一副牌随赔率翻转，`ai/07` 同一副牌随对手数翻转 |
| AI 决策只能用 `project()` 投影，不许再直读 `GameState.seats[].hand` | 过 | `decideAi(view, seat, legal)` 入参无 `GameState`；`View` 类型里压根没有 `hand` 字段；`static/13` 机检（10 条禁用形态 + `engine/state.ts` 只许 `import type`）。**变异 A11**（插一句 `void (me as …)?.hand`）只有 `static/13` 能抓 ⇒ 这条检查不是装饰 |
| 随机合法行动跑 1000 局（固定种子） | 过 | `m2/01`，2–6 人全跨；`FUZZ-random hands=1000 maxSteps=21` |
| 不变量：总筹码守恒 | 过 | 每一手途中 + 结算后双重断言（含 `pot ≡ Σcommitted` 这条额外不变量） |
| 不变量：无负筹码 | 过 | 逐步断言 `chips ≥ 0`，另加一条 `chips ≤ 全桌总额` |
| 不变量：无重复结算 | 过 | `settle` 后再 `settle` 两次，指纹与筹码逐位不变、结算日志恰 1 条（`fuzz/06` 同族断言在 1000 局上复跑） |
| 不变量：每局必在有限行动数内终止 | 过 | 硬上界 400 步逐步断言 + 收尾 `maxSteps ≤ 160`（实测随机臂 21 / AI 臂 18） |
| 不变量：非法行动必被 validate 拒（点名四类） | 过 | `m2/04` 把四类注到 300 局的每一步：`not_current_turn=3956`、`cannot_afford=1978`、`bad_target=2081`、`compare_forbidden_before_first_actions=2510`，每类都 > 0 且状态指纹不变 |
| 庄家三档 schema：`Rules.dealer.next`，默认 rotate，两 preset 同步补字段，未知 key 抛错不变 | 过 | `rules/18`（三档各自合法 + 默认 rotate）、`rules/19`（枚举外/缺字段/多余 key/大小写/非串一律抛）、`static/12`（导出名单同步） |
| `beginNextHand` 按档位选庄，平局归属与离桌顺延按 §1 庄家行 | 过 | 纯函数 `nextDealerOf`；`dealer/01–06` 手推座位号（含平局给拿到余数的赢家、输家离桌环形顺延、无在桌输家兜底）；`dealer/08–11` 会话层属性断言（赢家档庄家 ∈ 上局赢家、输家档 ∈ 上局非赢家、三档走出不同序列、跨局守恒） |
| webmin 开局面板加下拉 | 过 | `index.html` 三档 + `app.ts` 接线 + `__zjh.newSession({dealer})`；`ui/15` 断言下拉 value 集合恰为 `{rotate,winner,loser}`；`ui/12` 断言状态行回显档位；浏览器实测庄位逐局跟随赢家 |
| 仍是占位级、正式 AI 不提前做 M3 之后的事 | 过（边界自曝） | AI 不发起比牌（`ai/09`、`m2/02` 断言 0 次）、不做边池/全押/计时器 |
| 零新依赖、`npm test` 仍单命令 | 过 | 本轮零安装；`static/06–08` 仍绿；AI 与 fuzz 全用 node 内置 + 自有实现 |
| M0/M1 零回归 | 过 | `src/cards.ts`、`src/engine/{actions,settle,state,validate}.ts` 与 rev=4 **逐字节相同**；`src/rules.ts`/`project.ts` 的改动面由既有用例全绿背书（175→206 只增不删） |

## M-B. §5 禁止事项（M2 增量自查）

| 禁止项 | 自查 |
|---|---|
| 引擎/cards 内时钟/IO/全局可变态 | 扫描范围自动扩到 `src/ai/`（`allSrcFiles` 递归），`static/00` 显式点名该文件；`static/01–05` 命中仍为 0 |
| 规则分歧写成 if 分支而不是 Rules 配置 | AI 读的全是 `Rules` 字段：`handEval.tierOrder`（分位前缀和现算）、`handEval.a23`（顺子最低高点 3⇄4）、`stake.initial/max`、`ante`。没有一处按 preset 名字分支 |
| 写边池 / 全押 / 退款结算 | 未碰 |
| "下注轮结束"检测或全局"圈"状态 | 未引入。AI 的"池浅"判据用 `pot ≤ 4×ante` 与 `actionsAtStake === 0`（都是按玩家的量），没有任何全局轮边界 |
| 测试输出含时间戳或随机顺序；随机不固定种子 | fuzz 与标定全部固定种子；输出只有计数；双跑 sha256 相同（`728b59c0…`） |
| 交付后改 manifest 文件 | rev=5 写完即停；变异与被测代码全程在 `.verify/` 副本，跑完还原并 `diff -rq` 校验交付树未被触碰 |
| 读写 `zjh/` 之外目录 | 未读写。临时输出只落系统 `/tmp`（不属项目目录，且不进交付） |

## M-C. 自行决定清单（M2，§0.8 允许自决、报备备查）

1. **AI 的输入形状**：`decideAi(view, seat, legal)` —— 合法行动表由调用方从 `legalActions`+`actionCost` 折算传入。这样 AI 既拿不到 `GameState`，也不需要自己判合法性（避免第二个判定入口）。
2. **牌力 = 档间分位 × 档内位置**，档间分位由 22100 手穷举计数现算前缀和，档内位置用归一化加权键位（权重 1,½,¼）。全部常量都由测试反查。
3. **对手数折价用 `strength^对手数`** 这个独立性近似（保守）。它不是精确多对手胜率，但单调、可解释、可测（`ai/07`）。
4. **阈值三个常数** `CALL_MARGIN=0.05`、`RAISE_AT=0.9`、`BLIND_PRIOR=0.5`（后者有定义依据：随机手牌的期望分位恰为 0.5）。前两个是策略口味，由 `ai/05–07` 与变异 A05/A07 钉住行为。
5. **AI 不发起比牌**：v1 占位级 AI 刻意不启用比牌 —— 比牌花 2×注级买"淘汰一家"，在只有档位信息的模型上算不出正期望，与其拍一个系数不如不做。若监督方认为 M2 就该会用比牌，改判只需在 `decideAi` 加一支 + 放开 `ai/09`、`m2/02` 两条断言。
6. **转明条件加"早且池浅"一支**（M2.8 缺陷 3 的修法）。理由与代价都写在该节：不加会把 §1①② 变成不可达。
7. **选庄做成纯函数** `nextDealerOf(mode, prev, seated)`：`prev.seats` 用上一局的参局座位环、`seated` 用新一局仍在桌的集合，"距上局庄家下家最近"统一表达成 `ringAfter` 序上第一个命中。兜底那一支是 Q2 的待裁定项。
8. **`Session` 不加字段**：`dealerNext` 存在 `Session.rules.dealer.next` 里（本来就是 Rules 的字段），reset 直接回读 ⇒ 不用动 REVIEW.md 声明的冻结面 `Session/Intent/act` 形状。
9. **`beginNextHand` 不再裁名册**（缺陷 1 的修法）：破产者在牌桌上不再发牌（`state.seats` 里没有他），但保留在 `s.seats` 名册里，只在"整桌重来"时请回来。
10. **`m2/05` 的标定测试只在 12 个锚点上做全量对拍**（12×22100 次 `compare`），而不是 22100² —— 第一版我写成后者，跑不完。
11. **分位表只按 classic 计数，`a23off` 共用**：实测两 preset 的档间分位最大差 0.27pp（`AI02` 断言 < 2pp），不值得为它分两张表。

## M-D. 与既有自评冲突 / 已过期的条目

| 出处 | 现状 |
|---|---|
| rev=4 R-C-3"静态钉用符号顺序"（针对 `webmin/model.ts` 的 `chooseBotIntent`） | **搬走**。M2 起 `chooseBotIntent` 只负责"投影 + 合法表 → AI"，本身不许出现 `classify(`/`.hand`/`me.looked`（`ui/14` 已改成这三条 + 必须出现 `decideAi(`、`project(`）；looked 门的静态检查移到 `static/13`（作用在 `src/ai/honest.ts`） |
| rev=4 C-8 / R-A ④"闷着且注级最低 ⇒ 必 call；注级抬高 ⇒ 必先 look" | **占位策略已被 AI 取代**。不变量"未看牌决策与手牌无关"原样保留（`ui/10c`），但具体动作分布变了：闷着且注级最低现在**也可能先看牌**（池浅时买信息），`ai/08`/`ui/10b` 按新语义重写 |
| rev=4 R-D 最后一行"M2 换 AI 时要按工单走投影" | 本轮已做（`decideAi` 只吃 `View`）。该遗留清空 |
| rev=4 R-B"引入新依赖：无" | 仍成立 |
| rev=3 A 段"机器人只做占位策略，不提前做 M2" | 已按里程碑推进：占位策略本轮正式换成 M2 的 AI |
| rev=3 C-5"被拒后用 `stateHash` 复核状态没动" | 仍成立（`ui/04/07`、`m2/04` 同款断言） |

## M-E. 复现命令（M2）

```
cd F:/qoder/zjh
npm test                       # exit=0，末三行 RUNNER files=16 cases=206 / SUMMARY pass=206 fail=0 / RESULT=ALL_PASS
npm test > a.txt 2>&1; npm test > b.txt 2>&1
diff a.txt b.txt && sha256sum a.txt b.txt   # 期望同哈希 728b59c0e14b9084…
npx tsc --noEmit               # exit=0
node webmin/serve.ts 8125      # 打开 http://127.0.0.1:8125/ → 302 → /webmin/index.html
                               # 验收顺序：庄家规则选「赢家坐庄」→ 开新一桌 → 连打几局（真人一律跟注即可）
                               # 期望：状态行末显示"庄位规则 赢家坐庄"，且下一局庄家 = 上一局赢家
                               #      日志里出现「look … 闷→明」紧跟「fold/call …」，真人未点看牌前自己那行仍是「牌 ···」
```

---

# 附录：rev=4（M1.5 缺陷修正）自评原文

## R-A. §4 rev=4 修正项逐条（①–⑤）

| 条目 | 结论 | 证据 |
|---|---|---|
| ① `project()` 本人牌可见条件补 `looked`，`revealed` 照旧对所有人放行 | 过 | `src/engine/project.ts`：门为 `s.revealed \|\| (s.seat === viewer && s.looked)`；`project/12` 专门钉"revealed 优先于 looked"（含观战视角）；顺带删掉恒真的死变量 `own` |
| ② engine-project 与 webmin-model 测试同步更新 | 过 | `project/01/04/08/10` 转新口径；`ui/16/17` 转新口径。用例数 171→175，**没有删除任何用例** |
| ② **新增负向断言：未看牌时投影序列化后不得出现本人牌面** | 过 | `project/11`：整条 `JSON.stringify(project(...))` 搜本人牌面，命中即失败；同批跑**正向对照**（看牌后必须搜得到）与**跨视角对照**（0 号看牌 ⇒ 1 号/观战仍看不见）。会话层再钉一遍在 `ui/18`（`view()` 全树 + 渲染出的座位行） |
| ③ 变异测试覆盖新门 | 过 | V01–V12（含缺陷原形态 V01、门焊死 V03、与或写反 V04、可见性反向 V09）+ B01–B06 + W 面 17 条全量复跑 = 35 条，34 caught、W17 为已裁定等价变异、0 SKIPPED、0 CORRUPT；跑在 `.verify/` 副本，交付文件零接触（跑前跑后 `diff -rq` 全等） |
| ④ 机器人：未看牌 ⇒ 决策与手牌完全无关 | 过 | `chooseBotIntent` 重排为"先过 looked 门"：闷态且 `stake > 初始注级` 只出 `look`（转不了明就 fold，不闷着往里投钱）；闷态且注级还在最低只 `call`/`fold`；不 raise、不读手牌。看过牌才走原阈值；仍绝不主动比牌 |
| ④ `chooseBotIntent` 未看牌分支不得出现任何手牌引用 | 过 | 两道：行为级 `ui/10c`（只换手牌决策必须不变，附"已看牌时决策必须分化"的反向对照）+ 静态级 `ui/14`（`me.hand` 符号下标必须大于 looked 门）。B05 证明静态那道有牙——它把 `void classify(me.hand,…)` 塞在门之前，行为完全不变，只有 `ui/14` 抓到 |
| ④ `ui/10` / `ui/10b` 相应更新（原"绝不看牌"改为新策略） | 过 | `ui/10`：改判为"闷着时不按手牌行动 + 注级抬高必先转明 + 闷着禁 raise"，统计口径加 `look`；`ui/10b`：改名为"（已看牌）三条臂"并追加闷态对照（同一批强牌在闷态下必须走不出 raise/阈值） |
| ⑤ M1.5 其余验收项维持有效 | 过 | 175/175 全绿、`tsc` 干净、双跑同哈希；显示侧场景在**最终代码**下于 8128 端口整段复跑，座位行逐字一致、结算指纹同为 `7d11762b42862f29`（顺带跨进程复核回放确定性） |
| （UI 层无需改动） | 过，且确认工单这句成立 | `'···'` / `'未开牌'` 渲染分支 rev=3 就在，只是永不被走到；本轮一行 UI 代码都没改（只改了 `index.html` 两处可见文案） |

## R-B. §5 禁止事项（rev=4 增量自查）

| 禁止项 | 自查 |
|---|---|
| 引擎内时钟/IO/全局可变态 | `src/engine/project.ts` 仍是纯映射；`static/01–05` 命中数仍 0（扫描覆盖 7 个 src 文件不变） |
| 规则分歧写成 if 分支 | ④ 新增的 `stake > rules.stake.initial` 判断读的是 `Rules` 字段而非硬编码数字 2；preset 换 `a23off` 不影响它。它属"策略"不属"规则判定"（策略本来就是个 if 塔，工单 §4 明说固定阈值即可） |
| 引入新依赖 | 无。本轮零安装 |
| 交付后改 manifest 文件 | rev=4 写完即停；变异脚本与被测代码都留在 `.verify/` 副本里跑完即删，交付树跑前跑后 `diff -rq` 全等 |
| 提前做 M2 | 未做。工单 M2 行新加的"庄家三档"（`dealer: rotate\|winner\|loser`）**本轮一行没碰**，等 M2 开工 |

## R-C. 自行决定清单（rev=4，§0.8 允许自决、报备备查）

1. **闷态兜底方向选 fold 而非 call**：工单只规定"注级 ≥2 先 look"。若 `look` 意外不可用，我让它 `fold` 而不是闷着 call——转不了明就绝不往池里投看不见的钱。
2. **比较用 `stake > rules.stake.initial` 而不是字面 `>= 2`**：等价（两 preset 的 initial 都是 1），但把口径挂在规则上，不埋一个魔法数字。
3. **`ui/14` 的静态钉用"符号顺序"而不是 AST 解析**：零依赖下没法可靠地解析 TS 源码；`indexOf('me.hand') > indexOf('if (!me.looked)')` 粗但可执行，且被 B05 证明不是装饰。它抓不到的形态（比如把整段逻辑搬去另一个函数）由 `ui/10c` 的行为级断言兜。
4. **`ui/10c` 的手牌集合是手挑的 7 副**（豹子 A / 同花顺 / 同花 / 对子 / 顺子 / 极烂 / 极好）+ 注级 1/2/4/8 全交叉，覆盖策略里每一条臂的入口，而不是随机抽样。
5. **`project/08` 加了构造前提断言**：这条不是新增功能，是防"用例悄悄退化成空跑"——门收紧后 `own.cards` 变 `'unknown'`，原来的 `if` 分支不再执行，push 那句失效，用例就只剩个名字。现在前提不成立直接失败。
6. **`toHuman()` 夹具**（`stepBots` 一步到真人手里）替代此前各处手搓的推进序列，`ui/16/17/18` 共用。
7. **证据改用文本而非截图**：页面当时不可见（`visibilityState=hidden`），我没有强行把窗口切前台去凑一张 PNG（那会干扰你正在用的界面），改留 DOM 原文 + 可访问性快照 + 完整日志。rev=3 那张 PNG 原样保留在 manifest。

## R-D. 与 rev=3 自评冲突 / 已过期的条目（原文不回改，这里逐条标注）

| rev=3 原文 | 现状 |
|---|---|
| 文件头"证据在 TEST-OUTPUT.md（171 例…77 条变异…）" | 过期。rev=4 是 175 例 / 35 条变异（TEST-OUTPUT 第 0 节） |
| A 段"171 例 = M0 92 + M1 61 + M1.5 18" | 过期。rev=4 = M0 92 + M1 63 + M1.5 20 = 175（M1 61→63 是 rev=3 时点就已如此，见 TEST-OUTPUT 第 2 节；本轮再 +4） |
| A 段"机器人只做占位策略…`ui/10` 断言它绝不主动比牌、**不偷看牌**" | **被 ④ 推翻**。rev=3 的"不偷看牌"是假象：它从不点 `look`，却直接 `classify(me.hand)`——等于一直在看。现在闷态真不看（决策不读手牌），注级抬高时它会**合法地点** `look` 转明 |
| C-8"机器人占位策略：**闷着打**、绝不主动比牌；豹子/同花顺…加注；…" | 部分过期。阈值臂原样保留，但**只在已看牌后生效**；闷着时的行为见 R-A 的 ④ 行 |
| C-6 `tableTotal` / C-5 `act()` 绝不抛 / C-11 `__zjh` 钩子 | 仍然有效，未改 |
| D-1/D-3（依赖与二进制截图） | 已由 REVIEW.md rev=3 裁定：D-1 保留无需动作、D-3 接受。撤销请求撤回，不再需要表态 |
| D-5"W17 存活" | 已由 REVIEW.md 裁定为等价变异。rev=4 复跑仍存活，无新增盲区 |

## R-E. 复现命令（rev=4）

```
cd F:/qoder/zjh
npm test                       # exit=0，末三行 RUNNER files=13 cases=175 / SUMMARY pass=175 fail=0 / RESULT=ALL_PASS
npm test > a.txt 2>&1; npm test > b.txt 2>&1
diff a.txt b.txt && sha256sum a.txt b.txt   # 期望同哈希 7b243bb18d72d77a…
npx tsc --noEmit               # exit=0
node webmin/serve.ts 8126      # 打开 http://127.0.0.1:8126/ → 302 → /webmin/index.html
                               # 验收顺序：开新一桌 → 真人行应是「牌 ···」→ 点「看自己的牌」→ 闷变明并印出牌面
                               # 加注把注级抬到 2 → 日志应出现「look … 闷→明」紧跟「call … 出 4 @注级2｜seen×stake」
```

---

# 附录：rev=3（M1.5 首交付）自评原文

## A. §4 M1.5 范围与验收逐条

| 条目 | 结论 | 证据 |
|---|---|---|
| 零新依赖 | 过 | `package.json` 的 `dependencies` 仍是空对象；`webmin/serve.ts` 只用 `node:http/fs/promises/path/url/module`；`static/06/07/08` + `ui/14` 机检 |
| 用 `node:http` + `stripTypeScriptTypes()` 的本地静态服务（推荐路径，未降级） | 过 | `webmin/serve.ts`；实测 `GET /webmin/app.ts → 200 text/javascript`，`GET / → 302`；未走"UI 改写纯 JS"的降级方案 |
| UI 代码放 `webmin/`，不进 `src/` | 过 | `src/` 下无任何页面代码；`ui/14` 反向断言 `src/*` 里不出现 `webmin` 字样（不许反向依赖） |
| src/ 纯度与静态检查不降级 | 过 | `static/00` 仍断言扫描覆盖 7 个 src 文件；`static/01–05` 对 src 的时钟/IO/全局态/可擦除语法命中数仍为 0 |
| M1 全部测试保持全绿 | 过 | `RUNNER files=13 cases=171 pass=171 fail=0`（M0 面 92 + M1 面 61 + M1.5 面 18） |
| 1 真人 + 可选 1~5 机器人 | 过 | `ui/01`（3 家）、`ui/05`（4 家）、浏览器实测 3 家与 4 家两局；`createSession` 越界参数抛错（`ui/02`） |
| 底注/注级/池/各人筹码跨局台账 | 过 | `ui/01`（开局瞬间总额=人数×买入）、`ui/05/08/09`（跨局守恒）、`ui/12`（状态行含注级与池、座位行含已投入）；浏览器回读 768 / 1200 恒定 |
| 看牌 / 跟 / 加 / 弃 / 比 全部可用 | 过 | `ui/05/06/10/10b`；浏览器实测：看牌→"明"、加注→日志 `stake 1→2 出 4`、比牌→淘汰一家、弃牌、结算 |
| 结算面板明示各人牌型与胜负 | 过 | `ui/05/12/16`；浏览器回读的结算 6 行含"结束原因/各家牌面+牌型/赢 X 或没赢/指纹" |
| "再来一局"按钮 | 过 | `ui/08`（局号 +1、庄家轮转、总额守恒）；浏览器 handIndex 1→2、庄家"你"→"电脑1" |
| 信息全优先（闷/明、已投入、注级、池、滚动日志） | 过 | `ui/12` 逐字段正则断言；截图 `evidence/m15-page-after-settlement.png` |
| 机器人只做占位策略，不提前做 M2 | 过 | `chooseBotIntent` 是固定阈值（`ui/10b` 点测三条臂）；`ui/10` 断言它绝不主动比牌、不偷看牌 |
| 验收① `npm test` 仍单命令、零运行时依赖 | 过 | `scripts.test = "node test/run.ts"`；`static/08` 断言它是单命令且不含 `&&`；删掉 `node_modules/` 也能跑 |
| 验收② 浏览器真实打完一整局（含一次比牌、一次结算） | 过（本方已自证） | TEST-OUTPUT 第 7 节两局记录 + 截图；服务启动命令写在 DELIVERY notes，监督方可自行复跑 |
| 验收③ UI 拒绝脚本外非法行动且不崩 | 过 | 所有候选按钮**常显**（含非法，`data-legal=false`），点击走 `act()`→引擎拒绝；`ui/04/07` 断言"被拒 + 状态指纹不变"；浏览器 `rejections=1` 后按钮仍在、页面可继续操作 |

## B. §5 禁止事项（M1.5 增量自查）

| 禁止项 | 自查 |
|---|---|
| 引擎/cards 内用时钟/IO/全局可变态 | `static/01–05` 扫描范围仍是 src 全部 7 文件，命中 0；页面层另由 `ui/14` 管住（model 不碰 DOM/时钟/`Math.random`，app 不碰 `node:`） |
| 规则分歧写成 if 分支 | 页面层没有任何规则判定：按钮可用性取 `intentOptions`（引擎 `legalActions` 的投影），金额取 `actionCost`；`act()` 里刻意**去掉了**"没轮到你"的预判，避免第二处规则判定 |
| 引入新依赖 | 无 |
| 交付后改 manifest 文件 | rev 3 写完即停 |

## C. 自行决定清单（M1.5，§0.8 允许自决、报备备查）

1. **服务边界**：只监听 `127.0.0.1`；只放行 `webmin/` 与 `src/` 两个目录；拒绝目录列表、拒绝未知扩展名、剥掉 query；`/`、`/index.html`、`/webmin/` 一律 302 到 `/webmin/index.html`。
2. **类型剥离用 `mode:'strip'`**（不是 `transform`）：strip 只把类型替换成等长空白，**行列号不变**，浏览器控制台的报错位置能直接对上源码。
3. **页面分三层**：`webmin/model.ts`（纯逻辑，可被 Node 测试直接 import）/ `webmin/app.ts`（DOM 粘合）/ `index.html`。分层靠 `ui/14` 机检而不是靠约定。
4. **会话层意图** `nextHand` / `reset` 不经过引擎（它们不是牌局行动），其余意图一律 `toAction()` 后交给 `apply()`（内部先过 `checkAction`）。
5. **`act()` 绝不抛异常**：引擎抛的 `InvalidActionError` 在这里转成 `{ok:false,error}` + 页面提示；被拒后用 `stateHash` 复核状态确实没动（`ui/04/07`）。
6. **台账语义**：`ledger()` = 各座位口袋里的 chips；`tableTotal()` = Σchips + pot（守恒基准）。结算瞬间 pot=0，两者相等，跨局结转用后者。
7. **跨局种子** `deriveSeed(baseSeed, handIndex)` 是纯函数（不用时钟、不用 `Math.random`），所以"同一个 baseSeed 的连续 N 局"在任何机器上可复算 —— 复审想重放整段会话有得重放。
8. **机器人占位策略**：闷着打、绝不主动比牌；豹子/同花顺在能加注时加注；同花/对子跟；顺子在低注级跟；单张只在最低注级蹭一手，否则弃。
9. **破产处理**：结算后付不起底注的座位离桌；活跃家不足 `rules.players.min` 就收桌，只留"整桌重来"。
10. **非法按钮也照旧渲染**（灰虚线 + `data-legal=false`）：这样验收③的"脚本外非法行动"能被自动化真实触发，而不是被 `disabled` 挡在门外看不到。
11. **`window.__zjh` 只读钩子**（status/machine/seats/log/settlement/legalIntents/clickIntent/newSession）只为自动化与调试存在；页面自身逻辑不依赖它，删掉它页面照常工作。

## D. 偏差与需要知悉

1. **依赖问题**：`typescript` + `@types/node` 是在工单新增"任何新依赖安装一律须用户事先批准"**之前**装的（rev 2，已获裁定接受）。M1.5 没有装任何东西。要不要现在撤干净（删 `node_modules/`、`package-lock.json` 与 `devDependencies`，只留 `npx -y typescript tsc --noEmit` 的说明），等你和用户说一声即可。
2. **tsconfig 变了**：`lib` 增加 `"DOM"`、`include` 增加 `webmin/**/*.ts`，为的是让页面层也过严格类型检查；`strict` / `erasableSyntaxOnly` / `noUncheckedIndexedAccess` 等一律没降级。
3. **交付里多了一个二进制**：`evidence/m15-page-after-settlement.png`（整页截图，已列入 manifest）。不希望仓库里放二进制的话我删掉，改成只留文本回读记录。
4. **浏览器实测抓到两个真实缺陷**（都已修 + 有断言）：① `/` 就地返回 index.html 导致 `./app.ts` 被解析成 `/app.ts` 而 403，页面完全起不来；② 比牌按钮的目标取自下拉框、重渲染后会与合法目标脱节，点了得到 `bad_target`。记录在 TEST-OUTPUT 7.3。
5. **变异项 W17 存活**（去掉"项目根越界"检查后测试全绿）：原因是还有第二道目录白名单兜住，属纵深防御而非盲区；第二道本身由 `W14`（caught）与 `ui/13` 的 12 条拒绝断言覆盖。另补了两条反向断言，防止实现退化成"见 `..` 就拒"的假安全。

## E. 复现命令

```
cd F:/qoder/zjh
npm test                       # exit=0，末三行 RUNNER files=13 cases=171 / SUMMARY pass=171 fail=0 / RESULT=ALL_PASS
npm test > a.txt 2>&1          # 连跑两次
npm test > b.txt 2>&1
diff a.txt b.txt && sha256sum a.txt b.txt      # 期望无差异、同哈希
npx tsc --noEmit               # 需先 npm install（见 D-1）
node webmin/serve.ts 8125      # 然后浏览器打开 http://127.0.0.1:8125/  （302 → /webmin/index.html）
```

---

# 附录 B：M1 自评表（DELIVERY rev 2，已由 REVIEW.md 裁定 PASS，原文保留备查）

对应工单 §0.3 与 §0.8。结论口径：**过 / 不过 / 偏差**。
证据全在 `TEST-OUTPUT.md`（完整测试输出、双跑一致、60 条变异测试）。M0 的自评表保留在文末附录，原文未改。

## A. §4 M1 验收项 + REVIEW.md「开工提示」逐条对号

| 验收项 | 结论 | 证据 |
|---|---|---|
| 状态机：显式阶段枚举 | 过 | `core/08`（betting → awaitingSettle → settled，且取值封闭）、`illegal/10`（终局后拒绝一切下注行动） |
| actions | 过 | `money/02–05`、`illegal/06`（look 不消耗行动数、不推进游标）、`illegal/13`（timeout 与 fold 局面等价） |
| validate 是**唯一**合法行动裁定入口 | 过 | `apply()` 第一步就调 `checkAction`，无旁路；`illegal/01–13` 逐错误码；`illegal/12` 断言 `legalActions` 与 `checkAction` 判据**完全一致**（双向）；变异 E22（轮次检查失效）被抓 |
| 非法行动必拒清单 | 过 | 11 个错误码每个至少一例：`bad_seat`/`not_current_turn`/`seat_not_active`/`already_looked`/`stake_at_max`/`cannot_afford`/`bad_target`/`compare_forbidden_before_first_actions`/`phase_not_betting`/`nothing_to_settle`/`unknown_action`；另有 `fuzz/04` 大批量注入（每一次都断言状态指纹不变） |
| 幂等结算（stateSeq 重放不重复扣钱） | 过 | `illegal/11`（未终局不能 settle；已结算重放 5 次指纹不变）、`money/08`（连做 7 次筹码不变、日志不追加）、`fuzz/06`；变异 E15（去掉幂等守卫）、E16（结算不清池 → 重复入账）均被抓 |
| 投影视图 `project(state, seat)` | 过 | `project/01–10`；其中 `project/02` 是**整条序列化视图反查牌面字符串**的泄漏检查，`project/05` 钉住"未结算不泄露 seed（否则客户端可反算整副牌）"；变异 E26、E27 均被抓 |
| 回放确定性：同 seed + 同 action 脚本 → 同 state hash | 过 | `core/06`（旧状态深冻结后仍可推进 ⇒ 无原地写）、`core/07`、`core/10`、`scripts/09`（含"最后一步必须改变指纹"）、`fuzz/05`（20 局 + 行动序列重放）；变异 E03、E04（起手序/发牌轮转被改）被抓 |
| 按玩家"当前注级行动数"计数、加注清零 | 过 | `money/03`（加注后**所有**活跃家 actionsAtStake=0，且加注者自己 actionsTotal 仍 +1）、`scripts/04`（加注后必须在新注级重新数满 3 次）；变异 E10（不清零）、E07（弃牌不计行动数）被抓 |
| 无"圈"、无 `lastAggressor` | 过 | 源码里不存在轮边界状态；`static/01–05` 扫 src 全域；`illegal/09` 证明游标只按活跃座位前进（变异 E01「游标不跳过弃牌者」被抓，10 例失败） |
| 四类终止条件 | 过 | ①`scripts/01`（弃至通吃且不开牌）②`scripts/03` ③`scripts/04` ④`scripts/02`（比牌淘汰至一人）；`scripts/08` 断言三条 reason 各自可达；`fuzz/02` 用三种策略把三条路径都随机打到；变异 E12（②丢掉注级前提）、E13（③阈值写错）、E28（终局判定被跳过）被抓 |
| 首圈禁比 = "存在 actionsTotal=0 的活跃玩家" | 过 | `illegal/04`（三家人人各一次前禁、之后立即放开）、`money/04` 内先解除禁比再测费用；变异 E20（永久解禁）、E21（永不解禁）均被抓 |
| 全押禁用 ⇒ 无负筹码、只能弃牌 | 过 | `illegal/08`（钱不够时合法动作集合恰为 fold/timeout/look）、`money/09`、`fuzz/01/03`；变异 E23（钱不够仍可跟注）、E24（顶格仍可加注）被抓 |
| 平局分池 + 余数给"距庄家下家最近" | 过 | `money/07`（整除/余数/换庄家/三家全平 + 份额之和恒等池的穷举小表）、`scripts/05`（真实牌局 pot=13 两家打平 ⇒ 7/6，余数归 1 号）；变异 E17、E18 被抓 |
| 挑战者输（比牌平局） | 过 | `scripts/06`（平局时挑战者出局、被挑战方不花钱）、`scripts/02`；变异 E08（平局判成被挑战者输）被抓 |
| 剩两家比牌 = 直接开牌 | 过 | `scripts/07` + `project/04`（两家都亮、旁观者也看得见；第三种弃牌者仍藏）；变异 E09（不开牌）被抓 |
| 引擎确定性（种子注入、无时钟/IO/全局可变态） | 过 | `static/00–05` 的扫描范围已扩到 `src/engine/*`（`static/00` 断言扫描清单覆盖五个引擎文件）；`core/06/10` 证明无隐藏全局态 |
| M0 接口冻结、引擎复用不另起炉灶 | 过 | `static/12` 钉住 cards/rules 导出集合不变；M0 面 92 例全部仍绿；M0 文件唯一改动是 `src/cards.ts` 的注释措辞（按 REVIEW「非阻塞备注」修正"恒为 0"的不准确表述），不涉及行为 |

用例总数：`RUNNER files=12 cases=153`，`npm test` exit=0，连跑两次输出 sha256 相同。
按文件分布：M1 面 61（engine-core 13 / engine-illegal 13 / engine-money 10 / engine-project 10 / engine-scripts 9 / engine-fuzz 6），M0 面 92（含本轮为引擎扩员新增的 `static/00` 一条）。
`node --test test/engine-money.test.ts` 兼容道实测 10 pass / 0 fail。

## B. §5 禁止事项自查（M1 增量）

| 禁止项 | 自查 |
|---|---|
| 边池 / 全押 / 退款结算 | 无。`settle.ts` 只有"赢家通吃 + 平局分池"；`money/06` 显式断言弃牌者 committed 留在池里、不退款 |
| "下注轮结束"检测 / 任何全局"圈"状态 | 无。终止判定全部读玩家自身的 `actionsAtStake` / `actionsTotal` |
| 引擎内 `Math.random`、`Date.now`、IO、全局可变态 | `static/01–04` 机检 src 全域；引擎不 import 任何 `node:` 模块（`stateHash` 自己实现 FNV-1a，不用 crypto） |
| 规则分歧写成 if 分支 | 引擎读规则字段而非硬编码：`stake.max`、`termination.*`、`bet.*`、`compare.fee/firstCycleForbidden/tie`、`players.min/max` 全部来自 `Rules`；`compare/07–08` 证明改 `tierOrder` 会改结果 |
| 测试输出含时间戳/随机顺序 | 无（双跑同 sha256；`fuzz` 全部固定种子） |
| 交付后修改 manifest 文件 | 本轮 rev=2，写完 DELIVERY.md 后不再改动 |

## C. 自行决定清单（§0.8 允许自决，报备备查）

1. **引擎对外形态**：`startHand(config) / apply(state, action) / checkAction / legalActions / settle / project / stateHash`，state 是不可变值（每次返回新对象）。`Action` 用可判别联合，`settle` 也做成一个 action（这样"重放不重复扣钱"能用同一条 stateSeq 语义表达）。
2. **`stateHash`**：规范化 JSON（键排序）+ 两段不同 offset 的 FNV-1a 拼成 16 位十六进制。定位是**回放指纹**，不是安全摘要（M4 的 commit-reveal 另用 crypto，届时在引擎外做）。
3. **发牌顺序契约**：从庄家下家起、按环形座位序、每人连续取 3 张（`core/03` 用独立复算的洗牌结果钉死）。§2.7 只钉了洗牌算法，没钉"洗完怎么分发"，而 M4 跨端复算必须有这一条。
4. **`timeout` 语义**：§1 只说"预留为外部注入的普通 action"。v1 实现为等价弃牌（`illegal/13` 断言它与 fold 的局面完全一致，只有日志 note 不同）。M4 若要"托管自动跟注"，改动集中在 `apply` 的 timeout 分支。
5. **"加注后全员清零"含加注者本人**（§1 字面"全员"）。后果：加注者在新注级下也需再行动一次才计入 ②/③ 判定 —— `money/03` + `scripts/03` 把这个后果显式测出来了。
6. **开牌范围**：剩两家比牌 ⇒ 两家都亮；三家及以上的普通比牌 ⇒ 只淘汰、不亮牌；②③ 强制开牌 ⇒ 活跃家全亮、弃牌/被淘汰者永不亮牌。§1 分别在两行里写了"直接开牌定胜负"和"输者出局（牌不公开）"，这是我对两者边界的具体化。
7. **`awaitingSettle` 这个中间阶段**：终局已判定（赢家、份额都已算出，且公开）但筹码未入账，游标置 -1。目的是让"结算"成为一个可重放、可幂等的独立动作。
8. **投影暴露范围**：暴露 rules 全量与 `terminal`（winners/shares/remainderTo），未 settled 前不暴露 `seed`；`revealed` 位决定他人手牌是否可见；观战视角（viewer 不在座位表内）只看得到已亮的牌。
9. **术语归一**：§1 里"未弃牌未出局者"两个词，实现里统一成 `active: boolean` + `out: 'folded' | 'eliminated' | null`，避免双词一态。
10. **静态检查扩员**：把 `src/engine/*.ts` 纳入原有的时钟/IO/可擦除语法扫描，并新增 `static/00` 断言扫描清单本身不漏文件（防止以后新增文件被漏检）。

## D. 偏差与需要知悉

1. **提前做了 M2 的一部分**：`engine-fuzz.test.ts` 是随机合法行动的不变量骨架（守恒 / 非负 / 有限步终止 / 非法注入必拒）。M2 仍要做"诚实 AI（牌力档位 + 池赔率）"与 1000 局规模，本处不替代。
2. **Q1 口径按裁定落地**：加注 = 读法 B（付**新注级**的跟价），比牌 = 不叠加跟价。见 `money/03` 的独立数值锚点（闷加付 2、明家加注到 4 付 8）与变异 E29/E30/E31。
3. **M0 文件有一处非行为改动**：`src/cards.ts` 注释措辞（REVIEW「非阻塞备注」点名的"恒为 0"），改完 M0 的 91 例仍全绿。若裁定要求 M0 文件一个字节都不许动，回退即可。
4. **`static/06` 容忍 `dependencies` 字段被 npm 剪掉**（交付文本里仍是空对象）——理由写在测试注释里。
5. **变异测试脚本仍不随交付**（`.scratch/mutate.mjs`，会临时改写 src/）；全文结果在 `TEST-OUTPUT.md` 第 6 节。本轮新增了两条"存活史"记录：E06（比牌费不随注级）与 E12（②丢掉注级前提）**曾经逃掉**，分别补了 `money/04` 的多注级断言与 `core/13` 的"满 3 次仍留在局里"断言才被抓到。

## E. 复现命令

```
cd F:/qoder/zjh
npm test                       # exit=0，末两行 SUMMARY pass=153 fail=0 / RESULT=ALL_PASS
npm test > a.txt 2>&1          # 连跑两次
npm test > b.txt 2>&1
diff a.txt b.txt && sha256sum a.txt b.txt     # 期望无差异、同哈希
npx tsc --noEmit               # 需先 npm install（只为类型检查；见 D-4）
node --test test/engine-money.test.ts         # node:test 兼容道仍可用
```

---

# 附录 C：M0 自评表（DELIVERY rev 1，已由 REVIEW.md 裁定 PASS，原文保留备查）


对应工单 §0.3 与 §0.8。结论口径：**过 / 不过 / 偏差**。
证据都在 `TEST-OUTPUT.md`（完整测试输出 + 双跑一致 + 30 条变异测试），本文件只做逐条对号。

## A. §3 M0 验收清单逐条

| 条目 | 结论 | 证据（用例名前缀） |
|---|---|---|
| §3.1 API 严格按 §2.7 契约（签名/返回形状/异常/牌堆初序/洗牌语义） | 过 | `deck/01`（index = suit\*13+(rank-2) 逐位）、`deck/07`–`deck/13`（rng 与 shuffle 语义）、`edge/11`–`edge/16`（异常形状）、`rules/01`–`rules/17`（Rules 契约）、`static/12`（导出集合恰等于契约所列，不夹带私有实现的导出） |
| §3.2 穷举 C(52,3)=22100 手，分类计数 = 闭式期望 | 过 | `classify/classic 穷举 22100 手 = 闭式期望`、`classify/a23off …` |
| §3.3 六条独立闭式公式，单张禁残差法 | 过 | `test/fixtures.ts: expectedCounts()` 六类各自成式；`highCard = (C(13,3)−runs)·(4³−4)`，全文无"总数减其余"；`classify/闭式结构` 额外断言两类与 runs 无关、四类随 runs 移动的位移量 |
| §3.3 锚点表（硬编码第二道保险） | 过 | `classify/<preset> 穷举 22100 手 = 锚点表`（值逐字抄自工单）；`classify/NOTES` 把 实际/闭式/锚点 三行并排打进输出，便于肉眼复核 |
| §3.4 反对称 / 传递 / 排序无矛盾 / 相等判 0 | 过（加强） | 反对称 `compare/03` 覆盖 455²=207025 全对；传递 `compare/04` 是 **455³=94,196,375 三元组穷举**（预计算关系表后查表），非抽样；相等判 0 `compare/02`+`compare/05`；§3.4 原文要求"随机抽 1000 手排序后**相邻**比较"，`compare/09` 改成对排序结果做 **全部 i<j 对**校验（500k 对），并断言平局数 >1000（花色不参与的必然后果） |
| §3.5 正向陷阱牌 5 条 | 过 | `edge/01`–`edge/05` 一一对号，另有 `edge/06`–`edge/10`（绕 A 不成顺、A 在非顺子牌型取 14、归一化键长度等）与 `compare/10`（六档链 15 对全断言） |
| §3.5 负向：未知 rules key 抛错 | 过 | `rules/05`（special235=true）、`rules/06`（suitTiebreak=false，**值为 false 也抛**）、`rules/07`（嵌套未知 key） |
| §3.5 负向：非法手牌抛 TypeError | 过 | `edge/11`（长度 0/1/4）、`edge/12`（重复牌）、`edge/13`（rank 15/1/2.5/NaN、suit 4/-1/1.5）、`edge/14`（非数组/元素 null/缺字段）、`edge/15`（compare 两侧都查） |
| §3.6 cards 与 rules 零依赖、无 Math.random / 时间 / IO | 过（可机检） | `static/01`–`static/05` 扫源码：时钟类 API、文件与网络 API、全局可变对象、import 形态（只允许 `import type … from './rules.ts'`）、不可擦除语法，全部命中数 0 |
| §3.7 Node 24 原生 TS + 单命令 + 退出码真实 + 输出无时间戳/无随机序 | 过 | `npm test` = `node test/run.ts`，exit 0/1 真实反映断言（变异测试里 30 次 exit=1 即证明）；双跑 sha256 相同；`static/06`–`static/10` 把工程约束也做成断言 |

用例计数：`RUNNER files=6 cases=91`。源码里 `test(` 出现 85 次，差额来自 3 处按 preset 循环注册（`classify/*` 6 例、`rules/09` 等），不是漏跑。

## B. §5 禁止事项自查

| 禁止项 | 自查结论 |
|---|---|
| 写边池 / 全押 / 退款结算 | 无。M0 只做牌与规则结构，代码里不存在筹码概念 |
| "下注轮结束"检测（lastAggressor）或任何全局"圈"状态 | 无，同上 |
| 引擎/cards 用 `Math.random`、时间、IO、全局可变状态 | 无；`static/01`–`static/03` 机检 |
| 规则分歧写成 if 分支 | 无 if-分支型分歧：唯一被代码读取的规则值是 `handEval.a23` 与 `handEval.tierOrder`，两者都是数据驱动（`compare/07`/`compare/08` 证明改 `tierOrder` 会改结果） |
| M0 写 UI / 引运行时依赖 | 无 UI；`dependencies` 为空对象，`devDependencies` 只有 typescript + @types/node（白名单内） |
| 读写 zjh/ 之外目录 | 全部路径在 `F:\qoder\zjh\` 内；`npm ping`/`npm install` 是包管理器自身的缓存写入，见 E-4 |
| 测试输出含时间戳或随机顺序 | 无（双跑 sha256 相同即证据） |
| 为通过测试特判具体用例 | 无。反向证据：30 条变异全部被抓，且其中 2 条（M15/M18）是**先逃掉、再补断言**才被抓的，补的都是可从规范推导的性质断言，不是把实现输出抄回测试 |

## C. 自行决定清单（§0.8 允许自决、但必须报备的实现细节）

1. **`Rng` 取整数版 mulberry32**。§2.7 写 `type Rng = () => number`(uint32) 且 `j = rng() % (i+1)`；网络上常见的浮点版（末位除 2^32）会让 `rng() % (i+1)` 恒为 0、洗牌退化成逆序。取整数版即"常见版的分子"。`deck/19` 独立誊了浮点版做逐位对照，把结构与常数钉住。
2. **测试运行器自持**（`test/run.ts`），没有直接用 `node --test` 的内置 reporter。实测原因：内置 spec/dot 输出 `(1.234ms)` 与 `duration_ms`，两次运行必然 diff，违反 §0.5；自定义 `--test-reporter` 在默认进程隔离下拿不到子测试事件，且 `test:fail` 的 `data.error` 为空。同时保留 node:test 兼容道（`test/harness.ts` 检测 runner 标记）：`node --test test/deck.test.ts` 实测 19 pass，见 TEST-OUTPUT 第 2 节第 4 行。
3. **`TierId` 与 `TIER_IDS` 落在 `src/rules.ts`**，`cards.ts` 用 `import type` 引用（编译后不残留 import）。理由：`Rules.handEval.tierOrder` 需要它，schema 校验还需要它的运行时数组形态；这样 `cards.ts` 保持零运行时依赖。
4. **`validateRules` 返回深冻结的深拷贝**，不是输入对象本身。两个 preset 也走同一函数生成（所以"preset 能过校验"是被构造保证的，另有 `rules/01`/`rules/02` 显式复验）。`rules/14`/`rules/15`/`rules/16` 钉这个语义。
5. **两个 preset 按字面量各写一遍**，没有"只差一个开关"的工厂函数——避免规则分歧进代码（§5 第 4 条）。
6. **错误类型统一 `TypeError`**（rules 与 cards 一致）。§2.7 只对非法手牌点名 TypeError，对 rules 只说"抛错"。消息格式 `invalid rules at "<路径>": <原因>`，`rules/17` 钉住消息里点名违规 key。
7. **牌面字面量用 ASCII 双字符**（`AS`/`TC`/`2D`…，S=♠ H=♥ C=♣ D=♦）放在测试夹具里，测试名里保留花色字形便于与 §3.5 对号；`src/` 里不出现任何字面量解析（契约只有 `Card` 对象）。
8. **不变量测试的强度选择**：传递性用 455 个花色无关规范类做穷举（C(15,3)=455，`compare/01` 断言这个数量本身），而不是在 22100 手上做三元组（那是 1.08e13，不可行）。这是 v1"花色不参与胜负"的直接推论，若将来开花色 tiebreak 该归约失效（`compare/05` 会先炸）。
9. **`shuffle` 每次调用消耗 `n-1` 个随机数**（`deck/11` 钉死 =51）。这条对 M4 的跨端复算是契约的一部分，不只是实现细节。
10. **`makeDeck()` 每次返回全新数组与新对象**（`deck/03`），洗牌原地改并返回同一引用（`deck/08`）——两者语义不同是 §2.7 明文，测试分别钉住，防止将来"为了纯度"把 shuffle 改成拷贝而破坏回放一致性。

## D. 加严项（超出 §2.7 明文，但都不影响两个 preset 与已承诺的抽查口径）

| 加严 | 位置 | 若监督方认为过界，删除成本 |
|---|---|---|
| 已知 key 的**字面量值**也校验（`version:1`、`allIn:'forbidden'`、`compare.tie`、`showdown.tie`、`showdown.remainder`） | `rules/10`、`rules/11` | 低，删 3 个 case |
| `posInt` 要求整数且 ≥1 | `rules/09` | 低 |
| 跨字段不变量 `players.min ≤ max`、`stake.initial ≤ max` | `rules/04` 附近 | 低（**这是我最没把握的一条**，见 E-1） |
| `tierOrder` 必须是 6 档无重复排列 | `rules/12` | 中（删了会让缺档 tierOrder 静默误比） |
| `compare` 在 `tierOrder` 不含某档时抛错而非静默 | `compare/11` | 低 |
| `shuffle` 校验 rng 返回值必须是 uint32 整数 | `deck/12` | 低（防浮点版误用的唯一现场信号） |

ANSWERS 已承诺"正向抽查只用 classic / a23off 两个字面值，绝不喂未定义语义"，所以以上加严不会被正向抽查触发；负向抽查喂的是未知 key，行为与 §2.7 一致。

## E. 需要监督方表态或知悉的偏差

1. **E-1 跨字段不变量**（D 表第 3 行）是我加的，工单没有。若抽查打算喂 `players:{min:6,max:2}` 并**期望通过**，请回一句，我删掉。默认保留。
2. **E-2 测试运行器**：如果复审的"静态检查"硬性要求 `npm test` 里必须出现 `node --test`，请按 §3.7 的原文"优先用 Node 24 原生 TS"理解为"用 Node 原生 TS 执行"；我已同时保留 `node --test test/*.test.ts` 可跑通（C-2）。若仍要求单一入口是 `node --test`，需要同时改掉输出一致性的判据，这条冲突请裁决。
3. **E-3 `Hand` 类型名**：§2.7 把 `classify` 返回写成内联对象字面量，我给了个名字 `Hand` 并导出（`static/12` 的允许集含它）。不希望导出则删。
4. **E-4 目录里还有 `node_modules/` 与 `package-lock.json`**：工具链产物，**不在 manifest 内**，`npm test` 不依赖它们。留着是为了让 `npx tsc --noEmit` 可复跑。注意 `npm install` 会把 package.json 里空的 `"dependencies": {}` 剪掉，所以 `static/06` 写成"空对象或整体缺失都算通过"（交付文本目前是显式写着空对象的）。
5. **E-5 变异测试脚本 `.scratch/mutate.mjs` 未随交付提交**（它会临时改写 `src/`，怕复审误跑导致 manifest 对不上）。全文结果在 TEST-OUTPUT 第 6 节。需要脚本我可以补交一份带自还原校验的版本。

## F. 复现命令

```
cd F:/qoder/zjh
npm test                    # 期望 exit=0，末行 RESULT=ALL_PASS，SUMMARY pass=91 fail=0
npm test > a.txt 2>&1       # 连跑两次
npm test > b.txt 2>&1
sha256sum a.txt b.txt       # 期望两个哈希相同
npx tsc --noEmit            # 需要先 npm install（只为类型检查；会剪掉空 dependencies 字段，见 E-4）
node --test test/deck.test.ts   # 兼容道，期望 19 pass
```
