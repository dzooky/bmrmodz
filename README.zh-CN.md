# BMRMODZ 中文说明

[English](README.md) · [原项目](https://github.com/dzooky/bmrmodz)

BMRMODZ 为 BMW MGU／iDrive 7 提供以下应用：

- **机油养护助手（Oil Service Assistant／OSA）**：监测发动机机油、冷却液和变速箱油温，估算升温或降温时间，将历史记录保存在车机本地。
- **DPF 状态**：只读监测柴油颗粒捕集器，显示碳烟、灰分、再生状态及里程，并读取受支持 B57 DDE 控制单元的详细数据。
- **Spritmonitor**：开发中的 Spritmonitor.de 第三方应用，通过车机记录燃油及 AdBlue 加注，支持账户配对和记录同步。

**简体中文汉化：小白151／小白科技杂物社（[JackieZ123430](https://github.com/JackieZ123430)）。** 应用原作者为 dzooky／BMRMODZ，运行库和构建工具来自 MGU App Kit。原作者署名和许可证保留，见 [LICENSE](LICENSE) 及 `kit/renderd/prebuilt/` 中的许可文件。

## 中文构建

现有的 `--language` 机制用于构建固定语言安装包。英文仍是默认语言；本次添加简体中文目录、中文构建专用字库及汉化署名。

只检查界面、无需 BMW SDK 的离线预览：

```sh
python kit/tools/build.py --language zh-CN --preview-only dpf osa spritmonitor
node kit/tools/test_zh_cn.js
```

`--preview-only` 生成的目录不能安装到车机。正式本地构建需要从自己的车机应用提取 SDK：

```sh
node kit/tools/extract_sdk.js /path/to/app.js
python kit/tools/build.py --language zh-CN dpf osa spritmonitor
```

车机商店构建按 `mgu-repo.json` 执行，并由车机提供 BMW SDK。默认商店构建仍为英文；如需发布中文构建，需要明确传入 `--language zh-CN`，不要只添加原仓库就假定下载的是中文版。生成的 SDK 必须留在本地，不随 PR 发布。

## 翻译与字库

`kit/runtime/locales/zh-CN.tsv` 和对应 JSON 保存显示译文，已有 MGU App Kit 中文内容沿用原译文。`kit/localization/credit.zh-CN.json` 保存汉化署名，仅中文构建读取。英文发布说明及原作者开发阶段提示保留原文。

新增汉字后，使用 Pillow 和指定版本的 Noto Sans SC 字体重新生成中文专用字库：

```sh
python kit/tools/bake_zh_cn.py /path/to/NotoSansSC.ttf
```

脚本校验字体 SHA-256，字体许可见 `kit/runtime/fonts/OFL-NotoSansSC.txt`。原始英文运行库字体不替换。中文包检查覆盖菜单词条、字形、英文回退和汉化署名。

本次验证限于电脑离线构建和自动化检查，未进行车机实测；原项目标记为开发中的功能仍处于开发阶段。

<!-- Localization provenance: XIAOBAI-ZHCN-20261116; translation by 小白151 / JackieZ123430. -->
