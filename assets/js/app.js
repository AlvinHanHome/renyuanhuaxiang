/* ============================================================
 * app.js —— 发展党员人员画像系统 主逻辑
 * 视图：人员总览 / 人员画像 / 积分排名 / 积分规则 / 数据管理
 *
 * 积分规则：每维满分20分，总分=五维之和，按总分排名择优。
 * ============================================================ */
(function () {
  "use strict";
  var D = window.DataLib;
  var DIM = D.DIM_KEYS;            // 五维度 key
  var STAGES = D.STAGES;
  var JOB = D.JOB_TYPES;

  /* 全局状态 */
  var STATE = {
    people: [],                   // 已 enrich 的人员
    source: "demo",               // demo | imported
    selected: [],                 // 选中的人员 id（最多 2 个）
    route: "overview",
    search: "",
    fCounty: "",
    fStage: "",
    rkSort: "total"               // total | 思想态度...
  };
  var CHARTS = [];                // 当前已创建的 echarts 实例

  /* ---------- 小工具 ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(n) { n = Number(n); return isFinite(n) ? Math.round(n * 10) / 10 : 0; }
  /* 县区全称 → 简称（仅用于图表标签，表格仍显示全称） */
  function countyShort(name) {
    return name.replace(/^周口市/, "").replace(/烟草专卖局\(分公司\)$/, "").replace(/烟草公司卷烟物流配送中心$/, "配送中心");
  }

  var toastTimer;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  function getPerson(id) {
    for (var i = 0; i < STATE.people.length; i++) if (STATE.people[i].id === id) return STATE.people[i];
    return null;
  }

  function setData(result, source) {
    STATE.people = result.data.people.map(function (p, i) { p.id = i; return p; });
    STATE.source = source;
    STATE.selected = [];
    STATE.search = ""; STATE.fCounty = ""; STATE.fStage = "";
    var badge = $("#dataSourceBadge");
    badge.textContent = source === "imported" ? "已导入数据" : "示例数据";
    badge.className = "source-badge " + (source === "imported" ? "live" : "demo");
  }

  /* ---------- 图表通用 ---------- */
  function clearCharts() { CHARTS.forEach(function (c) { try { c.dispose(); } catch (e) {} }); CHARTS = []; }
  function makeChart(id, option) {
    var dom = document.getElementById(id);
    if (!dom) return null;
    var ex = echarts.getInstanceByDom(dom);
    if (ex) ex.dispose();
    var c = echarts.init(dom, null, { renderer: "canvas" });
    c.setOption(option); CHARTS.push(c);
    return c;
  }
  function baseGrid() { return { left: 8, right: 18, top: 40, bottom: 8, containLabel: true }; }
  function axisStyle() {
    return {
      axisLine: { lineStyle: { color: "rgba(255,209,102,.35)" } },
      axisLabel: { color: "#F2D2A6", fontSize: 11 },
      splitLine: { lineStyle: { color: "rgba(255,255,255,.06)" } }
    };
  }
  var C1 = "#FF5A3C", C2 = "#FFD166", C3 = "#FF9F45", C4 = "#E0231C", C5 = "#F2B33D";
  var PIE = [C1, C2, C3, C4, C5, "#E0A23C", "#FFB23E", "#FF7A35"];

  /* 各维度最大值（雷达轴固定 20） */
  var DIM_MAX = 20;

  /* ========== 通用 label 样式：柱状图/折线图顶部显示数值 ========== */
  var BAR_LABEL = {
    show: true, position: "top", color: "#FFF7EC", fontSize: 11, fontWeight: 700,
    formatter: "{c}", textShadowColor: "rgba(0,0,0,.6)", textShadowBlur: 3
  };

  /* ---------- 雷达图（1 人或 2 人对比） ---------- */
  function radarOption(persons) {
    var indicator = DIM.map(function (k) { return { name: k, max: DIM_MAX }; });
    var colors = [C1, C2];
    var seriesData = persons.map(function (p, i) {
      return {
        value: DIM.map(function (k) { return p.scores[k] || 0; }),
        name: p.name,
        symbolSize: 5,
        lineStyle: { width: 2.5, color: colors[i] },
        itemStyle: { color: colors[i] },
        areaStyle: { color: colors[i], opacity: persons.length > 1 ? 0.12 : 0.28 },
        label: { show: true, formatter: "{c}", color: colors[i], fontSize: 11, fontWeight: 700 }
      };
    });
    return {
      animation: true, animationDuration: 1400, animationEasing: "elasticOut", animationDelay: 300,
      tooltip: {
        trigger: "item",
        formatter: function (params) {
          var d = params.data;
          var lines = ["<b>" + d.name + "</b>"];
          DIM.forEach(function (k, i) { lines.push(k + "：<b>" + d.value[i] + "</b> / " + DIM_MAX); });
          lines.push("<span style='color:#FFD166'>总分：" + d.value.reduce(function (a, b) { return a + b; }, 0) + "</span>");
          return lines.join("<br/>");
        }
      },
      legend: persons.length > 1 ? { data: persons.map(function (p) { return p.name; }),
        textStyle: { color: "#FFF7EC" }, top: 0, itemWidth: 14, itemHeight: 8 } : { show: false },
      radar: {
        indicator: indicator, center: persons.length > 1 ? ["50%", "56%"] : ["50%", "52%"], radius: "66%",
        axisName: { color: "#FFE7A8", fontSize: 12, fontWeight: 600 },
        splitLine: { lineStyle: { color: "rgba(255,209,102,.22)" } },
        splitArea: { areaStyle: { color: ["rgba(255,90,60,.04)", "rgba(255,209,102,.05)"] } },
        axisLine: { lineStyle: { color: "rgba(255,209,102,.25)" } }
      },
      series: [{ type: "radar", data: seriesData }]
    };
  }

  /* 维度对比分组柱状（2 人）——带数据标签 */
  function dimBarOption(a, b) {
    return {
      animation: true, animationDuration: 1000, animationEasing: "cubicOut", animationDelay: 400,
      tooltip: { trigger: "axis" },
      legend: { data: [a.name, b.name], textStyle: { color: "#FFF7EC" }, top: 0, itemWidth: 14, itemHeight: 8 },
      grid: baseGrid(),
      xAxis: { type: "category", data: DIM, axisLine: { lineStyle: { color: "rgba(255,209,102,.35)" } },
        axisLabel: { color: "#F2D2A6", fontSize: 11, interval: 0 } },
      yAxis: Object.assign({ type: "value", max: DIM_MAX }, axisStyle()),
      series: [
        { name: a.name, type: "bar", data: DIM.map(function (k) { return a.scores[k] || 0; }),
          itemStyle: { color: C1, borderRadius: [4, 4, 0, 0] }, barWidth: "28%", label: BAR_LABEL },
        { name: b.name, type: "bar", data: DIM.map(function (k) { return b.scores[k] || 0; }),
          itemStyle: { color: C2, borderRadius: [4, 4, 0, 0] }, barWidth: "28%", label: BAR_LABEL }
      ]
    };
  }

  /* ---------- 视图：人员总览 ---------- */
  function renderOverview() {
    var ps = STATE.people;
    var total = ps.length;
    var active = ps.filter(function (p) { return p.stage !== "申请入党"; }).length;
    var avgT = total ? num(ps.reduce(function (a, p) { return a + p.total; }, 0) / total) : 0;
    var maxT = total ? Math.max.apply(null, ps.map(function (p) { return p.total; })) : 0;
    var counties = {}; ps.forEach(function (p) { counties[p.county] = 1; });
    var countyN = Object.keys(counties).length;

    // 各阶段
    var stageCnt = {}; STAGES.forEach(function (s) { stageCnt[s] = 0; });
    ps.forEach(function (p) { stageCnt[p.stage] = (stageCnt[p.stage] || 0) + 1; });
    // 各县区
    var countyCnt = {}; ps.forEach(function (p) { countyCnt[p.county] = (countyCnt[p.county] || 0) + 1; });
    var countyArr = Object.keys(countyCnt).map(function (k) { return { name: k, v: countyCnt[k] }; })
      .sort(function (a, b) { return b.v - a.v; });
    // 五维平均
    var dimAvg = DIM.map(function (k) {
      return num(ps.reduce(function (a, p) { return a + (p.scores[k] || 0); }, 0) / (total || 1));
    });
    // 岗位分布
    var jobCnt = {}; JOB.forEach(function (j) { jobCnt[j] = 0; });
    ps.forEach(function (p) { jobCnt[p.jobType] = (jobCnt[p.jobType] || 0) + 1; });

    var html = '' +
      '<div class="view-title"><span class="bar"></span><h1>人员总览</h1>' +
      '<span class="hint">全市系统入党申请人培养与积分全景</span></div>' +
      '<div class="grid kpi-row">' +
      kpi("申请人总数", total, "人", "覆盖 " + countyN + " 个单位") +
      kpi("已进入培养考察", active, "人", "积极分子及以上阶段") +
      kpi("平均总分", avgT, "分", "满分 100 分") +
      kpi("总分最高", maxT, "分", "标杆对象") +
      kpi("单位覆盖率", countyN, "个", "全市系统内部") +
      kpi("岗位类别", JOB.length, "类", JOB.join("/")) +
      '</div>' +
      '<div class="grid cols-2" style="margin-top:16px">' +
      panel("各阶段人数分布", '<div id="cStage" class="chart h320"></div>', "基于当前阶段") +
      panel("各单位申请人数量", '<div id="cCounty" class="chart h320"></div>', "单位：人") +
      '</div>' +
      '<div class="grid cols-2" style="margin-top:16px">' +
      panel("五维平均得分", '<div id="cDimAvg" class="chart h320"></div>', "全员平均，每维满分20") +
      panel("岗位属性分布", '<div id="cJob" class="chart h320"></div>', "按岗位分类统计") +
      '</div>';
    $("#view").innerHTML = html;

    // 饼图 — 各阶段（带数值标签 + 入场动画）
    makeChart("cStage", {
      animation: true, animationDuration: 1000, animationEasing: "cubicOut",
      tooltip: { trigger: "item", formatter: "{b}: {c}人 ({d}%)" },
      legend: { bottom: 0, textStyle: { color: "#FFF7EC" }, itemWidth: 12, itemHeight: 8 },
      series: [{
        type: "pie", radius: ["42%", "68%"], center: ["50%", "45%"],
        data: STAGES.map(function (s, i) { return { name: s, value: stageCnt[s], itemStyle: { color: PIE[i] } }; }),
        label: { color: "#FFF7EC", fontSize: 12, fontWeight: 600, formatter: "{b}\n{c}人" }, labelLine: { lineStyle: { color: "rgba(255,209,102,.4)" } }
      }]
    });
    // 横向柱状图 — 各县区人数（带数值标签，标签用简称、tooltip 显示全称）
    makeChart("cCounty", {
      animation: true, animationDuration: 800, animationEasing: "cubicOut",
      tooltip: { trigger: "axis", formatter: function (ps) {
        var i = ps[0].dataIndex; return countyArr[i].name + "：<b>" + ps[0].value + "</b> 人"; } },
      grid: baseGrid(),
      xAxis: Object.assign({ type: "value", max: Math.max.apply(null, countyArr.map(function (c) { return c.v; })) * 1.15 }, axisStyle()),
      yAxis: { type: "category", data: countyArr.map(function (c) { return countyShort(c.name); }),
        axisLine: { lineStyle: { color: "rgba(255,209,102,.35)" } }, axisLabel: { color: "#F2D2A6", fontSize: 11 } },
      series: [{ type: "bar", data: countyArr.map(function (c) { return c.v; }),
        itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: C4 }, { offset: 1, color: C2 }]), borderRadius: [0, 5, 5, 0] }, barWidth: "58%",
        label: Object.assign({}, BAR_LABEL, { position: "right" }) }]
    });
    // 雷达图 — 五维平均
    makeChart("cDimAvg", radarOptionAvg(dimAvg));
    // 柱状图 — 岗位分布（带数值标签 + 入场动画）
    makeChart("cJob", {
      animation: true, animationDuration: 800, animationEasing: "cubicOut",
      tooltip: { trigger: "axis" }, grid: baseGrid(),
      xAxis: { type: "category", data: JOB, axisLine: { lineStyle: { color: "rgba(255,209,102,.35)" } },
        axisLabel: { color: "#F2D2A6", fontSize: 11, interval: 0 } },
      yAxis: Object.assign({ type: "value" }, axisStyle()),
      series: [{ type: "bar", data: JOB.map(function (j) { return jobCnt[j]; }),
        itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: C1 }, { offset: 1, color: C5 }]), borderRadius: [5, 5, 0, 0] }, barWidth: "46%",
        label: BAR_LABEL }]
    });
  }

  function radarOptionAvg(dimAvg) {
    var indicator = DIM.map(function (k) { return { name: k, max: DIM_MAX }; });
    return {
      animation: true, animationDuration: 1400, animationEasing: "elasticOut", animationDelay: 200,
      tooltip: { trigger: "item",
        formatter: function (params) {
          var d = params.data;
          var lines = ["<b>全员平均</b>"];
          DIM.forEach(function (k, i) { lines.push(k + "：<b>" + num(d.value[i]) + "</b> / " + DIM_MAX); });
          return lines.join("<br/>");
        }
      },
      radar: { indicator: indicator, center: ["50%", "52%"], radius: "66%",
        axisName: { color: "#FFE7A8", fontSize: 12, fontWeight: 600 },
        splitLine: { lineStyle: { color: "rgba(255,209,102,.22)" } },
        splitArea: { areaStyle: { color: ["rgba(255,90,60,.04)", "rgba(255,209,102,.05)"] } },
        axisLine: { lineStyle: { color: "rgba(255,209,102,.25)" } } },
      series: [{ type: "radar", data: [{ value: dimAvg, name: "全员平均",
        lineStyle: { width: 2.5, color: C1 }, itemStyle: { color: C1 }, areaStyle: { color: C1, opacity: .3 },
        label: { show: true, formatter: "{c}", color: "#FFF7EC", fontSize: 10 } }] }]
    };
  }

  function kpi(label, val, unit, foot) {
    return '<div class="kpi"><div class="label">' + esc(label) + '</div>' +
      '<div class="val">' + val + '<span class="unit">' + esc(unit || "") + '</span></div>' +
      '<div class="foot">' + esc(foot || "") + '</div></div>';
  }
  function panel(title, body, sub) {
    return '<div class="panel"><div class="panel-head"><span class="t">' + esc(title) + '</span>' +
      (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + '</div>' + body + '</div>';
  }

  /* ---------- 视图：人员画像（搜索 + 列表 + 单人/双人对标） ---------- */
  function filteredPeople() {
    var q = STATE.search.trim().toLowerCase();
    return STATE.people.filter(function (p) {
      if (STATE.fCounty && p.county !== STATE.fCounty) return false;
      if (STATE.fStage && p.stage !== STATE.fStage) return false;
      if (q) {
        var hay = (p.name + p.idCard + p.phone + p.county + p.org).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function renderProfile() {
    var counties = {}; STATE.people.forEach(function (p) { counties[p.county] = 1; });
    var countyOpts = Object.keys(counties).sort().map(function (c) {
      return '<option value="' + esc(c) + '"' + (STATE.fCounty === c ? " selected" : "") + '>' + esc(c) + '</option>';
    }).join("");
    var stageOpts = STAGES.map(function (s) {
      return '<option value="' + esc(s) + '"' + (STATE.fStage === s ? " selected" : "") + '>' + esc(s) + '</option>';
    }).join("");

    var html = '' +
      '<div class="view-title"><span class="bar"></span><h1>人员画像</h1>' +
      '<span class="hint">点击人员查看画像 · 再点一人即可双人积分对标（最多2人）</span></div>' +
      '<div class="profile-layout">' +
      '<div class="list-panel">' +
      '<div class="search-box"><span class="s-ico">🔍</span>' +
      '<input type="text" id="searchInput" placeholder="搜索 姓名 / 身份证 / 电话 / 县区" value="' + esc(STATE.search) + '"></div>' +
      '<div class="filter-row"><select id="fCounty"><option value="">全部单位</option>' + countyOpts + '</select>' +
      '<select id="fStage"><option value="">全部阶段</option>' + stageOpts + '</select></div>' +
      '<div class="list-meta"><span id="listCount">—</span><span class="sel-count" id="selCount"></span></div>' +
      '<div class="person-list" id="personList"></div>' +
      '</div>' +
      '<div id="detailArea"></div>' +
      '</div>';
    $("#view").innerHTML = html;

    // 列表渲染
    function renderList() {
      var list = filteredPeople();
      $("#listCount").textContent = "共 " + list.length + " 人";
      $("#selCount").textContent = STATE.selected.length ? ("已选 " + STATE.selected.length + " 人") : "";
      var box = $("#personList");
      if (!list.length) { box.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">无匹配人员</div>'; return; }
      box.innerHTML = list.map(function (p) {
        var sel = STATE.selected.indexOf(p.id) >= 0;
        return '<div class="person-item' + (sel ? " sel" : "") + '" data-id="' + p.id + '">' +
          '<div class="pi-check">' + (sel ? "✓" : "") + '</div>' +
          '<div class="pi-main"><div class="pi-name">' + esc(p.name) +
          ' <span class="stage-tag stage-' + esc(p.stage) + '">' + esc(p.stage) + '</span></div>' +
          '<div class="pi-sub">' + esc(p.county) + ' · ' + esc(p.jobType) + ' · ' + esc(p.org) + '</div></div>' +
          '<div class="pi-score">' + p.total + '<small>总分</small></div>' +
          '</div>';
      }).join("");
      $all(".person-item", box).forEach(function (el) {
        el.addEventListener("click", function () { toggleSelect(Number(el.getAttribute("data-id"))); });
      });
    }

    $("#searchInput").addEventListener("input", function (e) { STATE.search = e.target.value; renderList(); });
    $("#fCounty").addEventListener("change", function (e) { STATE.fCounty = e.target.value; renderList(); });
    $("#fStage").addEventListener("change", function (e) { STATE.fStage = e.target.value; renderList(); });

    renderList();
    renderDetail();
  }

  function toggleSelect(id) {
    var i = STATE.selected.indexOf(id);
    if (i >= 0) STATE.selected.splice(i, 1);
    else {
      STATE.selected.push(id);
      if (STATE.selected.length > 2) STATE.selected.shift();
    }
    $all(".person-item").forEach(function (el) {
      var sel = STATE.selected.indexOf(Number(el.getAttribute("data-id"))) >= 0;
      el.classList.toggle("sel", sel);
      $(".pi-check", el).textContent = sel ? "✓" : "";
    });
    var sc = $("#selCount"); if (sc) sc.textContent = STATE.selected.length ? ("已选 " + STATE.selected.length + " 人") : "";
    renderDetail();
  }

  /* ====== 详情渲染（单人 / 双人） ======
   * 关键修复：innerHTML 写入后用 requestAnimationFrame 确保 DOM 就绪再 init echarts，
   * 避免容器尺寸为 0 导致图表不渲染的问题。 */
  function renderDetail() {
    var area = $("#detailArea");
    var sel = STATE.selected.map(getPerson).filter(Boolean);
    if (!sel.length) {
      area.innerHTML = '<div class="panel detail-empty"><div><div class="de-ico">👤</div>' +
        '请从左侧选择人员查看其基本信息与五维积分画像<br><span style="font-size:12px">（再点一人可双人积分对标）</span></div></div>';
      return;
    }
    if (sel.length === 1) area.innerHTML = singleDetail(sel[0]);
    else area.innerHTML = compareDetail(sel[0], sel[1]);

    // 延迟到 DOM 渲染完成后初始化图表，并强制 resize 确保容器已具备尺寸
    requestAnimationFrame(function () {
      var charts = [];
      if (sel.length === 1) charts.push(makeChart("rSingle", radarOption(sel)));
      else {
        charts.push(makeChart("rCmp", radarOption(sel)));
        charts.push(makeChart("bCmp", dimBarOption(sel[0], sel[1])));
      }
      charts.forEach(function (c) { if (c) c.resize(); });
    });
  }

  function infoCard(p) {
    var initial = p.name ? p.name.charAt(0) : "·";
    return '<div class="info-card"><div class="ic-head">' +
      '<div class="ic-avatar">' + esc(initial) + '</div>' +
      '<div><div class="ic-name">' + esc(p.name) +
      ' <span class="stage-tag stage-' + esc(p.stage) + '">' + esc(p.stage) + '</span></div>' +
      '<div class="ic-tags"><span class="tag">' + esc(p.gender) + '</span>' +
      '<span class="tag">' + esc(p.jobType) + '</span><span class="tag">' + esc(p.county) + '</span></div></div></div>' +
      '<div class="info-rows">' +
      ir("身份证号", p.idCard) + ir("联系电话", p.phone) +
      ir("县（区）局", p.county) + ir("申请受理党组织", p.org) +
      ir("申请书递交日期", p.applyDate) + ir("当前阶段", p.stage) +
      '</div></div>';
  }
  function ir(k, v) { return '<div class="ir-k">' + esc(k) + '</div><div class="ir-v">' + esc(v) + '</div>'; }

  function scoreCard(p) {
    var maxT = Math.max.apply(null, STATE.people.map(function (x) { return x.total; })) || 1;
    var pct = Math.round(p.total / maxT * 100);
    var rank = STATE.people.slice().sort(function (a, b) { return b.total - a.total; })
      .findIndex(function (x) { return x.id === p.id; }) + 1;
    return '<div class="score-card"><div class="sc-label">总分（五维之和）</div>' +
      '<div class="sc-val">' + p.total + '<small> 分</small></div>' +
      '<div class="sc-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="sc-foot"><span>满分 100</span><span>全市第 ' + rank + ' 名</span></div>' +
      '</div>';
  }

  /* 维度明细表（无加权列） */
  function dimTable(p, other) {
    var rows = DIM.map(function (k) {
      var v = p.scores[k] || 0;
      var cmp = other ? ((other.scores[k] || 0) - v) : 0;
      var pctBar = Math.round(v / DIM_MAX * 100);
      return '<tr><td>' + esc(k) + '</td>' +
        '<td class="num">' + v + ' <span style="font-size:10px;color:var(--muted)">/' + DIM_MAX + '</span></td>' +
        (other ? '<td class="num" style="color:' + (cmp >= 0 ? '#9be39b' : '#ff9c8f') + '">' + (cmp >= 0 ? "+" : "") + cmp + '</td>' : '') +
        '<td><div class="dim-mini"><i style="width:' + pctBar + '%"></i></div></td></tr>';
    }).join("");
    return '<table class="dim-table ' + (other ? 'cols4' : 'cols3') + '"><thead><tr><th>维度</th><th class="num">得分</th>' +
      (other ? '<th class="num">对比差值</th>' : '') + '<th>维度占比</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  function singleDetail(p) {
    var weakest = DIM.slice().sort(function (a, b) { return (p.scores[a] || 0) - (p.scores[b] || 0); })[0];
    return '<div class="detail-grid">' +
      '<div class="detail-cols">' + infoCard(p) + scoreCard(p) + '</div>' +
      panel("五维积分雷达 · " + p.name, '<div id="rSingle" class="chart h320"></div>',
        "思想态度 / 学习成效 / 日常表现 / 履职担当 / 工作实绩") +
      panel("维度得分明细", dimTable(p, null) +
        '<div style="margin-top:12px"><span class="weak-tag">短板提示：' + esc(weakest) + '（' + (p.scores[weakest] || 0) + '/' + DIM_MAX + '）</span>' +
        ' <span style="font-size:12px;color:var(--muted)">建议针对性加强培养</span></div>', "") +
      '</div>';
  }

  function compareDetail(a, b) {
    var dT = num(a.total - b.total);
    return '<div class="detail-grid">' +
      '<div class="compare-tip"><span class="pill">积分对标</span> 已选择两人，雷达图与维度明细并列对比' +
      '<span style="margin-left:auto;color:#fff">总分差 <b style="color:var(--gold)">' + (dT >= 0 ? "+" : "") + dT + '</b> 分</span></div>' +
      '<div class="detail-cols">' + infoCard(a) + infoCard(b) + '</div>' +
      '<div class="detail-cols">' + scoreCard(a) + scoreCard(b) + '</div>' +
      panel("五维积分对标雷达", '<div id="rCmp" class="chart h340"></div>', a.name + "（红） vs " + b.name + "（金）") +
      panel("维度得分对比", '<div id="bCmp" class="chart h280"></div>', "") +
      panel("维度明细对比", dimTable(a, b), "") +
      '</div>';
  }

  /* ---------- 视图：积分排名 ---------- */
  function renderRank() {
    var sortKey = STATE.rkSort;
    var sorted = STATE.people.slice().sort(function (x, y) {
      if (DIM.indexOf(sortKey) >= 0) return (y.scores[sortKey] || 0) - (x.scores[sortKey] || 0);
      return y.total - x.total;
    });
    var top10 = sorted.slice(0, 10);
    var sortOpts = '<option value="total">总分</option>' +
      DIM.map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + '</option>'; }).join("");
    var countyOpts = Object.keys(STATE.people.reduce(function (a, p) { a[p.county] = 1; return a; }, {})).sort()
      .map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join("");

    var html = '' +
      '<div class="view-title"><span class="bar"></span><h1>积分排名</h1>' +
      '<span class="hint">按总分排序 · 精准择优发展</span></div>' +
      '<div class="controls">' +
      '<div class="grp"><span style="font-size:13px;color:var(--muted)">排序依据</span>' +
      '<select id="rkSort">' + sortOpts + '</select></div>' +
      '<div class="grp"><span style="font-size:13px;color:var(--muted)">单位</span>' +
      '<select id="rkCounty"><option value="">全部</option>' + countyOpts + '</select></div>' +
      '<div class="grp" style="margin-left:auto;font-size:12px;color:var(--muted)">共 ' + STATE.people.length + ' 人</div>' +
      '</div>' +
      '<div class="grid cols-2" style="margin-bottom:16px">' +
      panel("总分 TOP 10", '<div id="cTop" class="chart h320"></div>', "按总分排序") +
      panel("积分档位分布", '<div id="cBucket" class="chart h320"></div>', "单位：人") +
      '</div>' +
      '<div class="panel"><div class="panel-head"><span class="t">全部人员积分排名</span>' +
      '<span class="sub">点击姓名可查看画像</span></div>' +
      '<div class="table-wrap rank-scroll"><table class="data rank-table"><thead><tr>' +
      '<th>排名</th><th>姓名</th><th>单位</th><th>阶段</th><th>岗位</th>' +
      '<th class="num">总分</th><th>操作</th></tr></thead><tbody id="rkBody"></tbody></table></div></div>';
    $("#view").innerHTML = html;

    var fC = "";
    $("#rkCounty").addEventListener("change", function (e) {
      fC = e.target.value;
      var filtered = STATE.people.filter(function (p) { return !fC || p.county === fC; });
      var s2 = filtered.slice().sort(function (x, y) {
        if (DIM.indexOf(STATE.rkSort) >= 0) return (y.scores[STATE.rkSort] || 0) - (x.scores[STATE.rkSort] || 0);
        return y.total - x.total;
      });
      renderBody(s2); renderTop(s2.slice(0, 10)); renderBucket(s2);
    });
    $("#rkSort").value = STATE.rkSort;
    $("#rkSort").addEventListener("change", function (e) {
      STATE.rkSort = e.target.value; renderRank();
    });

    function renderBody(arr) {
      $("#rkBody").innerHTML = arr.map(function (p, i) {
        var medal = i < 3 ? '<span class="medal medal-' + (i + 1) + '">' + (i + 1) + '</span>' : (i + 1);
        return '<tr class="rk-click" data-id="' + p.id + '"><td class="rk">' + medal + '</td>' +
          '<td><b>' + esc(p.name) + '</b></td><td>' + esc(p.county) + '</td>' +
          '<td><span class="stage-tag stage-' + esc(p.stage) + '">' + esc(p.stage) + '</span></td>' +
          '<td>' + esc(p.jobType) + '</td>' +
          '<td class="num" style="color:var(--gold);font-weight:800">' + p.total + '</td>' +
          '<td><button class="btn btn-ghost" style="padding:5px 12px;font-size:12px" data-view="' + p.id + '">查看画像</button></td></tr>';
      }).join("");
      $all("#rkBody tr").forEach(function (tr) {
        tr.addEventListener("click", function () {
          STATE.selected = [Number(tr.getAttribute("data-id"))];
          location.hash = "#/profile";
        });
      });
    }
    function renderTop(arr) {
      makeChart("cTop", {
        animation: true, animationDuration: 800, animationEasing: "cubicOut",
        tooltip: { trigger: "axis" }, grid: baseGrid(),
        xAxis: { type: "category", data: arr.map(function (p) { return p.name; }),
          axisLine: { lineStyle: { color: "rgba(255,209,102,.35)" } }, axisLabel: { color: "#F2D2A6", fontSize: 11, interval: 0, rotate: 28 } },
        yAxis: Object.assign({ type: "value" }, axisStyle()),
        series: [{ type: "bar", data: arr.map(function (p) { return p.total; }),
          itemStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: C1 }, { offset: 1, color: C5 }]), borderRadius: [5, 5, 0, 0] }, barWidth: "50%",
          label: BAR_LABEL }]
      });
    }
    function renderBucket(arr) {
      var buckets = [{ n: "90分以上", c: 0, color: C4 }, { n: "80-90", c: 0, color: C1 },
        { n: "70-80", c: 0, color: C3 }, { n: "60-70", c: 0, color: C2 }, { n: "60以下", c: 0, color: C5 }];
      arr.forEach(function (p) {
        var t = p.total;
        if (t >= 90) buckets[0].c++; else if (t >= 80) buckets[1].c++; else if (t >= 70) buckets[2].c++;
        else if (t >= 60) buckets[3].c++; else buckets[4].c++;
      });
      makeChart("cBucket", {
        animation: true, animationDuration: 1000, animationEasing: "cubicOut",
        tooltip: { trigger: "item", formatter: "{b}: {c}人 ({d}%)" },
        series: [{ type: "pie", radius: ["40%", "68%"], center: ["50%", "46%"],
          data: buckets.map(function (b) { return { name: b.n, value: b.c, itemStyle: { color: b.color } }; }),
          label: { color: "#FFF7EC", fontSize: 12, fontWeight: 600, formatter: "{b}\n{c}人" }, labelLine: { lineStyle: { color: "rgba(255,209,102,.4)" } } }],
        legend: { bottom: 0, textStyle: { color: "#FFF7EC" }, itemWidth: 12, itemHeight: 8 }
      });
    }
    renderBody(sorted); renderTop(top10); renderBucket(STATE.people);
  }

  /* ---------- 视图：积分规则 ---------- */
  function renderRules() {
    var intro = '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><span class="t">党员发展积分制管理 · 总体说明</span></div>' +
      '<div style="font-size:13.5px;line-height:1.9;color:var(--text)">' +
      '制定标准化入党积分考评细则，设置 <b style="color:var(--gold)">思想态度、日常表现、履职担当、工作实绩、学习成效</b> 五个积分维度，' +
      '每个维度满分 <b style="color:var(--gold)">20 分</b>，从 0 分开始累积；' +
      '总分 = 五个维度得分之和（<b style="color:var(--gold)">满分 100 分</b>），按总分排名择优发展。' +
      '对入党积极分子、发展对象进行常态化积分登记和动态更新，' +
      '用数据量化表现，改变主观评价、模糊研判的选人模式，实现精准择优。</div></div>';

    var rules = D.RULES.map(function (r, i) {
      return '<div class="rule-dim" data-i="' + i + '"><div class="rule-head">' +
        '<div class="rh-idx">' + (i + 1) + '</div><div class="rh-name">' + esc(r.name) +
        ' <span class="rh-base">满分' + r.max + '分</span></div>' +
        '<div class="rh-caret">▶</div></div>' +
        '<div class="rule-body">' +
        sec("基础达标要求", r.standard, "") +
        sec("正向积分事项", r.positive, "") +
        sec("负面清单（扣分）", r.negative, "neg") +
        sec("一票否决", r.veto, "veto") +
        '</div></div>';
    }).join("");

    // 岗位属性说明表（无权重）
    var jHead = "<tr><th>岗位属性</th><th>适用范围</th><th>说明</th></tr>";
    var jRows = [
      ["综合岗", "机关行政、综合管理类岗位", "综合素养要求均衡发展"],
      ["专卖岗", "专卖执法、市场监管、打假打私类岗位", "侧重履职担当与工作实绩"],
      ["销售岗", "营销网建、客户服务、市场分析类岗位", "侧重日常表现与工作实绩"],
      ["配送岗", "卷烟物流配送、仓储调度类岗位", "侧重日常表现与履职担当"],
    ].map(function (row) {
      return "<tr><td><b>" + row[0] + "</b></td><td>" + row[1] + "</td><td style='color:var(--muted)'>" + row[2] + "</td></tr>";
    }).join("");
    var jTable = '<div class="panel" style="margin-top:16px"><div class="panel-head"><span class="t">岗位属性说明</span>' +
      '<span class="sub">用于分类统计与展示</span></div><div class="table-wrap"><table class="data rules-job">' +
      '<thead>' + jHead + '</thead><tbody>' + jRows + '</tbody></table></div></div>';

    $("#view").innerHTML = '<div class="view-title"><span class="bar"></span><h1>积分规则</h1>' +
      '<span class="hint">《党员发展积分制管理细则》五维度考评口径</span></div>' + intro +
      '<div id="ruleList">' + rules + '</div>' + jTable;

    $all(".rule-dim").forEach(function (el) {
      $(".rule-head", el).addEventListener("click", function () { el.classList.toggle("open"); });
    });
    $all(".rule-dim").slice(0, 2).forEach(function (el) { el.classList.add("open"); });
  }
  function sec(title, arr, cls) {
    if (!arr || !arr.length) return "";
    return '<div class="rule-sec"><div class="rs-t">' + esc(title) + '</div><ul class="rule-list ' + cls + '">' +
      arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ul></div>';
  }

  /* ---------- 视图：数据管理 ---------- */
  function renderManage() {
    var n = STATE.people.length;
    var src = STATE.source === "imported" ? "已导入的外部 Excel 数据" : "系统内置示例数据";
    $("#view").innerHTML = '<div class="view-title"><span class="bar"></span><h1>数据管理</h1>' +
      '<span class="hint">人员信息与积分数据的导入 / 导出</span></div>' +
      '<div class="grid cols-2">' +
      '<div class="panel"><div class="panel-head"><span class="t">当前数据状态</span></div>' +
      '<div class="manage-card">' +
      manageRow("📊", "数据来源", src) +
      manageRow("👥", "人员规模", n + " 名入党申请人（含五维积分）") +
      manageRow("🏢", "覆盖单位", Object.keys(STATE.people.reduce(function (a, p) { a[p.county] = 1; return a; }, {})).length + " 个单位") +
      '</div></div>' +
      '<div class="panel"><div class="panel-head"><span class="t">数据操作</span></div>' +
      '<div class="manage-card">' +
      '<div class="manage-row"><div class="mr-ico">⬇</div><div class="mr-main"><div class="mr-t">下载导入模板</div>' +
      '<div class="mr-d">获取标准 Excel 模板（含填写说明）</div></div>' +
      '<button class="btn btn-gold" id="mTpl">下载</button></div>' +
      '<div class="manage-row"><div class="mr-ico">📥</div><div class="mr-main"><div class="mr-t">从 Excel 导入</div>' +
      '<div class="mr-d">点击右上角"数据导入"选择文件并应用</div></div>' +
      '<button class="btn btn-ghost" id="mOpen">打开面板</button></div>' +
      '<div class="manage-row"><div class="mr-ico">📤</div><div class="mr-main"><div class="mr-t">导出当前数据</div>' +
      '<div class="mr-d">将当前全部人员导出为 Excel（含总分）</div></div>' +
      '<button class="btn btn-ghost" id="mExport">导出</button></div>' +
      '<div class="manage-row"><div class="mr-ico">🔄</div><div class="mr-main"><div class="mr-t">恢复示例数据</div>' +
      '<div class="mr-d">重新载入系统内置演示数据</div></div>' +
      '<button class="btn btn-ghost" id="mDemo">载入</button></div>' +
      '</div></div></div>';
    $("#mTpl").addEventListener("click", function () { exportTemplate(); });
    $("#mExport").addEventListener("click", function () { exportData(); });
    $("#mDemo").addEventListener("click", function () { setData(D.fromDemo(), "demo"); toast("已载入示例数据"); renderManage(); });
    $("#mOpen").addEventListener("click", function () { openDrawer(); });
  }
  function manageRow(ico, t, d) {
    return '<div class="manage-row"><div class="mr-ico">' + ico + '</div><div class="mr-main"><div class="mr-t">' +
      esc(t) + '</div><div class="mr-d">' + esc(d) + '</div></div></div>';
  }

  /* ---------- 路由 ---------- */
  function router() {
    clearCharts();
    var h = location.hash.replace(/^#\/?/, "") || "overview";
    STATE.route = h;
    $all(".nav-item").forEach(function (el) { el.classList.toggle("active", el.getAttribute("data-route") === h); });
    if (h === "overview") renderOverview();
    else if (h === "profile") renderProfile();
    else if (h === "rank") renderRank();
    else if (h === "rules") renderRules();
    else if (h === "manage") renderManage();
    else renderOverview();
    $("#view").scrollTop = 0;
  }

  /* ---------- 数据导入抽屉 ---------- */
  var pendingResult = null;
  function openDrawer() { $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#drawerMask").classList.add("show"); $("#importToggle").setAttribute("aria-pressed", "true"); }
  function closeDrawer() { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); $("#drawerMask").classList.remove("show"); $("#importToggle").setAttribute("aria-pressed", "false"); }

  function exportTemplate() {
    try { D.downloadWorkbook(D.buildTemplateWorkbook(), "入党申请人信息导入模板.xlsx"); toast("模板已下载"); }
    catch (e) { toast("模板下载失败：" + e.message); }
  }
  function exportData() {
    try { D.downloadWorkbook(D.buildExportWorkbook({ people: STATE.people }), "入党申请人积分数据.xlsx"); toast("数据已导出"); }
    catch (e) { toast("导出失败：" + e.message); }
  }

  function wireDrawer() {
    $("#importToggle").addEventListener("click", function () {
      if ($("#drawer").classList.contains("open")) closeDrawer(); else openDrawer();
    });
    $("#drawerClose").addEventListener("click", closeDrawer);
    $("#drawerMask").addEventListener("click", closeDrawer);
    $("#btnTpl").addEventListener("click", exportTemplate);
    $("#btnExport").addEventListener("click", exportData);
    $("#btnDemo").addEventListener("click", function () {
      setData(D.fromDemo(), "demo"); pendingResult = null; $("#btnApply").disabled = true;
      $("#parseResult").innerHTML = '<span class="ok">已载入示例数据：' + STATE.people.length + ' 人</span>';
      toast("已载入示例数据"); router();
    });

    var fileInput = $("#fileInput");
    var dropzone = $("#dropzone");
    fileInput.addEventListener("change", function (e) { if (e.target.files[0]) handleFile(e.target.files[0]); });
    ["dragover", "dragenter"].forEach(function (ev) { dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add("drag"); }); });
    ["dragleave", "drop"].forEach(function (ev) { dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.remove("drag"); }); });
    dropzone.addEventListener("drop", function (e) { if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

    $("#btnApply").addEventListener("click", function () {
      if (!pendingResult) return;
      setData(pendingResult, "imported"); closeDrawer(); toast("数据已应用：" + STATE.people.length + " 人"); router();
    });
  }

  function handleFile(file) {
    $("#fileName").textContent = file.name;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var res = D.parseArrayBuffer(e.target.result);
        pendingResult = res;
        var msgs = res.messages.map(function (m) {
          var cls = m.lv === "ok" ? "ok" : (m.lv === "err" ? "err" : "warn");
          return '<div class="' + cls + '">• ' + esc(m.t) + '</div>';
        }).join("");
        var warn = res.messages.some(function (m) { return m.lv === "err"; });
        $("#parseResult").innerHTML = msgs + (warn ? '<div class="err" style="margin-top:6px">存在错误，请修正后重新导入。</div>'
          : '<div class="ok" style="margin-top:6px">校验通过，可点击下方"应用到大屏"。</div>');
        $("#btnApply").disabled = warn;
      } catch (err) {
        pendingResult = null; $("#btnApply").disabled = true;
        $("#parseResult").innerHTML = '<div class="err">解析失败：' + esc(err.message) + '</div>';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ---------- 时钟 ---------- */
  function tickClock() {
    var d = new Date();
    var p = function (n) { return n < 10 ? "0" + n : "" + n; };
    $("#clock").textContent = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  /* ---------- 初始化 ---------- */
  function init() {
    setData(D.fromDemo(), "demo");
    wireDrawer();
    window.addEventListener("hashchange", router);
    window.addEventListener("resize", function () { CHARTS.forEach(function (c) { try { c.resize(); } catch (e) {} }); });
    tickClock(); setInterval(tickClock, 1000);
    router();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
