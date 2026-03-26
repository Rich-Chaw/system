---
title: 网络拆解系统附录
version: v1.0
date: 2026-03-17
---

## 附录A 术语与缩略语

- **LCC**：Largest Connected Component，最大连通分量
- **Robustness**：鲁棒性，通常指LCC随移除比例变化曲线的面积（归一化）
- **Checkpoint**：训练过程保存的中间模型状态，用于恢复训练
- **ModelAsset**：模型资产，统一表示“可执行/可下载/可管理”的模型文件或算法方法
- **Dataset**：数据集，包含图数据文件与可查询元信息

## 附录B 现有API端点清单（实现现状）

> 说明：以下清单来自后端 `system/server/app.py` 的实现，作为现状基线记录；扩展设计中的新增接口不在此表中。

### B.1 基础
- `GET /api/health`：健康检查 + 可用模型信息
- `GET /api/models`：FINDER模型列表（现状）
- `GET /api/models/all`：所有模型（finder/mind/baseline）
- `GET /api/system/stats`：系统统计（需登录）

### B.2 图相关
- `POST /api/upload_graph`：上传图文件并返回图信息与图数据
- `POST /api/generate_preset_graph`：生成预设图（BA/ER）

### B.3 拆解/评估
- `POST /api/dismantle`：拆解（旧接口）
- `POST /api/dismantle_multi`：多模型拆解（旧接口）
- `POST /api/dismantle/execute`：按模型类型执行拆解（finder/mind/baseline）
- `POST /api/evaluate`：对给定移除序列计算指标

### B.4 鉴权
- `POST /api/auth/login`：登录（返回token与角色）
- `POST /api/auth/register`：注册
- `POST /api/auth/logout`：退出
- `GET /api/auth/me`：返回当前用户信息

### B.5 管理
- `GET /api/admin/users`：用户列表（管理员）
- `POST /api/admin/users`：创建用户（管理员）
- `DELETE /api/admin/users/<uid>`：删除用户（管理员）
- `POST /api/admin/users/<uid>/toggle`：禁用/启用用户（管理员）
- `GET /api/admin/logs`：操作日志（管理员）

## 附录C 数据库设计（SQLite）—表结构建议（扩展设计）

> 说明：本附录给出“新增功能落地所需”的SQLite逻辑表结构建议（字段级）。类型遵循SQLite常用表示：`INTEGER/TEXT/REAL/BLOB`，时间统一使用`TEXT`存储ISO格式时间字符串（或`INTEGER`存epoch秒），由项目风格统一即可。

### C.1 `users`（用户表）
- `id` TEXT PRIMARY KEY
- `username` TEXT UNIQUE NOT NULL
- `password_hash` TEXT NOT NULL
- `role` TEXT NOT NULL  -- user/superadmin
- `email` TEXT
- `avatar_path` TEXT  -- 头像文件路径（相对或绝对需统一）
- `status` TEXT NOT NULL  -- active/disabled
- `created_at` TEXT NOT NULL
- `last_login_at` TEXT

### C.2 `op_logs`（操作日志）
- `id` TEXT PRIMARY KEY
- `time` TEXT NOT NULL
- `user_id` TEXT
- `username` TEXT  -- 冗余便于查询（可选）
- `action` TEXT NOT NULL
- `detail` TEXT
- `success` INTEGER NOT NULL DEFAULT 1
- `ip` TEXT
- `user_agent` TEXT
- `resource_type` TEXT  -- model/dataset/train_task/dismantle_run/user/...
- `resource_id` TEXT

索引建议：
- `INDEX idx_op_logs_time(time)`
- `INDEX idx_op_logs_username(username)`
- `INDEX idx_op_logs_action(action)`

### C.3 `datasets`（数据集）
- `id` TEXT PRIMARY KEY
- `owner_user_id` TEXT NOT NULL
- `name` TEXT NOT NULL
- `description` TEXT
- `format` TEXT NOT NULL  -- edgelist/json/gml/graphml/pkl
- `file_path` TEXT NOT NULL
- `file_size_bytes` INTEGER NOT NULL
- `sha256` TEXT
- `num_nodes` INTEGER
- `num_edges` INTEGER
- `created_at` TEXT NOT NULL
- `deleted_at` TEXT

