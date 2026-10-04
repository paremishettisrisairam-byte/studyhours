/* Study Hours vs Academic Performance Analyzer
   All statistics are computed from the dataset; nothing is hard-coded. */
'use strict';

let students = [];      // each item: { name, hours, marks }
let chart = null;       // Chart.js instance
let lastModel = null;   // latest regression result (used for prediction)

const SAMPLE = [
  ['Aarav',2,45],['Diya',3,52],['Kabir',4,58],['Meera',5,65],['Rohan',6,70],
  ['Ananya',7,76],['Vikram',8,82],['Sneha',9,88],['Arjun',10,91],['Priya',11,95]
];

const $ = id => document.getElementById(id);
const fmt = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v)) ? '–' : Number(v.toFixed(d)).toString();

/* ---------- Statistical functions ---------- */

// Mean: x̄ = Σx / n
function calculateMean(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// Variance (population): σ² = Σ(x − x̄)² / n
function calculateVariance(values) {
  if (values.length === 0) return null;
  const mean = calculateMean(values);
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}

// Standard deviation: σ = √variance
function calculateStandardDeviation(values) {
  const variance = calculateVariance(values);
  return variance === null ? null : Math.sqrt(variance);
}

// Covariance: Cov(X,Y) = Σ[(X − X̄)(Y − Ȳ)] / n
function calculateCovariance(xs, ys) {
  if (xs.length === 0) return null;
  const mx = calculateMean(xs), my = calculateMean(ys);
  let total = 0;
  for (let i = 0; i < xs.length; i++) total += (xs[i] - mx) * (ys[i] - my);
  return total / xs.length;
}

// Pearson correlation: r = Cov(X,Y) / (σX × σY). Returns null if either variable has no variation.
function calculateCorrelation(xs, ys) {
  if (xs.length < 2) return null;
  const sx = calculateStandardDeviation(xs), sy = calculateStandardDeviation(ys);
  if (sx === 0 || sy === 0) return null;
  const r = calculateCovariance(xs, ys) / (sx * sy);
  return Math.max(-1, Math.min(1, r)); // guard against tiny rounding errors
}

// Regression: slope b1 = Cov(X,Y) / Var(X); intercept b0 = Ȳ − b1·X̄
function calculateRegression(xs, ys) {
  if (xs.length < 2) return null;
  const varX = calculateVariance(xs);
  if (varX === 0) return null;
  const b1 = calculateCovariance(xs, ys) / varX;
  const b0 = calculateMean(ys) - b1 * calculateMean(xs);
  return { b0, b1 };
}

// Predict marks: raw ŷ = b0 + b1·x (never altered), then final = max(0, min(100, raw))
// xRange = { min, max } of the study hours in the dataset, used for the reliability warning.
function predictMarks(hours, model, xRange) {
  const raw = model.b0 + model.b1 * hours;           // mathematically exact regression value
  const final = Math.max(0, Math.min(100, raw));     // only the DISPLAYED value is range-limited
  let rangeMessage = '';
  if (raw < 0) rangeMessage = 'The regression model produced a value below the valid marks range, so it has been limited to 0.';
  else if (raw > 100) rangeMessage = 'The regression model produced a value above the valid marks range, so it has been limited to 100.';
  const outsideDataset = !!xRange && (hours < xRange.min || hours > xRange.max);
  const datasetWarning = outsideDataset
    ? 'Warning: This prediction is outside the study-hour range of the available dataset, so the estimate may be less reliable.' : '';
  return { raw, final, rangeMessage, datasetWarning };
}

/* ---------- Interpretation text ---------- */

function describeCorrelation(r) {
  if (r === null) return 'Correlation cannot be calculated (need 2+ students, with variation in both hours and marks).';
  const a = Math.abs(r);
  const strength = a >= 0.8 ? 'strong' : a >= 0.5 ? 'moderate' : a >= 0.2 ? 'weak' : 'very weak or no';
  if (a < 0.2) return `r is close to 0: there is ${strength} linear relationship in this dataset.`;
  return `r is ${r > 0 ? 'near +1' : 'near −1'}: a ${strength} ${r > 0 ? 'positive' : 'negative'} linear relationship.`;
}

function buildSummary(r) {
  if (r === null) return 'Add at least two students with different study hours and different marks to see an analysis.';
  const a = Math.abs(r);
  if (a < 0.2) return 'The dataset shows very little linear relationship between study hours and marks. Study hours alone do not explain the marks of these students.';
  const dir = r > 0
    ? 'Students with higher study hours tend to have higher marks in this dataset.'
    : 'Students with higher study hours tend to have lower marks in this dataset.';
  const strength = a >= 0.8 ? 'strong' : a >= 0.5 ? 'moderate' : 'weak';
  return `The dataset shows a ${strength} ${r > 0 ? 'positive' : 'negative'} linear relationship between study hours and academic marks. ${dir} Correlation shows association only; it does not prove that study hours cause the marks.`;
}

/* ---------- UI updates ---------- */

// Smoothly animate a card number from its current value to a new one
function animateValue(el, target, decimals) {
  if (target === null || Number.isNaN(target)) { el.textContent = '–'; el.dataset.v = 0; return; }
  const start = parseFloat(el.dataset.v) || 0, t0 = performance.now(), dur = 450;
  el.dataset.v = target;
  function frame(now) {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = fmt(start + (target - start) * p, decimals);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function updateDashboard() {
  const xs = students.map(s => s.hours), ys = students.map(s => s.marks);
  const n = students.length;
  const meanX = calculateMean(xs), meanY = calculateMean(ys);
  const varX = calculateVariance(xs), varY = calculateVariance(ys);
  const sdX = calculateStandardDeviation(xs), sdY = calculateStandardDeviation(ys);
  const cov = calculateCovariance(xs, ys), r = calculateCorrelation(xs, ys);
  lastModel = calculateRegression(xs, ys);

  animateValue($('cardCount'), n, 0);
  animateValue($('cardMeanX'), meanX, 2);
  animateValue($('cardMeanY'), meanY, 2);
  animateValue($('cardR'), r, 3);
  animateValue($('cardSdY'), sdY, 2);

  $('meanX').textContent = fmt(meanX); $('meanY').textContent = fmt(meanY);
  $('varX').textContent = fmt(varX);   $('varY').textContent = fmt(varY);
  $('sdX').textContent = fmt(sdX);     $('sdY').textContent = fmt(sdY);
  $('cov').textContent = fmt(cov);     $('rVal').textContent = fmt(r, 4);
  $('rMeaning').textContent = describeCorrelation(r);
  $('statsNote').textContent = n === 0 ? 'No data yet. Add students or load the sample data.'
    : n === 1 ? 'Only one student: variance, correlation and regression need at least two.' : '';

  let equation = 'Not enough data';
  if (lastModel) {
    const sign = lastModel.b1 < 0 ? '−' : '+';
    equation = `Marks = ${fmt(lastModel.b0)} ${sign} ${fmt(Math.abs(lastModel.b1))} × Study Hours`;
  } else if (n >= 2) equation = 'Cannot fit a line: all study hours are identical';
  $('equation').textContent = equation;
  $('slope').textContent = lastModel ? fmt(lastModel.b1, 4) : '–';
  $('intercept').textContent = lastModel ? fmt(lastModel.b0, 4) : '–';

  $('summaryText').textContent = buildSummary(r);
  const list = $('summaryList'); list.innerHTML = '';
  if (n >= 1) {
    [`Mean study hours: ${fmt(meanX)}`, `Mean marks: ${fmt(meanY)}`,
     `Variance (hours / marks): ${fmt(varX)} / ${fmt(varY)}`,
     `Standard deviation (hours / marks): ${fmt(sdX)} / ${fmt(sdY)}`,
     `Covariance: ${fmt(cov)}`, `Correlation coefficient: ${fmt(r, 4)}`,
     `Regression equation: ${equation}`].forEach(t => {
      const li = document.createElement('li'); li.textContent = t; list.appendChild(li);
    });
  }
  renderTable();
  updateChart();
}

function renderTable() {
  const body = $('tableBody'); body.innerHTML = '';
  if (students.length === 0) {
    body.innerHTML = '<tr><td colspan="4" class="small">No students yet.</td></tr>'; return;
  }
  students.forEach((s, i) => {
    const tr = document.createElement('tr');
    [s.name, s.hours, s.marks].forEach((v, c) => {
      const td = document.createElement('td'); td.textContent = v;
      if (c > 0) td.className = 'num'; tr.appendChild(td);
    });
    const td = document.createElement('td'), btn = document.createElement('button');
    btn.className = 'btn danger small'; btn.type = 'button'; btn.textContent = 'Delete';
    btn.addEventListener('click', () => { students.splice(i, 1); updateDashboard(); });
    td.appendChild(btn); tr.appendChild(td); body.appendChild(tr);
  });
}

function chartColors() {
  const css = getComputedStyle(document.documentElement);
  return { accent: css.getPropertyValue('--accent').trim(), accent2: css.getPropertyValue('--accent2').trim(),
           text: css.getPropertyValue('--muted').trim(), grid: css.getPropertyValue('--line').trim() };
}

function updateChart() {
  if (typeof Chart === 'undefined') { // CDN failed (e.g. offline)
    $('chartMsg').textContent = 'The chart library could not load. Connect to the internet and reload the page.'; return;
  }
  const c = chartColors();
  const points = students.map(s => ({ x: s.hours, y: s.marks, name: s.name }));
  let line = [];
  if (lastModel) { // draw the regression line across the range of X
    const xs = students.map(s => s.hours), lo = Math.min(...xs), hi = Math.max(...xs);
    line = [lo, hi].map(x => ({ x, y: lastModel.b0 + lastModel.b1 * x }));
  }
  if (!chart) {
    chart = new Chart($('scatterChart'), {
      type: 'scatter',
      data: { datasets: [
        { label: 'Students', data: points, pointRadius: 6, pointHoverRadius: 9 },
        { label: 'Regression line', type: 'line', data: line, pointRadius: 0, borderWidth: 2, fill: false }
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Study Hours vs Academic Marks', font: { size: 16 } },
          tooltip: { callbacks: { label: ctx => ctx.dataset.label === 'Students'
            ? `${ctx.raw.name}: ${ctx.raw.x} h, ${ctx.raw.y} marks` : `Line: ${fmt(ctx.raw.y)} marks at ${fmt(ctx.raw.x)} h` } } },
        scales: { x: { title: { display: true, text: 'Study Hours' }, beginAtZero: true },
                  y: { title: { display: true, text: 'Academic Marks' }, min: 0, max: 100 } } }
    });
  }
  chart.data.datasets[0].data = points;
  chart.data.datasets[1].data = line;
  chart.data.datasets[0].backgroundColor = c.accent;
  chart.data.datasets[1].borderColor = c.accent2;
  ['x', 'y'].forEach(a => {
    chart.options.scales[a].ticks = { color: c.text };
    chart.options.scales[a].grid = { color: c.grid };
    chart.options.scales[a].title.color = c.text;
  });
  chart.options.plugins.title.color = c.text;
  chart.options.plugins.legend = { labels: { color: c.text } };
  chart.update();
}

/* ---------- Form handling ---------- */

function showMessage(text, ok = false) {
  const el = $('formMsg'); el.textContent = text; el.className = 'msg' + (ok ? ' ok' : '');
}

function addStudent() {
  const name = $('name').value.trim();
  const hoursText = $('hours').value.trim(), marksText = $('marks').value.trim();
  const hours = Number(hoursText), marks = Number(marksText);
  if (!name) return showMessage('Please enter the student name.');
  if (hoursText === '' || !Number.isFinite(hours)) return showMessage('Please enter study hours as a number.');
  if (hours < 0) return showMessage('Study hours cannot be negative.');
  if (hours > 24) return showMessage('Study hours per day cannot be more than 24.');
  if (marksText === '' || !Number.isFinite(marks)) return showMessage('Please enter marks as a number.');
  if (marks < 0 || marks > 100) return showMessage('Marks must be between 0 and 100.');
  students.push({ name, hours, marks });
  clearForm(); showMessage(`${name} added.`, true);
  updateDashboard();
}

function clearForm() { ['name', 'hours', 'marks'].forEach(id => $(id).value = ''); showMessage(''); }

function loadSampleData() {
  students = SAMPLE.map(([name, hours, marks]) => ({ name, hours, marks }));
  showMessage('Sample data loaded.', true); updateDashboard();
}

function clearAllData() { students = []; updateDashboard(); showMessage('All data cleared.', true); }

function resetDashboard() { clearAllData(); clearForm(); $('predHours').value = ''; $('predError').textContent = ''; $('predOutput').hidden = true; }

function handlePrediction() {
  const text = $('predHours').value.trim(), hours = Number(text);
  const fail = msg => { $('predOutput').hidden = true; $('predError').textContent = msg; };
  $('predError').textContent = '';
  if (!lastModel) return fail('Add at least two students with different study hours first.');
  if (text === '' || !Number.isFinite(hours)) return fail('Please enter study hours as a number, for example 2.5.');
  if (hours < 0) return fail('Study hours cannot be negative. Enter 0 or more.');
  const xs = students.map(s => s.hours);
  const p = predictMarks(hours, lastModel, { min: Math.min(...xs), max: Math.max(...xs) });
  $('predRaw').textContent = fmt(p.raw);
  $('predFinal').textContent = `${fmt(p.final)}/100`;
  $('predRangeMsg').textContent = p.rangeMessage;
  $('predWarn').textContent = p.datasetWarning;
  $('predOutput').hidden = false;
}

function exportCSV() {
  if (students.length === 0) { showMessage('No data to export.'); return; }
  const rows = ['Student,Study Hours,Academic Marks',
    ...students.map(s => `"${s.name.replace(/"/g, '""')}",${s.hours},${s.marks}`)];
  const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = 'student-data.csv'; a.click();
  URL.revokeObjectURL(url);
}

function toggleTheme() {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('themeBtn').textContent = dark ? 'Light mode' : 'Dark mode';
  updateChart();
}

/* ---------- Start-up ---------- */
$('addBtn').addEventListener('click', addStudent);
$('clearFormBtn').addEventListener('click', clearForm);
$('sampleBtn').addEventListener('click', loadSampleData);
$('clearAllBtn').addEventListener('click', clearAllData);
$('resetBtn').addEventListener('click', resetDashboard);
$('exportBtn').addEventListener('click', exportCSV);
$('predictBtn').addEventListener('click', handlePrediction);
$('themeBtn').addEventListener('click', toggleTheme);
['name', 'hours', 'marks'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') addStudent(); }));
updateDashboard();
