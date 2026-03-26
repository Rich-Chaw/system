---
title: 网络拆解系统绘图AI Prompts（流程/用例/架构/模块/时序）
version: v1.0
date: 2026-03-17
notes: "所有图要求中文标注；建议统一风格：学术论文插图、简洁扁平、蓝灰配色、线条清晰、16:9或A4比例。"
---

## 使用说明（给画图AI）

- 输出语言：**中文（简体）**。
- 字体风格：适配论文插图（可用思源黑体/苹方/微软雅黑风格）。
- 画布建议：架构图/流程图用16:9；用例图/模块图可用4:3；若要直接嵌入Word，优先A4横向。
- 视觉风格：扁平化、线条清晰、少阴影、少渐变；主色蓝灰，强调色橙/青用于高亮关键节点。
- 图中命名规范：系统名“网络拆解系统（NetworkDismantling）”；角色“普通用户”“超级管理员”；模块名与接口名与本文一致。

## 图1 训练功能流程图（从创建任务到完成/失败）

**Prompt：**
请绘制一张“训练功能流程图（Flowchart）”，中文标注，学术论文插图风格，16:9横向。流程从“普通用户”开始，包含以下步骤与分支：
1) 登录校验（未登录→跳转登录页；已登录→进入训练页）
2) 填写训练配置：训练图配置（图类型集合、min/max节点、课程学习开关、自适应开关）、PPO超参数（lr/batch/epochs/gamma/clip/entropy）、GNN配置（层数/隐藏维度/类型）、保存配置（实验名、保存间隔、仅保存最优）
3) 提交创建训练任务（写入SQLite：train_tasks、op_logs）
4) 任务进入队列 queued → 后台执行器拉取任务 → running
5) 训练循环（每个epoch）：计算指标→写入SQLite train_metrics；按间隔保存checkpoint→登记checkpoints；更新train_tasks.current_epoch
6) 用户操作分支：暂停（running→paused）、继续（paused→running）、停止（running/paused→stopped）
7) 结束分支：成功（succeeded）→登记模型资产models（trained）→可在模型管理页下载；失败（failed）→记录error_message与日志
8) 前端监控：训练页轮询获取状态/曲线/日志/检查点列表并渲染
要求：使用泳道或明确区分“前端页面”“后端API”“后台执行器”“SQLite/文件存储”四个责任域；在关键写库点旁标注表名（train_tasks/train_metrics/checkpoints/models/op_logs）。

## 图2 评估（拆解）功能流程图（单模型与多模型）

**Prompt：**
请绘制一张“评估（网络拆解）功能流程图”，中文标注，16:9横向，学术风格。流程从普通用户进入“模型评估页”开始，包含三种图数据来源：上传文件、手动边列表、预设图生成（BA/ER）。随后：
1) 图解析与校验（GraphProcessor）：统计节点/边、连通性、密度等
2) 选择模型：finder/mind/baseline（支持多模型对比）
3) 执行拆解：
   - 单模型：调用 /api/dismantle/execute → ModelManager → ModelExecutor → conda run 子进程 → 接口脚本 → 结果JSON
   - 多模型：对多个模型配置重复上述执行并汇总对比
4) 指标计算与可视化：LCC演化曲线、鲁棒性、移除序列、逐步拆解step-by-step
5) 导出：导出方案/JSON
6) 记录：写入dismantle_runs与op_logs（扩展设计）
要求：区分“前端”“后端API”“模型执行环境（conda）”“文件I/O（pkl/json）”；标注关键指标名称（robustness、LCC、removals）。

## 图3 系统角色与功能描述图（角色-功能矩阵信息图）

**Prompt：**
请绘制一张“系统角色与功能描述图（信息图/矩阵）”，中文标注，A4横向或16:9。左侧为角色：普通用户、超级管理员。顶部为功能模块：
1) 登录/注册/退出
2) 个人信息（邮箱/头像/改密）
3) 拆解评估（单模型/多模型/导出）
4) 训练任务（创建/暂停/续训/曲线）
5) 个人历史（拆解记录/训练记录）
6) 模型管理（列表/重命名/删除/下载）
7) 数据集管理（上传/复用/删除/下载）
8) 存储监控与清理
9) 训练任务监控（全用户）
10) 操作日志查看与CSV导出
用勾选或颜色区分每个角色拥有的功能；在图底部用小字说明权限规则：普通用户仅管理自有资源，管理员可全局管理并执行清理/导出。

