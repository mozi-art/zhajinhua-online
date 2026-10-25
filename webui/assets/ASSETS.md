资源来源与许可
==============

felt-fabric.jpg
  来源: ambientCG — Fabric 034（https://ambientcg.com/view?id=Fabric034）
  文件: Fabric034_1K-JPG_Color.jpg（1K 颜色贴图，原样未改）
  许可: CC0 1.0 Universal（公共领域贡献，可商用、可再分发、无需署名）
  下载时间: 2026-10-24
  用途: webui 氛围层的织物纹理叠加（CSS background 多层合成 + blend-mode，
        运行时按主题重新着色，不改变贴图文件本身）。

为什么卡牌不用图片素材：
  牌面由 scene 以图元 + 文本绘制，test/webui.test.ts 的 ui3/11 / ui3/15
  通过扫描图元文本来钉住"未看牌绝不泄露牌面"——换成图片就拆掉了这条可证明的防线。
