/* ============================================================
 * data.js —— 数据层：Excel 读取 / 模板生成 / 导出 / 积分规则
 * 入党申请人信息表（核心表头，请勿改名）：
 *   姓名 | 性别 | 身份证号 | 联系电话 | 县（区）局 | 申请受理党组织
 *   | 申请书递交日期 | 当前阶段 | 岗位属性 | 思想态度 | 学习成效
 *   | 日常表现 | 履职担当 | 工作实绩
 *
 * 积分规则：每维满分 20 分，从 0 分开始累积；
 *          总分 = 五维之和（满分 100）；按总分排名择优。
 * ============================================================ */
(function (global) {
  "use strict";

  /* ---------- 5 个积分维度（每维满分 20 分） ---------- */
  var DIMENSIONS = [
    { key: "思想态度", name: "思想态度", max: 20 },
    { key: "学习成效", name: "学习成效", max: 20 },
    { key: "日常表现", name: "日常表现", max: 20 },
    { key: "履职担当", name: "履职担当", max: 20 },
    { key: "工作实绩", name: "工作实绩", max: 20 }
  ];
  var DIM_KEYS = DIMENSIONS.map(function (d) { return d.key; });

  /* ---------- 发展党员阶段 ---------- */
  var STAGES = ["申请入党", "入党积极分子", "发展对象", "预备党员"];

  /* ---------- 岗位属性 ---------- */
  var JOB_TYPES = ["综合岗", "专卖岗", "销售岗", "配送岗"];

  /* ---------- 工具 ---------- */
  function num(v) {
    if (v === null || v === undefined || v === "") return 0;
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }
  function str(v) { return (v === null || v === undefined) ? "" : String(v).trim(); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* 计算派生字段：总分 = 五维之和（无加权） */
  function enrich(p) {
    var total = 0;
    DIM_KEYS.forEach(function (k) {
      total += num(p.scores && p.scores[k]);
    });
    p.total = Math.round(total * 10) / 10;   // 总分（用于排序）
    return p;
  }

  /* 在 sheet 中定位表头行，返回对象数组 */
  function readSheet(ws, headers) {
    if (!ws) return [];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
    var headerRowIdx = 0, best = -1;
    for (var i = 0; i < Math.min(rows.length, 6); i++) {
      var cnt = 0;
      for (var j = 0; j < rows[i].length; j++) {
        if (headers.indexOf(String(rows[i][j] || "").trim()) >= 0) cnt++;
      }
      if (cnt > best) { best = cnt; headerRowIdx = i; }
    }
    if (best <= 0) return [];
    var hdr = rows[headerRowIdx].map(function (c) { return String(c || "").trim(); });
    var out = [];
    for (var r = headerRowIdx + 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || row.length === 0) continue;
      if (row.every(function (c) { return c === "" || c === undefined; })) continue;
      var obj = {};
      hdr.forEach(function (h, ci) { obj[h] = row[ci] !== undefined ? row[ci] : ""; });
      out.push(obj);
    }
    return out;
  }

  /* ---------- 解析整个工作簿 ---------- */
  function fromWorkbook(wb) {
    var messages = [];
    var sheetNames = wb.SheetNames;
    function get(name) {
      var hit = sheetNames.filter(function (s) { return s.indexOf(name) >= 0; })[0];
      return hit ? wb.Sheets[hit] : null;
    }
    var rows = readSheet(get("入党申请人信息"), ["姓名", "身份证号"]);
    var people = [];
    rows.forEach(function (r, idx) {
      var name = str(r["姓名"]);
      var idCard = str(r["身份证号"]);
      if (!name || !idCard) return;
      var p = {
        name: name,
        gender: str(r["性别"]) || "—",
        idCard: idCard,
        phone: str(r["联系电话"]) || "—",
        county: str(r["县（区）局"]) || "—",
        org: str(r["申请受理党组织"]) || "—",
        applyDate: str(r["申请书递交日期"]) || "—",
        stage: str(r["当前阶段"]) || "申请入党",
        jobType: str(r["岗位属性"]) || "综合岗",
        scores: {}
      };
      DIM_KEYS.forEach(function (k) { p.scores[k] = num(r[k]); });
      enrich(p);
      people.push(p);
    });

    if (!people.length) messages.push({ lv: "err", t: "未读取到【入党申请人信息】数据，请检查表头是否完整" });
    else messages.push({ lv: "ok", t: "入党申请人信息：读取 " + people.length + " 人" });
    return { data: { people: people }, messages: messages };
  }

  /* ---------- 演示数据 ---------- */
  function fromDemo() {
    var arr = clone(global.DEMO_PEOPLE || []);
    arr.forEach(enrich);
    return { data: { people: arr }, messages: [{ lv: "ok", t: "载入示例数据：" + arr.length + " 人" }] };
  }

  /* ---------- 生成导入模板（带示例行 + 说明） ---------- */
  function buildTemplateWorkbook(sample) {
    sample = sample || fromDemo().data.people;
    var wb = XLSX.utils.book_new();
    var HEAD = ["姓名", "性别", "身份证号", "联系电话", "县（区）局", "申请受理党组织",
      "申请书递交日期", "当前阶段", "岗位属性", "思想态度", "学习成效", "日常表现", "履职担当", "工作实绩"];
    var aoa = [HEAD];
    sample.slice(0, 5).forEach(function (p) {
      aoa.push([p.name, p.gender, p.idCard, p.phone, p.county, p.org, p.applyDate,
        p.stage, p.jobType, p.scores["思想态度"], p.scores["学习成效"], p.scores["日常表现"],
        p.scores["履职担当"], p.scores["工作实绩"]]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "入党申请人信息");

    // 填写说明
    var note = [
      ["发展党员人员画像 · 导入模板填写说明"],
      [""],
      ["1. 核心表为【入党申请人信息】，表头请勿改名，行顺序不限。"],
      ["2. 基本信息：姓名、性别、身份证号、联系电话、县（区）局、申请受理党组织、申请书递交日期。"],
      ["3. 当前阶段：申请入党 / 入党积极分子 / 发展对象 / 预备党员。"],
      ["4. 岗位属性：综合岗 / 专卖岗 / 销售岗 / 配送岗。"],
      ["5. 五维积分：思想态度、学习成效、日常表现、履职担当、工作实绩。"],
      ["   · 每个维度满分 20 分，从 0 分开始累积；总分 = 五维之和（满分 100）。"],
      ["6. 按总分排名择优发展，数据导入后自动计算总分并排序。"],
      ["7. 在数据页面右上角【数据导入】面板选择本文件即可载入。"]
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(note), "填写说明");
    return wb;
  }

  /* ---------- 由当前数据导出 Excel ---------- */
  function buildExportWorkbook(data) {
    var wb = XLSX.utils.book_new();
    var HEAD = ["姓名", "性别", "身份证号", "联系电话", "县（区）局", "申请受理党组织",
      "申请书递交日期", "当前阶段", "岗位属性", "思想态度", "学习成效", "日常表现", "履职担当", "工作实绩", "总分"];
    var aoa = [HEAD];
    data.people.forEach(function (p) {
      aoa.push([p.name, p.gender, p.idCard, p.phone, p.county, p.org, p.applyDate,
        p.stage, p.jobType, p.scores["思想态度"], p.scores["学习成效"], p.scores["日常表现"],
        p.scores["履职担当"], p.scores["工作实绩"], p.total]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "入党申请人信息");
    var note = [["发展党员人员画像 —— 当前数据导出（" + new Date().toLocaleString("zh-CN") + "）"]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(note), "说明");
    return wb;
  }

  function downloadWorkbook(wb, filename) { XLSX.writeFile(wb, filename); }

  function parseArrayBuffer(buf) {
    var wb = XLSX.read(buf, { type: "array", cellDates: true });
    return fromWorkbook(wb);
  }

  /* ---------- 积分制管理细则（来自「党员发展积分制管理.xlsx」） ---------- */
  var RULES = [
    {
      name: "思想态度", max: 20,
      standard: [
        "按时保质提交季度思想汇报，主动与培养联系人、支部书记开展谈心谈话；",
        "全程正常参加主题党日、集中学习，主动报名各类共建、志愿帮扶等服务活动；",
        '积极参与"四项专题教育"，树立正确政绩观，无"躺平""佛系"消极言行。'
      ],
      positive: [
        "主动参与社区共建、结对帮扶、文明志愿服务，每参与1次+1分（年度上限5分）；",
        "代表单位参加四项教育、主题宣讲、知识竞赛等，按层级加分：县级+1、市级+2、省级+3、国家级+5（分/次）；",
        "撰写信息稿件在市局网站发表每篇+1分；在省局及以上平台发表每篇+3分；",
        '获评"青年学习标兵"等思想建设类荣誉，县级+2、市级+4、省级及以上+6分。'
      ],
      negative: [
        "无故缺席党课、主题党日、志愿服务等，每次-2分；",
        "迟到、早退每次-1分；",
        "未按时提交季度思想汇报，每次-2分。"
      ],
      veto: [
        "查实存在违反党的六大纪律行为；",
        "无正当理由连续2次不参加组织活动；",
        '存在"躺平""佛系"消极表现且经教育提醒仍不改正。'
      ]
    },
    {
      name: "学习成效", max: 20,
      standard: [
        "按要求完成集中学习，年度理论测试成绩合格（≥60分）；",
        "无无故缺席支部集中学习记录；",
        "【提笔能写】每月至少撰写1篇工作简报/政务信息/学习心得（12篇/年）；每年至少完成1篇调研报告或专题文稿。"
      ],
      positive: [
        "考取中级专业技术/行业技能证书+3分；高级及以上+5分；三/四/五级职业资格分别+3/2/1分；",
        "入选市局人才库+3分、省局人才库+6分；",
        "受邀参与上级专项工作，市局级+2、省局级+4、国家局级+6（分/次）；",
        "【提笔能写】文稿被市局及以上采用，市级+2、省级+4、国家级+6（分/篇）；",
        "优秀公文评选获奖+2分/次；调研报告被评为优秀成果+3分/篇。"
      ],
      negative: [
        "无故缺席理论测试，-5分/次；",
        "【提笔能写】未按月完成写作任务，每缺1篇-1分；",
        "无故缺席支部集中学习，每次-2分。"
      ],
      veto: [
        "年度理论测试成绩不合格（<60分）；",
        "调研报告存在抄袭、数据造假。"
      ]
    },
    {
      name: "日常表现", max: 20,
      standard: [
        "严格遵守单位各项规章制度，无违规违纪记录；",
        '半年党员群众民主测评"良好"以上（≥80分）；',
        '【开口能讲】每年至少完成2次"青年讲堂"或"微宣讲"上台宣讲；定期参与市场走访、驻店体验等基层沟通。'
      ],
      positive: [
        '落实青年理论学习小组、"师带徒"等制度，年度培育成效突出+3分；',
        "【开口能讲】市级及以上宣讲/演讲/答辩竞赛获奖，市级+3、省级+5、国家级+8（分/次）；",
        "主动承担重要会议、大型活动主持或讲解任务+2分/次；",
        '宣讲内容被上级认可推广+4分/次；民主测评"优秀"（≥90分）+2分。'
      ],
      negative: [
        "工作被日常/专项督查通报批评，每次-3分；",
        "【开口能讲】未完成年度宣讲次数，每缺1次-3分；",
        "在基层走访、宣讲中态度敷衍、造成不良影响，-3分/次。"
      ],
      veto: [
        "收到有效投诉、信访举报且核查属实；",
        '民主测评"较差"（<60分）。'
      ]
    },
    {
      name: "履职担当", max: 20,
      standard: [
        "保质保量完成常规岗位本职工作；",
        "主动承接支部、部门交办的临时工作任务，无推诿记录；",
        "【问策能对】每月参加青年理论学习小组政策学习（12次/年）；每年列席党组会/局长经理办公会不少于2次；",
        "【遇事能办】每年参与至少1项重点攻坚行动或专项工作。"
      ],
      positive: [
        "主动投身业务攻坚、打假打私、应急处置等急难任务，表现突出+3分/次（年度上限9分）；",
        "在跟班学习、挂职锻炼、技能竞赛中表现优异+2分/次；",
        "参与复盘总结并提出有效改进措施被采纳+2分/次；",
        "【问策能对】调研报告获市局及以上优秀成果奖+3分/篇；合理化建议被采纳+3分/项；参与上级政策研讨/制度起草，市局级+2、省局级+4（分/次）；",
        "【遇事能办】课题研究、技能竞赛获奖，市级+3、省级+5、国家级+8分。"
      ],
      negative: [
        "上级交办工作推进拖沓、敷衍应付，每次-3分；",
        "工作失误造成不良影响或一般损失，视情节-3至-10分；",
        "【问策能对】未按时参加政策学习每次-1分；调研报告质量差经提醒未改-3分/次；",
        "【遇事能办】未参与任何攻坚行动或专项工作-5分。"
      ],
      veto: [
        "无正当理由拒不承担组织交办任务；",
        "履职过程中因严重失职造成重大损失或恶劣影响。"
      ]
    },
    {
      name: "工作实绩", max: 20,
      standard: [
        "圆满完成年度岗位重点业务指标（完成率≥100%）；",
        "立足岗位主动思考，提出优化建议并付诸实践。"
      ],
      positive: [
        "获党建或综合表彰，县级+3、市级+5、省级+8、国家级+12分；参与急难攻坚获专项通报表扬+5分/次；",
        '牵头QC课题、"五小"创新、党建研究项目获奖，市局级+5、省局级+8（分/项）；',
        "在《东方烟草报》《河南烟草》、省烟草学会等平台刊发论文/宣传稿件，每篇+5分；",
        "个人工作经验、特色做法被上级总结推广+6分/次；",
        "结合岗位形成高质量调研报告、流程优化方案被采纳落地，每项+4分；",
        "年度业务指标超额完成（>100%），每超10个百分点+1分（上限5分）。"
      ],
      negative: [
        "未主动落实岗位提质增效相关工作，-3分。"
      ],
      veto: [
        "年度核心业务指标未完成（完成率<100%）；",
        "存在严重弄虚作假行为。"
      ]
    }
  ];

  global.DataLib = {
    DIMENSIONS: DIMENSIONS, DIM_KEYS: DIM_KEYS, STAGES: STAGES,
    JOB_TYPES: JOB_TYPES, RULES: RULES,
    enrich: enrich,
    fromWorkbook: fromWorkbook, fromDemo: fromDemo,
    parseArrayBuffer: parseArrayBuffer,
    buildTemplateWorkbook: buildTemplateWorkbook,
    buildExportWorkbook: buildExportWorkbook,
    downloadWorkbook: downloadWorkbook
  };
})(window);