## 图4 普通用户用例图（UML Use Case）

**Prompt：**
请绘制一张“普通用户用例图（UML）”，中文标注，4:3或A4纵向。系统边界命名为“网络拆解系统（NetworkDismantling）”，参与者为“普通用户”。用例包括：
- 注册
- 登录/退出
- 个人信息管理（包含：修改邮箱、修改头像、修改密码）
- 上传图/手动输入/生成预设图
- 选择模型并执行拆解评估
- 多模型对比评估
- 查看评估结果与可视化
- 导出拆解方案/导出结果JSON
- 创建训练任务
- 查看训练状态/曲线/日志
- 暂停训练/继续训练/停止训练
- 从检查点断点续训
- 查看个人拆解记录
- 查看个人训练记录
要求：用 include/extend 表达“个人信息管理”对三个子用例的包含关系；“评估结果查看”包含“可视化”；“断点续训”扩展于“训练任务”。

## 图5 超级管理员用例图（UML Use Case）

**Prompt：**
请绘制一张“超级管理员用例图（UML）”，中文标注，4:3或A4纵向。参与者为“超级管理员”。用例包括：
- 管理员登录/退出
- 用户管理（新增用户、禁用/启用、删除、重置密码可选）
- 查看系统统计（用户数、会话数、模型数、时间）
- 查看操作日志
- 导出操作日志CSV
- 全局训练任务监控（查看所有用户任务状态/详情）
- 强制停止训练任务/标记失败/清理产物
- 存储空间监控（磁盘/目录占用）
- 执行清理策略（临时文件/软删除回收/无引用提示）
- 模型管理（全局重命名/删除/下载）
- 数据集管理（全局管理）
要求：体现管理员是普通用户能力的扩展（可用泛化或备注说明）；对“执行清理策略”“导出CSV”标注“需审计记录”。

## 图6 系统三层架构图（表现层/业务层/数据层）

**Prompt：**
请绘制一张“系统架构图（分层架构）”，中文标注，16:9横向。分为三层：
1) 表现层：浏览器端页面（login/index/train/admin/profile/models/datasets/tasks），前端组件（GraphUpload、ModelSelection、Visualization、ProgressControl等），API Client，Auth模块
2) 业务层：Flask API（/api/…），Services（GraphProcessor、ModelManager、ModelExecutor、TrainingService、ModelAssetService、DatasetService、StorageService、LogService、AuthService）
3) 数据层：SQLite（users/op_logs/models/datasets/train_tasks/train_metrics/checkpoints/dismantle_runs），文件存储（模型文件、数据集文件、训练日志、checkpoint、临时pkl/json）
同时在架构图右侧单独画“模型执行环境层”：conda env（tf_py37、torch_py38）+ 子进程接口脚本（FINDER python_interface、MIND-ND python_interface、baseline_interface）。用箭头表示：业务层调用执行器→执行器通过conda子进程→返回结果→业务层→表现层。

## 图7 功能模块图（系统功能分解）

**Prompt：**
请绘制一张“功能模块图（分层/分域的模块分解图）”，中文标注，16:9横向。顶层为“网络拆解系统（NetworkDismantling）”，向下分解为：
- 用户与权限模块
- 图数据与数据集模块
- 拆解评估模块
- 训练任务模块
- 模型管理模块
- 管理与运维模块（任务监控、存储监控、日志导出）
每个模块下列出2-5个子功能点（用短语），并用虚线箭头标注主要依赖关系：训练任务→模型管理（登记产物）、评估模块→模型管理（选择/下载）、运维模块→所有模块（审计/监控）。

## 图8 时序图：拆解评估（单模型）