### C.4 `models`（模型资产）
- `id` TEXT PRIMARY KEY
- `owner_user_id` TEXT  -- baseline/builtin可为空
- `model_type` TEXT NOT NULL  -- finder/mind/baseline/trained
- `display_name` TEXT NOT NULL
- `artifact_path` TEXT NOT NULL  -- 文件路径或方法名
- `source` TEXT NOT NULL  -- builtin/imported/trained
- `file_size_bytes` INTEGER  -- baseline可为空
- `metrics_summary_json` TEXT  -- JSON字符串
- `created_at` TEXT NOT NULL
- `deleted_at` TEXT

### C.5 `dismantle_runs`（拆解评估记录）
- `id` TEXT PRIMARY KEY
- `owner_user_id` TEXT NOT NULL
- `graph_source_type` TEXT NOT NULL  -- upload/preset/dataset/manual
- `graph_source_id` TEXT  -- 对应dataset_id或上传记录id（可扩展）
- `graph_snapshot_path` TEXT  -- 评估时的图快照（可选，便于复现）
- `model_id` TEXT
- `model_type` TEXT NOT NULL
- `params_json` TEXT  -- step_ratio/max_iterations/threshold/max_steps等
- `result_json_path` TEXT  -- 结果文件索引（可选）
- `robustness` REAL
- `removal_ratio` REAL
- `nodes_removed` INTEGER
- `execution_time_sec` REAL
- `created_at` TEXT NOT NULL

### C.6 `train_tasks`（训练任务）
- `id` TEXT PRIMARY KEY
- `owner_user_id` TEXT NOT NULL
- `exp_name` TEXT NOT NULL
- `status` TEXT NOT NULL  -- queued/running/paused/stopped/failed/succeeded
- `params_json` TEXT NOT NULL
- `resume_from_checkpoint_id` TEXT
- `current_epoch` INTEGER NOT NULL DEFAULT 0
- `total_epochs` INTEGER
- `best_metric_json` TEXT
- `log_path` TEXT
- `error_message` TEXT
- `started_at` TEXT
- `finished_at` TEXT
- `created_at` TEXT NOT NULL

索引建议：
- `INDEX idx_train_tasks_owner(owner_user_id)`
- `INDEX idx_train_tasks_status(status)`

### C.7 `train_metrics`（训练曲线点）
- `id` TEXT PRIMARY KEY
- `task_id` TEXT NOT NULL
- `epoch` INTEGER NOT NULL
- `reward` REAL
- `loss` REAL
- `lcc` REAL
- `created_at` TEXT NOT NULL

索引建议：
- `INDEX idx_train_metrics_task_epoch(task_id, epoch)`

### C.8 `checkpoints`（检查点）
- `id` TEXT PRIMARY KEY
- `task_id` TEXT NOT NULL
- `epoch` INTEGER NOT NULL
- `file_path` TEXT NOT NULL
- `file_size_bytes` INTEGER NOT NULL
- `is_best` INTEGER NOT NULL DEFAULT 0
- `metrics_snapshot_json` TEXT
- `created_at` TEXT NOT NULL
- `deleted_at` TEXT

## 附录D 操作日志CSV导出字段定义（扩展设计）

### D.1 CSV字段
- `time`：操作时间（`YYYY-MM-DD HH:mm:ss`或ISO8601）
- `username`：操作者用户名
- `action`：操作名称（如“登录”“创建用户”“删除模型”“导出日志”等）
- `detail`：操作详情（简要描述/参数摘要）
- `success`：是否成功（0/1）
- `ip`：来源IP（如后端采集）
- `user_agent`：浏览器UA（如后端采集）

### D.2 编码与兼容性建议
- 建议：`UTF-8 with BOM`，以保证Windows Excel直接打开不乱码。
- 建议：字段内若含换行/逗号应做CSV转义（双引号包裹，内部双引号转义为`""`）。