**Prompt：**
请绘制一张“时序图（Sequence Diagram）—拆解评估（单模型）”，中文标注，横向。参与者/生命线包括：
普通用户、浏览器前端（评估页）、API Client、Flask API、GraphProcessor、ModelManager、ModelExecutor、Conda子进程（接口脚本）、文件系统（临时pkl/json）。
时序：
1) 用户提交图数据与参数
2) 前端→API Client→Flask：POST /api/dismantle/execute
3) Flask→GraphProcessor：parse/validate/（必要时format转换）
4) Flask→ModelManager→ModelExecutor：execute_model
5) ModelExecutor→文件系统：写graph.pkl与result.json路径
6) ModelExecutor→Conda子进程：conda run -n <env> python interface --graph_file ... --out_file ...
7) 子进程→文件系统：写结果json
8) ModelExecutor读取结果→返回removals/robustness/lcc_sizes/time
9) Flask→前端返回JSON
10) 前端渲染曲线与可视化，提供导出
要求：用同步调用箭头；在关键步骤旁标注“5分钟超时”“文件清理”等细节（小字注释）。

## 图9 时序图：训练任务创建与监控（轮询）

**Prompt：**
请绘制一张“时序图—训练任务创建与监控（前端轮询）”，中文标注，横向。参与者：普通用户、浏览器前端（训练页）、Flask API、TrainingService、SQLite、后台训练执行器、文件系统（日志/ckpt）、模型管理服务。时序：
1) 前端POST创建任务→SQLite写train_tasks/op_logs，返回task_id
2) 后台执行器轮询SQLite获取queued任务→置为running并写started_at
3) 执行训练循环：每epoch写train_metrics、更新train_tasks.current_epoch；按间隔写checkpoint文件并登记checkpoints；追加写训练日志文件
4) 前端定时轮询：GET任务详情/metrics/checkpoints/logs→渲染曲线与状态
5) 任务结束：succeeded→登记models（trained）与指标摘要；failed→写error_message；同时写op_logs
要求：明确“轮询间隔”“写库点”“文件写入点”；图中用注释说明可替换为WebSocket推送。

## 图10 时序图：断点续训（基于checkpoint创建新任务）

**Prompt：**
请绘制一张“时序图—断点续训（创建新任务）”，中文标注。参与者：普通用户、前端（训练页/历史页）、Flask API、TrainingService、SQLite、后台执行器、文件系统。时序：
1) 用户在checkpoint列表选择某checkpoint
2) 前端POST /api/train/tasks/<id>/resume_from_checkpoint（包含checkpoint_id与可选override_params）
3) 后端校验权限与文件存在→SQLite创建新train_tasks（resume_from_checkpoint_id=...）并写op_logs
4) 后台执行器启动新任务，从checkpoint加载状态继续训练
5) 训练过程继续写train_metrics/checkpoints/logs
6) 完成后登记模型资产并在模型管理页可见
要求：在图中强调“续训任务与原任务的关系（父子/引用）”。

## 图11 时序图：模型下载与删除（含审计与软删除）

**Prompt：**
请绘制一张“时序图—模型下载与删除（含审计）”，中文标注。参与者：普通用户或管理员、前端（模型管理页）、Flask API、ModelAssetService、SQLite、文件系统。包含两个场景（可以在同一图中用alt分支表示）：\nA) 下载：前端GET下载→后端鉴权→读取models记录→send_file流式返回→写op_logs（action=下载模型）\nB) 删除：前端DELETE→后端鉴权（所有者或管理员）→SQLite更新deleted_at（软删除）→写op_logs（action=删除模型）→（可选）后台清理任务执行硬删除\n要求：体现“软删除优先”的设计；标注权限校验点与审计点。

## 图12 时序图：日志CSV导出

**Prompt：**
请绘制一张“时序图—操作日志CSV导出”，中文标注。参与者：超级管理员、前端（管理控制台）、Flask API、LogService、SQLite、CSV生成器/流式响应。时序：
1) 管理员在UI选择过滤条件（from/to/username/action/success）
2) 前端GET /api/admin/logs/export.csv?...
3) 后端鉴权→SQLite查询op_logs→边读边生成CSV并流式返回
4) 返回完成后，后端写op_logs记录“导出日志CSV”及过滤条件摘要与导出条数
要求：标注“UTF-8 BOM”“大数据量采用流式避免内存峰值”等工程点。

